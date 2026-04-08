# harness-ai

Harness AI distribution packages — plugins, extensions, and agents that bring Harness CI/CD tools to every AI coding environment.

## Structure

```
harness-ai/
├── plugins/
│   ├── vscode/          # VS Code / Copilot Agent Plugin
│   └── claude/          # Claude Code + Cowork Plugin
├── extensions/
│   └── gemini/          # Gemini CLI Extension
├── agents/
│   └── acp/             # ACP Agent (JetBrains, Zed)
├── apps/
│   └── chatgpt/         # ChatGPT App (Apps SDK)
├── scripts/             # Build & sync utilities
└── assets/              # Shared logos, icons
```

## Packages

| Package | Platform | Install |
|---------|----------|---------|
| **VS Code Plugin** | VS Code / Copilot | `@agentPlugins harness` |
| **Claude Plugin** | Claude Code, Cowork | `/plugin install harness` |
| **Gemini Extension** | Gemini CLI | `gemini extensions install` |
| **ACP Agent** | JetBrains, Zed | Settings > Agents > Harness |

## Two MCP Modes

All packages ship with both connection modes pre-configured:

- **Remote MCP** (default): `https://mcp.harness.io/mcp` — zero install, OAuth handles auth
- **OSS MCP** (fallback): `npx harness-mcp-v2` — runs locally, requires PAT

## Auto-Installer

For IDEs without native plugin systems (Cursor, Windsurf, Codex, OpenCode):

```bash
npx harness-mcp-v2 install           # Interactive mode
npx harness-mcp-v2 install --remote  # Remote MCP for all detected IDEs
npx harness-mcp-v2 install --local   # Local MCP with PAT
```

## Development

```bash
# Sync skills from harness-skills repo into all packages
./scripts/sync-skills.sh ../harness-skills

# Test VS Code plugin locally
# Open plugins/vscode/ as a workspace in VS Code

# Test Claude plugin locally
# cd plugins/claude && claude /plugin install .

# Test Gemini extension locally
# cd extensions/gemini && gemini extensions link .
```

## Related Repos

- [harness-mcp-v2](https://github.com/thisrohangupta/harness-mcp-v2) — MCP server (11 tools, 144 resource types)
- [harness-skills](https://github.com/thisrohangupta/harness-skills) — 26 DevOps skills for AI agents

## License

Apache-2.0
