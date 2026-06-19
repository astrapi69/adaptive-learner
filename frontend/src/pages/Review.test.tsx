/**
 * Tests for the SRS review session page
 * (Phase 46D / C15 / P-129).
 *
 * Pins each load state of the page (loading / empty /
 * not-cached / error / ready) renders the right testid +
 * key affordances. Mirrors the Lesson.test.tsx shape — the
 * page uses the same step-walking pattern.
 *
 * useReviewLesson is mocked so the tests focus on the
 * page's rendering decisions; the hook's own state machine
 * is pinned via tests in a future commit (the hook reads
 * actual storage + does its own async work that's worth
 * its own dedicated test surface).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const useReviewLessonMock = vi.fn();

vi.mock("../hooks/lesson/useReviewLesson", () => ({
    useReviewLesson: (opts: unknown) => useReviewLessonMock(opts),
}));

import ReviewPage from "./Review";

const VALID_PATH = "/review/language-fr-a1";

function renderAtPath(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/review/:setId" element={<ReviewPage />} />
                <Route
                    path="/dashboard"
                    element={<div data-testid="dashboard-stub" />}
                />
                <Route
                    path="/content"
                    element={<div data-testid="content-stub" />}
                />
            </Routes>
        </MemoryRouter>,
    );
}

const BASE = {
    lesson: null,
    queue: [],
    currentStepIndex: 0,
    dueCount: 0,
    error: null,
    goNext: vi.fn(),
    goPrev: vi.fn(),
    goToStep: vi.fn(),
    recordStepAttempts: vi.fn(),
    sessionScoreCorrect: 0,
    sessionScoreTotal: 0,
    reload: vi.fn(),
};

beforeEach(() => {
    useReviewLessonMock.mockReset();
});

describe("ReviewPage: load states", () => {
    it("renders the loading state", () => {
        useReviewLessonMock.mockReturnValue({...BASE, status: "loading"});
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("review-loading")).toBeInTheDocument();
    });

    it("renders the empty state with a back-to-dashboard CTA", () => {
        useReviewLessonMock.mockReturnValue({...BASE, status: "empty"});
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("review-empty")).toBeInTheDocument();
        expect(
            screen.getByTestId("review-back-to-dashboard"),
        ).toBeInTheDocument();
    });

    it("renders the not-cached state with a goto-content CTA", () => {
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "not-cached",
        });
        renderAtPath(VALID_PATH);
        expect(
            screen.getByTestId("review-not-cached"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("review-goto-content"),
        ).toBeInTheDocument();
    });

    it("renders the error state", () => {
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "error",
            error: "boom",
        });
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("review-error")).toBeInTheDocument();
    });
});

describe("ReviewPage: ready state", () => {
    const LESSON = {
        id: "review-language-fr-a1-2026-05-27",
        title: "Review session",
        description: null,
        estimated_minutes: 1,
        cards: [],
        steps: [
            {
                id: "review-01-greetings.json-ex-a-merci",
                type: "exercise" as const,
                title: null,
                exercise: {
                    id: "ex-a",
                    type: "matching" as const,
                    prompt: "Match",
                    card_ids: [],
                    pairs: [{left: "Bonjour", right: "Hello"}],
                    distractors: [],
                },
            },
        ],
    };
    const QUEUE = [
        {
            id: "row-1",
            user_id: "u",
            set_id: "language-fr-a1",
            lesson_id: "01-greetings.json",
            exercise_id: "ex-a",
            element_key: "merci",
            element_type: "vocabulary",
            user_answer: "",
            correct_answer: "Merci",
            error_count: 1,
            correct_streak: 0,
            last_error_at: null,
            last_attempt_at: "2026-05-27T00:00:00Z",
            suggested_review_at: "2026-05-28T00:00:00Z",
            overdue: false,
        },
    ];

    it("renders the page + progress bar + first step", () => {
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON,
            queue: QUEUE,
            currentStepIndex: 0,
        });
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("review-page")).toBeInTheDocument();
        expect(
            screen.getByTestId("review-progress-bar"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId(
                "review-step-review-01-greetings.json-ex-a-merci",
            ),
        ).toBeInTheDocument();
    });

    it("#664: subtitle shows the presented step count (not the raw queue)", () => {
        // dueCount == steps → un-capped form, shows the step count.
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON, // 1 step
            queue: QUEUE,
            dueCount: 1,
            currentStepIndex: 0,
        });
        renderAtPath(VALID_PATH);
        const subtitle = screen.getByTestId("review-subtitle");
        expect(subtitle.textContent).toContain("1");
    });

    it("#664: subtitle shows '{shown} of {due}' when the pool is capped", () => {
        // 5 due, only 1 presented (cap/unresolvable) → both numbers shown so
        // the gap is transparent and the header agrees with the progress bar.
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON, // 1 step
            queue: QUEUE,
            dueCount: 5,
            currentStepIndex: 0,
        });
        renderAtPath(VALID_PATH);
        const subtitle = screen.getByTestId("review-subtitle");
        // Presented count (1) matches the progress bar; due (5) gives context.
        expect(subtitle.textContent).toContain("1");
        expect(subtitle.textContent).toContain("5");
    });

    it("#664: header count equals the progress-bar 'of {total}' count", () => {
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON, // 1 step
            queue: QUEUE,
            dueCount: 5,
            currentStepIndex: 0,
        });
        renderAtPath(VALID_PATH);
        const subtitle = screen.getByTestId("review-subtitle");
        const progress = screen.getByTestId("review-progress-bar");
        // The progress bar reads "Step 1 of 1"; the subtitle's presented
        // count is also 1 — they can never diverge again.
        expect(progress.textContent).toContain("1 of 1");
        expect(subtitle.textContent).toContain("1");
    });

    it("renders the summary at index past last step", () => {
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON,
            queue: QUEUE,
            currentStepIndex: 1, // past the only step
            sessionScoreCorrect: 1,
            sessionScoreTotal: 1,
        });
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("review-summary")).toBeInTheDocument();
        expect(
            screen.getByTestId("review-summary-corrected"),
        ).toHaveTextContent("1 of 1");
    });

    it("summary suggests coming back in 2 days (#626)", () => {
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON,
            queue: QUEUE,
            currentStepIndex: 1,
            sessionScoreCorrect: 1,
            sessionScoreTotal: 1,
        });
        renderAtPath(VALID_PATH);
        expect(
            screen.getByTestId("review-summary-repeat"),
        ).toHaveTextContent("2 days");
    });

    it("offers another round when more are still due (#718)", () => {
        const reload = vi.fn();
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON, // 1 presented step
            queue: QUEUE,
            currentStepIndex: 1, // summary
            dueCount: 98, // 98 due, 1 shown → 97 remaining
            reload,
        });
        renderAtPath(VALID_PATH);
        const block = screen.getByTestId("review-summary-another");
        expect(block).toHaveTextContent("97");
        fireEvent.click(screen.getByTestId("review-another-round"));
        expect(reload).toHaveBeenCalledOnce();
    });

    it("hides the another-round offer when nothing else is due (#718)", () => {
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON,
            queue: QUEUE,
            currentStepIndex: 1,
            dueCount: 1, // all due items were shown
        });
        renderAtPath(VALID_PATH);
        expect(
            screen.queryByTestId("review-summary-another"),
        ).not.toBeInTheDocument();
    });

    it("requests the configured session length (default 10) (#718)", () => {
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON,
            queue: QUEUE,
            currentStepIndex: 0,
        });
        renderAtPath(VALID_PATH);
        expect(useReviewLessonMock).toHaveBeenCalledWith(
            expect.objectContaining({limit: 10}),
        );
    });

    it("requests a quick session (limit 5) with ?quick=1 (#628)", () => {
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON,
            queue: QUEUE,
            currentStepIndex: 0,
        });
        renderAtPath(`${VALID_PATH}?quick=1`);
        expect(useReviewLessonMock).toHaveBeenCalledWith(
            expect.objectContaining({limit: 5}),
        );
    });

    it("Previous disabled on step 0", () => {
        useReviewLessonMock.mockReturnValue({
            ...BASE,
            status: "ready",
            lesson: LESSON,
            queue: QUEUE,
            currentStepIndex: 0,
        });
        renderAtPath(VALID_PATH);
        expect(screen.getByTestId("review-prev")).toBeDisabled();
    });
});
