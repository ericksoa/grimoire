#!/usr/bin/env node

/**
 * Generates the skill catalog section of README.md from registry JSON files.
 *
 * Usage: node scripts/generate-catalog.js
 */

const fs = require('fs');
const path = require('path');

const REGISTRIES_DIR = path.join(__dirname, '..', 'registries');
const README_PATH = path.join(__dirname, '..', 'README.md');

const CATALOG_START = '<!-- CATALOG:START - Do not remove. Auto-generated from registries/*.json -->';
const CATALOG_END = '<!-- CATALOG:END -->';

function parseSource(source) {
  if (source.startsWith('github:')) {
    const repo = source.replace('github:', '');
    return `https://github.com/${repo}`;
  }
  return source;
}

function formatTags(tags) {
  if (!tags || tags.length === 0) return '';
  return tags.map(tag => `\`${tag}\``).join(' ');
}

function loadRegistries() {
  const skills = [];

  const files = fs.readdirSync(REGISTRIES_DIR)
    .filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(REGISTRIES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const registry = JSON.parse(content);

    if (registry.skills && Array.isArray(registry.skills)) {
      skills.push(...registry.skills);
    }
  }

  // Sort alphabetically by name
  skills.sort((a, b) => a.name.localeCompare(b.name));

  return skills;
}

function generateCatalogTable(skills) {
  const lines = [
    '',
    '| Skill | Description | Verified | Tags | Install |',
    '|-------|-------------|:--------:|------|---------|',
  ];

  for (const skill of skills) {
    const url = parseSource(skill.source);
    const name = `[${skill.name}](${url})`;
    const desc = skill.description;
    const verified = skill.verified ? '✓' : '';
    const tags = formatTags(skill.tags);
    const install = `\`/grimoire install ${skill.name}\``;

    lines.push(`| ${name} | ${desc} | ${verified} | ${tags} | ${install} |`);
  }

  lines.push('');

  return lines.join('\n');
}

function updateReadme(catalogContent, skillCount, verifiedCount) {
  let readme = fs.readFileSync(README_PATH, 'utf8');

  const startIdx = readme.indexOf(CATALOG_START);
  const endIdx = readme.indexOf(CATALOG_END);

  if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find catalog markers in README.md');
    process.exit(1);
  }

  const before = readme.substring(0, startIdx + CATALOG_START.length);
  const after = readme.substring(endIdx);

  // Update skill count badge
  let newReadme = before + catalogContent + after;
  const countText = verifiedCount > 0
    ? `**${skillCount} skills** (${verifiedCount} verified)`
    : `**${skillCount} skills available**`;

  newReadme = newReadme.replace(
    /\*\*\d+ skills.*?\*\*(?:\s*\(\d+ verified\))?/,
    countText
  );

  fs.writeFileSync(README_PATH, newReadme);

  return skillCount;
}

function main() {
  console.log('Loading registries...');
  const skills = loadRegistries();
  const verifiedCount = skills.filter(s => s.verified).length;
  console.log(`Found ${skills.length} skills (${verifiedCount} verified)`);

  console.log('Generating catalog...');
  const catalog = generateCatalogTable(skills);

  console.log('Updating README.md...');
  updateReadme(catalog, skills.length, verifiedCount);

  console.log('Done!');
}

main();
