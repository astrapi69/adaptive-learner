import {defineConfig} from "@playwright/test";

/**
 * Skeleton state (Phase 1A): no specs live under ./tests or ./smoke yet.
 * The webServer block still boots the backend + frontend so a smoke
 * spec asserting the placeholder Landing page can land at any time.
 * The first real spec (Phase 4A) is the Landing-page smoke check.
 *
 * Ports default to the project-wide non-standard pair (backend 18001,
 * frontend 15174) so Playwright coexists with anything already running
 * on the workstation. Override via ADAPTIVE_LEARNER_PORT /
 * ADAPTIVE_LEARNER_FRONTEND_PORT env vars.
 */

const BACKEND_PORT = Number(process.env.ADAPTIVE_LEARNER_PORT) || 18001;
const FRONTEND_PORT = Number(process.env.ADAPTIVE_LEARNER_FRONTEND_PORT) || 15174;

export default defineConfig({
    testDir: "./tests",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 30_000,
    use: {
        baseURL: `http://localhost:${FRONTEND_PORT}`,
        actionTimeout: 10_000,
        trace: "on-first-retry",
    },
    webServer: [
        {
            command: `cd ../backend && ADAPTIVE_LEARNER_PORT=${BACKEND_PORT} poetry run uvicorn app.main:app --port ${BACKEND_PORT}`,
            url: `http://localhost:${BACKEND_PORT}/api/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
        },
        {
            command: `cd ../frontend && ADAPTIVE_LEARNER_PORT=${BACKEND_PORT} ADAPTIVE_LEARNER_FRONTEND_PORT=${FRONTEND_PORT} npm run dev`,
            url: `http://localhost:${FRONTEND_PORT}`,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
        },
    ],
    projects: [
        {name: "chromium", testDir: "./tests", use: {browserName: "chromium"}},
        {name: "smoke", testDir: "./smoke", use: {browserName: "chromium"}},
    ],
});
