import {defineConfig} from "@playwright/test";

/**
 * Phase 6D: 7 smoke specs covering the critical user flows.
 *
 * Data isolation: the backend webServer command sets
 * ``ADAPTIVE_LEARNER_DATA_DIR`` to a tmp directory so E2E
 * writes never touch the user's real
 * ``~/.local/share/adaptive_learner/`` data. The filesystem
 * tripwire in app.paths verifies this — if E2E ever sees the
 * production marker file, the run aborts.
 *
 * It also sets a fixed ``ADAPTIVE_LEARNER_SECRET_KEY`` so the
 * crypto service has a Fernet key without depending on the
 * developer's dev-secret.env file. The value is deterministic
 * (Fernet.generate_key().decode() on a known seed) and lives
 * only in the spawned uvicorn process.
 *
 * Ports default to the project-wide non-standard pair (backend 18001,
 * frontend 15174) so Playwright coexists with anything already running
 * on the workstation. Override via ADAPTIVE_LEARNER_PORT /
 * ADAPTIVE_LEARNER_FRONTEND_PORT env vars.
 */

const BACKEND_PORT = Number(process.env.ADAPTIVE_LEARNER_PORT) || 18001;
const FRONTEND_PORT = Number(process.env.ADAPTIVE_LEARNER_FRONTEND_PORT) || 15174;

// Test-only data dir. Each E2E run wipes + recreates it so
// fixtures are deterministic.
const E2E_DATA_DIR = "/tmp/adaptive-learner-e2e-data";

// Fixed Fernet key for the E2E backend. Generated once, kept
// here so the spec run is self-contained (no .env dependency).
// 32-byte url-safe base64. Fine to commit since it only ever
// encrypts the test-process's ephemeral API key fixtures.
export const E2E_FERNET_KEY = "i1u3pP7HXVHrUKE2NgUSe3FxLknXVbNZJxs1u-3pV9k=";

const BACKEND_ENV = [
    `ADAPTIVE_LEARNER_PORT=${BACKEND_PORT}`,
    `ADAPTIVE_LEARNER_DATA_DIR=${E2E_DATA_DIR}`,
    `ADAPTIVE_LEARNER_SECRET_KEY=${E2E_FERNET_KEY}`,
].join(" ");

export default defineConfig({
    testDir: "./tests",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    // CI headroom: the smoke auto-starts uvicorn + the vite DEV server inside
    // the Playwright container, whose cold first-load (on-the-fly transpile)
    // can push a test past 30s under container load (#1254). Local runs reuse
    // an already-running dev server, so 30s stays the bar there.
    timeout: process.env.CI ? 60_000 : 30_000,
    use: {
        baseURL: `http://localhost:${FRONTEND_PORT}`,
        actionTimeout: 10_000,
        trace: "on-first-retry",
    },
    webServer: [
        {
            command:
                `rm -rf ${E2E_DATA_DIR} && mkdir -p ${E2E_DATA_DIR} && ` +
                `cd ../backend && ${BACKEND_ENV} poetry run uvicorn app.main:app --port ${BACKEND_PORT}`,
            url: `http://localhost:${BACKEND_PORT}/api/health`,
            reuseExistingServer: !process.env.CI,
            // Startup headroom for a cold uvicorn in the contended CI
            // container (#1254); only applies when Playwright starts the
            // server (CI), not when a local dev server is reused.
            timeout: 120_000,
        },
        {
            command: `cd ../frontend && ADAPTIVE_LEARNER_PORT=${BACKEND_PORT} ADAPTIVE_LEARNER_FRONTEND_PORT=${FRONTEND_PORT} npm run dev`,
            url: `http://localhost:${FRONTEND_PORT}`,
            reuseExistingServer: !process.env.CI,
            // Startup headroom for a cold vite dev server in CI (#1254).
            timeout: 120_000,
        },
    ],
    projects: [
        {name: "chromium", testDir: "./tests", use: {browserName: "chromium"}},
        {name: "smoke", testDir: "./smoke", use: {browserName: "chromium"}},
    ],
});
