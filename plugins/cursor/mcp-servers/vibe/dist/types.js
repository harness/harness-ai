export function toVibeApp(app) {
    return {
        id: app.id,
        name: app.name,
        status: app.status,
        previewUrl: app.previewUrl ?? null,
        approvalStatus: app.approvalStatus,
        productionUrl: app.productionUrl ?? null,
    };
}
export function deploymentLogs(deployment, stageKey) {
    const stages = stageKey
        ? deployment.stages.filter((stage) => stage.key === stageKey)
        : deployment.stages;
    const lines = stages.flatMap((stage) => [
        ...(stage.logs ?? []),
        ...(stage.failure?.logLines ?? []),
    ]);
    const fromFailure = deployment.failure?.logLines ?? [];
    return { lines: lines.length ? lines : fromFailure.length ? fromFailure : ["(no logs)"] };
}
