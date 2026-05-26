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
            name: "dexie-smoke",
            testDir: "./dexie",
            use: {browserName: "chromium"},
        },
    ],
});
