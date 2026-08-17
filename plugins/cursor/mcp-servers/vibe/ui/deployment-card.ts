import type { AppMetrics, DeploymentView } from '../src/ui-view';

export type DeploymentCardView =
  | 'failed'
  | 'deploying'
  | 'approval'
  | 'publish'
  | 'live'
  | 'cancelled';

export type EnvTone = 'idle' | 'info' | 'ok' | 'warn' | 'err';
export type StageRailStatus = 'done' | 'active' | 'failed' | 'held' | 'pending';

export interface EnvTileView {
  name: 'preview' | 'production';
  state: string;
  meta: string;
  tone: EnvTone;
  url?: string | null;
}

export interface StageRailItem {
  name: string;
  meta: string;
  time: string;
  status: StageRailStatus;
}

export interface HeroRow {
  k: string;
  v: string;
}

const STAGE_GROUPS: Array<{ name: string; keys: string[]; meta: string }> = [
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

function stageStatus(deployment: DeploymentView, key: string): string | undefined {
  return deployment.stages.find((stage) => stage.key === key)?.status;
}

export function isDeploymentRunning(deployment: DeploymentView): boolean {
  return (
    deployment.status === 'running' ||
    deployment.status === 'queued' ||
    deployment.stages.some((stage) => stage.status === 'processing')
  );
}

export function isDeploymentCancelled(deployment: DeploymentView): boolean {
  return (
    deployment.status === 'canceled' ||
    deployment.status === 'cancelled' ||
    deployment.stages.some((stage) => stage.status === 'skipped' && stage.summary === 'Canceled')
  );
}

export function deriveDeploymentCardView(deployment: DeploymentView): DeploymentCardView {
  const productionLive =
    deployment.appStatus === 'published' ||
    Boolean(
      deployment.productionUrl &&
        (deployment.status === 'succeeded' || deployment.appStatus === 'published'),
    );
  if (productionLive) return 'live';

  if (isDeploymentCancelled(deployment) && !deployment.failure) return 'cancelled';

  const failed =
    deployment.status === 'failed' ||
    deployment.appStatus === 'failed' ||
    Boolean(deployment.failure) ||
    deployment.stages.some((stage) => stage.status === 'failed');
  if (failed) return 'failed';

  const running = isDeploymentRunning(deployment);
  if (running) return 'deploying';

  const held =
    deployment.status === 'paused' ||
    deployment.appStatus === 'awaiting_approval' ||
    deployment.approvalStatus === 'pending' ||
    stageStatus(deployment, 'approval_gate') === 'paused' ||
    deployment.stages.some((stage) => stage.status === 'paused');
  if (held) return 'approval';

  const readyToPublish =
    deployment.appStatus === 'approved' ||
    deployment.appStatus === 'preview_ready' ||
    (Boolean(deployment.previewUrl) && !deployment.productionUrl);
  if (readyToPublish) return 'publish';

  if (deployment.status === 'succeeded') return 'publish';

  return 'deploying';
}

export const CARD_VIEW_LABEL: Record<DeploymentCardView, string> = {
  failed: 'Build failed',
  deploying: 'Deploying',
  approval: 'Awaiting approval',
  publish: 'Ready to publish',
  live: 'Live in production',
  cancelled: 'Run cancelled',
};

function deriveGroupStatus(
  stages: Array<{ status: string }>,
): StageRailStatus {
  if (!stages.length) return 'pending';
  if (stages.some((stage) => stage.status === 'failed')) return 'failed';
  if (stages.some((stage) => stage.status === 'paused')) return 'held';
  if (stages.some((stage) => stage.status === 'processing')) return 'active';
  if (stages.every((stage) => stage.status === 'completed' || stage.status === 'skipped')) {
    return 'done';
  }
  if (stages.some((stage) => stage.status === 'completed' || stage.status === 'skipped')) {
    return 'active';
  }
  return 'pending';
}

export function groupStages(deployment: DeploymentView): StageRailItem[] {
  const byKey = new Map(deployment.stages.map((stage) => [stage.key, stage]));
  const groups = STAGE_GROUPS.map((group) => {
    const members = group.keys
      .map((key) => byKey.get(key))
      .filter((stage): stage is NonNullable<typeof stage> => Boolean(stage));
    const status = deriveGroupStatus(members);
    const active = members.find(
      (stage) => stage?.status === 'processing' || stage?.status === 'paused',
    );
    const failed = members.find((stage) => stage?.status === 'failed');
    const meta =
      failed?.summary ??
      active?.summary ??
      members.find((stage) => stage?.summary)?.summary ??
      (status === 'pending' ? '' : group.meta);
    return { name: group.name, meta: meta ?? '', time: '', status };
  });

  const known = new Set(STAGE_GROUPS.flatMap((group) => group.keys));
  for (const stage of deployment.stages) {
    if (known.has(stage.key)) continue;
    groups.push({
      name: stage.label,
      meta: stage.summary ?? '',
      time: '',
      status: deriveGroupStatus([stage]),
    });
  }
  return groups;
}

export function stageMetaSummary(stages: StageRailItem[]): string {
  if (!stages.length) return '';
  const done = stages.filter((stage) => stage.status === 'done').length;
  const failed = stages.find((stage) => stage.status === 'failed');
  const active = stages.find((stage) => stage.status === 'active');
  const held = stages.find((stage) => stage.status === 'held');
  if (failed) return `halted at ${stages.indexOf(failed) + 1}`;
  if (held) return `${done} done · 1 held`;
  if (active) return `${stages.indexOf(active) + 1} of ${stages.length}`;
  if (done === stages.length) return 'all complete';
  return `${done} of ${stages.length}`;
}

function hostFromUrl(url: string | null | undefined): string {
  if (!url) return '—';
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function envTiles(
  cardView: DeploymentCardView,
  deployment: DeploymentView,
): EnvTileView[] {
  const previewUrl = deployment.previewUrl ?? null;
  const productionUrl = deployment.productionUrl ?? null;
  switch (cardView) {
    case 'deploying':
      return [
        { name: 'preview', state: 'deploying', meta: stageMetaSummary(groupStages(deployment)), tone: 'info' },
        { name: 'production', state: 'not deployed', meta: '—', tone: 'idle' },
      ];
    case 'failed':
      return [
        { name: 'preview', state: 'build failed', meta: 'nothing deployed', tone: 'err' },
        {
          name: 'production',
          state: productionUrl ? 'live' : 'not deployed',
          meta: productionUrl ? hostFromUrl(productionUrl) : '—',
          tone: productionUrl ? 'ok' : 'idle',
          url: productionUrl,
        },
      ];
    case 'approval':
      return [
        {
          name: 'preview',
          state: 'live',
          meta: previewUrl ? hostFromUrl(previewUrl) : 'ready',
          tone: 'ok',
          url: previewUrl,
        },
        { name: 'production', state: 'awaiting approval', meta: 'held', tone: 'warn' },
      ];
    case 'publish':
      return [
        {
          name: 'preview',
          state: 'live',
          meta: previewUrl ? hostFromUrl(previewUrl) : 'healthy',
          tone: 'ok',
          url: previewUrl,
        },
        {
          name: 'production',
          state: productionUrl ? 'live' : 'ready',
          meta: productionUrl ? hostFromUrl(productionUrl) : 'awaiting publish',
          tone: productionUrl ? 'ok' : 'warn',
          url: productionUrl,
        },
      ];
    case 'cancelled':
      return [
        { name: 'preview', state: 'cancelled', meta: 'run stopped', tone: 'idle' },
        {
          name: 'production',
          state: productionUrl ? 'live' : 'not deployed',
          meta: productionUrl ? hostFromUrl(productionUrl) : '—',
          tone: productionUrl ? 'ok' : 'idle',
          url: productionUrl,
        },
      ];
    case 'live':
      return [
        {
          name: 'preview',
          state: previewUrl ? 'live' : 'torn down',
          meta: previewUrl ? hostFromUrl(previewUrl) : '—',
          tone: previewUrl ? 'ok' : 'idle',
          url: previewUrl,
        },
        {
          name: 'production',
          state: 'live',
          meta: productionUrl ? hostFromUrl(productionUrl) : 'healthy',
          tone: 'ok',
          url: productionUrl,
        },
      ];
  }
}

export function heroCopy(cardView: DeploymentCardView, deployment: DeploymentView): {
  eyebrow: string;
  title: string;
  body: string;
  progress: boolean;
  rows: HeroRow[];
  foot: string;
} {
  const fail = deployment.failure;
  const failedStage = groupStages(deployment).find((stage) => stage.status === 'failed');
  switch (cardView) {
    case 'deploying':
      return {
        eyebrow: 'Deploying',
        title: 'Building your application',
        body: 'Runs on Harness, not on your machine. Close Cursor and it keeps going.',
        progress: true,
        rows: [
          { k: 'run', v: deployment.executionId },
          { k: 'status', v: deployment.status },
        ],
        foot: '',
      };
    case 'failed':
      return {
        eyebrow: failedStage ? `Build failed · ${failedStage.name}` : 'Build failed',
        title: fail?.summary ?? failedStage?.meta ?? 'Deployment failed',
        body: deployment.productionUrl
          ? `Production is still serving ${hostFromUrl(deployment.productionUrl)}.`
          : 'Nothing was deployed and no infrastructure was created.',
        progress: false,
        rows: fail?.file
          ? [{ k: 'file', v: `${fail.file}${fail.line ? `:${fail.line}` : ''}` }]
          : [],
        foot: 'Accept fix sends the instruction back to the agent so it can patch and redeploy.',
      };
    case 'approval':
      return {
        eyebrow: 'Held · release checks',
        title: 'Waiting on approval',
        body: 'Policy checks passed. A human gate remains before production.',
        progress: false,
        rows: [
          { k: 'status', v: deployment.approvalStatus ?? 'pending' },
          { k: 'preview', v: deployment.previewUrl ?? 'ready' },
        ],
        foot: 'The card resumes when approval is decided.',
      };
    case 'publish':
      return {
        eyebrow: 'Approved · checks green',
        title: 'Publish to production',
        body: 'Preview is ready. Publish when you want this build in production.',
        progress: false,
        rows: [
          { k: 'preview', v: deployment.previewUrl ?? 'ready' },
          {
            k: 'rollback',
            v: deployment.productionUrl ? `current ${hostFromUrl(deployment.productionUrl)}` : 'none',
          },
        ],
        foot: 'Rollback is available from the live view after publish.',
      };
    case 'cancelled':
      return {
        eyebrow: 'Cancelled',
        title: 'Run cancelled',
        body: 'This deployment was stopped before it finished. Production was not changed.',
        progress: false,
        rows: [{ k: 'run', v: deployment.executionId }],
        foot: 'Redeploy to start a new revision.',
      };
    case 'live':
      return {
        eyebrow: 'Live in production',
        title: deployment.applicationName,
        body: 'Production is live. Roll back from here if you need to revert.',
        progress: false,
        rows: [
          { k: 'host', v: hostFromUrl(deployment.productionUrl ?? deployment.previewUrl) },
          { k: 'run', v: deployment.executionId },
        ],
        foot: '',
      };
  }
}

export function metricStats(metrics: AppMetrics | null | undefined): Array<{
  label: string;
  value: string;
  ok: boolean;
}> {
  if (!metrics) return [];
  return [
    { label: 'Visitors (24h)', value: String(metrics.visitors), ok: true },
    { label: 'Requests / min', value: String(metrics.requestsPerMin), ok: true },
    { label: 'Avg latency (ms)', value: String(metrics.latencyMs), ok: metrics.latencyMs < 400 },
    { label: 'Errors (24h)', value: String(metrics.errors), ok: metrics.errors === 0 },
  ];
}
