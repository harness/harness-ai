import type { AppView, DeploymentView } from './ui-view.js';

export const MOCK_APP_ID = 'c0de0001-1111-4111-8111-000000000001';
export const MOCK_APP_NAME = 'GreenFork';
export const MOCK_EXEC_FAILED = 'c0de0001-1111-4111-8111-000000000002';
export const MOCK_EXEC_RUNNING = 'c0de0001-1111-4111-8111-000000000003';
export const MOCK_EXEC_OK = 'c0de0001-1111-4111-8111-000000000004';

const FAILED_BUILD_LOGS = [
  '> tsc --noEmit',
  "src/App.tsx:42:1 - error TS2304: Cannot find name 'Button'.",
  'Found 1 error.',
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const MOCK_APP: AppView = {
  id: MOCK_APP_ID,
  name: MOCK_APP_NAME,
  slug: 'greenfork',
  description: 'Internal cafeteria ordering app.',
  owner: 'jane.doe',
  team: 'platform',
  source: 'cursor',
  status: 'failed',
  approvalStatus: 'not_required',
  health: 'unknown',
  openIssues: 1,
  preferredUrl: 'greenfork',
  enableCdn: true,
  previewUrl: null,
  productionUrl: null,
  repoUrl: 'https://git.harness.io/demo/greenfork',
  latestExecutionId: MOCK_EXEC_FAILED,
  updatedAt: '2026-08-14T18:00:00.000Z',
  metrics: null,
};

export const MOCK_DEPLOYMENTS = {
  failed: {
    applicationId: MOCK_APP_ID,
    applicationName: MOCK_APP_NAME,
    deploymentId: MOCK_EXEC_FAILED,
    executionId: MOCK_EXEC_FAILED,
    status: 'failed',
    currentStageKey: 'app_build',
    previewUrl: null,
    requestedAction: 'Fix the missing Button import in src/App.tsx:42 and retry.',
    failure: {
      stageKey: 'app_build',
      summary: "TypeScript build failed: Cannot find name 'Button'.",
      file: 'src/App.tsx',
      line: 42,
      logLines: FAILED_BUILD_LOGS,
      agentInstruction: "Add `import { Button } from './components/Button'` in src/App.tsx.",
    },
    stages: [
      {
        key: 'source_import',
        label: 'Source import',
        status: 'completed',
        summary: 'Workspace imported',
      },
      {
        key: 'app_discovery',
        label: 'App discovery',
        status: 'completed',
        summary: 'Detected React + Vite',
      },
      {
        key: 'app_build',
        label: 'App build',
        status: 'failed',
        summary: 'tsc failed on src/App.tsx:42',
      },
      { key: 'preview_deploy', label: 'Preview', status: 'pending', summary: null },
    ],
  },
  running: {
    applicationId: MOCK_APP_ID,
    applicationName: MOCK_APP_NAME,
    deploymentId: MOCK_EXEC_RUNNING,
    executionId: MOCK_EXEC_RUNNING,
    status: 'running',
    currentStageKey: 'app_build',
    previewUrl: null,
    requestedAction: 'Wait for the build to finish.',
    failure: null,
    stages: [
      {
        key: 'source_import',
        label: 'Source import',
        status: 'completed',
        summary: 'Workspace imported',
      },
      {
        key: 'app_discovery',
        label: 'App discovery',
        status: 'completed',
        summary: 'Detected React + Vite',
      },
      { key: 'app_build', label: 'App build', status: 'processing', summary: 'npm run build' },
      { key: 'preview_deploy', label: 'Preview', status: 'pending', summary: null },
    ],
  },
  succeeded: {
    applicationId: MOCK_APP_ID,
    applicationName: MOCK_APP_NAME,
    deploymentId: MOCK_EXEC_OK,
    executionId: MOCK_EXEC_OK,
    status: 'succeeded',
    currentStageKey: 'preview_deploy',
    previewUrl: 'https://preview.example.harness.io/greenfork',
    requestedAction: 'Preview is live.',
    failure: null,
    stages: [
      {
        key: 'source_import',
        label: 'Source import',
        status: 'completed',
        summary: 'Workspace imported',
      },
      {
        key: 'app_discovery',
        label: 'App discovery',
        status: 'completed',
        summary: 'Detected React + Vite',
      },
      { key: 'app_build', label: 'App build', status: 'completed', summary: 'Build succeeded' },
      {
        key: 'preview_deploy',
        label: 'Preview',
        status: 'completed',
        summary: 'Preview published',
      },
    ],
  },
} satisfies Record<string, DeploymentView>;

export const MOCK_BUILD_LOGS = FAILED_BUILD_LOGS;

export function fixtureDeployment(name: keyof typeof MOCK_DEPLOYMENTS): DeploymentView {
  return clone(MOCK_DEPLOYMENTS[name]);
}

export function fixtureApp(overrides: Partial<AppView> = {}): AppView {
  return { ...clone(MOCK_APP), ...overrides };
}
