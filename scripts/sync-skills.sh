#!/usr/bin/env bash
# Sync skills from a local checkout of harness/harness-skills into every
# plugin tree. Source of truth is upstream — edit there, then run this.
# CI (.github/workflows/sync-skills.yml) runs this daily and opens a PR.
# Plugin-local vibe-* skills are preserved (overlay after the upstream copy).
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

# Plugin-local vibe-* skills live in this repo, not harness-skills. Overlay them
# after the upstream copy so the daily sync does not delete them.
preserve_vibe_skills() {
  local target="$1"
  local stash="$2"
  mkdir -p "$stash"
  if [[ -d "$target" ]]; then
    shopt -s nullglob
    for d in "$target"/vibe-*/; do
      cp -R "$d" "$stash/$(basename "$d")"
    done
    shopt -u nullglob
  fi
}

restore_vibe_skills() {
  local target="$1"
  local stash="$2"
  if [[ -d "$stash" ]]; then
    shopt -s nullglob
    for d in "$stash"/*/; do
      rm -rf "$target/$(basename "$d")"
      cp -R "$d" "$target/$(basename "$d")"
    done
    shopt -u nullglob
  fi
}

for TARGET in "${TARGETS[@]}"; do
  STASH="$(mktemp -d)"
  preserve_vibe_skills "$TARGET" "$STASH"

  rm -rf "$TARGET"
  mkdir -p "$TARGET"

  for SKILL_DIR in "$SKILLS_SOURCE"/skills/*/; do
    SKILL_NAME="$(basename "$SKILL_DIR")"

    if [[ ! -f "$SKILL_DIR/SKILL.md" ]]; then
      echo "  Skipping $SKILL_NAME (no SKILL.md)"
      continue
    fi

    mkdir -p "$TARGET/$SKILL_NAME"
    cp "$SKILL_DIR/SKILL.md" "$TARGET/$SKILL_NAME/SKILL.md"

    if [[ -d "$SKILL_DIR/references" ]]; then
      cp -r "$SKILL_DIR/references" "$TARGET/$SKILL_NAME/references"
    fi
  done

  restore_vibe_skills "$TARGET" "$STASH"
  rm -rf "$STASH"

  SYNCED=$(find "$TARGET" -name "SKILL.md" | wc -l | tr -d ' ')
  echo "  ✓ $(basename "$(dirname "$TARGET")")/$(basename "$TARGET") — $SYNCED skills"
  SKILL_COUNT=$SYNCED
done

echo ""
echo "Done! Synced $SKILL_COUNT skills to ${#TARGETS[@]} targets."
