/**
 * Playwright config for the visual-regression suite (#244 + #705).
 *
 * Runs both screenshot matrices under ``e2e/visual/`` —
 * ``theme-regression.spec.ts`` (5 views × 12 themes, desktop) and
 * ``critical-surfaces.spec.ts`` (14 surfaces × 3 viewports, default
 * theme) — against
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
    // One retry absorbs the rare nondeterministic CAPTURE (a late layout
    // phase shifted lesson-matching mobile by ~4px, #1540). It cannot
    // paper over a wrong baseline: a real mismatch is deterministic and
    // fails every retry, so the gate stays sharp.
    //
    // CI runs 4 workers (#2684): the suite is Dexie-mode (client-side
    // IndexedDB only, no backend), so every test gets an isolated
    // browser-context storage profile - concurrent workers cannot bleed
    // state between captures. The single `vite preview` webServer is a
    // static file server, safe under concurrent requests. GitHub-hosted
    // `ubuntu-latest` has 4 vCPUs. Local runs stay serial (workers: 1) so a
    // human reproducing a diff by hand gets deterministic, one-at-a-time
    // output. Cuts the ~150-screenshot suite's wall-clock roughly
    // proportionally without changing WHAT gets rendered - no coverage
    // tradeoff, unlike a path-scoped subset
    // (rejected for this suite, see ci-gates.md "Vorlaeufige Regel...
    // #2682" and quality-checks.md's #1628/#1638/#1635 precedent).
    fullyParallel: !!process.env.CI,
    workers: process.env.CI ? 4 : 1,
    retries: 1,
    // Seeding a learner (onboarding + a lesson playthrough) before the
    // shot takes longer than a smoke nav.
    timeout: 120_000,
    // Co-locate the baseline with the suite (committed = baseline).
    snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
    expect: {
        toHaveScreenshot: {
            // #2712 - the ratio alone scales with viewport AREA: 1% of
            // desktop 1920x1080 allowed 20,736 differing pixels, enough for
            // a COMPLETE page-state swap on a sparse-text surface (the
            // review-session empty-vs-active incident: only ~18k glyph
            // pixels exceed the colour threshold, the pastel fills do not).
            // The absolute cap makes the budget mean the same thing at
            // every viewport (gate contract point 5, quality-checks.md);
            // Playwright applies min(maxDiffPixels, ratio * area). 2,500
            // equals the mobile 1% budget, so mobile keeps its bound and
            // tablet/desktop tighten to it. A per-shot override that
            // loosens the ratio must loosen maxDiffPixels too (see the
            // lesson-matching@mobile override in critical-surfaces.spec.ts).
            maxDiffPixels: 2_500,
            maxDiffPixelRatio: 0.01,
            // Per-pixel colour-distance tolerance for anti-aliasing (#705).
            // Deliberately NOT lowered for #2712: pastel-fill sensitivity
            // would surface anti-aliasing churn across all ~150 baselines;
            // the absolute cap already catches state swaps via their text.
            threshold: 0.2,
            animations: "disabled",
        },
    },
    use: {
        baseURL: `http://localhost:${PREVIEW_PORT}`,
        actionTimeout: 15_000,
        viewport: {width: 1440, height: 900},
        trace: "on-first-retry",
        // Determinism hardening (follows #244): pin locale + timezone so
        // i18n text and local timestamps render identically on every machine.
        locale: "de-DE",
        timezoneId: "Europe/Berlin",
        // #1257 — the global content-view default flipped to "list"; the
        // visual baselines capture the grid/tree view, so seed grid.
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
