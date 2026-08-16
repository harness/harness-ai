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
];
export { DEMO_PATH_IDS };
export class VibeApiError extends Error {
    status;
    method;
    path;
    constructor(status, method, path, message) {
        super(message);
        this.status = status;
        this.method = method;
        this.path = path;
        this.name = 'VibeApiError';
    }
}
export class VibeApiClient {
    baseUrl;
    token;
    accountId;
    orgId;
    projectId;
    fetchImpl;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.token = options.token;
        this.accountId = options.accountId;
        this.orgId = options.orgId;
        this.projectId = options.projectId;
        this.fetchImpl = options.fetch ?? fetch;
    }
    listApps() {
        return this.requestJson('GET', '/api/apps');
    }
    getApp(appId) {
        return this.requestJson('GET', `/api/apps/${encodeURIComponent(appId)}`);
    }
    getVibeDeployment(appId, executionId) {
        const query = executionId ? `?executionId=${encodeURIComponent(executionId)}` : '';
        return this.requestJson('GET', `/api/apps/${encodeURIComponent(appId)}/vibe-deployment${query}`);
    }
    retryDeployment(appId, executionId) {
        return this.requestJson('POST', `/api/apps/${encodeURIComponent(appId)}/executions/${encodeURIComponent(executionId)}/retry`);
    }
    cancelDeployment(appId, executionId) {
        return this.requestJson('POST', `/api/apps/${encodeURIComponent(appId)}/executions/${encodeURIComponent(executionId)}/cancel`);
    }
    submitSource(input) {
        const form = new FormData();
        const bytes = input.zip.buffer.slice(input.zip.byteOffset, input.zip.byteOffset + input.zip.byteLength);
        form.set('archive', new Blob([bytes], { type: 'application/zip' }), input.fileName ?? 'source.zip');
        form.set('source', 'cursor');
        if (input.name)
            form.set('name', input.name);
        if (input.projectId)
            form.set('projectId', input.projectId);
        if (input.appId)
            form.set('appId', input.appId);
        if (input.path)
            form.set('path', input.path);
        return this.requestJson('POST', '/api/agent/sources', form);
    }
    replayDemoState(appId, path) {
        return this.requestJson('PUT', `/api/apps/${encodeURIComponent(appId)}/demo-state`, JSON.stringify({ path }), 'application/json');
    }
    requestApproval(appId, input) {
        return this.requestJson('POST', `/api/apps/${encodeURIComponent(appId)}/approval-request`, JSON.stringify(input ?? {}), 'application/json');
    }
    publishApp(appId, changeId) {
        return this.requestJson('POST', `/api/apps/${encodeURIComponent(appId)}/publish`, JSON.stringify(changeId ? { changeId } : {}), 'application/json');
    }
    rollbackApp(appId) {
        return this.requestJson('POST', `/api/apps/${encodeURIComponent(appId)}/rollback`);
    }
    async requestJson(method, path, body, contentType) {
        const res = await this.send(method, path, body, contentType);
        if (res.status === 204)
            return undefined;
        return (await res.json());
    }
    async send(method, path, body, contentType) {
        const headers = new Headers();
        if (contentType)
            headers.set('content-type', contentType);
        if (this.token) {
            headers.set('authorization', this.token.toLowerCase().startsWith('bearer ') ? this.token : `Bearer ${this.token}`);
        }
        if (this.accountId) {
            headers.set('x-account-id', this.accountId);
            headers.set('x-tenant-id', this.accountId);
        }
        if (this.orgId)
            headers.set('x-org-id', this.orgId);
        if (this.projectId)
            headers.set('x-project-id', this.projectId);
        let res;
        try {
            res = await this.fetchImpl(`${this.baseUrl}${path}`, { method, headers, body });
        }
        catch (error) {
            throw new VibeApiError(0, method, path, `vibe-api ${method} ${path} unreachable: ${error.message}`);
        }
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new VibeApiError(res.status, method, path, `vibe-api ${method} ${path} failed: ${res.status}${text ? ` ${text.slice(0, 240)}` : ''}`);
        }
        return res;
    }
}
export function createVibeApiClient() {
    return new VibeApiClient({
        baseUrl: process.env.VIBE_API_BASE_URL ?? 'http://localhost:8090',
        token: process.env.VIBE_API_TOKEN,
        accountId: process.env.VIBE_ACCOUNT_ID,
        orgId: process.env.VIBE_ORG_ID,
        projectId: process.env.VIBE_PROJECT_ID,
    });
}
export function formatApiError(error) {
    if (error instanceof VibeApiError) {
        if (error.status === 0) {
            return `vibe-api is unreachable at ${process.env.VIBE_API_BASE_URL ?? 'http://localhost:8090'}. Start vibe-api or check VIBE_API_BASE_URL.`;
        }
        return error.message;
    }
    return error instanceof Error ? error.message : String(error);
}
