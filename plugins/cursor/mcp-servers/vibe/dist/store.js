import { HttpVibeStore } from "./http-store.js";
import { MockVibeStore } from "./mock-store.js";
export function createVibeStore() {
    if (process.env.VIBE_MCP_MOCK === "1") {
        return new MockVibeStore();
    }
    return new HttpVibeStore();
}
