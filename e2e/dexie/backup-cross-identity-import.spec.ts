/**
 * Settings import of another learner's backup (#3785).
 *
 * The usual device switch: the learner sets the app up on the new device
 * first (own user id, some progress there too), then imports the backup
 * of the old device through Settings > Data. Two browser contexts stand
 * for the two devices, both driven through the real UI:
 *
 *   - device B plays a lesson to the summary, then exports a real `.alb`;
 *   - device A onboards with its own user id, pauses a different lesson
 *     of the same set, then imports B's file via Settings > Data.
 *
 * The spec MEASURES what device A holds and shows afterwards and prints it
 * (the #3785 evidence table), then asserts the contract: the active user id
 * stays A, B's progress is visible to the learner on A, A's own progress
 * stays visible, and no console error is raised.
 */

import {readFileSync} from "node:fs";

import {expect, test, type Browser, type Page} from "@playwright/test";

import {createTestUser} from "../helpers";
import {currentStepTestId, waitForStepAdvance} from "./_step-flow";

const SET_ID = "fr-a1-from-en";
const DB_NAME = "adaptive-learner";

/** Rows of the user-scoped stores, counted per user id. */
interface DexieCounts {
    users: string[];
    lessonProgress: Record<string, string[]>;
    elementErrors: Record<string, number>;
    setRuns: Record<string, number>;
}

/** What the learner sees, read through the real UI. */
interface UiState {
    url: string;
    continueLearning: string;
    pausedLessons: string[];
    lessonRows: Record<string, string>;
}

interface Measurement {
    userId: string | null;
    projectId: string | null;
    dexie: DexieCounts;
    ui: UiState;
}

async function newDevice(browser: Browser, baseURL: string): Promise<Page> {
    const context = await browser.newContext({
        baseURL,
        storageState: {
            cookies: [],
            origins: [
                {
                    origin: baseURL,
                    localStorage: [
                        {name: "adaptive-learner.content_view_mode", value: "grid"},
                        {name: "adaptive-learner.language", value: "de"},
                    ],
                },
            ],
        },
    });
    await context.addInitScript(() => {
        try {
            // @ts-expect-error - force the download fallback of the export.
            delete window.showSaveFilePicker;
        } catch {
            /* non-configurable in some engines */
        }
    });
    const page = await context.newPage();
    // The content tab waits for the live registry; pin it (#1653) so the
    // spec reaches the bundled set the same way on every run.
    await page.route("**/recommended-repos.json", (route) =>
        route.fulfill({status: 200, body: '{"repos":[]}'}),
    );
    await page.route("**/books.yaml", (route) =>
        route.fulfill({status: 200, body: "domains: {}\n"}),
    );
    return page;
}

/** Collect page errors and console errors of one device. */
function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });
    return errors;
}

/** Answer the exercise on screen (any answer; wrong ones feed elementErrors). */
async function answer(page: Page): Promise<void> {
    if (await page.getByTestId("free-text-input").count()) {
        await page.getByTestId("free-text-input").fill("Bonjour");
    } else if (await page.getByTestId("word-tiles-exercise").count()) {
        const tiles = page.locator('[data-testid^="word-tile-scrambled-"]');
        let guard = 0;
        while ((await tiles.count()) > 0 && guard++ < 12) await tiles.first().click();
    } else if (await page.getByTestId("picture-exercise").count()) {
        await page.locator('[data-testid^="picture-choice-"]').first().click();
    } else if (await page.getByTestId("matching-exercise").count()) {
        const n = await page.getByTestId(/^matching-left-\d+$/).count();
        for (let j = 0; j < n; j++) {
            await page.getByTestId(`matching-left-${j}`).click();
            await page.getByTestId(`matching-right-${(j + 1) % n}`).click();
        }
    } else {
        const blanks = page.locator('[data-testid^="cloze-input-"]');
        const n = await blanks.count();
        for (let j = 0; j < n; j++) await blanks.nth(j).fill("Bonjour");
    }
}

/** Grade (when the step is an exercise) and advance one step. */
async function advance(page: Page): Promise<void> {
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

/** Download the set (idempotent) through the content tree. */
async function downloadSet(page: Page): Promise<void> {
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 20_000});
    await page.getByTestId("content-other-toggle").click();
    await page.getByTestId(`content-set-${SET_ID}-action`).click();
    await expect(page.getByTestId(`content-set-${SET_ID}-open`)).toBeVisible({
        timeout: 25_000,
    });
}

/** Expand the set on the learning path; return its lesson rows. */
async function openSetDetail(page: Page): Promise<ReturnType<Page["locator"]>> {
    await page.goto("/learning-path");
    await expect(page.getByTestId("learning-path-page")).toBeVisible({timeout: 15_000});
    await page.getByTestId("learning-path-filter-all").click();
    await expect(page.getByTestId(`set-row-${SET_ID}`)).toBeVisible({timeout: 15_000});
    await page.getByTestId(`set-toggle-${SET_ID}`).click();
    await expect(page.getByTestId(`set-detail-${SET_ID}`)).toBeVisible();
    const rows = page.locator(`[data-testid^="lesson-row-${SET_ID}-"]`);
    await expect(rows.first()).toBeVisible({timeout: 10_000});
    return rows;
}

/** Device B: play the set's first lesson to the scored summary. */
async function playFirstLessonToSummary(page: Page): Promise<void> {
    await downloadSet(page);
    await page.getByTestId(`content-set-${SET_ID}-open`).click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});
    for (let i = 0; i < 40; i++) {
        if (await page.getByTestId("lesson-summary").count()) break;
        await advance(page);
    }
    await expect(page.getByTestId("lesson-summary")).toBeVisible({timeout: 15_000});
}

/** Device A: open the set's SECOND lesson, play a few steps, pause. */
async function pauseSecondLesson(page: Page): Promise<string> {
    await downloadSet(page);
    const rows = await openSetDetail(page);
    const testId = (await rows.nth(1).getAttribute("data-testid")) ?? "";
    await rows.nth(1).click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});
    for (let i = 0; i < 3; i++) await advance(page);
    await page.getByTestId("lesson-pause-btn").click();
    await expect(page.getByTestId("lesson-exit-dialog")).toBeVisible({timeout: 5_000});
    await page.getByTestId("lesson-exit-pause").click();
    return testId.replace(`lesson-row-${SET_ID}-`, "");
}

/** Read the user-scoped stores straight from IndexedDB. */
async function readDexie(page: Page): Promise<DexieCounts> {
    return page.evaluate(
        (dbName) =>
            new Promise<DexieCounts>((resolve, reject) => {
                const request = indexedDB.open(dbName);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    const stores = ["users", "lessonProgress", "elementErrors", "setRuns"];
                    const tx = db.transaction(stores, "readonly");
                    const out: DexieCounts = {
                        users: [],
                        lessonProgress: {},
                        elementErrors: {},
                        setRuns: {},
                    };
                    const all = (store: string) => tx.objectStore(store).getAll();
                    const users = all("users");
                    users.onsuccess = () => {
                        out.users = (users.result as {id: string}[]).map((r) => r.id);
                    };
                    const progress = all("lessonProgress");
                    progress.onsuccess = () => {
                        for (const row of progress.result as {
                            user_id: string;
                            lesson_filename: string;
                            status: string;
                        }[]) {
                            (out.lessonProgress[row.user_id] ??= []).push(
                                `${row.lesson_filename}:${row.status}`,
                            );
                        }
                    };
                    const errors = all("elementErrors");
                    errors.onsuccess = () => {
                        for (const row of errors.result as {user_id: string}[]) {
                            out.elementErrors[row.user_id] = (out.elementErrors[row.user_id] ?? 0) + 1;
                        }
                    };
                    const runs = all("setRuns");
                    runs.onsuccess = () => {
                        for (const row of runs.result as {user_id: string}[]) {
                            out.setRuns[row.user_id] = (out.setRuns[row.user_id] ?? 0) + 1;
                        }
                    };
                    tx.oncomplete = () => {
                        db.close();
                        resolve(out);
                    };
                    tx.onerror = () => reject(tx.error);
                };
            }),
        DB_NAME,
    );
}

/** Text of a locator, or a marker when it is absent. */
async function textOf(page: Page, testId: string): Promise<string> {
    const el = page.getByTestId(testId);
    if ((await el.count()) === 0) return "(absent)";
    return ((await el.first().innerText()) || "").replace(/\s+/g, " ").trim();
}

/** What the learner sees: dashboard cards and the set's lesson rows. */
async function readUi(page: Page): Promise<UiState> {
    await page.goto("/dashboard");
    // Settle on the dashboard (or wherever the app sends the learner).
    await page
        .getByTestId("continue-learning")
        .waitFor({timeout: 30_000})
        .catch(() => undefined);
    await page
        .getByTestId("paused-lessons-card")
        .waitFor({timeout: 5_000})
        .catch(() => undefined);
    const url = new URL(page.url()).pathname;
    const continueLearning = await textOf(page, "continue-learning");
    const paused = page.locator('[data-testid^="paused-lesson-title-"]');
    const pausedLessons: string[] = [];
    for (let i = 0; i < (await paused.count()); i++) {
        pausedLessons.push(
            ((await paused.nth(i).getAttribute("data-testid")) ?? "").replace(
                "paused-lesson-title-",
                "",
            ),
        );
    }
    const lessonRows: Record<string, string> = {};
    try {
        const rows = await openSetDetail(page);
        for (let i = 0; i < Math.min(await rows.count(), 3); i++) {
            const id = (await rows.nth(i).getAttribute("data-testid")) ?? `row-${i}`;
            const stars = await rows.nth(i).getByTestId("lesson-row-stars").count();
            lessonRows[id.replace(`lesson-row-${SET_ID}-`, "")] = stars > 0 ? "stars" : "no-stars";
        }
    } catch (err) {
        lessonRows.error = String(err).split("\n")[0];
    }
    return {url, continueLearning, pausedLessons, lessonRows};
}

async function measure(page: Page): Promise<Measurement> {
    const [userId, projectId] = await page.evaluate(() => [
        localStorage.getItem("adaptive-learner.user_id"),
        localStorage.getItem("adaptive-learner.project_id"),
    ]);
    const dexie = await readDexie(page);
    const ui = await readUi(page);
    return {userId, projectId, dexie, ui};
}

/** Name an id as A, B or other, for the printed table. */
function who(id: string | null, a: string, b: string): string {
    if (id === a) return "A";
    if (id === b) return "B";
    return id === null ? "(none)" : `other(${id})`;
}

function relabel<T>(record: Record<string, T>, a: string, b: string): Record<string, T> {
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [who(k, a, b), v]));
}

test.describe("Settings import of another learner's backup (#3785)", () => {
    // Two onboardings, two assessments, two set downloads, a full lesson.
    test.describe.configure({timeout: 300_000});

    test("the active learner stays A and sees B's and A's progress", async ({
        browser,
        baseURL,
    }, testInfo) => {
        const base = baseURL ?? "http://localhost:4173";

        // --- Device B: progress, then a real export --------------------
        const pageB = await newDevice(browser, base);
        const errorsB = collectErrors(pageB);
        await createTestUser(pageB, {name: "Learner B"});
        const userB = (await pageB.evaluate(() =>
            localStorage.getItem("adaptive-learner.user_id"),
        )) as string;
        await playFirstLessonToSummary(pageB);
        const dexieB = await readDexie(pageB);
        expect(dexieB.lessonProgress[userB]?.length ?? 0, "B has lessonProgress").toBeGreaterThan(0);

        await pageB.goto("/settings?tab=data");
        await expect(pageB.getByTestId("settings-panel-data")).toBeVisible({timeout: 15_000});
        const [download] = await Promise.all([
            pageB.waitForEvent("download", {timeout: 15_000}),
            pageB.getByTestId("backup-export").click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/\.alb$/);
        const albBytes = readFileSync((await download.path()) as string);
        expect(errorsB, `device B errors: ${errorsB.join("; ")}`).toEqual([]);

        // --- Device A: own learner, own progress, then the import ------
        const pageA = await newDevice(browser, base);
        const errorsA = collectErrors(pageA);
        await createTestUser(pageA, {name: "Learner A"});
        const userA = (await pageA.evaluate(() =>
            localStorage.getItem("adaptive-learner.user_id"),
        )) as string;
        expect(userA).not.toBe(userB);
        const pausedA = await pauseSecondLesson(pageA);
        const before = await measure(pageA);

        await pageA.goto("/settings?tab=data");
        await expect(pageA.getByTestId("settings-panel-data")).toBeVisible({timeout: 15_000});
        await pageA.getByTestId("backup-file-input").setInputFiles({
            name: download.suggestedFilename(),
            mimeType: "application/zip",
            buffer: albBytes,
        });
        await expect(pageA.getByTestId("backup-comparison")).toBeVisible({timeout: 10_000});
        await pageA.getByTestId("backup-confirm").click();
        await expect(pageA.getByTestId("backup-summary")).toBeVisible({timeout: 15_000});
        const errorsBeforeReload = [...errorsA];
        // A real learner continues in a fresh app start after a restore.
        await pageA.reload();
        const after = await measure(pageA);

        // --- The evidence table, printed before any assertion ----------
        const table = {
            ids: {A: userA, B: userB},
            backup_b_dexie: {
                lessonProgress: relabel(dexieB.lessonProgress, userA, userB),
                elementErrors: relabel(dexieB.elementErrors, userA, userB),
            },
            device_a_before: {
                user_id: who(before.userId, userA, userB),
                users: before.dexie.users.map((id) => who(id, userA, userB)),
                lessonProgress: relabel(before.dexie.lessonProgress, userA, userB),
                elementErrors: relabel(before.dexie.elementErrors, userA, userB),
                setRuns: relabel(before.dexie.setRuns, userA, userB),
                ui: before.ui,
            },
            device_a_after: {
                user_id: who(after.userId, userA, userB),
                users: after.dexie.users.map((id) => who(id, userA, userB)),
                lessonProgress: relabel(after.dexie.lessonProgress, userA, userB),
                elementErrors: relabel(after.dexie.elementErrors, userA, userB),
                setRuns: relabel(after.dexie.setRuns, userA, userB),
                ui: after.ui,
            },
            console_errors_a: errorsA,
            console_errors_a_until_import: errorsBeforeReload,
        };
        const report = JSON.stringify(table, null, 2);
        // eslint-disable-next-line no-console -- #3785 evidence table
        console.log(`[#3785] cross-identity import measurement:\n${report}`);
        await testInfo.attach("cross-identity-import.json", {
            body: report,
            contentType: "application/json",
        });

        // --- The contract ----------------------------------------------
        const firstLesson = Object.keys(after.ui.lessonRows)[0];
        expect.soft(after.userId, "the active learner stays A").toBe(userA);
        expect.soft(after.dexie.users, "no second learner row").toEqual([userA]);
        expect
            .soft(after.dexie.lessonProgress[userA]?.length ?? 0, "B's progress lands under A")
            .toBeGreaterThan(before.dexie.lessonProgress[userA]?.length ?? 0);
        expect.soft(after.dexie.lessonProgress[userB] ?? [], "no row stays under B").toEqual([]);
        expect.soft(after.ui.lessonRows[firstLesson], "B's played lesson shows its results").toBe("stars");
        expect.soft(after.ui.pausedLessons, "A's paused lesson stays visible").toContain(pausedA);
        expect.soft(errorsA, `device A errors: ${errorsA.join("; ")}`).toEqual([]);
    });
});
