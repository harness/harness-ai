#!/usr/bin/env node
// Shared helper for Harness REST API calls from hook scripts.
// Reads HARNESS_API_KEY, HARNESS_ACCOUNT_ID, HARNESS_BASE_URL from env.

const BASE_URL = (process.env.HARNESS_BASE_URL || "https://app.harness.io").replace(/\/+$/, "");
const API_KEY = process.env.HARNESS_API_KEY;
const ACCOUNT_ID = process.env.HARNESS_ACCOUNT_ID;

export function credentialsReady() {
  return Boolean(API_KEY && ACCOUNT_ID);
}

export async function harnessFetch(pathAndQuery, { method = "GET", body, headers = {}, timeoutMs = 10000 } = {}) {
  if (!credentialsReady()) {
    throw new Error("HARNESS_API_KEY and HARNESS_ACCOUNT_ID must be set");
  }
  const url = `${BASE_URL}${pathAndQuery}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": body && typeof body === "string" ? "application/yaml" : "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export function buildScopeQuery({ org_id, project_id } = {}) {
  const params = new URLSearchParams({ accountIdentifier: ACCOUNT_ID });
  if (org_id) params.set("orgIdentifier", org_id);
  if (project_id) params.set("projectIdentifier", project_id);
  return params.toString();
}

export function accountId() {
  return ACCOUNT_ID;
}

/**
 * Resource types that carry pipeline YAML. The server registers both the legacy
 * v0 type and the v1 type; hooks must match both.
 * See harness/mcp-server: src/registry/toolsets/pipelines.ts.
 */
export const PIPELINE_RESOURCE_TYPES = new Set(["pipeline", "pipeline_v1"]);

/**
 * Normalize a harness_create / harness_update `body` input into a YAML string
 * suitable for policy eval and text scanning. The harness_create tool accepts
 * three shapes (see mcp-server/src/tools/harness-create.ts):
 *   1. body: "<yaml string>"                   — pass through
 *   2. body: { yamlPipeline: "<yaml string>" } — return yamlPipeline
 *   3. body: { pipeline: { ... } }             — JSON.stringify (not valid YAML
 *                                                 but good enough for policy
 *                                                 eval which accepts JSON too
 *                                                 and for regex scanning of
 *                                                 template references)
 * Returns "" if none of the above match.
 */
export function extractPipelineYaml(body) {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return "";
  if (typeof body.yamlPipeline === "string") return body.yamlPipeline;
  if (body.pipeline && typeof body.pipeline === "object") {
    try { return JSON.stringify(body.pipeline); } catch { return ""; }
  }
  return "";
}
