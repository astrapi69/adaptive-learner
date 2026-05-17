import {defineConfig} from "@playwright/test";

/**
 * Skeleton state (Phase 1A): no specs live under ./tests or ./smoke yet.
 * The webServer block still boots the backend + frontend so a smoke
 * spec asserting the placeholder Landing page can land at any time.
 * The first real spec (Phase 4A) is the Landing-page smoke check.
 */

export default defineConfig({
    testDir: "./tests",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 30_000,
    use: {
        baseURL: "http://localhost:5173",
        actionTimeout: 10_000,
        trace: "on-first-retry",
    },
    webServer: [
        {
            command: "cd ../backend && poetry run uvicorn app.main:app --port 8000",
            url: "http://localhost:8000/api/health",
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
        },
        {
            command: "cd ../frontend && npm run dev",
            url: "http://localhost:5173",
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
        },
    ],
    projects: [
        {name: "chromium", testDir: "./tests", use: {browserName: "chromium"}},
        {name: "smoke", testDir: "./smoke", use: {browserName: "chromium"}},
    ],
});
