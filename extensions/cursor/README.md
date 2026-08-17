# Harness Vibe — Cursor extension

Always-on **Harness Vibe** activity-bar sidebar for the current workspace. Header stays constant (app, managed, preview/prod). Pipeline states show stages on the left and an action card on the right.

This is a VSIX, not a Cursor Marketplace plugin. Do not nest it under `plugins/cursor/`.

The extension is a thin client of local **vibe-api** (`VIBE_API_BASE_URL`, default `http://localhost:8090`). Deploy zips this workspace and creates a real Launchpad app. Only go-live is simulated, via named workflow paths.

## Install

```bash
cd extensions/cursor
npm install
npm run package
cursor --install-extension ./harness-vibe-0.4.4.vsix --force
```

Or from the vibe-mode repo: `./vibe-stack install-extensions update vibe`.

Reload Cursor. Open the **Harness Vibe** icon in the left activity bar. Start vibe-api (`./vibe-stack up`). If the API is down, the panel shows disconnected.

Settings: `harness.vibe.apiBaseUrl`, `harness.vibe.appId` (optional override).

## States

1. **Not managed** — this workspace has no Launchpad app; Deploy creates one
2. **Deploying** — stages left, progress card right
3. **Build failed** — short failure + Fix with agent / Retry (logs live in chat / MCP)
4. **Awaiting approval** — stages left, waiting-on-approvers card right
5. **Ready to publish** — same split
6. **Live in production** — metrics/actions card, no stage rail

The chips at the bottom replay a workflow path on the **same** app (`PUT /api/apps/:id/demo-state`). They do not swap in a canned example project.

UI is Harness Design System (`@harnessio/ui`).
