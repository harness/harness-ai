import type { DemoPathId } from './api-client.js';
import type { AppUiView } from './ui-view.js';

export interface DeployInput {
  name?: string;
  projectId?: string;
  appId?: string;
  slug?: string;
  enableCdn?: boolean;
  path?: DemoPathId;
  cwd?: string;
  confirm?: boolean;
}

export interface UpdateAppInput {
  appId?: string;
  name?: string;
  slug?: string;
  enableCdn?: boolean;
}

export interface VibeStore {
  getApp(appId?: string): Promise<AppUiView>;
  getDeployment(appId?: string, executionId?: string): Promise<AppUiView>;
  getLogs(appId?: string, executionId?: string, stageKey?: string): Promise<AppUiView>;
  deploy(input: DeployInput): Promise<AppUiView>;
  retry(appId?: string, executionId?: string): Promise<AppUiView>;
  cancel(appId?: string, executionId?: string): Promise<AppUiView>;
  publish(appId?: string, changeId?: string): Promise<AppUiView>;
  rollback(appId?: string): Promise<AppUiView>;
  requestApproval(appId?: string, note?: string, changeId?: string): Promise<AppUiView>;
  setDemoPath(appId?: string, path?: DemoPathId): Promise<AppUiView>;
  updateApp(input: UpdateAppInput): Promise<AppUiView>;
  acceptFix(appId?: string, executionId?: string): Promise<AppUiView>;
}
