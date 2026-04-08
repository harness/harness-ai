Help me create a new Harness CI/CD pipeline.

First, confirm my organization and project. Then:
1. If source code is available, analyze the codebase to detect language, build tools, test framework, Dockerfile, and deployment manifests.
2. Use `harness_describe(resource_type="pipeline")` to get the pipeline schema.
3. Generate pipeline YAML based on the analysis.
4. Use `harness_create` to push the pipeline to Harness.

Ask me about the deployment target (Kubernetes, ECS, serverless) if not obvious from the codebase.
