/**
 * Playwright config for the WebKit lesson-layout gate (#1834).
 *
 * WHY a dedicated WebKit config: the Dexie/Chromium gate
 * (``playwright.dexie.config.ts``) cannot catch a whole class of
 * iOS/Safari layout bugs, because they are Blink-vs-WebKit CSS ENGINE
 * differences, not app logic. The #1834 footer overlap is the canonical
 * example: ``justify-content: space-between`` makes WebKit OVERLAP flex
 * items when the row overflows, while Blink clamps to flex-start — so a
 * Chromium bounding-box test can never go red on it.
 *
 * This config serves the SAME Dexie/GH-Pages-shape preview build as the
 * Chromium gate (so the real app + real compiled CSS are under test) but
 * runs the specs under Playwright's ``webkit`` browser (Desktop WebKit,
 * the same engine family as Safari). It reproduces pure CSS-engine layout
 * behaviour without an iOS device. It does NOT replace real-device
 * verification of iOS keyboard / ``visualViewport`` behaviour (#1569) —
 * that stays a manual device check.
 *
 * Prerequisite: ``npx playwright install webkit`` (the WebKit browser is
 * NOT part of the default Chromium-only install). See
 * ``make test-webkit`` and the note in the release-workflow rule.
 */

import {defineConfig, devices} from "@playwright/test";

const PREVIEW_PORT =
    Number(process.env.ADAPTIVE_LEARNER_WEBKIT_PREVIEW_PORT) || 4174;

export default defineConfig({
    testDir: "./webkit",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 45_000,
    use: {
        baseURL: `http://localhost:${PREVIEW_PORT}`,
        actionTimeout: 15_000,
        // Keep a full trace + screenshot on any failure so an unexpected
        // result (e.g. a real-WebKit overlap) is inspectable in the Trace
        // Viewer, not just a red line.
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        // Same seed as the Dexie gate: German UI (so the lesson footer
        // shows the real German labels — "Weiter" / "Lektion abschließen"
        // — whose width drove the #1834 overflow) and the grid/tree
        // content view the navigation relies on.
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
            command: `cd ../frontend && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
            url: `http://localhost:${PREVIEW_PORT}`,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
        },
    ],
    projects: [
        {
            // Emulate a real iOS device (iPhone 12): realistic mobile
            // user-agent, device-scale-factor and touch context, so the
            // CSS layout is computed closer to real mobile Safari than a
            // bare desktop viewport would be. ``devices['iPhone 12']``
            // already selects the WebKit engine; ``browserName`` is pinned
            // for clarity. The spec additionally sweeps narrower widths to
            // exercise the flex-overflow regime.
            name: "webkit-iphone",
            testDir: "./webkit",
            use: {...devices["iPhone 12"], browserName: "webkit"},
        },
    ],
});
