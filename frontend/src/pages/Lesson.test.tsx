/**
 * Tests for the Lesson viewer page
 * (Phase 44 / EXP-002 / 3B — F-102 + F-103).
 *
 * Pins each load state (loading / not-cached / ready /
 * summary) renders the right testid + key affordances. The
 * exercise placeholder shows when the page hits a step type
 * commits 4-6 will fill in.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const useLessonMock = vi.fn();
const listLessonsMock = vi.fn();

vi.mock("../hooks/useLesson", () => ({
    useLesson: () => useLessonMock(),
}));

// Phase 46A — LessonPage now fetches the set's lesson list
// via getStorage().contentLoader.listLessons to compute the
// "Next lesson" button. Tests stub it to a single-lesson set
// by default; per-test overrides set a multi-lesson list when
// they want to assert the Next button surface.
vi.mock("../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            listSets: vi.fn(),
            downloadSet: vi.fn(),
            listLessons: listLessonsMock,
            getLesson: vi.fn(),
        },
    }),
}));

import LessonPage from "./Lesson";
import type {ContentLessonExercise} from "../storage/types";

const LESSON = {
    id: "01-greetings",
    title: "Greetings",
    description: "Basic French greetings.",
    estimated_minutes: 10,
    cards: [],
    steps: [
        {
            id: "intro",
            type: "theory" as const,
            title: "Intro",
            body: "# Welcome\n\nBasic greetings.",
        },
        {
            id: "ex-1",
            type: "exercise" as const,
            title: "Match the words",
            exercise: {
                id: "ex-1",
                type: "matching" as const,
                prompt: "Match the words.",
                card_ids: [],
                distractors: [],
            },
        },
    ],
};

const PROGRESS = {
    id: "row-1",
    user_id: "user-1",
    source: "astrapi69/adaptive-learner-content",
    set_id: "language-fr-a1",
    lesson_filename: "01-greetings.json",
    status: "in_progress" as const,
    step_results: {},
    score_correct: 0,
    score_total: 0,
    time_spent_seconds: 0,
    started_at: "2026-05-26T00:00:00Z",
    updated_at: "2026-05-26T00:00:00Z",
    completed_at: null,
};

function renderAtPath(path: string) {
    return render(
        <MemoryRouter
            initialEntries={[path]}
        >
            <Routes>
                <Route
                    path="/lesson/:setSlug/:setId/:filename"
                    element={<LessonPage />}
                />
                <Route path="/content" element={<div data-testid="content-stub" />} />
            </Routes>
        </MemoryRouter>,
    );
}

const VALID_PATH =
    "/lesson/astrapi69--adaptive-learner-content/language-fr-a1/01-greetings.json";

beforeEach(() => {
    useLessonMock.mockReset();
    listLessonsMock.mockReset();
    // Default: single-lesson set so the "Next lesson" button
    // hides. Tests that assert the button override per-test.
    listLessonsMock.mockResolvedValue({
        set_id: "language-fr-a1",
        source: "astrapi69/adaptive-learner-content",
        version: "1.0.0",
        lessons: ["01-greetings.json"],
    });
});

describe("LessonPage: load states", () => {
    it("renders loading state", () => {
        useLessonMock.mockReturnValue({
            status: "loading",
            lesson: null,
            progress: null,
            currentStepIndex: 0,
            error: null,
            goNext: vi.fn(),
            goPrev: vi.fn(),
            goToStep: vi.fn(),
            goToStepById: vi.fn(),
            recordStepResult: vi.fn(),
            markCompleted: vi.fn(),
            refresh: vi.fn(),
        });
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("lesson-loading")).toBeInTheDocument();
    });

    it("renders not-cached state with link to /content", () => {
        useLessonMock.mockReturnValue({
            status: "not-cached",
            lesson: null,
            progress: null,
            currentStepIndex: 0,
            error: null,
            goNext: vi.fn(),
            goPrev: vi.fn(),
            goToStep: vi.fn(),
            goToStepById: vi.fn(),
            recordStepResult: vi.fn(),
            markCompleted: vi.fn(),
            refresh: vi.fn(),
        });
        renderAtPath(VALID_PATH);
        expect(
            screen.getByTestId("lesson-not-cached"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("lesson-goto-content"),
        ).toBeInTheDocument();
    });

    it("renders error state", () => {
        useLessonMock.mockReturnValue({
            status: "error",
            lesson: null,
            progress: null,
            currentStepIndex: 0,
            error: "boom",
            goNext: vi.fn(),
            goPrev: vi.fn(),
            goToStep: vi.fn(),
            goToStepById: vi.fn(),
            recordStepResult: vi.fn(),
            markCompleted: vi.fn(),
            refresh: vi.fn(),
        });
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("lesson-error")).toBeInTheDocument();
    });
});

describe("LessonPage: ready state rendering", () => {
    function _ready(stepIndex: number, progressOverride = PROGRESS) {
        useLessonMock.mockReturnValue({
            status: "ready",
            lesson: LESSON,
            progress: progressOverride,
            currentStepIndex: stepIndex,
            error: null,
            goNext: vi.fn(),
            goPrev: vi.fn(),
            goToStep: vi.fn(),
            goToStepById: vi.fn(),
            recordStepResult: vi.fn(),
            markCompleted: vi.fn(),
            refresh: vi.fn(),
        });
    }

    it("renders the theory step with its markdown body", () => {
        _ready(0);
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("lesson-page")).toBeInTheDocument();
        expect(
            screen.getByTestId("lesson-step-intro"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("lesson-theory-body"),
        ).toBeInTheDocument();
        expect(screen.getByText(/Welcome/)).toBeInTheDocument();
    });

    it("renders the matching exercise on an exercise step (commit 6)", () => {
        // The LESSON fixture's exercise has no pairs, so the
        // matching component's empty-state surfaces. That's
        // enough to pin that the dispatcher routed correctly.
        _ready(1);
        renderAtPath(VALID_PATH);
        expect(
            screen.getByTestId("matching-empty"),
        ).toBeInTheDocument();
    });

    function _renderWithStep(exercise: ContentLessonExercise) {
        const lesson = {
            ...LESSON,
            steps: [
                {
                    id: exercise.id,
                    type: "exercise" as const,
                    exercise,
                },
            ],
        };
        useLessonMock.mockReturnValue({
            status: "ready",
            lesson,
            progress: PROGRESS,
            currentStepIndex: 0,
            error: null,
            goNext: vi.fn(),
            goPrev: vi.fn(),
            goToStep: vi.fn(),
            goToStepById: vi.fn(),
            recordStepResult: vi.fn(),
            markCompleted: vi.fn(),
            refresh: vi.fn(),
        });
        renderAtPath(VALID_PATH);
    }

    it("dispatcher routes picture_choice to the picture component", () => {
        _renderWithStep({
            id: "ex-pic",
            type: "picture_choice",
            prompt: "Pick the cat.",
            card_ids: [],
            images: [
                {src: "a.png", label: "Cat", is_correct: "true"},
                {src: "b.png", label: "Dog"},
            ],
            distractors: [],
        });
        expect(
            screen.getByTestId("picture-exercise"),
        ).toBeInTheDocument();
    });

    it("dispatcher routes free_text to the free-text component (Phase 45)", () => {
        _renderWithStep({
            id: "ex-free",
            type: "free_text",
            prompt: "How do you say 'thanks' in French?",
            card_ids: [],
            accept: ["Merci"],
            distractors: [],
        });
        expect(
            screen.getByTestId("free-text-exercise"),
        ).toBeInTheDocument();
        // Placeholder must NOT also fire — exclusive routing.
        expect(
            screen.queryByTestId("lesson-exercise-placeholder-free_text"),
        ).not.toBeInTheDocument();
    });

    it("dispatcher routes word_tiles to the word-tiles component (Phase 45)", () => {
        _renderWithStep({
            id: "ex-tiles",
            type: "word_tiles",
            prompt: "Arrange the words.",
            card_ids: [],
            tiles: ["Au", "revoir"],
            distractors: [],
        });
        expect(
            screen.getByTestId("word-tiles-exercise"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("lesson-exercise-placeholder-word_tiles"),
        ).not.toBeInTheDocument();
    });

    it("renders the coming-soon placeholder for unknown future types", () => {
        // Defensive regression-pin: if a future schema_version
        // ships a new ExerciseType and a lesson lands in the
        // cache before its renderer exists, the placeholder
        // must fire so the user can skip the step. v1.35.0
        // shipped cloze (Phase 52D), so we simulate a still-
        // future "ordering" type by casting the runtime string;
        // TypeScript's compile-time union doesn't include it.
        _renderWithStep({
            id: "ex-future",
            type: "ordering" as unknown as ContentLessonExercise["type"],
            prompt: "Put these words in order.",
            card_ids: [],
            distractors: [],
        });
        expect(
            screen.getByTestId("lesson-exercise-placeholder-ordering"),
        ).toBeInTheDocument();
    });

    it("records a step result when the matching exercise completes", async () => {
        const recordStepResult = vi.fn().mockResolvedValue(undefined);
        const lessonWithPairs = {
            ...LESSON,
            steps: [
                LESSON.steps[0],
                {
                    ...LESSON.steps[1],
                    exercise: {
                        ...LESSON.steps[1].exercise!,
                        pairs: [{left: "A", right: "1"}],
                    },
                },
            ],
        };
        useLessonMock.mockReturnValue({
            status: "ready",
            lesson: lessonWithPairs,
            progress: PROGRESS,
            currentStepIndex: 1,
            error: null,
            goNext: vi.fn(),
            goPrev: vi.fn(),
            goToStep: vi.fn(),
            goToStepById: vi.fn(),
            recordStepResult,
            markCompleted: vi.fn(),
            refresh: vi.fn(),
        });
        renderAtPath(VALID_PATH);
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        await waitFor(() => {
            // Phase 52C / v1.35.0 — recordStepResult now carries
            // an optional user_answer; matching exercises don't
            // emit one so it lands as null.
            expect(recordStepResult).toHaveBeenCalledWith({
                step_id: "ex-1",
                correct: 1,
                total: 1,
                user_answer: null,
            });
        });
    });

    it("renders the summary view at index past last step", () => {
        _ready(2, {...PROGRESS, score_correct: 3, score_total: 4, time_spent_seconds: 180});
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("lesson-summary")).toBeInTheDocument();
        expect(
            screen.getByTestId("lesson-summary-score"),
        ).toHaveTextContent("3 / 4");
        expect(
            screen.getByTestId("lesson-summary-time"),
        ).toHaveTextContent(/3/);
    });

    it("summary surfaces 2 stars at the 75% boundary", () => {
        _ready(2, {...PROGRESS, score_correct: 3, score_total: 4});
        renderAtPath(VALID_PATH);
        expect(
            screen.getByTestId("lesson-summary"),
        ).toHaveAttribute("data-stars", "2");
        expect(
            screen.getByTestId("lesson-summary-star-1"),
        ).toHaveAttribute("data-earned", "true");
        expect(
            screen.getByTestId("lesson-summary-star-2"),
        ).toHaveAttribute("data-earned", "true");
        expect(
            screen.getByTestId("lesson-summary-star-3"),
        ).toHaveAttribute("data-earned", "false");
    });

    it("summary surfaces 3 stars + the celebration class at 100%", () => {
        _ready(2, {...PROGRESS, score_correct: 4, score_total: 4});
        renderAtPath(VALID_PATH);
        const summary = screen.getByTestId("lesson-summary");
        expect(summary).toHaveAttribute("data-stars", "3");
        expect(summary.className).toContain("is-celebrating");
    });

    it("summary fires confetti + a celebration message on a perfect run", () => {
        _ready(2, {...PROGRESS, score_correct: 4, score_total: 4});
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("confetti")).toBeInTheDocument();
        const message = screen.getByTestId("lesson-summary-message");
        expect(message).toHaveAttribute("data-stars", "3");
        expect(message.textContent?.trim().length).toBeGreaterThan(0);
    });

    it("summary shows no confetti below 3 stars but still shows a message", () => {
        _ready(2, {...PROGRESS, score_correct: 1, score_total: 4});
        renderAtPath(VALID_PATH);
        expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
        const message = screen.getByTestId("lesson-summary-message");
        expect(message).toHaveAttribute("data-stars", "0");
        expect(message.textContent?.trim().length).toBeGreaterThan(0);
    });

    it("summary surfaces 0 stars below 50% (no celebration)", () => {
        _ready(2, {...PROGRESS, score_correct: 1, score_total: 4});
        renderAtPath(VALID_PATH);
        const summary = screen.getByTestId("lesson-summary");
        expect(summary).toHaveAttribute("data-stars", "0");
        expect(summary.className).not.toContain("is-celebrating");
        for (const n of [1, 2, 3]) {
            expect(
                screen.getByTestId(`lesson-summary-star-${n}`),
            ).toHaveAttribute("data-earned", "false");
        }
    });

    it("summary renders the score bar with the right ARIA progressbar value", () => {
        _ready(2, {...PROGRESS, score_correct: 3, score_total: 4});
        renderAtPath(VALID_PATH);
        const bar = screen.getByTestId("lesson-summary-score-bar");
        expect(bar).toHaveAttribute("aria-valuenow", "75");
        expect(bar).toHaveAttribute("aria-valuemax", "100");
    });

    it("summary renders the per-exercise breakdown row for each exercise step", () => {
        _ready(2, {
            ...PROGRESS,
            score_correct: 1,
            score_total: 1,
            step_results: {
                "ex-1": {
                    correct: 1,
                    total: 1,
                    attempts: 1,
                    completed_at: "2026-05-27T00:01:00Z",
                },
            },
        });
        renderAtPath(VALID_PATH);
        expect(
            screen.getByTestId("lesson-summary-breakdown"),
        ).toBeInTheDocument();
        const row = screen.getByTestId("lesson-summary-breakdown-ex-1");
        expect(row).toHaveAttribute("data-status", "correct");
        expect(row).toHaveTextContent(/1\s*\/\s*1/);
    });

    it("breakdown row reveals the canonical answer when an exercise was wrong", () => {
        const lessonWithPairs = {
            ...LESSON,
            steps: [
                LESSON.steps[0],
                {
                    ...LESSON.steps[1],
                    exercise: {
                        ...LESSON.steps[1].exercise!,
                        pairs: [
                            {left: "Bonjour", right: "Hello"},
                            {left: "Merci", right: "Thanks"},
                        ],
                    },
                },
            ],
        };
        useLessonMock.mockReturnValue({
            status: "ready",
            lesson: lessonWithPairs,
            progress: {
                ...PROGRESS,
                score_correct: 1,
                score_total: 2,
                step_results: {
                    "ex-1": {
                        correct: 1,
                        total: 2,
                        attempts: 1,
                        completed_at: "2026-05-27T00:01:00Z",
                    },
                },
            },
            currentStepIndex: 2,
            error: null,
            goNext: vi.fn(),
            goPrev: vi.fn(),
            goToStep: vi.fn(),
            goToStepById: vi.fn(),
            recordStepResult: vi.fn(),
            markCompleted: vi.fn(),
            refresh: vi.fn(),
        });
        renderAtPath(VALID_PATH);
        const row = screen.getByTestId("lesson-summary-breakdown-ex-1");
        expect(row).toHaveAttribute("data-status", "wrong");
        expect(row).toHaveTextContent(/Bonjour/);
        expect(row).toHaveTextContent(/Hello/);
    });

    it("breakdown row marks unattempted exercise steps as such", () => {
        _ready(2, {
            ...PROGRESS,
            // No step_results entry for ex-1 → unattempted.
            step_results: {},
        });
        renderAtPath(VALID_PATH);
        const row = screen.getByTestId("lesson-summary-breakdown-ex-1");
        expect(row).toHaveAttribute("data-status", "unattempted");
    });

    it("Repeat button calls goToStep(0)", () => {
        const goToStep = vi.fn();
        useLessonMock.mockReturnValue({
            status: "ready",
            lesson: LESSON,
            progress: PROGRESS,
            currentStepIndex: 2,
            error: null,
            goNext: vi.fn(),
            goPrev: vi.fn(),
            goToStep,
            goToStepById: vi.fn(),
            recordStepResult: vi.fn(),
            markCompleted: vi.fn(),
            refresh: vi.fn(),
        });
        renderAtPath(VALID_PATH);
        fireEvent.click(screen.getByTestId("lesson-summary-repeat"));
        expect(goToStep).toHaveBeenCalledWith(0);
    });

    it("Next lesson button hides when the set has only this lesson", async () => {
        // Default listLessonsMock returns a single-lesson set.
        _ready(2);
        renderAtPath(VALID_PATH);
        // listLessons resolves asynchronously; verify the absence
        // after a microtask tick.
        await waitFor(() => {
            expect(listLessonsMock).toHaveBeenCalled();
        });
        expect(
            screen.queryByTestId("lesson-summary-next"),
        ).not.toBeInTheDocument();
    });

    it("Next lesson button shows + is wired when the set has a successor", async () => {
        listLessonsMock.mockResolvedValue({
            set_id: "language-fr-a1",
            source: "astrapi69/adaptive-learner-content",
            version: "1.0.0",
            lessons: ["01-greetings.json", "02-numbers.json"],
        });
        _ready(2);
        renderAtPath(VALID_PATH);
        // The button appears once listLessons resolves.
        const nextBtn = await screen.findByTestId("lesson-summary-next");
        expect(nextBtn).toBeInTheDocument();
        expect(nextBtn).not.toBeDisabled();
        // Clicking it triggers a route change that unmounts the
        // summary, so we don't post-assert the button — the
        // contract pinned here is "the button surfaces AND has
        // a click handler that doesn't throw on activation".
        await act(async () => {
            fireEvent.click(nextBtn);
        });
    });

    it("disables Previous on step 0", () => {
        _ready(0);
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("lesson-prev")).toBeDisabled();
    });

    it("Next button reads 'Finish' on the last step", () => {
        _ready(1);
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("lesson-next")).toHaveTextContent(
            /Finish/i,
        );
    });

    it("calls goNext when Next is clicked", () => {
        const goNext = vi.fn();
        useLessonMock.mockReturnValue({
            status: "ready",
            lesson: LESSON,
            progress: PROGRESS,
            currentStepIndex: 0,
            error: null,
            goNext,
            goPrev: vi.fn(),
            goToStep: vi.fn(),
            goToStepById: vi.fn(),
            recordStepResult: vi.fn(),
            markCompleted: vi.fn(),
            refresh: vi.fn(),
        });
        renderAtPath(VALID_PATH);
        act(() => {
            fireEvent.click(screen.getByTestId("lesson-next"));
        });
        expect(goNext).toHaveBeenCalled();
    });

    it("summary mark-complete calls markCompleted", async () => {
        const markCompleted = vi.fn().mockResolvedValue(undefined);
        useLessonMock.mockReturnValue({
            status: "ready",
            lesson: LESSON,
            progress: PROGRESS,
            currentStepIndex: 2,
            error: null,
            goNext: vi.fn(),
            goPrev: vi.fn(),
            goToStep: vi.fn(),
            goToStepById: vi.fn(),
            recordStepResult: vi.fn(),
            markCompleted,
            refresh: vi.fn(),
        });
        renderAtPath(VALID_PATH);
        act(() => {
            fireEvent.click(
                screen.getByTestId("lesson-summary-mark-complete"),
            );
        });
        await waitFor(() => {
            expect(markCompleted).toHaveBeenCalled();
        });
    });
});
