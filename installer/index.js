#!/usr/bin/env node

import * as p from "@clack/prompts";
import { execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const HOME = homedir();
const MCP_PACKAGE = "harness-mcp-v2";
const SKILLS_REPO = "thisrohangupta/harness-skills";

// Each agent has:
//   value          — id used by add-mcp (e.g. `add-mcp -a cursor`)
//   skillsAgent    — id used by npx skills (e.g. `skills -a cursor`)
//   globalSkillsDir — agent-specific global skills path, if it differs from ~/.agents/skills/
//   label          — display name
//   check          — returns true if the agent is detected on this machine
//
// globalSkillsDir is set for agents affected by vercel-labs/skills#537: the CLI
// doesn't create agent-specific directories for agents whose project skillsDir
// is .agents/skills/. We mkdir -p these ourselves after install.
const AGENTS = [
  { value: "cursor",         skillsAgent: "cursor",         globalSkillsDir: join(HOME, ".cursor", "skills"),  label: "Cursor",            check: () => hasApp("Cursor.app") || hasConfig(".cursor") },
  { value: "vscode",         skillsAgent: "github-copilot", globalSkillsDir: join(HOME, ".copilot", "skills"), label: "VS Code (Copilot)",  check: () => hasApp("Visual Studio Code.app") || hasCmd("code") },
  { value: "claude-code",    skillsAgent: "claude-code",    globalSkillsDir: null,                             label: "Claude Code",        check: () => hasCmd("claude") },
  // TODO: Claude Desktop runs sandboxed — skills from ~/.claude/skills/ are NOT mounted in the
  // container (/mnt/skills/). MCP tools work, but skills don't. Set skillsAgent to null once
  // confirmed there's no workaround. Tracked: anthropics/claude-code#26254, #31542
  { value: "claude-desktop", skillsAgent: "claude-code",    globalSkillsDir: null,                             label: "Claude Desktop",     check: () => hasApp("Claude.app") },
  { value: "codex",          skillsAgent: "codex",          globalSkillsDir: join(HOME, ".codex", "skills"),   label: "Codex",              check: () => hasCmd("codex") || hasApp("Codex.app") },
  { value: "gemini-cli",     skillsAgent: "gemini-cli",     globalSkillsDir: join(HOME, ".gemini", "skills"),  label: "Gemini CLI",         check: () => hasCmd("gemini") },
  { value: "cline",          skillsAgent: "cline",          globalSkillsDir: null,                             label: "Cline",              check: () => hasConfig("Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev") },
  { value: "goose",          skillsAgent: "goose",          globalSkillsDir: null,                             label: "Goose",              check: () => hasCmd("goose") },
];

// GUI agents whose MCP config files need env vars injected after add-mcp creates them
const GUI_CONFIGS = {
  cursor: { path: join(HOME, ".cursor", "mcp.json"), key: "mcpServers" },
  vscode: {
    path: join(HOME, "Library", "Application Support", "Code", "User", "mcp.json"),
    key: "servers",
  },
  "claude-desktop": {
    path: join(HOME, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    key: "mcpServers",
  },
};

// --- Detection helpers ---

function hasCmd(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasApp(name) {
  return existsSync(join("/Applications", name));
}

function hasConfig(relPath) {
  return existsSync(join(HOME, relPath));
}

// --- Execution helpers ---

function runStep(label, cmd) {
  p.log.step(label);
  try {
    execSync(cmd, { stdio: "inherit" });
    return true;
  } catch {
    p.log.error(`${label} failed. Check the output above for details.`);
    return false;
  }
}

async function ask(promptFn) {
  const result = await promptFn();
  if (p.isCancel(result)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  return result;
}

// --- Credential helpers ---

// Only handles bash/zsh. Fish (~/.config/fish/config.fish) uses `set -x` syntax — not supported yet.
function getShellProfile() {
  const shell = process.env.SHELL || "/bin/zsh";
  const rc = shell.includes("bash") ? ".bashrc" : ".zshrc";
  return join(HOME, rc);
}

function saveToShellProfile(apiKey, accountId) {
  const profilePath = getShellProfile();
  const existing = existsSync(profilePath) ? readFileSync(profilePath, "utf-8") : "";

  if (existing.includes("HARNESS_API_KEY")) {
    p.log.warn("HARNESS_API_KEY already exists in shell profile — skipping");
    return false;
  }

  const block = [
    "",
    "# Harness AI (added by harness-setup)",
    `export HARNESS_API_KEY='${apiKey.replace(/'/g, "'\\''")}'`,
    `export HARNESS_ACCOUNT_ID='${accountId.replace(/'/g, "'\\''")}'`,
    "",
  ].join("\n");

  appendFileSync(profilePath, block);
  return true;
}

function patchAgentConfig(agentId, envVars) {
  const spec = GUI_CONFIGS[agentId];
  if (!spec || !existsSync(spec.path)) return false;

  try {
    const config = JSON.parse(readFileSync(spec.path, "utf-8"));
    const servers = config[spec.key];
    if (!servers?.[MCP_PACKAGE]) return false;

    servers[MCP_PACKAGE].env = { ...servers[MCP_PACKAGE].env, ...envVars };
    writeFileSync(spec.path, JSON.stringify(config, null, 2) + "\n");
    return true;
  } catch (err) {
    p.log.warn(`Could not patch ${agentId} config: ${err.message}`);
    return false;
  }
}

async function promptForCredentials() {
  const existingKey = process.env.HARNESS_API_KEY;
  const existingAccount = process.env.HARNESS_ACCOUNT_ID;

  if (existingKey && existingAccount) {
    p.log.success("Harness credentials detected from environment");
    return { apiKey: existingKey, accountId: existingAccount };
  }

  const configCreds = await ask(() =>
    p.confirm({
      message: "Configure Harness credentials? (required for MCP tools to connect)",
      initialValue: true,
    })
  );

  if (!configCreds) return { apiKey: null, accountId: null };

  const apiKey = await ask(() =>
    p.password({
      message: "Harness API key (pat.xxx.xxx.xxx):",
      validate: (v) => {
        if (!v || v.length < 5) return "Enter a valid API key";
        if (!v.startsWith("pat.") && !v.startsWith("sat."))
          return "Key should start with pat. (personal) or sat. (service account)";
      },
    })
  );

  const accountId = await ask(() =>
    p.text({
      message: "Harness Account ID:",
      placeholder: "e.g. abc123xyz",
      validate: (v) => (!v?.trim() ? "Account ID is required" : undefined),
    })
  );

  const profilePath = getShellProfile();
  const saveToProfile = await ask(() =>
    p.confirm({
      message: `Save credentials to ${profilePath.replace(HOME, "~")}?`,
      initialValue: true,
    })
  );

  if (saveToProfile && saveToShellProfile(apiKey, accountId)) {
    p.log.success(`Credentials saved to ${profilePath.replace(HOME, "~")}`);
  }

  return { apiKey, accountId };
}

// --- Skills helpers ---

function cloneSkillsRepo() {
  const tmpDir = mkdtempSync(join(tmpdir(), "harness-skills-"));
  const ok = runStep(
    "Cloning skills repo...",
    `git clone --depth 1 https://github.com/${SKILLS_REPO}.git ${tmpDir}`
  );
  if (!ok) {
    rmSync(tmpDir, { recursive: true, force: true });
    return null;
  }
  return tmpDir;
}

function readSkillNames(repoDir) {
  const skillsDir = join(repoDir, "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter((name) =>
    existsSync(join(skillsDir, name, "SKILL.md"))
  );
}

function buildSkillsAgentFlags(selectedAgents) {
  const unique = [...new Set(selectedAgents.map((a) => a.skillsAgent).filter(Boolean))];
  return unique.map((a) => `-a ${a}`).join(" ");
}

// --- Uninstall ---

async function uninstall() {
  p.intro("Harness AI — Uninstall");

  const scope = await ask(() =>
    p.select({
      message: "Remove skills from which scope?",
      options: [
        { value: "project", label: "This project only" },
        { value: "global", label: "Global (all projects)" },
      ],
      initialValue: "project",
    })
  );

  if (scope === "global") {
    const confirmed = await ask(() =>
      p.confirm({
        message: "This will remove Harness skills from ALL projects. Continue?",
        initialValue: false,
      })
    );
    if (!confirmed) {
      p.outro("Uninstall cancelled.");
      process.exit(0);
    }
  }

  const scopeFlag = scope === "global" ? "-g" : "";

  const tmpDir = cloneSkillsRepo();
  if (!tmpDir) process.exit(1);

  try {
    const skillNames = readSkillNames(tmpDir);
    if (skillNames.length === 0) {
      p.log.warn("No skills found in the Harness skills repo.");
      return;
    }

    p.log.info(`Found ${skillNames.length} Harness skills to remove`);

    const ok = runStep(
      "Removing Harness skills...",
      `npx -y skills remove ${skillNames.join(" ")} ${scopeFlag} -y`
    );

    if (ok) {
      p.log.success(`${skillNames.length} Harness skills removed (${scope})`);
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  p.note(
    "MCP server configs were not removed.\nTo remove manually, run: npx add-mcp --help",
    "Note"
  );

  p.outro("Harness skills uninstalled.");
}

// --- Install (main) ---

async function install() {
  p.intro("Harness AI Setup");

  p.note(
    [
      "This will configure your AI coding agents with:",
      "",
      "  • MCP tools covering 144+ Harness resource types",
      "    (via add-mcp by Neon)",
      "",
      "  • 27 DevOps skills for pipelines, deployments, security, costs & more",
      "    (via skills by Vercel Labs)",
    ].join("\n"),
    "What you get"
  );

  // Detect installed agents
  const detected = AGENTS.filter((a) => a.check());

  if (detected.length === 0) {
    p.log.warn("No supported AI agents detected on this machine.");
    p.log.info("Supported: " + AGENTS.map((a) => a.label).join(", "));
    p.outro("Install one of the above and re-run: npx harness-setup");
    process.exit(0);
  }

  p.log.success(`Detected ${detected.length} agent${detected.length > 1 ? "s" : ""} on this machine`);

  // Ask which agents to configure
  const selectedAgents = await ask(() =>
    p.multiselect({
      message: "Which agents should Harness be added to?",
      options: detected.map((a) => ({ value: a, label: a.label })),
      initialValues: detected,
      required: true,
    })
  );

  // Ask whether to install skills
  const installSkills = await ask(() =>
    p.confirm({
      message: "Install 27 DevOps skills? (recommended)",
      initialValue: true,
    })
  );

  // Ask for installation scope
  const scope = await ask(() =>
    p.select({
      message: "Installation scope:",
      options: [
        { value: "global", label: "Global (recommended) — available in all projects" },
        { value: "project", label: "This project only — installed in current directory" },
      ],
      initialValue: "global",
    })
  );

  const scopeFlag = scope === "global" ? "-g" : "";

  const { apiKey, accountId } = await promptForCredentials();

  // Build agent flags for add-mcp (uses agent.value)
  const mcpAgentFlags = selectedAgents.map((a) => `-a ${a.value}`).join(" ");

  // Step 1: Configure MCP tools
  const mcpOk = runStep(
    "Configuring MCP tools...",
    `npx -y add-mcp ${MCP_PACKAGE} ${mcpAgentFlags} ${scopeFlag} -y`
  );
  if (!mcpOk) process.exit(1);
  p.log.success("MCP tools configured");

  // Step 2: Inject credentials into GUI agent configs (must run after add-mcp creates the config files)
  if (apiKey && accountId) {
    const envVars = { HARNESS_API_KEY: apiKey, HARNESS_ACCOUNT_ID: accountId };
    const guiAgents = selectedAgents.filter((a) => a.value in GUI_CONFIGS);
    let patched = 0;

    for (const agent of guiAgents) {
      if (patchAgentConfig(agent.value, envVars)) {
        patched++;
        p.log.success(`Credentials added to ${agent.label} config`);
      }
    }

    if (guiAgents.length > 0 && patched === 0) {
      p.log.info("GUI agent configs not found yet — credentials will be picked up from shell environment");
    }
  }

  // Step 3: Install skills (clone locally to avoid remote security audit overhead)
  if (installSkills) {
    const skillsAgentFlags = buildSkillsAgentFlags(selectedAgents);

    const tmpDir = cloneSkillsRepo();
    if (!tmpDir) process.exit(1);

    try {
      const skillsOk = runStep(
        "Installing DevOps skills...",
        `npx -y skills add ${tmpDir} --skill '*' ${skillsAgentFlags} ${scopeFlag} -y`
      );
      if (!skillsOk) throw new Error("Skills installation failed");

      const count = readSkillNames(tmpDir).length;
      p.log.success(`${count} skills installed`);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }

    // Workaround for vercel-labs/skills#537: the CLI doesn't create agent-specific
    // global skill dirs for agents with skillsDir ".agents/skills/". Create them
    // so the skills show as linked rather than orphaned in ~/.agents/skills/.
    if (scope === "global") {
      for (const agent of selectedAgents) {
        if (agent.globalSkillsDir) {
          mkdirSync(agent.globalSkillsDir, { recursive: true });
        }
      }
    }
  }

  // Summary
  const summary = selectedAgents.map((a) => `  ✓ ${a.label}`).join("\n");
  const credsStatus = apiKey ? "configured" : "skipped (run again to add)";
  const skillCount = installSkills ? "installed" : "skipped";

  p.note(
    [
      summary,
      "",
      `MCP tools: configured (${scope})`,
      `Skills: ${skillCount} (${scope})`,
      `Credentials: ${credsStatus}`,
      "",
      "Open any of the above agents and ask:",
      '  "List my Harness pipelines"',
      '  "Debug my last failed deployment"',
      '  "Create a Kubernetes pipeline"',
    ].join("\n"),
    "Setup complete"
  );

  p.outro("Happy shipping! → https://github.com/thisrohangupta/harness-ai");
}

// --- Entry point ---

const isUninstall = process.argv.includes("--uninstall") || process.argv.includes("--remove");

(isUninstall ? uninstall() : install()).catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
