import type { AgentSubmissionResponse, DemoPathId, VibeApiApp, VibeDeployment } from './api-client.js';
import type {
  AppMetrics,
  AppUiView,
  AppView,
  DeployFormView,
  DeploymentView,
  LogsView,
} from './ui-view.js';

type AppLike = VibeApiApp;

export function simulatedTraffic(app: Pick<AppLike, 'id' | 'name' | 'health'>): AppMetrics {
  const seed = hashSeed(app.id || app.name);
  const base = 200 + (seed % 800);
  const degraded = app.health === 'degraded';
  const down = app.health === 'down';
  const visitors = down ? Math.round(base * 0.3) : degraded ? Math.round(base * 0.7) : base;
  return {
    visitors,
    requestsPerMin: Math.max(1, Math.round(visitors / 12)),
    latencyMs: down ? 1500 + (seed % 500) : degraded ? 400 + (seed % 200) : 120 + (seed % 80),
    errors: down ? 200 + (seed % 150) : degraded ? 30 + (seed % 40) : seed % 5,
    uptime: down ? 87 : degraded ? 98 : 100,
    simulated: true,
  };
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function liveMetrics(app: AppLike): AppMetrics | null {
  if (app.status !== 'published') return null;
  return simulatedTraffic(app);
}

export function toAppView(app: AppLike): AppView {
  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    description: app.description ?? null,
    owner: app.owner,
    team: app.team ?? null,
    source: app.source,
    status: app.status,
    approvalStatus: app.approvalStatus,
    health: app.health ?? null,
    openIssues: app.openIssues ?? null,
    preferredUrl: app.preferredUrl ?? app.slug,
    enableCdn: app.enableCdn ?? true,
    previewUrl: app.previewUrl ?? null,
    productionUrl: app.productionUrl ?? null,
    repoUrl: app.repoUrl ?? null,
    latestExecutionId: app.latestExecutionId ?? null,
    updatedAt: app.updatedAt,
    metrics: liveMetrics(app),
  };
}

export function toDeploymentView(deployment: VibeDeployment, app?: AppLike): DeploymentView {
  return {
    applicationId: deployment.applicationId,
    applicationName: deployment.applicationName,
    deploymentId: deployment.deploymentId,
    executionId: deployment.executionId,
    status: deployment.status,
    currentStageKey: deployment.currentStageKey,
    stages: deployment.stages.map((stage) => ({
      key: stage.key,
      label: stage.label,
      status: stage.status,
      summary: stage.summary ?? null,
    })),
    failure: deployment.failure
      ? {
          stageKey: deployment.failure.stageKey,
          summary: deployment.failure.summary,
          file: deployment.failure.file ?? null,
          line: deployment.failure.line ?? null,
          logLines: deployment.failure.logLines ?? [],
          agentInstruction:
            deployment.failure.agentInstruction ?? deployment.failure.suggestion ?? null,
        }
      : null,
    previewUrl: deployment.previewUrl ?? app?.previewUrl ?? null,
    productionUrl: app?.productionUrl ?? null,
    appStatus: app?.status ?? null,
    approvalStatus: app?.approvalStatus ?? null,
    requestedAction: deployment.requestedAction ?? null,
    slug: app?.slug ?? null,
    enableCdn: app?.enableCdn ?? null,
    health: app?.health ?? null,
    metrics: app ? liveMetrics(app) : null,
  };
}

export function toLogsView(deployment: VibeDeployment, stageKey?: string): LogsView {
  const stages = stageKey
    ? deployment.stages.filter((stage) => stage.key === stageKey)
    : deployment.stages;
  const lines = stages.flatMap((stage) => [
    ...(stage.logs ?? []),
    ...(stage.failure?.logLines ?? []),
  ]);
  const fromFailure = deployment.failure?.logLines ?? [];
  return {
    applicationName: deployment.applicationName,
    executionId: deployment.executionId,
    stageKey: stageKey ?? deployment.failure?.stageKey ?? deployment.currentStageKey,
    lines: lines.length ? lines : fromFailure.length ? fromFailure : ['(no logs)'],
  };
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'app'
  );
}

export function toDeployFormView(input: {
  name: string;
  slug?: string;
  enableCdn?: boolean;
  appId?: string | null;
  projectId?: string | null;
  path?: DemoPathId | null;
}): DeployFormView {
  return {
    name: input.name,
    slug: input.slug?.trim() || slugify(input.name),
    enableCdn: input.enableCdn ?? true,
    appId: input.appId ?? null,
    projectId: input.projectId ?? null,
    path: input.path ?? null,
  };
}

export function appView(view: AppLike): AppUiView {
  return { kind: 'app', app: toAppView(view) };
}

export function deploymentView(deployment: VibeDeployment, app?: AppLike): AppUiView {
  return { kind: 'deployment', deployment: toDeploymentView(deployment, app) };
}

export function logsView(deployment: VibeDeployment, stageKey?: string): AppUiView {
  return { kind: 'logs', logs: toLogsView(deployment, stageKey) };
}

export function deployFormView(form: DeployFormView): AppUiView {
  return { kind: 'deploy_form', form };
}

/** @deprecated submit cards are replaced by deployment views after confirm. */
export function submitView(response: AgentSubmissionResponse, name?: string): AppUiView {
  return {
    kind: 'deploy_form',
    form: toDeployFormView({
      name: name ?? response.appId,
      appId: response.appId,
    }),
  };
}
