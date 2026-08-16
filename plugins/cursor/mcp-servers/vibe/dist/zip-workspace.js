import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
const EXCLUDES = [
    "*/.git/*",
    ".git/*",
    "*/node_modules/*",
    "node_modules/*",
    "*/dist/*",
    "*/build/*",
    "*/.next/*",
    "*/target/*",
    ".env",
    ".env.*",
    "*.pem",
    ".harness/*",
    ".cursor/*",
];
export async function zipWorkspace(root) {
    const dir = await mkdtemp(join(tmpdir(), "vibe-mcp-"));
    const zipPath = join(dir, "source.zip");
    await runZip(root, zipPath);
    const buffer = await readFile(zipPath);
    return new Uint8Array(buffer);
}
function runZip(cwd, dest) {
    return new Promise((resolve, reject) => {
        const args = ["-r", dest, ".", "-x", ...EXCLUDES];
        const child = spawn("zip", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", (error) => {
            reject(new Error(`zip is required to package the workspace: ${error.message}`));
        });
        child.on("close", (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`zip exited ${code}: ${stderr}`));
        });
    });
}
