---
name: vibe-prepare
description: Prepare this repo for Harness Vibe (detect stack, env hygiene, vibe-context.json).
---

Follow the **vibe-prepare** skill. Detect package manager and framework, write `.harness/vibe-context.json`, split public env from secrets (never echo values). Do not deploy unless the user also asked to deploy — then chain **vibe-deploy**.
