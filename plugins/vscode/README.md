# Harness DevOps — VS Code Agent Plugin

AI-native interface to Harness CI/CD for VS Code and GitHub Copilot.

## What You Get

- **11 MCP tools** covering 144+ Harness resource types
- **27 skills** for multi-step DevOps workflows (pipeline creation, failure debugging, cost analysis, etc.)
- **Custom @harness agent** with Harness operating model built in

## Install

Search `@agentPlugins harness` in VS Code Copilot Chat, or:

```bash
# From the VS Code marketplace (coming soon)
code --install-plugin harness
```

## Auth Modes

### Remote MCP + OAuth (default)
No configuration needed. On first tool call, VS Code opens a browser popup to authorize with your Harness account. Tokens are managed automatically.

### Remote MCP + PAT
For headless/CI environments, edit `.mcp.json`:
```json
{
  "mcpServers": {
    "harness": {
      "type": "http",
      "url": "https://mcp.harness.io/mcp",
      "headers": {
        "Authorization": "Bearer ${input:harness-pat}"
      }
    }
  }
}
```

### OSS MCP + PAT (local)
For air-gapped or offline environments:
```json
{
  "mcpServers": {
    "harness": {
      "command": "npx",
      "args": ["-y", "harness-mcp-v2"],
      "env": {
        "HARNESS_API_KEY": "${input:harness-pat}",
        "HARNESS_ACCOUNT_ID": "${input:harness-account-id}"
      }
    }
  }
}
```

## Usage

### Tier 1 — Automatic (no @harness needed)
Just ask naturally in Copilot Chat:
- "List my failing pipelines"
- "Help me create a deployment pipeline for my Node.js app"
- "What's the cost breakdown for my AWS infrastructure?"

### Tier 2 — Guided (@harness)
Type `@harness` for the specialized DevOps agent:
- `@harness debug the last failed execution of my deploy pipeline`
- `@harness set up a new microservice with CI/CD from scratch`

## License

Apache-2.0
