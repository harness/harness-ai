#!/usr/bin/env node
// afterMCPExecution hook — fires after MCP:harness_create or MCP:harness_update.
// For pipeline writes, evaluates the pipeline YAML against OPA policies and policy sets
// at account, org, and project scope via the Harness Policy Engine and attaches the
// result as additional_context so the agent can surface pass/fail to the user.

import {
  credentialsReady,
  harnessFetch,
  buildScopeQuery,
  accountId,
  extractPipelineYaml,
  PIPELINE_RESOURCE_TYPES,
} from "./harness-api.mjs";

const NOOP = {};

async function main() {
  const input = await readStdinJson();
  if (!input) { console.log(JSON.stringify(NOOP)); return; }

  const toolInput = input.tool_input || {};
  if (!PIPELINE_RESOURCE_TYPES.has(toolInput.resource_type)) {
    console.log(JSON.stringify(NOOP));
    return;
  }

  // body can be a YAML string, { yamlPipeline }, or { pipeline: {...} } — see
  // mcp-server/src/tools/harness-create.ts input schema.
  const yaml = extractPipelineYaml(toolInput.body);
  if (!yaml) { console.log(JSON.stringify(NOOP)); return; }

  if (!credentialsReady()) {
    console.log(JSON.stringify(NOOP));
    return;
  }

  const orgId = toolInput.org_id;
  const projectId = toolInput.project_id;
  const query = buildScopeQuery({ org_id: orgId, project_id: projectId });
  const action = input.tool_name === "MCP:harness_update" ? "onsave" : "oncreate";

  // Harness Policy Engine — evaluate YAML against policies bound to `pipeline` type.
  // Docs: https://developer.harness.io/docs/platform/policy-as-code/overview
  const res = await harnessFetch(
    `/pm/api/v1/policy/evaluations/evaluate-by-type?${query}&type=pipeline&action=${action}`,
    { method: "POST", body: yaml, headers: { "Content-Type": "application/yaml" } }
  ).catch(() => null);

  if (!res || !res.ok || !res.data) {
    console.log(JSON.stringify(NOOP));
    return;
  }

  const data = res.data;
  const status = data.status || data.result || "unknown";
  const details = Array.isArray(data.details) ? data.details : [];

  const failures = [];
  const warnings = [];
  for (const d of details) {
    const set = d.policy_set_name || d.policySetName || "";
    const policies = Array.isArray(d.policies) ? d.policies : (Array.isArray(d.policy_metadatas) ? d.policy_metadatas : []);
    for (const p of policies) {
      const name = p.name || p.policyName || "(unnamed)";
      const severity = (p.severity || p.status || "").toLowerCase();
      const denies = Array.isArray(p.deny_messages) ? p.deny_messages : (Array.isArray(p.denyMessages) ? p.denyMessages : []);
      const entry = { set, policy: name, severity, messages: denies };
      if (severity === "error" || p.status === "error" || (denies.length && severity !== "warning")) failures.push(entry);
      else if (severity === "warning" || p.status === "warning") warnings.push(entry);
    }
  }

  if (failures.length === 0 && warnings.length === 0) {
    console.log(JSON.stringify({
      additional_context: `Harness Policy Engine: ${details.length} policy set(s) evaluated, all passed (status=${status}, account=${accountId()}, scope=${scopeLabel(orgId, projectId)}).`,
    }));
    return;
  }

  const sections = [];
  sections.push(`Harness Policy Engine result: status=${status}, scope=${scopeLabel(orgId, projectId)}`);
  if (failures.length) {
    sections.push("\nFailures:");
    for (const f of failures) sections.push(`- [${f.set}] ${f.policy} → ${(f.messages || []).join("; ") || "denied"}`);
  }
  if (warnings.length) {
    sections.push("\nWarnings:");
    for (const w of warnings) sections.push(`- [${w.set}] ${w.policy} → ${(w.messages || []).join("; ") || "warn"}`);
  }
  sections.push("\nFix the failing policies before re-running the pipeline, or ask an admin to amend the policy set if the rule no longer applies.");

  console.log(JSON.stringify({ additional_context: sections.join("\n") }));
}

function scopeLabel(org, project) {
  if (project) return `project/${org}/${project}`;
  if (org) return `org/${org}`;
  return "account";
}

async function readStdinJson() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

main().catch(() => {
  console.log(JSON.stringify(NOOP));
});
