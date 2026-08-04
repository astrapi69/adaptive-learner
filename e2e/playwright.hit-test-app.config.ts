import { defineConfig, devices } from "@playwright/test";

/**
 * App-level hit-test offset harness (#1569) — real app, Dexie preview, no backend.
 *
 * Serves the pre-built ``frontend/dist/`` via ``vite preview`` (the GH-Pages
 * shape the bug is reported on) and runs hit-test-app.spec.ts against real
 * routes. Prerequisite: the caller built ``dist/`` with
 * ``VITE_STORAGE_MODE=dexie`` — ``make test-hit-test-app`` does this.
 *
 * The pre-installed Chromium may differ from this Playwright pin; set
 * ``PW_CHROMIUM_EXECUTABLE`` to launch it instead of downloading a match.
 */

const PREVIEW_PORT =
  Number(process.env.ADAPTIVE_LEARNER_DEXIE_PREVIEW_PORT) || 4173;

const EXECUTABLE = process.env.PW_CHROMIUM_EXECUTABLE;
const LAUNCH = EXECUTABLE ? { executablePath: EXECUTABLE } : undefined;

export default defineConfig({
  testDir: "./hit-test",
  testMatch: /hit-test-app\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    actionTimeout: 15_000,
    trace: "on-first-retry",
    // Seed German + grid view so the app renders deterministically (same
    // reasoning as playwright.dexie.config.ts).
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${PREVIEW_PORT}`,
          localStorage: [
            { name: "adaptive-learner.content_view_mode", value: "grid" },
            { name: "adaptive-learner.language", value: "de" },
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
    { name: "chromium", use: { browserName: "chromium", launchOptions: LAUNCH } },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], browserName: "chromium", launchOptions: LAUNCH },
    },
  ],
});
