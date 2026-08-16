import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { DEMO_PATH_IDS } from "./api-client.js";
import { formatApiError } from "./http-store.js";
import { createVibeStore } from "./store.js";
import type { VibeDeployment } from "./api-client.js";
import type { VibeStore } from "./types.js";

const RESOURCE_URI = "ui://vibe/deployment.html";
const optionalIds = {
  appId: z.string().optional(),
  executionId: z.string().optional(),
};

function summarize(d: VibeDeployment): string {
  const fail = d.failure;
  const loc = fail?.file ? `${fail.file}${fail.line ? `:${fail.line}` : ""}` : "";
  const extra = fail ? ` · ${fail.stageKey}${loc ? ` · ${loc}` : ""}` : "";
  return `${d.applicationName} · ${d.status}${extra}`;
}

function ok(d: VibeDeployment) {
  return {
    content: [{ type: "text" as const, text: summarize(d) }],
    structuredContent: d as unknown as Record<string, unknown>,
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  };
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

async function runDeployment(
  fn: () => Promise<VibeDeployment>,
): Promise<ReturnType<typeof ok> | ReturnType<typeof err>> {
  try {
    return ok(await fn());
  } catch (error) {
    return err(formatApiError(error));
  }
}

export function registerVibeTools(server: McpServer, store: VibeStore = createVibeStore()): void {
  registerAppTool(
    server,
    "get_vibe_deployment",
    {
      title: "Get Vibe deployment",
      description: "Get the current Vibe deployment view (stages, failure, status). Renders an in-chat card.",
      inputSchema: optionalIds,
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args: { appId?: string; executionId?: string }) =>
      runDeployment(() => store.getDeployment(args.appId, args.executionId)),
  );

  registerAppTool(
    server,
    "deploy_vibe_app",
    {
      title: "Deploy Vibe app",
      description: "Zip the current workspace and submit a new Vibe revision via vibe-api.",
      inputSchema: {
        name: z.string().optional(),
        projectId: z.string().optional(),
        appId: z.string().optional(),
        path: z.enum(DEMO_PATH_IDS).optional(),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args: { name?: string; appId?: string; projectId?: string; path?: (typeof DEMO_PATH_IDS)[number] }) =>
      runDeployment(() =>
        store.deploy({
          name: args.name,
          appId: args.appId,
          projectId: args.projectId,
          path: args.path,
        }),
      ),
  );

  registerAppTool(
    server,
    "retry_vibe_deployment",
    {
      title: "Retry Vibe deployment",
      description: "Retry a failed Vibe deployment.",
      inputSchema: optionalIds,
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args: { appId?: string; executionId?: string }) =>
      runDeployment(() => store.retry(args.appId, args.executionId)),
  );

  registerAppTool(
    server,
    "cancel_vibe_deployment",
    {
      title: "Cancel Vibe deployment",
      description: "Cancel a running Vibe deployment.",
      inputSchema: optionalIds,
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args: { appId?: string; executionId?: string }) =>
      runDeployment(() => store.cancel(args.appId, args.executionId)),
  );

  registerAppTool(
    server,
    "publish_vibe_app",
    {
      title: "Publish Vibe app",
      description: "Publish the app to production after preview is ready.",
      inputSchema: {
        appId: z.string().optional(),
        changeId: z.string().optional(),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args: { appId?: string; changeId?: string }) =>
      runDeployment(() => store.publish(args.appId, args.changeId)),
  );

  registerAppTool(
    server,
    "rollback_vibe_app",
    {
      title: "Rollback Vibe app",
      description: "Rollback production to the previous deployment.",
      inputSchema: { appId: z.string().optional() },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args: { appId?: string }) => runDeployment(() => store.rollback(args.appId)),
  );

  registerAppTool(
    server,
    "request_vibe_approval",
    {
      title: "Request Vibe approval",
      description: "Request production publish approval for a Vibe app.",
      inputSchema: {
        appId: z.string().optional(),
        note: z.string().optional(),
        changeId: z.string().optional(),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args: { appId?: string; note?: string; changeId?: string }) => {
      try {
        const app = await store.requestApproval(args.appId, args.note, args.changeId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(app, null, 2) }],
        };
      } catch (error) {
        return err(formatApiError(error));
      }
    },
  );

  registerAppTool(
    server,
    "set_vibe_demo_path",
    {
      title: "Set Vibe demo path",
      description: "Replay a named demo workflow recipe on an existing app (dev/demo only).",
      inputSchema: {
        appId: z.string().optional(),
        path: z.enum(DEMO_PATH_IDS),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args: { appId?: string; path: (typeof DEMO_PATH_IDS)[number] }) =>
      runDeployment(() => store.setDemoPath(args.appId, args.path)),
  );

  server.tool(
    "get_vibe_app",
    "Get a Harness Vibe app by id. Uses VIBE_APP_ID or the most recently updated app when omitted.",
    { appId: z.string().optional() },
    async ({ appId }: { appId?: string }) => {
      try {
        const app = await store.getApp(appId);
        return { content: [{ type: "text" as const, text: JSON.stringify(app, null, 2) }] };
      } catch (error) {
        return err(formatApiError(error));
      }
    },
  );

  server.tool(
    "get_vibe_deployment_logs",
    "Get logs for a Vibe deployment, optionally filtered to one stage key.",
    {
      appId: z.string().optional(),
      executionId: z.string().optional(),
      stageKey: z.string().optional(),
    },
    async ({
      appId,
      executionId,
      stageKey,
    }: {
      appId?: string;
      executionId?: string;
      stageKey?: string;
    }) => {
      try {
        const logs = await store.getLogs(appId, executionId, stageKey);
        return { content: [{ type: "text" as const, text: logs.lines.join("\n") || "(no logs)" }] };
      } catch (error) {
        return err(formatApiError(error));
      }
    },
  );

  const htmlPath = join(dirname(fileURLToPath(import.meta.url)), "deployment.html");
  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await readFile(htmlPath, "utf8");
      return {
        contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );
}
