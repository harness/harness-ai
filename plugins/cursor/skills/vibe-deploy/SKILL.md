---
name: vibe-deploy
description: >-
  Deploy the current workspace to Harness Vibe via harness-vibe MCP (vibe-api).
  Use when the user wants to deploy this repo with Vibe, submit a new revision,
  go live, or run /vibe-deploy.
---

# Vibe deploy

Zip the workspace and submit a new Vibe revision through **vibe-api** via the **harness-vibe** MCP server.

## Instructions

1. **Confirm intent** — deploying mutates remote state. The plugin hook will also ask on `deploy_vibe_app`; still confirm with the user before calling the tool.
2. Call `deploy_vibe_app` on **harness-vibe**:
   - Omit `appId` on first deploy; pass `name` if the user gave an app name.
   - Pass `appId` (and `projectId` if known) for a new revision of an existing app.
   - Pass `path` only when replaying a named demo recipe (`success`, `fail_app_build`, etc.) — not for normal deploys.
3. Call `get_vibe_deployment` with the returned `appId` / `executionId` if the deploy response does not already show the card.
4. Do **not** paste raw JSON or re-render stages as markdown. Use the in-chat card and the one-line `content` summary.
5. After the card appears, give **one sentence** on status (building, failed, preview ready, etc.).

If `VIBE_TASK.md` or `.harness/vibe-context.json` exists, read it first — it may already name the target app.

## Examples

**User:** "Deploy this app with Vibe"  
→ Confirm → `deploy_vibe_app` → `get_vibe_deployment` → one sentence: "Submitted GreenFork; build is running."

**User:** "Ship a new revision for app `app-xyz`"  
→ Confirm → `deploy_vibe_app` with `appId: "app-xyz"` → one sentence from latest status.

**User:** `/vibe-deploy`  
→ Same as first example.

## Performance Notes

- `deploy_vibe_app` zips the workspace server-side — do not manually zip unless MCP is unavailable (see **harness-vibe-mode** HTTP fallback).
- Poll with `get_vibe_deployment` only when the user wants live updates; one post-deploy status call is enough by default.

## Troubleshooting

| Symptom | Action |
|--------|--------|
| Hook asks to confirm | Expected on deploy — user must approve the mock-governance prompt. |
| Deploy succeeds, build fails | Switch to **vibe-fix-failed-build**; do not redeploy until the code fix is in. |
| Missing app context | Call `get_vibe_app` or check `VIBE_APP_ID` / `VIBE_TASK.md`. |
| API unreachable | Verify vibe-api at `VIBE_API_BASE_URL` (default `http://localhost:8090`). |
