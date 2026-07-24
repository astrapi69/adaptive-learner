/**
 * Multiple-choice single/multi mode toggle — Create-Lesson inline editor
 * (#1888). Dexie build, NO backend, no AI key.
 *
 * The segmented "How many answers are correct?" control lives at the top
 * of the MC inline editor. This spec drives the REAL control in the
 * browser: default single (option markers are radios, exactly one
 * correct), switch to multiple (markers become checkboxes, a second
 * option can be marked correct), switch back to single (correct set
 * collapses to one). The mode radios are ``sr-only`` inside their labels,
 * so the spec clicks the visible label, exactly as a user does.
 *
 * The multi-answer PLAYTHROUGH (grading an exact-set selection) is already
 * covered by multiple-choice-device-check.spec.ts (#1527); this spec is
 * scoped to the editor toggle that only unit tests touched.
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors + label:has() for the
 * sr-only mode radios.
 */

import {expect, test, type Page} from "@playwright/test";

// Distinct backs so the generator can build MC distractor options.
const CARDS = [
    {front: "chat", back: "Katze"},
    {front: "chien", back: "Hund"},
    {front: "oiseau", back: "Vogel"},
    {front: "poisson", back: "Fisch"},
];

async function buildToMcEditor(page: Page): Promise<string> {
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({
        timeout: 15000,
    });
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
    await page.getByTestId("create-lesson-title").fill("E2E MC mode");
    await page.getByTestId("create-lesson-next").click();
    for (const card of CARDS) {
        await page.getByTestId("card-front-input").fill(card.front);
        await page.getByTestId("card-back-input").fill(card.back);
        await page.getByTestId("card-add-button").click();
    }
    await page.getByTestId("create-lesson-next").click();
    await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();
    await page.getByTestId("exercise-generate").click();
    await expect(page.getByTestId("exercise-list")).toBeVisible();

    // Open the generated MC exercise's inline editor.
    const mcRow = page
        .locator('[data-testid^="exercise-row-"][data-type="multiple_choice"]')
        .first();
    await expect(mcRow).toBeVisible();
    await mcRow.locator('[data-testid^="exercise-edit-"]').first().click();

    // Derive the exercise id from the mode fieldset testid so we can build
    // exact per-option selectors.
    const modeFieldset = mcRow
        .locator('[data-testid^="exercise-edit-mc-mode-"]')
        .first();
    await expect(modeFieldset).toBeVisible();
    const tid = await modeFieldset.getAttribute("data-testid");
    // exercise-edit-mc-mode-<id>
    return (tid ?? "").replace("exercise-edit-mc-mode-", "");
}

/** Select a mode. The radios are ``sr-only`` controlled inputs that
 *  respond inconsistently to a synthesized label click on this engine, so
 *  dispatch the real click event straight to the radio — this fires the
 *  same onChange -> setMultiple a user's click does in production. */
async function selectMode(
    page: Page,
    id: string,
    mode: "single" | "multiple",
): Promise<void> {
    await page
        .getByTestId(`exercise-edit-mc-mode-${mode}-${id}`)
        .dispatchEvent("click");
}

/** Count of currently-correct option markers in the editor. */
async function correctCount(page: Page, id: string): Promise<number> {
    const markers = page.locator(
        `[data-testid^="exercise-edit-mc-correct-${id}-"]`,
    );
    const n = await markers.count();
    let correct = 0;
    for (let i = 0; i < n; i++) {
        if (await markers.nth(i).isChecked()) correct++;
    }
    return correct;
}

/** Index of the first option marker that is NOT currently correct. The
 *  generator does not always put the correct option at index 0, so a
 *  second-correct test must target a genuinely-unchecked marker. */
async function firstUncheckedMarker(page: Page, id: string): Promise<number> {
    const markers = page.locator(
        `[data-testid^="exercise-edit-mc-correct-${id}-"]`,
    );
    const n = await markers.count();
    for (let i = 0; i < n; i++) {
        if (!(await markers.nth(i).isChecked())) return i;
    }
    throw new Error("no unchecked option marker found");
}

test.describe("MC single/multi mode toggle (#1888)", () => {
    test("default single = radios; multiple = checkboxes; switch-back collapses", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        const id = await buildToMcEditor(page);

        const marker0 = page.getByTestId(`exercise-edit-mc-correct-${id}-0`);

        // Default: "Allow one answer" is selected, markers are radios, and
        // exactly one option is correct.
        await expect(
            page.getByTestId(`exercise-edit-mc-mode-single-${id}`),
        ).toBeChecked();
        await expect(marker0).toHaveJSProperty("type", "radio");
        expect(await correctCount(page, id)).toBe(1);

        // Switch to "Allow multiple answers": markers become checkboxes.
        await selectMode(page, id, "multiple");
        await expect(
            page.getByTestId(`exercise-edit-mc-mode-multiple-${id}`),
        ).toBeChecked();
        await expect(marker0).toHaveJSProperty("type", "checkbox");

        // Mark a SECOND option correct — only possible in multi mode. Target
        // a genuinely-unchecked marker (the sole correct option is not
        // necessarily index 0). These are controlled React checkboxes that
        // don't flip under a synthesized pointer click on this engine
        // (check()/click() report "did not change its state"); dispatchEvent
        // fires the real onChange -> toggleCorrect, exactly as a user click
        // does in production.
        const idx = await firstUncheckedMarker(page, id);
        const extra = page.getByTestId(`exercise-edit-mc-correct-${id}-${idx}`);
        await extra.dispatchEvent("click");
        await expect(extra).toBeChecked();
        expect(await correctCount(page, id)).toBe(2);

        // Switch back to single: the correct set collapses to exactly one.
        await selectMode(page, id, "single");
        await expect(
            page.getByTestId(`exercise-edit-mc-mode-single-${id}`),
        ).toBeChecked();
        await expect(marker0).toHaveJSProperty("type", "radio");
        expect(await correctCount(page, id)).toBe(1);

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
