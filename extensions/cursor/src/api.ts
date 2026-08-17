import type {
  AgentStatusResponse,
  AgentSubmissionResponse,
  App,
  IdeContext,
  VibeDeployment,
} from './api-types';

const JSON_TIMEOUT_MS = 5000;
const UPLOAD_TIMEOUT_MS = 120_000;

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

export interface VibeApiOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export class VibeApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VibeApiOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? fetch;
  }

  get origin(): string {
    return this.baseUrl;
  }

  async listApps(): Promise<App[]> {
    return this.requestJson<App[]>('GET', '/api/apps');
  }

  async getApp(appId: string): Promise<App> {
    return this.requestJson<App>('GET', `/api/apps/${encodeURIComponent(appId)}`);
  }

  async getVibeDeployment(appId: string, executionId?: string): Promise<VibeDeployment> {
    const query = executionId ? `?executionId=${encodeURIComponent(executionId)}` : '';
    return this.requestJson<VibeDeployment>(
      'GET',
      `/api/apps/${encodeURIComponent(appId)}/vibe-deployment${query}`,
    );
  }

  async getIdeContext(appId: string, executionId?: string): Promise<IdeContext> {
    const query = executionId ? `?executionId=${encodeURIComponent(executionId)}` : '';
    return this.requestJson<IdeContext>(
      'GET',
      `/api/apps/${encodeURIComponent(appId)}/ide-context${query}`,
    );
  }

  async replayDemoState(appId: string, path: string): Promise<VibeDeployment> {
    return this.requestJson<VibeDeployment>(
      'PUT',
      `/api/apps/${encodeURIComponent(appId)}/demo-state`,
      { path },
    );
  }

  async submitSource(input: {
    zip: Uint8Array;
    fileName?: string;
    source?: string;
    name?: string;
    appId?: string;
    path?: string;
  }): Promise<AgentSubmissionResponse> {
    const form = new FormData();
    const blob = new Blob([input.zip], { type: 'application/zip' });
    form.set('archive', blob, input.fileName ?? 'source.zip');
    form.set('source', input.source ?? 'cursor');
    if (input.name) form.set('name', input.name);
    if (input.appId) form.set('appId', input.appId);
    if (input.path) form.set('path', input.path);
    return this.requestJson<AgentSubmissionResponse>('POST', '/api/agent/sources', form);
  }

  async getAgentStatus(statusUrl: string): Promise<AgentStatusResponse> {
    const path = statusUrl.startsWith('http')
      ? statusUrl.replace(this.baseUrl, '')
      : statusUrl.startsWith('/')
        ? statusUrl
        : `/${statusUrl}`;
    return this.requestJson<AgentStatusResponse>('GET', path);
  }

  async retryDeployment(appId: string, executionId: string): Promise<VibeDeployment> {
    return this.requestJson<VibeDeployment>(
      'POST',
      `/api/apps/${encodeURIComponent(appId)}/executions/${encodeURIComponent(executionId)}/retry`,
    );
  }

  async cancelDeployment(appId: string, executionId: string): Promise<VibeDeployment> {
    return this.requestJson<VibeDeployment>(
      'POST',
      `/api/apps/${encodeURIComponent(appId)}/executions/${encodeURIComponent(executionId)}/cancel`,
    );
  }

  async publish(appId: string): Promise<unknown> {
    return this.requestJson('POST', `/api/apps/${encodeURIComponent(appId)}/publish`, {});
  }

  async rollback(appId: string): Promise<unknown> {
    return this.requestJson('POST', `/api/apps/${encodeURIComponent(appId)}/rollback`, {});
  }

  private async requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.send(method, path, body);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private async send(method: string, path: string, body?: unknown): Promise<Response> {
    const headers = new Headers();
    let payload: Uint8Array | string | FormData | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers.set('content-type', 'application/json');
      payload = JSON.stringify(body);
    }

    let res: Response;
    const timeoutMs = body instanceof FormData ? UPLOAD_TIMEOUT_MS : JSON_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = (error as Error).name === 'AbortError';
      throw new VibeApiError(
        0,
        method,
        path,
        aborted
          ? `vibe-api ${method} ${path} timed out after ${timeoutMs}ms`
          : `vibe-api ${method} ${path} unreachable: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
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
