---
name: vibe-fix-failed-build
description: >-
  Diagnose and fix a failed Vibe build via harness-vibe MCP, then redeploy.
  Use when a Vibe build failed, the deployment card shows a failure, or the
  user runs /vibe-fix-failed-build.
---

# Vibe fix failed build

Follow the **Repair a failed build** section in the **vibe-deploy** skill. This skill exists so `/vibe-fix-failed-build` still routes.

## Instructions

1. Load **vibe-deploy** and follow **Repair a failed build**.
2. After a code change (or Accept fix), call `deploy_vibe_app` with `confirm: true` and the prior `appId` / `projectId`. Retry without code changes uses `retry_vibe_deployment`.
3. Do not dump JSON or re-render stages as markdown. One sentence on the fix and outcome.

## Examples

**User:** `/vibe-fix-failed-build` / "Fix the Vibe build"  
→ Same as **vibe-deploy** repair: read failure → patch `file:line` → redeploy with `confirm: true`.

## Performance Notes

- Skip logs when `agentInstruction` and `file`/`line` are already enough.
- `retry_vibe_deployment` does not upload changed files.

## Troubleshooting

| Symptom | Action |
|--------|--------|
| No `failure` object | Run is not failed — use **vibe-status**. |
| Same error after retry | Redeploy with `deploy_vibe_app` `confirm: true`. |

## HTTP fallback

MCP App iframes are Cursor-only. Call the same harness-vibe tools when available and use the one-line `content` summary. Do not dump JSON or rebuild stages as markdown. If harness-vibe is not installed, say so — do not invent REST calls unless the user asked to hit vibe-api directly.
