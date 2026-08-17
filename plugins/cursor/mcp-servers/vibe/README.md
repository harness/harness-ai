# Harness Vibe MCP (Cursor plugin)

Stdio MCP server with a Harness Design System MCP App. Tools call **vibe-api** over HTTP
by default (`VIBE_API_BASE_URL`, default `http://localhost:8090`). Set
`VIBE_MCP_MOCK=1` for in-memory fixtures (tests only).

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

Each tool returns `structuredContent` as an `AppUiView` (`kind` discriminant) for the
React MCP app (`ui://vibe/app.html`):

| Tool | `kind` | Notes |
| ---- | ------ | ----- |
| `get_vibe_app` | `app` | Status, metrics (when published), settings |
| `get_vibe_deployment` | `deployment` | Stages rail + hero; iframe polls while running |
| `get_vibe_deployment_logs` | `logs` | Stage logs from deployment |
| `deploy_vibe_app` | `deploy_form` or `deployment` | Form unless `confirm=true`; then zip cwd → submit |
| `retry_vibe_deployment` | `deployment` | Retry without uploading new files |
| `cancel_vibe_deployment` | `deployment` | Cancel a running run |
| `publish_vibe_app` | `deployment` | Publish preview to production |
| `rollback_vibe_app` | `deployment` | Roll back production |
| `request_vibe_approval` | `app` | Request production approval |
| `update_vibe_app` | `app` | Patch name, subdomain (`slug`), enable CDN |
| `accept_vibe_fix` | `fix_request` | Echo failure so the agent can patch and redeploy |
| `set_vibe_demo_path` | `deployment` | Dev/demo only — replay a named workflow recipe |

Do not pass `confirm: true` on `deploy_vibe_app` unless the user submitted the in-card form.

`dist/` is gitignored (the inlined HDS app HTML is large). Always build before Cursor starts the server:

```bash
npm install
npm run build
node dist/index.js
```

Cursor starts this via the parent plugin `mcp.json`.
