# Grimoire

**Skill manager for Claude Code**

Discover, install, and manage skills that extend Claude Code's capabilities.

---

## Quick Start

```bash
# Install grimoire
git clone https://github.com/ericksoa/grimoire ~/.claude/skills/grimoire

# Restart Claude Code, then use it:
/grimoire list              # See installed skills
/grimoire search docker     # Find skills
/grimoire install evolve    # Install from registry
```

## Skills Catalog

<!-- CATALOG:START - Do not remove. Auto-generated from registries/*.json -->
| Skill | Description | Verified | Tags | Install |
|-------|-------------|:--------:|------|---------|
| [commit-wizard](https://github.com/example/commit-wizard-skill) | Smart git commits with conventional commit format, auto-generated messages, and scope detection |  | `git` `commits` `conventional-commits` | `/grimoire install commit-wizard` |
| [debug-oracle](https://github.com/example/debug-oracle-skill) | Advanced debugging assistance with stack trace analysis and root cause detection |  | `debugging` `errors` `troubleshooting` | `/grimoire install debug-oracle` |
| [doc-scribe](https://github.com/example/doc-scribe-skill) | Generate and maintain documentation, READMEs, and API docs from code |  | `documentation` `readme` `api-docs` | `/grimoire install doc-scribe` |
| [evolve](https://github.com/ericksoa/agentic-evolve) | Genetic algorithm optimizer for performance-critical code using parallel Claude Code agents to discover faster implementations through evolution | ✓ | `optimization` `genetic-algorithm` `performance` `rust` `benchmarks` | `/grimoire install evolve` |
| [mcp-builder](https://github.com/anthropics/skills) | Generate fully functional MCP servers from natural language descriptions (Official Anthropic skill) |  | `mcp` `server` `code-generation` `anthropic-official` | `/grimoire install mcp-builder` |
| [refactor-sage](https://github.com/example/refactor-sage-skill) | Intelligent code refactoring with pattern detection and best practice suggestions |  | `refactoring` `code-quality` `patterns` | `/grimoire install refactor-sage` |
| [skill-creator](https://github.com/anthropics/skills) | Create new Claude Code skills with proper structure and best practices (Official Anthropic skill) |  | `meta` `skill-development` `templates` `anthropic-official` | `/grimoire install skill-creator` |
| [test-whisperer](https://github.com/example/test-whisperer-skill) | Generate comprehensive test suites with edge cases, mocks, and coverage analysis |  | `testing` `jest` `pytest` `coverage` | `/grimoire install test-whisperer` |
| [webapp-testing](https://github.com/anthropics/skills) | Automated testing for web applications with browser automation and assertions (Official Anthropic skill) |  | `testing` `web` `automation` `browser` `anthropic-official` | `/grimoire install webapp-testing` |
<!-- CATALOG:END -->

**9 skills** (1 verified) | [Add yours](CONTRIBUTING.md)

## Commands

| Command | Description |
|---------|-------------|
| `/grimoire list` | Show installed skills |
| `/grimoire search <term>` | Find skills by name, description, or tags |
| `/grimoire install <name>` | Install a skill from the registry |
| `/grimoire install github:owner/repo` | Install directly from GitHub |
| `/grimoire update` | Update all git-managed skills |
| `/grimoire remove <name>` | Uninstall a skill |
| `/grimoire create` | Create a new skill |
| `/grimoire export` | Export skills to a profile file |
| `/grimoire import <file>` | Import skills from a profile |
| `/grimoire update-index` | Refresh the local search index |

## Fast Offline Search

Grimoire caches registry data locally for instant search:

```bash
/grimoire search docker          # <50ms, works offline

# Force refresh from registries
/grimoire update-index
```

The index is stored at `~/.grimoire/index.json` and auto-refreshes every 24 hours.

## Profiles

Share your skill setup across machines or with others:

```bash
# Export your current setup
/grimoire export                      # Saves to ~/.grimoire-profile.json
/grimoire export --gist               # Upload to GitHub Gist

# Import on another machine
/grimoire import ~/profile.json       # From local file
/grimoire import --gist <gist-id>     # From GitHub Gist
/grimoire import --dry-run file.json  # Preview without installing
```

Profiles capture:
- Installed skills (with git sources)
- Configured registries
- Grimoire settings

## How It Works

Grimoire manages skills in two locations:

- **Personal skills**: `~/.claude/skills/` - Available in all projects
- **Project skills**: `.claude/skills/` - Project-specific, can be committed

Skills are defined by a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: my-skill
description: What it does
allowed-tools: Bash, Read, Write
---

# Instructions for Claude

Your skill's prompt goes here...
```

## Add Your Skill

Want to share your skill? See [CONTRIBUTING.md](CONTRIBUTING.md) for instructions.

## Security

Skills marked with ✓ in the catalog have passed automated security verification:

- **Structure validation**: Valid SKILL.md with required fields
- **Security scanning**: No dangerous patterns (credential access, remote code execution, etc.)

See [SECURITY.md](SECURITY.md) for details on what we scan for and how to verify skills locally.

```bash
# Verify a skill before installing
node ~/.claude/skills/grimoire/scripts/verify-skill.js <skill-name>
```

## License

MIT
