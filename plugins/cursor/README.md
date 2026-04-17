# Harness Plugin for Cursor

This directory is the **Harness Cursor plugin** inside the [harness-ai](https://github.com/harness/harness-ai) monorepo (`plugins/cursor/`). The repository root defines [Cursor multi-plugin discovery](https://cursor.com/docs/reference/plugins#multi-plugin-repositories) via `.cursor-plugin/marketplace.json`. Submit the **harness-ai** repository URL to the [Cursor marketplace](https://cursor.com/marketplace/publish).

The plugin bundles:

- **Harness Skills** that teach Cursor how to plan, build, deploy, and debug on the Harness.io platform
- The **[Harness MCP v2 Server](https://github.com/harness/mcp-server)**, which gives the agent 11 consolidated tools across 160+ Harness resource types
- **Workspace rules** so the agent follows Harness scope, validation, and confirmation conventions out of the box

Install the plugin and every Harness capability — CI/CD, GitOps, secrets, connectors, feature flags, chaos, cloud cost, security, DORA metrics — becomes available inside Cursor.

---

## Features

### Harness MCP v2 Server

Cursor connects to the Harness MCP server over stdio. Eleven generic tools cover the entire platform:

| Tool | Purpose |
|------|---------|
| `harness_list` | List resources with filters and pagination |
| `harness_get` | Get a single resource by ID |
| `harness_create` | Create a resource (server elicits confirmation) |
| `harness_update` | Update a resource (server elicits confirmation) |
| `harness_delete` | Delete a resource (server elicits confirmation) |
| `harness_execute` | Run, retry, interrupt, sync, toggle, approve, reject, test_connection |
| `harness_search` | Cross-resource keyword search |
| `harness_describe` | Local metadata lookup — resource types, operations, fields (no API call) |
| `harness_schema` | Exact JSON Schema for `create`/`update` body payloads |
| `harness_diagnose` | Pipeline failure analysis |
| `harness_status` | Project health overview |

Tools accept `resource_type` (e.g. `pipeline`, `pipeline_v1`, `secret`, `template`) and support passing a Harness UI URL directly via the `url` parameter — `org_id`, `project_id`, `resource_type`, and `resource_id` are auto-extracted. Nested URLs (e.g. a PR link) also auto-extract `repo_id` and `pr_number`.

### Available Skills

| Skill | Description |
|-------|-------------|
| `/create-pipeline` | Generate v0 pipeline YAML (CI, CD, combined, approvals) |
| `/create-pipeline-v1` | Generate v1 simplified pipeline YAML |
| `/create-trigger` | Create webhook, scheduled, and artifact triggers |
| `/create-template` | Create reusable step, stage, pipeline, and step group templates |
| `/run-pipeline` | Execute and monitor pipeline runs |
| `/debug-pipeline` | Diagnose pipeline execution failures |
| `/migrate-pipeline` | Convert v0 pipelines to v1 format |
| `/create-service` | Define services (Kubernetes, Helm, ECS) with artifact sources |
| `/create-environment` | Create environments (PreProduction, Production) with overrides |
| `/create-infrastructure` | Define infrastructure (K8s, ECS, Serverless) |
| `/create-connector` | Create connectors (GitHub, AWS, GCP, Azure, Docker, K8s) |
| `/create-secret` | Manage secrets (SecretText, SecretFile, SSHKey, WinRM) |
| `/create-agent` | Scaffold a new Harness AI agent |
| `/create-agent-template` | Generate AI agent templates (metadata.json, pipeline.yaml, wiki.MD) |
| `/manage-users` | Manage users, user groups, and service accounts |
| `/manage-roles` | RBAC roles, assignments, permissions, and resource groups |
| `/manage-feature-flags` | Create, list, toggle, and delete feature flags |
| `/manage-delegates` | Monitor delegate health and manage registration tokens |
| `/analyze-costs` | Cloud cost analysis, recommendations, and anomaly detection |
| `/security-report` | Security vulnerabilities, SBOMs, and compliance reports |
| `/dora-metrics` | DORA metrics and engineering performance reports |
| `/gitops-status` | GitOps application health, sync status, and pod logs |
| `/chaos-experiment` | Create and run chaos engineering experiments |
| `/scorecard-review` | IDP scorecards and service maturity review |
| `/audit-report` | Audit trails and compliance evidence (SOC2, GDPR, HIPAA) |
| `/template-usage` | Template dependency tracking, impact analysis, and adoption |
| `/create-policy` | Create OPA governance policies for supply chain security |
| `/manage-pull-requests` | Harness Code PRs — create/merge, reviewers, comments, checks, activity |
| `/manage-freeze-windows` | Deployment freeze windows and project global freeze — create, toggle, delete |

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

### 2. Configure credentials

The Harness MCP server requires an API key and account ID. Set these as environment variables before starting Cursor:

```bash
# Required
export HARNESS_API_KEY="pat.xxxxx.xxxxx.xxxxx"
export HARNESS_ACCOUNT_ID="your-account-id"   # auto-extracted from PAT if omitted

# Optional — defaults shown
export HARNESS_BASE_URL="https://app.harness.io"
export HARNESS_ORG="default"
export HARNESS_PROJECT=""
export HARNESS_TOOLSETS=""                    # comma-separated; empty = all enabled
export HARNESS_PIPELINE_VERSION="0"           # "0" (default) or "1" — prefer pipeline_v1 when "1"
export HARNESS_SKIP_ELICITATION="false"       # "true" = skip server-side confirmation prompts
export HARNESS_READ_ONLY="false"              # "true" = reject all write tools
export HARNESS_API_TIMEOUT_MS="30000"
export HARNESS_MAX_RETRIES="3"
export LOG_LEVEL="info"                       # debug | info | warn | error
```

All of these are forwarded to the MCP server via `mcp.json`. Only `HARNESS_API_KEY` is strictly required — account ID is extracted from the token if it's a PAT.

Get your API key at **Harness UI → Account Settings → Access Control → Service Accounts** (or a personal access token).

### 3. Optional: run the MCP server from source

By default `mcp.json` runs `npx -y harness-mcp-v2 stdio`. To develop against a local build instead, edit `mcp.json`:

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

Build the server first: `cd mcp-server && pnpm install && pnpm build`.

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

## Directory Structure

```
plugins/cursor/
├── .cursor-plugin/
│   └── plugin.json          # Plugin manifest
├── assets/
│   └── logo.svg             # Marketplace logo
├── mcp.json                 # Harness MCP v2 server config
├── hooks/
│   └── hooks.json           # MCP governance hooks
├── scripts/
│   ├── harness-api.mjs      # Shared Harness REST helper
│   ├── check-templates.mjs  # beforeMCPExecution — template reuse
│   └── validate-policies.mjs # afterMCPExecution — policy evaluation
├── rules/
│   └── harness.mdc          # Workspace rule — MCP conventions
├── skills/                  # 29 Harness skills
│   ├── analyze-costs/
│   ├── audit-report/
│   ├── chaos-experiment/
│   ├── create-agent/
│   ├── create-agent-template/
│   ├── create-connector/
│   ├── create-environment/
│   ├── create-infrastructure/
│   ├── create-pipeline/
│   ├── create-pipeline-v1/
│   ├── create-policy/
│   ├── create-secret/
│   ├── create-service/
│   ├── create-template/
│   ├── create-trigger/
│   ├── debug-pipeline/
│   ├── dora-metrics/
│   ├── gitops-status/
│   ├── manage-delegates/
│   ├── manage-feature-flags/
│   ├── manage-freeze-windows/
│   ├── manage-pull-requests/
│   ├── manage-roles/
│   ├── manage-users/
│   ├── migrate-pipeline/
│   ├── run-pipeline/
│   ├── scorecard-review/
│   ├── security-report/
│   └── template-usage/
├── LICENSE
└── README.md
```

---

## Credits

- **Skills** — authored by the Harness team ([harness/harness-skills](https://github.com/harness/harness-skills))
- **MCP Server** — [harness/mcp-server](https://github.com/harness/mcp-server)
- **Plugin specification** — [cursor/plugin-template](https://github.com/cursor/plugin-template)
