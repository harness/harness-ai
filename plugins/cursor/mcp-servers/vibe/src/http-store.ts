import { basename } from 'node:path';
import {
  createVibeApiClient,
  VibeApiClient,
  VibeApiError,
  type DemoPathId,
} from './api-client.js';
import {
  appView,
  deployFormView,
  deploymentView,
  logsView,
  slugify,
  toDeployFormView,
} from './mappers.js';
import type { DeployInput, UpdateAppInput, VibeStore } from './vibe-store.js';
import type { AppUiView } from './ui-view.js';
import { zipWorkspace } from './zip-workspace.js';

export class HttpVibeStore implements VibeStore {
  constructor(private readonly client: VibeApiClient = createVibeApiClient()) {}

  async getApp(appId?: string): Promise<AppUiView> {
    const id = await this.resolveAppId(appId);
    const app = await this.client.getApp(id);
    return appView(app);
  }

  async getDeployment(appId?: string, executionId?: string): Promise<AppUiView> {
    const id = await this.resolveAppId(appId);
    const execId = await this.resolveExecutionId(id, executionId);
    const [deployment, app] = await Promise.all([
      this.client.getVibeDeployment(id, execId),
      this.client.getApp(id),
    ]);
    return deploymentView(deployment, app);
  }

  async getLogs(appId?: string, executionId?: string, stageKey?: string) {
    const id = await this.resolveAppId(appId);
    const execId = await this.resolveExecutionId(id, executionId);
    const deployment = await this.client.getVibeDeployment(id, execId);
    return logsView(deployment, stageKey);
  }

  async deploy(input: DeployInput) {
    if (!input.confirm) {
      return this.deployForm(input);
    }

    const cwd = input.cwd ?? process.cwd();
    const zip = await zipWorkspace(cwd);
    const response = await this.client.submitSource({
      zip,
      fileName: 'source.zip',
      name: input.name,
      projectId: input.projectId,
      appId: input.appId,
      slug: input.slug,
      preferredUrl: input.slug,
      enableCdn: input.enableCdn,
      path: input.path,
    });
    return this.getDeployment(response.appId, response.executionId ?? undefined);
  }

  async retry(appId?: string, executionId?: string) {
    const id = await this.resolveAppId(appId);
    const execId = await this.resolveExecutionId(id, executionId, true);
    const deployment = await this.client.retryDeployment(id, execId!);
    const app = await this.client.getApp(id);
    return deploymentView(deployment, app);
  }

  async cancel(appId?: string, executionId?: string) {
    const id = await this.resolveAppId(appId);
    const execId = await this.resolveExecutionId(id, executionId, true);
    const deployment = await this.client.cancelDeployment(id, execId!);
    const app = await this.client.getApp(id);
    return deploymentView(deployment, app);
  }

  async publish(appId?: string, changeId?: string) {
    const id = await this.resolveAppId(appId);
    await this.client.publishApp(id, changeId);
    const [deployment, app] = await Promise.all([
      this.client.getVibeDeployment(id),
      this.client.getApp(id),
    ]);
    return deploymentView(deployment, app);
  }

  async rollback(appId?: string) {
    const id = await this.resolveAppId(appId);
    await this.client.rollbackApp(id);
    const [deployment, app] = await Promise.all([
      this.client.getVibeDeployment(id),
      this.client.getApp(id),
    ]);
    return deploymentView(deployment, app);
  }

  async requestApproval(appId?: string, note?: string, changeId?: string) {
    const id = await this.resolveAppId(appId);
    await this.client.requestApproval(id, { note, changeId });
    const app = await this.client.getApp(id);
    return appView(app);
  }

  async setDemoPath(appId?: string, path?: DemoPathId) {
    if (!path) throw new Error('path is required (demo recipe id, e.g. fail_app_build)');
    const id = await this.resolveAppId(appId);
    const deployment = await this.client.replayDemoState(id, path);
    const app = await this.client.getApp(id);
    return deploymentView(deployment, app);
  }

  async updateApp(input: UpdateAppInput) {
    const id = await this.resolveAppId(input.appId);
    const app = await this.client.updateApp(id, {
      name: input.name,
      preferredUrl: input.slug,
      enableCdn: input.enableCdn,
    });
    return appView(app);
  }

  async acceptFix(appId?: string, executionId?: string): Promise<AppUiView> {
    const view = await this.getDeployment(appId, executionId);
    if (view.kind !== 'deployment') {
      throw new Error('Expected a deployment view');
    }
    const fail = view.deployment.failure;
    if (!fail) {
      throw new Error('No failure to accept. The current run is not in a failed state.');
    }
    return {
      kind: 'fix_request',
      fix: {
        appId: view.deployment.applicationId,
        executionId: view.deployment.executionId,
        instruction: fail.agentInstruction ?? fail.summary,
        file: fail.file ?? null,
        line: fail.line ?? null,
        logLines: fail.logLines ?? [],
        summary: fail.summary,
        stageKey: fail.stageKey,
      },
    };
  }

  private async deployForm(input: DeployInput): Promise<AppUiView> {
    const cwd = input.cwd ?? process.cwd();
    let name = input.name?.trim();
    let slug = input.slug?.trim();
    let enableCdn = input.enableCdn;
    let appId = input.appId;
    let projectId = input.projectId;

    if (input.appId) {
      try {
        const app = await this.client.getApp(input.appId);
        name = name || app.name;
        slug = slug || app.slug;
        enableCdn = enableCdn ?? app.enableCdn ?? true;
        projectId = projectId ?? app.projectId ?? undefined;
        appId = app.id;
      } catch {
        /* first deploy of a named app */
      }
    } else {
      try {
        const id = await this.resolveAppId();
        const app = await this.client.getApp(id);
        name = name || app.name;
        slug = slug || app.slug;
        enableCdn = enableCdn ?? app.enableCdn ?? true;
        projectId = projectId ?? app.projectId ?? undefined;
        appId = app.id;
      } catch {
        /* no existing app */
      }
    }

    if (!name) name = basename(cwd) || 'vibe-app';
    if (!slug) slug = slugify(name);

    return deployFormView(
      toDeployFormView({
        name,
        slug,
        enableCdn: enableCdn ?? true,
        appId,
        projectId,
        path: input.path,
      }),
    );
  }

  private async resolveAppId(appId?: string): Promise<string> {
    if (appId?.trim()) return appId.trim();
    const fromEnv = process.env.VIBE_APP_ID?.trim();
    if (fromEnv) return fromEnv;

    const apps = await this.client.listApps();
    if (!apps.length) {
      throw new Error(
        'No Vibe app found. Run deploy_vibe_app to create one, or set VIBE_APP_ID.',
      );
    }
    const sorted = [...apps].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return sorted[0]!.id;
  }

  private async resolveExecutionId(
    appId: string,
    executionId?: string,
    required = false,
  ): Promise<string | undefined> {
    if (executionId?.trim()) return executionId.trim();
    const app = await this.client.getApp(appId);
    if (app.latestExecutionId) return app.latestExecutionId;
    if (required) {
      throw new Error(`App ${appId} has no execution to act on. Deploy or pass executionId.`);
    }
    return undefined;
  }
}

export function formatStoreError(error: unknown): string {
  if (error instanceof VibeApiError) {
    if (error.status === 0) {
      return `vibe-api is unreachable at ${process.env.VIBE_API_BASE_URL ?? 'http://localhost:8090'}. Start vibe-api or check VIBE_API_BASE_URL.`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
