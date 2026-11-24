/**
 * #3952 - retiring a set's unservable rows right after a confirmed update,
 * the moment the app knowingly orphans them. Storage is mocked: the function
 * goes through the storage facade, so it holds for both modes.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

const listMock = vi.fn();
const retireUnservableMock = vi.fn();
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const notifyReviewsChangedMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        elementErrors: {list: listMock, retireUnservable: retireUnservableMock},
        contentLoader: {listLessons: listLessonsMock, getLesson: getLessonMock},
    }),
}));
vi.mock("./reviewsChanged", () => ({
    notifyReviewsChanged: () => notifyReviewsChangedMock(),
}));

import type {ContentLesson, ElementError} from "../../storage/types";
import {retireUnservableInSet} from "./retire-unservable";

function lessonWith(exerciseIds: string[]): ContentLesson {
    return {
        id: "L",
        title: "L",
        description: null,
        estimated_minutes: 5,
        cards: [],
        steps: exerciseIds.map((id) => ({
            id: `step-${id}`,
            type: "exercise" as const,
            title: null,
            exercise: {id, type: "matching", prompt: "p", card_ids: [], pairs: [], distractors: []},
        })),
    } as ContentLesson;
}

function row(id: string, lessonId: string, exerciseId: string): ElementError {
    return {id, lesson_id: lessonId, exercise_id: exerciseId, element_key: id} as ElementError;
}

beforeEach(() => {
    vi.clearAllMocks();
    retireUnservableMock.mockResolvedValue({retired: 1});
    listLessonsMock.mockResolvedValue({lessons: ["01.json"]});
    getLessonMock.mockImplementation(async (_source: string, _set: string, lessonId: string) => {
        if (lessonId === "01.json") return lessonWith(["ex-1"]);
        throw new Error("no such lesson");
    });
});

describe("retireUnservableInSet", () => {
    it("retires the set's rows the new version no longer holds, by reason", async () => {
        listMock.mockResolvedValue([
            row("kept", "01.json", "ex-1"),
            row("ex-gone", "01.json", "ex-removed"),
            row("lesson-gone", "09-removed.json", "ex-9"),
        ]);

        await retireUnservableInSet("u1", "owner/repo", "ja-a1");

        // Mastered rows are out of scheduling already and keep their place in
        // the mastery figures.
        expect(listMock).toHaveBeenCalledWith("u1", {setId: "ja-a1", includeMastered: false});
        expect(retireUnservableMock).toHaveBeenCalledWith("u1", ["ex-gone"], "exercise_missing");
        expect(retireUnservableMock).toHaveBeenCalledWith("u1", ["lesson-gone"], "lesson_missing");
        expect(retireUnservableMock).toHaveBeenCalledTimes(2);
        expect(notifyReviewsChangedMock).toHaveBeenCalledTimes(1);
    });

    it("loads each referenced lesson once", async () => {
        listMock.mockResolvedValue([row("a", "01.json", "ex-1"), row("b", "01.json", "ex-1")]);
        await retireUnservableInSet("u1", "owner/repo", "ja-a1");
        expect(getLessonMock).toHaveBeenCalledTimes(1);
        expect(retireUnservableMock).not.toHaveBeenCalled();
        expect(notifyReviewsChangedMock).not.toHaveBeenCalled();
    });

    it("touches nothing for a learner without rows in the set", async () => {
        listMock.mockResolvedValue([]);
        await retireUnservableInSet("u1", "owner/repo", "ja-a1");
        expect(getLessonMock).not.toHaveBeenCalled();
        expect(retireUnservableMock).not.toHaveBeenCalled();
    });

    it.each([
        ["reading the rows fails", () => listMock.mockRejectedValue(new Error("down"))],
        [
            "retiring fails",
            () => {
                listMock.mockResolvedValue([row("ex-gone", "01.json", "ex-removed")]);
                retireUnservableMock.mockRejectedValue(new Error("down"));
            },
        ],
    ])("never throws when %s", async (_label, arrange) => {
        arrange();
        await expect(retireUnservableInSet("u1", "owner/repo", "ja-a1")).resolves.toBeUndefined();
    });
});
