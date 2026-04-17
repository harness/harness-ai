#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

ERRORS=0

check_file() {
  if [[ ! -f "$1" ]]; then
    echo "  ✗ Missing: $1"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ $1"
  fi
}

echo "Validating VS Code Plugin..."
check_file "$REPO_ROOT/plugins/vscode/.github/plugin.json"
check_file "$REPO_ROOT/plugins/vscode/.mcp.json"
check_file "$REPO_ROOT/plugins/vscode/agents/harness.agent.md"

echo ""
echo "Validating Claude Plugin..."
check_file "$REPO_ROOT/plugins/claude/.claude-plugin/plugin.json"
check_file "$REPO_ROOT/plugins/claude/.mcp.json"

echo ""
echo "Validating Gemini Extension..."
check_file "$REPO_ROOT/extensions/gemini/gemini-extension.json"
check_file "$REPO_ROOT/extensions/gemini/GEMINI.md"
check_file "$REPO_ROOT/extensions/gemini/commands/harness/create-pipeline.toml"

echo ""
echo "Validating Cursor Plugin..."
check_file "$REPO_ROOT/.cursor-plugin/marketplace.json"
check_file "$REPO_ROOT/plugins/cursor/.cursor-plugin/plugin.json"
check_file "$REPO_ROOT/plugins/cursor/mcp.json"
check_file "$REPO_ROOT/plugins/cursor/hooks/hooks.json"
if ! ( cd "$REPO_ROOT/plugins/cursor" && node scripts/validate-plugin.mjs >/dev/null ); then
  echo "  ✗ plugins/cursor/scripts/validate-plugin.mjs failed"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ plugins/cursor structural validation"
fi

echo ""
if [[ $ERRORS -gt 0 ]]; then
  echo "Validation failed with $ERRORS error(s)."
  exit 1
else
  echo "All packages valid."
fi
