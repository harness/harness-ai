#!/usr/bin/env node
// beforeMCPExecution hook — fires on MCP:harness_create.
// For pipeline creations, lists available templates at account/org/project scope
// and asks the user to confirm before creating a pipeline that bypasses them.
// Emits permission: "ask" with a summary so the agent surfaces the options to the user.

import {
  credentialsReady,
  harnessFetch,
  buildScopeQuery,
  extractPipelineYaml,
  PIPELINE_RESOURCE_TYPES,
} from "./harness-api.mjs";

const ALLOW = { permission: "allow" };

async function main() {
  const input = await readStdinJson();
  if (!input) { console.log(JSON.stringify(ALLOW)); return; }

  const toolInput = input.tool_input || {};
  if (!PIPELINE_RESOURCE_TYPES.has(toolInput.resource_type)) {
    console.log(JSON.stringify(ALLOW));
    return;
  }

  // body can be a YAML string, { yamlPipeline }, or { pipeline: {...} } — see
  // mcp-server/src/tools/harness-create.ts input schema.
  const yaml = extractPipelineYaml(toolInput.body);

  // If the pipeline already uses a template (YAML text match) or a templateRef
  // appears anywhere in the stringified JSON body, don't nag.
  if (/["']?templateRef["']?\s*:/.test(yaml) || /["']?useFromStage["']?\s*:/.test(yaml)) {
    console.log(JSON.stringify(ALLOW));
    return;
  }

  if (!credentialsReady()) {
    // Can't check templates without credentials — fail open.
    console.log(JSON.stringify(ALLOW));
    return;
  }

  const orgId = toolInput.org_id;
  const projectId = toolInput.project_id;

  const scopes = [
    { label: "account", query: buildScopeQuery({}) },
    orgId ? { label: "org", query: buildScopeQuery({ org_id: orgId }) } : null,
    orgId && projectId ? { label: "project", query: buildScopeQuery({ org_id: orgId, project_id: projectId }) } : null,
  ].filter(Boolean);

  const templates = [];
  for (const scope of scopes) {
    try {
      const res = await harnessFetch(
        `/template/api/templates/list-metadata?${scope.query}&templateListType=Stable&size=50`,
        { method: "POST", body: { filterType: "Template" } }
      );
      if (res.ok && res.data?.data?.content) {
        for (const t of res.data.data.content) {
          templates.push({
            scope: scope.label,
            identifier: t.identifier,
            name: t.name,
            templateEntityType: t.templateEntityType,
            versionLabel: t.versionLabel,
            description: t.description,
          });
        }
      }
    } catch {
      // Ignore per-scope failure; continue.
    }
  }

  // Filter to pipeline-relevant templates (Pipeline, Stage, StepGroup, Step).
  const relevant = templates.filter(
    (t) => ["Pipeline", "Stage", "StepGroup", "Step"].includes(t.templateEntityType)
  );

  if (relevant.length === 0) {
    console.log(JSON.stringify(ALLOW));
    return;
  }

  const summary = relevant
    .slice(0, 20)
    .map((t) => `- [${t.scope}] ${t.templateEntityType} • ${t.name} (${t.identifier}@${t.versionLabel || "latest"})${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");

  const agentMessage = [
    "Harness governance check: templates are available that may satisfy this pipeline.",
    "Review the list below and consider reusing one via `templateRef` (at the pipeline, stage, or step level) before creating a raw pipeline.",
    "Templates enforce org/account conventions for CI/CD and reduce drift.",
    "",
    summary,
    relevant.length > 20 ? `\n(${relevant.length - 20} additional templates not shown.)` : "",
    "",
    "If none of these fit the use case, proceed with the current pipeline YAML.",
  ].join("\n");

  console.log(JSON.stringify({
    permission: "ask",
    user_message: `Found ${relevant.length} reusable Harness template(s) in scope. Review before creating a raw pipeline?`,
    agent_message: agentMessage,
  }));
}

async function readStdinJson() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

main().catch(() => {
  // Fail open on any error — hooks should not block the agent on our bugs.
  console.log(JSON.stringify(ALLOW));
});
