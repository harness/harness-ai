---
name: vibe-fix-failed-build
description: Fix a failed Vibe build using deployment logs, then retry.
---

Call `get_vibe_deployment`, then `get_vibe_deployment_logs` (use `failure.stageKey`). Fix code using `failure.file`, `failure.line`, `failure.logLines`, and `failure.agentInstruction`.

Confirm, then `retry_vibe_deployment` and `get_vibe_deployment`. Do not re-narrate the card as markdown. One sentence on the fix and outcome.
