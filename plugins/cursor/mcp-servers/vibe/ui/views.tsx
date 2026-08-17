import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  Alert,
  Button,
  ButtonLayout,
  Card,
  FormInput,
  FormWrapper,
  IconV2,
  Layout,
  Link,
  Progress,
  ScrollArea,
  Skeleton,
  StackedList,
  StatsPanel,
  StatusBadge,
  Switch,
  Text,
  TooltipProvider,
  ViewOnly,
} from '@harnessio/ui/components';
import { PortalProvider } from '@harnessio/ui/context';
import type { AppUiView, AppView, DeploymentView, FixRequestView } from '../src/ui-view';
import type { EnvTileView, EnvTone, StageRailItem, StageRailStatus } from './deployment-card';
import {
  CARD_VIEW_LABEL,
  deriveDeploymentCardView,
  envTiles,
  groupStages,
  heroCopy,
  isDeploymentRunning,
  metricStats,
  type DeploymentCardView,
} from './deployment-card';
import { envToneTheme, stageTitleColor, statusTheme } from './status';

const POLL_MS = 1500;

const TERMINAL_CARD_VIEWS: DeploymentCardView[] = [
  'failed',
  'approval',
  'publish',
  'live',
  'cancelled',
];

const ENV_TONE_BG: Record<EnvTone, string> = {
  ok: 'bg-cn-success-secondary',
  err: 'bg-cn-danger-secondary',
  warn: 'bg-cn-warning-secondary',
  info: 'bg-cn-brand-secondary',
  idle: 'bg-cn-2',
};

const deployFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  enableCdn: z.boolean(),
});

type DeployFormValues = z.infer<typeof deployFormSchema>;

const appSettingsSchema = z.object({
  slug: z.string().trim().min(1),
  enableCdn: z.boolean(),
});

type AppSettingsValues = z.infer<typeof appSettingsSchema>;

type ToolArgValue = string | boolean | number | undefined | null;
type ToolArgs = Record<string, ToolArgValue>;

function asView(result: CallToolResult | null): AppUiView | null {
  const structured = result?.structuredContent;
  if (structured && typeof structured === 'object' && 'kind' in structured) {
    return structured as AppUiView;
  }
  return null;
}

function isRunningStatus(status: string): boolean {
  return status === 'running' || status === 'processing' || status === 'queued';
}

function Shell({ children }: { children: ReactNode }) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  return (
    <div className="cn-root bg-cn-1 p-cn-md dark" ref={setPortalContainer}>
      <PortalProvider portalContainer={portalContainer}>
        <TooltipProvider>
          <Card.Root size="sm" interactive={false}>
            {children}
          </Card.Root>
        </TooltipProvider>
      </PortalProvider>
    </div>
  );
}

function VibeMcpApp() {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const { app, error } = useApp({
    appInfo: { name: 'Harness Vibe', version: '0.0.1' },
    capabilities: {},
    onAppCreated: (instance) => {
      instance.ontoolresult = (result) => {
        setToolResult(result);
      };
      instance.onerror = console.error;
    },
  });

  if (error) {
    return (
      <Alert.Root theme="danger">
        <Alert.Title>Could not connect</Alert.Title>
        <Alert.Description>{error.message}</Alert.Description>
      </Alert.Root>
    );
  }

  if (!app) {
    return (
      <Layout.Vertical gap="sm">
        <Skeleton.Typography variant="heading-small" />
        <Skeleton.Typography variant="body-normal" />
        <Skeleton.List linesCount={3} onlyItems />
      </Layout.Vertical>
    );
  }

  const view = asView(toolResult);
  const text = toolResult?.content?.find((c) => c.type === 'text')?.text;

  if (!view) {
    return (
      <Layout.Vertical gap="xs">
        <Text variant="body-strong" color="foreground-1">
          Harness Vibe
        </Text>
        <Text variant="caption-normal" color="foreground-3">
          {text ?? 'Waiting for a Vibe tool result…'}
        </Text>
      </Layout.Vertical>
    );
  }

  return <ViewBody app={app} view={view} onResult={setToolResult} />;
}

function ViewBody({
  app,
  view,
  onResult,
}: {
  app: App;
  view: AppUiView;
  onResult: (result: CallToolResult) => void;
}) {
  const [logsOverlay, setLogsOverlay] = useState<Extract<AppUiView, { kind: 'logs' }> | null>(null);
  const deployment = view.kind === 'deployment' ? view.deployment : null;
  const call = useToolCall(app, deployment, onResult);
  const running = Boolean(deployment && isDeploymentRunning(deployment));
  const cardView = deployment ? deriveDeploymentCardView(deployment) : null;
  const shouldPoll =
    Boolean(deployment) && running && cardView !== null && !TERMINAL_CARD_VIEWS.includes(cardView);

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      void call('get_vibe_deployment');
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [shouldPoll, call, deployment?.applicationId, deployment?.executionId]);

  useEffect(() => {
    setLogsOverlay(null);
  }, [view.kind, deployment?.executionId]);

  const streamLogs = async () => {
    const args: Record<string, string> = {};
    if (deployment?.applicationId) args.appId = deployment.applicationId;
    if (deployment?.executionId) args.executionId = deployment.executionId;
    const result = await app.callServerTool({
      name: 'get_vibe_deployment_logs',
      arguments: args,
    });
    const next = asView(result);
    if (next?.kind === 'logs') {
      setLogsOverlay(next);
      return;
    }
    onResult(result);
  };

  return (
    <Layout.Vertical gap="sm">
      {logsOverlay ? (
        <LogsCard view={logsOverlay} />
      ) : (
        <ViewContent app={app} view={view} onResult={onResult} />
      )}
      <ShellActions
        cardView={cardView}
        call={call}
        deployment={deployment}
        logsOverlay={Boolean(logsOverlay)}
        onHideLogs={() => setLogsOverlay(null)}
        onStreamLogs={streamLogs}
        running={running}
      />
    </Layout.Vertical>
  );
}

function ViewContent({
  app,
  view,
  onResult,
}: {
  app: App;
  view: AppUiView;
  onResult: (result: CallToolResult) => void;
}) {
  switch (view.kind) {
    case 'app':
      return <AppCard app={app} view={view} onResult={onResult} />;
    case 'deployment':
      return <DeploymentCard deployment={view.deployment} />;
    case 'logs':
      return <LogsCard view={view} />;
    case 'deploy_form':
      return <DeployFormCard app={app} view={view} onResult={onResult} />;
    case 'fix_request':
      return <FixRequestCard fix={view.fix} />;
    default:
      return null;
  }
}

function Header({ title, status, slug }: { title: string; status: string; slug?: string | null }) {
  return (
    <Layout.Vertical gap="xs">
      <Layout.Horizontal align="center" justify="between" gap="sm">
        <Text variant="body-strong" color="foreground-1">
          {title}
        </Text>
        <StatusBadge
          variant="status"
          theme={statusTheme(status)}
          size="sm"
          pulse={isRunningStatus(status)}
        >
          {status.replace(/_/g, ' ')}
        </StatusBadge>
      </Layout.Horizontal>
      {slug ? (
        <Text variant="caption-code" color="foreground-3">
          {slug}
        </Text>
      ) : null}
    </Layout.Vertical>
  );
}

function EnvTiles({ tiles }: { tiles: EnvTileView[] }) {
  if (!tiles.length) return null;
  return (
    <Layout.Grid columns={2} gap="xs">
      {tiles.map((tile) => (
        <Card.Root key={tile.name} size="sm" interactive={false} className={ENV_TONE_BG[tile.tone]}>
          <Layout.Vertical gap="xs">
            <Layout.Horizontal align="center" justify="between" gap="xs">
              <Text variant="caption-strong" color="foreground-1">
                {tile.name}
              </Text>
              <StatusBadge variant="status" theme={envToneTheme(tile.tone)} size="sm">
                {tile.state}
              </StatusBadge>
            </Layout.Horizontal>
            {tile.url ? (
              <Link external href={tile.url} size="sm" suffixIcon>
                {tile.meta}
              </Link>
            ) : (
              <Text variant="caption-normal" color="foreground-3">
                {tile.meta}
              </Text>
            )}
          </Layout.Vertical>
        </Card.Root>
      ))}
    </Layout.Grid>
  );
}

function StageThumbnail({ status }: { status: StageRailStatus }) {
  switch (status) {
    case 'done':
      return <IconV2 name="check-circle" size="sm" color="success" />;
    case 'active':
      return <StatusBadge variant="status" theme="info" size="sm" pulse />;
    case 'failed':
      return <IconV2 name="xmark-circle" size="sm" color="danger" />;
    case 'held':
      return <IconV2 name="pause" size="sm" color="warning" />;
    default:
      return <IconV2 name="circle" size="sm" color="neutral" />;
  }
}

function StageRail({ stages }: { stages: StageRailItem[] }) {
  if (!stages.length) return null;
  return (
    <StackedList.Root border={false}>
      {stages.map((stage) => (
        <StackedList.Item
          key={stage.name}
          disableHover
          paddingX="xs"
          paddingY="3xs"
          thumbnail={<StageThumbnail status={stage.status} />}
        >
          <StackedList.Field
            title={stage.name}
            description={stage.meta || undefined}
            titleColor={stageTitleColor(stage.status)}
          />
        </StackedList.Item>
      ))}
    </StackedList.Root>
  );
}

function Hero({
  cardView,
  deployment,
}: {
  cardView: DeploymentCardView;
  deployment: DeploymentView;
}) {
  const hero = heroCopy(cardView, deployment);
  return (
    <Layout.Vertical gap="xs">
      <Text variant="caption-strong" color="foreground-3">
        {hero.eyebrow}
      </Text>
      <Text variant="heading-small" color="foreground-1">
        {hero.title}
      </Text>
      <Text variant="body-normal" color="foreground-2">
        {hero.body}
      </Text>
      {hero.progress ? <Progress variant="indeterminate" state="processing" size="sm" /> : null}
      {hero.rows.length ? (
        <ViewOnly
          layout="singleColumn"
          data={hero.rows.map((row) => ({ label: row.k, value: row.v }))}
        />
      ) : null}
      {hero.foot ? (
        <Text variant="caption-normal" color="foreground-3">
          {hero.foot}
        </Text>
      ) : null}
    </Layout.Vertical>
  );
}

function MetricsPanel({
  metrics,
}: {
  metrics: NonNullable<DeploymentView['metrics']> | NonNullable<AppView['metrics']>;
}) {
  const stats = metricStats(metrics);
  if (!stats.length) return null;
  return (
    <Layout.Vertical gap="xs">
      <StatsPanel
        data={stats.map((stat) => ({
          label: stat.label,
          value: <Text color={stat.ok ? 'success' : 'foreground-1'}>{stat.value}</Text>,
        }))}
      />
      {metrics.simulated ? (
        <Text variant="caption-normal" color="foreground-3">
          Metrics are simulated.
        </Text>
      ) : null}
    </Layout.Vertical>
  );
}

function AppCard({
  app,
  view,
  onResult,
}: {
  app: App;
  view: Extract<AppUiView, { kind: 'app' }>;
  onResult: (result: CallToolResult) => void;
}) {
  const a = view.app;
  const published = a.status === 'published';
  const tiles: EnvTileView[] = [
    {
      name: 'preview',
      state: a.previewUrl ? 'live' : 'none',
      meta: a.previewUrl ?? '—',
      tone: a.previewUrl ? 'ok' : 'idle',
      url: a.previewUrl,
    },
    {
      name: 'production',
      state: a.productionUrl ? 'live' : 'not deployed',
      meta: a.productionUrl ?? '—',
      tone: a.productionUrl ? 'ok' : 'idle',
      url: a.productionUrl,
    },
  ];

  return (
    <Layout.Vertical gap="md">
      <Header title={a.name} status={a.status} slug={a.slug} />
      {a.description ? (
        <Text variant="body-normal" color="foreground-2">
          {a.description}
        </Text>
      ) : null}
      <EnvTiles tiles={tiles} />
      {!published ? (
        <ViewOnly
          layout="singleColumn"
          data={[
            { label: 'Slug', value: a.slug },
            { label: 'Owner', value: a.team ? `${a.owner} · ${a.team}` : a.owner },
            { label: 'Source', value: a.source },
            { label: 'CDN', value: a.enableCdn ? 'On' : 'Off' },
          ]}
        />
      ) : null}
      {published && a.metrics ? <MetricsPanel metrics={a.metrics} /> : null}
      <AppSettingsForm app={app} view={a} onResult={onResult} />
    </Layout.Vertical>
  );
}

function AppSettingsForm({
  app,
  view,
  onResult,
}: {
  app: App;
  view: AppView;
  onResult: (result: CallToolResult) => void;
}) {
  const call = useToolCall(app, null, onResult);
  const formMethods = useForm<AppSettingsValues>({
    resolver: zodResolver(appSettingsSchema),
    defaultValues: { slug: view.slug, enableCdn: view.enableCdn },
  });
  const { handleSubmit, reset, setValue, watch } = formMethods;
  const enableCdn = watch('enableCdn');
  const slug = watch('slug');

  useEffect(() => {
    reset({ slug: view.slug, enableCdn: view.enableCdn });
  }, [reset, view.enableCdn, view.slug]);

  const onSubmit = (values: AppSettingsValues) =>
    call('update_vibe_app', {
      appId: view.id,
      slug: values.slug,
      enableCdn: values.enableCdn,
    });

  return (
    <FormWrapper {...formMethods} onSubmit={handleSubmit(onSubmit)}>
      <Layout.Vertical gap="sm">
        <FormInput.Text
          name="slug"
          label="Subdomain"
          caption={`${slug || 'slug'}--preview.apps.harness.io / ${slug || 'slug'}.apps.harness.io`}
        />
        <Switch
          label="Enable CDN"
          caption="Serve static assets from the Harness CDN."
          showOptionalLabel={false}
          checked={enableCdn}
          onCheckedChange={(checked) => setValue('enableCdn', Boolean(checked))}
        />
        <Button type="submit" size="sm" variant="primary">
          Save
        </Button>
      </Layout.Vertical>
    </FormWrapper>
  );
}

function DeploymentCard({ deployment }: { deployment: DeploymentView }) {
  const cardView = deriveDeploymentCardView(deployment);
  const fail = deployment.failure;
  const logs = (fail?.logLines ?? []).slice(-12);

  return (
    <Layout.Vertical gap="sm">
      <Header
        title={deployment.applicationName}
        status={deployment.status}
        slug={deployment.slug ?? CARD_VIEW_LABEL[cardView]}
      />
      <EnvTiles tiles={envTiles(cardView, deployment)} />
      <StageRail stages={groupStages(deployment)} />
      <Hero cardView={cardView} deployment={deployment} />
      {cardView === 'failed' ? <FailedBody fail={fail} logs={logs} /> : null}
      {cardView === 'live' && deployment.metrics ? (
        <MetricsPanel metrics={deployment.metrics} />
      ) : null}
      {deployment.requestedAction && cardView !== 'failed' ? (
        <Text variant="caption-normal" color="foreground-3">
          {deployment.requestedAction}
        </Text>
      ) : null}
    </Layout.Vertical>
  );
}

function FailedBody({ fail, logs }: { fail: DeploymentView['failure']; logs: string[] }) {
  if (!fail) return null;
  return (
    <Layout.Vertical gap="xs">
      <Alert.Root theme="danger">
        <Alert.Title>{fail.summary}</Alert.Title>
        {fail.agentInstruction ? (
          <Alert.Description>{fail.agentInstruction}</Alert.Description>
        ) : null}
      </Alert.Root>
      {logs.length ? (
        <ScrollArea className="border-cn-2 max-h-cn-40 rounded-cn-2 bg-cn-2 border">
          <Text as="pre" variant="body-code" color="foreground-2" className="p-cn-sm">
            {logs.join('\n')}
          </Text>
        </ScrollArea>
      ) : null}
    </Layout.Vertical>
  );
}

function LogsCard({ view }: { view: Extract<AppUiView, { kind: 'logs' }> }) {
  const logs = view.logs;
  return (
    <Layout.Vertical gap="md">
      <Header
        title={`${logs.applicationName} logs`}
        status={logs.stageKey ?? 'logs'}
        slug={logs.executionId}
      />
      <ScrollArea className="border-cn-2 max-h-cn-40 rounded-cn-2 bg-cn-2 border">
        <Text as="pre" variant="body-code" color="foreground-2" className="p-cn-sm">
          {logs.lines.join('\n')}
        </Text>
      </ScrollArea>
    </Layout.Vertical>
  );
}

function DeployFormCard({
  app,
  view,
  onResult,
}: {
  app: App;
  view: Extract<AppUiView, { kind: 'deploy_form' }>;
  onResult: (result: CallToolResult) => void;
}) {
  const form = view.form;
  const call = useToolCall(app, null, onResult);
  const formMethods = useForm<DeployFormValues>({
    resolver: zodResolver(deployFormSchema),
    defaultValues: {
      name: form.name,
      slug: form.slug,
      enableCdn: form.enableCdn,
    },
  });
  const { handleSubmit, setValue, watch } = formMethods;
  const slug = watch('slug');
  const enableCdn = watch('enableCdn');

  const onSubmit = (values: DeployFormValues) => {
    const args: ToolArgs = {
      name: values.name,
      slug: values.slug,
      enableCdn: values.enableCdn,
      confirm: true,
    };
    if (form.appId) args.appId = form.appId;
    if (form.projectId) args.projectId = form.projectId;
    if (form.path) args.path = form.path;
    return call('deploy_vibe_app', args);
  };

  return (
    <Layout.Vertical gap="sm">
      <Header title="Deploy app" status="ready" slug={form.slug} />
      <FormWrapper {...formMethods} onSubmit={handleSubmit(onSubmit)}>
        <Layout.Vertical gap="sm">
          <FormInput.Text name="name" label="Name" />
          <FormInput.Text
            name="slug"
            label="Subdomain"
            caption={`${slug || 'slug'}--preview.apps.harness.io / ${slug || 'slug'}.apps.harness.io`}
          />
          <Switch
            label="Enable CDN"
            caption="Serve static assets from the Harness CDN."
            showOptionalLabel={false}
            checked={enableCdn}
            onCheckedChange={(checked) => setValue('enableCdn', Boolean(checked))}
          />
          <Button type="submit" size="sm" variant="primary">
            Deploy
          </Button>
        </Layout.Vertical>
      </FormWrapper>
    </Layout.Vertical>
  );
}

function FixRequestCard({ fix }: { fix: FixRequestView }) {
  const loc = fix.file ? `${fix.file}${fix.line ? `:${fix.line}` : ''}` : fix.stageKey;
  return (
    <Layout.Vertical gap="sm">
      <Header title="Fix accepted" status="accepted" slug={loc} />
      <Alert.Root theme="info">
        <Alert.Title>{fix.summary}</Alert.Title>
        <Alert.Description>{fix.instruction}</Alert.Description>
      </Alert.Root>
      {fix.logLines.length ? (
        <ScrollArea className="border-cn-2 max-h-cn-40 rounded-cn-2 bg-cn-2 border">
          <Text as="pre" variant="body-code" color="foreground-2" className="p-cn-sm">
            {fix.logLines.join('\n')}
          </Text>
        </ScrollArea>
      ) : null}
    </Layout.Vertical>
  );
}

function ShellActions({
  cardView,
  call,
  deployment,
  logsOverlay,
  onHideLogs,
  onStreamLogs,
  running,
}: {
  cardView: DeploymentCardView | null;
  call: (name: string, overrides?: ToolArgs) => Promise<void>;
  deployment: DeploymentView | null;
  logsOverlay: boolean;
  onHideLogs: () => void;
  onStreamLogs: () => void;
  running: boolean;
}) {
  if (!cardView || !deployment) return null;

  const cancelButton = running ? (
    <Button
      variant="outline"
      theme="danger"
      size="sm"
      onClick={() => call('cancel_vibe_deployment')}
    >
      Cancel
    </Button>
  ) : null;

  const refreshButton = (
    <Button variant="outline" size="sm" onClick={() => call('get_vibe_deployment')}>
      <IconV2 name="refresh" size="sm" color="inherit" />
      Refresh
    </Button>
  );

  const streamLogsButton = (
    <Button variant="outline" size="sm" onClick={onStreamLogs}>
      <IconV2 name="terminal" size="sm" color="inherit" />
      Stream logs
    </Button>
  );

  const hideLogsButton = (
    <Button variant="outline" size="sm" onClick={onHideLogs}>
      Hide logs
    </Button>
  );

  const previewLink = deployment.previewUrl ? (
    <Link external href={deployment.previewUrl} size="sm" suffixIcon>
      {cardView === 'publish' ? 'Review preview' : 'Open preview'}
    </Link>
  ) : null;

  let primary: ReactNode = cancelButton;
  let secondary: ReactNode = null;

  switch (cardView) {
    case 'deploying':
      primary = cancelButton;
      secondary = (
        <>
          {refreshButton}
          {logsOverlay ? hideLogsButton : streamLogsButton}
        </>
      );
      break;
    case 'failed':
      primary = (
        <>
          {cancelButton}
          <Button variant="ai" size="sm" onClick={() => call('accept_vibe_fix')}>
            Accept fix
          </Button>
        </>
      );
      secondary = (
        <Button variant="outline" size="sm" onClick={() => call('retry_vibe_deployment')}>
          <IconV2 name="refresh" size="sm" color="inherit" />
          Retry
        </Button>
      );
      break;
    case 'approval':
      primary = (
        <>
          {cancelButton}
          <Button variant="primary" size="sm" onClick={() => call('request_vibe_approval')}>
            Nudge
          </Button>
        </>
      );
      secondary = previewLink;
      break;
    case 'publish':
      primary = (
        <>
          {cancelButton}
          <Button variant="primary" size="sm" onClick={() => call('publish_vibe_app')}>
            Publish
          </Button>
        </>
      );
      secondary = previewLink;
      break;
    case 'live':
      primary = cancelButton;
      secondary = (
        <Button
          variant="outline"
          theme="danger"
          size="sm"
          onClick={() => call('rollback_vibe_app')}
        >
          Rollback
        </Button>
      );
      break;
    case 'cancelled':
      primary = (
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            call('deploy_vibe_app', {
              appId: deployment.applicationId,
              executionId: undefined,
            })
          }
        >
          Redeploy
        </Button>
      );
      break;
  }

  if (logsOverlay && cardView !== 'deploying') {
    secondary = (
      <>
        {secondary}
        {hideLogsButton}
      </>
    );
  }

  if (!primary && !secondary) return null;

  return (
    <ButtonLayout horizontalAlign="start">
      {primary ? <ButtonLayout.Primary>{primary}</ButtonLayout.Primary> : null}
      {secondary ? <ButtonLayout.Secondary>{secondary}</ButtonLayout.Secondary> : null}
    </ButtonLayout>
  );
}

function useToolCall(
  app: App,
  deployment: DeploymentView | null,
  onResult: (result: CallToolResult) => void,
) {
  return useCallback(
    async (name: string, overrides?: ToolArgs) => {
      const args: Record<string, string | boolean | number> = {};
      const appId = overrides && 'appId' in overrides ? overrides.appId : deployment?.applicationId;
      const executionId =
        overrides && 'executionId' in overrides ? overrides.executionId : deployment?.executionId;
      if (typeof appId === 'string' && appId) args.appId = appId;
      if (typeof executionId === 'string' && executionId) args.executionId = executionId;
      if (overrides) {
        for (const [key, value] of Object.entries(overrides)) {
          if (key === 'appId' || key === 'executionId') continue;
          if (value === undefined || value === null) continue;
          args[key] = value;
        }
      }
      const result = await app.callServerTool({ name, arguments: args });
      onResult(result);
    },
    [app, deployment?.applicationId, deployment?.executionId, onResult],
  );
}

export function VibeAppRoot() {
  return (
    <Shell>
      <VibeMcpApp />
    </Shell>
  );
}
