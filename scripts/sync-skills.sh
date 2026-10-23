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

  # Upstream layout: skills/<category>/<skill>/SKILL.md (flatten by skill name).
  while IFS= read -r -d '' SKILL_MD; do
    SKILL_DIR="$(dirname "$SKILL_MD")"
    SKILL_NAME="$(basename "$SKILL_DIR")"

    rm -rf "$TARGET/$SKILL_NAME"
    cp -a "$SKILL_DIR" "$TARGET/$SKILL_NAME"
  done < <(find "$SKILLS_SOURCE/skills" -mindepth 3 -maxdepth 3 -type f -name 'SKILL.md' -print0)

  SYNCED=$(find "$TARGET" -name "SKILL.md" | wc -l | tr -d ' ')
  echo "  ✓ $(basename "$(dirname "$TARGET")")/$(basename "$TARGET") — $SYNCED skills"
  SKILL_COUNT=$SYNCED
done

echo ""
echo "Done! Synced $SKILL_COUNT skills to ${#TARGETS[@]} targets."
