---
name: create-agent
description: "Create and update Harness AI agent instances — standalone agent.step.run templates used as building blocks in pipelines. Agents use connector-driven architecture requiring llmConnector (LLM access) and optional mcpConnectors (GitHub, Slack, Harness platform). Supports runtime inputs and task/rules-based instruction. Use when asked to create a Harness agent, update agent spec, modify agent configuration, build a code coverage agent, PR review agent, test generation agent, or configure agentic pipeline steps. Trigger phrases: create agent, update agent, modify agent spec, Harness agent, code coverage agent, review agent, agentic pipeline, agent template, agent connector setup."
metadata:
  author: Harness
  version: 1.0.0
  mcp-server: harness-mcp-v2
license: Apache-2.0
compatibility: Requires Harness MCP v2 server (harness-mcp-v2)
---

# Create Agent

Create and update Harness AI agent instances — standalone templates used as building blocks in pipelines for automated code, agentic workflows, and infrastructure tasks.

## Instructions

Follow this workflow to create or update an agent. **This is INTERACTIVE — show YAML for review and wait for confirmation before creating/updating the agent.**

### Phase 1: Check Existing Solutions First

**IMPORTANT: Before creating a new agent, check if an existing one can solve the use case.**

1. **List existing agents** — Call `harness_list` with `resource_type="agent"` (include `org_id` and `project_id` if scoped to a project). Ask user if they want to use/modify an existing agent instead.
2. **For updating existing agents** — Use `harness_get` with `resource_type="agent"` and `agent_id` to retrieve current config. Use `harness_update` (not `harness_create`) to modify only the fields that need changing (spec, name, description, wiki). Only custom agents can be updated.

### Phase 2: Requirements Gathering

Interactively gather the following before generating YAML:

- **Agent metadata**: Name, description, UID (auto-generated from name if not provided, e.g. "Code Coverage Agent" → "code_coverage_agent")
- **Goal**: What specific outcome should the agent achieve?
- **Inputs needed**: Repository info, execution context, configuration values, secrets
- **Expected outputs**: Files, external actions (PRs, comments, notifications), data/reports
- **Workflow**: Step-by-step task instructions (do 1, then 2, then 3)
- **Constraints**: Coding standards, limitations, rules → these become the `## RULES` section in the task field
- **Definition of done**: Success criteria and exit conditions
- **Connectors**: LLM connector (required for all agents), MCP connectors for external services (GitHub, Slack, Harness platform — only if needed). Users must create connectors via Harness UI or `harness_create` with `resource_type="connector"` before running the agent.

Present the recommended configuration and iterate until the user confirms.

### Phase 3: Generate Agent Spec

Assemble the complete agent YAML using this canonical structure:

```yaml
version: 1
agent:
  step:
    run:
      container:
        image: pkg.harness.io/vrvdt5ius7uwygso8s0bia/harness-agents/harness-ai-agent:latest
      with:
        task: |
          <step-by-step instructions referencing inputs via <+inputs.fieldName>>

          ## RULES
          <user constraints as bullet points>
        max_turns: 150  # Adjust 100-200 based on task complexity
        mcp_format: harness  # Only include if MCP connectors are needed
        mcp_servers: <+connectorInputs.resolveList(<+inputs.mcpConnectors>)>  # Only include if MCP connectors are needed
      env:
        ANTHROPIC_MODEL: <+inputs.anthropicModel>
        PLUGIN_HARNESS_CONNECTOR: <+inputs.llmConnector.id>

  inputs:
    llmConnector:
      type: connector
      required: true
      default: your_llm_connector_id  # User must replace with actual connector ID
    anthropicModel:
      type: string
      required: true
      default: arn:aws:bedrock:us-east-1:587817102444:application-inference-profile/7p8sn93lhspw
    mcpConnectors:  # Only include if MCP connectors are needed
      type: array
      default:
        - your_mcp_connector_id  # User must replace
    # Add custom inputs as needed (supported types: string, secret, boolean, connector, array)
```

**Key rules:**
- Always notify users to create connectors and replace placeholder IDs before running the agent
- Omit `mcp_format`, `mcp_servers`, and `mcpConnectors` input if no external MCP services are needed
- Do NOT add `clone`, `platform`, `os`, `arch`, or `allowed_tools` sections — agents use simplified standalone structure
- Use `inputs` for configuration instead of environment variables — reference with `<+inputs.fieldName>`

### Phase 4: Present for Review

Present the complete agent configuration (metadata, full spec YAML, required connectors) to the user. **Wait for explicit confirmation before creating/updating.**

### Phase 5: Create or Update Agent

Only after confirmation:

**Create a new agent:**

```
Call MCP tool: harness_create
Parameters:
  resource_type: "agent"
  org_id: "<organization>"
  project_id: "<project>"
  body: {
    uid: "<agent_identifier>",
    name: "<Agent Display Name>",
    description: "<Brief description of agent purpose>",
    spec: "<agent YAML spec as a string>",
    wiki: "<optional: markdown documentation>"
  }
```

**Update an existing agent** (custom agents only):

```
Call MCP tool: harness_update
Parameters:
  resource_type: "agent"
  agent_id: "<agent_identifier>"
  org_id: "<organization>"
  project_id: "<project>"
  body: { <only fields to change: name, description, spec, wiki> }
```

Retrieve current config with `harness_get` before updating. The `spec` field replaces the entire specification when provided.

## Example: Code Review Agent

```yaml
version: 1
agent:
  step:
    run:
      container:
        image: pkg.harness.io/vrvdt5ius7uwygso8s0bia/harness-agents/harness-ai-agent:latest
      with:
        task: |
          Review the pull request for repository <+inputs.repo_name> on branch <+inputs.branch>.

          1. Analyze code changes for security vulnerabilities
          2. Check for code quality issues
          3. Verify test coverage
          4. Post review comments using GitHub MCP tools

          ## RULES
          - Focus on critical security issues first
          - Be constructive in feedback
          - Suggest specific code improvements
        max_turns: 150
        mcp_format: harness
        mcp_servers: <+connectorInputs.resolveList(<+inputs.mcpConnectors>)>
      env:
        ANTHROPIC_MODEL: <+inputs.anthropicModel>
        PLUGIN_HARNESS_CONNECTOR: <+inputs.llmConnector.id>

  inputs:
    llmConnector:
      type: connector
      required: true
      default: your_llm_connector_id  # User must replace with actual connector ID
    anthropicModel:
      type: string
      required: true
      default: arn:aws:bedrock:us-east-1:587817102444:application-inference-profile/7p8sn93lhspw
    mcpConnectors:
      type: array
      default:
        - your_github_mcp_connector  # User must replace with actual connector ID
    repo_name:
      type: string
      default: my-org/my-repo
    branch:
      type: string
      default: main
```

## Examples

- "Create an agent that reviews PRs for security issues" → Gather requirements, generate agent spec with GitHub MCP connector, create via `harness_create`
- "Update my code coverage agent to use a different model" → Fetch with `harness_get`, modify spec, update via `harness_update`
- "Build an agent that runs tests and reports results to Slack" → Multi-MCP setup with GitHub and Slack connectors

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Connector not found | Verify connector exists in Harness UI with exact ID and correct scope (account/org/project). Create via `harness_create` with `resource_type="connector"` if missing. |
| MCP tools not available | Verify `mcpConnectors` input has correct connector IDs with valid endpoints and permissions. |
| Agent task failing | Increase `max_turns` if task is complex. Verify input references use `<+inputs.fieldName>` syntax. Review task instructions for completeness. |
