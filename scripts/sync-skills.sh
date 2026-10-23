#!/usr/bin/env bash
# Sync skills from a local checkout of harness/harness-skills into every
# plugin tree. Source of truth is upstream — edit there, then run this.
# CI (.github/workflows/sync-skills.yml) runs this daily and opens a PR.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

SKILLS_SOURCE="${1:-}"
if [[ -z "$SKILLS_SOURCE" ]]; then
  echo "Usage: $0 <path-to-harness-skills-repo>"
  echo "Example: $0 ../harness-skills"
  exit 1
fi

if [[ ! -d "$SKILLS_SOURCE/skills" ]]; then
  echo "Error: $SKILLS_SOURCE/skills not found. Is this the harness-skills repo?"
  exit 1
fi

TARGETS=(
  "$REPO_ROOT/plugins/vscode/skills"
  "$REPO_ROOT/plugins/claude/skills"
  "$REPO_ROOT/plugins/cursor/skills"
)

SKILL_COUNT=0

for TARGET in "${TARGETS[@]}"; do
  rm -rf "$TARGET"
  mkdir -p "$TARGET"

  for SKILL_MD in "$SKILLS_SOURCE"/skills/*/*/SKILL.md; do
    [[ -f "$SKILL_MD" ]] || continue

    SKILL_DIR="$(dirname "$SKILL_MD")"
    SKILL_NAME="$(basename "$SKILL_DIR")"

    if [[ -e "$TARGET/$SKILL_NAME" ]]; then
      echo "Error: duplicate skill name '$SKILL_NAME' found while syncing $SKILL_DIR"
      exit 1
    fi

    mkdir -p "$TARGET/$SKILL_NAME"
    cp -R "$SKILL_DIR"/. "$TARGET/$SKILL_NAME/"
  done

  SYNCED=$(find "$TARGET" -name "SKILL.md" | wc -l | tr -d ' ')
  echo "  ✓ $(basename "$(dirname "$TARGET")")/$(basename "$TARGET") — $SYNCED skills"
  SKILL_COUNT=$SYNCED
done

echo ""
echo "Done! Synced $SKILL_COUNT skills to ${#TARGETS[@]} targets."
