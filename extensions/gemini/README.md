# Harness DevOps — Gemini CLI Extension

AI-native interface to Harness CI/CD for Gemini CLI.

## What You Get

- **11 MCP tools** covering 144+ Harness resource types
- **Persistent context** (GEMINI.md) with operating model and skill summaries
- **Slash commands**: `/harness:create-pipeline`, `/harness:debug-pipeline`, `/harness:run-pipeline`, `/harness:analyze-costs`
- **Secure settings** — API key stored in system keychain (local mode)

## Install

```bash
# Remote MCP (default — OAuth, no API key needed)
gemini extensions install harness/harness-ai/extensions/gemini

# Local development
cd extensions/gemini
gemini extensions link .
```

## Auth Modes

**Remote MCP** (default) — OAuth handles authentication. No API key configuration needed.

**OSS MCP** (local) — Rename `gemini-extension.local.json` to `gemini-extension.json`. During install, Gemini CLI prompts for your API key and account ID, storing sensitive values in the system keychain.

## License

Apache-2.0
