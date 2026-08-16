import { fixture } from "./fixtures.js";
export class MockVibeStore {
    deployment = fixture("failed");
    appStatus = "failed";
    approvalStatus = "not_required";
    productionUrl = null;
    async getApp(appId) {
        const d = this.deployment;
        if (appId && appId !== d.applicationId) {
            throw new Error(`Unknown appId ${appId} (mock store has ${d.applicationId})`);
        }
        return {
            id: d.applicationId,
            name: d.applicationName,
            status: this.appStatus,
            approvalStatus: this.approvalStatus,
            previewUrl: d.previewUrl ?? null,
            productionUrl: this.productionUrl,
        };
    }
    async getDeployment(appId, executionId) {
        this.assertIds(appId, executionId);
        return this.enrichedDeployment();
    }
    async getLogs(appId, executionId, stageKey) {
        this.assertIds(appId, executionId);
        const d = this.deployment;
        if (stageKey) {
            const stage = d.stages.find((s) => s.key === stageKey);
            return { lines: [...(stage?.logs ?? []), ...(stage?.failure?.logLines ?? [])] };
        }
        const fromFailure = d.failure?.logLines ?? [];
        if (fromFailure.length)
            return { lines: [...fromFailure] };
        return { lines: d.stages.flatMap((s) => s.logs) };
    }
    async deploy(input) {
        this.deployment = fixture("succeeded");
        if (input.name)
            this.deployment.applicationName = input.name;
        this.appStatus = "preview_ready";
        this.approvalStatus = "not_required";
        this.productionUrl = null;
        this.deployment.requestedAction = "Mock deploy finished (set VIBE_MCP_MOCK=1).";
        return this.getDeployment();
    }
    async retry(appId, executionId) {
        this.assertIds(appId, executionId);
        this.deployment = fixture("succeeded");
        this.appStatus = "preview_ready";
        this.deployment.requestedAction = "Mock retry finished.";
        return this.getDeployment();
    }
    async cancel(appId, executionId) {
        this.assertIds(appId, executionId);
        this.deployment = {
            ...this.deployment,
            status: "cancelled",
            requestedAction: "Mock deployment cancelled.",
        };
        this.appStatus = "failed";
        return this.getDeployment();
    }
    async publish() {
        this.deployment = fixture("succeeded");
        this.appStatus = "published";
        this.productionUrl = "https://greenfork.apps.harness.io";
        this.deployment.requestedAction = "Mock publish finished.";
        return this.getDeployment();
    }
    async rollback() {
        this.appStatus = "approved";
        this.productionUrl = null;
        this.deployment.requestedAction = "Mock rollback finished.";
        return this.getDeployment();
    }
    async requestApproval() {
        this.approvalStatus = "pending";
        this.appStatus = "awaiting_approval";
        return this.getApp();
    }
    async setDemoPath(_appId, path) {
        const scenario = path === "fail_app_build"
            ? "failed"
            : path === "ready_publish" || path === "live"
                ? "succeeded"
                : "running";
        this.deployment = fixture(scenario === "failed" ? "failed" : scenario);
        if (path === "held_approval") {
            this.appStatus = "awaiting_approval";
            this.approvalStatus = "pending";
            this.productionUrl = null;
            this.deployment.previewUrl =
                this.deployment.previewUrl ?? "https://preview.example.harness.io/greenfork";
        }
        else if (path === "ready_publish") {
            this.appStatus = "approved";
            this.approvalStatus = "approved";
            this.productionUrl = null;
            this.deployment.previewUrl =
                this.deployment.previewUrl ?? "https://preview.example.harness.io/greenfork";
        }
        else if (path === "live") {
            this.appStatus = "published";
            this.approvalStatus = "approved";
            this.productionUrl = "https://greenfork.apps.harness.io";
            this.deployment.previewUrl =
                this.deployment.previewUrl ?? "https://preview.example.harness.io/greenfork";
        }
        else if (scenario === "failed") {
            this.appStatus = "failed";
            this.productionUrl = null;
        }
        else if (scenario === "running") {
            this.appStatus = "preparing";
            this.productionUrl = null;
        }
        return this.getDeployment();
    }
    enrichedDeployment() {
        const deployment = structuredClone(this.deployment);
        return {
            ...deployment,
            previewUrl: deployment.previewUrl ?? null,
            productionUrl: this.productionUrl,
            appStatus: this.appStatus,
            approvalStatus: this.approvalStatus,
        };
    }
    assertIds(appId, executionId) {
        const d = this.deployment;
        if (appId && appId !== d.applicationId) {
            throw new Error(`Unknown appId ${appId} (mock store has ${d.applicationId})`);
        }
        if (executionId && executionId !== d.executionId) {
            throw new Error(`Unknown executionId ${executionId} (mock store has ${d.executionId})`);
        }
    }
}
