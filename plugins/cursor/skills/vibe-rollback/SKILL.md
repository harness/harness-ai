---
name: vibe-rollback
description: >-
  Roll back Harness Vibe production to the previous deployment via harness-vibe
  MCP. Use when the user wants to undo the last publish or run /vibe-rollback.
---

# Vibe rollback

Roll back **production** only after the user confirms. Never roll back because a preview failed.

If the MCP App iframe is unavailable, use the one-line `content` summary only — do not dump JSON.

## Instructions

1. Confirm the user wants to undo the **current production** deployment. Call `get_vibe_app` or `get_vibe_deployment` first if you need the production URL / current status.
2. If the app is not published (no production URL), say so and stop. Suggest **vibe-status**.
3. After explicit confirmation, call `rollback_vibe_app` (pass `appId` if known).
4. Follow with `get_vibe_deployment` or `get_vibe_app`. One sentence on the outcome.

Do not publish, deploy, or cancel as part of this skill.

## Examples

**User:** "Rollback production" / `/vibe-rollback`  
→ Confirm production URL → `rollback_vibe_app` → `get_vibe_deployment` → one sentence.

**User:** "Undo the last Vibe publish for app-xyz"  
→ Confirm → `rollback_vibe_app` with `appId: "app-xyz"`.

**User:** Preview build failed, "roll it back"  
→ Do **not** call rollback. Explain preview is not production; use **vibe-deploy** / Accept fix instead.

## Performance Notes

- One rollback call plus one status call is enough.
- Do not poll in chat.

## Troubleshooting

| Symptom | Action |
|--------|--------|
| Nothing to roll back | App was never published — say so; use **vibe-status**. |
| Hook / user cancels | Stop. Do not retry rollback. |
| API unreachable | Check `VIBE_API_BASE_URL` (default `http://localhost:8090`). |
