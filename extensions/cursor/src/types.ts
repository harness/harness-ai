export type PanelView = 'fresh' | 'deploying' | 'failed' | 'approval' | 'publish' | 'live';
export type Tone = 'idle' | 'info' | 'ok' | 'warn' | 'err' | 'vibe';
export type StageStatus = 'done' | 'active' | 'failed' | 'held' | 'pending';

export type PanelCommand =
  | 'ready'
  | 'refresh'
  | 'deploy'
  | 'seeEnforces'
  | 'streamLogs'
  | 'cancel'
  | 'askAgent'
  | 'retry'
  | 'openFile'
  | 'openPreview'
  | 'openProd'
  | 'openConsole'
  | 'copyRepo'
  | 'nudgeApprovers'
  | 'publish'
  | 'reviewChanges'
  | 'rollback'
  | 'setView';

export interface PanelMessage {
  type: PanelCommand;
  view?: PanelView;
}

export interface EnvCard {
  name: 'preview' | 'production';
  state: string;
  meta: string;
  tone: Tone;
  openable: boolean;
}

export interface HeroRow {
  k: string;
  v: string;
}

export interface HeroAction {
  id: PanelCommand;
  label: string;
  primary: boolean;
  ai?: boolean;
}

export interface HeroBlock {
  tone: Tone;
  eyebrow: string;
  title: string;
  body: string;
  progress: boolean;
  rows: HeroRow[];
  actions: HeroAction[];
  foot: string;
}

export interface ErrorLine {
  text: string;
  tone: 'error' | 'muted' | 'default';
}

export interface ErrorBlock {
  label: string;
  meta: string;
  lines: ErrorLine[];
  hint: string;
}

export interface StageItem {
  name: string;
  meta: string;
  time: string;
  status: StageStatus;
}

export interface TelemetryStat {
  value: string;
  label: string;
  tone: Tone;
}

export interface ChangeRow {
  msg: string;
  meta: string;
  when: string;
  tone: Tone;
}

export interface Telemetry {
  host: string;
  stats: TelemetryStat[];
  buildTag: string;
  buildMsg: string;
  buildMeta: string;
  rollbackLabel: string;
  history: ChangeRow[];
}

export interface PanelState {
  stubbed: boolean;
  disconnected?: boolean;
  view: PanelView;
  appName: string;
  managed: boolean;
  repo: string;
  projectId: string;
  previewUrl: string | null;
  productionUrl: string | null;
  consoleUrl: string;
  envs: EnvCard[];
  hero: HeroBlock | null;
  errorBlocks: ErrorBlock[] | null;
  stages: StageItem[] | null;
  stageLabel: string;
  stageMeta: string;
  telemetry: Telemetry | null;
  footLeft: string;
  footRight: string;
  failureFile: string | null;
  failureLine: number | null;
  attempt: number;
  maxAttempts: number;
  agentPrompt: string;
  appId: string | null;
  executionId: string | null;
}

export const PANEL_VIEWS: PanelView[] = ['fresh', 'deploying', 'failed', 'approval', 'publish', 'live'];

export const VIEW_TO_DEMO_PATH: Record<PanelView, string | null> = {
  fresh: null,
  deploying: 'success',
  failed: 'fail_app_build',
  approval: 'held_approval',
  publish: 'ready_publish',
  live: 'live',
};
