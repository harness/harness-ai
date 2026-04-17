# Releasing

Each package in this repo versions **independently** — there is no monorepo-wide release tag.

## Packages

| Package | Manifest | Where it ships |
|---------|----------|----------------|
| Cursor plugin | [`plugins/cursor/.cursor-plugin/plugin.json`](../plugins/cursor/.cursor-plugin/plugin.json) | [Cursor marketplace](https://cursor.com/marketplace/publish) — submit the repo URL `https://github.com/harness/harness-ai` |
| VS Code / Copilot plugin | [`plugins/vscode/.github/plugin.json`](../plugins/vscode/.github/plugin.json) | VS Code marketplace |
| Claude plugin | [`plugins/claude/.claude-plugin/plugin.json`](../plugins/claude/.claude-plugin/plugin.json) | Claude plugin directory |
| Gemini CLI extension | [`extensions/gemini/gemini-extension.json`](../extensions/gemini/gemini-extension.json) | `gemini extensions install https://github.com/harness/harness-ai` |

## When to bump a version

- **User-visible change** (new skill, new hook, new MCP tool, install behavior, env var): bump the affected package's manifest using SemVer.
  - **MAJOR** — breaking change (removed skill, renamed env var, incompatible MCP wiring).
  - **MINOR** — additive change (new skill, new hook, new optional env var).
  - **PATCH** — bug fix, doc change, internal cleanup.
- **Skills sync PR** from `harness/harness-skills` (opened by [`.github/workflows/sync-skills.yml`](../.github/workflows/sync-skills.yml)): bump **PATCH** on every plugin whose `skills/` tree changed.
- **No version bump needed** for README-only edits that don't change install or usage, CI workflow tweaks, or repo-level scripts under `scripts/`.

## Release flow

1. Land the change on `main` via PR with CI green.
2. Bump `version` in the relevant manifest (same PR or an immediate follow-up).
3. Tag the release with the package prefix:
   - Cursor: `cursor-vX.Y.Z`
   - VS Code: `vscode-vX.Y.Z`
   - Claude: `claude-vX.Y.Z`
   - Gemini: `gemini-vX.Y.Z`
4. Re-submit / publish:
   - **Cursor marketplace** re-pulls from the default branch; no action needed unless plugin metadata changed.
   - **VS Code / Claude** — re-submit if the marketplace requires it.
   - **Gemini CLI** — users get the new version on the next `gemini extensions install …`.

## Validating before release

Run the umbrella validator from the repo root:

```bash
./scripts/validate.sh
```

Deep-check the Cursor plugin specifically:

```bash
( cd plugins/cursor && node scripts/validate-plugin.mjs )
```

CI ([`.github/workflows/cursor-plugin.yml`](../.github/workflows/cursor-plugin.yml)) runs the same checks plus hook fail-open smoke tests on every PR that touches `plugins/cursor/**` or `.cursor-plugin/marketplace.json`.

## Hotfix / revert

- Hotfixes follow the same flow — bump **PATCH**, tag, let the marketplace re-pull.
- To revert a skill sync: revert the PR opened by `sync-skills.yml`. The next daily run will either re-sync cleanly (if upstream agrees) or reopen the PR (if upstream still disagrees) — reconcile at the `harness/harness-skills` level, not here.
