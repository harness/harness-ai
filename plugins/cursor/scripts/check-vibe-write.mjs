#!/usr/bin/env node
// beforeMCPExecution hook — fires on Vibe write tools from the mock harness-vibe MCP.
// Asks on deploy/cancel so the plugin governance loop is visible. Allows retry.
// Fail-open: any parse/runtime error emits permission: "allow".

const ALLOW = { permission: "allow" };
const ASK_TOOLS = new Set(["deploy_vibe_app", "cancel_vibe_deployment"]);

async function main() {
  const input = await readStdinJson();
  const name = String(input?.tool_name || "");
  if (!ASK_TOOLS.has(name)) {
    console.log(JSON.stringify(ALLOW));
    return;
  }

  const label = name === "cancel_vibe_deployment" ? "cancel this mock Vibe deployment" : "run this mock Vibe deploy";
  console.log(JSON.stringify({
    permission: "ask",
    user_message: `Confirm to ${label}. This is a mock — no real app will be deployed.`,
    agent_message: "Mock Vibe MCP write. Confirm with the user. The in-memory fixture is the only thing that will change.",
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
