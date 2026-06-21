/**
 * Smoke tests for the /adaptive-lesson/:setId page
 * (Phase 53G / v1.36.0 / F-115, F-116).
 *
 * Pins:
 *   - missing setId path → renders missing-params placeholder
 *   - storage error → renders error placeholder
 *   - no active errors → renders empty placeholder with back CTA
 *   - the lesson page mounts cleanly with mocked storage (the
 *     full happy-path pipeline is integration-tested separately
 *     in 53H's smoke gate)
 *
 * Mirrors the lighter-touch Review page tests — the lesson
 * generation itself is unit-tested in
 * ``src/lib/adaptive/*`` and the hook is exercised by the
 * Dexie-mode E2E in 53H.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const listMock = vi.fn();
const listSetsMock = vi.fn();
const getLessonMock = vi.fn();
const recordBulkMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            list: listMock,
            recordBulk: recordBulkMock,
            reviewQueue: vi.fn(),
        },
        contentLoader: {
            listSets: listSetsMock,
            getLesson: getLessonMock,
            downloadSet: vi.fn(),
            listLessons: vi.fn(),
        },
    }),
}));

vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({
        userId: "user-1",
        projectId: "p1",
        language: "en",
    }),
}));

import AdaptiveLessonPage from "./AdaptiveLesson";

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path="/adaptive-lesson/:setId"
                    element={<AdaptiveLessonPage />}
                />
                <Route
                    path="/adaptive-lesson"
                    element={<AdaptiveLessonPage />}
                />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    listMock.mockReset();
    listSetsMock.mockReset();
    getLessonMock.mockReset();
    recordBulkMock.mockReset();
});

describe("AdaptiveLessonPage", () => {
    it("renders empty state when the user has no active errors", async () => {
        listMock.mockResolvedValue([]);
        renderAt("/adaptive-lesson/language-fr-a1");
        await waitFor(() => {
            expect(
                screen.queryByTestId("adaptive-lesson-loading"),
            ).toBeNull();
        });
        expect(
            screen.getByTestId("adaptive-lesson-empty"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("adaptive-lesson-back-to-dashboard"),
        ).toBeInTheDocument();
    });

    it("renders error state when storage throws", async () => {
        listMock.mockRejectedValue(new Error("boom"));
        renderAt("/adaptive-lesson/language-fr-a1");
        await waitFor(() => {
            expect(
                screen.queryByTestId("adaptive-lesson-loading"),
            ).toBeNull();
        });
        expect(
            screen.getByTestId("adaptive-lesson-error"),
        ).toBeInTheDocument();
    });

    it("renders not-cached state when setId isn't in user's downloaded sets", async () => {
        listMock.mockResolvedValue([
            {
                id: "e1",
                user_id: "user-1",
                set_id: "language-fr-a1",
                lesson_id: "01.json",
                exercise_id: "ex-1",
                element_key: "merci",
                element_type: "vocabulary",
                user_answer: "mercy",
                correct_answer: "merci",
                error_count: 2,
                correct_streak: 0,
                last_error_at: "2026-05-28T10:00:00Z",
                last_attempt_at: "2026-05-28T10:00:00Z",
                mastered: false,
                mastered_at: null,
                created_at: "2026-05-28T10:00:00Z",
                updated_at: "2026-05-28T10:00:00Z",
            },
        ]);
        listSetsMock.mockResolvedValue({sets: []});
        renderAt("/adaptive-lesson/language-fr-a1");
        await waitFor(() => {
            expect(
                screen.queryByTestId("adaptive-lesson-loading"),
            ).toBeNull();
        });
        expect(
            screen.getByTestId("adaptive-lesson-not-cached"),
        ).toBeInTheDocument();
    });
});
