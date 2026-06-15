/**
 * Share Wizard ("Für die Community bereitstellen") — 4-step flow
 * (E2E hardening). Dexie build, NO backend, NO AI.
 *
 * Builds a lesson with the Lesson Creator, saves it, opens it from
 * "My Lessons", and walks the share wizard:
 *   Step 1 — editable metadata (title / source / target / level)
 *   Step 2 — duplicate / placement scan
 *   Step 3 — quality validation
 *   Step 4 — confirm -> a GitHub PR URL is constructed (window.open is
 *            stubbed so no real tab opens; we assert the captured URL +
 *            the celebration + the PR link).
 *
 * STABLE SELECTORS ONLY (Phase-B-proof): ``data-testid`` step + control
 * anchors, the stubbed ``window.open``, and the PR-link href. No
 * CSS-class or DOM-structure assertions.
 */

import {expect, test, type Page} from "@playwright/test";

const CARDS = [
    {front: "Bonjour", back: "Guten Tag"},
    {front: "Merci", back: "Danke"},
    {front: "Oui", back: "Ja"},
    {front: "Non", back: "Nein"},
];

/** Build + save a lesson via the creator, landing on /content with the
 *  new lesson in My Lessons. */
async function createAndSaveLesson(page: Page): Promise<void> {
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({
        timeout: 15000,
    });
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
    await page.getByTestId("create-lesson-title").fill("E2E Share Greetings");
    await page.getByTestId("create-lesson-next").click();
    for (const card of CARDS) {
        await page.getByTestId("card-front-input").fill(card.front);
        await page.getByTestId("card-back-input").fill(card.back);
        await page.getByTestId("card-add-button").click();
    }
    await page.getByTestId("create-lesson-next").click();
    await page.getByTestId("exercise-count-slider").fill("8");
    await page.getByTestId("exercise-generate").click();
    await page.getByTestId("create-lesson-next").click();
    await page.getByTestId("create-lesson-save-local").click();
    await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
        timeout: 15000,
    });
    await page.getByTestId("create-lesson-to-browser").click();
    // #543 — the saved lesson lands in "My Lessons" or, if it matches a
    // published set, folds into that tree node (EXP-026); both surfaces render
    // the same UserSetActions share button, so wait for it in either location.
    await expect(
        page
            .locator(
                '[data-testid^="my-lesson-"][data-testid$="-share"], [data-testid^="folded-lesson-"][data-testid$="-share"]',
            )
            .first(),
    ).toBeVisible({timeout: 15000});
}

test.describe("Share Wizard — 4-step community share", () => {
    test("open from My Lessons, step through, construct the PR URL", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        // Stub window.open BEFORE any navigation: capture the URL the
        // wizard tries to open and report popup-blocked (so the wizard
        // also surfaces the manual PR link).
        await page.addInitScript(() => {
            (window as Window & {__openedUrls?: string[]}).__openedUrls = [];
            window.open = ((url?: string | URL) => {
                (window as Window & {__openedUrls?: string[]}).__openedUrls!.push(
                    String(url ?? ""),
                );
                return null;
            }) as typeof window.open;
        });

        await createAndSaveLesson(page);

        // Open the share wizard from the saved lesson (My Lessons or folded).
        await page
            .locator(
                '[data-testid^="my-lesson-"][data-testid$="-share"], [data-testid^="folded-lesson-"][data-testid$="-share"]',
            )
            .first()
            .click();
        await expect(page.getByTestId("share-wizard-step-1")).toBeVisible({
            timeout: 15000,
        });

        // Step 1 — editable metadata (fields are present + carry values).
        await expect(page.getByTestId("share-wizard-edit-title")).toBeVisible();
        await expect(page.getByTestId("share-wizard-edit-source")).toBeVisible();
        await expect(page.getByTestId("share-wizard-edit-target")).toBeVisible();
        // The lesson is shareable -> Continue is enabled (not blocked).
        await expect(page.getByTestId("share-wizard-next")).toBeEnabled();
        await page.getByTestId("share-wizard-next").click();

        // Step 2 — duplicate / placement scan.
        await expect(page.getByTestId("share-wizard-step-2")).toBeVisible({
            timeout: 10000,
        });
        await page.getByTestId("share-wizard-next").click();

        // Step 3 — quality validation.
        await expect(page.getByTestId("share-wizard-step-3")).toBeVisible({
            timeout: 10000,
        });
        await page.getByTestId("share-wizard-next").click();

        // Step 4 — confirm, then share constructs the PR URL.
        await expect(page.getByTestId("share-wizard-step-4")).toBeVisible({
            timeout: 10000,
        });
        await page.getByTestId("share-wizard-share").click();

        // The wizard called window.open with a GitHub URL.
        const opened = await page.evaluate(
            () => (window as Window & {__openedUrls?: string[]}).__openedUrls ?? [],
        );
        expect(
            opened.some((u) => u.includes("github.com")),
            `opened urls: ${opened.join(", ")}`,
        ).toBe(true);

        // The celebration + PR link surface (the link href is the PR URL).
        await expect(page.getByTestId("share-wizard-celebration")).toBeVisible({
            timeout: 10000,
        });
        await expect(page.getByTestId("share-wizard-pr-link")).toHaveAttribute(
            "href",
            /github\.com/,
        );

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
