import { App } from "@modelcontextprotocol/ext-apps";

interface StageFailure {
  stageKey: string;
  summary: string;
  file?: string | null;
  line?: number | null;
  logLines?: string[];
  agentInstruction?: string | null;
}

interface VibeDeploymentStage {
  key: string;
  label: string;
  status: string;
  summary?: string | null;
}

interface VibeDeployment {
  applicationId: string;
  applicationName: string;
  deploymentId: string;
  executionId: string;
  status: string;
  stages: VibeDeploymentStage[];
  failure: StageFailure | null;
  previewUrl?: string | null;
  productionUrl?: string | null;
  appStatus?: string | null;
  approvalStatus?: string | null;
  requestedAction?: string | null;
  inputsRequired?: { key: string }[];
}

type CardView = "failed" | "deploying" | "approval" | "publish" | "live";

const CARD_VIEW_LABEL: Record<CardView, string> = {
  failed: "Build failed",
  deploying: "Deploying",
  approval: "Awaiting approval",
  publish: "Ready to publish",
  live: "Live in production",
};

const TOOL_BY_CMD: Record<string, string> = {
  refresh: "get_vibe_deployment",
  retry: "retry_vibe_deployment",
  cancel: "cancel_vibe_deployment",
  publish: "publish_vibe_app",
  rollback: "rollback_vibe_app",
  approval: "request_vibe_approval",
};

const root = document.getElementById("root")!;
let currentDeployment: VibeDeployment | null = null;

const app = new App({ name: "Harness Vibe", version: "0.1.0" });
app.connect();

app.ontoolresult = (result) => {
  applyToolResult(result);
};

function applyToolResult(result: {
  structuredContent?: unknown;
  content?: { type: string; text?: string }[];
}): void {
  const deployment = normalizeDeployment(result.structuredContent);
  if (deployment) {
    render(deployment);
    return;
  }
  const text = result.content?.find((c) => c.type === "text")?.text;
  root.textContent = text ?? "No deployment data";
}

document.addEventListener("click", async (event) => {
  const btn = (event.target as HTMLElement).closest("button[data-cmd]");
  if (!btn || !currentDeployment) return;
  const cmd = btn.getAttribute("data-cmd");
  if (!cmd) return;
  if (cmd === "open-preview" && currentDeployment.previewUrl) {
    window.open(currentDeployment.previewUrl, "_blank", "noopener,noreferrer");
    return;
  }
  if (cmd === "open-prod" && currentDeployment.productionUrl) {
    window.open(currentDeployment.productionUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const name = TOOL_BY_CMD[cmd];
  if (!name) return;
  btn.setAttribute("disabled", "true");
  try {
    const result = await app.callServerTool({
      name,
      arguments: {
        appId: currentDeployment.applicationId,
        executionId: currentDeployment.executionId,
      },
    });
    applyToolResult(result);
  } catch (error) {
    root.insertAdjacentHTML("beforeend", `<p class="err">${escapeHtml((error as Error).message)}</p>`);
  } finally {
    btn.removeAttribute("disabled");
  }
});

function normalizeDeployment(structured: unknown): VibeDeployment | null {
  if (!structured || typeof structured !== "object") return null;
  if ("kind" in structured && (structured as { kind?: string }).kind === "deployment") {
    const wrapped = structured as { deployment?: VibeDeployment };
    return wrapped.deployment ?? null;
  }
  if ("applicationId" in structured && "executionId" in structured) {
    return structured as VibeDeployment;
  }
  return null;
}

function stageStatus(deployment: VibeDeployment, key: string): string | undefined {
  return deployment.stages.find((stage) => stage.key === key)?.status;
}

function isRunning(deployment: VibeDeployment): boolean {
  return (
    deployment.status === "running" ||
    deployment.status === "queued" ||
    deployment.stages.some((stage) => stage.status === "processing")
  );
}

function deriveCardView(deployment: VibeDeployment): CardView {
  const productionLive =
    deployment.appStatus === "published" ||
    Boolean(
      deployment.productionUrl &&
        (deployment.status === "succeeded" || deployment.appStatus === "published"),
    );
  if (productionLive) return "live";

  const failed =
    deployment.status === "failed" ||
    deployment.appStatus === "failed" ||
    Boolean(deployment.failure) ||
    deployment.stages.some((stage) => stage.status === "failed");
  if (failed) return "failed";

  if (isRunning(deployment)) return "deploying";

  const held =
    deployment.status === "paused" ||
    deployment.appStatus === "awaiting_approval" ||
    deployment.approvalStatus === "pending" ||
    stageStatus(deployment, "approval_gate") === "paused" ||
    deployment.stages.some((stage) => stage.status === "paused");
  if (held) return "approval";

  const readyToPublish =
    deployment.appStatus === "approved" ||
    deployment.appStatus === "preview_ready" ||
    (Boolean(deployment.previewUrl) && !deployment.productionUrl);
  if (readyToPublish) return "publish";

  if (deployment.status === "succeeded") return "publish";

  return "deploying";
}

function render(d: VibeDeployment): void {
  currentDeployment = d;
  const cardView = deriveCardView(d);
  const fail = d.failure;
  const fileLine = fail?.file ? `${fail.file}${fail.line ? `:${fail.line}` : ""}` : "";
  const logs = (fail?.logLines ?? []).slice(-12);
  const running = isRunning(d);

  root.innerHTML = `
    <style>
      :root { color-scheme: dark; }
      body { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; margin: 0; padding: 10px; color: #e8e8e8; background: #1b1b1b; }
      h1 { font-size: 13px; margin: 0 0 2px; font-weight: 600; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .muted { opacity: 0.72; margin: 0 0 8px; font-size: 11px; }
      .status { display: inline-block; padding: 1px 8px; border-radius: 999px; background: #3a3a3a; font-size: 10px; text-transform: capitalize; }
      .status.failed, .status.cancelled { background: #5c1a1a; color: #ffb4b4; }
      .status.succeeded, .status.published { background: #143d2a; color: #9ee6c3; }
      .status.running, .status.needs_input, .status.queued { background: #163a4a; color: #9ad8f5; }
      .stage { display: flex; gap: 8px; padding: 3px 0; border-bottom: 1px solid #2e2e2e; }
      .dot { width: 7px; height: 7px; border-radius: 50%; margin-top: 4px; background: #666; flex: none; }
      .dot.completed { background: #3dd68c; }
      .dot.failed { background: #f76e6e; }
      .dot.processing { background: #71d7ff; }
      .failbox { margin: 8px 0; padding: 8px; border-radius: 6px; border: 1px solid #5c1a1a; background: #2a1212; }
      .fileline { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; margin: 6px 0 0; color: #f0d0d0; }
      pre { white-space: pre-wrap; font-size: 10px; line-height: 1.45; background: #111; padding: 8px; border-radius: 4px; margin: 0 0 8px; max-height: 140px; overflow: auto; }
      .bodycopy { margin: 0 0 8px; line-height: 1.45; color: #c8c8c8; }
      .links { margin: 0 0 8px; display: flex; flex-wrap: wrap; gap: 10px; }
      button { margin: 0 6px 0 0; font-size: 11px; padding: 5px 10px; border-radius: 6px; border: 1px solid #444; background: #2a2a2a; color: #e8e8e8; cursor: pointer; }
      button.primary { background: #2f5f9b; border-color: #3d74b8; }
      button.danger { border-color: #7a2f2f; color: #ffb4b4; }
      a { color: #9ad8f5; font-size: 11px; }
      .err { color: #ffb4b4; }
      .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    </style>
    <div class="row">
      <h1>${escapeHtml(d.applicationName)}</h1>
      <span class="status ${escapeHtml(d.status)}">${escapeHtml(d.status.replace(/_/g, " "))}</span>
    </div>
    <div class="muted">${escapeHtml(CARD_VIEW_LABEL[cardView])} · ${escapeHtml(d.executionId)}</div>
    ${cardView === "failed" ? failedSection(fail, fileLine, logs) : ""}
    ${cardView === "deploying" ? d.stages.map(stageRow).join("") : ""}
    ${cardView === "approval" ? `<p class="bodycopy">Policy checks passed. A human gate remains before production.${d.approvalStatus ? ` Status: ${escapeHtml(d.approvalStatus)}.` : ""}</p>` : ""}
    ${cardView === "publish" ? `<p class="bodycopy">Preview is ready. Publish when you want this build in production.</p>` : ""}
    ${cardView === "live" ? `<p class="bodycopy">Production is live. Roll back from here if you need to revert.</p>` : ""}
    ${linkSection(d)}
    ${d.requestedAction && cardView !== "failed" ? `<p class="muted">${escapeHtml(d.requestedAction)}</p>` : ""}
    <div class="actions">${actionButtons(cardView, d, running)}</div>
  `;
}

function failedSection(
  fail: StageFailure | null,
  fileLine: string,
  logs: string[],
): string {
  if (!fail) return "";
  return `
    ${logs.length ? `<pre>${logs.map(escapeHtml).join("\n")}</pre>` : ""}
    ${fileLine ? `<div class="fileline">${escapeHtml(fileLine)}</div>` : ""}
    <div class="failbox">
      <strong>${escapeHtml(fail.summary)}</strong>
      ${fail.agentInstruction ? `<div class="muted" style="margin-top:6px">Fix: ${escapeHtml(fail.agentInstruction)}</div>` : ""}
    </div>
  `;
}

function linkSection(d: VibeDeployment): string {
  const links = [];
  if (d.previewUrl) {
    links.push(`<a href="${escapeHtml(d.previewUrl)}" target="_blank" rel="noreferrer">Preview</a>`);
  }
  if (d.productionUrl) {
    links.push(`<a href="${escapeHtml(d.productionUrl)}" target="_blank" rel="noreferrer">Production</a>`);
  }
  return links.length ? `<div class="links">${links.join("")}</div>` : "";
}

function actionButtons(cardView: CardView, d: VibeDeployment, running: boolean): string {
  switch (cardView) {
    case "failed":
      return `
        <button class="primary" data-cmd="retry">Retry</button>
        ${running ? `<button class="danger" data-cmd="cancel">Cancel</button>` : ""}
      `;
    case "deploying":
      return `
        <button data-cmd="refresh">Refresh</button>
        <button class="danger" data-cmd="cancel">Cancel</button>
      `;
    case "approval":
      return `
        ${d.previewUrl ? `<button data-cmd="open-preview">Open preview</button>` : ""}
        <button data-cmd="refresh">Refresh</button>
        <button data-cmd="approval">Nudge approvers</button>
      `;
    case "publish":
      return `
        <button class="primary" data-cmd="publish">Publish</button>
        ${d.previewUrl ? `<button data-cmd="open-preview">Review preview</button>` : ""}
        <button data-cmd="refresh">Refresh</button>
      `;
    case "live":
      return `
        <button data-cmd="refresh">Refresh</button>
        <button class="danger" data-cmd="rollback">Rollback</button>
      `;
  }
}

function stageRow(stage: VibeDeploymentStage): string {
  return `<div class="stage"><span class="dot ${escapeHtml(stage.status)}"></span><div>
    <div>${escapeHtml(stage.label)}</div>
    <div class="muted">${escapeHtml(stage.status)}${stage.summary ? " · " + escapeHtml(stage.summary) : ""}</div>
  </div></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
