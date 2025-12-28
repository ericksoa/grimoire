# Contributing to Grimoire

Want to share your Claude Code skill with the community? Here's how.

## Adding Your Skill to the Registry

### 1. Fork this repository

### 2. Add your skill to `registries/community.json`

```json
{
  "name": "your-skill-name",
  "description": "A clear, concise description of what your skill does",
  "source": "github:your-username/your-repo",
  "tags": ["relevant", "tags", "here"],
  "version": "1.0.0"
}
```

### 3. Submit a Pull Request

That's it! Once merged, users can install your skill with:

```bash
/grimoire install your-skill-name
```

## Skill Requirements

Your skill repository must include a valid `SKILL.md` file:

```markdown
---
name: your-skill-name
description: What your skill does
allowed-tools: Bash, Read, Write, Edit
---

# Your Skill Name

Instructions for Claude go here...
```

### Required Fields

| Field | Description |
|-------|-------------|
| `name` | Lowercase, hyphens only (e.g., `my-cool-skill`) |
| `description` | Clear explanation of what the skill does |
| `source` | GitHub reference: `github:owner/repo` |
| `tags` | Array of relevant keywords for search |
| `version` | Semantic version (e.g., `1.0.0`) |

### SKILL.md Requirements

- Must have YAML frontmatter between `---` markers
- `name` field must match registry entry
- `description` field is required
- `allowed-tools` specifies which tools the skill can use

## Registry Schema

Skills are validated against the following structure:

```json
{
  "name": "string (required, lowercase with hyphens)",
  "description": "string (required, non-empty)",
  "source": "string (required, github:owner/repo format)",
  "tags": ["array", "of", "strings"],
  "version": "string (semver format)"
}
```

## Source Formats

The `source` field supports:

| Format | Example |
|--------|---------|
| GitHub shorthand | `github:owner/repo` |
| GitHub URL | `https://github.com/owner/repo` |
| Git URL | `git@github.com:owner/repo.git` |

## Best Practices

1. **Clear descriptions** - Explain what your skill does in one sentence
2. **Relevant tags** - Help users find your skill via search
3. **Good documentation** - Include examples in your SKILL.md
4. **Specify tools** - Only request the tools your skill actually needs
5. **Test locally** - Install your skill and verify it works before submitting

## Questions?

Open an issue if you need help or have suggestions for improving grimoire.
