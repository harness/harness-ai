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
check_file "$REPO_ROOT/plugins/vscode/plugin.json"
check_file "$REPO_ROOT/plugins/vscode/.mcp.json"
check_file "$REPO_ROOT/plugins/vscode/agents/harness.agent.md"

echo ""
echo "Validating Claude Plugin..."
check_file "$REPO_ROOT/plugins/claude/plugin.json"
check_file "$REPO_ROOT/plugins/claude/.mcp.json"
check_file "$REPO_ROOT/plugins/claude/commands/create-pipeline.md"
check_file "$REPO_ROOT/plugins/claude/commands/debug-pipeline.md"

echo ""
echo "Validating Gemini Extension..."
check_file "$REPO_ROOT/extensions/gemini/gemini-extension.json"
check_file "$REPO_ROOT/extensions/gemini/GEMINI.md"
check_file "$REPO_ROOT/extensions/gemini/commands/harness/create-pipeline.toml"

echo ""
if [[ $ERRORS -gt 0 ]]; then
  echo "Validation failed with $ERRORS error(s)."
  exit 1
else
  echo "All packages valid."
fi
