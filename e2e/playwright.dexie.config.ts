/**
 * Playwright config for the Dexie-mode smoke gate
 * (DEXIE-MODE-RELEASE-GATE-01).
 *
 * Goal: run the smoke spec under ``e2e/dexie/`` against the
 * built frontend with NO backend process. This mirrors the
 * GitHub Pages deployment shape — the only place real users
 * meet the app — so any feature that crashes in Dexie mode
 * fails this gate before reaching production.
 *
 * Prerequisite: the caller has built ``frontend/dist/`` with
 * ``VITE_STORAGE_MODE=dexie`` (the ``make test-dexie-smoke``
 * target does this). Without that build, ``vite preview``
 * spins up but serves either a stale bundle or fails.
 */

import {defineConfig} from "@playwright/test";

const PREVIEW_PORT =
    Number(process.env.ADAPTIVE_LEARNER_DEXIE_PREVIEW_PORT) || 4173;

export default defineConfig({
    testDir: "./dexie",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 30_000,
    use: {
        baseURL: `http://localhost:${PREVIEW_PORT}`,
        actionTimeout: 10_000,
        trace: "on-first-retry",
        // #1257 — the global content-view default flipped to "list". The
        // tree-based journeys below assert the grid/tree view, so seed the
        // pref to "grid" for the whole gate. The list default itself is
        // covered by the frontend unit tests (Content.viewmode.test +
        // viewModePref.test); the e2e gate is about per-route crash-safety
        // and tree functionality, not the default.
        //
        // #1469 — the whole dexie-smoke suite assumes the app default is
        // German (e.g. content-tree.spec: German-source sets in the primary
        // "I speak" section, English-source under the collapsed "other"
        // section). #1464 made the fresh-install UI language follow
        // navigator.language, which is "en-US" in headless Chromium, so the
        // German fixtures fell into the collapsed "other" section and their
        // content-set rows became invisible. Seed a saved "de" choice (which
        // always wins over navigator.language) so the gate runs in German
        // exactly as the specs were written, independent of the CI browser
        // locale. #1464's browser-locale default is unchanged for real users
        // and is covered by the frontend unit tests (useI18n / languages).
        storageState: {
            cookies: [],
            origins: [
                {
                    origin: `http://localhost:${PREVIEW_PORT}`,
                    localStorage: [
                        {
                            name: "adaptive-learner.content_view_mode",
                            value: "grid",
                        },
                        {
                            name: "adaptive-learner.language",
                            value: "de",
                        },
                    ],
                },
            ],
        },
    },
    webServer: [
        {
            // ``vite preview`` serves the pre-built ``dist/``
            // exactly as the GH Pages CDN would. No backend
            // process — Dexie mode talks to IndexedDB only.
            command: `cd ../frontend && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
            url: `http://localhost:${PREVIEW_PORT}`,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
        },
    ],
    projects: [
        {
            // #2043 - content-obtainability probe. Fails once, loudly,
            // with channel diagnostics when NO DEFAULT_SOURCES channel
            // delivers a manifest; the dependent project is then skipped
            // instead of failing ~34 specs with vague locator timeouts.
            // When content IS obtainable (CI, normal dev) the probe
            // passes and the suite runs exactly as before.
            name: "content-probe",
            testDir: "./dexie-setup",
            testMatch: /content-probe\.setup\.ts/,
            use: {browserName: "chromium"},
        },
        {
            name: "dexie-smoke",
            testDir: "./dexie",
            dependencies: ["content-probe"],
            use: {browserName: "chromium"},
        },
    ],
});
