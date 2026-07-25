import {describe, expect, it} from "vitest";

import {shouldShowPortChangeHint} from "./portChangeHint";

/**
 * Port-change data-loss hint (#2069).
 *
 * IndexedDB and localStorage are origin-bound (scheme + host +
 * port). When the launcher changes the public port the app moves
 * to a new origin and a Dexie-mode learner sees an empty app while
 * their data sits in the old origin's IndexedDB, unreachable.
 *
 * The hint is a conditional, non-alarming nudge on the empty
 * Landing state. It must appear only where a port change is
 * plausible AND lossy - see the per-case reasoning below. Both
 * storage modes are covered explicitly (rule #2053: a storage
 * change is proven in BOTH modes or it is not proven).
 */
describe("shouldShowPortChangeHint", () => {
    it("shows on a self-hosted Dexie origin that carries a port (#2069 repro)", () => {
        // The vulnerable cohort: a launcher/self-hoster running the
        // Dexie build (or who toggled to Dexie) whose data lives in
        // origin-bound IndexedDB. A port change hides it silently.
        expect(shouldShowPortChangeHint({mode: "dexie", port: "8501"})).toBe(true);
    });

    it("stays hidden in API mode (server data auto-recovers via identity.yaml)", () => {
        // API mode keeps its canonical data server-side and re-seeds
        // the learner pointers from identity.yaml on the Landing
        // route, so a port-change hint would be misleading.
        expect(shouldShowPortChangeHint({mode: "api", port: "8501"})).toBe(false);
    });

    it("stays hidden on the canonical Dexie deployment (no explicit port)", () => {
        // GitHub Pages serves over https/443 with no explicit port,
        // so window.location.port is "" and the port can never change
        // there - a hint would be pure noise for first-time visitors.
        expect(shouldShowPortChangeHint({mode: "dexie", port: ""})).toBe(false);
    });

    it("stays hidden in API mode with no explicit port", () => {
        expect(shouldShowPortChangeHint({mode: "api", port: ""})).toBe(false);
    });

    it("treats a whitespace-only port as no port (boundary)", () => {
        expect(shouldShowPortChangeHint({mode: "dexie", port: "   "})).toBe(false);
    });
});
