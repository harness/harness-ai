# Harness DevOps — Claude Plugin

AI-native interface to Harness CI/CD for Claude Code and Claude Cowork.

## What You Get

- **Harness MCP server** — consolidated tool surface covering the Harness resource catalog
- **Skills** — multi-step DevOps workflows that Claude can invoke automatically or via `/harness:<skill-name>` (full catalog lives upstream at [harness/harness-skills](https://github.com/harness/harness-skills))

## Install

### One-session local test

Use this when developing or validating a local checkout. It does not install the
plugin permanently.

```bash
claude --plugin-dir /absolute/path/to/harness-ai/plugins/claude
```

### Persistent local marketplace install

Use this before the plugin is published. The first command registers this local
repo as a Claude marketplace; the second installs the `harness` plugin from that
specific marketplace.

```text
/plugin marketplace add /absolute/path/to/harness-ai/.claude-plugin/marketplace.json
/plugin install harness@harness-ai
/reload-plugins
```

Do not use `/plugin install harness` for local testing unless `harness` is already
published in Claude's default plugin directory.

### Published marketplace install

Use this only after the plugin has been published to a default/official Claude
plugin directory where `harness` is globally discoverable.

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
