import type { DemoPathId, VibeApiApp, VibeDeployment } from "./api-client.js";

export interface VibeApp {
  id: string;
  name: string;
  status: string;
  previewUrl?: string | null;
  approvalStatus?: string;
  productionUrl?: string | null;
}

export interface DeployInput {
  name?: string;
  projectId?: string;
  appId?: string;
  path?: DemoPathId;
  cwd?: string;
}

export interface VibeStore {
  getApp(appId?: string): Promise<VibeApp>;
  getDeployment(appId?: string, executionId?: string): Promise<VibeDeployment>;
  getLogs(appId?: string, executionId?: string, stageKey?: string): Promise<{ lines: string[] }>;
  deploy(input: DeployInput): Promise<VibeDeployment>;
  retry(appId?: string, executionId?: string): Promise<VibeDeployment>;
  cancel(appId?: string, executionId?: string): Promise<VibeDeployment>;
  publish(appId?: string, changeId?: string): Promise<VibeDeployment>;
  rollback(appId?: string): Promise<VibeDeployment>;
  requestApproval(appId?: string, note?: string, changeId?: string): Promise<VibeApp>;
  setDemoPath(appId?: string, path?: DemoPathId): Promise<VibeDeployment>;
}

export function toVibeApp(app: VibeApiApp): VibeApp {
  return {
    id: app.id,
    name: app.name,
    status: app.status,
    previewUrl: app.previewUrl ?? null,
    approvalStatus: app.approvalStatus,
    productionUrl: app.productionUrl ?? null,
  };
}

export function deploymentLogs(deployment: VibeDeployment, stageKey?: string): { lines: string[] } {
  const stages = stageKey
    ? deployment.stages.filter((stage) => stage.key === stageKey)
    : deployment.stages;
  const lines = stages.flatMap((stage) => [
    ...(stage.logs ?? []),
    ...(stage.failure?.logLines ?? []),
  ]);
  const fromFailure = deployment.failure?.logLines ?? [];
  return { lines: lines.length ? lines : fromFailure.length ? fromFailure : ["(no logs)"] };
}
