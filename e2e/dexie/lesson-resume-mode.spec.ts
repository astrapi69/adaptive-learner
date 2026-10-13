/**
 * A run started in another mode does not continue as an exam (#3742).
 *
 * Dexie build, no backend. The flow from the issue: answer an exercise in
 * practice mode, leave the lesson (paused), switch the default mode to
 * exam, open the lesson again. Before the fix the resume dialog offered
 * "continue" and the exam verdict then judged the practice answers. Now:
 *
 *   1. the dialog explains the mode conflict and offers no "continue";
 *   2. "start over" (confirmed) begins a fresh exam run: no practice answer
 *      is left on the row, the row is stamped ``exam`` once the run moves,
 *      and the exam notice tells the learner what an exam does;
 *   3. a practice run reopened in practice still offers "continue".
 *
 * The verdict on a fresh run (7 of 10, "passed" under the pilot set's
 * mark) is pinned by LessonSummary.exam.test.tsx; this spec pins how the
 * run that verdict judges comes about.
 */

import {expect, test, type Page} from "@playwright/test";

import {createTestUser} from "../helpers";
import {currentStepTestId, waitForStepAdvance} from "./_step-flow";

const SET_ID = "fr-a1-from-en";
const LESSON = "01-greetings.json";
const MODE_KEY = "adaptive-learner.lesson.default_mode";

/** The lesson's URL, captured on the first open; reopening uses it like a
 *  bookmark (the content tree keeps its expanded state, so a second walk
 *  through it would collapse the set list instead). */
let lessonUrl = "";

async function openFirstLesson(page: Page): Promise<void> {
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 20_000});
    await page.getByTestId("content-other-toggle").click();
    await page.getByTestId(`content-set-${SET_ID}-action`).click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({timeout: 25_000});
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});
}

/** Open the lesson again by its URL. */
async function reopenLesson(page: Page): Promise<void> {
    await page.goto(lessonUrl);
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});
}

/** Click "Weiter" once and wait for the step to change. */
async function nextStep(page: Page): Promise<void> {
    const before = await currentStepTestId(page);
    await page.getByTestId("lesson-next").click();
    await waitForStepAdvance(page, before);
}

/** Answer the lesson's first exercise (a matching pair set) correctly. */
async function answerFirstExercise(page: Page): Promise<void> {
    await nextStep(page);
    await nextStep(page);
    await expect(page.getByTestId("matching-exercise")).toBeVisible({timeout: 10_000});
    const n = await page.getByTestId(/^matching-left-\d+$/).count();
    for (let i = 0; i < n; i++) {
        await page.getByTestId(`matching-left-${i}`).click();
        await page.getByTestId(`matching-right-${i}`).click();
    }
    await page.getByTestId("lesson-check").click();
}

/** The lesson's stored run, straight from IndexedDB. */
async function storedRun(
    page: Page,
): Promise<{status: string; lesson_mode: string; answers: number} | null> {
    return page.evaluate(
        (filename) =>
            new Promise((resolve) => {
                const request = indexedDB.open("adaptive-learner");
                request.onerror = () => resolve(null);
                request.onsuccess = () => {
                    const db = request.result;
                    const all = db
                        .transaction("lessonProgress", "readonly")
                        .objectStore("lessonProgress")
                        .getAll();
                    all.onsuccess = () => {
                        db.close();
                        const row = (
                            all.result as {
                                lesson_filename: string;
                                status: string;
                                lesson_mode: string;
                                step_results: string | Record<string, unknown>;
                            }[]
                        ).find((r) => r.lesson_filename === filename);
                        if (!row) return resolve(null);
                        const results =
                            typeof row.step_results === "string"
                                ? JSON.parse(row.step_results)
                                : row.step_results;
                        resolve({
                            status: row.status,
                            lesson_mode: row.lesson_mode,
                            answers: Object.keys(results ?? {}).length,
                        });
                    };
                    all.onerror = () => {
                        db.close();
                        resolve(null);
                    };
                };
            }),
        LESSON,
    );
}

/** Leave the lesson by in-app navigation, which pauses the run (#3075). */
async function leaveLesson(page: Page): Promise<void> {
    await page.locator("a.nav-brand").click();
    await page.waitForURL("**/dashboard");
    await expect.poll(() => storedRun(page), {timeout: 5_000}).toMatchObject({status: "paused"});
}

test.describe("A run from another mode does not continue as an exam (#3742)", () => {
    test.describe.configure({timeout: 120_000});

    test.beforeEach(async ({page}) => {
        await page.addInitScript(() => {
            localStorage.setItem("adaptive-learner.content_view_mode", "grid");
        });
        await page.route("**/recommended-repos.json", (route) =>
            route.fulfill({status: 200, body: '{"repos":[]}'}),
        );
        await page.route("**/books.yaml", (route) =>
            route.fulfill({status: 200, body: "domains: {}\n"}),
        );
        await createTestUser(page);
        await page.evaluate((key) => localStorage.setItem(key, "practice"), MODE_KEY);
        await openFirstLesson(page);
        lessonUrl = page.url();
        await answerFirstExercise(page);
        await expect.poll(() => storedRun(page), {timeout: 5_000}).toMatchObject({
            lesson_mode: "practice",
            answers: 1,
        });
        await leaveLesson(page);
    });

    test("practice run opened in exam: no continue, start over begins a fresh exam", async ({page}) => {
        await page.evaluate((key) => localStorage.setItem(key, "exam"), MODE_KEY);
        await reopenLesson(page);

        await expect(page.getByTestId("lesson-resume-dialog")).toBeVisible({timeout: 20_000});
        await expect(page.getByTestId("lesson-resume-mode-conflict")).toBeVisible();
        await expect(page.getByTestId("lesson-resume-continue")).toHaveCount(0);

        await page.getByTestId("lesson-resume-restart").click();
        await page.getByTestId("lesson-resume-confirm-restart-action").click();
        await expect(page.getByTestId("lesson-resume-dialog")).toHaveCount(0);

        // The practice answer is gone; the run is an exam from its first step.
        await expect.poll(() => storedRun(page), {timeout: 5_000}).toMatchObject({answers: 0});
        await expect(page.getByTestId("lesson-mode-exam")).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByTestId("lesson-exam-notice")).toBeVisible();
        await nextStep(page);
        await expect.poll(() => storedRun(page), {timeout: 5_000}).toMatchObject({
            lesson_mode: "exam",
            answers: 0,
        });
    });

    test("practice run opened in practice: continue as before", async ({page}) => {
        await reopenLesson(page);
        await expect(page.getByTestId("lesson-resume-dialog")).toBeVisible({timeout: 20_000});
        await expect(page.getByTestId("lesson-resume-mode-conflict")).toHaveCount(0);
        await page.getByTestId("lesson-resume-continue").click();
        await expect.poll(() => storedRun(page), {timeout: 5_000}).toMatchObject({
            lesson_mode: "practice",
            answers: 1,
        });
    });
});
