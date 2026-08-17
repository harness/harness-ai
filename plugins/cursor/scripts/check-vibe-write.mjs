#!/usr/bin/env node
// beforeMCPExecution hook — fires on Vibe write tools from harness-vibe MCP.
// Asks on confirmed deploy (zip + submit) and cancel. Allows form-only deploy
// (confirm !== true) and retry. Fail-open: any parse/runtime error emits permission: "allow".

const ALLOW = { permission: "allow" };
const ASK_TOOLS = new Set(["deploy_vibe_app", "cancel_vibe_deployment"]);

async function main() {
  const input = await readStdinJson();
  const name = String(input?.tool_name || "").replace(/^MCP:/, "");
  if (!ASK_TOOLS.has(name)) {
    console.log(JSON.stringify(ALLOW));
    return;
  }

  if (name === "deploy_vibe_app" && input?.tool_input?.confirm !== true) {
    console.log(JSON.stringify(ALLOW));
    return;
  }

  const label =
    name === "cancel_vibe_deployment"
      ? "cancel this Vibe deployment"
      : "submit this workspace to vibe-api and start a deployment";
  console.log(JSON.stringify({
    permission: "ask",
    user_message: `Confirm to ${label}. This talks to vibe-api (VIBE_API_BASE_URL, default http://localhost:8090).`,
    agent_message: "Vibe MCP write against vibe-api. Confirm with the user before proceeding.",
  }));
}

async function readStdinJson() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

main().catch(() => {
  console.log(JSON.stringify(ALLOW));
});
