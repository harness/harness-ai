import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { DEMO_PATH_IDS } from './api-client.js';
import { formatStoreError } from './http-store.js';
import { createVibeStore } from './store.js';
import { summarizeView, type AppUiView } from './ui-view.js';
import type { VibeStore } from './vibe-store.js';

const RESOURCE_URI = 'ui://vibe/app.html';
const optionalIds = {
  appId: z.string().optional(),
  executionId: z.string().optional(),
};

type ToolVisibility = 'model' | 'app';

function toolUiMeta(visibility: ToolVisibility[] = ['model', 'app']) {
  return {
    ui: { resourceUri: RESOURCE_URI, visibility },
    'ui/resourceUri': RESOURCE_URI,
  };
}

function ok(view: AppUiView) {
  return {
    content: [{ type: 'text' as const, text: summarizeView(view) }],
    structuredContent: view as unknown as Record<string, unknown>,
    _meta: toolUiMeta(),
  };
}

function err(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

async function readAppHtml(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, 'vibe-app.html'),
    join(here, '../dist/vibe-app.html'),
    join(here, '../dist-ui/ui/vibe-app.html'),
  ];
  for (const path of candidates) {
    try {
      return await readFile(path, 'utf8');
    } catch {
      /* try next */
    }
  }
  throw new Error('MCP app HTML is missing. Run the vibe MCP build first.');
}

async function run<T>(fn: () => Promise<T>): Promise<T | ReturnType<typeof err>> {
  try {
    return await fn();
  } catch (error) {
    return err(formatStoreError(error));
  }
}

export function registerVibeTools(server: McpServer, store: VibeStore = createVibeStore()): void {
  registerAppTool(
    server,
    'get_vibe_app',
    {
      title: 'Get Vibe app',
      description: 'Get a Harness Vibe app with status and metrics. Renders an in-chat app card.',
      inputSchema: { appId: z.string().optional() },
      _meta: toolUiMeta(),
    },
    async (args: { appId?: string }) => run(() => store.getApp(args.appId).then(ok)),
  );

  registerAppTool(
    server,
    'get_vibe_deployment',
    {
      title: 'Get Vibe deployment',
      description:
        'Get the current Vibe deployment view (stages, failure, status). Renders an in-chat card.',
      inputSchema: optionalIds,
      _meta: toolUiMeta(),
    },
    async (args: { appId?: string; executionId?: string }) =>
      run(() => store.getDeployment(args.appId, args.executionId).then(ok)),
  );

  registerAppTool(
    server,
    'get_vibe_deployment_logs',
    {
      title: 'Get Vibe deployment logs',
      description:
        'Get logs for a Vibe deployment, optionally filtered to one stage. Renders a log card.',
      inputSchema: {
        ...optionalIds,
        stageKey: z.string().optional(),
      },
      _meta: toolUiMeta(),
    },
    async (args: { appId?: string; executionId?: string; stageKey?: string }) =>
      run(() => store.getLogs(args.appId, args.executionId, args.stageKey).then(ok)),
  );

  registerAppTool(
    server,
    'retry_vibe_deployment',
    {
      title: 'Retry Vibe deployment',
      description: 'Retry a failed Vibe deployment.',
      inputSchema: optionalIds,
      _meta: toolUiMeta(['app']),
    },
    async (args: { appId?: string; executionId?: string }) =>
      run(() => store.retry(args.appId, args.executionId).then(ok)),
  );

  registerAppTool(
    server,
    'cancel_vibe_deployment',
    {
      title: 'Cancel Vibe deployment',
      description: 'Cancel a running Vibe deployment.',
      inputSchema: optionalIds,
      _meta: toolUiMeta(['app']),
    },
    async (args: { appId?: string; executionId?: string }) =>
      run(() => store.cancel(args.appId, args.executionId).then(ok)),
  );

  registerAppTool(
    server,
    'deploy_vibe_app',
    {
      title: 'Deploy Vibe app',
      description:
        'Show the deploy form (name, subdomain, CDN) unless confirm=true, then zip the workspace and submit a Vibe revision.',
      inputSchema: {
        name: z.string().optional(),
        projectId: z.string().optional(),
        appId: z.string().optional(),
        slug: z.string().optional(),
        enableCdn: z.boolean().optional(),
        confirm: z.boolean().optional(),
        path: z.enum(DEMO_PATH_IDS).optional(),
      },
      _meta: toolUiMeta(),
    },
    async (args: {
      name?: string;
      appId?: string;
      projectId?: string;
      slug?: string;
      enableCdn?: boolean;
      confirm?: boolean;
      path?: (typeof DEMO_PATH_IDS)[number];
    }) =>
      run(() =>
        store
          .deploy({
            name: args.name,
            appId: args.appId,
            projectId: args.projectId,
            slug: args.slug,
            enableCdn: args.enableCdn,
            confirm: args.confirm,
            path: args.path,
          })
          .then(ok),
      ),
  );

  registerAppTool(
    server,
    'publish_vibe_app',
    {
      title: 'Publish Vibe app',
      description: 'Publish the app to production after preview is ready.',
      inputSchema: {
        appId: z.string().optional(),
        changeId: z.string().optional(),
      },
      _meta: toolUiMeta(['app']),
    },
    async (args: { appId?: string; changeId?: string }) =>
      run(() => store.publish(args.appId, args.changeId).then(ok)),
  );

  registerAppTool(
    server,
    'rollback_vibe_app',
    {
      title: 'Rollback Vibe app',
      description: 'Rollback production to the previous deployment.',
      inputSchema: { appId: z.string().optional() },
      _meta: toolUiMeta(['app']),
    },
    async (args: { appId?: string }) => run(() => store.rollback(args.appId).then(ok)),
  );

  registerAppTool(
    server,
    'request_vibe_approval',
    {
      title: 'Request Vibe approval',
      description: 'Request production publish approval for a Vibe app.',
      inputSchema: {
        appId: z.string().optional(),
        note: z.string().optional(),
        changeId: z.string().optional(),
      },
      _meta: toolUiMeta(['app']),
    },
    async (args: { appId?: string; note?: string; changeId?: string }) =>
      run(() => store.requestApproval(args.appId, args.note, args.changeId).then(ok)),
  );

  registerAppTool(
    server,
    'set_vibe_demo_path',
    {
      title: 'Set Vibe demo path',
      description:
        'Replay a named demo workflow recipe on an existing app (dev/demo only). Paths: success, fail_app_build, ready_publish, etc.',
      inputSchema: {
        appId: z.string().optional(),
        path: z.enum(DEMO_PATH_IDS),
      },
      _meta: toolUiMeta(['app']),
    },
    async (args: { appId?: string; path: (typeof DEMO_PATH_IDS)[number] }) =>
      run(() => store.setDemoPath(args.appId, args.path).then(ok)),
  );

  registerAppTool(
    server,
    'update_vibe_app',
    {
      title: 'Update Vibe app',
      description: 'Patch app settings: name, subdomain (slug), and enable CDN.',
      inputSchema: {
        appId: z.string().optional(),
        name: z.string().optional(),
        slug: z.string().optional(),
        enableCdn: z.boolean().optional(),
      },
      _meta: toolUiMeta(),
    },
    async (args: { appId?: string; name?: string; slug?: string; enableCdn?: boolean }) =>
      run(() => store.updateApp(args).then(ok)),
  );

  registerAppTool(
    server,
    'accept_vibe_fix',
    {
      title: 'Accept Vibe fix',
      description:
        'Accept the current deployment failure fix. Returns agentInstruction, file, and line so the agent can patch and redeploy.',
      inputSchema: optionalIds,
      _meta: toolUiMeta(),
    },
    async (args: { appId?: string; executionId?: string }) =>
      run(() => store.acceptFix(args.appId, args.executionId).then(ok)),
  );

  registerAppResource(
    server,
    'Harness Vibe',
    RESOURCE_URI,
    {
      mimeType: RESOURCE_MIME_TYPE,
      _meta: { ui: { prefersBorder: true } },
    },
    async () => {
      const html = await readAppHtml();
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: { ui: { prefersBorder: true } },
          },
        ],
      };
    },
  );
}
