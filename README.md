# harness-ai

Harness AI distribution packages — plugins, extensions, and agents that bring Harness CI/CD tools to every AI coding environment.

Repository: [https://github.com/harness/harness-ai](https://github.com/harness/harness-ai)

## Structure

```
harness-ai/
├── .cursor-plugin/
│   └── marketplace.json # Cursor marketplace manifest (multi-plugin repo)
├── plugins/
│   ├── vscode/          # VS Code / Copilot Agent Plugin
│   ├── claude/          # Claude Code + Cowork Plugin
│   └── cursor/          # Cursor IDE plugin (skills, rules, MCP)
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
| **Cursor Plugin** | Cursor IDE | Install from [Cursor marketplace](https://cursor.com/marketplace/publish) using this repo URL; layout per [Plugins reference](https://cursor.com/docs/reference/plugins) (`plugins/cursor/`) |
| **Gemini Extension** | Gemini CLI | `gemini extensions install` |
| **ACP Agent** | JetBrains, Zed | Settings > Agents > Harness |

## Two MCP Modes

All packages ship with both connection modes pre-configured:

- **Remote MCP** (default): `https://mcp.harness.io/mcp` — zero install, OAuth handles auth
- **OSS MCP** (fallback): `npx harness-mcp-v2` — runs locally, requires PAT

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

# Validate / develop Cursor plugin (from monorepo root)
# cd plugins/cursor && node scripts/validate-plugin.mjs
```

## Releasing

Each package versions **independently** — there is no monorepo-wide release tag.

| Package | Manifest | Where it ships |
|---------|----------|----------------|
| Cursor plugin | `plugins/cursor/.cursor-plugin/plugin.json` | [Cursor marketplace](https://cursor.com/marketplace/publish) (submit the repo URL `https://github.com/harness/harness-ai`) |
| VS Code / Copilot plugin | `plugins/vscode/plugin.json` | VS Code marketplace |
| Claude plugin | `plugins/claude/plugin.json` | Claude plugin directory |
| Gemini CLI extension | `extensions/gemini/gemini-extension.json` | `gemini extensions install https://github.com/harness/harness-ai` |
| Auto-installer | `installer/package.json` | npm: `npx harness-setup` |

### When to bump a version

- **User-visible change** (new skill, hook, MCP tool, install behavior, env var): bump only the affected package's manifest using SemVer.
  - **MAJOR** — breaking change (removed skill, renamed env var, incompatible MCP wiring).
  - **MINOR** — additive change (new skill, new hook, new optional env var).
  - **PATCH** — bug fix, doc change, internal cleanup.
- **Skill drift sync** from `harness/harness-skills` (PR opened by `.github/workflows/sync-skills.yml`): bump **PATCH** on every plugin whose `skills/` tree changed.
- **No version bump needed** for: README-only edits that don't change install/usage, CI workflow tweaks, repo-level scripts under `scripts/`.

### Release flow per package

1. Land the change on `main` (PR + CI green).
2. Bump `version` in the relevant manifest in the same PR (or a follow-up).
3. Tag release with the package prefix:
   - Cursor: `cursor-vX.Y.Z`
   - VS Code: `vscode-vX.Y.Z`
   - Claude: `claude-vX.Y.Z`
   - Gemini: `gemini-vX.Y.Z`
   - Installer: `installer-vX.Y.Z`
4. Re-submit / publish:
   - **Cursor**: marketplace re-pulls from the default branch; no manual action unless metadata changed.
   - **VS Code / Claude**: re-submit if their marketplaces require it.
   - **Gemini**: users get the new version on next `gemini extensions install ...`.
   - **Installer**: `cd installer && npm publish --access public`.

### Validating before release

Run the full validator from the repo root:

```bash
./scripts/validate.sh              # all four packages
node plugins/cursor/scripts/validate-plugin.mjs   # deep Cursor plugin checks (also wired in CI)
```

CI (`.github/workflows/cursor-plugin.yml`) re-runs the same checks plus hook fail-open smoke tests on every PR that touches `plugins/cursor/**` or `.cursor-plugin/marketplace.json`.

## Related Repos

- [mcp-server](https://github.com/harness/mcp-server) — Harness MCP server (11 consolidated tools across 160+ resource types)
- [harness-skills](https://github.com/harness/harness-skills) — DevOps skills for AI coding assistants (Cursor, Claude Code, Copilot, Gemini, ...)

## License

Apache-2.0
