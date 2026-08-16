import { HttpVibeStore } from "./http-store.js";
import { MockVibeStore } from "./mock-store.js";
import type { VibeStore } from "./types.js";

export function createVibeStore(): VibeStore {
  if (process.env.VIBE_MCP_MOCK === "1") {
    return new MockVibeStore();
  }
  return new HttpVibeStore();
}
