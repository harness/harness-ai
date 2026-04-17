# AGENTS.md

Contribution guide for AI coding agents working in this repository. Follows the [agents.md](https://agents.md) specification. Human contributors should treat it as the canonical reference alongside [`README.md`](README.md).

**Claude Code** reads `CLAUDE.md`, which is a symlink to this file.  
**Gemini CLI** reads `GEMINI.md` inside `extensions/gemini/`.  
**Cursor / Copilot / Codex / Aider** read this file directly.

## Project overview

`harness-ai` is a **distribution monorepo** that packages Harness AI integrations — skills, governance hooks, workspace rules, MCP config — as separate plugins/extensions for each major AI coding environment (Cursor, Claude Code, VS Code + Copilot, Gemini CLI). The Cursor plugin is published to the Cursor Marketplace; the others mirror the same skills surface for their respective platforms.

## Dev environment

```bash
# Required — Node 22+ for validator scripts (ESM)
node --version     # expect v22.x

# Clone and orient
git clone https://github.com/harness/harness-ai
cd harness-ai

# Skills mirror (upstream — edits happen there, not here)
git clone https://github.com/harness/harness-skills ../harness-skills
```

No `npm install` at repo root. Hook scripts under `plugins/cursor/scripts/` run with **Node stdlib only** (no dependencies).

## Build & test commands

File-scoped validators — run the closest one to what you changed.

```bash
# Everything (VS Code + Claude + Gemini + Cursor)
./scripts/validate.sh

# Cursor plugin deep check (manifest, mcp.json, hooks, frontmatter, skill-dir match)
( cd plugins/cursor && node scripts/validate-plugin.mjs )

# A single hook script — syntax only
node --check plugins/cursor/scripts/check-templates.mjs

# Smoke-test a hook fail-open path (should print {"permission":"allow"})
echo '{"tool_name":"MCP:harness_create","tool_input":{"resource_type":"pipeline","body":{}}}' \
  | env -u HARNESS_API_KEY -u HARNESS_ACCOUNT_ID ./plugins/cursor/scripts/check-templates.mjs

# Skills drift from upstream — must produce no diff after sync
./scripts/sync-skills.sh ../harness-skills
git diff --stat plugins/*/skills/
```

CI runs these on every PR touching `plugins/cursor/**` or `.cursor-plugin/marketplace.json` (`.github/workflows/cursor-plugin.yml`).

## Repository layout

```
harness-ai/
├── .cursor-plugin/marketplace.json   # Cursor multi-plugin manifest (lists one plugin)
├── plugins/
│   ├── cursor/                       # Harness Cursor plugin (marketplace-ready)
│   │   ├── .cursor-plugin/plugin.json
│   │   ├── mcp.json                  # Remote MCP (OAuth) default
│   │   ├── .mcp.local.json           # OSS/PAT sample — swap over mcp.json to use
│   │   ├── hooks/hooks.json          # governance hooks (templates + OPA)
│   │   ├── scripts/*.mjs             # hook implementations + validator
│   │   ├── rules/*.mdc               # workspace rules shipped with the plugin
│   │   ├── skills/<name>/SKILL.md    # mirrored from upstream
│   │   ├── assets/logo.svg
│   │   └── AGENTS.md                 # plugin-specific contribution rules
│   ├── claude/                       # Claude Code plugin (.claude-plugin/plugin.json)
│   └── vscode/                       # VS Code agent plugin (.github/plugin.json)
├── extensions/
│   └── gemini/                       # Gemini CLI extension (gemini-extension.json)
├── scripts/
│   ├── validate.sh                   # Umbrella validator
│   └── sync-skills.sh                # Mirror skills from upstream
└── .github/workflows/
    ├── cursor-plugin.yml             # PR validator for the Cursor plugin
    └── sync-skills.yml               # Daily auto-PR keeping skills trees in sync
```

## Per-plugin specs — follow the platform rules exactly

Each platform expects an exact manifest filename + location. Do **not** rename these.

| Plugin | Spec | Manifest | MCP config | Skills dir |
|--------|------|----------|------------|------------|
| Cursor | [cursor.com/docs/reference/plugins](https://cursor.com/docs/reference/plugins) | `plugins/cursor/.cursor-plugin/plugin.json` | `plugins/cursor/mcp.json` | `plugins/cursor/skills/` |
| Claude | [docs.claude.com/.../plugins-reference](https://docs.claude.com/en/docs/claude-code/plugins-reference) | `plugins/claude/.claude-plugin/plugin.json` | `plugins/claude/.mcp.json` | `plugins/claude/skills/` |
| VS Code | [code.visualstudio.com/.../agent-plugins](https://code.visualstudio.com/docs/copilot/customization/agent-plugins) (preview) | `plugins/vscode/.github/plugin.json` | `plugins/vscode/.mcp.json` | `plugins/vscode/skills/` |
| Gemini | [github.com/google-gemini/gemini-cli/tree/main/docs/extensions](https://github.com/google-gemini/gemini-cli/tree/main/docs/extensions) | `extensions/gemini/gemini-extension.json` | Inline in manifest | — |

When editing inside `plugins/cursor/`, the workspace rule [`plugins/cursor/rules/plugin-standards.mdc`](plugins/cursor/rules/plugin-standards.mdc) ships with the plugin and is also authoritative for Cursor-specific contribution details (hook event names, MCP matcher format, exact layout checks).

## Source of truth

| Asset | Canonical source | In this repo |
|-------|------------------|--------------|
| Harness MCP server | [harness/mcp-server](https://github.com/harness/mcp-server) | **Not here** — referenced via `npx harness-mcp-v2` or remote URL |
| Harness skills | [harness/harness-skills](https://github.com/harness/harness-skills) | **Mirrored** into `plugins/*/skills/` by `.github/workflows/sync-skills.yml` (daily) |
| Plugin manifests, MCP configs, hooks, rules, validator, CI | This repo | Edit here |

Do **not** hand-edit `plugins/*/skills/` — upstream first, then the daily sync PR brings it in. Any manual edit will be silently reverted on next sync.

## MCP defaults

- **Remote MCP** — `https://mcp.harness.io/mcp` with OAuth. Static CLIENT_ID `mcp-client` where the server requires it. Default for all four packages.
- **OSS MCP** — `npx harness-mcp-v2 stdio` with `HARNESS_API_KEY` / `HARNESS_ACCOUNT_ID`. Each plugin ships a `*.mcp.local.json` sample — copy over the active MCP config to switch.

Governance hooks (`plugins/cursor/scripts/`) call the Harness REST API directly (not via MCP) and need `HARNESS_API_KEY` + `HARNESS_ACCOUNT_ID` in the shell. Without them, hooks **fail open** — plugin still works, governance is inactive.

## Code style & conventions

- **Hook scripts** (`plugins/cursor/scripts/*.mjs`): Node stdlib only. `#!/usr/bin/env node`, executable bit, read JSON from stdin, write JSON to stdout. Wrap `main()` in try/catch that prints the fail-open payload. No runtime npm deps.
- **Validators** (`.mjs` files): ESM syntax, Node 22 built-in APIs (`node:fs/promises`, `node:path`, global `fetch`). No external deps.
- **Shell scripts** (`scripts/*.sh`): `#!/usr/bin/env bash` + `set -euo pipefail`.
- **JSON files**: 2-space indent, trailing newline.
- **YAML frontmatter**: opens with `---\n` closes with `\n---\n`. `rules/*.mdc` need `description`; `skills/*/SKILL.md` need `name` + `description` with `name` matching the directory.
- **Hook events**: only use events documented at [cursor.com/docs/agent/hooks](https://cursor.com/docs/agent/hooks). Never invent.
- **Markdown examples**: use placeholder identities (`Jane Doe`, `jane.doe@harness.io`). No real customer/employee PII.

## Skills authoring

- **Location**: `plugins/<platform>/skills/<kebab-case-name>/SKILL.md` — but edit upstream in `harness/harness-skills` first.
- **Required sections**: `## Instructions`, `## Examples`, `## Performance Notes`, `## Troubleshooting`.
- **MCP tool surface**: only the consolidated tools exposed by [harness/mcp-server](https://github.com/harness/mcp-server) — `harness_list`, `harness_get`, `harness_create`, `harness_update`, `harness_delete`, `harness_execute`, `harness_search`, `harness_describe`, `harness_schema`, `harness_diagnose`, `harness_status`. No legacy per-resource tool names.
- **Cross-skill references**: relative paths like `create-pipeline/references/native-steps.md`.

## Release & versioning

Per-package SemVer — each plugin manifests its own `version` and tags independently.

- User-visible change → bump SemVer in the affected manifest.
- Skills sync PR → PATCH bump on each plugin whose `skills/` tree changed.
- Docs-only / CI-only / typo fix → no bump.

Full rules + tag naming: [README.md#releasing](README.md#releasing).

## Security

- **Never commit**: `HARNESS_API_KEY`, `HARNESS_ACCOUNT_ID`, GitHub tokens, OAuth secrets, account UUIDs, personal file paths (`/Users/you/…`), real customer data.
- **Hook fail-open invariant**: on any error (missing creds, network, parse), `before*` hooks emit `{"permission":"allow"}` and `after*` hooks emit `{}`. Never weaken this.
- **Timeouts**: all external fetches time out in 10 s (`plugins/cursor/scripts/harness-api.mjs`).
- **`.gitignore`**: blocks `.env*`, `node_modules/`, `*.tgz`, `.cursor/*` (except `.cursor/plans/`).
- **CI smoke-tests** the fail-open behavior on every PR — don’t disable those steps.

## PR conventions

- **Title format**: `<scope>: <summary>` (e.g. `cursor: bump to 0.2.0`, `hooks: fix body-shape parsing`).
- **Body**: what + why (not how — the diff is the how). Link issues. Call out breaking changes.
- **Before opening**: `./scripts/validate.sh` locally; CI must be green before merge.
- **Version bumps**: include in the same PR as the user-visible change (not a follow-up).

## What NOT to do

- Do not rename `mcp.json`, `marketplace.json`, any plugin manifest file, or any hook config file.
- Do not reference paths outside the plugin root, or paths containing `..`.
- Do not add runtime npm dependencies to hook scripts.
- Do not invent hook event names. Only use events documented by each platform.
- Do not commit `.env` files, real PATs, account IDs, or employee PII.
- Do not publish the installer CLI. It is parked on the `installer-wip` branch pending remote-MCP GA.
- Do not hand-edit `plugins/*/skills/` — let the upstream-sync PR update them.

## References

- [README.md](README.md) — user-facing install + releasing
- [`plugins/cursor/rules/plugin-standards.mdc`](plugins/cursor/rules/plugin-standards.mdc) — Cursor plugin contribution rules (ships with the plugin)
- [`plugins/cursor/rules/harness.mdc`](plugins/cursor/rules/harness.mdc) — agent-facing MCP conventions that ship with the plugin
- [agents.md](https://agents.md) — the AGENTS.md spec this file follows
- [harness/mcp-server](https://github.com/harness/mcp-server), [harness/harness-skills](https://github.com/harness/harness-skills) — upstream repos
