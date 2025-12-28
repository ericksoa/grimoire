#!/usr/bin/env node

/**
 * Imports skills and registries from a profile JSON file.
 *
 * Usage:
 *   node scripts/import-profile.js <profile-file>
 *   node scripts/import-profile.js <url>
 *   node scripts/import-profile.js --gist <gist-id>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const SKILLS_DIR = path.join(require('os').homedir(), '.claude', 'skills');
const REGISTRIES_DIR = path.join(SKILLS_DIR, 'grimoire', 'registries');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseSource(source) {
  if (source.startsWith('github:')) {
    const repo = source.replace('github:', '');
    return `https://github.com/${repo}.git`;
  }
  if (source.startsWith('local:')) {
    return null; // Can't import local skills
  }
  return source;
}

function isSkillInstalled(name) {
  const skillPath = path.join(SKILLS_DIR, name);
  return fs.existsSync(skillPath);
}

function installSkill(skill, dryRun = false) {
  const { name, source, location } = skill;

  if (source.startsWith('local:')) {
    console.log(`  SKIP ${name} (local skill, cannot import)`);
    return false;
  }

  const gitUrl = parseSource(source);
  if (!gitUrl) {
    console.log(`  SKIP ${name} (invalid source: ${source})`);
    return false;
  }

  const targetDir = location === 'project'
    ? path.join(process.cwd(), '.claude', 'skills', name)
    : path.join(SKILLS_DIR, name);

  if (fs.existsSync(targetDir)) {
    console.log(`  SKIP ${name} (already installed)`);
    return false;
  }

  if (dryRun) {
    console.log(`  WOULD INSTALL ${name} from ${source}`);
    return true;
  }

  console.log(`  INSTALLING ${name} from ${source}...`);
  try {
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });

    execSync(`git clone ${gitUrl} ${targetDir}`, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`  OK ${name}`);
    return true;
  } catch (error) {
    console.error(`  FAILED ${name}: ${error.message}`);
    return false;
  }
}

function installRegistry(registry, dryRun = false) {
  const { name, source } = registry;
  const targetPath = path.join(REGISTRIES_DIR, `${name}.json`);

  if (fs.existsSync(targetPath)) {
    console.log(`  SKIP registry ${name} (already exists)`);
    return false;
  }

  if (dryRun) {
    console.log(`  WOULD ADD registry ${name} from ${source}`);
    return true;
  }

  console.log(`  ADDING registry ${name}...`);
  try {
    execSync(`curl -sL -o "${targetPath}" "${source}"`, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`  OK registry ${name}`);
    return true;
  } catch (error) {
    console.error(`  FAILED registry ${name}: ${error.message}`);
    return false;
  }
}

async function importProfile(source, options = {}) {
  const { dryRun = false, skipExisting = true } = options;

  let profile;

  // Load profile from source
  if (source.startsWith('http://') || source.startsWith('https://')) {
    console.log(`Fetching profile from ${source}...`);
    const data = await fetchUrl(source);
    profile = JSON.parse(data);
  } else if (fs.existsSync(source)) {
    console.log(`Loading profile from ${source}...`);
    profile = JSON.parse(fs.readFileSync(source, 'utf8'));
  } else {
    console.error(`Profile not found: ${source}`);
    process.exit(1);
  }

  console.log(`\nProfile version: ${profile.version}`);
  console.log(`Exported at: ${profile.exported_at}`);

  if (dryRun) {
    console.log('\n--- DRY RUN MODE ---\n');
  }

  // Import skills
  const skills = profile.skills || [];
  console.log(`\nImporting ${skills.length} skills...`);

  let installed = 0;
  let skipped = 0;
  let failed = 0;

  for (const skill of skills) {
    if (skill.name === 'grimoire') continue; // Never overwrite grimoire

    if (skipExisting && isSkillInstalled(skill.name)) {
      console.log(`  SKIP ${skill.name} (already installed)`);
      skipped++;
      continue;
    }

    if (installSkill(skill, dryRun)) {
      installed++;
    } else {
      if (!isSkillInstalled(skill.name)) {
        failed++;
      } else {
        skipped++;
      }
    }
  }

  // Import registries
  const registries = profile.registries || [];
  console.log(`\nImporting ${registries.length} registries...`);

  for (const registry of registries) {
    installRegistry(registry, dryRun);
  }

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Installed: ${installed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (installed > 0 && !dryRun) {
    console.log('\nRestart Claude Code to load the new skills.');
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
Usage: node import-profile.js [options] <source>

Source can be:
  - Local file path (e.g., my-profile.json)
  - URL (e.g., https://example.com/profile.json)
  - Gist (use --gist <gist-id>)

Options:
  --dry-run       Show what would be installed without doing it
  --gist <id>     Import from GitHub Gist
  --force         Reinstall existing skills
  --help          Show this help message

Examples:
  node import-profile.js ~/.grimoire-profile.json
  node import-profile.js https://gist.githubusercontent.com/.../profile.json
  node import-profile.js --gist abc123
  node import-profile.js --dry-run my-profile.json
`);
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const gistIdx = args.indexOf('--gist');

  let source;

  if (gistIdx !== -1 && args[gistIdx + 1]) {
    const gistId = args[gistIdx + 1];
    // Fetch gist content using gh CLI
    try {
      const result = execSync(`gh gist view ${gistId} -f grimoire-profile.json`, {
        encoding: 'utf8'
      });
      // Write to temp file
      const tempFile = '/tmp/grimoire-profile-import.json';
      fs.writeFileSync(tempFile, result);
      source = tempFile;
    } catch (error) {
      console.error(`Failed to fetch gist ${gistId}. Is it public or are you authenticated?`);
      process.exit(1);
    }
  } else {
    source = args.find(a => !a.startsWith('-'));
  }

  if (!source) {
    console.error('No profile source specified. Use --help for usage.');
    process.exit(1);
  }

  await importProfile(source, { dryRun, skipExisting: !force });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
