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
            exercise: {
                id,
                type: "matching",
                prompt: "p",
                card_ids: [],
                pairs: [{left: "libro", right: "book"}],
                distractors: [],
            },
        })),
    } as ContentLesson;
}

function row(id: string, lessonId: string, exerciseId: string, elementKey = "libro"): ElementError {
    return {
        id,
        lesson_id: lessonId,
        exercise_id: exerciseId,
        element_key: elementKey,
        direction: "target_to_source",
        last_attempt_at: "2026-11-01T00:00:00Z",
    } as ElementError;
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
            row("element-gone", "01.json", "ex-1", "perro"),
        ]);

        await retireUnservableInSet("u1", "owner/repo", "ja-a1");

        // Mastered rows are out of scheduling already and keep their place in
        // the mastery figures.
        expect(listMock).toHaveBeenCalledWith("u1", {setId: "ja-a1", includeMastered: false});
        expect(retireUnservableMock).toHaveBeenCalledWith("u1", ["ex-gone"], "exercise_missing");
        expect(retireUnservableMock).toHaveBeenCalledWith("u1", ["lesson-gone"], "lesson_missing");
        // #3958 - the exercise is still there, the pair is not.
        expect(retireUnservableMock).toHaveBeenCalledWith("u1", ["element-gone"], "element_missing");
        expect(retireUnservableMock).toHaveBeenCalledTimes(3);
        expect(notifyReviewsChangedMock).toHaveBeenCalledTimes(1);
    });

    it("leaves a row the #2161 recovery can still re-key, although its key is gone (#3958)", async () => {
        // The learner has not chosen between restore and restart yet;
        // retiring the row would take the restore away.
        getLessonMock.mockResolvedValue({
            ...lessonWith(["ex-match-begruessung"]),
            steps: [
                {
                    id: "s",
                    type: "exercise",
                    title: null,
                    exercise: {
                        id: "ex-match-begruessung",
                        type: "matching",
                        prompt: "p",
                        card_ids: [],
                        pairs: [{left: "こんにちは (konnichiwa)", right: "Hallo"}],
                        distractors: [],
                    },
                },
            ],
        });
        listMock.mockResolvedValue([
            {
                ...row("awaits-recovery", "01-begruessungen.json", "ex-match-begruessung", "こんにちは"),
                set_id: "ja-a1-from-de",
            },
            {
                ...row("plain-gone", "01-begruessungen.json", "ex-match-begruessung", "さようなら-removed"),
                set_id: "ja-a1-from-de",
            },
        ]);

        await retireUnservableInSet("u1", "official", "ja-a1-from-de");

        expect(retireUnservableMock).toHaveBeenCalledTimes(1);
        expect(retireUnservableMock).toHaveBeenCalledWith("u1", ["plain-gone"], "element_missing");
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
