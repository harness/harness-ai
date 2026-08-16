const DEMO_PATH_IDS = [
  'success',
  'fail_source_import',
  'fail_app_discovery',
  'fail_app_build',
  'fail_infra',
  'fail_preview',
  'fail_security',
  'held_approval',
  'ready_publish',
  'live',
] as const;

export type DemoPathId = (typeof DEMO_PATH_IDS)[number];
export { DEMO_PATH_IDS };

export interface VibeApiApp {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  owner: string;
  team?: string | null;
  source: string;
  status: string;
  approvalStatus: string;
  previewUrl?: string | null;
  productionUrl?: string | null;
  repoUrl?: string | null;
  latestExecutionId?: string | null;
  updatedAt: string;
}

export interface StageFailure {
  stageKey: string;
  summary: string;
  file?: string | null;
  line?: number | null;
  logLines?: string[];
  agentInstruction?: string | null;
  suggestion?: string | null;
}

export interface VibeDeploymentStage {
  key: string;
  label: string;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  summary?: string | null;
  logs: string[];
  failure: StageFailure | null;
}

export interface VibeDeployment {
  applicationId: string;
  applicationName: string;
  deploymentId: string;
  executionId: string;
  status: string;
  currentStageKey: string | null;
  stages: VibeDeploymentStage[];
  failure: StageFailure | null;
  previewUrl?: string | null;
  productionUrl?: string | null;
  appStatus?: string | null;
  approvalStatus?: string | null;
  requestedAction?: string | null;
  inputsRequired?: { key: string; type?: string; secret?: boolean }[];
}

export interface AgentSubmissionResponse {
  projectId: string;
  appId: string;
  submissionId: string;
  executionId?: string | null;
  overallStatus: string;
  nextAction: string;
  isNewProject: boolean;
  statusUrl: string;
}

export class VibeApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = 'VibeApiError';
  }
}

export interface VibeApiClientOptions {
  baseUrl: string;
  token?: string;
  accountId?: string;
  orgId?: string;
  projectId?: string;
  fetch?: typeof fetch;
}

export class VibeApiClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly accountId?: string;
  private readonly orgId?: string;
  private readonly projectId?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VibeApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.accountId = options.accountId;
    this.orgId = options.orgId;
    this.projectId = options.projectId;
    this.fetchImpl = options.fetch ?? fetch;
  }

  listApps(): Promise<VibeApiApp[]> {
    return this.requestJson<VibeApiApp[]>('GET', '/api/apps');
  }

  getApp(appId: string): Promise<VibeApiApp> {
    return this.requestJson<VibeApiApp>('GET', `/api/apps/${encodeURIComponent(appId)}`);
  }

  getVibeDeployment(appId: string, executionId?: string): Promise<VibeDeployment> {
    const query = executionId ? `?executionId=${encodeURIComponent(executionId)}` : '';
    return this.requestJson<VibeDeployment>(
      'GET',
      `/api/apps/${encodeURIComponent(appId)}/vibe-deployment${query}`,
    );
  }

  retryDeployment(appId: string, executionId: string): Promise<VibeDeployment> {
    return this.requestJson<VibeDeployment>(
      'POST',
      `/api/apps/${encodeURIComponent(appId)}/executions/${encodeURIComponent(executionId)}/retry`,
    );
  }

  cancelDeployment(appId: string, executionId: string): Promise<VibeDeployment> {
    return this.requestJson<VibeDeployment>(
      'POST',
      `/api/apps/${encodeURIComponent(appId)}/executions/${encodeURIComponent(executionId)}/cancel`,
    );
  }

  submitSource(input: {
    zip: Uint8Array;
    fileName?: string;
    name?: string;
    projectId?: string;
    appId?: string;
    path?: DemoPathId;
  }): Promise<AgentSubmissionResponse> {
    const form = new FormData();
    const bytes = input.zip.buffer.slice(
      input.zip.byteOffset,
      input.zip.byteOffset + input.zip.byteLength,
    ) as ArrayBuffer;
    form.set('archive', new Blob([bytes], { type: 'application/zip' }), input.fileName ?? 'source.zip');
    form.set('source', 'cursor');
    if (input.name) form.set('name', input.name);
    if (input.projectId) form.set('projectId', input.projectId);
    if (input.appId) form.set('appId', input.appId);
    if (input.path) form.set('path', input.path);
    return this.requestJson<AgentSubmissionResponse>('POST', '/api/agent/sources', form);
  }

  replayDemoState(appId: string, path: DemoPathId): Promise<VibeDeployment> {
    return this.requestJson<VibeDeployment>(
      'PUT',
      `/api/apps/${encodeURIComponent(appId)}/demo-state`,
      JSON.stringify({ path }),
      'application/json',
    );
  }

  requestApproval(appId: string, input?: { note?: string; changeId?: string }): Promise<unknown> {
    return this.requestJson('POST', `/api/apps/${encodeURIComponent(appId)}/approval-request`, JSON.stringify(input ?? {}), 'application/json');
  }

  publishApp(appId: string, changeId?: string): Promise<VibeApiApp> {
    return this.requestJson<VibeApiApp>(
      'POST',
      `/api/apps/${encodeURIComponent(appId)}/publish`,
      JSON.stringify(changeId ? { changeId } : {}),
      'application/json',
    );
  }

  rollbackApp(appId: string): Promise<VibeApiApp> {
    return this.requestJson<VibeApiApp>(
      'POST',
      `/api/apps/${encodeURIComponent(appId)}/rollback`,
    );
  }

  private async requestJson<T>(
    method: string,
    path: string,
    body?: BodyInit,
    contentType?: string,
  ): Promise<T> {
    const res = await this.send(method, path, body, contentType);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private async send(
    method: string,
    path: string,
    body?: BodyInit,
    contentType?: string,
  ): Promise<Response> {
    const headers = new Headers();
    if (contentType) headers.set('content-type', contentType);
    if (this.token) {
      headers.set(
        'authorization',
        this.token.toLowerCase().startsWith('bearer ') ? this.token : `Bearer ${this.token}`,
      );
    }
    if (this.accountId) {
      headers.set('x-account-id', this.accountId);
      headers.set('x-tenant-id', this.accountId);
    }
    if (this.orgId) headers.set('x-org-id', this.orgId);
    if (this.projectId) headers.set('x-project-id', this.projectId);

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, { method, headers, body });
    } catch (error) {
      throw new VibeApiError(
        0,
        method,
        path,
        `vibe-api ${method} ${path} unreachable: ${(error as Error).message}`,
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new VibeApiError(
        res.status,
        method,
        path,
        `vibe-api ${method} ${path} failed: ${res.status}${text ? ` ${text.slice(0, 240)}` : ''}`,
      );
    }
    return res;
  }
}

export function createVibeApiClient(): VibeApiClient {
  return new VibeApiClient({
    baseUrl: process.env.VIBE_API_BASE_URL ?? 'http://localhost:8090',
    token: process.env.VIBE_API_TOKEN,
    accountId: process.env.VIBE_ACCOUNT_ID,
    orgId: process.env.VIBE_ORG_ID,
    projectId: process.env.VIBE_PROJECT_ID,
  });
}

export function formatApiError(error: unknown): string {
  if (error instanceof VibeApiError) {
    if (error.status === 0) {
      return `vibe-api is unreachable at ${process.env.VIBE_API_BASE_URL ?? 'http://localhost:8090'}. Start vibe-api or check VIBE_API_BASE_URL.`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
