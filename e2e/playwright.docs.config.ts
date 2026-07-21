/**
 * Playwright config for the documentation screenshot capture.
 *
 * NOT a gate and NOT a baseline suite. The visual (``playwright.visual.config``)
 * and per-feature (``playwright.features.config``) suites compare against
 * committed PNGs and turn red on a diff. This one only WRITES images, for
 * hand-picked use in prose: the lesson-creator walkthrough in the
 * learn-content-engine blog series (engine docs/blog/create-a-lesson-in-the-app.md).
 * Nothing compares its output, so it can never fail a build.
 *
 * Why it lives here and not in the engine repo: the capture needs App
 * knowledge (routes, ``data-testid``s, the locale storage key), so it belongs
 * to the consumer that owns those. The engine's article process references
 * this script; the repositories stay uncoupled in code.
 *
 * Prerequisite: the caller has built ``frontend/dist/`` (``make
 * capture-blog-screenshots`` does this). Without that build ``vite preview``
 * serves a stale bundle.
 *
 * Usage:
 *   make capture-blog-screenshots              # English UI (article default)
 *   DOCS_LANG=de make capture-blog-screenshots # German UI
 *
 * Output goes to ``e2e/docs/output/<lang>/`` which is git-ignored: these are
 * artifacts to copy into an article, not repository content.
 */

import {defineConfig, devices} from "@playwright/test";

// Reuse the E2E smoke's throwaway test key instead of writing the literal a
// second time. One declaration, one place to rotate, and no duplicated
// secret for secret scanning to flag.
import {E2E_FERNET_KEY} from "./playwright.config";

const PREVIEW_PORT =
    Number(process.env.ADAPTIVE_LEARNER_DOCS_PREVIEW_PORT) || 4179;

// The capture needs a BACKEND, unlike the visual suite which deliberately runs
// without one. ``useI18n`` resolves a string in three steps: the backend
// catalog from ``/api/i18n/{lang}``, then a small localized hardcoded subset
// for first-paint resilience, then the caller's inline English fallback.
// Without a backend only the subset is localized, so a German run produced
// German navigation and English everything else - screenshots that looked like
// an i18n gap but were an artifact of the harness. Its own port so a running
// dev backend is neither disturbed nor silently reused.
const BACKEND_PORT =
    Number(process.env.ADAPTIVE_LEARNER_DOCS_BACKEND_PORT) || 18011;

const DOCS_DATA_DIR = "/tmp/adaptive-learner-docs-capture-data";


const BACKEND_ENV = [
    `ADAPTIVE_LEARNER_PORT=${BACKEND_PORT}`,
    `ADAPTIVE_LEARNER_DATA_DIR=${DOCS_DATA_DIR}`,
    `ADAPTIVE_LEARNER_SECRET_KEY=${E2E_FERNET_KEY}`,
].join(" ");

/** UI language of the captured screenshots. The article set is English. */
export const DOCS_LANG = process.env.DOCS_LANG === "de" ? "de" : "en";

export default defineConfig({
    testDir: "./docs",
    fullyParallel: false,
    workers: 1,
    // A capture run writes files; a retry would only rewrite them.
    retries: 0,
    timeout: 120_000,
    use: {
        baseURL: `http://localhost:${PREVIEW_PORT}`,
        actionTimeout: 15_000,
        // Matches the width of the screenshots already published in the
        // article, so a refreshed image sits flush with the older ones.
        viewport: {width: 1280, height: 1000},
        // Pin locale + timezone like the visual suite, so a capture does not
        // pick up the runner's environment.
        locale: DOCS_LANG === "de" ? "de-DE" : "en-US",
        timezoneId: "Europe/Berlin",
    },
    webServer: [
        {
            command:
                `rm -rf ${DOCS_DATA_DIR} && mkdir -p ${DOCS_DATA_DIR} && ` +
                `cd ../backend && ${BACKEND_ENV} poetry run uvicorn app.main:app --port ${BACKEND_PORT}`,
            url: `http://localhost:${BACKEND_PORT}/api/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
        {
            // ADAPTIVE_LEARNER_PORT points vite's /api proxy at the capture
            // backend. ``preview`` inherits ``server.proxy``, so this is the
            // one knob that makes the catalog reachable.
            command:
                `cd ../frontend && ADAPTIVE_LEARNER_PORT=${BACKEND_PORT} ` +
                `npx vite preview --port ${PREVIEW_PORT} --strictPort`,
            url: `http://localhost:${PREVIEW_PORT}`,
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
        },
    ],
    projects: [
        {
            name: "docs",
            use: {...devices["Desktop Chrome"], viewport: {width: 1280, height: 1000}},
        },
    ],
});
