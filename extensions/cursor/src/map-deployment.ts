import type { App, StageKey, VibeDeployment, VibeDeploymentStage } from './api-types';
import type { EnvCard, PanelState, PanelView, StageItem, StageStatus, Telemetry } from './types';

const CONSOLE_BASE = 'https://app.harness.io/#/vibe/apps';

const STAGE_GROUPS: Array<{ name: string; keys: StageKey[]; meta: string }> = [
  { name: 'Build', keys: ['source_import', 'app_discovery', 'app_build'], meta: 'image · tests · types' },
  { name: 'Provision', keys: ['infra_provision'], meta: 'cloud infra' },
  { name: 'Checks', keys: ['security_compliance'], meta: 'policy · security' },
  { name: 'Preview', keys: ['preview_deploy'], meta: 'url · tls' },
  {
    name: 'Production',
    keys: ['approval_gate', 'production_deploy', 'monitoring'],
    meta: 'canary → full',
  },
];

function env(
  name: EnvCard['name'],
  state: string,
  meta: string,
  tone: EnvCard['tone'],
  openable: boolean,
): EnvCard {
  return { name, state, meta, tone, openable };
}

function formatElapsed(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function stageDuration(stage: VibeDeploymentStage): string {
  if (!stage.startedAt) return '';
  const start = Date.parse(stage.startedAt);
  const end = stage.finishedAt ? Date.parse(stage.finishedAt) : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return '';
  return formatElapsed(Math.max(0, Math.round((end - start) / 1000)));
}

function groupStages(deployment: VibeDeployment): StageItem[] {
  const byKey = new Map(deployment.stages.map((stage) => [stage.key, stage]));
  return STAGE_GROUPS.map((group) => {
    const members = group.keys.map((key) => byKey.get(key)).filter(Boolean) as VibeDeploymentStage[];
    const status = deriveGroupStatus(members);
    const active = members.find((stage) => stage.status === 'processing' || stage.status === 'paused');
    const failed = members.find((stage) => stage.status === 'failed');
    const meta =
      failed?.failure?.summary ??
      failed?.summary ??
      active?.summary ??
      members.find((stage) => stage.summary)?.summary ??
      (status === 'pending' ? '' : group.meta);
    const time =
      failed?.finishedAt
        ? stageDuration(failed)
        : active
          ? stageDuration(active)
          : members.find((stage) => stage.finishedAt)
            ? stageDuration(members.find((stage) => stage.finishedAt)!)
            : '';
    return { name: group.name, meta, time, status };
  });
}

function deriveGroupStatus(stages: VibeDeploymentStage[]): StageStatus {
  if (!stages.length) return 'pending';
  if (stages.some((stage) => stage.status === 'failed')) return 'failed';
  if (stages.some((stage) => stage.status === 'paused')) return 'held';
  if (stages.some((stage) => stage.status === 'processing')) return 'active';
  if (stages.every((stage) => stage.status === 'completed' || stage.status === 'skipped')) return 'done';
  if (stages.some((stage) => stage.status === 'completed' || stage.status === 'skipped')) return 'active';
  return 'pending';
}

function stageMetaSummary(stages: StageItem[] | null): { label: string; meta: string } {
  if (!stages?.length) return { label: '', meta: '' };
  const done = stages.filter((stage) => stage.status === 'done').length;
  const failed = stages.find((stage) => stage.status === 'failed');
  const active = stages.find((stage) => stage.status === 'active');
  const held = stages.find((stage) => stage.status === 'held');
  if (failed) {
    const index = stages.indexOf(failed) + 1;
    return { label: 'Stages', meta: `halted at ${index}` };
  }
  if (held) return { label: 'Stages', meta: `${done} done · 1 held` };
  if (active) {
    const index = stages.indexOf(active) + 1;
    return { label: 'Stages', meta: `${index} of ${stages.length}` };
  }
  if (done === stages.length) return { label: 'Stages', meta: 'all complete' };
  return { label: 'Stages', meta: `${done} of ${stages.length}` };
}

export function derivePanelView(app: App, deployment: VibeDeployment): PanelView {
  const productionLive = app.status === 'published' || Boolean(app.productionUrl && deployment.status === 'succeeded');
  if (productionLive) return 'live';

  const failed =
    deployment.status === 'failed' ||
    app.status === 'failed' ||
    Boolean(deployment.failure) ||
    deployment.stages.some((stage) => stage.status === 'failed');
  if (failed) return 'failed';

  const running =
    deployment.status === 'running' ||
    deployment.status === 'queued' ||
    deployment.stages.some((stage) => stage.status === 'processing');
  if (running) return 'deploying';

  const held =
    deployment.status === 'paused' ||
    app.status === 'awaiting_approval' ||
    app.approvalStatus === 'pending' ||
    deployment.stages.some((stage) => stage.status === 'paused');
  if (held) return 'approval';

  const readyToPublish =
    app.status === 'approved' ||
    app.status === 'preview_ready' ||
    (Boolean(app.previewUrl) && !app.productionUrl);
  if (readyToPublish) return 'publish';

  return 'deploying';
}

function repoLabel(app: App | null, workspacePath: string | null): string {
  if (app?.repoUrl?.startsWith('file://') && workspacePath) {
    return workspaceFolderBasename(workspacePath);
  }
  if (app?.repoUrl) {
    const raw = app.repoUrl.replace(/^file:\/\//, '');
    const parts = raw.split('/').filter(Boolean);
    return parts.slice(-2).join('/') || app.slug;
  }
  if (workspacePath) return workspaceFolderBasename(workspacePath);
  return 'local workspace';
}

function workspaceFolderBasename(workspacePath: string): string {
  const parts = workspacePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? 'workspace';
}

function consoleUrl(appId: string): string {
  return `${CONSOLE_BASE}/${appId}`;
}

function hostFromUrl(url: string | null | undefined): string {
  if (!url) return 'production';
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function buildTelemetry(app: App, deployment: VibeDeployment): Telemetry | null {
  const stats = [];
  if (app.previewUrl) {
    stats.push({ value: 'preview', label: 'environment', tone: 'idle' as const });
  }
  if (app.productionUrl) {
    stats.push({ value: 'live', label: 'production', tone: 'ok' as const });
  }
  if (!stats.length) {
    stats.push({ value: deployment.status, label: 'deployment', tone: 'idle' as const });
  }

  return {
    host: hostFromUrl(app.productionUrl ?? app.previewUrl),
    stats,
    buildTag: app.slug,
    buildMsg: deployment.applicationName,
    buildMeta: `${deployment.executionId} · ${deployment.status}`,
    rollbackLabel: 'Roll back production',
    history: [],
  };
}

export function buildAgentPrompt(
  instruction: string,
  failure?: { file?: string | null; line?: number | null; logLines?: string[]; message?: string },
): string {
  const lines = [instruction.trim()];
  if (failure?.file) {
    lines.push('', `Failure location: ${failure.file}${failure.line ? `:${failure.line}` : ''}`);
  }
  if (failure?.message) {
    lines.push('', failure.message);
  }
  const logLines = failure?.logLines?.filter(Boolean) ?? [];
  if (logLines.length) {
    lines.push('', 'Log excerpt:', ...logLines.slice(-20));
  }
  return lines.join('\n');
}

export function mapDisconnected(apiBaseUrl: string): PanelState {
  return {
    stubbed: true,
    disconnected: true,
    view: 'fresh',
    appName: 'Vibe',
    managed: false,
    repo: '—',
    projectId: 'no project id',
    previewUrl: null,
    productionUrl: null,
    consoleUrl: apiBaseUrl,
    envs: [
      env('preview', 'unavailable', '—', 'idle', false),
      env('production', 'unavailable', '—', 'idle', false),
    ],
    hero: {
      tone: 'err',
      eyebrow: 'Disconnected',
      title: `Can't reach vibe-api`,
      body: `Harness Vibe could not connect to ${apiBaseUrl}. Start vibe-api locally or update harness.vibe.apiBaseUrl / VIBE_API_BASE_URL.`,
      progress: false,
      rows: [],
      actions: [{ id: 'refresh', label: 'Retry connection', primary: true }],
      foot: '',
    },
    errorBlocks: null,
    stages: null,
    stageLabel: '',
    stageMeta: '',
    telemetry: null,
    footLeft: 'vibe-api unreachable',
    footRight: apiBaseUrl,
    failureFile: null,
    failureLine: null,
    attempt: 1,
    maxAttempts: 3,
    agentPrompt: '',
    appId: null,
    executionId: null,
  };
}

export function mapFresh(workspacePath: string | null): PanelState {
  const folder = workspacePath ? workspaceFolderBasename(workspacePath) : 'this workspace';
  return {
    stubbed: true,
    view: 'fresh',
    appName: folder,
    managed: false,
    repo: folder,
    projectId: 'no project id',
    previewUrl: null,
    productionUrl: null,
    consoleUrl: CONSOLE_BASE,
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
        { k: 'workspace', v: folder },
        { k: 'you get', v: 'preview url · managed deploy' },
        { k: 'source', v: 'zip from this folder' },
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
    footLeft: 'harness-vibe · local',
    footRight: 'not managed',
    failureFile: null,
    failureLine: null,
    attempt: 1,
    maxAttempts: 3,
    agentPrompt: '',
    appId: null,
    executionId: null,
  };
}

export function mapDeploymentToPanelState(
  app: App,
  deployment: VibeDeployment,
  workspacePath: string | null,
): PanelState {
  const view = derivePanelView(app, deployment);
  const stages = groupStages(deployment);
  const stageSummary = stageMetaSummary(stages);
  const previewUrl = deployment.previewUrl ?? app.previewUrl ?? null;
  const productionUrl = app.productionUrl ?? null;
  const failure = deployment.failure;
  const attempt = failure?.attempt ?? 1;
  const maxAttempts = failure?.maxAttempts ?? 3;
  const agentPrompt = buildAgentPrompt(
    failure?.agentInstruction ?? failure?.suggestion ?? deployment.requestedAction ?? 'Fix the Vibe deployment failure.',
    failure
      ? {
          file: failure.file,
          line: failure.line,
          logLines: failure.logLines,
          message: failure.summary,
        }
      : undefined,
  );

  const base = {
    stubbed: true as const,
    appName: app.name,
    managed: true,
    repo: repoLabel(app, workspacePath),
    projectId: app.projectId ?? app.id,
    previewUrl,
    productionUrl,
    consoleUrl: consoleUrl(app.id),
    failureFile: failure?.file ?? null,
    failureLine: failure?.line ?? null,
    attempt,
    maxAttempts,
    agentPrompt,
    appId: app.id,
    executionId: deployment.executionId,
    errorBlocks: null,
    disconnected: false,
  };

  if (view === 'deploying') {
    const activeIndex = stages.findIndex((stage) => stage.status === 'active') + 1 || 1;
    return {
      ...base,
      view,
      envs: [
        env('preview', 'deploying', `stage ${activeIndex} of ${stages.length}`, 'info', false),
        env('production', 'not deployed', '—', 'idle', false),
      ],
      hero: {
        tone: 'info',
        eyebrow: 'Deploying',
        title: 'Building your application',
        body: 'Runs on Harness, not on your machine. Close Cursor and it keeps going.',
        progress: true,
        rows: [
          { k: 'run', v: deployment.executionId },
          { k: 'status', v: deployment.status },
        ],
        actions: [
          { id: 'streamLogs', label: 'Stream logs', primary: false },
          { id: 'cancel', label: 'Cancel run', primary: false },
        ],
        foot: '',
      },
      stages,
      stageLabel: stageSummary.label,
      stageMeta: stageSummary.meta,
      telemetry: null,
      footLeft: `watching run ${deployment.executionId}`,
      footRight: app.slug,
    };
  }

  if (view === 'failed') {
    const failedStage = stages.find((stage) => stage.status === 'failed');
    const blast =
      productionUrl && app.status !== 'published'
        ? 'Production is untouched.'
        : productionUrl
          ? `Production is still serving ${hostFromUrl(productionUrl)}.`
          : 'Nothing was deployed and no infrastructure was created.';
    return {
      ...base,
      view,
      envs: [
        env('preview', 'build failed', 'nothing deployed', 'err', false),
        env(
          'production',
          productionUrl ? 'live' : 'not deployed',
          productionUrl ? hostFromUrl(productionUrl) : '—',
          productionUrl ? 'ok' : 'idle',
          Boolean(productionUrl),
        ),
      ],
      hero: {
        tone: 'err',
        eyebrow: failedStage ? `Build failed · ${failedStage.name}` : 'Build failed',
        title: failure?.summary ?? failedStage?.meta ?? 'Deployment failed',
        body: blast,
        progress: false,
        rows: [],
        actions: [
          { id: 'askAgent', label: 'Fix with agent', primary: true, ai: true },
          { id: 'retry', label: 'Retry build', primary: false },
        ],
        foot: 'Fix with agent writes VIBE_TASK.md and opens chat with the failure context.',
      },
      stages,
      stageLabel: stageSummary.label,
      stageMeta: stageSummary.meta,
      telemetry: null,
      footLeft: failure?.file ? `failure in ${failure.file}` : 'deployment failed',
      footRight: `attempt ${attempt} of ${maxAttempts}`,
    };
  }

  if (view === 'approval') {
    return {
      ...base,
      view,
      envs: [
        env('preview', 'live', previewUrl ? hostFromUrl(previewUrl) : 'ready', 'ok', Boolean(previewUrl)),
        env('production', 'awaiting approval', 'held', 'warn', false),
      ],
      hero: {
        tone: 'warn',
        eyebrow: 'Held · release checks',
        title: 'Waiting on approval',
        body: 'Policy checks passed. A human gate remains before production.',
        progress: false,
        rows: [
          { k: 'status', v: app.approvalStatus },
          { k: 'preview', v: previewUrl ?? 'ready' },
        ],
        actions: [
          { id: 'openConsole', label: 'Open in console', primary: true },
          { id: 'nudgeApprovers', label: 'Nudge approvers', primary: false },
        ],
        foot: 'The panel resumes when approval is decided.',
      },
      stages,
      stageLabel: stageSummary.label,
      stageMeta: stageSummary.meta,
      telemetry: null,
      footLeft: 'watching approval',
      footRight: app.status,
    };
  }

  if (view === 'publish') {
    return {
      ...base,
      view,
      envs: [
        env('preview', 'live', previewUrl ? hostFromUrl(previewUrl) : 'healthy', 'ok', Boolean(previewUrl)),
        env(
          'production',
          productionUrl ? 'live' : 'ready',
          productionUrl ? hostFromUrl(productionUrl) : 'awaiting publish',
          productionUrl ? 'ok' : 'warn',
          Boolean(productionUrl),
        ),
      ],
      hero: {
        tone: 'ok',
        eyebrow: 'Approved · checks green',
        title: 'Publish to production',
        body: 'Preview is ready. Publish when you want this build in production.',
        progress: false,
        rows: [
          { k: 'preview', v: previewUrl ?? 'ready' },
          { k: 'rollback', v: productionUrl ? `current ${hostFromUrl(productionUrl)}` : 'none' },
        ],
        actions: [
          { id: 'publish', label: 'Publish to production', primary: true },
          { id: 'reviewChanges', label: 'Review changes', primary: false },
        ],
        foot: 'Rollback is available from the live view after publish.',
      },
      stages,
      stageLabel: stageSummary.label,
      stageMeta: stageSummary.meta,
      telemetry: null,
      footLeft: `ready · ${deployment.executionId}`,
      footRight: app.slug,
    };
  }

  return {
    ...base,
    view: 'live',
    hero: null,
    envs: [
      env('preview', previewUrl ? 'live' : 'torn down', previewUrl ? hostFromUrl(previewUrl) : '—', previewUrl ? 'ok' : 'idle', Boolean(previewUrl)),
      env('production', 'live', productionUrl ? hostFromUrl(productionUrl) : 'healthy', 'ok', Boolean(productionUrl)),
    ],
    stages: null,
    stageLabel: '',
    stageMeta: '',
    telemetry: buildTelemetry(app, deployment),
    footLeft: productionUrl ? `${hostFromUrl(productionUrl)} healthy` : 'production live',
    footRight: deployment.status,
  };
}
