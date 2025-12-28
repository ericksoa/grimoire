#!/bin/bash
# validate-skill.sh - Validates a SKILL.md file structure
# Usage: validate-skill.sh <skill-directory>

set -e

SKILL_DIR="$1"
SKILL_FILE="$SKILL_DIR/SKILL.md"
ERRORS=0

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ERRORS=$((ERRORS + 1))
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo "Validating skill at: $SKILL_DIR"
echo "---"

# Check directory exists
if [ ! -d "$SKILL_DIR" ]; then
    error "Directory does not exist: $SKILL_DIR"
    exit 1
fi

# Check SKILL.md exists
if [ ! -f "$SKILL_FILE" ]; then
    error "SKILL.md not found in $SKILL_DIR"
    exit 1
fi
success "SKILL.md exists"

# Check for YAML frontmatter
if ! head -1 "$SKILL_FILE" | grep -q "^---$"; then
    error "SKILL.md must start with YAML frontmatter (---)"
else
    success "YAML frontmatter opening found"
fi

# Check for closing frontmatter
if ! grep -n "^---$" "$SKILL_FILE" | tail -1 | grep -qv "^1:"; then
    error "YAML frontmatter closing (---) not found"
else
    success "YAML frontmatter closing found"
fi

# Extract frontmatter (between first and second ---)
# Use awk for macOS compatibility (BSD head doesn't support -n -1)
FRONTMATTER=$(awk '/^---$/{if(++c==1){next}else{exit}} c==1{print}' "$SKILL_FILE")

# Check for name field
if echo "$FRONTMATTER" | grep -q "^name:"; then
    NAME=$(echo "$FRONTMATTER" | grep "^name:" | sed 's/name: *//')

    # Validate name format (lowercase, hyphens only)
    if echo "$NAME" | grep -qE "^[a-z][a-z0-9-]*$"; then
        success "Name field valid: $NAME"
    else
        error "Name must be lowercase letters, numbers, and hyphens only (got: $NAME)"
    fi
else
    error "Missing required 'name:' field in frontmatter"
fi

# Check for description field
if echo "$FRONTMATTER" | grep -q "^description:"; then
    DESC=$(echo "$FRONTMATTER" | grep "^description:" | sed 's/description: *//')
    if [ -n "$DESC" ]; then
        success "Description field present"
    else
        error "Description field is empty"
    fi
else
    error "Missing required 'description:' field in frontmatter"
fi

# Check for allowed-tools (optional but recommended)
if echo "$FRONTMATTER" | grep -q "^allowed-tools:"; then
    success "allowed-tools field present (optional)"
else
    warn "No 'allowed-tools:' field - skill will have access to all tools"
fi

# Check file isn't too long (recommended < 500 lines)
LINES=$(wc -l < "$SKILL_FILE")
if [ "$LINES" -gt 500 ]; then
    warn "SKILL.md is $LINES lines (recommended: < 500). Consider using supporting files."
else
    success "File length OK ($LINES lines)"
fi

# Check for markdown body (content after frontmatter)
BODY_LINES=$(tail -n +$(grep -n "^---$" "$SKILL_FILE" | tail -1 | cut -d: -f1) "$SKILL_FILE" | tail -n +2 | grep -v "^$" | wc -l)
if [ "$BODY_LINES" -lt 5 ]; then
    warn "Skill body seems short ($BODY_LINES non-empty lines). Add more instructions."
else
    success "Skill body has content ($BODY_LINES non-empty lines)"
fi

# Summary
echo "---"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}Validation passed!${NC}"
    exit 0
else
    echo -e "${RED}Validation failed with $ERRORS error(s)${NC}"
    exit 1
fi
