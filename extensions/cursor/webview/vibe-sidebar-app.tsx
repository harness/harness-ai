import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Button,
  ButtonLayout,
  Card,
  IconV2,
  Layout,
  Progress,
  StackedList,
  StatsPanel,
  StatusBadge,
  Text,
  TooltipProvider,
  type IconV2NamesType,
  type StatusBadgeTheme,
  type TextProps,
} from '@harnessio/ui/components';
import { PortalProvider } from '@harnessio/ui/context';
import { cn } from '@harnessio/ui/utils';
import type {
  EnvCard,
  HeroAction,
  HeroBlock,
  PanelMessage,
  PanelState,
  PanelView,
  StageItem,
  StageStatus,
  Telemetry,
  Tone,
} from '../src/types';

declare global {
  interface Window {
    __VIBE_INITIAL_STATE__?: PanelState | null;
  }
}

interface VsCodeApi {
  postMessage: (message: PanelMessage) => void;
}

function getVsCodeApi(): VsCodeApi {
  const globalObject = globalThis as typeof globalThis & {
    acquireVsCodeApi?: () => VsCodeApi;
  };
  if (typeof globalObject.acquireVsCodeApi === 'function') {
    try {
      return globalObject.acquireVsCodeApi();
    } catch {
      // NOTE: Dev harness does not run inside VS Code.
    }
  }
  return { postMessage: () => undefined };
}

const vscode = getVsCodeApi();

export function VibeSidebarApp() {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [state, setState] = useState<PanelState | null>(
    () => window.__VIBE_INITIAL_STATE__ ?? null,
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent<{ type?: string; payload?: PanelState }>) => {
      if (event.data?.type === 'state' && event.data.payload) {
        setState(event.data.payload);
      }
    };
    window.addEventListener('message', onMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="vibe-root cn-root dark min-h-full" ref={setPortalContainer}>
      <PortalProvider portalContainer={portalContainer}>
        <TooltipProvider>
          {state ? <Panel state={state} /> : <LoadingBody />}
        </TooltipProvider>
      </PortalProvider>
    </div>
  );
}

function LoadingBody() {
  return (
    <Layout.Vertical gap="xs" className="p-cn-md">
      <Text variant="body-strong" color="foreground-1">
        Harness Vibe
      </Text>
      <Text variant="caption-normal" color="foreground-3">
        Resolving this repository…
      </Text>
    </Layout.Vertical>
  );
}

export function Panel({ state }: { state: PanelState }) {
  const hasPipeline = Boolean(state.stages?.length);

  return (
    <Layout.Flex direction="column" className="min-h-full bg-cn-1">
      <AppHeader state={state} />
      {hasPipeline ? <PipelineLayout state={state} /> : <SimpleLayout state={state} />}
      <Footer left={state.footLeft} right={state.footRight} />
      <StateStrip view={state.view} />
    </Layout.Flex>
  );
}

const VIEW_LABEL: Record<PanelView, string> = {
  fresh: 'Not managed',
  deploying: 'Deploying',
  failed: 'Build failed',
  approval: 'Awaiting approval',
  publish: 'Ready to publish',
  live: 'Live in production',
};

const VIEW_DOT: Record<PanelView, Tone> = {
  fresh: 'idle',
  deploying: 'info',
  failed: 'err',
  approval: 'warn',
  publish: 'ok',
  live: 'ok',
};

function StateStrip({ view }: { view: PanelView }) {
  return (
    <Layout.Horizontal wrap="wrap" gap="2xs" className="border-t border-cn-2 bg-cn-1 px-cn-xs py-cn-xs">
      {(Object.keys(VIEW_LABEL) as PanelView[]).map((stateView) => {
        const active = stateView === view;
        return (
          <Button
            key={stateView}
            type="button"
            size="xs"
            variant={active ? 'secondary' : 'outline'}
            onClick={() => send({ type: 'setView', view: stateView })}
          >
            <StatusBadge variant="status" theme={statusTheme(VIEW_DOT[stateView])} size="sm" />
            {VIEW_LABEL[stateView]}
          </Button>
        );
      })}
    </Layout.Horizontal>
  );
}

function PipelineLayout({ state }: { state: PanelState }) {
  return (
    <Layout.Flex
      className="min-w-0 flex-1 border-b border-cn-2 max-[320px]:flex-col min-[321px]:flex-row"
    >
      <StagesRail items={state.stages!} meta={state.stageMeta} />
      {state.hero ? <Hero hero={state.hero} layout="rail" /> : null}
    </Layout.Flex>
  );
}

function SimpleLayout({ state }: { state: PanelState }) {
  return (
    <>
      {state.hero ? <Hero hero={state.hero} /> : null}
      {state.telemetry ? <LiveConsole telemetry={state.telemetry} /> : null}
    </>
  );
}

function AppHeader({ state }: { state: PanelState }) {
  const tone = headerTone(state);
  return (
    <Layout.Vertical gap="sm" className="border-b border-cn-2 px-cn-xs py-cn-sm">
      <Layout.Horizontal align="center" gap="xs" wrap="wrap">
        <StatusBadge
          variant="status"
          theme={statusTheme(tone)}
          size="sm"
          pulse={tone === 'info'}
        />
        <Text variant="body-strong" color="foreground-1" truncate className="min-w-0">
          {state.appName}
        </Text>
        <StatusBadge variant="status" theme={state.managed ? 'success' : 'muted'} size="sm">
          {state.managed ? 'managed' : 'not managed'}
        </StatusBadge>
        <Layout.Horizontal align="center" gap="2xs" className="ml-auto">
          <Button
            type="button"
            iconOnly
            size="xs"
            variant="ghost"
            tooltipProps={{ content: 'Copy repo' }}
            onClick={() => send({ type: 'copyRepo' })}
          >
            <IconV2 name="copy" />
          </Button>
          <Button
            type="button"
            iconOnly
            size="xs"
            variant="ghost"
            tooltipProps={{ content: 'Open in console' }}
            onClick={() => send({ type: 'openConsole' })}
          >
            <IconV2 name="arrow-up-right" />
          </Button>
        </Layout.Horizontal>
      </Layout.Horizontal>
      <Text variant="caption-code" color="foreground-3">
        {state.repo} · {state.projectId}
      </Text>
      <Layout.Flex gap="xs" className="max-[300px]:flex-col">
        {state.envs.map((card) => (
          <EnvTile key={card.name} card={card} />
        ))}
      </Layout.Flex>
    </Layout.Vertical>
  );
}

function EnvTile({ card }: { card: EnvCard }) {
  return (
    <Card.Root size="sm" interactive={false} className={cn('min-w-0 flex-1', tintClasses(card.tone))}>
      <Card.Content>
        <Layout.Vertical gap="3xs">
          <Layout.Horizontal align="center" gap="3xs">
            <StatusBadge
              variant="status"
              theme={statusTheme(card.tone)}
              size="sm"
              pulse={card.tone === 'info'}
            />
            <Text variant="caption-strong" color="foreground-3" className="uppercase">
              {card.name}
            </Text>
            {card.openable ? (
              <Button
                type="button"
                iconOnly
                size="xs"
                variant="ghost"
                className="ml-auto"
                tooltipProps={{ content: `Open ${card.name}` }}
                onClick={() => send({ type: card.name === 'preview' ? 'openPreview' : 'openProd' })}
              >
                <IconV2 name="arrow-up-right" />
              </Button>
            ) : null}
          </Layout.Horizontal>
          <Text
            variant="caption-normal"
            color={card.tone === 'idle' ? 'foreground-3' : 'foreground-1'}
          >
            {card.state}
          </Text>
          <Text variant="caption-code" color="foreground-3" truncate>
            {card.meta}
          </Text>
        </Layout.Vertical>
      </Card.Content>
    </Card.Root>
  );
}

function Hero({ hero, layout = 'full' }: { hero: HeroBlock; layout?: 'full' | 'rail' }) {
  const shellClass =
    layout === 'rail'
      ? 'min-w-0 flex-1 p-cn-md'
      : 'border-b border-cn-2 p-cn-md';

  return (
    <Layout.Vertical gap="xs" className={cn(shellClass, tintBg(hero.tone))}>
      {hero.eyebrow ? (
        <Text variant="caption-strong" color={toneText(hero.tone)}>
          {hero.eyebrow}
        </Text>
      ) : null}
      <Text variant="heading-small" color="foreground-1">
        {hero.title}
      </Text>
      <Text as="p" variant="body-normal" color="foreground-2">
        {hero.body}
      </Text>
      {hero.progress ? (
        <Progress
          variant="indeterminate"
          state="processing"
          size="sm"
          className="vibe-progress-compact"
        />
      ) : null}
      {hero.rows.length ? (
        <Layout.Vertical gap="2xs">
          {hero.rows.map((row) => (
            <Layout.Horizontal key={row.k} align="baseline" gap="xs">
              <Text variant="caption-normal" color="foreground-3" className="w-cn-20 shrink-0">
                {row.k}
              </Text>
              <Text variant="caption-code" color="foreground-2">
                {row.v}
              </Text>
            </Layout.Horizontal>
          ))}
        </Layout.Vertical>
      ) : null}
      {hero.actions.length ? <HeroActions actions={hero.actions} /> : null}
      {hero.foot ? (
        <Text as="p" variant="caption-normal" color="foreground-3">
          {hero.foot}
        </Text>
      ) : null}
    </Layout.Vertical>
  );
}

function HeroActions({ actions }: { actions: HeroAction[] }) {
  const primary = actions.filter((action) => action.primary);
  const secondary = actions.filter((action) => !action.primary);

  return (
    <ButtonLayout horizontalAlign="start">
      {primary.length ? (
        <ButtonLayout.Primary className="min-w-0 flex-1">
          {primary.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.ai ? 'ai' : 'primary'}
              className="w-full"
              onClick={() => send({ type: action.id })}
            >
              {action.label}
            </Button>
          ))}
        </ButtonLayout.Primary>
      ) : null}
      {secondary.length ? (
        <ButtonLayout.Secondary>
          {secondary.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.ai ? 'ai' : 'outline'}
              onClick={() => send({ type: action.id })}
            >
              {action.label}
            </Button>
          ))}
        </ButtonLayout.Secondary>
      ) : null}
    </ButtonLayout>
  );
}

function StagesRail({ items, meta }: { items: StageItem[]; meta: string }) {
  return (
    <Layout.Vertical
      gap="xs"
      className="shrink-0 border-cn-2 px-cn-xs py-cn-sm max-[320px]:border-b min-[321px]:w-[38%] min-[321px]:max-w-[132px] min-[321px]:border-r min-[321px]:border-b-0"
    >
      {meta ? (
        <Text variant="caption-code" color="foreground-3">
          {meta}
        </Text>
      ) : null}
      <StackedList.Root border={false}>
        {items.map((item) => {
          const visual = stageVisual(item.status);
          return (
            <StackedList.Item
              key={item.name}
              paddingX="xs"
              paddingY="3xs"
              disableHover
              thumbnail={stageThumbnail(item.status)}
              actions={
                item.time ? (
                  <Text variant="caption-code" color="foreground-3">
                    {item.time}
                  </Text>
                ) : undefined
              }
            >
              <StackedList.Field
                title={item.name}
                description={item.meta || undefined}
                titleColor={visual.titleColor}
              />
            </StackedList.Item>
          );
        })}
      </StackedList.Root>
    </Layout.Vertical>
  );
}

function LiveConsole({ telemetry }: { telemetry: Telemetry }) {
  return (
    <Layout.Vertical gap="sm" className="border-b border-cn-2 p-cn-md">
      <Layout.Horizontal align="center">
        <Text variant="caption-strong" color="foreground-3" className="uppercase">
          Live · last 24h
        </Text>
        <Text variant="caption-code" color="foreground-3" className="ml-auto">
          {telemetry.host}
        </Text>
      </Layout.Horizontal>

      <StatsPanel
        gap="3xs"
        data={telemetry.stats.map((stat) => ({
          label: stat.label,
          value: (
            <Text
              variant="body-strong"
              color={stat.tone === 'ok' ? 'success' : 'foreground-1'}
            >
              {stat.value}
            </Text>
          ),
        }))}
      />

      <Card.Root size="sm" interactive={false} className="bg-cn-2">
        <Card.Content>
          <Layout.Vertical gap="xs">
            <Layout.Horizontal align="center">
              <Text variant="caption-strong" color="foreground-3" className="uppercase">
                Deployed build
              </Text>
              <Text variant="caption-code" color="success" className="ml-auto">
                {telemetry.buildTag}
              </Text>
            </Layout.Horizontal>
            <Text variant="body-normal" color="foreground-2">
              {telemetry.buildMsg}
            </Text>
            <Text variant="caption-code" color="foreground-3">
              {telemetry.buildMeta}
            </Text>
            <ButtonLayout horizontalAlign="start">
              <ButtonLayout.Secondary>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => send({ type: 'rollback' })}
                >
                  {telemetry.rollbackLabel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => send({ type: 'streamLogs' })}
                >
                  Open logs
                </Button>
              </ButtonLayout.Secondary>
            </ButtonLayout>
          </Layout.Vertical>
        </Card.Content>
      </Card.Root>

      <Layout.Vertical gap="xs">
        <Text variant="caption-strong" color="foreground-3" className="uppercase">
          Recent changes
        </Text>
        <StackedList.Root border={false}>
          {telemetry.history.map((row) => (
            <StackedList.Item
              key={row.msg}
              paddingX="xs"
              paddingY="3xs"
              disableHover
              thumbnail={
                <StatusBadge variant="status" theme={statusTheme(row.tone)} size="sm" />
              }
              actions={
                <Text variant="caption-code" color="foreground-3">
                  {row.when}
                </Text>
              }
            >
              <StackedList.Field title={row.msg} description={row.meta} />
            </StackedList.Item>
          ))}
        </StackedList.Root>
      </Layout.Vertical>
    </Layout.Vertical>
  );
}

function Footer({ left, right }: { left: string; right: string }) {
  return (
    <Layout.Horizontal align="center" gap="xs" className="mt-auto bg-cn-2 px-cn-sm py-cn-xs">
      <StatusBadge variant="status" theme="success" size="sm" />
      <Text variant="caption-normal" color="foreground-3">
        {left}
      </Text>
      <Text variant="caption-code" color="foreground-3" className="ml-auto">
        {right}
      </Text>
    </Layout.Horizontal>
  );
}

function stageThumbnail(status: StageStatus): ReactNode {
  if (status === 'done') {
    const name: IconV2NamesType = 'check';
    return <IconV2 name={name} size="xs" color="success" />;
  }
  if (status === 'active') {
    return <StatusBadge variant="status" theme="info" size="sm" pulse />;
  }
  if (status === 'failed') {
    const name: IconV2NamesType = 'warning-triangle';
    return <IconV2 name={name} size="xs" color="danger" />;
  }
  if (status === 'held') {
    const name: IconV2NamesType = 'clock';
    return <IconV2 name={name} size="xs" color="warning" />;
  }
  return <StatusBadge variant="status" theme="muted" size="sm" />;
}

function stageVisual(status: StageStatus): { titleColor: TextProps['color'] } {
  if (status === 'done') return { titleColor: 'foreground-2' };
  if (status === 'active') return { titleColor: 'foreground-1' };
  if (status === 'failed') return { titleColor: 'danger' };
  if (status === 'held') return { titleColor: 'warning' };
  return { titleColor: 'foreground-3' };
}

function headerTone(state: PanelState): Tone {
  if (state.view === 'fresh') return 'idle';
  if (state.view === 'deploying') return 'info';
  if (state.view === 'failed') return 'err';
  if (state.view === 'approval') return 'warn';
  if (state.view === 'publish') return 'ok';
  return state.hero?.tone ?? 'ok';
}

function statusTheme(tone: Tone): StatusBadgeTheme {
  if (tone === 'ok') return 'success';
  if (tone === 'warn') return 'warning';
  if (tone === 'err') return 'danger';
  if (tone === 'info' || tone === 'vibe') return 'info';
  return 'muted';
}

function tintClasses(tone: Tone): string {
  if (tone === 'ok') return 'bg-cn-success-secondary border-cn-success';
  if (tone === 'err') return 'bg-cn-danger-secondary border-cn-danger';
  if (tone === 'warn') return 'bg-cn-warning-secondary border-cn-warning';
  if (tone === 'info') return 'bg-cn-brand-secondary border-cn-brand';
  if (tone === 'vibe') return 'bg-cn-purple-secondary border-cn-purple-outline';
  return 'bg-cn-2 border-cn-3';
}

function tintBg(tone: Tone): string {
  if (tone === 'ok') return 'bg-cn-success-secondary';
  if (tone === 'err') return 'bg-cn-danger-secondary';
  if (tone === 'warn') return 'bg-cn-warning-secondary';
  if (tone === 'info') return 'bg-cn-brand-secondary';
  if (tone === 'vibe') return 'bg-cn-purple-secondary';
  return 'bg-cn-2';
}

function toneText(tone: Tone): NonNullable<TextProps['color']> {
  if (tone === 'ok') return 'success';
  if (tone === 'warn') return 'warning';
  if (tone === 'err') return 'danger';
  if (tone === 'info' || tone === 'vibe') return 'brand';
  return 'foreground-3';
}

function send(message: PanelMessage) {
  vscode.postMessage(message);
}
