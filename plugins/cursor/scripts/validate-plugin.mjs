#!/usr/bin/env node
// Validator for the Harness Cursor plugin subtree (plugins/cursor/) in harness-ai.
// Mirrors the checks in cursor/plugin-template/scripts/validate-template.mjs
// but tailored for a single-plugin directory (not the monorepo root).
//
// Exits non-zero on any error. Prints warnings but does not fail on them.
// Run: node scripts/validate-plugin.mjs

import { promises as fs } from "node:fs";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const errors = [];
const warnings = [];
const oks = [];

const pluginNamePattern = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

function ok(msg) { oks.push(msg); }
function warn(msg) { warnings.push(msg); }
function err(msg) { errors.push(msg); }

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

async function isExecutable(p) {
  try { await fs.access(p, fsConstants.X_OK); return true; } catch { return false; }
}

async function readJson(p) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return null;
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const block = normalized.slice(4, end);
  const fields = {};
  for (const line of block.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    fields[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  return fields;
}

function isSafeRelative(p) {
  if (!p || typeof p !== "string") return false;
  if (p.startsWith("/") || /^[a-zA-Z]:\\/.test(p)) return false;
  const parts = p.split(/[/\\]/);
  return !parts.includes("..");
}

// ---------------------------------------------------------------------------
// 1. Plugin subtree layout (single plugin directory)
// ---------------------------------------------------------------------------
/** @returns {Promise<boolean>} false if cwd is wrong — caller must skip other checks */
async function checkLayout() {
  const marketplacePath = path.join(repoRoot, ".cursor-plugin", "marketplace.json");
  const manifestPath = path.join(repoRoot, ".cursor-plugin", "plugin.json");

  if (await exists(marketplacePath)) {
    if (await exists(manifestPath)) {
      err("Invalid layout: both marketplace.json and plugin.json under .cursor-plugin");
    } else {
      err(
        "Found .cursor-plugin/marketplace.json at cwd — this is the harness-ai monorepo root. " +
          "Run: cd plugins/cursor && node scripts/validate-plugin.mjs"
      );
    }
    return false;
  }
  ok("Plugin directory: no local .cursor-plugin/marketplace.json (marketplace lives at repo root)");

  if (await exists(path.join(repoRoot, "plugins"))) {
    err(
      "Found plugins/ directory under cwd — validator must run inside plugins/cursor, not a parent folder"
    );
    return false;
  }
  ok("No nested plugins/ subdir under this plugin root");
  return true;
}

// ---------------------------------------------------------------------------
// 2. Plugin manifest
// ---------------------------------------------------------------------------
async function checkManifest() {
  const manifestPath = path.join(repoRoot, ".cursor-plugin", "plugin.json");
  if (!(await exists(manifestPath))) {
    err(".cursor-plugin/plugin.json is missing");
    return null;
  }
  ok(".cursor-plugin/plugin.json exists");

  let manifest;
  try { manifest = await readJson(manifestPath); ok("plugin.json is valid JSON"); }
  catch (e) { err(`plugin.json invalid JSON: ${e.message}`); return null; }

  if (!manifest.name) err("plugin.json missing required field: name");
  else if (!pluginNamePattern.test(manifest.name)) err(`plugin.json name "${manifest.name}" doesn't match ^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$`);
  else ok(`plugin.json name "${manifest.name}" matches kebab-case pattern`);

  if (manifest.logo) {
    if (!isSafeRelative(manifest.logo) && !/^https?:\/\//.test(manifest.logo)) {
      err(`plugin.json logo path unsafe: "${manifest.logo}"`);
    } else if (isSafeRelative(manifest.logo)) {
      const logoPath = path.join(repoRoot, manifest.logo);
      if (!(await exists(logoPath))) err(`plugin.json logo path does not resolve: ${manifest.logo}`);
      else ok(`plugin.json logo "${manifest.logo}" resolves`);
    }
  } else {
    warn("plugin.json has no logo field");
  }

  for (const field of ["mcpServers", "hooks", "rules", "skills", "agents", "commands"]) {
    const val = manifest[field];
    if (typeof val === "string" && !isSafeRelative(val)) {
      err(`plugin.json ${field} path unsafe: "${val}"`);
    }
  }

  return manifest;
}

// ---------------------------------------------------------------------------
// 3. mcp.json
// ---------------------------------------------------------------------------
async function checkMcpJson() {
  const p = path.join(repoRoot, "mcp.json");
  if (!(await exists(p))) { warn("no mcp.json at repo root"); return; }
  ok("mcp.json exists (exact filename)");

  let cfg;
  try { cfg = await readJson(p); ok("mcp.json is valid JSON"); }
  catch (e) { err(`mcp.json invalid JSON: ${e.message}`); return; }

  if (!cfg.mcpServers || typeof cfg.mcpServers !== "object") {
    err("mcp.json must have a top-level `mcpServers` object (Cursor plugin spec)");
    return;
  }
  ok(`mcp.json has mcpServers key with ${Object.keys(cfg.mcpServers).length} server(s)`);
}

// ---------------------------------------------------------------------------
// 4. hooks/hooks.json
// ---------------------------------------------------------------------------
const KNOWN_HOOK_EVENTS = new Set([
  "sessionStart", "sessionEnd",
  "preToolUse", "postToolUse", "postToolUseFailure",
  "subagentStart", "subagentStop",
  "beforeShellExecution", "afterShellExecution",
  "beforeMCPExecution", "afterMCPExecution",
  "beforeReadFile", "afterFileEdit",
  "beforeSubmitPrompt", "preCompact", "stop",
  "afterAgentResponse", "afterAgentThought",
  "beforeTabFileRead", "afterTabFileEdit",
]);

async function checkHooks() {
  const p = path.join(repoRoot, "hooks", "hooks.json");
  if (!(await exists(p))) { warn("no hooks/hooks.json (only needed if using hooks)"); return; }
  ok("hooks/hooks.json exists");

  let cfg;
  try { cfg = await readJson(p); ok("hooks/hooks.json is valid JSON"); }
  catch (e) { err(`hooks/hooks.json invalid JSON: ${e.message}`); return; }

  const hooks = cfg.hooks || {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!KNOWN_HOOK_EVENTS.has(event)) {
      err(`hooks/hooks.json unknown event: "${event}" (see cursor.com/docs/agent/hooks)`);
      continue;
    }
    for (const entry of entries || []) {
      const cmd = entry.command;
      if (!cmd) { err(`hooks/hooks.json ${event}: missing command`); continue; }
      if (!isSafeRelative(cmd.replace(/^\.\//, ""))) {
        err(`hooks/hooks.json ${event}: unsafe command path "${cmd}"`);
        continue;
      }
      const resolved = path.join(repoRoot, cmd.replace(/^\.\//, ""));
      if (!(await exists(resolved))) {
        err(`hooks/hooks.json ${event}: command not found "${cmd}"`);
      } else if (!(await isExecutable(resolved))) {
        err(`hooks/hooks.json ${event}: command not executable "${cmd}" (run chmod +x)`);
      } else {
        ok(`hook ${event} -> ${cmd} exists and is executable`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Rules — every file in rules/ must have `description` frontmatter
// ---------------------------------------------------------------------------
async function checkRules() {
  const dir = path.join(repoRoot, "rules");
  if (!(await exists(dir))) return;
  const files = (await fs.readdir(dir)).filter((f) => /\.(md|mdc|markdown)$/.test(f));
  let okCount = 0;
  for (const f of files) {
    const content = await fs.readFile(path.join(dir, f), "utf8");
    const fm = parseFrontmatter(content);
    if (!fm) { err(`rules/${f}: missing YAML frontmatter`); continue; }
    if (!fm.description) { err(`rules/${f}: frontmatter missing "description"`); continue; }
    okCount++;
  }
  ok(`rules/: ${okCount}/${files.length} files have valid frontmatter`);
}

// ---------------------------------------------------------------------------
// 6. Skills — each <dir>/SKILL.md must have name+description, name matches dir
// ---------------------------------------------------------------------------
async function checkSkills() {
  const dir = path.join(repoRoot, "skills");
  if (!(await exists(dir))) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const skills = entries.filter((e) => e.isDirectory());
  let okCount = 0;
  for (const s of skills) {
    const sp = path.join(dir, s.name, "SKILL.md");
    if (!(await exists(sp))) { err(`skills/${s.name}/SKILL.md missing`); continue; }
    const content = await fs.readFile(sp, "utf8");
    const fm = parseFrontmatter(content);
    if (!fm) { err(`skills/${s.name}/SKILL.md: missing frontmatter`); continue; }
    if (!fm.name) { err(`skills/${s.name}/SKILL.md: missing name`); continue; }
    if (!fm.description) { err(`skills/${s.name}/SKILL.md: missing description`); continue; }
    if (fm.name !== s.name) {
      err(`skills/${s.name}/SKILL.md: name "${fm.name}" doesn't match directory "${s.name}"`);
      continue;
    }
    okCount++;
  }
  ok(`skills/: ${okCount}/${skills.length} skills have valid frontmatter + matching directory name`);
}

// ---------------------------------------------------------------------------
// 7. Scripts — every .mjs in scripts/ passes node --check
// ---------------------------------------------------------------------------
async function checkScripts() {
  const dir = path.join(repoRoot, "scripts");
  if (!(await exists(dir))) return;
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".mjs"));
  const { spawnSync } = await import("node:child_process");
  for (const f of files) {
    const p = path.join(dir, f);
    const res = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
    if (res.status !== 0) { err(`scripts/${f}: node --check failed: ${res.stderr.trim()}`); continue; }
    ok(`scripts/${f}: Node syntax OK`);
  }
}

// ---------------------------------------------------------------------------
async function main() {
  const layoutOk = await checkLayout();
  if (!layoutOk) {
    for (const m of oks) console.log(`[OK]    ${m}`);
    for (const m of warnings) console.log(`[WARN]  ${m}`);
    for (const m of errors) console.error(`[ERROR] ${m}`);
    console.log(`\nSummary: ${oks.length} ok, ${warnings.length} warnings, ${errors.length} errors`);
    process.exit(1);
  }

  const manifest = await checkManifest();
  await checkMcpJson();
  await checkHooks();
  await checkRules();
  await checkSkills();
  await checkScripts();

  for (const m of oks) console.log(`[OK]    ${m}`);
  for (const m of warnings) console.log(`[WARN]  ${m}`);
  for (const m of errors) console.error(`[ERROR] ${m}`);

  console.log(`\nSummary: ${oks.length} ok, ${warnings.length} warnings, ${errors.length} errors`);
  if (manifest?.name) console.log(`Plugin: ${manifest.name}@${manifest.version ?? "?"}`);
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Validator crashed:", e);
  process.exit(2);
});
