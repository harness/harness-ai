import type { EnvCard, PanelState, PanelView, StageItem, Telemetry } from './types';

const APP = 'invoice-reconciler';
const REPO = 'acme/invoice-reconciler';
const PROJECT_ID = 'prj_8f21c4';
const PREVIEW_URL = 'https://invoice-reconciler--preview.apps.harness.io';
const PROD_URL = 'https://invoices.acme.com';
const CONSOLE_URL = 'https://app.harness.io/#/vibe/apps/prj_8f21c4';

const AGENT_PROMPT = `Fix this Harness Vibe build failure (stubbed status from the sidebar).

Application: invoice-reconciler
Failure: 2 type errors in src/App.tsx
Production is untouched and still serving v0.4.1.

src/App.tsx:18:44 — error TS2345
  Argument of type 'number | undefined' is not assignable to parameter of type 'number'.

src/App.tsx:22:24 — error TS2322
  Type 'string[] | undefined' is not assignable to type 'string[]'.

Found 2 errors. exit 1

Likely cause: commit a91c40e refactor: totals via reduce
  src/App.tsx        +9 −4
  src/api/ledger.ts  +2 −0
The reduce refactor made totals values number | undefined, and formatDelta takes number.

Please:
1. Inspect src/App.tsx around lines 18 and 22.
2. Make the smallest appropriate fix.
3. Package / typecheck.
4. Come back to the Harness Vibe sidebar and use Retry build.
`;

function env(
  name: EnvCard['name'],
  state: string,
  meta: string,
  tone: EnvCard['tone'],
  openable: boolean,
): EnvCard {
  return { name, state, meta, tone, openable };
}

function stages(
  codes: Array<['done' | 'active' | 'failed' | 'held' | 'pending', string]>,
  includeProd: boolean,
): StageItem[] {
  const defs: Array<[string, string]> = [
    ['Build', 'image · tests · types'],
    ['Provision', 'cloud infra'],
    ['Checks', 'policy · security'],
    ['Preview', 'url · tls'],
  ];
  if (includeProd) defs.push(['Production', 'canary → full']);
  return codes.map(([status, time], index) => {
    const def = defs[index] ?? ['Production', 'canary → full'];
    const meta =
      status === 'pending'
        ? ''
        : status === 'failed'
          ? 'exit 1 · 2 type errors'
          : status === 'held'
            ? 'awaiting Platform team'
            : def[1];
    return { name: def[0], meta, time, status };
  });
}

function snapshot(view: PanelView, attempt: number): Omit<PanelState, 'stubbed' | 'attempt' | 'maxAttempts' | 'agentPrompt'> {
  const base = {
    appName: APP,
    repo: REPO,
    consoleUrl: CONSOLE_URL,
    failureFile: null as string | null,
    failureLine: null as number | null,
    appId: null as string | null,
    executionId: null as string | null,
  };

  if (view === 'fresh') {
    return {
      ...base,
      view,
      managed: false,
      projectId: 'no project id',
      previewUrl: null,
      productionUrl: null,
      envs: [
        env('preview', 'not deployed', '—', 'idle', false),
        env('production', 'not deployed', '—', 'idle', false),
      ],
      hero: {
        tone: 'vibe',
        eyebrow: '',
        title: 'Deploy this repo with Vibe',
        body: 'Harness has no project for this repository. The first deploy creates one and applies the Vibe template your team is on.',
        progress: false,
        rows: [
          { k: 'template', v: 'vibe-payments-v4 (Payments)' },
          { k: 'you get', v: 'preview url · 7d ttl · $40 cap' },
          { k: 'enforces', v: '4 policies · 2 approval gates' },
        ],
        actions: [
          { id: 'deploy', label: 'Deploy to preview', primary: true },
          { id: 'seeEnforces', label: 'See what it enforces', primary: false },
        ],
        foot: 'Nothing is created until you deploy. Your code is not uploaded before then.',
      },
      errorBlocks: null,
      stages: null,
      stageLabel: '',
      stageMeta: '',
      telemetry: null,
      footLeft: 'harness-vibe MCP · connected',
      footRight: 'signed in as p.rao',
    };
  }

  if (view === 'deploying') {
    return {
      ...base,
      view,
      managed: true,
      projectId: PROJECT_ID,
      previewUrl: null,
      productionUrl: null,
      envs: [
        env('preview', 'deploying', 'stage 1 of 4', 'info', false),
        env('production', 'not deployed', '—', 'idle', false),
      ],
      hero: {
        tone: 'info',
        eyebrow: 'Deploying · 2m 41s',
        title: 'Building your application',
        body: 'Runs on Harness, not on your machine. Close Cursor and it keeps going.',
        progress: true,
        rows: [
          { k: 'run', v: 'vibe-run-8f21c4' },
          { k: 'commit', v: 'a91c40e · main' },
        ],
        actions: [
          { id: 'streamLogs', label: 'Stream logs', primary: false },
          { id: 'cancel', label: 'Cancel run', primary: false },
        ],
        foot: '',
      },
      errorBlocks: null,
      stages: stages(
        [
          ['active', '1:24'],
          ['pending', ''],
          ['pending', ''],
          ['pending', ''],
        ],
        false,
      ),
      stageLabel: 'Stages',
      stageMeta: '1 of 4',
      telemetry: null,
      footLeft: 'watching run vibe-run-8f21c4',
      footRight: 'vibe-payments-v4',
    };
  }

  if (view === 'failed') {
    return {
      ...base,
      view,
      managed: true,
      projectId: PROJECT_ID,
      previewUrl: null,
      productionUrl: PROD_URL,
      failureFile: 'src/App.tsx',
      failureLine: 18,
      envs: [
        env('preview', 'build failed', 'nothing deployed', 'err', false),
        env('production', 'live', 'v0.4.1 · healthy', 'ok', true),
      ],
      hero: {
        tone: 'err',
        eyebrow: 'Build failed · stage 1 of 4',
        title: '2 type errors in src/App.tsx',
        body: 'Nothing was deployed and no infrastructure was created. Production is untouched and still serving v0.4.1.',
        progress: false,
        rows: [],
        actions: [
          { id: 'askAgent', label: 'Fix with agent', primary: true, ai: true },
          { id: 'retry', label: 'Retry build', primary: false },
        ],
        foot: 'Fix with agent pulls the full failure context into chat, then proposes a patch you review in the diff view.',
      },
      errorBlocks: null,
      stages: stages(
        [
          ['failed', '1:31'],
          ['pending', ''],
          ['pending', ''],
          ['pending', ''],
        ],
        false,
      ),
      stageLabel: 'Stages',
      stageMeta: 'halted at 1',
      telemetry: null,
      footLeft: '2 diagnostics written to Problems',
      footRight: `attempt ${attempt} of 3`,
    };
  }

  if (view === 'approval') {
    return {
      ...base,
      view,
      managed: true,
      projectId: PROJECT_ID,
      previewUrl: PREVIEW_URL,
      productionUrl: PROD_URL,
      envs: [
        env('preview', 'live', '6d left · $1.42', 'ok', true),
        env('production', 'awaiting approval', 'held 4m', 'warn', false),
      ],
      hero: {
        tone: 'warn',
        eyebrow: 'Held · release checks',
        title: 'Waiting on Platform team',
        body: 'All four policy checks passed. One human gate remains before production, and it is not yours to grant.',
        progress: false,
        rows: [
          { k: 'approvers', v: 'Platform team · 3 members' },
          { k: 'required by', v: 'template vibe-payments-v4' },
          { k: 'expires', v: 'in 20h if undecided' },
        ],
        actions: [
          { id: 'openConsole', label: 'Open in console', primary: true },
          { id: 'nudgeApprovers', label: 'Nudge approvers', primary: false },
        ],
        foot: 'Keep working. The panel resumes the run the moment it is decided, whether or not this window is open.',
      },
      errorBlocks: null,
      stages: stages(
        [
          ['done', '1:38'],
          ['done', '2:02'],
          ['done', '1:07'],
          ['done', '0:19'],
          ['held', ''],
        ],
        true,
      ),
      stageLabel: 'Stages',
      stageMeta: '4 done · 1 held',
      telemetry: null,
      footLeft: 'watching approval.decided',
      footRight: 'requested 4m ago',
    };
  }

  if (view === 'publish') {
    return {
      ...base,
      view,
      managed: true,
      projectId: PROJECT_ID,
      previewUrl: PREVIEW_URL,
      productionUrl: PROD_URL,
      envs: [
        env('preview', 'live', 'v0.4.2 · healthy', 'ok', true),
        env('production', 'live', 'v0.4.1 · 2d ago', 'ok', true),
      ],
      hero: {
        tone: 'ok',
        eyebrow: 'Approved 2m ago · all checks green',
        title: 'Publish v0.4.2 to production',
        body: 'Canary at 10% for 15 minutes, then full rollout. Automatic rollback if error rate or latency breach the guardrails.',
        progress: false,
        rows: [
          { k: 'approved by', v: 'd.mehta · Platform team' },
          { k: 'guardrails', v: 'errors < 0.5% · p95 < 150ms' },
          { k: 'rollback', v: 'one step to v0.4.1' },
        ],
        actions: [
          { id: 'publish', label: 'Publish to production', primary: true },
          { id: 'reviewChanges', label: 'Review changes', primary: false },
        ],
        foot: 'Rollback is Harness-side and does not need this window open.',
      },
      errorBlocks: null,
      stages: stages(
        [
          ['done', '1:38'],
          ['done', '2:02'],
          ['done', '1:07'],
          ['done', '0:19'],
          ['pending', ''],
        ],
        true,
      ),
      stageLabel: 'Stages',
      stageMeta: 'preview green',
      telemetry: null,
      footLeft: 'ready · vibe-run-8f21c4',
      footRight: 'v0.4.2 · a91c40e',
    };
  }

  const telemetry: Telemetry = {
    host: 'invoices.acme.com',
    stats: [
      { value: '1,284', label: 'active users', tone: 'idle' },
      { value: '92 ms', label: 'p95 latency', tone: 'idle' },
      { value: '0.01%', label: 'error rate', tone: 'ok' },
    ],
    buildTag: 'v0.4.2',
    buildMsg: 'refactor: totals via reduce',
    buildMeta: 'a91c40e · deployed 2h ago by you · rolled out in 14m',
    rollbackLabel: 'Roll back to v0.4.1',
    history: [
      { msg: 'v0.4.2  refactor: totals via reduce', meta: 'deployed · 14m rollout', when: '2h', tone: 'ok' },
      { msg: 'v0.4.1  fix: variance rounding', meta: 'deployed', when: '2d', tone: 'idle' },
      { msg: 'v0.4.0  feat: multi-currency ledger', meta: 'rolled back after 6m', when: '4d', tone: 'warn' },
    ],
  };

  return {
    ...base,
    view: 'live',
    managed: true,
    projectId: PROJECT_ID,
    previewUrl: null,
    productionUrl: PROD_URL,
    envs: [
      env('preview', 'torn down', 'on merge', 'idle', false),
      env('production', 'live', 'v0.4.2 · healthy', 'ok', true),
    ],
    hero: null,
    errorBlocks: null,
    stages: null,
    stageLabel: '',
    stageMeta: '',
    telemetry,
    footLeft: 'production healthy · 6 days green',
    footRight: '$18.40 / mo',
  };
}

export class StubStore {
  view: PanelView = 'failed';
  codeFixed = false;
  attempt = 1;
  afterDeploy: Extract<PanelView, 'failed' | 'approval'> = 'failed';

  reset(): void {
    this.view = 'failed';
    this.codeFixed = false;
    this.attempt = 1;
    this.afterDeploy = 'failed';
  }

  setView(view: PanelView): void {
    this.view = view;
    if (view === 'failed') this.attempt = 1;
    if (view === 'fresh') this.codeFixed = false;
  }

  markCodeFixed(): void {
    this.codeFixed = true;
  }

  deploy(): 'replay' | 'stay' {
    if (this.view !== 'fresh' && this.view !== 'failed') return 'stay';
    this.afterDeploy = this.view === 'fresh' || this.codeFixed ? 'approval' : 'failed';
    this.view = 'deploying';
    return 'replay';
  }

  retry(): 'replay' | 'stay' {
    if (this.view !== 'failed') return 'stay';
    if (!this.codeFixed) {
      this.attempt = Math.min(this.attempt + 1, 3);
      return 'stay';
    }
    this.afterDeploy = 'approval';
    this.view = 'deploying';
    return 'replay';
  }

  finishDeploy(): void {
    this.view = this.afterDeploy;
  }

  cancel(): void {
    this.view = this.codeFixed ? 'failed' : 'fresh';
  }

  platformApproved(): void {
    if (this.view === 'approval') this.view = 'publish';
  }

  publish(): void {
    if (this.view === 'publish') this.view = 'live';
  }

  rollback(): void {
    if (this.view === 'live') this.view = 'publish';
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

export const STUB_VIEWS: PanelView[] = ['fresh', 'deploying', 'failed', 'approval', 'publish', 'live'];
