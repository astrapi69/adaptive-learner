import { defineConfig, devices } from "@playwright/test";

// The pre-installed Chromium may be a different build than this Playwright
// pin expects (the managed environment ships one browser under
// PLAYWRIGHT_BROWSERS_PATH). When PW_CHROMIUM_EXECUTABLE points at it, launch
// that binary instead of downloading a matching build; otherwise Playwright
// resolves its own managed browser as usual (CI, where they match).
const EXECUTABLE = process.env.PW_CHROMIUM_EXECUTABLE;
const LAUNCH = EXECUTABLE ? { executablePath: EXECUTABLE } : undefined;

/**
 * Hit-test offset harness (#1569) — self-contained, no app server.
 *
 * The specs load a static ``file://`` fixture (hit-test/fixtures/shell.html)
 * and measure the CSSOM-vs-hit-test desync directly, so this config needs
 * NEITHER the backend NOR the vite dev server (unlike playwright.config.ts).
 * Two projects: plain desktop Chromium, and a touch/mobile-emulated Chromium
 * (the surface where the offset is reported), so the same scenarios run under
 * both. Add a WebKit project once the class is understood if needed.
 *
 * Run: ``npm run test:hit-test`` (from e2e/) or ``make test-hit-test``.
 */
export default defineConfig({
  testDir: "./hit-test",
  testMatch: /hit-test-offset\.spec\.ts$/,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: 0,
  timeout: 20_000,
  reporter: [["list"]],
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium", launchOptions: LAUNCH },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        launchOptions: LAUNCH,
      },
    },
  ],
});
