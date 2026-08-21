import * as vscode from "vscode";
import { VibeApi, VibeApiError } from "./api";
import {
  buildAgentPrompt,
  mapDeploymentToPanelState,
  mapDisconnected,
  mapFresh,
} from "./map-deployment";
import { VibeViewProvider } from "./panel";
import { matchAppToWorkspace } from "./resolve-app";
import { stubPanelState } from "./stub";
import type { App } from "./api-types";
import type { PanelMessage, PanelState, PanelView } from "./types";
import { PANEL_VIEWS, VIEW_TO_DEMO_PATH } from "./types";
import { zipWorkspace } from "./zip-workspace";

const TASK_FILE = "VIBE_TASK.md";
const WORKSPACE_APP_ID_KEY = "harness.vibe.appId";
const POLL_MS = 1500;

let statusBar: vscode.StatusBarItem | undefined;
let provider: VibeViewProvider | undefined;
let diagnostics: vscode.DiagnosticCollection | undefined;
let logs: vscode.OutputChannel | undefined;
let api: VibeApi | undefined;
let extensionContext: vscode.ExtensionContext | undefined;
let panelState: PanelState = mapFresh(null);
let pollTimer: ReturnType<typeof setInterval> | undefined;
let refreshInFlight: Promise<void> | undefined;
let demoView: PanelView | null = null;

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  api = createApi();
  provider = new VibeViewProvider(context.extensionUri, handlePanelMessage);
  diagnostics = vscode.languages.createDiagnosticCollection("harness-vibe");
  logs = vscode.window.createOutputChannel("Harness Vibe");
  publish(mapFresh(workspacePath()));
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VibeViewProvider.viewId,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      },
    ),
    diagnostics,
    logs,
    vscode.workspace.onDidChangeWorkspaceFolders(() => void refresh()),
  );

  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50,
  );
  statusBar.command = "harness.vibe.refresh";
  context.subscriptions.push(statusBar);

  const commands: Array<[string, () => void]> = [
    [
      "harness.vibe.refresh",
      () => {
        demoView = null;
        void refresh();
      },
    ],
    ["harness.vibe.openFile", () => void openFailureFile()],
    ["harness.vibe.retry", () => void applyRetry()],
    ["harness.vibe.cancel", () => void applyCancel()],
    ["harness.vibe.askAgent", () => void askAgentToFix()],
    ["harness.vibe.deploy", () => void applyDeploy()],
    [
      "harness.vibe.openPreview",
      () => void openUrl(panelState.previewUrl, "preview"),
    ],
    [
      "harness.vibe.openProd",
      () => void openUrl(panelState.productionUrl, "production"),
    ],
    ["harness.vibe.copyRepo", () => void copyRepoToClipboard()],
    ["harness.vibe.requestApproval", () => void applyNudge()],
    ["harness.vibe.publish", () => void applyPublish()],
    ["harness.vibe.rollback", () => void applyRollback()],
  ];
  for (const [id, fn] of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  }

  publish(mapFresh(workspacePath()));
  void refresh();
}

export function deactivate(): void {
  stopPolling();
}

function createApi(): VibeApi {
  return new VibeApi({ baseUrl: getApiBaseUrl() });
}

function getApiBaseUrl(): string {
  const fromEnv = process.env.VIBE_API_BASE_URL?.trim();
  if (fromEnv) return preferIpv4Loopback(fromEnv);
  const fromConfig = vscode.workspace
    .getConfiguration("harness.vibe")
    .get<string>("apiBaseUrl");
  if (fromConfig?.trim()) return preferIpv4Loopback(fromConfig.trim());
  return "http://127.0.0.1:8090";
}

/** Prefer 127.0.0.1 so Electron/Node do not stall on ::1 when the API is IPv4-only. */
function preferIpv4Loopback(url: string): string {
  return url.replace(/^(https?:\/\/)localhost(?=[:/]|$)/i, "$1127.0.0.1");
}

function getAppIdOverride(): string | undefined {
  const fromEnv = process.env.VIBE_APP_ID?.trim();
  if (fromEnv) return fromEnv;
  const fromConfig = vscode.workspace
    .getConfiguration("harness.vibe")
    .get<string>("appId");
  return fromConfig?.trim() || undefined;
}

function workspacePath(): string | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

function handlePanelMessage(message: PanelMessage): void {
  if (message.type === "ready") {
    provider?.setState(panelState);
    if (!demoView) void refresh();
  } else if (message.type === "refresh") {
    demoView = null;
    void refresh();
  } else if (
    message.type === "setView" &&
    message.view &&
    PANEL_VIEWS.includes(message.view)
  ) {
    void applySetView(message.view);
  } else if (message.type === "deploy") void applyDeploy();
  else if (message.type === "seeEnforces") {
    void vscode.window.showInformationMessage(
      "Vibe applies your team policy profile: security scans, approval gates, and environment guardrails.",
    );
  } else if (message.type === "streamLogs") showLogs();
  else if (message.type === "cancel") void applyCancel();
  else if (message.type === "askAgent") void askAgentToFix();
  else if (message.type === "retry") void applyRetry();
  else if (message.type === "openFile") void openFailureFile();
  else if (message.type === "openPreview")
    void openUrl(panelState.previewUrl, "preview");
  else if (message.type === "openProd")
    void openUrl(panelState.productionUrl, "production");
  else if (message.type === "openConsole")
    void openUrl(panelState.consoleUrl, "console");
  else if (message.type === "copyRepo") void copyRepoToClipboard();
  else if (message.type === "nudgeApprovers") void applyNudge();
  else if (message.type === "publish") void applyPublish();
  else if (message.type === "reviewChanges") {
    void vscode.window.showInformationMessage(
      "Review changes in the Vibe console.",
    );
  } else if (message.type === "rollback") void applyRollback();
}

async function refresh(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshInternal().finally(() => {
    refreshInFlight = undefined;
  });
  return refreshInFlight;
}

async function refreshInternal(): Promise<void> {
  api = createApi();
  try {
    const resolved = await resolveApp();
    if (demoView) return;
    if (!resolved) {
      stopPolling();
      publish(mapFresh(workspacePath()));
      return;
    }

    const deployment = await api.getVibeDeployment(
      resolved.app.id,
      resolved.app.latestExecutionId ?? undefined,
    );
    if (demoView) return;
    const next = mapDeploymentToPanelState(
      resolved.app,
      deployment,
      workspacePath(),
    );
    publish(next);
    maybeStartPolling(next);
  } catch (error) {
    if (demoView) return;
    stopPolling();
    if (error instanceof VibeApiError && error.status === 0) {
      publish(mapDisconnected(api.origin));
      return;
    }
    const message =
      error instanceof Error ? error.message : "Failed to refresh Vibe status";
    void vscode.window.showErrorMessage(message);
    publish(mapDisconnected(api.origin));
  }
}

async function resolveApp(): Promise<{ app: App; persisted: boolean } | null> {
  if (!api) return null;
  const overrideId = getAppIdOverride();
  if (overrideId) {
    const app = await api.getApp(overrideId);
    await persistAppId(app.id);
    return { app, persisted: true };
  }

  const persistedId =
    extensionContext?.workspaceState.get<string>(WORKSPACE_APP_ID_KEY);
  if (persistedId) {
    try {
      const app = await api.getApp(persistedId);
      return { app, persisted: true };
    } catch (error) {
      if (!(error instanceof VibeApiError) || error.status !== 404) throw error;
      await clearPersistedAppId();
    }
  }

  const folder = workspacePath();
  if (!folder) return null;
  const apps = await api.listApps();
  const matched = matchAppToWorkspace(apps, folder);
  if (!matched) return null;
  await persistAppId(matched.id);
  return { app: matched, persisted: false };
}

async function persistAppId(appId: string): Promise<void> {
  await extensionContext?.workspaceState.update(WORKSPACE_APP_ID_KEY, appId);
}

async function clearPersistedAppId(): Promise<void> {
  await extensionContext?.workspaceState.update(
    WORKSPACE_APP_ID_KEY,
    undefined,
  );
}

async function applySetView(view: PanelView): Promise<void> {
  stopPolling();
  if (view === "fresh") {
    demoView = null;
    await clearPersistedAppId();
    publish(mapFresh(workspacePath()));
    return;
  }

  demoView = view;
  publish(
    stubPanelState(view, {
      appId: panelState.appId,
      executionId: panelState.executionId,
    }),
  );

  const demoPath = VIEW_TO_DEMO_PATH[view];
  const appId = panelState.appId;
  if (!demoPath || !api || !appId) return;
  void api.replayDemoState(appId, demoPath).catch(() => undefined);
}

async function applyDeploy(pathOverride?: string): Promise<void> {
  if (!api) return;
  const folder = workspacePath();
  if (!folder) {
    void vscode.window.showWarningMessage(
      "Open a workspace folder before deploying with Vibe.",
    );
    return;
  }

  const demoPath = pathOverride ?? VIEW_TO_DEMO_PATH.deploying ?? "success";
  const folderName = folder.split(/[\\/]/).filter(Boolean).pop() ?? "workspace";

  try {
    const zip = await zipWorkspace(folder);
    const submission = await api.submitSource({
      zip,
      source: "cursor",
      name: folderName,
      appId: panelState.appId ?? undefined,
      path: demoPath,
    });
    await persistAppId(submission.appId);

    const app = await api.getApp(submission.appId);
    const deployment = await api.getVibeDeployment(
      submission.appId,
      submission.executionId ?? app.latestExecutionId ?? undefined,
    );
    const next = mapDeploymentToPanelState(app, deployment, folder);
    demoView = null;
    publish(next);
    maybeStartPolling(next);
  } catch (error) {
    if (error instanceof Error && error.message.includes("zip is required")) {
      void vscode.window.showErrorMessage(error.message);
      return;
    }
    handleActionError(error);
  }
}

async function applyRetry(): Promise<void> {
  if (!api || !panelState.appId || !panelState.executionId) return;
  try {
    const deployment = await api.retryDeployment(
      panelState.appId,
      panelState.executionId,
    );
    const app = await api.getApp(panelState.appId);
    const next = mapDeploymentToPanelState(app, deployment, workspacePath());
    publish(next);
    maybeStartPolling(next);
  } catch (error) {
    handleActionError(error);
  }
}

async function applyCancel(): Promise<void> {
  if (!api || !panelState.appId || !panelState.executionId) return;
  try {
    const deployment = await api.cancelDeployment(
      panelState.appId,
      panelState.executionId,
    );
    const app = await api.getApp(panelState.appId);
    const next = mapDeploymentToPanelState(app, deployment, workspacePath());
    publish(next);
    maybeStartPolling(next);
  } catch (error) {
    handleActionError(error);
  }
}

async function applyPublish(): Promise<void> {
  if (!api || !panelState.appId) return;
  try {
    await api.publish(panelState.appId);
    await refresh();
  } catch (error) {
    handleActionError(error);
  }
}

async function applyRollback(): Promise<void> {
  if (!api || !panelState.appId) return;
  try {
    await api.rollback(panelState.appId);
    await refresh();
  } catch (error) {
    handleActionError(error);
  }
}

function applyNudge(): void {
  void vscode.window.showInformationMessage(
    "Approval nudge recorded. Watching for approval updates.",
  );
  void refresh();
}

function maybeStartPolling(state: PanelState): void {
  if (state.disconnected || !state.appId) {
    stopPolling();
    return;
  }
  if (state.view === "deploying") startPolling();
  else stopPolling();
}

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void refreshInternal();
  }, POLL_MS);
}

function stopPolling(): void {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = undefined;
}

function publish(state: PanelState): void {
  panelState = state;
  provider?.setState(state);
  setStatus(`Harness Vibe: ${labelFor(state.view)}`);
  writeDiagnostics(state);
}

function labelFor(view: PanelView): string {
  if (view === "fresh")
    return panelState.disconnected ? "Disconnected" : "Not managed";
  if (view === "deploying") return "Deploying";
  if (view === "failed") return "Build failed";
  if (view === "approval") return "Awaiting approval";
  if (view === "publish") return "Ready to publish";
  return "Live";
}

function writeDiagnostics(state: PanelState): void {
  diagnostics?.clear();
  if (state.view !== "failed" || !state.failureFile) return;
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return;
  const uri = vscode.Uri.joinPath(folders[0].uri, state.failureFile);
  const line = Math.max(0, (state.failureLine ?? 1) - 1);
  diagnostics?.set(uri, [
    new vscode.Diagnostic(
      new vscode.Range(line, 0, line, 120),
      state.hero?.title ?? "Vibe deployment failure",
      vscode.DiagnosticSeverity.Error,
    ),
  ]);
}

function showLogs(): void {
  const state = panelState;
  logs?.clear();
  logs?.appendLine(`Harness Vibe · ${state.appName} · ${labelFor(state.view)}`);
  const lines = state.agentPrompt
    ? state.agentPrompt.split("\n")
    : ["No failure context. Open the Vibe console for full logs."];
  for (const line of lines) logs?.appendLine(line || " ");
  logs?.show(true);
}

async function openUrl(url: string | null, kind: string): Promise<void> {
  if (!url) {
    void vscode.window.showInformationMessage(
      `No ${kind} URL in this snapshot.`,
    );
    return;
  }
  await vscode.env.openExternal(vscode.Uri.parse(url));
}

async function copyRepoToClipboard(): Promise<void> {
  const repo = panelState.repo;
  await vscode.env.clipboard.writeText(repo);
  void vscode.window.showInformationMessage(`Copied ${repo}`);
}

async function openFailureFile(): Promise<void> {
  const state = panelState;
  const file = state.failureFile;
  const line = state.failureLine;
  if (!file) {
    void vscode.window.showInformationMessage(
      "No failure file in this deployment.",
    );
    return;
  }
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    void vscode.window.showInformationMessage(
      `Failure location: ${file}${line ? `:${line}` : ""}`,
    );
    return;
  }
  const uri = vscode.Uri.joinPath(folders[0].uri, file);
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    if (line && line > 0) {
      const pos = new vscode.Position(Math.max(0, line - 1), 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos));
    }
  } catch {
    void vscode.window.showInformationMessage(
      `Failure points at ${file}${line ? `:${line}` : ""} (file is not in this workspace).`,
    );
  }
}

function fallbackFixPrompt(state: PanelState): string {
  const title = state.hero?.title ?? "Build failed";
  const body =
    state.hero?.body ?? "Preview failed. Production was not attempted.";
  return buildAgentPrompt(
    `Fix this Harness Vibe preview build failure in the current workspace.\n\n${title}\n${body}`,
    {
      file: state.failureFile,
      line: state.failureLine,
      message: title,
    },
  );
}

async function askAgentToFix(): Promise<void> {
  let body = panelState.agentPrompt.trim() || fallbackFixPrompt(panelState);

  if (api && panelState.appId && !demoView) {
    try {
      const ide = await api.getIdeContext(
        panelState.appId,
        panelState.executionId ?? undefined,
      );
      body = buildAgentPrompt(
        ide.failure?.agentInstruction ?? ide.requestedAction ?? body,
        ide.failure ?? undefined,
      );
    } catch {
      // Demo chips and missing apps still use the panel prompt.
    }
  }

  const folders = vscode.workspace.workspaceFolders;
  if (folders?.length) {
    const taskUri = vscode.Uri.joinPath(folders[0].uri, TASK_FILE);
    await vscode.workspace.fs.writeFile(taskUri, Buffer.from(body, "utf8"));
  }

  await openAgentChatWithPrompt(body);
}

async function openAgentChatWithPrompt(prompt: string): Promise<void> {
  await vscode.env.clipboard.writeText(prompt);

  try {
    await vscode.commands.executeCommand("workbench.action.chat.open", prompt);
  } catch {
    // Cursor ignores the VS Code chat query API.
  }

  try {
    await vscode.commands.executeCommand("composer.newAgentChat");
  } catch {
    void vscode.window.showInformationMessage(
      "Copied the Vibe fix prompt. Open a new agent chat and paste it.",
    );
    return;
  }

  await delay(400);
  await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function handleActionError(error: unknown): void {
  if (error instanceof VibeApiError && error.status === 0) {
    publish(mapDisconnected(api?.origin ?? getApiBaseUrl()));
    return;
  }
  const message = error instanceof Error ? error.message : "Vibe action failed";
  void vscode.window.showErrorMessage(message);
}

function setStatus(text: string): void {
  if (!statusBar) return;
  statusBar.text = text;
  statusBar.show();
}
