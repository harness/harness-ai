# Harness Vibe MCP (Cursor plugin)

Stdio MCP server with MCP Apps deployment card. Calls **vibe-api** over HTTP by default
(`VIBE_API_BASE_URL`, default `http://localhost:8090`). Set `VIBE_MCP_MOCK=1` for
in-memory fixtures (tests only).

## Environment

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `VIBE_API_BASE_URL` | `http://localhost:8090` | vibe-api origin |
| `VIBE_APP_ID` | — | Default app when tools omit `appId` |
| `VIBE_MCP_MOCK` | off | `1` → mock store |
| `VIBE_API_TOKEN` | — | Optional bearer token |
| `VIBE_ACCOUNT_ID` | — | Harness account header |
| `VIBE_ORG_ID` / `VIBE_PROJECT_ID` | — | Scope headers |

## Tools

`get_vibe_app`, `get_vibe_deployment`, `get_vibe_deployment_logs`, `deploy_vibe_app`,
`retry_vibe_deployment`, `cancel_vibe_deployment`, `publish_vibe_app`, `rollback_vibe_app`,
`request_vibe_approval`, `set_vibe_demo_path`.

Deployment tools return `structuredContent` as `VibeDeployment` for the in-chat card.

```bash
npm install
npm run build
node dist/index.js
```

Cursor starts this via the parent plugin `mcp.json`.
