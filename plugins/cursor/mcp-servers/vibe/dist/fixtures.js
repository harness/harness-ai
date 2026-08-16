const APP_ID = "c0de0001-1111-4111-8111-000000000001";
const APP_NAME = "GreenFork";
const EXEC_FAILED = "c0de0001-1111-4111-8111-000000000002";
const EXEC_RUNNING = "c0de0001-1111-4111-8111-000000000003";
const EXEC_OK = "c0de0001-1111-4111-8111-000000000004";
const EXEC_INPUT = "c0de0001-1111-4111-8111-000000000005";
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
const FAILED_BUILD_LOGS = [
    "npm run build",
    "src/App.tsx:42:1 - error TS2304: Cannot find name 'Button'.",
    "Found 1 error.",
];
export const FIXTURES = {
    failed: {
        applicationId: APP_ID,
        applicationName: APP_NAME,
        deploymentId: EXEC_FAILED,
        executionId: EXEC_FAILED,
        status: "failed",
        currentStageKey: "app_build",
        previewUrl: null,
        requestedAction: "Fix the missing import in src/App.tsx:42 and retry.",
        failure: {
            stageKey: "app_build",
            summary: "TypeScript build failed: Cannot find name 'Button'.",
            file: "src/App.tsx",
            line: 42,
            logLines: FAILED_BUILD_LOGS,
            agentInstruction: "Fix the missing import in src/App.tsx:42 and retry.",
        },
        stages: [
            { key: "source_import", label: "Source import", status: "completed", summary: "Workspace imported", logs: [], failure: null },
            { key: "app_discovery", label: "App discovery", status: "completed", summary: "Detected React app", logs: [], failure: null },
            {
                key: "app_build",
                label: "App build",
                status: "failed",
                summary: "tsc failed on src/App.tsx:42",
                logs: FAILED_BUILD_LOGS,
                failure: {
                    stageKey: "app_build",
                    summary: "TypeScript build failed: Cannot find name 'Button'.",
                    file: "src/App.tsx",
                    line: 42,
                    logLines: FAILED_BUILD_LOGS,
                    agentInstruction: "Fix the missing import in src/App.tsx:42 and retry.",
                },
            },
            { key: "preview", label: "Preview", status: "pending", summary: null, logs: [], failure: null },
        ],
    },
    running: {
        applicationId: APP_ID,
        applicationName: APP_NAME,
        deploymentId: EXEC_RUNNING,
        executionId: EXEC_RUNNING,
        status: "running",
        currentStageKey: "app_build",
        previewUrl: null,
        requestedAction: "Wait for the build to finish.",
        failure: null,
        stages: [
            { key: "source_import", label: "Source import", status: "completed", summary: "Workspace imported", logs: [], failure: null },
            { key: "app_discovery", label: "App discovery", status: "completed", summary: "Detected React app", logs: [], failure: null },
            { key: "app_build", label: "App build", status: "processing", summary: "npm run build", logs: ["npm run build"], failure: null },
            { key: "preview", label: "Preview", status: "pending", summary: null, logs: [], failure: null },
        ],
    },
    succeeded: {
        applicationId: APP_ID,
        applicationName: APP_NAME,
        deploymentId: EXEC_OK,
        executionId: EXEC_OK,
        status: "succeeded",
        currentStageKey: "preview",
        previewUrl: "https://preview.example.harness.io/greenfork",
        requestedAction: "Preview is live. Reply publish to ship (confirm first).",
        failure: null,
        stages: [
            { key: "source_import", label: "Source import", status: "completed", summary: "Workspace imported", logs: [], failure: null },
            { key: "app_discovery", label: "App discovery", status: "completed", summary: "Detected React app", logs: [], failure: null },
            { key: "app_build", label: "App build", status: "completed", summary: "Build succeeded", logs: ["npm run build", "built in 3.1s"], failure: null },
            { key: "preview", label: "Preview", status: "completed", summary: "Preview published", logs: [], failure: null },
        ],
    },
    needs_input: {
        applicationId: APP_ID,
        applicationName: APP_NAME,
        deploymentId: EXEC_INPUT,
        executionId: EXEC_INPUT,
        status: "needs_input",
        currentStageKey: "preview",
        previewUrl: null,
        requestedAction: "Provide SPRING_DATASOURCE_PASSWORD to continue.",
        failure: null,
        inputsRequired: [{ key: "SPRING_DATASOURCE_PASSWORD", type: "secret", secret: true }],
        stages: [
            { key: "source_import", label: "Source import", status: "completed", summary: "Workspace imported", logs: [], failure: null },
            { key: "app_discovery", label: "App discovery", status: "completed", summary: "Detected React app", logs: [], failure: null },
            { key: "app_build", label: "App build", status: "completed", summary: "Build succeeded", logs: [], failure: null },
            { key: "preview", label: "Preview", status: "pending", summary: "Waiting on secret", logs: [], failure: null },
        ],
    },
};
export function fixture(name) {
    return clone(FIXTURES[name]);
}
