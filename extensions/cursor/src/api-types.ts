/** Minimal vibe-api shapes duplicated from vibe-mode contracts (do not import that repo). */

export type AppStatus =
  | 'draft'
  | 'preparing'
  | 'checking'
  | 'preview_ready'
  | 'awaiting_approval'
  | 'approved'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'archived';

export type ApprovalStatus =
  | 'not_required'
  | 'required'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'changes_requested';

export type ExecutionStatus = 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'canceled';

export type StageExecutionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'skipped';

export type StageKey =
  | 'source_import'
  | 'app_discovery'
  | 'app_build'
  | 'infra_provision'
  | 'preview_deploy'
  | 'security_compliance'
  | 'approval_gate'
  | 'production_deploy'
  | 'monitoring';

export type DemoPathId =
  | 'success'
  | 'fail_source_import'
  | 'fail_app_discovery'
  | 'fail_app_build'
  | 'fail_infra'
  | 'fail_preview'
  | 'fail_security'
  | 'held_approval'
  | 'ready_publish'
  | 'live';

export interface App {
  id: string;
  name: string;
  slug: string;
  status: AppStatus;
  approvalStatus: ApprovalStatus;
  previewUrl?: string | null;
  productionUrl?: string | null;
  repoUrl?: string | null;
  projectId?: string | null;
  latestExecutionId?: string | null;
}

export interface StageFailure {
  stageKey: StageKey;
  summary: string;
  file?: string | null;
  line?: number | null;
  logLines?: string[];
  agentInstruction?: string | null;
  suggestion?: string | null;
  attempt?: number | null;
  maxAttempts?: number | null;
}

export interface VibeDeploymentStage {
  key: StageKey;
  label: string;
  status: StageExecutionStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  summary?: string | null;
  logs?: string[];
  failure?: StageFailure | null;
}

export interface VibeDeployment {
  applicationId: string;
  applicationName: string;
  deploymentId: string;
  executionId: string;
  status: ExecutionStatus;
  currentStageKey: StageKey | null;
  stages: VibeDeploymentStage[];
  failure?: StageFailure | null;
  previewUrl?: string | null;
  requestedAction?: string | null;
}

export interface IdeFailure {
  stage: StageKey;
  message: string;
  file?: string | null;
  line?: number | null;
  logLines?: string[];
  agentInstruction?: string | null;
}

export interface IdeContext {
  applicationId: string;
  applicationName?: string;
  executionId: string;
  failure?: IdeFailure | null;
  requestedAction?: string;
}

export interface AgentSubmissionResponse {
  projectId: string;
  appId: string;
  submissionId: string;
  executionId?: string | null;
  statusUrl: string;
}

export interface AgentStatusResponse {
  overallStatus: string;
  summary: string;
  project: { projectId: string; appId?: string | null };
  preview?: { url?: string | null; status?: string | null } | null;
  production?: { url?: string | null; status?: string | null } | null;
}
