/**
 * Regression pin for #997: the service worker must NOT cache /api/ routes.
 *
 * The Phase 9B NetworkFirst cache of API GETs made downloaded sets
 * "disappear" in server mode (a stale/empty set list was served after a
 * download) and produced workbox "no-response" errors when a slow GET hit
 * the network timeout with no cache entry. /api/ is only ever used in
 * server (API) mode; the backend is authoritative there, so every /api/
 * request must go straight to the network (NetworkOnly).
 */
import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const viteConfig = readFileSync(join(process.cwd(), "vite.config.ts"), "utf-8");

describe("PWA service worker — /api/ is NetworkOnly (#997)", () => {
    it("does not cache /api/ GETs with NetworkFirst", () => {
        // Assert the workbox directive, not the bare word (comments may
        // still explain the removed NetworkFirst behaviour).
        expect(viteConfig).not.toContain('handler: "NetworkFirst"');
        expect(viteConfig).not.toContain("adaptive-learner-api");
    });

    it("keeps a NetworkOnly handler for the /api/ route", () => {
        expect(viteConfig).toContain('handler: "NetworkOnly"');
        // The /api/ catch-all pattern is still present.
        expect(viteConfig).toContain("/^\\/api\\//");
    });

    it("still caches lesson/asset content (offline playback is preserved)", () => {
        expect(viteConfig).toContain("StaleWhileRevalidate");
        expect(viteConfig).toContain("adaptive-learner-lessons");
    });
});
