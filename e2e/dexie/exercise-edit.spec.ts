/**
 * Step-3 inline exercise editing — device verification (#1844).
 *
 * Dexie build, NO backend, no AI key. Builds a lesson in /create-lesson,
 * edits a GENERATED exercise's content, saves it, then plays the lesson to
 * confirm the edit actually takes effect in the player (not just in the
 * wizard state). Also confirms the type-specific editor opens for a matching
 * exercise and that its edit persists across a reopen (real-app round-trip),
 * and that the existing delete control still works (regression).
 *
 * The creator's deterministic generator produces matching + free-text from
 * plain cards (cloze / word-tiles need example sentences, picture-choice
 * needs card images — none of which the card form collects), so those two
 * types are the ones reachable end-to-end here; the other three renderers
 * are covered by the component + pure-lib tests.
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors.
 */

import {expect, test, type Page} from "@playwright/test";
import {currentStepTestId, waitForStepAdvance} from "./_step-flow";

const MARKER = "EDITEDPROMPTMARKER";

const CARDS = [
    {front: "Bonjour", back: "Guten Tag"},
    {front: "Merci", back: "Danke"},
    {front: "Oui", back: "Ja"},
    {front: "Non", back: "Nein"},
];

async function openCreator(page: Page): Promise<void> {
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({
        timeout: 15000,
    });
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
}

async function buildToExercises(page: Page): Promise<void> {
    await page.getByTestId("create-lesson-title").fill("E2E Edit Exercises");
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
    await expect(page.getByTestId("exercise-list")).toBeVisible();
}

/** Answer whatever exercise is on screen (coverage, not correctness). */
async function answer(page: Page): Promise<void> {
    if (await page.getByTestId("free-text-input").count()) {
        await page.getByTestId("free-text-input").first().fill("x");
        return;
    }
    if (await page.getByTestId("multiple-choice-exercise").count()) {
        await page.getByTestId("multiple-choice-input-0").click();
        return;
    }
    if (await page.getByTestId("matching-exercise").count()) {
        const lefts = page.getByTestId(/^matching-left-\d+$/);
        const n = await lefts.count();
        for (let i = 0; i < n; i++) {
            await page.getByTestId(`matching-left-${i}`).click();
            await page.getByTestId(`matching-right-${i}`).click();
        }
    }
}

test.describe("Exercise inline editing (#1844)", () => {
    test("edit a free-text prompt, save, and see it in the player", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await openCreator(page);
        await buildToExercises(page);

        // Edit the first free-text exercise's prompt to a unique marker.
        const ftRow = page
            .locator('[data-testid^="exercise-row-"][data-type="free_text"]')
            .first();
        await expect(ftRow).toBeVisible();
        await ftRow.locator('[data-testid^="exercise-edit-"]').first().click();
        const promptInput = ftRow.locator(
            '[data-testid^="exercise-edit-prompt-"]',
        );
        await promptInput.fill(MARKER);
        await ftRow.locator('[data-testid^="exercise-edit-save-"]').click();

        // Wizard state reflects the edit: the row preview shows the marker.
        await expect(ftRow).toContainText(MARKER);

        // Advance + save the lesson.
        await page.getByTestId("create-lesson-next").click();
        await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({
            timeout: 10000,
        });
        await page.getByTestId("create-lesson-save-local").click();
        await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
            timeout: 15000,
        });

        // Play the lesson; assert the edited prompt renders during the
        // free-text step.
        await page.getByTestId("create-lesson-play").click();
        await expect(page.getByTestId("lesson-page")).toBeVisible({
            timeout: 15000,
        });

        let sawMarker = false;
        for (let i = 0; i < 40; i++) {
            if (await page.getByTestId("lesson-summary").count()) break;
            const promptEl = page.getByTestId("free-text-prompt");
            if (
                (await promptEl.count()) &&
                (await promptEl.first().textContent())?.includes(MARKER)
            ) {
                sawMarker = true;
            }
            await answer(page);
            const check = page.getByTestId("lesson-check");
            if (await check.count()) {
                await expect(check).toBeEnabled({timeout: 5000});
                await check.click();
            }
            const next = page.getByTestId("lesson-next");
            if (!(await next.count())) break;
            const before = await currentStepTestId(page);
            await next.click();
            await waitForStepAdvance(page, before);
        }

        expect(
            sawMarker,
            "the edited free-text prompt should render in the player",
        ).toBe(true);
        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("matching editor opens, edits persist across a reopen, delete still works", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await openCreator(page);
        await buildToExercises(page);

        const matchRow = page
            .locator('[data-testid^="exercise-row-"][data-type="matching"]')
            .first();
        await expect(matchRow).toBeVisible();

        // Open the editor — the type-specific pair fields render.
        await matchRow.locator('[data-testid^="exercise-edit-"]').first().click();
        const firstRight = matchRow.locator(
            '[data-testid^="exercise-edit-pair-right-"]',
        );
        await expect(firstRight.first()).toBeVisible();
        await firstRight.first().fill("EDITEDMATCH");
        await matchRow.locator('[data-testid^="exercise-edit-save-"]').click();

        // Reopen and confirm the edit persisted in the exercise record.
        await matchRow.locator('[data-testid^="exercise-edit-"]').first().click();
        await expect(
            matchRow.locator('[data-testid^="exercise-edit-pair-right-"]').first(),
        ).toHaveValue("EDITEDMATCH");
        await matchRow.locator('[data-testid^="exercise-edit-cancel-"]').click();

        // Regression: delete removes the row.
        const rowId = await matchRow.getAttribute("data-testid");
        await matchRow.locator('[data-testid^="exercise-delete-"]').click();
        await expect(page.locator(`[data-testid="${rowId}"]`)).toHaveCount(0);

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
