---
name: vibe-deploy
description: >-
  Deploy the current workspace to Harness Vibe via harness-vibe MCP (vibe-api).
  Use when the user wants to deploy, ship a revision, go live, run /vibe-deploy,
  or fix a failed Vibe build.
---

# Vibe deploy

Show the in-chat deploy form, then let the MCP App stream stages. Repair failed builds in this same skill.

If the harness-vibe MCP App iframe is unavailable, use the one-line `content` summary only — do not dump JSON or rebuild stages as markdown.

## Instructions

1. **Context.** If `.harness/vibe-context.json` is missing, run **vibe-prepare** first (or say so) unless the user already has an app and only wants a new revision.
2. **Open the form.** Call `deploy_vibe_app` on **harness-vibe** **without** `confirm`. Optional: `name`, `appId`, `projectId` (from context or the user). Pass `path` only for a named demo recipe — not for normal deploys.
3. **One sentence:** “Fill in name, subdomain, and CDN, then Submit.” Do **not** pass `confirm: true` yourself. Do **not** poll in chat while the iframe streams (`get_vibe_deployment` every ~1.5s inside the card).
4. **Speak only on terminal tool results** (failed, cancelled, preview ready, publish-ready, live).
5. **Publish-ready:** do **not** call `publish_vibe_app` unless the user said to go live. Point at the Publish button / **vibe-status**.
6. **Repair** (failed card or `/vibe-fix-failed-build`) — see below.

Tool catalog: `deploy_vibe_app`, `get_vibe_deployment`, `get_vibe_deployment_logs`, `retry_vibe_deployment`, `cancel_vibe_deployment`, `accept_vibe_fix`.

### Repair a failed build

1. Read `kind: 'fix_request'` from **Accept fix**, or `get_vibe_deployment` + `failure` (`agentInstruction`, `file`, `line`, `logLines`, `summary`). Fetch `get_vibe_deployment_logs` with `stageKey` only if those fields are not enough.
2. Edit local code at `file:line`. Do not re-narrate the card as markdown stages.
3. After Accept fix / a real code change, call `deploy_vibe_app` with **`confirm: true`** and the prior `appId` / `projectId` (retry does **not** upload changed files).
4. If the user clicks Retry **without** code changes, `retry_vibe_deployment` is correct.
5. If the host did not wake the model, read `VIBE_TASK.md` if present and apply that instruction, then redeploy with `confirm: true`.

## Examples

**User:** "Deploy this app with Vibe" / `/vibe-deploy`  
→ `deploy_vibe_app` (no `confirm`) → “Fill in name, subdomain, and CDN, then Submit.”

**User:** "Ship a new revision for app `app-xyz`"  
→ `deploy_vibe_app` with `appId` only (no `confirm`) so the form prefills.

**User:** Accepts fix on a failed card / `/vibe-fix-failed-build`  
→ Apply `instruction` at `file:line` → `deploy_vibe_app` with `confirm: true`, `appId`, `projectId`.

**User:** "Retry, I didn't change anything"  
→ `retry_vibe_deployment`.

## Performance Notes

- One `deploy_vibe_app` without `confirm` is enough to show the form. Do not zip the workspace in the agent.
- Do not poll `get_vibe_deployment` in chat while the iframe is streaming.
- Skip logs when `agentInstruction` and `file`/`line` are already enough.

## Troubleshooting

| Symptom | Action |
|--------|--------|
| Hook asks to confirm | Expected on **confirmed** deploy (`confirm: true`) and cancel — user must approve. Form-only calls should not ask. |
| Build failed after submit | Follow **Repair a failed build**; do not retry until the fix is saved if files changed. |
| Same error after retry | Files were not uploaded — `deploy_vibe_app` with `confirm: true`. |
| Missing app context | Read `.harness/vibe-context.json` / `VIBE_TASK.md`, or call `get_vibe_app`. |
| API unreachable | Verify vibe-api at `VIBE_API_BASE_URL` (default `http://localhost:8090`). |

## HTTP fallback

MCP App iframes are Cursor-only. Call the same harness-vibe tools when available and use the one-line `content` summary. Do not dump JSON or rebuild stages as markdown. If harness-vibe is not installed, say so — do not invent REST calls unless the user asked to hit vibe-api directly.
