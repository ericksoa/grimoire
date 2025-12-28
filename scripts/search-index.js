#!/usr/bin/env node

/**
 * Fast skill search using local index.
 *
 * Usage:
 *   node scripts/search-index.js <term>
 *   node scripts/search-index.js docker
 *   node scripts/search-index.js --rebuild docker
 */

const fs = require('fs');
const path = require('path');
const { buildIndex, isIndexFresh, loadExistingIndex, INDEX_PATH } = require('./build-index');

function scoreSkill(skill, terms) {
  let score = 0;
  const lowerTerms = terms.map(t => t.toLowerCase());
  const name = skill.name.toLowerCase();
  const desc = (skill.description || '').toLowerCase();
  const tags = (skill.tags || []).map(t => t.toLowerCase());

  for (const term of lowerTerms) {
    // Exact name match
    if (name === term) {
      score += 100;
    }
    // Name starts with term
    else if (name.startsWith(term)) {
      score += 60;
    }
    // Name contains term
    else if (name.includes(term)) {
      score += 40;
    }

    // Exact tag match
    if (tags.includes(term)) {
      score += 30;
    }
    // Tag starts with term
    else if (tags.some(t => t.startsWith(term))) {
      score += 20;
    }

    // Description contains term
    if (desc.includes(term)) {
      score += 10;
    }
  }

  return score;
}

function searchSkills(index, query, options = {}) {
  const { limit = 10 } = options;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  const scored = index.skills
    .map(skill => ({
      ...skill,
      score: scoreSkill(skill, terms)
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

function formatResults(results, options = {}) {
  const { json = false, verbose = false } = options;

  if (json) {
    return JSON.stringify(results, null, 2);
  }

  if (results.length === 0) {
    return 'No skills found matching your search.';
  }

  const lines = [`Found ${results.length} skill(s):\n`];

  for (const skill of results) {
    const verified = skill.verified ? ' ✓' : '';
    const tags = skill.tags?.length ? ` [${skill.tags.join(', ')}]` : '';

    lines.push(`  ${skill.name}${verified}`);
    lines.push(`    ${skill.description}`);
    if (verbose) {
      lines.push(`    Source: ${skill.source}`);
      lines.push(`    Registry: ${skill.registry}${tags}`);
      lines.push(`    Score: ${skill.score}`);
    } else if (tags) {
      lines.push(`    Tags:${tags}`);
    }
    lines.push('');
  }

  lines.push(`Install with: /grimoire install <name>`);

  return lines.join('\n');
}

async function search(query, options = {}) {
  const { rebuild = false, online = false } = options;
  const startTime = Date.now();

  // Get or build index
  let index;

  if (rebuild || online || !isIndexFresh()) {
    index = await buildIndex({ force: rebuild || online, quiet: true });
  } else {
    index = loadExistingIndex();
    if (!index) {
      index = await buildIndex({ quiet: true });
    }
  }

  // Search
  const results = searchSkills(index, query, options);
  const elapsed = Date.now() - startTime;

  return {
    results,
    elapsed,
    fromCache: !rebuild && !online && isIndexFresh()
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node search-index.js [options] <query>

Options:
  --rebuild   Force rebuild index before search
  --online    Fetch fresh data (alias for --rebuild)
  --json      Output results as JSON
  --verbose   Show detailed skill info
  --limit N   Maximum results (default: 10)
  --help      Show this help message

Examples:
  node search-index.js docker
  node search-index.js "git commit"
  node search-index.js --verbose testing
`);
    process.exit(0);
  }

  const rebuild = args.includes('--rebuild');
  const online = args.includes('--online');
  const json = args.includes('--json');
  const verbose = args.includes('--verbose') || args.includes('-v');

  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10;

  // Get query (non-flag arguments)
  const query = args
    .filter(a => !a.startsWith('-'))
    .filter(a => limitIdx === -1 || args.indexOf(a) !== limitIdx + 1)
    .join(' ');

  if (!query) {
    console.error('No search query provided. Use --help for usage.');
    process.exit(1);
  }

  const { results, elapsed, fromCache } = await search(query, {
    rebuild,
    online,
    limit
  });

  if (!json) {
    const cacheNote = fromCache ? ' (cached)' : '';
    console.log(`Search completed in ${elapsed}ms${cacheNote}\n`);
  }

  console.log(formatResults(results, { json, verbose }));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

module.exports = { search, searchSkills };
