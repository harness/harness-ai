# Harness Plugin for Cursor

This directory is the **Harness Cursor plugin** inside the [harness-ai](https://github.com/harness/harness-ai) monorepo (`plugins/cursor/`). The repository root defines [Cursor multi-plugin discovery](https://cursor.com/docs/reference/plugins#multi-plugin-repositories) via `.cursor-plugin/marketplace.json`. Submit the **harness-ai** repository URL to the [Cursor marketplace](https://cursor.com/marketplace/publish).

The plugin bundles Harness skills, the consolidated [Harness MCP server](https://github.com/harness/mcp-server), workspace rules, and governance hooks so the agent follows Harness scope, validation, and confirmation conventions out of the box.

Skill catalog and MCP tool surface are listed in the [root README](../../README.md) and the authoritative upstream [harness/harness-skills](https://github.com/harness/harness-skills).

---

## Features

### Workspace Rule

`rules/harness.mdc` is applied by Cursor automatically. It teaches the agent to:

- Establish `org_id` / `project_id` scope before write operations
- Verify referenced resources exist with `harness_list` before creating dependents
- Follow the correct dependency order for end-to-end setup
- Request user confirmation for write/delete/execute operations
- Recover from common API errors (`DUPLICATE_IDENTIFIER`, `CONNECTOR_NOT_FOUND`, `ACCESS_DENIED`)

### Governance Hooks

Two MCP hooks enforce Harness governance automatically — no extra setup required beyond the API key and account ID.

| Event | Matcher | Script | Behavior |
|-------|---------|--------|----------|
| `beforeMCPExecution` | `MCP:harness_create` | `scripts/check-templates.mjs` | Before creating a **pipeline** (`pipeline` or `pipeline_v1`), lists Pipeline/Stage/StepGroup/Step templates at account/org/project scope. If templates exist and the payload lacks a `templateRef`, prompts the user (`permission: "ask"`) with the catalog so they can reuse an approved template instead of a raw pipeline. |
| `afterMCPExecution` | `MCP:harness_create`, `MCP:harness_update` | `scripts/validate-policies.mjs` | After a pipeline write, evaluates the YAML/JSON against OPA policies and policy sets bound to the `pipeline` entity at all three scopes via the Harness Policy Engine (`/pm/api/v1/policy/evaluations/evaluate-by-type`). Attaches pass/fail details as agent context. |

Both hooks accept all three body shapes `harness_create` supports — raw YAML string, `{yamlPipeline: "..."}`, and `{pipeline: {...}}` JSON — via `extractPipelineYaml()` in `scripts/harness-api.mjs`.

**Fail-open by design.** If `HARNESS_API_KEY` or `HARNESS_ACCOUNT_ID` aren't set, or if the Harness API returns an error, the hooks emit `permission: "allow"` / empty context so the agent is never blocked on infra issues. All API calls are made with the same credentials you set for the MCP server — no extra config.

**Scope.** Hooks fire only for pipeline resource types (`pipeline`, `pipeline_v1`). Extend `check-templates.mjs` and `validate-policies.mjs` (or add new matchers in `hooks/hooks.json`) to cover services, connectors, environments, or any other entity with policy coverage in your account.

---

## Installation

### 1. Add the plugin

In Cursor, add this plugin from the marketplace or install from GitHub using the **harness-ai** repository URL (see [Submitting a plugin](https://cursor.com/docs/reference/plugins#submitting-a-plugin)). The plugin source path is `plugins/cursor/`, listed in `.cursor-plugin/marketplace.json` at the repo root.

### 2. Authenticate

By default the plugin connects to the **remote Harness MCP server** at `https://mcp.harness.io/mcp`. The first tool call opens an OAuth consent flow in your browser — approve and you're in. No PAT, no config.

### 3. Optional: OSS MCP with a PAT

If you need to run against a self-hosted Harness instance, an air-gapped environment, or just prefer local execution, swap the remote URL for the OSS server. A ready-to-use sample lives at `plugins/cursor/.mcp.local.json` — copy its contents over `mcp.json`:

```bash
cp plugins/cursor/.mcp.local.json plugins/cursor/mcp.json
```

Contents (`plugins/cursor/.mcp.local.json`):

```json
{
  "mcpServers": {
    "harness": {
      "command": "npx",
      "args": ["-y", "harness-mcp-v2", "stdio"],
      "env": {
        "HARNESS_API_KEY": "${HARNESS_API_KEY}",
        "HARNESS_ACCOUNT_ID": "${HARNESS_ACCOUNT_ID}",
        "HARNESS_BASE_URL": "${HARNESS_BASE_URL}"
      }
    }
  }
}
```

Then set the required env vars in your shell before starting Cursor:

```bash
export HARNESS_API_KEY="pat.xxxxx.xxxxx.xxxxx"
export HARNESS_ACCOUNT_ID="your-account-id"            # optional; auto-extracted from PAT
export HARNESS_BASE_URL="https://app.harness.io"       # optional; self-hosted URL if different
```

Optional env vars the OSS server also reads: `HARNESS_ORG`, `HARNESS_PROJECT`, `HARNESS_TOOLSETS`, `HARNESS_PIPELINE_VERSION`, `HARNESS_SKIP_ELICITATION`, `HARNESS_READ_ONLY`, `HARNESS_API_TIMEOUT_MS`, `HARNESS_MAX_RETRIES`, `LOG_LEVEL`.

Get a PAT at **Harness UI → Account Settings → Access Control → Service Accounts**.

### 4. Governance hooks and credentials

The bundled governance hooks (`scripts/check-templates.mjs`, `scripts/validate-policies.mjs`) call the Harness REST API directly — they do **not** use the MCP server. They read `HARNESS_API_KEY` and `HARNESS_ACCOUNT_ID` from the shell environment.

- With OAuth-only Remote MCP: the hooks **fail open** (emit `"allow"` / no-op) because they have no credentials. Plugin still works; governance is inactive.
- To activate hooks, set `HARNESS_API_KEY` + `HARNESS_ACCOUNT_ID` in your shell. The hooks will then call the Template API + Policy Engine.

### 5. Optional: run the OSS MCP server from source

For MCP-server development, point `mcp.json` at a local build:

```json
{
  "mcpServers": {
    "harness": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/build/index.js", "stdio"],
      "env": { "HARNESS_API_KEY": "${HARNESS_API_KEY}", "HARNESS_ACCOUNT_ID": "${HARNESS_ACCOUNT_ID}" }
    }
  }
}
```

Build the server first: see [harness/mcp-server](https://github.com/harness/mcp-server).

---

## Usage Examples

### Pipelines

- "Create a CI pipeline for this Node.js app that builds, tests, and pushes to Docker Hub"
- "Debug execution `abc123` — why did the deploy step fail?"
- "Migrate pipeline `web_app_ci` from v0 to v1"
- "Run the `nightly_build` pipeline and wait for it to finish"

### Infrastructure & Resources

- "Create a GitHub connector for `harness/my-repo` using the PAT in secret `github_pat`"
- "Create a Kubernetes service that pulls from ECR and references the `ecr_connector`"
- "Set up staging + production environments for the `payments` service"

### Governance & Observability

- "Show me last quarter's DORA metrics for the `platform` project"
- "Generate a security report for all production services"
- "Find cost anomalies in the last 30 days and recommend optimizations"
- "Audit all pipeline executions by user `jane.doe@harness.io` in March"

### Access & Secrets

- "Create a service account for the deploy bot with Pipeline Execute permissions on the `web` project"
- "Add a new secret `slack_webhook` at the project scope"
- "Toggle the `new_checkout` feature flag to 100% in production"

---

## Credits

- **Skills** — authored by the Harness team ([harness/harness-skills](https://github.com/harness/harness-skills))
- **MCP Server** — [harness/mcp-server](https://github.com/harness/mcp-server)
- **Plugin specification** — [cursor/plugin-template](https://github.com/cursor/plugin-template)
