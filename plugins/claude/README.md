# Harness DevOps — Claude Plugin

AI-native interface to Harness CI/CD for Claude Code and Claude Cowork.

## What You Get

- **Harness MCP server** — consolidated tool surface covering the Harness resource catalog
- **Skills** — multi-step DevOps workflows that Claude can invoke automatically or via `/harness:<skill-name>` (full catalog lives upstream at [harness/harness-skills](https://github.com/harness/harness-skills))

## Install

```bash
# One-session local test from any project
claude --plugin-dir /absolute/path/to/harness-ai/plugins/claude
```

For a persistent install, register this repo's Claude marketplace and install the
plugin by name:

```text
/plugin marketplace add /absolute/path/to/harness-ai/.claude-plugin/marketplace.json
/plugin install harness@harness-ai
/reload-plugins
```

After marketplace submission, install from the published directory:

```text
/plugin install harness
```

## Auth Modes

**Remote MCP + OAuth** (default) — No configuration needed.

**OSS MCP + PAT** (local) — Edit `.mcp.json`:
```json
{
  "mcpServers": {
    "harness": {
      "command": "npx",
      "args": ["-y", "harness-mcp-v2"],
      "env": { "HARNESS_API_KEY": "${HARNESS_API_KEY}" }
    }
  }
}
```

## License

Apache-2.0
