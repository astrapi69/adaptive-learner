/**
 * #629 BUG 1 — Enter must drive the two-phase Check/Next button in the
 * review session, exactly as it does in the main lesson player.
 *
 * Review sessions convert free_text/word_tiles errors into CLOZE
 * exercises (``synthesizeReviewLesson``), and ``ClozeExercise`` does NOT
 * self-handle Enter — so without ``useLessonEnterKey`` wired into the
 * page, pressing Enter in a FillInBlank field does nothing.
 *
 * ``ExerciseDispatcher`` is mocked with a minimal controlled exercise
 * that reports answerable on mount and grades via its ref, so the test
 * isolates the page's Enter wiring from the real renderers.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {forwardRef, useImperativeHandle} from "react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const submitSpy = vi.fn();

const useReviewLessonMock = vi.fn();
vi.mock("../hooks/lesson/useReviewLesson", () => ({
    useReviewLesson: () => useReviewLessonMock(),
}));

// Minimal controlled exercise: answerable on mount, grades on submit().
vi.mock("../components/exercises/ExerciseDispatcher", async (orig) => {
    const actual =
        await orig<typeof import("../components/exercises/ExerciseDispatcher")>();
    type Props = {
        onInteraction?: (a: boolean) => void;
        onComplete: (r: {
            correct: number;
            total: number;
            attempts: never[];
        }) => void;
    };
    const Mock = forwardRef<{submit: () => void}, Props>((props, ref) => {
        useImperativeHandle(ref, () => ({
            submit: () => {
                submitSpy();
                props.onComplete({correct: 1, total: 1, attempts: []});
            },
        }));
        // Realistic cloze flow: not answerable on mount; the learner types
        // a value, which flips the answerable signal (an on-mount signal
        // would race the page's per-step reset effect).
        return (
            <input
                data-testid="mock-cloze-input"
                onChange={() => props.onInteraction?.(true)}
            />
        );
    });
    Mock.displayName = "MockExerciseDispatcher";
    return {...actual, ExerciseDispatcher: Mock};
});

import ReviewPage from "./Review";

const LESSON = {
    id: "review-fr-a1-x",
    title: "Review session",
    description: null,
    estimated_minutes: 1,
    cards: [],
    steps: [
        {
            id: "review-L1-ex-a-merci",
            type: "exercise" as const,
            title: null,
            exercise: {
                id: "ex-a",
                type: "cloze" as const,
                prompt: "Fill in",
                card_ids: [],
                sentence: "___ beaucoup",
                blanks: ["merci"],
            },
        },
    ],
};

const BASE = {
    status: "ready" as const,
    lesson: LESSON,
    queue: [{element_key: "merci"}],
    currentStepIndex: 0,
    error: null,
    goNext: vi.fn(),
    goPrev: vi.fn(),
    goToStep: vi.fn(),
    recordStepAttempts: vi.fn().mockResolvedValue(undefined),
    sessionScoreCorrect: 0,
    sessionScoreTotal: 0,
};

beforeEach(() => {
    submitSpy.mockClear();
    useReviewLessonMock.mockReset();
    useReviewLessonMock.mockReturnValue(BASE);
});

describe("ReviewPage: Enter shortcut (#629 BUG 1)", () => {
    it("Enter checks the answered cloze exercise via the exercise ref", async () => {
        render(
            <MemoryRouter initialEntries={["/review/fr-a1"]}>
                <Routes>
                    <Route path="/review/:setId" element={<ReviewPage />} />
                    <Route
                        path="/dashboard"
                        element={<div data-testid="dashboard-stub" />}
                    />
                </Routes>
            </MemoryRouter>,
        );
        // Type an answer (flips the exercise to answerable), then press
        // Enter with nothing focused that owns Enter.
        fireEvent.change(screen.getByTestId("mock-cloze-input"), {
            target: {value: "merci"},
        });
        fireEvent.keyDown(window, {key: "Enter"});
        expect(submitSpy).toHaveBeenCalledTimes(1);
    });
});
