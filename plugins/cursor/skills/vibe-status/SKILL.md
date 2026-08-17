---
name: vibe-status
description: >-
  Show the current Harness Vibe deployment or app card via harness-vibe MCP
  (vibe-api). Use when the user types /vibe-status or asks for status, stages,
  preview URL, metrics, health, or subdomain/CDN settings.
---

# Vibe status

Show the live Vibe card from **vibe-api** via **harness-vibe**. Do not invent status.

If the MCP App iframe is unavailable, use the one-line `content` summary only — do not dump JSON or rebuild stages as markdown.

## Instructions

1. **Default:** call `get_vibe_deployment` (pipeline / stages card).
   - Omit `appId` when the MCP resolves the default app (`VIBE_APP_ID` or latest).
   - Pass `appId` and/or `executionId` when the user names a specific app or run.
2. **Metrics, health, URL, or settings:** call `get_vibe_app` instead (or as well if they asked for both).
3. Settings changes (subdomain / Enable CDN) happen **in the card** via `update_vibe_app`. Do not PATCH from chat unless the user cannot see the iframe and explicitly asked to change a setting.
4. After the card appears, reply with **one sentence** that matches the tool `content` summary.

Do not poll in chat; the deployment iframe already polls while a run is in progress.

## Examples

**User:** `/vibe-status`  
→ `get_vibe_deployment`. One sentence: "GreenFork is failed at app_build · src/App.tsx:42."

**User:** "What's the Vibe preview URL?" / "Show live metrics"  
→ `get_vibe_app` (metrics only when published). Mention URLs only if the card/summary shows them.

**User:** "Change the subdomain"  
→ `get_vibe_app` and point at the settings fields on the card. Call `update_vibe_app` only if they cannot use the iframe.

**User:** "Status for app `app-abc`"  
→ `get_vibe_deployment` with `appId: "app-abc"`.

## Performance Notes

- One MCP call is enough for status. Do not chain `get_vibe_app` unless the user asked for metrics, health, or settings.
- If the server is unreachable, say vibe-api may be down and mention `VIBE_API_BASE_URL` (default `http://localhost:8090`).

## Troubleshooting

| Symptom | Action |
|--------|--------|
| MCP tool missing | Ensure **harness-vibe** is enabled in the plugin `mcp.json` and reload Cursor. |
| "No app" / 404 | Set `VIBE_APP_ID` or deploy first with **vibe-deploy**. |
| Card missing, text only | Still give one sentence from `content`; do not dump `structuredContent`. |
| Auth / scope errors | Set `VIBE_API_TOKEN` and Harness scope headers if required. |
