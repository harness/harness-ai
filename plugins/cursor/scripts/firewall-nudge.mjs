#!/usr/bin/env node
// postToolUseFailure hook — fires on Shell command failures.
// If the failure looks like a network/registry firewall or policy block
// (HTTP 403, Forbidden, explicit policy rejection) rather than a bad
// command or local misconfiguration, attach a nudge as additional_context
// so the agent considers allowlisting/mirrors/proxy config before retrying
// or rewriting the command.

const NOOP = {};

const PATTERNS = [
  /\b403\b/i,
  /\bforbidden\b/i,
  /\bblocked by\b.{0,80}\b(?:policy|firewall)\b/i,
  /policy check (?:error|failed|denied)/i,
  /proxy.{0,20}(?:reject|denied|block)|(?:rejected|denied|blocked) by (?:a |the )?proxy/i,
  /network is unreachable/i,
  /econnreset|eproto/i,
  /request blocked/i,
];

async function main() {
  const input = await readStdinJson();
  if (!input) { console.log(JSON.stringify(NOOP)); return; }
  if (input.failure_type === "permission_denied" || input.is_interrupt) {
    console.log(JSON.stringify(NOOP));
    return;
  }

  const command = input.tool_input?.command || "";
  const text = input.error_message || "";

  if (!text.trim() || !PATTERNS.some((re) => re.test(text))) {
    console.log(JSON.stringify(NOOP));
    return;
  }

  console.log(JSON.stringify({
    additional_context: [
      "This command's failure matches a network/registry firewall or policy-block",
      "signature (HTTP 403, Forbidden, or an explicit policy rejection), not",
      "necessarily a bad package name or local misconfiguration. Before retrying or",
      "changing the command itself, consider: is this host/registry allowlisted by",
      "the corporate proxy or package firewall? Is there an internal mirror to use",
      "instead? Would a VPN/proxy setting or an allowlist request to the",
      "network/platform team unblock it?",
      "If this is a package download blocked by the Harness Artifact Registry",
      "(HAR) firewall specifically, use the dependency-firewall skill if available",
      "to investigate and resolve this.",
      command ? `Command that failed: \`${command}\`` : "",
    ].filter(Boolean).join(" "),
  }));
}

async function readStdinJson() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

main().catch(() => {
  // Fail open on any error — hooks should not block the agent on our bugs.
  console.log(JSON.stringify(NOOP));
});
