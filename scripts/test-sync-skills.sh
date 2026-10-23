#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

TEST_REPO="$TMP_DIR/harness-ai"
SKILLS_SOURCE="$TMP_DIR/harness-skills"

mkdir -p "$TEST_REPO/scripts"
cp "$REPO_ROOT/scripts/sync-skills.sh" "$TEST_REPO/scripts/sync-skills.sh"

mkdir -p "$SKILLS_SOURCE/skills/unified-data-platform/write-hql/references/patterns"
cat > "$SKILLS_SOURCE/skills/unified-data-platform/write-hql/SKILL.md" <<'SKILL'
---
name: write-hql
description: Write Harness Query Language queries.
---

## Instructions
Use the references.
SKILL
cat > "$SKILLS_SOURCE/skills/unified-data-platform/write-hql/reference.md" <<'REFERENCE'
# HQL Reference
REFERENCE
cat > "$SKILLS_SOURCE/skills/unified-data-platform/write-hql/references/patterns/batch.md" <<'REFERENCE'
# Batch Patterns
REFERENCE

"$TEST_REPO/scripts/sync-skills.sh" "$SKILLS_SOURCE" > "$TMP_DIR/sync.out"

for TARGET in plugins/vscode/skills plugins/claude/skills plugins/cursor/skills; do
  test -f "$TEST_REPO/$TARGET/write-hql/SKILL.md"
  test -f "$TEST_REPO/$TARGET/write-hql/reference.md"
  test -f "$TEST_REPO/$TARGET/write-hql/references/patterns/batch.md"
done

grep -q "Done! Synced 1 skills to 3 targets." "$TMP_DIR/sync.out"

echo "sync-skills test passed"
