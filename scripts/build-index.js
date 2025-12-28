#!/usr/bin/env node

/**
 * Builds a local search index from registry files.
 *
 * Usage:
 *   node scripts/build-index.js
 *   node scripts/build-index.js --force
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const REGISTRIES_DIR = path.join(__dirname, '..', 'registries');
const INDEX_DIR = path.join(os.homedir(), '.grimoire');
const INDEX_PATH = path.join(INDEX_DIR, 'index.json');
const INDEX_VERSION = '1.0.0';
const TTL_HOURS = 24;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const get = (url) => {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location);
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

function loadLocalRegistries() {
  const registries = {};
  const skills = [];

  if (!fs.existsSync(REGISTRIES_DIR)) {
    return { registries, skills };
  }

  const files = fs.readdirSync(REGISTRIES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'schema.json');

  for (const file of files) {
    const name = file.replace('.json', '');
    const filePath = path.join(REGISTRIES_DIR, file);

    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      registries[name] = {
        source: `local:${filePath}`,
        fetched_at: new Date().toISOString()
      };

      if (content.skills && Array.isArray(content.skills)) {
        for (const skill of content.skills) {
          skills.push({
            ...skill,
            registry: name
          });
        }
      }
    } catch (err) {
      console.error(`Error loading ${file}: ${err.message}`);
    }
  }

  return { registries, skills };
}

async function fetchRemoteRegistry(url, name) {
  try {
    console.log(`  Fetching ${name} from ${url}...`);
    const content = await fetchUrl(url);
    const data = JSON.parse(content);

    return {
      registry: {
        source: url,
        fetched_at: new Date().toISOString()
      },
      skills: (data.skills || []).map(s => ({ ...s, registry: name }))
    };
  } catch (err) {
    console.error(`  Failed to fetch ${name}: ${err.message}`);
    return null;
  }
}

function isIndexFresh() {
  if (!fs.existsSync(INDEX_PATH)) {
    return false;
  }

  try {
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    const updatedAt = new Date(index.updated_at);
    const now = new Date();
    const hoursSinceUpdate = (now - updatedAt) / (1000 * 60 * 60);

    return hoursSinceUpdate < TTL_HOURS;
  } catch {
    return false;
  }
}

function loadExistingIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function buildIndex(options = {}) {
  const { force = false, quiet = false } = options;
  const log = quiet ? () => {} : console.log;

  // Check if rebuild is needed
  if (!force && isIndexFresh()) {
    log('Index is fresh (< 24h old). Use --force to rebuild.');
    return loadExistingIndex();
  }

  log('Building search index...');
  const startTime = Date.now();

  // Load local registries
  log('Loading local registries...');
  const local = loadLocalRegistries();

  // Remote registries can be configured here
  // For now, we just use local registries
  const remoteUrls = {
    // 'community': 'https://raw.githubusercontent.com/ericksoa/grimoire/main/registries/community.json'
  };

  // Fetch remote registries
  for (const [name, url] of Object.entries(remoteUrls)) {
    const remote = await fetchRemoteRegistry(url, name);
    if (remote) {
      local.registries[name] = remote.registry;
      // Merge skills, preferring remote versions
      const existingNames = new Set(local.skills.map(s => s.name));
      for (const skill of remote.skills) {
        if (!existingNames.has(skill.name)) {
          local.skills.push(skill);
        }
      }
    }
  }

  // Sort skills by name
  local.skills.sort((a, b) => a.name.localeCompare(b.name));

  // Build index
  const index = {
    version: INDEX_VERSION,
    updated_at: new Date().toISOString(),
    registries: local.registries,
    skills: local.skills
  };

  // Ensure index directory exists
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
  }

  // Write index
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

  const elapsed = Date.now() - startTime;
  log(`Index built in ${elapsed}ms`);
  log(`  ${Object.keys(index.registries).length} registries`);
  log(`  ${index.skills.length} skills`);
  log(`  Saved to ${INDEX_PATH}`);

  return index;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node build-index.js [options]

Options:
  --force    Rebuild even if index is fresh
  --quiet    Suppress output
  --help     Show this help message

The index is stored at ~/.grimoire/index.json and is considered
fresh for 24 hours. After that, it will be automatically rebuilt
on the next search.
`);
    process.exit(0);
  }

  const force = args.includes('--force');
  const quiet = args.includes('--quiet');

  await buildIndex({ force, quiet });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

module.exports = { buildIndex, isIndexFresh, loadExistingIndex, INDEX_PATH };
