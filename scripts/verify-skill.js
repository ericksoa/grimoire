#!/usr/bin/env node

/**
 * Verifies a skill from the registry by fetching and scanning it.
 *
 * Usage:
 *   node scripts/verify-skill.js <skill-name>
 *   node scripts/verify-skill.js --all
 *   node scripts/verify-skill.js --update-registry <skill-name>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { scanContent, loadPatterns } = require('./security-scan');

const REGISTRIES_DIR = path.join(__dirname, '..', 'registries');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const get = (url) => {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location);
        }
        if (res.statusCode === 404) {
          return resolve(null);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

function parseSource(source) {
  if (source.startsWith('github:')) {
    const repo = source.replace('github:', '');
    return {
      type: 'github',
      repo,
      rawBase: `https://raw.githubusercontent.com/${repo}/main`
    };
  }
  return { type: 'unknown', source };
}

async function fetchSkillContent(source, skillName) {
  const parsed = parseSource(source);

  if (parsed.type !== 'github') {
    throw new Error(`Unsupported source type: ${parsed.type}`);
  }

  // Try common SKILL.md locations
  const repoName = parsed.repo.split('/')[1];
  const locations = [
    `.claude/commands/${skillName}.md`,  // Slash command format
    `.claude/commands/${repoName}.md`,   // Repo name as command
    'SKILL.md',
    'skill.md',
    '.claude/skills/SKILL.md'
  ];

  for (const loc of locations) {
    const url = `${parsed.rawBase}/${loc}`;
    const content = await fetchUrl(url);
    if (content) {
      return { content, location: loc };
    }
  }

  return null;
}

function validateStructure(content, location = '') {
  const errors = [];
  const warnings = [];

  // Check for YAML frontmatter
  if (!content.startsWith('---')) {
    errors.push('Missing YAML frontmatter (must start with ---)');
    return { valid: false, errors, warnings };
  }

  // Extract frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    errors.push('Invalid YAML frontmatter (missing closing ---)');
    return { valid: false, errors, warnings };
  }

  const frontmatter = match[1];
  const isSlashCommand = location.includes('.claude/commands/');

  // Check for name (not required for slash commands - they use filename)
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  if (!isSlashCommand && !nameMatch) {
    errors.push('Missing required field: name');
  } else if (nameMatch) {
    const name = nameMatch[1].trim();
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      errors.push(`Invalid name format: "${name}" (must be lowercase with hyphens)`);
    }
  }

  // Check for description
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (!descMatch) {
    errors.push('Missing required field: description');
  } else if (descMatch[1].trim().length < 10) {
    warnings.push('Description is very short');
  }

  // Check for allowed-tools (optional but recommended)
  if (!frontmatter.includes('allowed-tools:')) {
    warnings.push('No allowed-tools specified (skill will have access to all tools)');
  }

  // Check file size
  if (content.length > 100000) {
    warnings.push(`Large file size (${Math.round(content.length / 1000)}KB)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

async function verifySkill(skillName, options = {}) {
  const { verbose = false, updateRegistry = false } = options;

  console.log(`\nVerifying skill: ${skillName}`);
  console.log('='.repeat(40));

  // Find skill in registries
  const files = fs.readdirSync(REGISTRIES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'schema.json');

  let skill = null;
  let registryFile = null;

  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(REGISTRIES_DIR, file), 'utf8'));
    const found = content.skills?.find(s => s.name === skillName);
    if (found) {
      skill = found;
      registryFile = file;
      break;
    }
  }

  if (!skill) {
    console.error(`Skill "${skillName}" not found in any registry`);
    return { passed: false, error: 'Not found' };
  }

  console.log(`Source: ${skill.source}`);
  console.log(`Registry: ${registryFile}`);

  // Step 1: Fetch skill content
  console.log('\n[1/3] Fetching skill content...');
  let skillContent;
  try {
    skillContent = await fetchSkillContent(skill.source, skillName);
    if (!skillContent) {
      console.log('      ❌ Could not find SKILL.md');
      return { passed: false, error: 'SKILL.md not found' };
    }
    console.log(`      ✓ Found at ${skillContent.location}`);
  } catch (err) {
    console.log(`      ❌ Failed to fetch: ${err.message}`);
    return { passed: false, error: err.message };
  }

  // Step 2: Structure validation
  console.log('\n[2/3] Structure validation...');
  const structure = validateStructure(skillContent.content, skillContent.location);

  for (const err of structure.errors) {
    console.log(`      ❌ ${err}`);
  }
  for (const warn of structure.warnings) {
    console.log(`      ⚠️  ${warn}`);
  }
  if (structure.valid) {
    console.log('      ✓ Structure valid');
  }

  // Step 3: Security scan
  console.log('\n[3/3] Security scan...');
  const patterns = loadPatterns();
  const security = scanContent(skillContent.content, patterns);

  const realDangerous = security.dangerous.filter(d => !d.isDocumentation);

  if (realDangerous.length > 0) {
    console.log('      ❌ Dangerous patterns found:');
    for (const item of realDangerous) {
      console.log(`         Line ${item.line}: ${item.reason}`);
    }
  } else {
    console.log('      ✓ No dangerous patterns');
  }

  if (security.suspicious.length > 0) {
    console.log(`      ⚠️  ${security.suspicious.length} suspicious patterns (review recommended)`);
    if (verbose) {
      for (const item of security.suspicious) {
        console.log(`         Line ${item.line}: ${item.reason}`);
      }
    }
  } else {
    console.log('      ✓ No suspicious patterns');
  }

  // Final result
  const passed = structure.valid && realDangerous.length === 0;

  console.log('\n' + '='.repeat(40));
  if (passed) {
    console.log(`✅ PASSED - Skill "${skillName}" is verified`);
  } else {
    console.log(`❌ FAILED - Skill "${skillName}" has issues`);
  }

  // Update registry if requested
  if (updateRegistry && passed) {
    console.log('\nUpdating registry with verified status...');
    const regPath = path.join(REGISTRIES_DIR, registryFile);
    const regContent = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    const skillIndex = regContent.skills.findIndex(s => s.name === skillName);

    if (skillIndex !== -1) {
      regContent.skills[skillIndex].verified = true;
      regContent.skills[skillIndex].verified_at = new Date().toISOString().split('T')[0];
      fs.writeFileSync(regPath, JSON.stringify(regContent, null, 2) + '\n');
      console.log(`✓ Updated ${registryFile}`);
    }
  }

  return {
    passed,
    structure,
    security,
    skill
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node verify-skill.js [options] <skill-name>

Options:
  --all              Verify all skills in registries
  --update-registry  Update registry with verified status if passed
  --verbose          Show detailed findings
  --json             Output results as JSON
  --help             Show this help message

Examples:
  node verify-skill.js evolve
  node verify-skill.js --update-registry evolve
  node verify-skill.js --all --verbose
`);
    process.exit(0);
  }

  const verbose = args.includes('--verbose') || args.includes('-v');
  const updateRegistry = args.includes('--update-registry');
  const verifyAll = args.includes('--all');
  const jsonOutput = args.includes('--json');

  if (verifyAll) {
    // Verify all skills in all registries
    const files = fs.readdirSync(REGISTRIES_DIR)
      .filter(f => f.endsWith('.json') && f !== 'schema.json');

    const allResults = [];

    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(REGISTRIES_DIR, file), 'utf8'));
      for (const skill of content.skills || []) {
        const result = await verifySkill(skill.name, { verbose, updateRegistry });
        allResults.push({ name: skill.name, ...result });
      }
    }

    if (jsonOutput) {
      console.log(JSON.stringify(allResults, null, 2));
    } else {
      console.log('\n' + '='.repeat(40));
      console.log('SUMMARY');
      console.log('='.repeat(40));
      const passed = allResults.filter(r => r.passed).length;
      const failed = allResults.filter(r => !r.passed).length;
      console.log(`Passed: ${passed}`);
      console.log(`Failed: ${failed}`);
    }

    process.exit(allResults.some(r => !r.passed) ? 1 : 0);
  } else {
    const skillName = args.find(a => !a.startsWith('-'));
    if (!skillName) {
      console.error('No skill name specified. Use --help for usage.');
      process.exit(1);
    }

    const result = await verifySkill(skillName, { verbose, updateRegistry });

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    }

    process.exit(result.passed ? 0 : 1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
