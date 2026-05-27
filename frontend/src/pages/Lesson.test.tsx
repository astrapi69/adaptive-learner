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

vi.mock("../hooks/useLesson", () => ({
    useLesson: () => useLessonMock(),
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
        // must fire so the user can skip the step. We simulate
        // a future "cloze" type by casting the runtime string;
        // TypeScript's compile-time union doesn't include it.
        _renderWithStep({
            id: "ex-future",
            type: "cloze" as unknown as ContentLessonExercise["type"],
            prompt: "Fill in the blank.",
            card_ids: [],
            distractors: [],
        });
        expect(
            screen.getByTestId("lesson-exercise-placeholder-cloze"),
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
            expect(recordStepResult).toHaveBeenCalledWith({
                step_id: "ex-1",
                correct: 1,
                total: 1,
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
