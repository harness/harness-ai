import { fixtureApp, fixtureDeployment, MOCK_APP_ID, MOCK_BUILD_LOGS } from './fixtures.js';
import type { DemoPathId } from './api-client.js';
import { slugify, toDeployFormView } from './mappers.js';
import type { DeployInput, UpdateAppInput, VibeStore } from './vibe-store.js';
import type { AppUiView } from './ui-view.js';

export class MockVibeStore implements VibeStore {
  private app = fixtureApp();
  private deployment = fixtureDeployment('failed');

  async getApp(appId?: string): Promise<AppUiView> {
    this.assertApp(appId);
    return { kind: 'app', app: { ...this.app } };
  }

  async getDeployment(appId?: string, executionId?: string): Promise<AppUiView> {
    this.assertIds(appId, executionId);
    return { kind: 'deployment', deployment: this.deploymentView() };
  }

  private deploymentView() {
    const deployment = structuredClone(this.deployment);
    return {
      ...deployment,
      previewUrl: deployment.previewUrl ?? this.app.previewUrl,
      productionUrl: this.app.productionUrl ?? null,
      appStatus: this.app.status,
      approvalStatus: this.app.approvalStatus,
      slug: this.app.slug,
      enableCdn: this.app.enableCdn,
      health: this.app.health,
      metrics: this.app.metrics ?? null,
    };
  }

  async getLogs(appId?: string, executionId?: string, stageKey?: string): Promise<AppUiView> {
    this.assertIds(appId, executionId);
    const d = this.deployment;
    const fromFailure = d.failure?.logLines ?? [];
    const lines =
      stageKey && d.failure?.stageKey !== stageKey
        ? [`(no logs for ${stageKey})`]
        : fromFailure.length
          ? fromFailure
          : MOCK_BUILD_LOGS;
    return {
      kind: 'logs',
      logs: {
        applicationName: d.applicationName,
        executionId: d.executionId,
        stageKey: stageKey ?? d.failure?.stageKey ?? d.currentStageKey,
        lines: lines.length ? lines : ['(no logs)'],
      },
    };
  }

  async deploy(input: DeployInput): Promise<AppUiView> {
    if (!input.confirm) {
      const name = input.name ?? this.app.name;
      return {
        kind: 'deploy_form',
        form: toDeployFormView({
          name,
          slug: input.slug ?? this.app.slug ?? slugify(name),
          enableCdn: input.enableCdn ?? this.app.enableCdn,
          appId: input.appId ?? MOCK_APP_ID,
          projectId: input.projectId,
          path: input.path,
        }),
      };
    }
    this.deployment = fixtureDeployment('succeeded');
    if (input.name) {
      this.deployment.applicationName = input.name;
      this.app.name = input.name;
    }
    if (input.slug) this.app.slug = input.slug;
    if (input.enableCdn !== undefined) this.app.enableCdn = input.enableCdn;
    this.app.status = 'preview_ready';
    this.app.previewUrl = this.deployment.previewUrl ?? null;
    this.app.latestExecutionId = this.deployment.executionId;
    return this.getDeployment(input.appId ?? MOCK_APP_ID, this.deployment.executionId);
  }

  async retry(appId?: string, executionId?: string): Promise<AppUiView> {
    this.assertIds(appId, executionId);
    this.deployment = fixtureDeployment('succeeded');
    this.deployment.requestedAction = 'Retry finished (mock).';
    this.app.status = 'preview_ready';
    this.app.previewUrl = this.deployment.previewUrl ?? null;
    this.app.latestExecutionId = this.deployment.executionId;
    return this.getDeployment();
  }

  async cancel(appId?: string, executionId?: string): Promise<AppUiView> {
    this.assertIds(appId, executionId);
    this.deployment = {
      ...this.deployment,
      status: 'canceled',
      requestedAction: 'Deployment canceled (mock).',
      currentStageKey: this.deployment.currentStageKey,
      failure: null,
      stages: this.deployment.stages.map((stage) =>
        stage.status === 'processing' || stage.status === 'pending'
          ? { ...stage, status: 'skipped', summary: 'Canceled' }
          : stage,
      ),
    };
    return this.getDeployment();
  }

  async publish(): Promise<AppUiView> {
    this.app.status = 'published';
    this.app.productionUrl = 'https://greenfork.apps.harness.io';
    this.app.metrics = {
      visitors: 412,
      requestsPerMin: 34,
      latencyMs: 128,
      errors: 0,
      uptime: 100,
      simulated: true,
    };
    this.deployment = fixtureDeployment('succeeded');
    return this.getDeployment();
  }

  async rollback(): Promise<AppUiView> {
    this.app.status = 'approved';
    this.deployment.requestedAction = 'Production rolled back (mock).';
    return this.getDeployment();
  }

  async requestApproval(): Promise<AppUiView> {
    this.app.approvalStatus = 'pending';
    return { kind: 'app', app: { ...this.app } };
  }

  async setDemoPath(_appId?: string, path?: DemoPathId): Promise<AppUiView> {
    const scenario =
      path === 'fail_app_build'
        ? 'failed'
        : path === 'ready_publish' || path === 'live'
          ? 'succeeded'
          : 'running';
    this.deployment = fixtureDeployment(scenario === 'failed' ? 'failed' : scenario);
    if (path === 'held_approval') {
      this.app.status = 'awaiting_approval';
      this.app.approvalStatus = 'pending';
      this.app.previewUrl = this.deployment.previewUrl ?? 'https://preview.example.harness.io/greenfork';
    } else if (path === 'ready_publish') {
      this.app.status = 'approved';
      this.app.approvalStatus = 'approved';
      this.app.previewUrl = this.deployment.previewUrl ?? 'https://preview.example.harness.io/greenfork';
      this.app.productionUrl = null;
    } else if (path === 'live') {
      this.app.status = 'published';
      this.app.approvalStatus = 'approved';
      this.app.previewUrl = this.deployment.previewUrl ?? 'https://preview.example.harness.io/greenfork';
      this.app.productionUrl = 'https://greenfork.apps.harness.io';
    } else if (scenario === 'failed') {
      this.app.status = 'failed';
    } else if (scenario === 'running') {
      this.app.status = 'preparing';
    }
    return this.getDeployment();
  }

  async updateApp(input: UpdateAppInput): Promise<AppUiView> {
    this.assertApp(input.appId);
    if (input.name) this.app.name = input.name;
    if (input.slug) {
      this.app.slug = input.slug;
      this.app.preferredUrl = input.slug;
    }
    if (input.enableCdn !== undefined) this.app.enableCdn = input.enableCdn;
    return { kind: 'app', app: { ...this.app } };
  }

  async acceptFix(appId?: string, executionId?: string): Promise<AppUiView> {
    this.assertIds(appId, executionId);
    const fail = this.deployment.failure;
    if (!fail) throw new Error('No failure to accept. The current run is not in a failed state.');
    return {
      kind: 'fix_request',
      fix: {
        appId: this.deployment.applicationId,
        executionId: this.deployment.executionId,
        instruction: fail.agentInstruction ?? fail.summary,
        file: fail.file ?? null,
        line: fail.line ?? null,
        logLines: fail.logLines ?? [],
        summary: fail.summary,
        stageKey: fail.stageKey,
      },
    };
  }

  private assertApp(appId?: string): void {
    if (appId && appId !== MOCK_APP_ID && appId !== this.app.id) {
      throw new Error(`Unknown appId ${appId} (mock has ${MOCK_APP_ID})`);
    }
  }

  private assertIds(appId?: string, executionId?: string): void {
    this.assertApp(appId);
    if (executionId && executionId !== this.deployment.executionId) {
      throw new Error(
        `Unknown executionId ${executionId} (mock has ${this.deployment.executionId})`,
      );
    }
  }
}
