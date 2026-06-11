/**
 * NotebookLM package + learning-materials workflow (Dexie mode). Closes #280.
 *
 * GH-Pages-shape build, NO backend. Covers the study-materials surface on the
 * Progress page that works without a provider key:
 *
 *  - The ``notebooklm-section`` renders for a learner with an active project.
 *  - All three actions are present.
 *  - The empty study-questions list shows ``notebooklm-empty``.
 *  - "Download NotebookLM package" (client-side ZIP assembly) downloads a
 *    non-empty ``.zip``, even with minimal data.
 *
 * The two AI-backed actions (``notebooklm-generate-questions`` and
 * ``notebooklm-study-guide``) are key-gated (#281): without a configured
 * provider key they are disabled and an ``api-key-required-notice`` explains
 * why, so the spec asserts the disabled state rather than clicking them (a
 * keyless click would surface an error toast). Their happy paths are a
 * manual / API-mode check.
 */

import { expect, test } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";

test.describe("NotebookLM — study materials surface", () => {
  test("section renders, lists three actions, ZIP downloads", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await createTestUser(page);

    await page.goto("/progress");
    const section = page.getByTestId("notebooklm-section");
    await expect(section).toBeVisible({ timeout: 15000 });

    // All three actions are offered.
    await expect(page.getByTestId("notebooklm-generate-questions")).toBeVisible();
    await expect(page.getByTestId("notebooklm-download-zip")).toBeVisible();
    await expect(page.getByTestId("notebooklm-study-guide")).toBeVisible();

    // #281 — no key configured (Dexie default): the two AI-backed actions
    // are disabled with an explanatory notice; the client-side ZIP stays
    // enabled. The notice appearing proves the key status has resolved.
    await expect(page.getByTestId("api-key-required-notice")).toBeVisible();
    await expect(
      page.getByTestId("notebooklm-generate-questions"),
    ).toBeDisabled();
    await expect(page.getByTestId("notebooklm-study-guide")).toBeDisabled();
    await expect(page.getByTestId("notebooklm-download-zip")).toBeEnabled();

    // No questions generated yet (the AI path is a manual check).
    await expect(page.getByTestId("notebooklm-empty")).toBeVisible();

    // The ZIP package is assembled client-side — works without a key.
    const fs = await import("node:fs/promises");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("notebooklm-download-zip").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    const path = await download.path();
    const bytes = await fs.readFile(path);
    expect(bytes.byteLength).toBeGreaterThan(0);

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
