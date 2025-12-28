#!/usr/bin/env node

/**
 * Security scanner for Claude Code skills.
 * Scans SKILL.md content for dangerous or suspicious patterns.
 *
 * Usage:
 *   node scripts/security-scan.js <content-or-file>
 *   cat SKILL.md | node scripts/security-scan.js --stdin
 */

const fs = require('fs');
const path = require('path');

const PATTERNS_PATH = path.join(__dirname, '..', 'security', 'patterns.json');

function loadPatterns() {
  const content = fs.readFileSync(PATTERNS_PATH, 'utf8');
  return JSON.parse(content);
}

function scanContent(content, patterns) {
  const results = {
    dangerous: [],
    suspicious: [],
    passed: true
  };

  const lines = content.split('\n');

  // Check dangerous patterns
  for (const { pattern, reason } of patterns.dangerous) {
    const regex = new RegExp(pattern, 'gi');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        // Check if it's in a code block (might be documentation)
        const isInCodeBlock = isDocumentation(lines, i);
        results.dangerous.push({
          line: i + 1,
          content: line.trim().substring(0, 100),
          reason,
          isDocumentation: isInCodeBlock
        });
        if (!isInCodeBlock) {
          results.passed = false;
        }
      }
    }
  }

  // Check suspicious patterns
  for (const { pattern, reason } of patterns.suspicious) {
    const regex = new RegExp(pattern, 'gi');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        results.suspicious.push({
          line: i + 1,
          content: line.trim().substring(0, 100),
          reason
        });
      }
    }
  }

  // Check for very long lines (potential obfuscation)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 500) {
      results.suspicious.push({
        line: i + 1,
        content: `Line has ${lines[i].length} characters`,
        reason: 'Very long line (potential obfuscation)'
      });
    }
  }

  return results;
}

function isDocumentation(lines, lineIndex) {
  // Check if we're inside a markdown code block
  let inCodeBlock = false;
  for (let i = 0; i < lineIndex; i++) {
    if (lines[i].trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
  }
  return inCodeBlock;
}

function formatResults(results, verbose = false) {
  const output = [];

  if (results.dangerous.length > 0) {
    output.push('\n🚨 DANGEROUS PATTERNS FOUND:');
    for (const item of results.dangerous) {
      const docNote = item.isDocumentation ? ' (in code block - may be documentation)' : '';
      output.push(`  Line ${item.line}: ${item.reason}${docNote}`);
      if (verbose) {
        output.push(`    ${item.content}`);
      }
    }
  }

  if (results.suspicious.length > 0) {
    output.push('\n⚠️  SUSPICIOUS PATTERNS FOUND:');
    for (const item of results.suspicious) {
      output.push(`  Line ${item.line}: ${item.reason}`);
      if (verbose) {
        output.push(`    ${item.content}`);
      }
    }
  }

  if (results.dangerous.length === 0 && results.suspicious.length === 0) {
    output.push('\n✅ No security issues found');
  }

  return output.join('\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node security-scan.js [options] <file-or-content>

Options:
  --stdin     Read content from stdin
  --verbose   Show matched content
  --json      Output results as JSON
  --help      Show this help message

Examples:
  node security-scan.js SKILL.md
  cat SKILL.md | node security-scan.js --stdin
  node security-scan.js --json SKILL.md
`);
    process.exit(0);
  }

  const patterns = loadPatterns();
  const verbose = args.includes('--verbose') || args.includes('-v');
  const jsonOutput = args.includes('--json');
  const useStdin = args.includes('--stdin');

  let content;

  if (useStdin) {
    // Read from stdin
    content = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      content += chunk;
    }
  } else {
    const file = args.find(a => !a.startsWith('-'));
    if (!file) {
      console.error('No file specified. Use --help for usage.');
      process.exit(1);
    }

    if (fs.existsSync(file)) {
      content = fs.readFileSync(file, 'utf8');
    } else {
      // Treat as content string
      content = file;
    }
  }

  const results = scanContent(content, patterns);

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(formatResults(results, verbose));
  }

  // Exit with error if dangerous patterns found (not in documentation)
  const realDangerous = results.dangerous.filter(d => !d.isDocumentation);
  process.exit(realDangerous.length > 0 ? 1 : 0);
}

// Only run main if this is the entry point
if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { scanContent, loadPatterns };
