---
name: vibe-fix-failed-build
description: Fix a failed Vibe build using the vibe-deploy repair flow, then redeploy.
---

Follow the **Repair a failed build** section of the **vibe-deploy** skill. Apply `failure.agentInstruction` at `file:line`, then `deploy_vibe_app` with `confirm: true` (retry does not upload changed files).

Do not re-narrate the card as markdown. One sentence on the fix and outcome.
