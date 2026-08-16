---
name: vibe-fix-failed-build
description: >-
  Diagnose and fix a failed Vibe build via harness-vibe MCP, then retry the
  deployment. Use when a Vibe build failed, the deployment card shows a failure,
  or the user asks to fix a Vibe / GreenFork build error.
---

# Vibe fix failed build

Repair a failed Vibe stage using deployment failure metadata from **vibe-api**, then retry.

## Instructions

1. Call `get_vibe_deployment` on **harness-vibe**. If status is not failed, say so in one sentence and stop.
2. Call `get_vibe_deployment_logs` with `stageKey` from `failure.stageKey` when present.
3. Use these fields from `structuredContent.failure` (do not invent details):
   - `file` / `line` — open and fix the cited location
   - `logLines` — error output from the failed stage
   - `agentInstruction` — primary fix guidance from vibe-api
   - `summary` / `suggestion` — extra context
4. Edit the local code to fix the root cause. Do **not** re-narrate the deployment card as markdown stages.
5. Confirm with the user, then call `retry_vibe_deployment` (same `appId` / `executionId` when known).
6. Call `get_vibe_deployment` once more. One sentence: fixed what, retry outcome.

If retry is not appropriate (e.g. source changed materially), use **vibe-deploy** to submit a new revision instead.

## Examples

**User:** "Fix the Vibe build"  
→ `get_vibe_deployment` → `get_vibe_deployment_logs` → fix `src/App.tsx:42` per `agentInstruction` → confirm → `retry_vibe_deployment` → one sentence.

**User:** "Build failed on app_build"  
→ Logs with `stageKey: "app_build"` → fix import/type error → retry → status sentence.

**User:** `/vibe-fix-failed-build`  
→ Same as first example.

## Performance Notes

- Read `failure` from the first `get_vibe_deployment` before fetching logs — skip logs when `agentInstruction` and `file`/`line` are already sufficient.
- Fix locally before retry; `retry_vibe_deployment` does not upload changed files (use **vibe-deploy** for a new revision after substantive edits).

## Troubleshooting

| Symptom | Action |
|--------|--------|
| No `failure` object | Deployment may still be running — one sentence, suggest **vibe-status**. |
| Empty logs | Use `failure.logLines` and `agentInstruction` from the deployment payload. |
| Retry succeeds but same error | Re-read logs; ensure the fix is saved, then `deploy_vibe_app` for a fresh revision. |
| Hook blocks retry | Retry is allowed by default; if blocked, user must approve in the hook prompt. |
