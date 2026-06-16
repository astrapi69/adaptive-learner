/**
 * Playwright config for the automated manual-test-plan suite (#616).
 *
 * Mirrors the dexie-smoke gate: runs the specs under
 * ``e2e/manual-automation/`` against the pre-built ``frontend/dist/``
 * (``VITE_STORAGE_MODE=dexie`` + ``vite preview``, NO backend) — the
 * GitHub-Pages deployment shape real users meet. The Makefile target
 * ``test-manual-automation`` builds the dexie bundle first.
 *
 * Artefacts on failure: a screenshot, a retained video, and a trace;
 * plus a JUnit report for CI.
 */

import { defineConfig } from "@playwright/test";

const PREVIEW_PORT =
  Number(process.env.ADAPTIVE_LEARNER_MANUAL_PREVIEW_PORT) || 4183;

export default defineConfig({
  testDir: "./manual-automation",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["junit", { outputFile: "test-results/manual-automation-junit.xml" }],
    ["html", { outputFolder: "playwright-report-manual", open: "never" }],
  ],
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    actionTimeout: 10_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
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
      name: "manual-automation",
      use: { browserName: "chromium" },
    },
  ],
});
