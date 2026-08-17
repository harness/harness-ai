/** Discriminated view model shared by MCP tools (structuredContent) and the React app. */

export type VibeUiKind =
  | 'app'
  | 'deployment'
  | 'logs'
  | 'deploy_form'
  | 'fix_request';

export interface AppMetrics {
  visitors: number;
  requestsPerMin: number;
  latencyMs: number;
  errors: number;
  uptime: number;
  simulated: boolean;
}

export interface AppView {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  owner: string;
  team?: string | null;
  source: string;
  status: string;
  approvalStatus: string;
  health?: string | null;
  openIssues?: number | null;
  preferredUrl?: string | null;
  enableCdn: boolean;
  previewUrl?: string | null;
  productionUrl?: string | null;
  repoUrl?: string | null;
  latestExecutionId?: string | null;
  updatedAt: string;
  metrics?: AppMetrics | null;
}

export interface DeploymentStageView {
  key: string;
  label: string;
  status: string;
  summary?: string | null;
}

export interface DeploymentFailureView {
  stageKey: string;
  summary: string;
  file?: string | null;
  line?: number | null;
  logLines?: string[];
  agentInstruction?: string | null;
}

export interface DeploymentView {
  applicationId: string;
  applicationName: string;
  deploymentId: string;
  executionId: string;
  status: string;
  currentStageKey: string | null;
  stages: DeploymentStageView[];
  failure: DeploymentFailureView | null;
  previewUrl?: string | null;
  productionUrl?: string | null;
  appStatus?: string | null;
  approvalStatus?: string | null;
  requestedAction?: string | null;
  slug?: string | null;
  enableCdn?: boolean | null;
  health?: string | null;
  metrics?: AppMetrics | null;
}

export interface LogsView {
  applicationName: string;
  executionId: string;
  stageKey?: string | null;
  lines: string[];
}

export interface DeployFormView {
  name: string;
  slug: string;
  enableCdn: boolean;
  appId?: string | null;
  projectId?: string | null;
  path?: string | null;
}

export interface FixRequestView {
  appId: string;
  executionId: string;
  instruction: string;
  file?: string | null;
  line?: number | null;
  logLines: string[];
  summary: string;
  stageKey: string;
}

export type AppUiView =
  | { kind: 'app'; app: AppView }
  | { kind: 'deployment'; deployment: DeploymentView }
  | { kind: 'logs'; logs: LogsView }
  | { kind: 'deploy_form'; form: DeployFormView }
  | { kind: 'fix_request'; fix: FixRequestView };

export function summarizeView(view: AppUiView): string {
  switch (view.kind) {
    case 'app':
      return `${view.app.name} · ${view.app.status}${view.app.previewUrl ? ` · ${view.app.previewUrl}` : ''}`;
    case 'deployment': {
      const d = view.deployment;
      const fail = d.failure;
      const loc = fail?.file ? `${fail.file}${fail.line ? `:${fail.line}` : ''}` : '';
      const extra = fail ? ` · ${fail.stageKey}${loc ? ` · ${loc}` : ''}` : '';
      return `${d.applicationName} · ${d.status}${extra}`;
    }
    case 'logs': {
      const label = view.logs.stageKey ? ` · ${view.logs.stageKey}` : '';
      return `${view.logs.applicationName} logs${label} · ${view.logs.lines.length} lines`;
    }
    case 'deploy_form':
      return `Deploy ${view.form.name} · subdomain ${view.form.slug} · fill the form and submit`;
    case 'fix_request': {
      const loc = view.fix.file
        ? `${view.fix.file}${view.fix.line ? `:${view.fix.line}` : ''}`
        : view.fix.stageKey;
      return `Accept fix · ${loc} · ${view.fix.instruction}`;
    }
  }
}
