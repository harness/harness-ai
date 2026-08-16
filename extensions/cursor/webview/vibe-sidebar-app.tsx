import { useEffect, useState } from 'react';
import { TooltipProvider } from '@harnessio/ui/components';
import { PortalProvider } from '@harnessio/ui/context';
import type {
  EnvCard,
  HeroBlock,
  PanelMessage,
  PanelState,
  PanelView,
  StageItem,
  StageStatus,
  Telemetry,
  Tone,
} from '../src/types';

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

export function VibeSidebarApp() {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [state, setState] = useState<PanelState | null>(null);

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
    <div className="p-vb-14">
      <div className="text-vb-14 text-vb-fg font-semibold">Vibe</div>
      <div className="text-vb-12 text-vb-fg-3 mt-[6px]">Resolving this repository…</div>
    </div>
  );
}

export function Panel({ state }: { state: PanelState }) {
  const hasPipeline = Boolean(state.stages?.length);

  return (
    <div className="bg-vb-panel flex min-h-full flex-col">
      <AppHeader state={state} />
      {hasPipeline ? <PipelineLayout state={state} /> : <SimpleLayout state={state} />}
      <Footer left={state.footLeft} right={state.footRight} />
      <StateStrip view={state.view} />
    </div>
  );
}

function PipelineLayout({ state }: { state: PanelState }) {
  return (
    <div className="border-vb-rule flex min-w-0 flex-1 flex-col border-b max-[320px]:flex-col min-[321px]:flex-row">
      <StagesRail items={state.stages!} meta={state.stageMeta} />
      {state.hero ? <Hero hero={state.hero} layout="rail" /> : null}
    </div>
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

function StateStrip({ view }: { view: PanelView }) {
  return (
    <div className="border-vb-rule bg-vb-panel flex flex-wrap gap-[6px] border-t px-vb-13 py-vb-8">
      {(Object.keys(VIEW_LABEL) as PanelView[]).map((stateView) => {
        const active = stateView === view;
        return (
          <button
            key={stateView}
            type="button"
            className={`text-[11px] rounded-[6px] border px-[8px] py-[4px] font-medium ${
              active ? 'border-[#3A4150] bg-[#232730] text-vb-fg' : 'border-vb-rule bg-vb-topbar text-vb-fg-4'
            } flex cursor-pointer items-center gap-[6px] font-sans`}
            onClick={() => send({ type: 'setView', view: stateView })}
          >
            <span className={`size-[6px] rounded-full ${dotBg(VIEW_DOT[stateView])}`} />
            <span>{VIEW_LABEL[stateView]}</span>
          </button>
        );
      })}
    </div>
  );
}

function AppHeader({ state }: { state: PanelState }) {
  const tone = headerTone(state);
  return (
    <div className="border-vb-rule border-b px-vb-14 pt-vb-14 pb-vb-13">
      <div className="flex min-w-0 flex-wrap items-center gap-vb-7">
        <span
          className={`size-[7px] shrink-0 rounded-full ${dotBg(tone)} ${tone === 'info' ? 'vb-pulse' : ''}`}
        />
        <span className="text-vb-14 text-vb-fg min-w-0 truncate font-semibold">{state.appName}</span>
        <span
          className={`text-vb-105 rounded-vb-pill shrink-0 border px-[7px] py-[2px] font-medium ${
            state.managed
              ? 'border-vb-managed-ok-bd bg-vb-managed-ok-bg text-vb-ok'
              : 'border-vb-managed-idle-bd bg-vb-managed-idle-bg text-vb-fg-4'
          }`}
        >
          {state.managed ? 'managed' : 'not managed'}
        </span>
        <div className="text-vb-12 text-vb-fg-5 ml-auto flex items-center gap-[9px]">
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 leading-none"
            title="Copy repo"
            onClick={() => send({ type: 'copyRepo' })}
          >
            ⧉
          </button>
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 leading-none"
            title="Open in console"
            onClick={() => send({ type: 'openConsole' })}
          >
            ↗
          </button>
        </div>
      </div>
      <div className="text-vb-10 text-vb-muted mt-[5px] font-mono">
        {state.repo} · {state.projectId}
      </div>
      <div className="mt-[12px] flex gap-vb-7 max-[300px]:flex-col">
        {state.envs.map((card) => (
          <EnvTile key={card.name} card={card} />
        ))}
      </div>
    </div>
  );
}

function EnvTile({ card }: { card: EnvCard }) {
  return (
    <div className={`min-w-0 flex-1 rounded-vb border px-vb-8 py-[6px] ${tintClasses(card.tone)}`}>
      <div className="flex items-center gap-[5px]">
        <span
          className={`size-[5px] shrink-0 rounded-full ${dotBg(card.tone)} ${card.tone === 'info' ? 'vb-pulse' : ''}`}
        />
        <span className="text-vb-10 text-vb-fg-4 font-semibold uppercase tracking-[0.06em]">
          {card.name}
        </span>
        {card.openable ? (
          <button
            type="button"
            className="text-vb-10 text-vb-muted ml-auto cursor-pointer border-0 bg-transparent p-0 leading-none"
            title={`Open ${card.name}`}
            onClick={() => send({ type: card.name === 'preview' ? 'openPreview' : 'openProd' })}
          >
            ↗
          </button>
        ) : null}
      </div>
      <div className={`text-vb-11 mt-[5px] font-medium ${card.tone === 'idle' ? 'text-vb-fg-4' : 'text-[#DCE1E8]'}`}>
        {card.state}
      </div>
      <div className="text-vb-9 text-vb-muted mt-[2px] truncate font-mono">{card.meta}</div>
    </div>
  );
}

function Hero({ hero, layout = 'full' }: { hero: HeroBlock; layout?: 'full' | 'rail' }) {
  const hasEyebrow = Boolean(hero.eyebrow);
  const shellClass =
    layout === 'rail'
      ? 'min-w-0 flex-1 p-vb-14'
      : 'border-vb-rule border-b p-vb-14';

  return (
    <div className={`${shellClass} ${tintBg(hero.tone)}`}>
      {hero.eyebrow ? (
        <div className={`text-vb-10u font-semibold ${toneText(hero.tone)}`}>{hero.eyebrow}</div>
      ) : null}
      <div className={`text-vb-145 text-vb-fg font-semibold tracking-[-0.012em] leading-[1.35] ${hasEyebrow ? 'mt-[7px]' : ''}`}>
        {hero.title}
      </div>
      <p className="text-vb-12 text-vb-fg-3 mt-[6px] leading-[1.58]">{hero.body}</p>
      {hero.progress ? (
        <div className="bg-vb-rule relative mt-[12px] h-[3px] overflow-hidden rounded-[2px]">
          <span className={`absolute inset-0 w-[34%] rounded-[2px] vb-bar ${dotBg(hero.tone)}`} />
        </div>
      ) : null}
      {hero.rows.length ? (
        <div className="mt-[12px] flex flex-col gap-[6px]">
          {hero.rows.map((row) => (
            <div key={row.k} className="text-vb-11 flex items-baseline gap-[9px]">
              <span className="text-vb-fg-5 w-[84px] shrink-0">{row.k}</span>
              <span className="text-vb-fg-2 font-mono">{row.v}</span>
            </div>
          ))}
        </div>
      ) : null}
      {hero.actions.length ? (
        <div className="mt-[14px] flex flex-wrap gap-vb-7">
          {hero.actions.map((action) => {
            const isPrimary = action.primary || action.ai;
            return (
              <button
                key={action.id}
                type="button"
                className={`text-vb-12 rounded-vb cursor-pointer border px-[13px] py-[8px] font-medium ${
                  isPrimary
                    ? `bg-vb-primary border-vb-primary-bd text-white ${action.primary ? 'min-w-0 flex-1 basis-0' : 'shrink-0'}`
                    : 'bg-vb-btn border-vb-btn-bd text-vb-fg-2 shrink-0'
                }`}
                onClick={() => send({ type: action.id })}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {hero.foot ? (
        <p className="text-vb-105 text-vb-muted mt-[9px] leading-[1.5]">
          {hero.foot}
        </p>
      ) : null}
    </div>
  );
}

function StagesRail({ items, meta }: { items: StageItem[]; meta: string }) {
  return (
    <div className="border-vb-rule shrink-0 px-vb-10 py-vb-11 max-[320px]:border-b min-[321px]:w-[38%] min-[321px]:max-w-[132px] min-[321px]:border-r min-[321px]:border-b-0">
      {meta ? <div className="text-vb-9 text-vb-dim mb-vb-7 font-mono leading-none">{meta}</div> : null}
      <div className="flex flex-col">
        {items.map((item) => {
          const visual = stageVisual(item.status);
          return (
            <div key={item.name} className="flex items-start gap-[7px] py-[3px]">
              <div
                className={`text-[8px] mt-[1px] grid size-[14px] flex-none place-items-center rounded-full border font-bold leading-none ${visual.badge}`}
              >
                <span className={`${visual.glyphClass} ${visual.pulse ? 'vb-pulse' : ''}`}>
                  {visual.glyph || '\u00a0'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-vb-10 leading-[1.3] ${visual.nameClass}`}>{item.name}</div>
                {item.meta ? (
                  <div className={`text-vb-9 mt-[1px] font-mono leading-[1.35] ${visual.metaClass} line-clamp-2`}>
                    {item.meta}
                  </div>
                ) : null}
              </div>
              {item.time ? (
                <div className="text-vb-9 text-vb-dim mt-[1px] ml-auto flex-none font-mono">{item.time}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveConsole({ telemetry }: { telemetry: Telemetry }) {
  return (
    <div className="border-vb-rule border-b px-vb-14 py-vb-13">
      <div className="mb-[11px] flex items-center">
        <span className="text-vb-10u text-vb-muted font-semibold uppercase">Live · last 24h</span>
        <span className="text-vb-9 text-vb-dim ml-auto font-mono">{telemetry.host}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 max-[280px]:grid-cols-1">
        {telemetry.stats.map((stat) => (
          <div key={stat.label}>
            <div className={`text-vb-16 font-mono ${stat.tone === 'ok' ? 'text-vb-ok' : 'text-vb-fg'}`}>{stat.value}</div>
            <div className="text-vb-10 text-vb-fg-5 mt-[3px]">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-vb-build-bg border-vb-build-bd rounded-vb mt-vb-14 border p-[10px]">
        <div className="flex items-center">
          <span className="text-vb-10u text-vb-muted font-semibold uppercase">Deployed build</span>
          <span className="text-vb-10 text-vb-ok ml-auto font-mono">{telemetry.buildTag}</span>
        </div>
        <div className="text-vb-11 text-vb-fg-2 mt-[6px] leading-[1.5]">{telemetry.buildMsg}</div>
        <div className="text-vb-10 text-vb-muted mt-[4px] font-mono">{telemetry.buildMeta}</div>
        <div className="mt-[10px] flex gap-vb-7">
          <button
            type="button"
            className="text-vb-11 bg-vb-btn border-vb-btn-bd text-vb-fg-2 rounded-vb-sm cursor-pointer border px-[11px] py-[5px] font-medium"
            onClick={() => send({ type: 'rollback' })}
          >
            {telemetry.rollbackLabel}
          </button>
          <button
            type="button"
            className="text-vb-11 bg-vb-btn border-vb-btn-bd text-vb-fg-2 rounded-vb-sm cursor-pointer border px-[11px] py-[5px] font-medium"
            onClick={() => send({ type: 'streamLogs' })}
          >
            Open logs ↗
          </button>
        </div>
      </div>

      <div className="mt-[12px]">
        <div className="text-vb-10u text-vb-muted mb-vb-8 font-semibold uppercase tracking-[0.09em]">Recent changes</div>
        {telemetry.history.map((row) => (
          <div key={row.msg} className="flex items-baseline gap-[9px] py-[4px]">
            <span className={`mt-[5px] size-[5px] flex-none rounded-full ${dotBg(row.tone)}`} />
            <div className="min-w-0 flex-1">
              <div className="text-vb-11 text-vb-fg-2 truncate">{row.msg}</div>
              <div className="text-vb-9 text-vb-muted mt-[1px] font-mono">{row.meta}</div>
            </div>
            <div className="text-vb-9 text-vb-dim mt-[1px] flex-none font-mono">{row.when}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Footer({ left, right }: { left: string; right: string }) {
  return (
    <div className="bg-vb-footer text-vb-105 text-vb-muted mt-auto flex items-center px-vb-13 py-vb-9">
      <span className="bg-vb-ok size-[5px] shrink-0 rounded-full" />
      <span className="ml-[7px]">{left}</span>
      <span className="ml-auto font-mono">{right}</span>
    </div>
  );
}

function stageVisual(status: StageStatus): {
  glyph: string;
  badge: string;
  glyphClass: string;
  nameClass: string;
  metaClass: string;
  pulse: boolean;
} {
  if (status === 'done') {
    return {
      glyph: '✓',
      badge: 'bg-vb-stage-done-bg border-vb-stage-done-bd',
      glyphClass: 'text-vb-ok',
      nameClass: 'text-vb-fg-3 font-normal',
      metaClass: 'text-vb-muted',
      pulse: false,
    };
  }
  if (status === 'active') {
    return {
      glyph: '●',
      badge: 'bg-vb-stage-active-bg border-vb-stage-active-bd',
      glyphClass: 'text-vb-info',
      nameClass: 'text-vb-fg font-semibold',
      metaClass: 'text-vb-fg-4',
      pulse: true,
    };
  }
  if (status === 'failed') {
    return {
      glyph: '!',
      badge: 'bg-vb-stage-failed-bg border-vb-stage-failed-bd',
      glyphClass: 'text-vb-err',
      nameClass: 'text-vb-fg font-semibold',
      metaClass: 'text-vb-err',
      pulse: false,
    };
  }
  if (status === 'held') {
    return {
      glyph: '◷',
      badge: 'bg-vb-stage-held-bg border-vb-stage-held-bd',
      glyphClass: 'text-vb-warn',
      nameClass: 'text-vb-fg font-semibold',
      metaClass: 'text-vb-warn',
      pulse: false,
    };
  }
  return {
    glyph: '',
    badge: 'bg-transparent border-vb-stage-pending-bd',
    glyphClass: 'text-vb-muted',
    nameClass: 'text-vb-muted font-normal',
    metaClass: 'text-[#454B54]',
    pulse: false,
  };
}

function headerTone(state: PanelState): Tone {
  if (state.view === 'fresh') return 'idle';
  if (state.view === 'deploying') return 'info';
  if (state.view === 'failed') return 'err';
  if (state.view === 'approval') return 'warn';
  if (state.view === 'publish') return 'ok';
  return state.hero?.tone ?? 'ok';
}

function tintClasses(tone: Tone): string {
  if (tone === 'ok') return 'bg-vb-tint-ok border-vb-tint-ok-bd';
  if (tone === 'err') return 'bg-vb-tint-err border-vb-tint-err-bd';
  if (tone === 'warn') return 'bg-vb-tint-warn border-vb-tint-warn-bd';
  if (tone === 'info') return 'bg-vb-tint-info border-vb-tint-info-bd';
  if (tone === 'vibe') return 'bg-vb-tint-vibe border-vb-tint-vibe-bd';
  return 'bg-vb-tint-idle border-vb-tint-idle-bd';
}

function tintBg(tone: Tone): string {
  if (tone === 'ok') return 'bg-vb-tint-ok';
  if (tone === 'err') return 'bg-vb-tint-err';
  if (tone === 'warn') return 'bg-vb-tint-warn';
  if (tone === 'info') return 'bg-vb-tint-info';
  if (tone === 'vibe') return 'bg-vb-tint-vibe';
  return 'bg-vb-tint-idle';
}

function toneText(tone: Tone): string {
  if (tone === 'ok') return 'text-vb-ok';
  if (tone === 'warn') return 'text-vb-warn';
  if (tone === 'err') return 'text-vb-err';
  if (tone === 'info') return 'text-vb-info';
  if (tone === 'vibe') return 'text-vb-vibe';
  return 'text-vb-fg-5';
}

function dotBg(tone: Tone): string {
  if (tone === 'ok') return 'bg-vb-ok';
  if (tone === 'warn') return 'bg-vb-warn';
  if (tone === 'err') return 'bg-vb-err';
  if (tone === 'info') return 'bg-vb-info';
  if (tone === 'vibe') return 'bg-vb-vibe';
  return 'bg-vb-idle';
}

function send(message: PanelMessage) {
  vscode.postMessage(message);
}
