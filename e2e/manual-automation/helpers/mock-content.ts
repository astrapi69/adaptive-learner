/**
 * Deterministic content mock for the manual-automation suite (#616).
 *
 * Routes the bundled tree (same-origin ``/content/adaptive-learner-content/
 * ...``) + the official GitHub raw URLs to the fixture in
 * ``fixtures/content.ts``, plus benign responses for the recommended-repos
 * + books catalogues, so the Content Browser shows a stable lesson with no
 * dependence on a content-repo checkout or network egress. Call BEFORE the
 * first navigation to /content.
 */

import type { Page } from "@playwright/test";

import {
  EMPTY_MANIFEST,
  FIXTURE_SET_PATH,
  LESSON,
  ROOT_MANIFEST,
  SET_MANIFEST,
} from "../fixtures/content";

export async function mockContent(page: Page): Promise<void> {
  // Bundled tree (vite-preview same-origin static path).
  await page.route("**/content/adaptive-learner-content/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/manifest.yaml") && !url.includes(`/${FIXTURE_SET_PATH}/`)) {
      return route.fulfill({ status: 200, body: ROOT_MANIFEST });
    }
    if (url.endsWith(`/${FIXTURE_SET_PATH}/manifest.yaml`)) {
      return route.fulfill({ status: 200, body: SET_MANIFEST });
    }
    if (url.endsWith(`/${FIXTURE_SET_PATH}/lessons/01.json`)) {
      return route.fulfill({ status: 200, body: LESSON });
    }
    // Assets etc. — 404 so the renderer falls back to placeholders.
    return route.fulfill({ status: 404, body: "" });
  });

  // Official GitHub source: an empty manifest (the bundled fixture is the
  // only set), and benign catalogues. Everything else 404s — no real net.
  await page.route("**/raw.githubusercontent.com/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/recommended-repos.json")) {
      return route.fulfill({ status: 200, body: JSON.stringify({ repos: [] }) });
    }
    if (url.endsWith("/books.yaml")) {
      return route.fulfill({ status: 200, body: "domains: {}\n" });
    }
    if (url.endsWith("/manifest.yaml")) {
      return route.fulfill({ status: 200, body: EMPTY_MANIFEST });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}
