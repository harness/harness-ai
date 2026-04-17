# Harness DevOps — Gemini CLI Context

You have access to Harness CI/CD tools via 11 MCP tools covering 160+ resource types.

## Operating Model

1. **Establish scope first** — confirm the user's organization and project before any operation.
2. **Verify dependencies exist** — before creating resources that reference others (e.g., a pipeline referencing a connector), use `harness_list` or `harness_get` to confirm the dependency exists.
3. **Discover schema before writing payloads** — use `harness_describe(resource_type="...")` to get the full schema for any resource type before constructing create/update payloads. This is a local lookup with no API call.
4. **URL extraction** — if the user provides a Harness UI URL, extract org_id, project_id, resource_type, and resource_id from it.

## Tool Reference

| Tool | Purpose |
|------|---------|
| `harness_list` | List resources with filters and pagination |
| `harness_get` | Get a single resource by ID |
| `harness_create` | Create a resource (requires confirmation) |
| `harness_update` | Update a resource (requires confirmation) |
| `harness_delete` | Delete a resource (destructive — confirm first) |
| `harness_execute` | Run, retry, sync, toggle, approve, reject, test_connection |
| `harness_search` | Cross-resource keyword search |
| `harness_describe` | Local metadata/schema lookup (no API call) |
| `harness_diagnose` | Pipeline failure analysis |
| `harness_status` | Project health overview |
| `harness_schema` | JSON Schema for create/update payloads (no API call) |

## Skill Summaries

### Pipeline & Execution
- **create-pipeline**: Analyze codebase, detect language/build tools/deploy targets, generate pipeline YAML, push via `harness_create`. Use `harness_describe(resource_type="pipeline")` first.
- **create-pipeline-v1**: Same as create-pipeline but generates v1 simplified YAML format.
- **create-trigger**: Create webhook, scheduled, or artifact triggers for pipelines.
- **create-template**: Create reusable step, stage, pipeline, and step group templates.
- **run-pipeline**: Execute a pipeline, provide runtime inputs, monitor execution status.
- **debug-pipeline**: Use `harness_diagnose` for failure analysis, retrieve logs, identify root cause, suggest fixes.
- **migrate-pipeline**: Convert v0 pipeline YAML to v1 simplified format.

### Infrastructure & Resources
- **create-service**: Define services (Kubernetes, Helm, ECS) with artifact sources. Requires connectors first.
- **create-environment**: Create PreProduction/Production environments with variable overrides.
- **create-infrastructure**: Define infrastructure definitions (K8s, ECS, Serverless). Requires a cloud/K8s connector.
- **create-connector**: Create connectors for GitHub, AWS, GCP, Azure, Docker, K8s. May require secrets.
- **create-secret**: Manage secrets (SecretText, SecretFile, SSHKey, WinRM).

### Access Control
- **manage-users**: Manage users, user groups, and service accounts.
- **manage-roles**: RBAC roles, assignments, permissions, and resource groups.

### Feature Flags
- **manage-feature-flags**: Create, list, toggle, and delete feature flags.

### Platform Operations
- **manage-delegates**: Monitor delegate health and manage registration tokens.

### Observability & Governance
- **analyze-costs**: Cloud cost analysis, recommendations, and anomaly detection.
- **security-report**: Security vulnerabilities, SBOMs, and compliance reports.
- **dora-metrics**: DORA metrics and engineering performance reports.
- **gitops-status**: GitOps application health, sync status, and pod logs.
- **chaos-experiment**: Create and run chaos engineering experiments.
- **scorecard-review**: IDP scorecards and service maturity review.
- **audit-report**: Audit trails and compliance evidence (SOC2, GDPR, HIPAA).
- **template-usage**: Template dependency tracking, impact analysis, and adoption.
- **create-policy**: Create OPA governance policies for supply chain security.

### Agents
- **create-agent**: Create Harness AI agents with pipeline YAML, metadata, and wiki using `harness_schema(resource_type="agent-pipeline")`.
- **create-agent-template**: Generate AI agent templates (metadata.json, pipeline.yaml, wiki.MD).

## Dependency Chain

When setting up end-to-end workflows: Connectors → Secrets → Services → Environments → Infrastructure → Pipelines → Triggers. Never skip steps or reference resources that don't exist yet.
