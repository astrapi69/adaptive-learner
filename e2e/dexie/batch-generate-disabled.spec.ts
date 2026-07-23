/**
 * Device verification for #1896 — the batch "Generate exercises for all
 * lessons" button is PROACTIVELY disabled when there is nothing to generate.
 * Dexie build, NO backend, no AI key.
 *
 * Two real own-sets, both built the way a user builds them:
 *   1. "E2E Batch Full"  — the 4-step Lesson Creator with generated
 *      exercises → nothing pending → the batch button must render disabled
 *      with the reason as its tooltip.
 *   2. the imported theory-only lesson fixture → one lesson without
 *      exercises → the batch button stays enabled (there IS work to do).
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors.
 */

import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const FULL_SET = "created-e2e-batch-full";
const THEORY_SET = "imported-e2e-batch-theory-only";
const THEORY_FIXTURE = join(__dirname, "..", "fixtures", "theory-only-batch.lesson.json");

const CARDS = [
  { front: "Bonjour", back: "Guten Tag" },
  { front: "Merci", back: "Danke" },
  { front: "Oui", back: "Ja" },
  { front: "Non", back: "Nein" },
];

/** Build + save one own lesson WITH generated exercises. */
async function buildLessonWithExercises(page: Page, title: string): Promise<void> {
  await page.goto("/create-lesson");
  await expect(page.getByTestId("create-lesson-page")).toBeVisible({ timeout: 15000 });
  if (await page.getByTestId("create-lesson-draft-prompt").count()) {
    await page.getByTestId("create-lesson-draft-fresh").click();
  }
  await page.getByTestId("create-lesson-title").fill(title);
  await page.getByTestId("create-lesson-next").click();
  for (const card of CARDS) {
    await page.getByTestId("card-front-input").fill(card.front);
    await page.getByTestId("card-back-input").fill(card.back);
    await page.getByTestId("card-add-button").click();
  }
  await page.getByTestId("create-lesson-next").click();
  await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();
  await page.getByTestId("exercise-count-slider").fill("8");
  await page.getByTestId("exercise-generate").click();
  await page.getByTestId("create-lesson-next").click();
  await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("create-lesson-save-local").click();
  await expect(page.getByTestId("create-lesson-saved")).toBeVisible({ timeout: 15000 });
}

/** Import the theory-only fixture as an own lesson. */
async function importTheoryOnlyLesson(page: Page): Promise<void> {
  await page.goto("/content?tab=import");
  await expect(page.getByTestId("import-actions-panel")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("content-import-lesson").click();
  await expect(page.getByTestId("import-lesson-modal")).toBeVisible();
  await page.getByTestId("import-lesson-file").setInputFiles(THEORY_FIXTURE);
  await expect(page.getByTestId("import-lesson-preview")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("import-lesson-confirm").click();
  await expect(page.getByTestId("import-lesson-modal")).toBeHidden({ timeout: 15000 });
}

test.describe("Batch generate button proactive state (#1896)", () => {
  test("disabled when every lesson has exercises, active otherwise", async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await buildLessonWithExercises(page, "E2E Batch Full");
    await importTheoryOnlyLesson(page);

    await page.goto("/content?tab=import");
    await expect(page.getByTestId("content-my-lessons")).toBeVisible({ timeout: 15000 });

    const full = page.getByTestId(`generate-set-exercises-${FULL_SET}`);
    const theory = page.getByTestId(`generate-set-exercises-${THEORY_SET}`);

    // 1. Nothing to generate → proactively disabled, reason in the tooltip.
    await expect(full).toBeDisabled({ timeout: 15000 });
    await expect(full).toHaveAttribute("title", "Alle Lektionen haben bereits Übungen.");

    // 2. One lesson without exercises → unchanged, still clickable.
    await expect(theory).toBeEnabled();
    await expect(theory).not.toHaveAttribute("title", /.+/);

    expect(errors).toEqual([]);
  });
});
