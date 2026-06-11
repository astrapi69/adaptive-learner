/**
 * Playwright config for the visual-regression suite (#244, infra block 8).
 *
 * Runs the theme × view screenshot matrix under ``e2e/visual/`` against
 * the built frontend with NO backend process — the same GH-Pages shape
 * the dexie smoke gate uses, so every theme resolves client-side and the
 * baseline matches what real users see.
 *
 * Prerequisite: the caller has built ``frontend/dist/`` with
 * ``VITE_STORAGE_MODE=dexie`` (``make test-visual`` does this). Without
 * that build ``vite preview`` serves a stale or wrong bundle.
 *
 * Baseline workflow: the committed PNGs under ``e2e/visual/screenshots/``
 * ARE the baseline. Regenerate + REVIEW them with
 * ``npx playwright test -c playwright.visual.config.ts --update-snapshots``
 * ONLY after a deliberate, intended visual change — never to "repair" a
 * diff that reveals a real bug (fix the bug instead).
 */

import {defineConfig, devices} from "@playwright/test";

const PREVIEW_PORT =
    Number(process.env.ADAPTIVE_LEARNER_VISUAL_PREVIEW_PORT) || 4178;

export default defineConfig({
    testDir: "./visual",
    // Screenshots are deterministic; a wrong baseline must fail loudly,
    // not be papered over by a retry.
    fullyParallel: false,
    workers: 1,
    retries: 0,
    // Seeding a learner (onboarding + a lesson playthrough) before the
    // shot takes longer than a smoke nav.
    timeout: 120_000,
    // Co-locate the baseline with the suite (committed = baseline).
    snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
    expect: {
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.01,
            animations: "disabled",
        },
    },
    use: {
        baseURL: `http://localhost:${PREVIEW_PORT}`,
        actionTimeout: 15_000,
        viewport: {width: 1440, height: 900},
        trace: "on-first-retry",
    },
    webServer: [
        {
            command: `cd ../frontend && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
            url: `http://localhost:${PREVIEW_PORT}`,
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
        },
    ],
    projects: [
        {
            name: "visual",
            testDir: "./visual",
            use: {...devices["Desktop Chrome"], viewport: {width: 1440, height: 900}},
        },
    ],
});
