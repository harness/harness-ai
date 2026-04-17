# Harness AI

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Cursor Plugin CI](https://github.com/harness/harness-ai/actions/workflows/cursor-plugin.yml/badge.svg)](https://github.com/harness/harness-ai/actions/workflows/cursor-plugin.yml)

**Harness AI** packages the Harness platform — pipelines, GitOps, secrets, feature flags, cloud cost, chaos, DORA metrics, policy-as-code — as plugins and extensions for the AI coding assistants you already use: **Cursor**, **Claude Code**, **VS Code + Copilot**, and **Gemini CLI**. One source of truth for skills, MCP wiring, governance hooks, and workspace rules — distributed to each environment in the shape that platform expects.

Tell your agent *"Create a Kubernetes pipeline for this service, run it in staging, and open a PR with the result"* — and it goes end-to-end through Harness.

---

## Install

All four packages connect to the Harness remote MCP server (`https://mcp.harness.io/mcp`) by default — **no PAT required**, OAuth handles authentication on first tool call. If you prefer OSS + PAT, every plugin ships an `.mcp.local.json` sample you can swap in.

### Cursor IDE

Marketplace listing is pending review. To install from source today:

```bash
git clone https://github.com/harness/harness-ai ~/harness-ai
mkdir -p ~/.cursor/plugins
ln -s ~/harness-ai/plugins/cursor ~/.cursor/plugins/harness
# Restart Cursor
```

Details: [`plugins/cursor/README.md`](plugins/cursor/README.md).

### Claude Code

```bash
git clone https://github.com/harness/harness-ai
cd harness-ai/plugins/claude && claude /plugin install .
```

Details: [`plugins/claude/README.md`](plugins/claude/README.md).

### VS Code + Copilot (Preview)

VS Code agent plugins are in preview. Enable `chat.plugins.enabled: true`, then add this repo as a marketplace:

```json
{
  "chat.plugins.marketplaces": ["harness/harness-ai"]
}
```

Open the Extensions view and search `@agentPlugins harness`. Details: [`plugins/vscode/README.md`](plugins/vscode/README.md).

### Gemini CLI

```bash
gemini extensions install https://github.com/harness/harness-ai
```

Details: [`extensions/gemini/README.md`](extensions/gemini/README.md).

---

## What's Inside

All four packages ship the same surface, adapted to each platform's conventions:

- **Skills** — multi-step DevOps workflows the agent can invoke as slash commands (`/create-pipeline`, `/debug-pipeline`, `/analyze-costs`, …).
- **Harness MCP server** — a consolidated set of tools (`harness_list`, `harness_get`, `harness_create`, `harness_update`, `harness_delete`, `harness_execute`, `harness_search`, `harness_describe`, `harness_schema`, `harness_diagnose`, `harness_status`) covering the Harness resource surface.
- **Workspace rules** — scope discipline, dependency checks, URL extraction for Harness UI links.
- **Governance hooks** *(Cursor plugin today)* — surface reusable templates before creating a raw pipeline, and evaluate pipeline YAML against the Harness Policy Engine.

### Skill Categories

| Category | Skills |
|----------|--------|
| Pipelines & execution | `create-pipeline`, `create-pipeline-v1`, `create-trigger`, `create-template`, `run-pipeline`, `debug-pipeline`, `migrate-pipeline` |
| Infrastructure & resources | `create-service`, `create-environment`, `create-infrastructure`, `create-connector`, `create-secret` |
| Access control | `manage-users`, `manage-roles` |
| Platform operations | `manage-delegates`, `manage-feature-flags`, `manage-freeze-windows`, `manage-pull-requests`, `manage-slos` |
| Observability & governance | `analyze-costs`, `audit-report`, `dora-metrics`, `gitops-status`, `chaos-experiment`, `scorecard-review`, `security-report`, `template-usage`, `create-policy` |
| AI agents | `create-agent`, `create-agent-template` |

The full, authoritative catalog lives in [harness/harness-skills](https://github.com/harness/harness-skills) and is mirrored into every plugin tree by the daily [`Sync Skills`](.github/workflows/sync-skills.yml) workflow.

---

## MCP Connection Modes

| Mode | URL / command | Auth | Default for |
|------|---------------|------|-------------|
| **Remote MCP** | `https://mcp.harness.io/mcp` | OAuth | Cursor, Claude, VS Code, Gemini |
| **OSS MCP** | `npx harness-mcp-v2 stdio` | `HARNESS_API_KEY` + `HARNESS_ACCOUNT_ID` | Available as a sample (`.mcp.local.json` / `gemini-extension.local.json`) |

To switch a plugin to OSS MCP, copy its `.mcp.local.json` over the active MCP config.

---

## Contributing

We welcome contributions — new skills, hook improvements, additional platform plugins, and docs fixes.

- **Skills source of truth** is [harness/harness-skills](https://github.com/harness/harness-skills). Edit there; the daily sync PR mirrors changes here.
- **Plugin / CI / rules changes** → PR against this repo.
- Contribution rules for AI agents and humans: [`AGENTS.md`](AGENTS.md) (dev environment, validation, per-plugin specs, PR conventions).
- Full human-contributor guidelines: `CONTRIBUTING.md` *(coming soon)*.

## Releasing

Each package versions independently. Release process and tag convention: [`docs/RELEASING.md`](docs/RELEASING.md).

## Related Repositories

- [harness/mcp-server](https://github.com/harness/mcp-server) — Harness MCP server implementation.
- [harness/harness-skills](https://github.com/harness/harness-skills) — canonical skill catalog mirrored by every plugin here.

## License

Apache-2.0 — see [LICENSE](LICENSE).
