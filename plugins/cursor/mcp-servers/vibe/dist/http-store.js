import { createVibeApiClient, formatApiError, } from "./api-client.js";
import { deploymentLogs, toVibeApp } from "./types.js";
import { zipWorkspace } from "./zip-workspace.js";
export class HttpVibeStore {
    client;
    constructor(client = createVibeApiClient()) {
        this.client = client;
    }
    async getApp(appId) {
        const id = await this.resolveAppId(appId);
        return toVibeApp(await this.client.getApp(id));
    }
    async getDeployment(appId, executionId) {
        const id = await this.resolveAppId(appId);
        const execId = await this.resolveExecutionId(id, executionId);
        const [deployment, app] = await Promise.all([
            this.client.getVibeDeployment(id, execId),
            this.client.getApp(id),
        ]);
        return enrichDeployment(deployment, app);
    }
    async getLogs(appId, executionId, stageKey) {
        const deployment = await this.getDeployment(appId, executionId);
        return deploymentLogs(deployment, stageKey);
    }
    async deploy(input) {
        const cwd = input.cwd ?? process.cwd();
        const zip = await zipWorkspace(cwd);
        const response = await this.client.submitSource({
            zip,
            fileName: "source.zip",
            name: input.name,
            projectId: input.projectId,
            appId: input.appId,
            path: input.path,
        });
        if (response.executionId) {
            return this.client.getVibeDeployment(response.appId, response.executionId);
        }
        return this.client.getVibeDeployment(response.appId);
    }
    async retry(appId, executionId) {
        const id = await this.resolveAppId(appId);
        const execId = await this.resolveExecutionId(id, executionId, true);
        const [deployment, app] = await Promise.all([
            this.client.retryDeployment(id, execId),
            this.client.getApp(id),
        ]);
        return enrichDeployment(deployment, app);
    }
    async cancel(appId, executionId) {
        const id = await this.resolveAppId(appId);
        const execId = await this.resolveExecutionId(id, executionId, true);
        const [deployment, app] = await Promise.all([
            this.client.cancelDeployment(id, execId),
            this.client.getApp(id),
        ]);
        return enrichDeployment(deployment, app);
    }
    async publish(appId, changeId) {
        const id = await this.resolveAppId(appId);
        await this.client.publishApp(id, changeId);
        return this.getDeployment(id);
    }
    async rollback(appId) {
        const id = await this.resolveAppId(appId);
        await this.client.rollbackApp(id);
        return this.getDeployment(id);
    }
    async requestApproval(appId, note, changeId) {
        const id = await this.resolveAppId(appId);
        await this.client.requestApproval(id, { note, changeId });
        return toVibeApp(await this.client.getApp(id));
    }
    async setDemoPath(appId, path) {
        if (!path)
            throw new Error("path is required (demo recipe id, e.g. fail_app_build)");
        const id = await this.resolveAppId(appId);
        return this.client.replayDemoState(id, path);
    }
    async resolveAppId(appId) {
        if (appId?.trim())
            return appId.trim();
        const fromEnv = process.env.VIBE_APP_ID?.trim();
        if (fromEnv)
            return fromEnv;
        const apps = await this.client.listApps();
        if (!apps.length) {
            throw new Error("No Vibe app found. Run deploy_vibe_app to create one, or set VIBE_APP_ID.");
        }
        const sorted = [...apps].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return sorted[0].id;
    }
    async resolveExecutionId(appId, executionId, required = false) {
        if (executionId?.trim())
            return executionId.trim();
        const app = await this.client.getApp(appId);
        if (app.latestExecutionId)
            return app.latestExecutionId;
        if (required) {
            throw new Error(`App ${appId} has no execution to act on. Deploy or pass executionId.`);
        }
        return undefined;
    }
}
export { formatApiError };
function enrichDeployment(deployment, app) {
    return {
        ...deployment,
        previewUrl: deployment.previewUrl ?? app.previewUrl ?? null,
        productionUrl: app.productionUrl ?? null,
        appStatus: app.status,
        approvalStatus: app.approvalStatus,
    };
}
