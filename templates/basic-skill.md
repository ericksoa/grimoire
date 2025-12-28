---
name: {{SKILL_NAME}}
description: {{SKILL_DESCRIPTION}}
allowed-tools: {{ALLOWED_TOOLS}}
---

# {{SKILL_NAME}}

Brief overview of what this skill does and when Claude should use it.

## When to Activate

This skill should be used when:
- User asks about...
- User wants to...
- User needs help with...

## Instructions

### Step 1: Understand the Request

Analyze what the user is asking for. Look for:
- Key requirements
- Constraints or preferences
- Context from the conversation

### Step 2: Gather Information

If needed, use these tools to gather context:
- `Glob` to find relevant files
- `Read` to examine file contents
- `Grep` to search for patterns

### Step 3: Execute the Task

Perform the main action:

```bash
# Example commands go here
```

### Step 4: Verify and Report

After completing the task:
1. Verify the results
2. Report what was done
3. Suggest next steps if applicable

## Examples

**User says:** "..."
**Action:** ...

**User says:** "..."
**Action:** ...

## Error Handling

| Situation | Response |
|-----------|----------|
| Missing file | Suggest creating it or check path |
| Permission error | Explain the issue and suggest fix |
| Invalid input | Ask for clarification |

## Notes

- Add any important notes or caveats here
- Document limitations
- Link to related skills if applicable
