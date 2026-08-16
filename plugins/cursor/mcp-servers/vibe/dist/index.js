#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerVibeTools } from "./tools.js";
const server = new McpServer({
    name: "harness-vibe",
    version: "0.1.0",
});
registerVibeTools(server);
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Harness Vibe MCP running on stdio (vibe-api HTTP)");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
