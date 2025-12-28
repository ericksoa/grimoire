#!/usr/bin/env node

/**
 * Exports installed skills and registries to a profile JSON file.
 *
 * Usage:
 *   node scripts/export-profile.js [output-file]
 *   node scripts/export-profile.js --gist
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILLS_DIR = path.join(require('os').homedir(), '.claude', 'skills');
const REGISTRIES_DIR = path.join(SKILLS_DIR, 'grimoire', 'registries');
const DEFAULT_OUTPUT = path.join(require('os').homedir(), '.grimoire-profile.json');

function getGitRemote(skillPath) {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: skillPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    // Convert to github: shorthand if possible
    const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) {
      return `github:${match[1]}`;
    }
    return remote;
  } catch {
    return null;
  }
}

function scanSkills() {
  const skills = [];

  if (!fs.existsSync(SKILLS_DIR)) {
    return skills;
  }

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() || d.isSymbolicLink())
    .map(d => d.name)
    .filter(name => name !== 'grimoire'); // Exclude grimoire itself

  for (const name of dirs) {
    const skillPath = path.join(SKILLS_DIR, name);
    const realPath = fs.realpathSync(skillPath);
    const source = getGitRemote(realPath);

    if (source) {
      skills.push({
        name,
        source,
        location: 'personal'
      });
    } else {
      // Non-git skill, try to note it
      skills.push({
        name,
        source: `local:${realPath}`,
        location: 'personal'
      });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function scanRegistries() {
  const registries = [];

  if (!fs.existsSync(REGISTRIES_DIR)) {
    return registries;
  }

  const files = fs.readdirSync(REGISTRIES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'schema.json');

  for (const file of files) {
    const name = file.replace('.json', '');
    // For now, assume registries from our repo
    registries.push({
      name,
      source: `https://raw.githubusercontent.com/ericksoa/grimoire/main/registries/${file}`
    });
  }

  return registries;
}

function loadSettings() {
  const settingsPath = path.join(SKILLS_DIR, 'grimoire', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
  return {
    default_scope: 'personal'
  };
}

function exportProfile(outputPath, useGist = false) {
  console.log('Scanning installed skills...');
  const skills = scanSkills();
  console.log(`Found ${skills.length} skills`);

  console.log('Scanning registries...');
  const registries = scanRegistries();
  console.log(`Found ${registries.length} registries`);

  const profile = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    skills,
    registries,
    settings: loadSettings()
  };

  const json = JSON.stringify(profile, null, 2);

  if (useGist) {
    // Write to temp file and upload to gist
    const tempFile = '/tmp/grimoire-profile.json';
    fs.writeFileSync(tempFile, json);

    try {
      // Check if gist_id exists in settings
      const settings = loadSettings();
      if (settings.gist_id) {
        console.log(`Updating existing gist ${settings.gist_id}...`);
        execSync(`gh gist edit ${settings.gist_id} ${tempFile}`, { stdio: 'inherit' });
      } else {
        console.log('Creating new gist...');
        const result = execSync(`gh gist create ${tempFile} -d "Grimoire Profile" -f grimoire-profile.json`, {
          encoding: 'utf8'
        });
        console.log(`Gist created: ${result.trim()}`);
        console.log('Save this gist ID to sync in the future.');
      }
    } catch (error) {
      console.error('Failed to upload to gist. Is `gh` CLI authenticated?');
      process.exit(1);
    }
  } else {
    fs.writeFileSync(outputPath, json);
    console.log(`Profile exported to: ${outputPath}`);
  }

  // Print summary
  console.log('\n--- Profile Summary ---');
  console.log(`Skills: ${skills.length}`);
  for (const skill of skills) {
    console.log(`  - ${skill.name} (${skill.source})`);
  }
  console.log(`Registries: ${registries.length}`);
  for (const reg of registries) {
    console.log(`  - ${reg.name}`);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node export-profile.js [options] [output-file]

Options:
  --gist    Upload profile to GitHub Gist
  --help    Show this help message

Examples:
  node export-profile.js                    # Export to ~/.grimoire-profile.json
  node export-profile.js my-setup.json      # Export to specific file
  node export-profile.js --gist             # Upload to GitHub Gist
`);
    process.exit(0);
  }

  const useGist = args.includes('--gist');
  const outputPath = args.find(a => !a.startsWith('-')) || DEFAULT_OUTPUT;

  exportProfile(outputPath, useGist);
}

main();
