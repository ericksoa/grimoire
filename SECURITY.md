# Security Policy

## Skill Verification

Grimoire includes automated security scanning to protect users from malicious skills. Every skill submitted to the registry is scanned for dangerous patterns before it can be marked as verified.

### What We Scan For

#### Dangerous Patterns (Block Merge)

These patterns will cause a skill to fail verification:

| Pattern | Risk |
|---------|------|
| `curl \| sh` / `wget \| bash` | Remote code execution |
| Command substitution with curl/wget | Hidden command execution |
| `.ssh/` directory access | SSH key theft |
| `.aws/` directory access | AWS credential theft |
| `.gnupg/` directory access | GPG key theft |
| `eval` with variables | Code injection |
| `/etc/passwd` or `/etc/shadow` | System file access |
| `chmod 777` | Insecure permissions |
| `rm -rf /` (non-tmp) | Destructive commands |

#### Suspicious Patterns (Warning)

These patterns trigger warnings but don't block verification:

| Pattern | Concern |
|---------|---------|
| Base64 decoding | Potential obfuscation |
| Hidden file access (`$HOME/.`) | Sensitive file access |
| Netcat listeners | Potential backdoor |
| Inline Python execution | Dynamic code |
| API key references | Credential handling |
| Very long lines (>500 chars) | Potential obfuscation |

### Verification Status

Skills in the catalog can have the following verification status:

- **✓ Verified**: Passed all security checks and structure validation
- **(blank)**: Not yet verified or failed verification

### Running Verification Locally

You can verify skills before submitting them:

```bash
# Verify a specific skill
node scripts/verify-skill.js <skill-name>

# Run security scan on any file
node scripts/security-scan.js SKILL.md

# Verify with verbose output
node scripts/verify-skill.js <skill-name> --verbose
```

## Reporting Security Issues

If you discover a security vulnerability in grimoire or a verified skill:

1. **Do NOT open a public issue**
2. Email the maintainer directly with details
3. Include steps to reproduce the vulnerability
4. Allow time for a fix before public disclosure

## Best Practices for Skill Authors

1. **Minimize tool access**: Only request tools your skill actually needs via `allowed-tools`
2. **Avoid shell commands**: Prefer Claude's native tools over Bash when possible
3. **No hardcoded secrets**: Never include API keys, passwords, or tokens
4. **Document external access**: If your skill needs network access, document why
5. **Keep it simple**: Complex, obfuscated code will trigger security warnings

## Allowlisted Domains

The following domains are considered safe for network access:

- `github.com`
- `raw.githubusercontent.com`
- `api.github.com`
- `registry.npmjs.org`
- `pypi.org`

Access to other domains may trigger suspicious pattern warnings.

## Security Scan Configuration

Security patterns are configured in `security/patterns.json`. The configuration includes:

- `dangerous`: Patterns that block verification
- `suspicious`: Patterns that trigger warnings
- `allowlist`: Safe domains and patterns

Pull requests to update security patterns are welcome but require careful review.
