import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import './vscode-stub';
import './panel.css';
import { STUB_VIEWS, StubStore } from '../src/stub';
import type { PanelState, PanelView } from '../src/types';
import { Panel } from './vibe-sidebar-app';

const PREVIEW_WIDTHS = [250, 320, 396] as const;

function buildState(view: PanelView): PanelState {
  const store = new StubStore();
  store.setView(view);
  return store.toPanelState();
}

function ViewLabel({ view }: { view: PanelView }) {
  return (
    <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {view}
    </div>
  );
}

function PanelPreview({ width, state }: { width: number; state: PanelState }) {
  return (
    <div
      style={{
        width,
        border: '1px solid #202329',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#161719',
      }}
    >
      <div
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid #202329',
          fontSize: 11,
          color: '#9AA1AC',
          fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
        }}
      >
        {width}px
      </div>
      <div className="vibe-root dark min-h-full">
        <Panel state={state} />
      </div>
    </div>
  );
}

function Gallery() {
  const states = useMemo(
    () =>
      STUB_VIEWS.map((view) => ({
        view,
        state: buildState(view),
      })),
    [],
  );

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: 24,
        background: '#0B0C0E',
        color: '#E8EAED',
      }}
    >
      <h1 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 600 }}>Vibe Sidebar Gallery</h1>
      <p style={{ margin: '0 0 24px 0', color: '#9AA1AC', fontSize: 12 }}>
        Six panel states rendered at 250px, 320px, and 396px widths.
      </p>

      <div style={{ display: 'grid', gap: 28 }}>
        {states.map(({ view, state }) => (
          <section key={view}>
            <ViewLabel view={view} />
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, max-content)' }}>
              {PREVIEW_WIDTHS.map((width) => (
                <PanelPreview key={`${view}-${width}`} width={width} state={state} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

document.body.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
