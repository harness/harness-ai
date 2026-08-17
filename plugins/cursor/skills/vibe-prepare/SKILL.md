---
name: vibe-prepare
description: >-
  Prepare a repo for Harness Vibe: detect package manager and framework, write
  .harness/vibe-context.json, split public env from secrets. Use when the user
  wants to make this deployable, prepare for Vibe, or run /vibe-prepare.
---

# Vibe prepare

Make the current workspace safe and discoverable for Harness Vibe. Do **not** deploy in this skill unless the user already asked to deploy — then chain **vibe-deploy** after the summary.

## Rules

- Never echo secret values in terminal output, logs, or summaries.
- Do not invent Harness account, org, project, or app IDs.
- Do not commit `.env`, `.env.local`, `.pem`, or other secrets.
- Stop after the checklist unless the user asked to deploy.

## Instructions

Execute in this order:

1. **Detect package manager and app structure.** Look for `package.json`, `pnpm-workspace.yaml` / `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`, `Dockerfile`, `pom.xml`, `go.mod`, `requirements.txt` / `pyproject.toml`. Note monorepo root vs app directory.
2. **Identify commands.** From `package.json` scripts (or Dockerfile/Makefile), record `build`, `dev`, and `start` when present. Prefer the app package in a monorepo, not the workspace root, unless the root is the app.
3. **Write `.harness/vibe-context.json`** (create `.harness/` if needed). Suggested shape:

   ```json
   {
     "name": "folder-or-package-name",
     "framework": "react-vite",
     "runtime": "node",
     "packageManager": "pnpm",
     "appDir": ".",
     "buildCommand": "pnpm build",
     "startCommand": "pnpm start",
     "suggestedSlug": "folder-or-package-name"
   }
   ```

   Guess `name` and `suggestedSlug` from the folder or `package.json` `name`. Do not invent Harness IDs.
4. **Env hygiene.** Find `.env.example` / `.env` / `.env.local`. Split **public config** (safe defaults, `NEXT_PUBLIC_*` / `VITE_*` keys that are not secrets) from **secrets** (`API_KEY`, tokens, passwords). Ensure `.env` and `.env.local` are gitignored. Rewrite `.env.example` to **keys only** (empty or placeholder values). Never print values.
5. **Move committed secrets out of source.** Flag tracked files that look like secrets (`API_KEY=`, `.pem`, private keys). Do not commit new secret files. Ask the user to rotate anything that was already committed.
6. **Verification checklist** (markdown summary, no secret values):
   - Package manager + framework + app dir
   - Build / start commands
   - Path to `.harness/vibe-context.json`
   - Env: example file present, secrets not tracked
   - Linked Harness project: n/a until first deploy
7. **Stop.** Chain to **vibe-deploy** only if the user asked to deploy (or ran `/vibe-deploy`).

## Examples

**User:** "Make this repo deployable with Vibe" / `/vibe-prepare`  
→ Detect stack → write `.harness/vibe-context.json` → env hygiene → checklist. Do not call `deploy_vibe_app`.

**User:** "Prepare this app and deploy it"  
→ Complete prepare, then follow **vibe-deploy** (`deploy_vibe_app` without `confirm`).

**User:** "What's the start command for Vibe?"  
→ Read or create context JSON; answer from `package.json` / Dockerfile. Do not deploy.

## Performance Notes

- Prefer reading `package.json` and lockfiles over running install.
- Do not run `dev` or production `start` as part of prepare.
- Skip rewriting `.env.example` if it already has keys only.

## Troubleshooting

| Symptom | Action |
|--------|--------|
| Monorepo, several apps | Ask which app dir to deploy; put that path in `appDir`. |
| No `package.json` | Record runtime from Dockerfile / `go.mod` / `pom.xml`; still write context JSON. |
| Secrets already in git | Tell the user to rotate; gitignore the file; do not print the values. |
| User also wants to deploy | Finish this skill, then **vibe-deploy**. |
