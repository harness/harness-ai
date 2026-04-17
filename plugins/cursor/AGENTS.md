# AGENTS.md — Contribution Standards

Instructions for any AI agent (Cursor, Claude Code, Codex, Aider, etc.) or human contributor modifying this repo. Every change must conform to the [Cursor plugin template spec](https://github.com/cursor/plugin-template). Validations below mirror `scripts/validate-template.mjs` from that template.

## Repository Purpose

This folder (`plugins/cursor/` in [harness-ai](https://github.com/harness/harness-ai)) packages the Harness MCP server + Harness skills + governance hooks as the **Harness Cursor plugin**. The monorepo root defines Cursor discovery via `.cursor-plugin/marketplace.json`. Reference: [Cursor multi-plugin repositories](https://cursor.com/docs/reference/plugins#multi-plugin-repositories).

## Directory layout

See `CLAUDE.md` — same `plugins/cursor/` subtree rules apply.

## Plugin Template Compliance — Hard Rules

1. **Plugin name**: lowercase, matches `^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$`. Declared in `.cursor-plugin/plugin.json` under `"name"`.
2. **MCP server definitions** live exclusively in `mcp.json` at this plugin root (`plugins/cursor/`). Do not rename this file.
3. **Hook definitions** live exclusively in `hooks/hooks.json`. Hook scripts live in `scripts/`.
4. **Referenced paths** (logo, hook `command`, skill paths): safe **relative** paths — no `..`, no absolute paths, no paths that escape the plugin root.
5. **Logo** committed and referenced from `plugin.json` via a relative path.
6. **No secrets** in any committed file. Credentials come from environment variables at runtime.

## Frontmatter Requirements

| File type | Location | Required frontmatter keys |
|-----------|----------|---------------------------|
| Rule | `rules/*.mdc`, `*.md`, `*.markdown` | `description` |
| Skill | `skills/<name>/SKILL.md` | `name`, `description` |
| Agent | `agents/*.md` | `name`, `description` |
| Command | `commands/*.(md\|mdc\|markdown\|txt)` | `name`, `description` |

YAML frontmatter opens with `---\n` and closes with `\n---\n`. Missing keys fail the validator.

## Skill Authoring Standards

- **Directory**: `skills/<kebab-case-name>/SKILL.md`. Frontmatter `name` must match the directory.
- **MCP tools**: use only the Harness MCP consolidated surface — `harness_list`, `harness_get`, `harness_create`, `harness_update`, `harness_delete`, `harness_execute`, `harness_search`, `harness_describe`, `harness_schema`, `harness_diagnose`, `harness_status`. Do not reference legacy per-resource tool names.
- **Describe vs schema**: use `harness_describe(resource_type=…)` for metadata and operations; use `harness_schema(resource_type=…)` to get the exact JSON Schema for create/update bodies.
- **Required sections**: `## Instructions`, `## Examples`, `## Performance Notes`, `## Troubleshooting`.
- **References**: skill-specific reference files live in `skills/<name>/references/`. Cross-skill references use relative paths like `create-pipeline/references/native-steps.md`.
- **Frontmatter metadata** (preferred — matches `harness/harness-skills`):
  ```yaml
  metadata:
    author: Harness
    version: <semver>
    mcp-server: harness-mcp-v2
  license: Apache-2.0
  compatibility: Requires Harness MCP server (harness-mcp-v2)
  ```
- **README sync**: every new skill appears in the README skill table.

## Hook Authoring Standards

- **Events**: use canonical Cursor event names (`beforeMCPExecution`, `afterMCPExecution`, `beforeShellExecution`, `afterShellExecution`, `afterFileEdit`, `beforeReadFile`, `beforeSubmitPrompt`, `sessionStart`, `sessionEnd`, `stop`). Source of truth: [cursor.com/docs/agent/hooks](https://cursor.com/docs/agent/hooks).
- **Matchers** for MCP tools use `MCP:<tool_name>` format. Multiple tools joined with `|` (regex alternation).
- **Protocol**: scripts read JSON from stdin, write JSON to stdout.
- **Fail open — non-negotiable**: on missing credentials, bad stdin, network error, or internal exception, emit `{"permission":"allow"}` (for `before*` hooks) or `{}` (for `after*` hooks). A hook must never block the agent because of our own bug. Wrap `main()` in a `try/catch` that prints the fail-open payload.
- **Script format**: `.mjs` Node modules with `#!/usr/bin/env node` shebang and executable bit set.
- **Scope narrowly**: use `tool_input.resource_type` to decide whether to act. Bail early for unrelated calls.
- **Shared helpers**: put reusable code in `scripts/harness-api.mjs`; individual scripts stay small.
- **Zero dependencies**: hook scripts run with `node` alone. Do not require an `npm install`.

## Script Environment

- Scripts run as child processes of Cursor and inherit its environment.
- Required env: `HARNESS_API_KEY`, `HARNESS_ACCOUNT_ID`. Optional: `HARNESS_BASE_URL`, `HARNESS_ORG`, `HARNESS_PROJECT`.
- Do not hardcode credentials or URLs. Do not log credentials to stdout — Cursor displays stdout to the user.
- Network calls must time out (10s recommended). `harness-api.mjs` already enforces this.

## Synchronization Rules

Changing one of these requires updating the others:

- **New MCP tool** → tool catalog in `rules/harness.mdc` + tool table in `README.md` + any skills that should reference it.
- **New skill** → skill table in `README.md`.
- **New hook** → "Governance Hooks" table in `README.md` + section in `rules/harness.mdc`.
- **Plugin version bump** → `"version"` in `.cursor-plugin/plugin.json`.

## Pre-Commit Checklist

1. Syntax-check new/modified `.mjs`:
   ```bash
   node --check scripts/your-script.mjs
   ```
2. Smoke-test hook scripts:
   ```bash
   echo '{"tool_name":"MCP:harness_create","tool_input":{"resource_type":"pipeline","body":{}}}' \
     | env -u HARNESS_API_KEY -u HARNESS_ACCOUNT_ID ./scripts/your-hook.mjs
   ```
   Confirm fail-open behavior without credentials.
3. Run the bundled validator (covers all the above):
   ```bash
   node scripts/validate-plugin.mjs
   ```
   Exits non-zero on any error. CI runs this automatically.
4. README reflects any new skills, hooks, or env vars.

## What NOT to Do

- Do not rename `mcp.json`, `hooks/hooks.json`, or `.cursor-plugin/plugin.json`.
- Do not reference paths outside the plugin root or paths containing `..`.
- Do not commit `.env` files, API keys, or account IDs.
- Do not weaken or remove fail-open behavior in hook scripts.
- Do not add a nested `plugins/` directory here or a local `marketplace.json` next to this plugin’s `plugin.json`.
- Do not introduce runtime dependencies in hook scripts beyond Node's standard library.
- Do not invent Cursor hook event names. Only use events documented at [cursor.com/docs/agent/hooks](https://cursor.com/docs/agent/hooks).

## References

- Cursor plugin template — https://github.com/cursor/plugin-template
- Notion plugin (single-plugin reference) — https://github.com/makenotion/cursor-notion-plugin
- Harness Skills (upstream) — https://github.com/harness/harness-skills
- Harness MCP server — https://github.com/harness/mcp-server
- Harness Policy as Code — https://developer.harness.io/docs/platform/policy-as-code/overview
- Cursor hooks documentation — https://cursor.com/docs/agent/hooks
