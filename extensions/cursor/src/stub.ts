import type {
  EnvCard,
  PanelState,
  PanelView,
  StageItem,
  Telemetry,
} from "./types";

const APP = "vegan-food-delivery";
const REPO = "acme/vegan-food-delivery";
const PROJECT_ID = "prj_vegan_04";
const PREVIEW_URL = "https://vegan-food-delivery--preview.apps.harness.io";
const PROD_URL = "https://vegan.vibe.acme.com";
const CONSOLE_URL = "https://app.harness.io/#/vibe/apps/prj_vegan_04";

const AGENT_PROMPT = `Fix this Harness Vibe preview build failure in the current workspace.

Preview failed at the Build stage. Production was not attempted.

Failure: 2 type errors in frontend/src/components/MenuSection.tsx

frontend/src/components/MenuSection.tsx:48:31 — error TS2339
  Property 'length' does not exist on type 'string[] | undefined'.

frontend/src/components/MenuSection.tsx:59:47 — error TS2345
  Argument of type 'number | undefined' is not assignable to parameter of type 'number'.

Found 2 errors. exit 1

Likely cause: the menu payload types priceCents and tags as optional, but formatPrice takes number and tags is used as string[].

Please:
1. Inspect the current workspace for MenuSection.tsx (or the equivalent frontend file around the type errors above).
2. Make the smallest appropriate fix.
3. Package / typecheck.
4. Come back to the Harness Vibe sidebar and use Retry build.
`;

function env(
  name: EnvCard["name"],
  state: string,
  meta: string,
  tone: EnvCard["tone"],
  openable: boolean,
): EnvCard {
  return { name, state, meta, tone, openable };
}

function stages(
  codes: Array<["done" | "active" | "failed" | "held" | "pending", string]>,
  includeProd: boolean,
): StageItem[] {
  const defs: Array<[string, string]> = [
    ["Build", "image · tests · types"],
    ["Provision", "cloud infra"],
    ["Checks", "policy · security"],
    ["Preview", "url · tls"],
  ];
  if (includeProd) defs.push(["Production", "canary → full"]);
  return codes.map(([status, time], index) => {
    const def = defs[index] ?? ["Production", "canary → full"];
    const meta =
      status === "pending"
        ? ""
        : status === "failed"
          ? "exit 1 · 2 type errors"
          : status === "held"
            ? "awaiting Platform team"
            : def[1];
    return { name: def[0], meta, time, status };
  });
}

function snapshot(
  view: PanelView,
  attempt: number,
): Omit<PanelState, "stubbed" | "attempt" | "maxAttempts" | "agentPrompt"> {
  const base = {
    appName: APP,
    repo: REPO,
    consoleUrl: CONSOLE_URL,
    failureFile: null as string | null,
    failureLine: null as number | null,
    appId: null as string | null,
    executionId: null as string | null,
  };

  if (view === "fresh") {
    return {
      ...base,
      view,
      managed: false,
      projectId: "no project id",
      previewUrl: null,
      productionUrl: null,
      envs: [
        env("preview", "not deployed", "—", "idle", false),
        env("production", "not deployed", "—", "idle", false),
      ],
      hero: {
        tone: "idle",
        eyebrow: "",
        title: "Deploy vegan-food-delivery with Vibe",
        body: "Harness has no project for this repository. The first deploy creates one and applies the Vibe template your team is on.",
        progress: false,
        rows: [
          { k: "workspace", v: APP },
          { k: "stack", v: "React · Spring Boot · Postgres" },
          { k: "you get", v: "preview url · managed deploy" },
        ],
        actions: [
          { id: "deploy", label: "Deploy to preview", primary: true },
          { id: "seeEnforces", label: "See what it enforces", primary: false },
        ],
        foot: "Nothing is created until you deploy. Your code is not uploaded before then.",
      },
      errorBlocks: null,
      stages: null,
      stageLabel: "",
      stageMeta: "",
      telemetry: null,
      footLeft: "harness-vibe MCP · connected",
      footRight: "not managed",
    };
  }

  if (view === "deploying") {
    return {
      ...base,
      view,
      managed: true,
      projectId: PROJECT_ID,
      previewUrl: null,
      productionUrl: null,
      executionId: "vibe-run-vegan-04",
      envs: [
        env("preview", "deploying", "stage 1 of 4", "info", false),
        env("production", "not deployed", "—", "idle", false),
      ],
      hero: {
        tone: "info",
        eyebrow: "Deploying · 1m 18s",
        title: "Building vegan-food-delivery",
        body: "Compiling the Vite frontend and Spring Boot API. Runs on Harness, not on your machine.",
        progress: true,
        rows: [
          { k: "run", v: "vibe-run-vegan-04" },
          { k: "commit", v: "7c2e91a · main" },
        ],
        actions: [
          { id: "streamLogs", label: "Stream logs", primary: false },
          { id: "cancel", label: "Cancel run", primary: false },
        ],
        foot: "",
      },
      errorBlocks: null,
      stages: stages(
        [
          ["active", "1:18"],
          ["pending", ""],
          ["pending", ""],
          ["pending", ""],
        ],
        false,
      ),
      stageLabel: "Stages",
      stageMeta: "1 of 4",
      telemetry: null,
      footLeft: "watching run vibe-run-vegan-04",
      footRight: "vibe-delivery-v3",
    };
  }

  if (view === "failed") {
    return {
      ...base,
      view,
      managed: true,
      projectId: PROJECT_ID,
      previewUrl: null,
      productionUrl: null,
      failureFile: "frontend/src/components/MenuSection.tsx",
      failureLine: 59,
      executionId: "vibe-run-vegan-04",
      envs: [
        env("preview", "build failed", "nothing deployed", "err", false),
        env("production", "not attempted", "—", "idle", false),
      ],
      hero: {
        tone: "err",
        eyebrow: "Build failed · stage 1 of 4",
        title: "2 type errors in MenuSection.tsx",
        body: "Nothing was deployed and no infrastructure was created. Production was not attempted.",
        progress: false,
        rows: [],
        actions: [
          { id: "askAgent", label: "Fix with agent", primary: true, ai: true },
          { id: "retry", label: "Retry build", primary: false },
        ],
        foot: "Fix with agent writes VIBE_TASK.md and opens chat with the failure context.",
      },
      errorBlocks: null,
      stages: stages(
        [
          ["failed", "1:31"],
          ["pending", ""],
          ["pending", ""],
          ["pending", ""],
        ],
        false,
      ),
      stageLabel: "Stages",
      stageMeta: "halted at 1",
      telemetry: null,
      footLeft: "failure in frontend/src/components/MenuSection.tsx",
      footRight: `attempt ${attempt} of 3`,
    };
  }

  if (view === "approval") {
    return {
      ...base,
      view,
      managed: true,
      projectId: PROJECT_ID,
      previewUrl: PREVIEW_URL,
      productionUrl: PROD_URL,
      executionId: "vibe-run-vegan-04",
      envs: [
        env("preview", "live", "6d left · $1.42", "ok", true),
        env("production", "awaiting approval", "held 4m", "warn", false),
      ],
      hero: {
        tone: "warn",
        eyebrow: "Held · release checks",
        title: "Waiting on Platform team",
        body: "Preview for vegan-food-delivery is live. Policy checks passed. One human gate remains before production.",
        progress: false,
        rows: [
          { k: "approvers", v: "Platform team · 3 members" },
          { k: "preview", v: "vegan-food-delivery--preview" },
          { k: "expires", v: "in 20h if undecided" },
        ],
        actions: [
          { id: "openConsole", label: "Open in console", primary: true },
          { id: "nudgeApprovers", label: "Nudge approvers", primary: false },
        ],
        foot: "The panel resumes when approval is decided, whether or not this window is open.",
      },
      errorBlocks: null,
      stages: stages(
        [
          ["done", "1:38"],
          ["done", "2:02"],
          ["done", "1:07"],
          ["done", "0:19"],
          ["held", ""],
        ],
        true,
      ),
      stageLabel: "Stages",
      stageMeta: "4 done · 1 held",
      telemetry: null,
      footLeft: "watching approval.decided",
      footRight: "requested 4m ago",
    };
  }

  if (view === "publish") {
    return {
      ...base,
      view,
      managed: true,
      projectId: PROJECT_ID,
      previewUrl: PREVIEW_URL,
      productionUrl: PROD_URL,
      executionId: "vibe-run-vegan-04",
      envs: [
        env("preview", "live", "v0.4.2 · healthy", "ok", true),
        env("production", "live", "v0.4.1 · 2d ago", "ok", true),
      ],
      hero: {
        tone: "ok",
        eyebrow: "Approved 2m ago · all checks green",
        title: "Publish v0.4.2 to production",
        body: "Canary at 10% for 15 minutes, then full rollout to vegan.vibe.acme.com. Automatic rollback if error rate or latency breach the guardrails.",
        progress: false,
        rows: [
          { k: "approved by", v: "d.mehta · Platform team" },
          { k: "guardrails", v: "errors < 0.5% · p95 < 150ms" },
          { k: "rollback", v: "one step to v0.4.1" },
        ],
        actions: [
          { id: "publish", label: "Publish to production", primary: true },
          { id: "reviewChanges", label: "Review changes", primary: false },
        ],
        foot: "Rollback is Harness-side and does not need this window open.",
      },
      errorBlocks: null,
      stages: stages(
        [
          ["done", "1:38"],
          ["done", "2:02"],
          ["done", "1:07"],
          ["done", "0:19"],
          ["pending", ""],
        ],
        true,
      ),
      stageLabel: "Stages",
      stageMeta: "preview green",
      telemetry: null,
      footLeft: "ready · vibe-run-vegan-04",
      footRight: "v0.4.2 · 7c2e91a",
    };
  }

  const telemetry: Telemetry = {
    host: "vegan.vibe.acme.com",
    stats: [
      { value: "12.4k", label: "requests 24h", tone: "idle" },
      { value: "184 ms", label: "p95 latency", tone: "idle" },
      { value: "0.7%", label: "error rate", tone: "warn" },
    ],
    buildTag: "v0.4.2",
    buildMsg: "feat: menu from /api/menu",
    buildMeta: "7c2e91a · deployed 2h ago by you · rolled out in 14m",
    rollbackLabel: "Roll back to v0.4.1",
    history: [
      {
        msg: "v0.4.2  feat: menu from /api/menu",
        meta: "deployed · 14m rollout",
        when: "2h",
        tone: "ok",
      },
      {
        msg: "v0.4.1  fix: plan price rounding",
        meta: "deployed",
        when: "2d",
        tone: "idle",
      },
      {
        msg: "v0.4.0  feat: weekly favorites",
        meta: "rolled back after 6m",
        when: "4d",
        tone: "warn",
      },
    ],
  };

  return {
    ...base,
    view: "live",
    managed: true,
    projectId: PROJECT_ID,
    previewUrl: null,
    productionUrl: PROD_URL,
    executionId: "vibe-run-vegan-04",
    envs: [
      env("preview", "torn down", "on merge", "idle", false),
      env("production", "live", "v0.4.2 · healthy", "ok", true),
    ],
    hero: null,
    errorBlocks: null,
    stages: null,
    stageLabel: "",
    stageMeta: "",
    telemetry,
    footLeft: "vegan.vibe.acme.com healthy",
    footRight: "$146 / mo",
  };
}

export function stubPanelState(
  view: PanelView,
  overlay?: Pick<
    Partial<PanelState>,
    "appId" | "executionId" | "projectId" | "appName" | "repo"
  >,
): PanelState {
  const snap = snapshot(view, 1);
  return {
    stubbed: true,
    ...snap,
    attempt: 1,
    maxAttempts: 3,
    agentPrompt: AGENT_PROMPT,
    appId: overlay?.appId ?? snap.appId,
    executionId: overlay?.executionId ?? snap.executionId,
    projectId: overlay?.projectId ?? snap.projectId,
    appName: overlay?.appName ?? snap.appName,
    repo: overlay?.repo ?? snap.repo,
  };
}

export class StubStore {
  view: PanelView = "failed";
  codeFixed = false;
  attempt = 1;
  afterDeploy: Extract<PanelView, "failed" | "approval"> = "failed";

  reset(): void {
    this.view = "failed";
    this.codeFixed = false;
    this.attempt = 1;
    this.afterDeploy = "failed";
  }

  setView(view: PanelView): void {
    this.view = view;
    if (view === "failed") this.attempt = 1;
    if (view === "fresh") this.codeFixed = false;
  }

  markCodeFixed(): void {
    this.codeFixed = true;
  }

  deploy(): "replay" | "stay" {
    if (this.view !== "fresh" && this.view !== "failed") return "stay";
    this.afterDeploy =
      this.view === "fresh" || this.codeFixed ? "approval" : "failed";
    this.view = "deploying";
    return "replay";
  }

  retry(): "replay" | "stay" {
    if (this.view !== "failed") return "stay";
    if (!this.codeFixed) {
      this.attempt = Math.min(this.attempt + 1, 3);
      return "stay";
    }
    this.afterDeploy = "approval";
    this.view = "deploying";
    return "replay";
  }

  finishDeploy(): void {
    this.view = this.afterDeploy;
  }

  cancel(): void {
    this.view = this.codeFixed ? "failed" : "fresh";
  }

  platformApproved(): void {
    if (this.view === "approval") this.view = "publish";
  }

  publish(): void {
    if (this.view === "publish") this.view = "live";
  }

  rollback(): void {
    if (this.view === "live") this.view = "publish";
  }

  toPanelState(): PanelState {
    return {
      stubbed: true,
      ...snapshot(this.view, this.attempt),
      attempt: this.attempt,
      maxAttempts: 3,
      agentPrompt: AGENT_PROMPT,
    };
  }
}

export const STUB_VIEWS: PanelView[] = [
  "fresh",
  "deploying",
  "failed",
  "approval",
  "publish",
  "live",
];
