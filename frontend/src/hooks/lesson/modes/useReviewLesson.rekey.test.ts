/**
 * #3960 - opening a review moves the set's text-keyed rows onto their
 * element's stable_id, so this session's answers reach them. The session is
 * the only place that reaches a set no sync touches (bundled, official).
 *
 * The migration itself is pinned in element-key-migration.test.ts; here only
 * that the session runs it, and survives its failure.
 */

import {renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const migrateSetElementKeysMock = vi.fn();

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../../lib/content/update/element-key-migration", () => ({
    migrateSetElementKeys: (...args: unknown[]) => migrateSetElementKeysMock(...args),
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            reviewQueue: async () => [
                {
                    id: "row-casa",
                    user_id: "user-1",
                    set_id: "es-a1",
                    lesson_id: "01.json",
                    exercise_id: "ex-1",
                    element_key: "casa",
                    direction: "target_to_source",
                    element_type: "vocabulary",
                    user_answer: "",
                    correct_answer: "Haus",
                    error_count: 1,
                    correct_streak: 0,
                    last_error_at: "2026-05-27T00:00:00Z",
                    last_attempt_at: "2026-05-27T00:00:00Z",
                    suggested_review_at: "2026-05-28T00:00:00Z",
                    overdue: true,
                },
            ],
            recordBulk: vi.fn(),
            retireUnservable: vi.fn(),
        },
        contentLoader: {
            listSets: async () => ({sets: [{id: "es-a1", source: "bundled:es"}]}),
            listLessons: async () => ({lessons: ["01.json"]}),
            getLesson: async () => ({
                id: "L1",
                title: "L1",
                description: null,
                estimated_minutes: 5,
                cards: [],
                steps: [
                    {
                        id: "step-1",
                        type: "exercise",
                        title: null,
                        exercise: {
                            id: "ex-1",
                            type: "matching",
                            prompt: "Match",
                            card_ids: [],
                            pairs: [{left: "casa", right: "Haus", stable_id: "pair-x1"}],
                            distractors: [],
                        },
                    },
                ],
            }),
        },
    }),
}));

import {useReviewLesson} from "./useReviewLesson";

function mount() {
    return renderHook(() => useReviewLesson({setId: "es-a1", title: "Review", limit: 20}));
}

beforeEach(() => {
    vi.clearAllMocks();
    migrateSetElementKeysMock.mockResolvedValue({applied: 1, skipped: 0, superseded: 0});
});

describe("#3960 useReviewLesson re-keys text-keyed rows", () => {
    it("runs the migration for the set it opens", async () => {
        const {result} = mount();
        await waitFor(() => expect(result.current.status).toBe("ready"));
        await waitFor(() =>
            expect(migrateSetElementKeysMock).toHaveBeenCalledWith("user-1", "bundled:es", "es-a1"),
        );
        // The text-keyed row is still served in this session.
        expect(result.current.lesson?.steps).toHaveLength(1);
    });

    it("keeps the session running when the migration fails", async () => {
        migrateSetElementKeysMock.mockRejectedValue(new Error("storage down"));
        const {result} = mount();
        await waitFor(() => expect(result.current.status).toBe("ready"));
        await waitFor(() => expect(migrateSetElementKeysMock).toHaveBeenCalled());
        expect(result.current.status).toBe("ready");
    });
});
