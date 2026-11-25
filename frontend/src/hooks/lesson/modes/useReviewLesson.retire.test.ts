/**
 * #3952 - the review session retires the due rows it can prove no question
 * can be built for, so the dashboard, the header badge and the reminder stop
 * counting them. A row whose lesson merely failed to load is left alone.
 *
 * Storage is mocked, so the pins hold for both storage modes (the hook is
 * the shared path; the storage call itself is pinned per mode elsewhere).
 */

import {renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const reviewQueueMock = vi.fn();
const retireUnservableMock = vi.fn();
const listSetsMock = vi.fn();
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const notifyReviewsChangedMock = vi.fn();

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            reviewQueue: reviewQueueMock,
            recordBulk: vi.fn(),
            retireUnservable: retireUnservableMock,
        },
        contentLoader: {
            listSets: listSetsMock,
            listLessons: listLessonsMock,
            getLesson: getLessonMock,
        },
    }),
}));

vi.mock("../../../lib/review/reviewsChanged", async (orig) => ({
    ...(await orig<typeof import("../../../lib/review/reviewsChanged")>()),
    notifyReviewsChanged: () => notifyReviewsChangedMock(),
}));

import {useReviewLesson} from "./useReviewLesson";
import type {ContentLesson, ReviewQueueItem} from "../../../storage/types";

const SET_ID = "es-a1";

function lessonWith(exerciseIds: string[]): ContentLesson {
    return {
        id: "L1",
        title: "L1",
        description: null,
        estimated_minutes: 5,
        cards: [],
        steps: exerciseIds.map((id) => ({
            id: `step-${id}`,
            type: "exercise" as const,
            title: null,
            exercise: {
                id,
                type: "matching",
                prompt: `Match (${id})`,
                card_ids: [],
                pairs: [{left: "libro", right: "book"}],
                distractors: [],
            },
        })),
    } as ContentLesson;
}

function qItem(over: Partial<ReviewQueueItem>): ReviewQueueItem {
    return {
        id: `row-${over.element_key ?? "x"}`,
        user_id: "user-1",
        set_id: SET_ID,
        lesson_id: "01.json",
        exercise_id: "ex-1",
        element_key: "libro",
        direction: "target_to_source",
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "book",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-05-27T00:00:00Z",
        last_attempt_at: "2026-05-27T00:00:00Z",
        suggested_review_at: "2026-05-28T00:00:00Z",
        overdue: true,
        ...over,
    };
}

function mount() {
    return renderHook(() => useReviewLesson({setId: SET_ID, title: "Review", limit: 20}));
}

beforeEach(() => {
    vi.clearAllMocks();
    listSetsMock.mockResolvedValue({sets: [{id: SET_ID, source: "bundled:es"}]});
    listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json"]});
    retireUnservableMock.mockResolvedValue({retired: 0});
    getLessonMock.mockImplementation(async (_source: string, _set: string, lessonId: string) => {
        if (lessonId === "01.json") return lessonWith(["ex-1"]);
        throw new Error("not loadable");
    });
});

describe("#3952 useReviewLesson retires what it cannot serve", () => {
    it("retires a row whose exercise the loaded lesson no longer holds, with the reason", async () => {
        reviewQueueMock.mockResolvedValue([
            qItem({id: "row-a"}),
            qItem({id: "row-gone", exercise_id: "ex-removed"}),
        ]);
        const {result} = mount();
        await waitFor(() => expect(result.current.status).toBe("ready"));

        await waitFor(() =>
            expect(retireUnservableMock).toHaveBeenCalledWith(
                "user-1",
                ["row-gone"],
                "exercise_missing",
            ),
        );
        expect(retireUnservableMock).toHaveBeenCalledTimes(1);
        // The counters outside the session recompute.
        await waitFor(() => expect(notifyReviewsChangedMock).toHaveBeenCalled());
    });

    it("retires a row whose element the still existing exercise no longer holds (#3958)", async () => {
        reviewQueueMock.mockResolvedValue([
            qItem({id: "row-a"}),
            qItem({id: "row-perro", element_key: "perro"}),
        ]);
        const {result} = mount();
        await waitFor(() => expect(result.current.status).toBe("ready"));

        await waitFor(() =>
            expect(retireUnservableMock).toHaveBeenCalledWith(
                "user-1",
                ["row-perro"],
                "element_missing",
            ),
        );
        expect(retireUnservableMock).toHaveBeenCalledTimes(1);
    });

    it("retires a row whose lesson the set no longer lists", async () => {
        reviewQueueMock.mockResolvedValue([
            qItem({id: "row-a"}),
            qItem({id: "row-gone", lesson_id: "09-removed.json"}),
        ]);
        const {result} = mount();
        await waitFor(() => expect(result.current.status).toBe("ready"));

        await waitFor(() =>
            expect(retireUnservableMock).toHaveBeenCalledWith(
                "user-1",
                ["row-gone"],
                "lesson_missing",
            ),
        );
    });

    it.each([
        ["the set still lists the lesson", {lessons: ["01.json", "02.json"]}],
        ["the listing is empty", {lessons: []}],
    ])("leaves a row whose lesson only failed to load (%s)", async (_label, listing) => {
        listLessonsMock.mockResolvedValue(listing);
        reviewQueueMock.mockResolvedValue([
            qItem({id: "row-a"}),
            qItem({id: "row-later", lesson_id: "02.json"}),
        ]);
        const {result} = mount();
        await waitFor(() => expect(result.current.status).toBe("ready"));
        await waitFor(() => expect(listLessonsMock).toHaveBeenCalled());

        expect(retireUnservableMock).not.toHaveBeenCalled();
        // Not offered in this session either (#3951).
        expect(result.current.dueCount).toBe(1);
    });

    it("leaves the row when the listing cannot be read", async () => {
        listLessonsMock.mockRejectedValue(new Error("offline"));
        reviewQueueMock.mockResolvedValue([
            qItem({id: "row-a"}),
            qItem({id: "row-later", lesson_id: "02.json"}),
        ]);
        const {result} = mount();
        await waitFor(() => expect(result.current.status).toBe("ready"));
        await waitFor(() => expect(listLessonsMock).toHaveBeenCalled());
        expect(retireUnservableMock).not.toHaveBeenCalled();
    });

    it("does not ask for the listing when every lesson loaded", async () => {
        reviewQueueMock.mockResolvedValue([qItem({id: "row-a"})]);
        const {result} = mount();
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(listLessonsMock).not.toHaveBeenCalled();
        expect(retireUnservableMock).not.toHaveBeenCalled();
    });

    it("keeps the session running when retiring fails", async () => {
        retireUnservableMock.mockRejectedValue(new Error("storage down"));
        reviewQueueMock.mockResolvedValue([
            qItem({id: "row-a"}),
            qItem({id: "row-gone", exercise_id: "ex-removed"}),
        ]);
        const {result} = mount();
        await waitFor(() => expect(result.current.status).toBe("ready"));
        await waitFor(() => expect(retireUnservableMock).toHaveBeenCalled());
        expect(result.current.status).toBe("ready");
        expect(result.current.lesson?.steps).toHaveLength(1);
    });

    it("retires even when nothing is left to serve, and the session ends empty", async () => {
        reviewQueueMock.mockResolvedValue([
            qItem({id: "row-gone", exercise_id: "ex-removed"}),
        ]);
        const {result} = mount();
        await waitFor(() => expect(result.current.status).toBe("empty"));
        await waitFor(() =>
            expect(retireUnservableMock).toHaveBeenCalledWith(
                "user-1",
                ["row-gone"],
                "exercise_missing",
            ),
        );
    });
});
