/**
 * The lesson draft survives an interruption and resumes (#3228).
 *
 * Dexie build, NO backend, no AI key. Every other e2e that meets the
 * draft prompt clicks "fresh", so the path every interrupted author takes
 * ("continue the draft") ran in no e2e. This spec leaves a draft behind
 * through the REAL autosave (the 10 s interval, not a hand-written
 * localStorage row), reopens the wizard, chooses resume, and checks the
 * fields written before the interruption came back: title, native title,
 * the language pair and the cards. It then finishes and saves the lesson
 * and pins #3284: more than 10 s after the save the draft slot stays
 * empty (the autosave used to refill it).
 *
 * The draft store is localStorage in both storage modes
 * (``lib/content/lesson/lesson-draft.ts``), so one Dexie run covers both.
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors.
 */

import {expect, test, type Page} from "@playwright/test";

import {completeOnboarding} from "../helpers/onboarding";

const DRAFT_KEY = "adaptive-learner.lesson-draft";
/** DRAFT_AUTOSAVE_MS in CreateLesson.tsx plus a margin. */
const AUTOSAVE_WAIT_MS = 11_000;

const FIRST_CARDS = [
    {front: "Bonjour", back: "Guten Tag"},
    {front: "Merci", back: "Danke"},
];
const MORE_CARDS = [
    {front: "Oui", back: "Ja"},
    {front: "Non", back: "Nein"},
];

async function openCreator(page: Page): Promise<void> {
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({timeout: 15000});
}

async function addCards(page: Page, cards: {front: string; back: string}[]): Promise<void> {
    for (const card of cards) {
        await page.getByTestId("card-front-input").fill(card.front);
        await page.getByTestId("card-back-input").fill(card.back);
        await page.getByTestId("card-add-button").click();
    }
}

async function draftSlot(page: Page): Promise<string | null> {
    return page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
}

test.describe("#3228 - resume an interrupted lesson draft", () => {
    test.setTimeout(120_000);

    test("the draft left by autosave resumes with its fields, and the slot empties after the save", async ({
        page,
    }) => {
        await completeOnboarding(page, {migrationOffer: "none"});
        await openCreator(page);
        await expect(page.getByTestId("create-lesson-draft-prompt")).toHaveCount(0);

        // Step 1: the fields an author fills before an interruption.
        await page.getByTestId("create-lesson-title").fill("E2E Resume");
        await page.getByTestId("create-lesson-title-native").fill("E2E Fortsetzen");
        const targetLang = await page.getByTestId("create-lesson-target-lang").innerText();
        const sourceLang = await page.getByTestId("create-lesson-source-lang").innerText();
        await page.getByTestId("create-lesson-next").click();
        await expect(page.getByTestId("create-lesson-step-2")).toBeVisible();
        await addCards(page, FIRST_CARDS);
        await expect(page.getByTestId("card-count")).toContainText(String(FIRST_CARDS.length));

        // The interruption happens AFTER the real autosave wrote the slot.
        expect(await draftSlot(page)).toBeNull();
        await page.waitForTimeout(AUTOSAVE_WAIT_MS);
        const draft = JSON.parse((await draftSlot(page)) ?? "null");
        expect(draft, "autosave wrote the draft slot").not.toBeNull();
        expect(draft.step).toBe(2);
        expect(draft.meta.title).toBe("E2E Resume");
        expect(draft.cards).toHaveLength(FIRST_CARDS.length);

        // Reopen the wizard: the prompt offers the draft, the author resumes.
        await openCreator(page);
        await expect(page.getByTestId("create-lesson-draft-prompt")).toBeVisible();
        await page.getByTestId("create-lesson-draft-continue").click();
        await expect(page.getByTestId("create-lesson-draft-prompt")).toHaveCount(0);

        // Resumed on the step where the interruption hit, with the cards.
        await expect(page.getByTestId("create-lesson-step-2")).toBeVisible();
        await expect(page.getByTestId("card-count")).toContainText(String(FIRST_CARDS.length));
        for (const card of FIRST_CARDS) {
            await expect(page.getByTestId("card-list")).toContainText(card.front);
        }
        // Step 1's fields came back too.
        await page.getByTestId("create-lesson-back").click();
        await expect(page.getByTestId("create-lesson-title")).toHaveValue("E2E Resume");
        await expect(page.getByTestId("create-lesson-title-native")).toHaveValue("E2E Fortsetzen");
        await expect(page.getByTestId("create-lesson-target-lang")).toHaveText(targetLang);
        await expect(page.getByTestId("create-lesson-source-lang")).toHaveText(sourceLang);

        // Finish the lesson from the resumed draft.
        await page.getByTestId("create-lesson-next").click();
        await addCards(page, MORE_CARDS);
        await page.getByTestId("create-lesson-next").click();
        await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();
        await page.getByTestId("exercise-generate").click();
        await page.getByTestId("create-lesson-next").click();
        await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({timeout: 10000});
        await page.getByTestId("create-lesson-save-local").click();
        await expect(page.getByTestId("create-lesson-saved")).toBeVisible({timeout: 15000});

        // #3284: the save clears the slot and the autosave stays stopped;
        // one full interval later the slot is still empty.
        expect(await draftSlot(page)).toBeNull();
        await page.waitForTimeout(AUTOSAVE_WAIT_MS);
        expect(await draftSlot(page), "the autosave must not refill the slot after the save").toBeNull();

        // And the next visit offers no draft.
        await openCreator(page);
        await expect(page.getByTestId("create-lesson-draft-prompt")).toHaveCount(0);
    });

    test("#3227 - a stored draft raises the prompt, and 'fresh' opens an empty wizard and empties the slot", async ({
        page,
    }) => {
        await completeOnboarding(page, {migrationOffer: "none"});
        await page.evaluate((key) => {
            localStorage.setItem(
                key,
                JSON.stringify({
                    schema: 1,
                    step: 2,
                    meta: {title: "Verworfen", titleNative: "Discarded"},
                    cards: [],
                    updatedAt: new Date().toISOString(),
                }),
            );
        }, DRAFT_KEY);
        await openCreator(page);
        await expect(page.getByTestId("create-lesson-draft-prompt")).toBeVisible();
        await expect(page.getByTestId("create-lesson-draft-continue")).toBeVisible();
        await page.getByTestId("create-lesson-draft-fresh").click();
        await expect(page.getByTestId("create-lesson-draft-prompt")).toHaveCount(0);
        await expect(page.getByTestId("create-lesson-title")).toHaveValue("");
        expect(await draftSlot(page), "fresh empties the autosave slot").toBeNull();
    });
});
