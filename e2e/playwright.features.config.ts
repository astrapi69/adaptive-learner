/**
 * Playwright config for the per-feature screenshot baselines (#1023).
 *
 * Distinct from ``playwright.visual.config.ts`` (the theme + critical-surface
 * regression matrices): this suite captures ONE labelled screenshot per
 * *feature* into ``e2e/visual/features/<feature>/<name>.png`` (+ the
 * ``.mobile`` variant), for both visual-regression AND documentation use.
 *
 * Output layout (driven by ``snapshotPathTemplate``):
 *   ``e2e/visual/features/<feature-name>/<shot>.png``         (desktop 1280×720)
 *   ``e2e/visual/features/<feature-name>/<shot>.mobile.png``  (mobile  375×812)
 *
 * The screenshot ``arg`` passed to ``toHaveScreenshot()`` already contains the
 * ``<feature-name>/<shot>`` path, so the template needs no project/platform
 * suffix — the baselines are clean and machine-deterministic (same approach as
 * the visual config).
 *
 * Prerequisite: a ``frontend/dist/`` built with ``VITE_STORAGE_MODE=dexie``
 * (``make capture-screenshots`` / ``make verify-screenshots`` build it first),
 * served with NO backend — the GH-Pages shape, so themes resolve client-side.
 *
 * Baseline workflow:
 *   - ``make capture-screenshots`` runs with ``--update-snapshots`` (writes the
 *     PNGs). REVIEW every PNG before committing.
 *   - ``make verify-screenshots`` runs without it (pixel-compares).
 */

import {defineConfig, devices} from "@playwright/test";

const PREVIEW_PORT =
    Number(process.env.ADAPTIVE_LEARNER_VISUAL_PREVIEW_PORT) || 4179;

export default defineConfig({
    testDir: ".",
    // Only the capture script — not the smoke / dexie / visual suites that
    // also live under e2e/.
    testMatch: "scripts/capture-feature-screenshots.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    // Seeding a learner (onboarding + a lesson playthrough) before some shots
    // takes longer than a smoke nav.
    timeout: 120_000,
    // Each ``toHaveScreenshot`` arg carries the ``<feature>/<shot>`` path, so
    // the baseline lands at e2e/visual/features/<feature>/<shot>.png.
    snapshotPathTemplate: "visual/features/{arg}{ext}",
    expect: {
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.01,
            threshold: 0.2,
            animations: "disabled",
        },
    },
    use: {
        baseURL: `http://localhost:${PREVIEW_PORT}`,
        actionTimeout: 15_000,
        trace: "on-first-retry",
        // Determinism hardening: pin locale + timezone so i18n text and local
        // timestamps render identically on every machine.
        locale: "de-DE",
        timezoneId: "Europe/Berlin",
        // NOTE (#1414): deliberately NO global content_view_mode seed here —
        // the content-hub shots document the #1257 LIST default. The
        // lesson-launching flows seed "grid" per-page inside
        // ``openFirstBundledLesson`` (e2e/visual/helpers.ts) instead.
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
            name: "features",
            use: {...devices["Desktop Chrome"]},
        },
    ],
});
