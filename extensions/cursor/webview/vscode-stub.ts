interface VsCodeApiLike {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

const globalObject = globalThis as typeof globalThis & {
  acquireVsCodeApi?: () => VsCodeApiLike;
};

if (typeof globalObject.acquireVsCodeApi !== 'function') {
  let state: unknown;
  const api: VsCodeApiLike = {
    postMessage: () => undefined,
    getState: () => state,
    setState: (nextState: unknown) => {
      state = nextState;
    },
  };
  globalObject.acquireVsCodeApi = () => api;
}
