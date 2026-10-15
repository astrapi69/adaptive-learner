/**
 * The pilot control lesson through a mocked content repo (#3752, #3755):
 * open it, play a run by tapping planned options, read the stored answers.
 * Shared by the WebKit tap spec and the Dexie step-motion spec. The repo is
 * served by ``page.route``, so a spec using it blocks service workers
 * (``test.use({serviceWorkers: "block"})``): outside Chromium the app's
 * worker would fetch past the route.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {expect, type Page} from "@playwright/test";

import {createTestUser} from "./onboarding";
import {currentStepTestId, waitForStepAdvance} from "../dexie/_step-flow";

const OWNER_REPO = "e2e/select-cloze-tap";
const SET_ID = "evaluation-pilot-control-from-de";
const SET_PATH = "sets/de/evaluation-pilot-control";
const LESSON_FILE = "01-hauptstadt-quiz-kontrolle.json";
const MODE_KEY = "adaptive-learner.lesson.default_mode";
const DISMISSED_KEY = "adaptive-learner.ios_install_dismissed";

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
export const CORRECT: Record<string, string> = {
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
export type AnswerPlan = Record<string, string[]>;

export async function mockRepo(page: Page): Promise<void> {
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
export async function openLesson(page: Page, mode: "practice" | "exam"): Promise<void> {
    await page.setViewportSize({width: 1024, height: 1200});
    await mockRepo(page);
    const githubRequests: string[] = [];
    page.on("request", (request) => {
        if (/github/.test(request.url())) githubRequests.push(request.url());
    });
    await createTestUser(page);
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [MODE_KEY, mode]);
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-section")).toBeVisible({timeout: 15_000});
    await page.getByTestId("content-repo-url").fill(`https://github.com/${OWNER_REPO}`);
    await page.getByTestId("content-repo-connect").click();
    await expect(
        page.getByTestId("content-repo-result"),
        `GitHub requests: ${githubRequests.join(", ")}`,
    ).toContainText(/passed|erfolgreich/i);
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 15_000});
    // Outside a lesson an iPhone profile shows the install hint (#3749).
    const iPhone = await page.evaluate(() => /iPhone/.test(navigator.userAgent));
    if (iPhone) await expect(page.getByTestId("ios-install-hint")).toBeVisible();
    const open = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(open).toBeVisible({timeout: 15_000});
    await open.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 15_000});
    await page.setViewportSize({width: 390, height: 844});
    // #3749 - the add-to-home-screen hint stays off the lesson, so it cannot
    // cover the footer; it is hidden there, not dismissed.
    await expect(page.getByTestId("ios-install-hint")).toHaveCount(0);
    if (iPhone) {
        expect(await page.evaluate((key) => localStorage.getItem(key), DISMISSED_KEY)).toBeNull();
    }
}


export const RUN_DONE = '[data-testid="lesson-summary"], [data-testid="error-replay-summary"]';

/** Play the mounted run (lesson or error replay) to its summary, tapping
 *  the planned option on every exercise. Returns the tapped values. */
export async function playRun(page: Page, plan: AnswerPlan, exam: boolean): Promise<string[]> {
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
export async function tapOption(page: Page, value: string, expectCorrect: boolean | null): Promise<void> {
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
export async function storedAnswers(page: Page): Promise<Record<string, unknown>> {
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
export const ALL_CORRECT: AnswerPlan = Object.fromEntries(
    Object.entries(CORRECT).map(([id, answer]) => [id, [answer]]),
);

/** Vertical position (viewport px) of the new step's first answer control,
 *  one sample per animation frame. */
export interface StepMotion {
    from: string | null;
    to: string | null;
    tops: number[];
}

/**
 * Press the footer's Next and sample where the NEW step's first answer
 * control is painted, every frame for ``durationMs`` (#3752).
 *
 * The press is dispatched inside the page and sampling starts in the same
 * task, so the first sample belongs to the first frame the new step is
 * painted in. Playwright's own click or tap would wait for a resting target
 * and hide exactly the motion this measures. A step whose first frame is
 * its final position yields one value repeated.
 */
export async function sampleNextStepMotion(page: Page, durationMs = 400): Promise<StepMotion> {
    return page.evaluate(async (duration) => {
        const STEP =
            '[data-testid^="lesson-step-"]:not([data-testid$="-anchor"]), ' +
            '[data-testid^="error-replay-step-"]:not([data-testid$="-anchor"])';
        const CONTROL = 'input[type="radio"], [role="radio"], button';
        const stepId = () => document.querySelector(STEP)?.getAttribute("data-testid") ?? null;
        const from = stepId();
        const next = document.querySelector<HTMLElement>(
            '[data-testid="lesson-next"], [data-testid="error-replay-next"]',
        );
        if (!next) throw new Error("no Next button on this step");
        const tops: number[] = [];
        let to: string | null = null;
        const started = performance.now();
        next.click();
        await new Promise<void>((resolve) => {
            const frame = () => {
                const id = stepId();
                if (id && id !== from) {
                    to = id;
                    const control = document
                        .querySelector(`[data-testid="${id}"]`)
                        ?.querySelector<HTMLElement>(CONTROL);
                    if (control) tops.push(Math.round(control.getBoundingClientRect().top));
                }
                if (performance.now() - started < duration) requestAnimationFrame(frame);
                else resolve();
            };
            requestAnimationFrame(frame);
        });
        return {from, to, tops};
    }, durationMs);
}

/** Bring a practice run of the control lesson to the error replay's first
 *  step (Schweden), after a first pass with e7 and e8 answered wrong, the
 *  report's sequence (#3752). */
export async function openErrorReplayAtSchweden(page: Page): Promise<void> {
    await openLesson(page, "practice");
    await playRun(page, {...ALL_CORRECT, e7: ["Oslo", "Stockholm"], e8: ["Stockholm", "Oslo"]}, false);
    await expect(page.getByTestId("lesson-summary")).toBeVisible();
    await page.getByTestId("lesson-summary-fix-mistakes").click();
    const replay = page.getByTestId("lesson-correction-replay");
    await expect(replay).toBeVisible({timeout: 10_000});
    await replay.click();
    await expect(page.getByTestId("error-replay-step-e7")).toBeVisible({timeout: 15_000});
}
