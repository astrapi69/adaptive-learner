/**
 * Integration tests for the Smart Next-Step Suggestions wiring
 * inside the lesson summary (Phase 64 / smart-next-steps).
 *
 * Renders the real LessonPage (summary view) with a full storage
 * mock + an active learner, and pins the end-to-end card set for
 * the three headline flows:
 *   - finished with errors, mid-set → next + adaptive + review
 *   - finished perfect, mid-set      → next + review (no adaptive)
 *   - finished the LAST lesson w/ errors → set-complete + adaptive
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const useLessonMock = vi.fn();
vi.mock("../hooks/useLesson", () => ({
    useLesson: () => useLessonMock(),
}));

const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const listSetsMock = vi.fn();
const elementErrorsListMock = vi.fn();
const reviewQueueMock = vi.fn();
const progressListMock = vi.fn();
const progressGetMock = vi.fn();

vi.mock("../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            listSets: listSetsMock,
            downloadSet: vi.fn(),
            listLessons: listLessonsMock,
            getLesson: getLessonMock,
        },
        elementErrors: {
            list: elementErrorsListMock,
            recordBulk: vi.fn(),
            reviewQueue: reviewQueueMock,
        },
        lessonProgress: {
            list: progressListMock,
            get: progressGetMock,
        },
        missions: {getDaily: vi.fn().mockResolvedValue({missions: [], newlyCompleted: []})},
    }),
}));

import LessonPage from "./Lesson";
import {setUserId, clearLearnerState} from "../lib/learnerState";
import type {ElementError, ReviewQueueItem} from "../storage/types";

const SET_ID = "language-fr-a1";
const FILENAME = "01-greetings.json";
const PATH = `/lesson/astrapi69--adaptive-learner-content/${SET_ID}/${FILENAME}`;

const LESSON = {
    id: "01-greetings",
    title: "Greetings",
    description: "Basic French greetings.",
    target_language: "fr",
    source_language: "en",
    level: "a1",
    cards: [],
    steps: [
        {id: "intro", type: "theory" as const, title: "Intro", body: "Hi"},
        {
            id: "ex-1",
            type: "exercise" as const,
            title: "Match",
            exercise: {
                id: "ex-1",
                type: "matching" as const,
                prompt: "Match.",
                card_ids: [],
                distractors: [],
            },
        },
    ],
};

function progressFixture(correct: number, total: number) {
    return {
        id: "row-1",
        user_id: "user-1",
        source: "astrapi69/adaptive-learner-content",
        set_id: SET_ID,
        lesson_filename: FILENAME,
        status: "in_progress" as const,
        step_results: {},
        score_correct: correct,
        score_total: total,
        time_spent_seconds: 120,
        started_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T00:00:00Z",
        completed_at: null,
        paused_at: null,
        abandoned_at: null,
    };
}

function readyAtSummary(correct: number, total: number) {
    useLessonMock.mockReturnValue({
        status: "ready",
        lesson: LESSON,
        progress: progressFixture(correct, total),
        currentStepIndex: LESSON.steps.length, // summary view
        error: null,
        goNext: vi.fn(),
        goPrev: vi.fn(),
        goToStep: vi.fn(),
        goToStepById: vi.fn(),
        recordStepResult: vi.fn(),
        markCompleted: vi.fn(),
        markPaused: vi.fn(),
        markAbandoned: vi.fn(),
        markResumed: vi.fn(),
        markRestarted: vi.fn(),
        autosave: vi.fn(),
        refresh: vi.fn(),
    });
}

function makeError(): ElementError {
    return {
        id: "err-1",
        user_id: "user-1",
        set_id: SET_ID,
        lesson_id: FILENAME,
        exercise_id: "ex-1",
        element_key: "le",
        element_type: "vocabulary",
        user_answer: "la",
        correct_answer: "le",
        error_count: 3,
        correct_streak: 0,
        last_error_at: "2026-06-01T00:00:00Z",
        last_attempt_at: "2026-06-01T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T00:00:00Z",
    };
}

function makeReviewItem(): ReviewQueueItem {
    return {
        id: "rq-1",
        user_id: "user-1",
        set_id: SET_ID,
        lesson_id: FILENAME,
        exercise_id: "ex-1",
        element_key: "merci",
        element_type: "vocabulary",
        user_answer: "mercy",
        correct_answer: "merci",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-06-01T00:00:00Z",
        last_attempt_at: "2026-06-01T00:00:00Z",
        suggested_review_at: "2026-06-01T00:00:00Z",
        overdue: true,
    };
}

function renderPage() {
    return render(
        <MemoryRouter initialEntries={[PATH]}>
            <Routes>
                <Route
                    path="/lesson/:setSlug/:setId/:filename"
                    element={<LessonPage />}
                />
                <Route path="/content" element={<div data-testid="content-stub" />} />
                <Route
                    path="/adaptive-lesson/:setId"
                    element={<div data-testid="adaptive-stub" />}
                />
                <Route
                    path="/review/:setId"
                    element={<div data-testid="review-stub" />}
                />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    for (const m of [
        useLessonMock,
        listLessonsMock,
        getLessonMock,
        listSetsMock,
        elementErrorsListMock,
        reviewQueueMock,
        progressListMock,
        progressGetMock,
    ]) {
        m.mockReset();
    }
    setUserId("user-1");
    listSetsMock.mockResolvedValue({sets: [], sources: []});
    getLessonMock.mockResolvedValue({...LESSON, title: "Numbers", steps: LESSON.steps});
    progressListMock.mockResolvedValue([]);
    progressGetMock.mockResolvedValue(null);
});

afterEach(() => {
    clearLearnerState();
});

describe("LessonPage smart next-step integration", () => {
    it("finished with errors mid-set → next + adaptive + review cards", async () => {
        listLessonsMock.mockResolvedValue({
            set_id: SET_ID,
            source: "astrapi69/adaptive-learner-content",
            version: "1.0.0",
            lessons: [FILENAME, "02-numbers.json"],
        });
        elementErrorsListMock.mockResolvedValue([makeError()]);
        reviewQueueMock.mockResolvedValue([makeReviewItem()]);
        readyAtSummary(1, 4); // low score → adaptive primary

        renderPage();

        expect(
            await screen.findByTestId("next-step-card-adaptive"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("next-step-card-next")).toBeInTheDocument();
        expect(screen.getByTestId("next-step-card-review")).toBeInTheDocument();
        // Low score → adaptive is the primary card.
        expect(
            screen.getByTestId("next-step-card-adaptive"),
        ).toHaveAttribute("data-primary", "true");
    });

    it("finished perfect mid-set → next + review, no adaptive card", async () => {
        listLessonsMock.mockResolvedValue({
            set_id: SET_ID,
            source: "astrapi69/adaptive-learner-content",
            version: "1.0.0",
            lessons: [FILENAME, "02-numbers.json"],
        });
        elementErrorsListMock.mockResolvedValue([]); // perfect run
        reviewQueueMock.mockResolvedValue([makeReviewItem()]);
        readyAtSummary(4, 4);

        renderPage();

        expect(
            await screen.findByTestId("next-step-card-next"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("next-step-card-review")).toBeInTheDocument();
        expect(
            screen.queryByTestId("next-step-card-adaptive"),
        ).not.toBeInTheDocument();
        // Perfect score → next is the primary card.
        expect(
            screen.getByTestId("next-step-card-next"),
        ).toHaveAttribute("data-primary", "true");
    });

    it("finished the LAST lesson with errors → set-complete + adaptive cards", async () => {
        listLessonsMock.mockResolvedValue({
            set_id: SET_ID,
            source: "astrapi69/adaptive-learner-content",
            version: "1.0.0",
            lessons: [FILENAME], // only lesson → last
        });
        listSetsMock.mockResolvedValue({
            sets: [
                {
                    source: "bundled",
                    branch: "main",
                    id: SET_ID,
                    title: "French A1",
                    title_native: null,
                    language: "fr",
                    target_language: "fr",
                    source_language: "en",
                    level: "a1",
                    domain: "language",
                    version: "1.0.0",
                    lesson_count: 1,
                    description: null,
                    tags: [],
                    cover_image: null,
                    cached_version: "1.0.0",
                    update_available: false,
                },
            ],
            sources: [],
        });
        elementErrorsListMock.mockResolvedValue([makeError()]);
        reviewQueueMock.mockResolvedValue([]);
        readyAtSummary(1, 4);

        renderPage();

        expect(
            await screen.findByTestId("next-step-card-complete"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("next-step-card-adaptive"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("next-step-card-next"),
        ).not.toBeInTheDocument();
        // Last lesson + errors → adaptive is primary.
        expect(
            screen.getByTestId("next-step-card-adaptive"),
        ).toHaveAttribute("data-primary", "true");
    });
});
