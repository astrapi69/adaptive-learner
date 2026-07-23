/**
 * Combine own lessons into a set (#1741). Dexie build, NO backend, no AI key.
 *
 * Builds two own lessons through the Create-Lesson wizard, then in "My
 * Content" enables the combine selection mode, selects both, and combines
 * them into a NEW set. Verifies the whole My-Lessons -> select -> dialog ->
 * persist path end to end in the browser (the unit tests cover the dialog
 * and the combine logic in isolation, not the real selection + IndexedDB
 * round-trip), and that the originals are kept (non-destructive).
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors.
 */

import {expect, test, type Page} from "@playwright/test";

import {completeOnboarding} from "../helpers/onboarding";

const CARDS = [
    {front: "Bonjour", back: "Guten Tag"},
    {front: "Merci", back: "Danke"},
    {front: "Oui", back: "Ja"},
    {front: "Non", back: "Nein"},
];

/** Route the remote/bundled content index to EMPTY so the Content Hub
 *  finishes loading with zero remote sets and shows the IndexedDB "My
 *  Lessons" (the only thing this spec needs). Without this the hub stays
 *  in ``content-loading`` waiting on a content-repo index that isn't
 *  present; combining is a My-Lessons operation and needs no remote set,
 *  so an empty index keeps the spec hermetic across environments. */
async function mockEmptyContentIndex(page: Page): Promise<void> {
    const empty = 'schema_version: "1.3"\nsets: []\n';
    const handler = (route: import("@playwright/test").Route) => {
        const url = route.request().url();
        if (url.endsWith("/recommended-repos.json")) {
            return route.fulfill({status: 200, body: '{"repos":[]}'});
        }
        if (url.endsWith("/books.yaml")) {
            return route.fulfill({status: 200, body: "domains: {}\n"});
        }
        if (url.endsWith("/manifest.yaml")) {
            return route.fulfill({status: 200, body: empty});
        }
        return route.fulfill({status: 404, body: ""});
    };
    await page.route("**/raw.githubusercontent.com/**", handler);
    await page.route("**/adaptive-learner-content/**", handler);
}

/** Build + save one lesson through the wizard. Leaves the browser on the
 *  post-save "saved" screen. */
async function createLesson(page: Page, title: string): Promise<void> {
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({
        timeout: 15000,
    });
    // A prior save may leave a restorable draft prompt — always start fresh.
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
    await page.getByTestId("exercise-generate").click();
    await page.getByTestId("create-lesson-next").click();
    await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({
        timeout: 10000,
    });
    await page.getByTestId("create-lesson-save-local").click();
    await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
        timeout: 15000,
    });
}

test.describe("Combine own lessons into a set (#1741)", () => {
    test("select two own lessons -> combine into a new set, originals kept", async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await mockEmptyContentIndex(page);
        await completeOnboarding(page);
        await createLesson(page, "E2E Combine A");
        await createLesson(page, "E2E Combine B");

        // Navigate to the Content Browser via the post-save button (SPA
        // navigation; a hard goto lands on the global empty state before the
        // user-generated sets load). Both own lessons are listed under My
        // Lessons (one "play" action per row).
        await page.getByTestId("create-lesson-to-browser").click();
        await expect(page.getByTestId("content-my-lessons")).toBeVisible({
            timeout: 15000,
        });
        const lessonRows = page.locator(
            '[data-testid^="my-lesson-"][data-testid$="-play"]',
        );
        await expect(lessonRows).toHaveCount(2);

        // Enter combine selection mode -> per-row selection checkboxes appear.
        await page.getByTestId("my-lessons-combine-toggle").click();
        const selects = page.locator(
            '[data-testid^="my-lesson-"][data-testid$="-select"]',
        );
        await expect(selects).toHaveCount(2);

        // Select both lessons; the combine action bar reflects the selection.
        await selects.nth(0).click();
        await selects.nth(1).click();
        await expect(page.getByTestId("my-lessons-combine-bar")).toBeVisible();
        await page.getByTestId("my-lessons-combine-open").click();

        // The combine dialog: new-set mode, title required.
        await expect(page.getByTestId("combine-lessons-dialog")).toBeVisible();
        await page.getByTestId("combine-mode-new").click();
        await page.getByTestId("combine-new-title").fill("E2E Combined Set");
        await page.getByTestId("combine-confirm").click();

        // Dialog closes cleanly. Combine is non-destructive: both originals
        // are KEPT and the new combined set is added -> three rows now.
        await expect(page.getByTestId("combine-lessons-dialog")).toHaveCount(0, {
            timeout: 15000,
        });
        await expect(lessonRows).toHaveCount(3);
        await expect(
            page.getByTestId("my-lesson-created-e2e-combine-a-play"),
        ).toBeVisible();
        await expect(
            page.getByTestId("my-lesson-created-e2e-combine-b-play"),
        ).toBeVisible();
        await expect(
            page.getByTestId("my-lesson-created-e2e-combined-set-play"),
        ).toBeVisible();

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
