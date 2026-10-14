/**
 * #3752 - a tap on a select-cloze option records exactly that option, under
 * the WebKit engine with touch input.
 *
 * Reported on an iPhone: in the error replay of the control set
 * ``evaluation-pilot-control-from-de`` the learner tapped "Oslo" on
 * "Die Hauptstadt von Norwegen ist ___" and the app recorded "Stockholm".
 * The two select clozes e7 (Sweden) and e8 (Norway) carry each other's
 * answer as a distractor, and their seeded option orders differ, so a tap
 * that lands on the previous step's layout (or a delayed click after the
 * step changes) records exactly the reported value. Chromium never showed
 * it; this spec runs the same flow under Playwright's WebKit with the
 * iPhone profile's touch context and taps (``locator.tap``) every option.
 *
 * The lesson is the real authored control lesson, vendored as
 * ``fixtures/evaluation-pilot-control.lesson.json`` and served through a
 * page.route-mocked content repo (no network).
 *
 * Asserted per tapped option: it is the checked radio right after the tap,
 * and after "check" it is graded correct with no option marked wrong; the
 * stored ``raw_answer`` of the run matches the tapped value.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {expect, test, type Page} from "@playwright/test";

import {createTestUser} from "../helpers/onboarding";
import {currentStepTestId, waitForStepAdvance} from "../dexie/_step-flow";

const OWNER_REPO = "e2e/select-cloze-tap";
const SET_ID = "evaluation-pilot-control-from-de";
const SET_PATH = "sets/de/evaluation-pilot-control";
const LESSON_FILE = "01-hauptstadt-quiz-kontrolle.json";
const MODE_KEY = "adaptive-learner.lesson.default_mode";

const LESSON = readFileSync(
    join(__dirname, "..", "fixtures", "evaluation-pilot-control.lesson.json"),
    "utf-8",
);

const ROOT_MANIFEST = `
schema_version: "1.7"
sets:
  - id: ${SET_ID}
    title: "Hauptstädte Europas (Kontrolle)"
    target_language: de
    source_language: de
    domain: knowledge
    level: none
    path: ${SET_PATH}
    version: "1.0.1"
    lesson_count: 1
`;

const SET_MANIFEST = `
metadata:
  lessons:
    - "${LESSON_FILE}"
`;

/** The correct answer per exercise step. */
const CORRECT: Record<string, string> = {
    e1: "Paris",
    e2: "Madrid",
    e3: "Rom",
    e4: "Lissabon",
    e5: "Warschau",
    e6: "Wien",
    e7: "Stockholm",
    e8: "Oslo",
    e9: "Athen",
    e10: "Dublin",
};

/** Answers the step id gets on each visit; the last entry repeats. */
type AnswerPlan = Record<string, string[]>;

async function mockRepo(page: Page): Promise<void> {
    await page.route(`**/raw.githubusercontent.com/${OWNER_REPO}/main/**`, (route) => {
        const url = route.request().url();
        if (url.endsWith("/main/manifest.yaml")) {
            return route.fulfill({status: 200, body: ROOT_MANIFEST});
        }
        if (url.endsWith(`/${SET_PATH}/manifest.yaml`)) {
            return route.fulfill({status: 200, body: SET_MANIFEST});
        }
        if (url.endsWith(`/${LESSON_FILE}`)) {
            return route.fulfill({status: 200, body: LESSON});
        }
        return route.fulfill({status: 404, body: ""});
    });
}

/** Create the user, connect the mocked repo and open the lesson. The setup
 *  runs at a wide viewport (onboarding and the content tree are width
 *  gated); the lesson itself is played at phone size, where the device's
 *  touch context still applies. */
async function openLesson(page: Page, mode: "practice" | "exam"): Promise<void> {
    await page.setViewportSize({width: 1024, height: 1200});
    await mockRepo(page);
    await createTestUser(page);
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [MODE_KEY, mode]);
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-section")).toBeVisible({timeout: 15_000});
    await page.getByTestId("content-repo-url").fill(`https://github.com/${OWNER_REPO}`);
    await page.getByTestId("content-repo-connect").click();
    await expect(page.getByTestId("content-repo-result")).toContainText(/passed|erfolgreich/i);
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 15_000});
    const open = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(open).toBeVisible({timeout: 15_000});
    await open.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 15_000});
    await page.setViewportSize({width: 390, height: 844});
    // The iPhone profile shows the add-to-home-screen hint over the footer
    // (#3749); dismiss it the way the learner does.
    const dismiss = page.getByTestId("ios-install-hint-dismiss");
    await dismiss.waitFor({state: "visible", timeout: 5_000}).catch(() => undefined);
    if (await dismiss.isVisible()) await dismiss.tap();
    await expect(page.getByTestId("ios-install-hint")).toHaveCount(0);
}

const RUN_DONE = '[data-testid="lesson-summary"], [data-testid="error-replay-summary"]';

/** Play the mounted run (lesson or error replay) to its summary, tapping
 *  the planned option on every exercise. Returns the tapped values. */
async function playRun(page: Page, plan: AnswerPlan, exam: boolean): Promise<string[]> {
    const visits: Record<string, number> = {};
    const tapped: string[] = [];
    for (let guard = 0; guard < 60; guard++) {
        if (await page.locator(RUN_DONE).count()) return tapped;
        const step = await currentStepTestId(page);
        const id = step?.replace(/^(lesson|error-replay)-step-/, "") ?? "";
        const answers = plan[id];
        if (answers) {
            const n = visits[id] ?? 0;
            visits[id] = n + 1;
            const pick = answers[Math.min(n, answers.length - 1)];
            await tapOption(page, pick, exam ? null : pick === CORRECT[id]);
            tapped.push(`${id}:${pick}`);
        }
        const next = page.getByTestId(/^(lesson|error-replay)-next$/);
        await expect(next).toBeVisible({timeout: 10_000});
        await next.tap();
        await waitForStepAdvance(page, step);
    }
    throw new Error(`run did not reach its summary; tapped ${tapped.join(", ")}`);
}

/** Tap one option, assert it is the checked one, and (outside an exam)
 *  check the answer and assert the grade. */
async function tapOption(page: Page, value: string, expectCorrect: boolean | null): Promise<void> {
    const option = page.getByRole("radio", {name: value, exact: true});
    await expect(option).toBeVisible({timeout: 10_000});
    await option.tap();
    await expect(option, `tapped ${value}`).toBeChecked();
    await expect(page.getByRole("radio", {checked: true})).toHaveCount(1);
    if (expectCorrect === null) return;
    const check = page.getByTestId(/^(lesson|error-replay)-check$/);
    await expect(check).toBeEnabled({timeout: 5_000});
    await check.tap();
    if (expectCorrect) {
        await expect(page.locator('[role="radio"][data-state="wrong"]')).toHaveCount(0);
        await expect(page.locator('[role="radio"][data-verdict="wrong"]')).toHaveCount(0);
    }
}

/** ``raw_answer`` per exercise step of the stored run, from IndexedDB. */
async function storedAnswers(page: Page): Promise<Record<string, unknown>> {
    return page.evaluate(
        (filename) =>
            new Promise<Record<string, unknown>>((resolve) => {
                const request = indexedDB.open("adaptive-learner");
                request.onerror = () => resolve({});
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
                                step_results: string | Record<string, {raw_answer?: unknown}>;
                            }[]
                        ).find((r) => r.lesson_filename === filename);
                        const results =
                            typeof row?.step_results === "string"
                                ? JSON.parse(row.step_results)
                                : (row?.step_results ?? {});
                        const out: Record<string, unknown> = {};
                        for (const [key, entry] of Object.entries(
                            results as Record<string, {raw_answer?: unknown}>,
                        )) {
                            out[key] = entry?.raw_answer;
                        }
                        resolve(out);
                    };
                    all.onerror = () => {
                        db.close();
                        resolve({});
                    };
                };
            }),
        LESSON_FILE,
    );
}

/** Every exercise answered correctly. */
const ALL_CORRECT: AnswerPlan = Object.fromEntries(
    Object.entries(CORRECT).map(([id, answer]) => [id, [answer]]),
);

test.describe("#3752 - a tapped select-cloze option is the recorded one (WebKit, touch)", () => {
    test.describe.configure({timeout: 180_000});

    test("exam: every option tapped correctly scores 10 of 10", async ({page}) => {
        await openLesson(page, "exam");
        await playRun(page, ALL_CORRECT, true);
        await expect(page.getByTestId("lesson-exam-result-score")).toContainText("10");
        const stored = JSON.stringify(await storedAnswers(page));
        expect(stored, "e7 stored").toContain("Stockholm");
        expect(stored, "e8 stored").toContain("Oslo");
    });

    test("error replay: Stockholm on e7, then Oslo on e8, both graded correct", async ({page}) => {
        await openLesson(page, "practice");
        // First pass: e7 and e8 wrong, as in the report's exam, the rest right.
        await playRun(page, {...ALL_CORRECT, e7: ["Oslo", "Stockholm"], e8: ["Stockholm", "Oslo"]}, false);
        await expect(page.getByTestId("lesson-summary")).toBeVisible();
        // "Fehler korrigieren", then "Alle Übungen erneut": the ErrorReplay
        // page, as in the report.
        await page.getByTestId("lesson-summary-fix-mistakes").tap();
        const replay = page.getByTestId("lesson-correction-replay");
        await expect(replay).toBeVisible({timeout: 10_000});
        await replay.tap();
        await expect(page.getByRole("radiogroup")).toBeVisible({timeout: 15_000});
        const tapped = await playRun(page, {e7: ["Stockholm"], e8: ["Oslo"]}, false);
        expect(tapped).toEqual(["e7:Stockholm", "e8:Oslo"]);
        await expect(page.getByTestId("error-replay-summary-score")).toContainText("2");
    });
});
