---
name: vibe-status
description: >-
  Show the current Harness Vibe deployment card in chat via harness-vibe MCP
  (vibe-api). Use when the user types /vibe-status or asks for Vibe deploy
  status, stages, preview URL, or the in-chat deployment card.
---

# Vibe status

Show the live Vibe deployment card from **vibe-api** via the **harness-vibe** MCP server.

## Instructions

1. Call `get_vibe_deployment` on the **harness-vibe** MCP server.
   - Omit `appId` when the MCP resolves the default app (`VIBE_APP_ID` or latest app).
   - Pass `appId` and/or `executionId` only when the user names a specific app or run.
2. Do **not** invent status. The tool returns an in-chat deployment card (`ui://vibe/deployment.html`) plus a one-line `content` summary.
3. Do **not** paste raw JSON or re-render stages as a markdown task list.
4. After the card appears, reply with **one sentence** that matches the tool `content` summary (app name, status, failed stage and file:line if any).

## Examples

**User:** `/vibe-status`  
→ Call `get_vibe_deployment`. One-sentence follow-up: "GreenFork is failed at app_build · src/App.tsx:42."

**User:** "What's the Vibe preview URL?"  
→ Call `get_vibe_deployment`. Mention preview only if the card/summary shows it; do not guess.

**User:** "Status for app `app-abc`"  
→ Call `get_vibe_deployment` with `appId: "app-abc"`.

## Performance Notes

- One MCP call is enough for status — do not chain `get_vibe_app` unless the user asked for app metadata.
- If the server is unreachable, say vibe-api may be down and mention `VIBE_API_BASE_URL` (default `http://localhost:8090`).

## Troubleshooting

| Symptom | Action |
|--------|--------|
| MCP tool missing | Ensure the **harness-vibe** server is enabled in the plugin `mcp.json` and reload Cursor. |
| "No app" / 404 | Set `VIBE_APP_ID` or deploy first with the **vibe-deploy** skill. |
| Card missing, text only | Still give one sentence from `content`; do not dump `structuredContent`. |
| Auth / scope errors | Set `VIBE_API_TOKEN` and Harness scope headers (`VIBE_ACCOUNT_ID`, `VIBE_ORG_ID`, `VIBE_PROJECT_ID`) if required. |
