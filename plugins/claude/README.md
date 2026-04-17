# Harness DevOps — Claude Plugin

AI-native interface to Harness CI/CD for Claude Code and Claude Cowork.

## What You Get

- **Harness MCP server** — consolidated tool surface covering the Harness resource catalog
- **Skills** — multi-step DevOps workflows that Claude can invoke automatically or via `/harness:<skill-name>` (full catalog lives upstream at [harness/harness-skills](https://github.com/harness/harness-skills))

## Install

```bash
# From local directory (development)
cd plugins/claude
claude /plugin install .

# From plugin directory (after submission)
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
