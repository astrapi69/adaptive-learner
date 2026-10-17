/**
 * Reaching the summary completes the lesson (#3792).
 *
 * Dexie build, no backend. Before the fix, ``completed`` was written only by
 * the "Mark as complete" button on the summary; "Next lesson" only navigated,
 * so a learner who went on that way kept every finished lesson
 * ``in_progress`` (later ``paused``) and got no lesson XP, no mission
 * progress and no flash round. A real backup held 17 such rows.
 *
 * The spec plays the first bundled lesson to its summary, goes on with
 * "Next lesson", and reads the result from IndexedDB and from the set view.
 * The measured values are printed before they are asserted, so a red run
 * shows what the learner actually got.
 */

import {expect, test, type Page} from "@playwright/test";

import {createTestUser} from "../helpers";
import {currentStepTestId, waitForStepAdvance} from "./_step-flow";

const SET_ID = "fr-a1-from-en";
const LESSON = "01-greetings.json";

interface ProgressSnapshot {
    status: string;
    current_step: number;
    completed_at: string | null;
    attempts: number | null;
}

async function openFirstLesson(page: Page): Promise<void> {
    await page.addInitScript(() => {
        localStorage.setItem("adaptive-learner.content_view_mode", "grid");
    });
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 20_000});
    await page.getByTestId("content-other-toggle").click();
    await page.getByTestId(`content-set-${SET_ID}-action`).click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({timeout: 25_000});
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});
    await expect(page).toHaveURL(new RegExp(`${LESSON.replace(".", "\\.")}$`));
}

/** Give each exercise type some answer; correctness does not matter here. */
async function answer(page: Page): Promise<void> {
    if (await page.getByTestId("free-text-exercise").count()) {
        await page.getByTestId("free-text-input").fill("bonjour");
        return;
    }
    if (await page.getByTestId("cloze-exercise").count()) {
        const inputs = page.locator('[data-testid^="cloze-input-"]');
        const n = await inputs.count();
        for (let i = 0; i < n; i++) await inputs.nth(i).fill("bonjour");
        return;
    }
    if (await page.getByTestId("word-tiles-exercise").count()) {
        const scrambled = page.locator('[data-testid^="word-tile-scrambled-"]');
        let guard = 0;
        while ((await scrambled.count()) > 0 && guard++ < 12) {
            await scrambled.first().click();
        }
        return;
    }
    if (await page.getByTestId("picture-exercise").count()) {
        await page.locator('[data-testid^="picture-choice-"]').first().click();
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

async function playToSummary(page: Page): Promise<void> {
    for (let i = 0; i < 40; i++) {
        if (await page.getByTestId("lesson-summary").count()) break;
        await answer(page);
        const check = page.getByTestId("lesson-check");
        if (await check.count()) {
            await expect(check).toBeEnabled({timeout: 5_000});
            await check.click();
        }
        const next = page.getByTestId("lesson-next");
        await expect(next).toBeVisible({timeout: 5_000});
        const before = await currentStepTestId(page);
        await next.click();
        await waitForStepAdvance(page, before);
    }
    await expect(page.getByTestId("lesson-summary")).toBeVisible({timeout: 15_000});
}

/** The lesson's progress row and the learner's XP, straight from IndexedDB. */
async function readState(page: Page): Promise<{row: ProgressSnapshot | null; totalXp: number}> {
    return page.evaluate(
        (filename) =>
            new Promise((resolve) => {
                const request = indexedDB.open("adaptive-learner");
                request.onerror = () => resolve({row: null, totalXp: -1});
                request.onsuccess = () => {
                    const db = request.result;
                    const tx = db.transaction(["lessonProgress", "userXp"], "readonly");
                    const progress = tx.objectStore("lessonProgress").getAll();
                    const xp = tx.objectStore("userXp").getAll();
                    tx.oncomplete = () => {
                        db.close();
                        const rows = progress.result as Array<Record<string, unknown>>;
                        const found = rows.find((r) => r.lesson_filename === filename);
                        const xpRows = xp.result as Array<{total_xp?: number}>;
                        resolve({
                            row: found
                                ? {
                                      status: String(found.status),
                                      current_step: Number(found.current_step),
                                      completed_at: (found.completed_at as string | null) ?? null,
                                      attempts: (found.attempts as number | null) ?? null,
                                  }
                                : null,
                            totalXp: xpRows.reduce((sum, r) => sum + (r.total_xp ?? 0), 0),
                        });
                    };
                    tx.onerror = () => {
                        db.close();
                        resolve({row: null, totalXp: -1});
                    };
                };
            }),
        LESSON,
    ) as Promise<{row: ProgressSnapshot | null; totalXp: number}>;
}

test.describe("Reaching the summary completes the lesson (#3792)", () => {
    // Onboarding + assessment + set download + one full lesson.
    test.describe.configure({timeout: 180_000});

    test.beforeEach(async ({page}) => {
        // The content tab waits for the live registry; pin it to an empty
        // list (#1653) so the spec reaches the bundled set without network.
        await page.route("**/recommended-repos.json", (route) =>
            route.fulfill({status: 200, body: '{"repos":[]}'}),
        );
        await page.route("**/books.yaml", (route) =>
            route.fulfill({status: 200, body: "domains: {}\n"}),
        );
        await createTestUser(page);
        await openFirstLesson(page);
    });

    test("going on with Next lesson leaves the finished lesson completed, with XP and in the set view", async ({
        page,
    }) => {
        const consoleErrors: string[] = [];
        page.on("console", (m) => {
            if (m.type() === "error") consoleErrors.push(m.text());
        });

        const before = await readState(page);
        await playToSummary(page);
        const atSummary = await readState(page);

        await page.getByTestId("lesson-summary-next").click();
        await expect(page).not.toHaveURL(new RegExp(`${LESSON.replace(".", "\\.")}$`), {timeout: 15_000});
        await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});
        const afterNext = await readState(page);

        await page.goto(`/content/set/${SET_ID}`);
        await expect(page.getByTestId("set-deep-link-found")).toBeVisible({timeout: 20_000});
        const doneInSetView = await page.getByTestId(`set-lesson-done-${LESSON}`).count();

        console.log(
            "[#3792] measured:",
            JSON.stringify({before, atSummary, afterNext, doneInSetView, consoleErrors}),
        );

        expect(afterNext.row?.status, "the finished lesson is completed").toBe("completed");
        expect(afterNext.row?.completed_at, "completed_at is stamped").not.toBeNull();
        expect(afterNext.totalXp, "the lesson XP was granted").toBeGreaterThan(before.totalXp);
        expect(doneInSetView, "the set view counts the lesson as done").toBe(1);
        expect(consoleErrors).toEqual([]);
    });

    test("a revisited, already completed lesson is not completed a second time", async ({page}) => {
        await playToSummary(page);
        await page.getByTestId("lesson-summary-next").click();
        await expect(page).not.toHaveURL(new RegExp(`${LESSON.replace(".", "\\.")}$`), {timeout: 15_000});
        const first = await readState(page);

        await page.goBack();
        await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});
        await page.waitForTimeout(1_500);
        const revisited = await readState(page);

        console.log("[#3792] revisit:", JSON.stringify({first, revisited}));
        expect(revisited.row?.status).toBe("completed");
        expect(revisited.row?.attempts, "no second attempt is recorded").toBe(first.row?.attempts);
        expect(revisited.totalXp, "no second XP grant").toBe(first.totalXp);
    });
});
