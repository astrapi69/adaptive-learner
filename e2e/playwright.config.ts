import {defineConfig} from "@playwright/test";

/**
 * Phase 6D: 7 smoke specs covering the critical user flows.
 *
 * Data isolation: the backend webServer command sets
 * ``ADAPTIVE_LEARNER_DATA_DIR`` to a tmp directory so E2E
 * writes never touch the user's real
 * ``~/.local/share/adaptive_learner/`` data. The filesystem
 * tripwire in app.paths verifies this - if E2E ever sees the
 * production marker file, the run aborts.
 *
 * It also sets a fixed ``ADAPTIVE_LEARNER_SECRET_KEY`` so the
 * crypto service has a Fernet key without depending on the
 * developer's dev-secret.env file. The value is deterministic
 * (Fernet.generate_key().decode() on a known seed) and lives
 * only in the spawned uvicorn process.
 *
 * Server isolation (#3316): the smoke specs call ``POST /api/reset``,
 * the Danger Zone endpoint that wipes every learner row. So the run
 * only ever talks to servers it started itself with the throwaway data
 * dir above:
 * - ``reuseExistingServer: false`` on both servers. Whatever already
 *   answers on a smoke port makes Playwright refuse to start ("is already
 *   used"); it is never reused. The frontend counts too: a reused dev
 *   frontend proxies ``/api`` to the dev backend.
 * - smoke-only ports and override names, distinct from the ``make dev``
 *   pair (ADAPTIVE_LEARNER_PORT / ADAPTIVE_LEARNER_FRONTEND_PORT, 18001 /
 *   15174) and from every other e2e config, so a running ``make dev``
 *   neither gets reset nor blocks the run. Override via
 *   ADAPTIVE_LEARNER_SMOKE_BACKEND_PORT / ADAPTIVE_LEARNER_SMOKE_FRONTEND_PORT.
 * Pinned by backend/tests/test_e2e_smoke_server_isolation.py.
 */

const BACKEND_PORT = Number(process.env.ADAPTIVE_LEARNER_SMOKE_BACKEND_PORT) || 18021;
const FRONTEND_PORT = Number(process.env.ADAPTIVE_LEARNER_SMOKE_FRONTEND_PORT) || 15184;

// Test-only data dir. Each E2E run wipes + recreates it so
// fixtures are deterministic.
const E2E_DATA_DIR = "/tmp/adaptive-learner-e2e-data";

// Fixed Fernet key for the E2E backend. Generated once, kept
// here so the spec run is self-contained (no .env dependency).
// 32-byte url-safe base64. Fine to commit since it only ever
// encrypts the test-process's ephemeral API key fixtures.
const E2E_FERNET_KEY = "i1u3pP7HXVHrUKE2NgUSe3FxLknXVbNZJxs1u-3pV9k=";

// Re-exported for playwright.docs.config.ts so the key literal is written
// exactly once. Deliberately a separate statement: editing the declaration
// line itself makes secret scanning re-flag an unchanged, long-committed
// test key on every diff that touches it.
export {E2E_FERNET_KEY};

const BACKEND_ENV = [
    `ADAPTIVE_LEARNER_PORT=${BACKEND_PORT}`,
    `ADAPTIVE_LEARNER_DATA_DIR=${E2E_DATA_DIR}`,
    // #2248: without this the key-resolution chain (env > secrets.yaml >
    // DB) reads the DEVELOPER's real ~/.config/adaptive_learner/secrets.yaml
    // - providers then show as externally configured on a machine with
    // stored keys while CI (no file) sees none, and a spec could even run
    // against real provider keys. Config isolation is part of data
    // isolation.
    `ADAPTIVE_LEARNER_CONFIG_DIR=${E2E_DATA_DIR}/config`,
    // #2263: the cache dir is the second channel of the #2248 class -
    // get_cache_dir() falls back to the developer's real
    // ~/.cache/adaptive_learner, where content_backup writes its
    // content-loader snapshots. Pinned like data + config so a run leaves
    // nothing outside the throwaway dir. backend/tests/test_e2e_path_isolation.py
    // pins the CLASS: every ADAPTIVE_LEARNER_*_DIR resolver must appear here.
    `ADAPTIVE_LEARNER_CACHE_DIR=${E2E_DATA_DIR}/cache`,
    `ADAPTIVE_LEARNER_SECRET_KEY=${E2E_FERNET_KEY}`,
].join(" ");

export default defineConfig({
    testDir: "./tests",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    // Cold-start headroom: the smoke starts uvicorn + the vite DEV server
    // itself, whose cold first-load (on-the-fly transpile) can push a test
    // past 30s under container load (#1254). Since #3316 a local run starts
    // them cold too instead of reusing a running dev server, so the same bar
    // applies everywhere.
    timeout: 60_000,
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
            // Never reuse (#3316): a backend already on this port was not
            // started with E2E_DATA_DIR, and the smoke specs reset it.
            reuseExistingServer: false,
            // Startup headroom for a cold uvicorn in the contended CI
            // container (#1254).
            timeout: 120_000,
        },
        {
            // VITE_API_PROXY_TARGET outranks ADAPTIVE_LEARNER_PORT in
            // vite.config.ts, so it is pinned too: an exported value would
            // otherwise route /api (and /api/reset) to another backend.
            // BROWSER=none keeps vite's `open: true` from opening a tab on a
            // local run; --strictPort fails instead of drifting to a free port.
            command:
                `cd ../frontend && ADAPTIVE_LEARNER_PORT=${BACKEND_PORT} ` +
                `ADAPTIVE_LEARNER_FRONTEND_PORT=${FRONTEND_PORT} ` +
                `VITE_API_PROXY_TARGET=http://localhost:${BACKEND_PORT} ` +
                `BROWSER=none npm run dev -- --strictPort`,
            url: `http://localhost:${FRONTEND_PORT}`,
            // Never reuse (#3316): a running dev frontend proxies /api to
            // the dev backend.
            reuseExistingServer: false,
            // Startup headroom for a cold vite dev server in CI (#1254).
            timeout: 120_000,
        },
    ],
    projects: [
        {name: "chromium", testDir: "./tests", use: {browserName: "chromium"}},
        {name: "smoke", testDir: "./smoke", use: {browserName: "chromium"}},
    ],
});
