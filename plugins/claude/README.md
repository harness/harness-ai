# Harness DevOps — Claude Plugin

AI-native interface to Harness CI/CD for Claude Code and Claude Cowork.

## What You Get

- **11 MCP tools** covering 144+ Harness resource types
- **27 skills** for multi-step DevOps workflows
- **Slash commands**: `/harness:create-pipeline`, `/harness:debug-pipeline`, `/harness:run-pipeline`, `/harness:analyze-costs`

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
