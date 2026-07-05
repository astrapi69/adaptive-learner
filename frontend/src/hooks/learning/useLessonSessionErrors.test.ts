/**
 * useLessonSessionErrors (#1372) — live SRS error read + refetch on the
 * reviews-changed signal (what makes the summary's replay suggestion
 * update after an error-replay round instead of staying stale).
 */

import "@testing-library/jest-dom/vitest";
import {renderHook, waitFor} from "@testing-library/react";
import {act} from "react";
import {afterEach, describe, expect, it, vi} from "vitest";

import {REVIEWS_CHANGED_EVENT} from "../../lib/review/reviewsChanged";
import type {ElementError} from "../../storage/types";

const listMock = vi.fn();
vi.mock("../../storage", () => ({
    getStorage: () => ({elementErrors: {list: listMock}}),
}));

import {useLessonSessionErrors} from "./useLessonSessionErrors";

function row(overrides: Partial<ElementError> = {}): ElementError {
    return {
        id: "r",
        user_id: "u",
        set_id: "set",
        lesson_id: "01.json",
        exercise_id: "ex-a",
        element_key: "k",
        element_type: "text",
        user_answer: "",
        correct_answer: "",
        error_count: 1,
        correct_streak: 0,
        last_error_at: null,
        last_attempt_at: "2026-06-02T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-06-02T00:00:00Z",
        updated_at: "2026-06-02T00:00:00Z",
        ...overrides,
    };
}

afterEach(() => {
    listMock.mockReset();
});

describe("useLessonSessionErrors", () => {
    it("reads on mount and refetches on REVIEWS_CHANGED (live update)", async () => {
        let current: ElementError[] = [row({correct_streak: 0})];
        listMock.mockImplementation(async () => current);

        const {result} = renderHook(() =>
            useLessonSessionErrors("u", "set", "01.json"),
        );
        await waitFor(() => expect(result.current).toHaveLength(1));
        expect(result.current[0].correct_streak).toBe(0);

        // A replay corrected the element → live state advances.
        current = [row({correct_streak: 1})];
        const before = listMock.mock.calls.length;
        act(() => {
            window.dispatchEvent(new Event(REVIEWS_CHANGED_EVENT));
        });
        await waitFor(() =>
            expect(result.current[0].correct_streak).toBe(1),
        );
        expect(listMock.mock.calls.length).toBeGreaterThan(before);
    });

    it("filters to the given lesson", async () => {
        listMock.mockResolvedValue([
            row({exercise_id: "ex-a", lesson_id: "01.json"}),
            row({exercise_id: "ex-b", lesson_id: "other.json"}),
        ]);
        const {result} = renderHook(() =>
            useLessonSessionErrors("u", "set", "01.json"),
        );
        await waitFor(() => expect(result.current).toHaveLength(1));
        expect(result.current[0].exercise_id).toBe("ex-a");
    });

    it("returns [] and does not read without a user", () => {
        const {result} = renderHook(() =>
            useLessonSessionErrors("", "set", "01.json"),
        );
        expect(result.current).toEqual([]);
        expect(listMock).not.toHaveBeenCalled();
    });
});
