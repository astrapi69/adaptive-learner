/**
 * EXP-052 slice 2 (refs #3169, owner decision): Shuffle and Endless decide
 * which lessons feed their pool with the shell's ONE definition of a
 * playable step (``isPlayableExerciseStep``: the dispatcher's core types plus
 * the adopted ``ext:al-*`` extensions), not with a second, looser check.
 *
 * Reproduction: the hooks counted any lesson with SOME exercise step as a
 * source, so a lesson whose only exercise is a type the dispatcher cannot
 * render counted towards Shuffle's "at least two lessons" and "from N
 * lessons" while contributing nothing. Happy path: a lesson that only
 * carries an extension exercise (speak-and-record) now feeds both pools.
 */

import {renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import type {ContentLesson} from "../../../storage/types";

const hoisted = vi.hoisted(() => ({lessons: {} as Record<string, unknown>}));

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            reviewQueue: vi.fn().mockResolvedValue([]),
            list: vi.fn().mockResolvedValue([]),
            recordBulk: vi.fn().mockResolvedValue([]),
        },
        contentLoader: {
            listSets: vi.fn().mockResolvedValue({sets: [{id: "set-1", source: "repo"}]}),
            listLessons: vi.fn().mockImplementation(async () => ({
                lessons: Object.keys(hoisted.lessons),
            })),
            getLesson: vi
                .fn()
                .mockImplementation(async (_s: string, _set: string, file: string) => hoisted.lessons[file]),
        },
    }),
}));

vi.mock("../../../lib/review/review-queue", () => ({
    loadReviewQueue: vi.fn().mockResolvedValue([]),
}));

import {useEndlessLesson} from "./useEndlessLesson";
import {useShuffleLesson} from "./useShuffleLesson";

function lessonOf(file: string, types: string[]): ContentLesson {
    return {
        id: file,
        title: file,
        estimated_minutes: 1,
        cards: [],
        steps: types.map((type, i) => ({
            id: `${file}-s${i}`,
            type: "exercise",
            title: null,
            exercise: {id: `${file}-ex${i}`, type, prompt: "p", card_ids: []},
        })),
    } as unknown as ContentLesson;
}

beforeEach(() => {
    hoisted.lessons = {};
});

describe("Shuffle pools lessons by the shell's playable definition", () => {
    it("reproduction: a lesson with only unrenderable exercises does not count as a source", async () => {
        hoisted.lessons = {
            "a.json": lessonOf("a.json", ["cloze"]),
            "b.json": lessonOf("b.json", ["hologram"]),
        };
        const {result} = renderHook(() => useShuffleLesson({setId: "set-1", title: "Shuffle"}));
        await waitFor(() => expect(result.current.status).not.toBe("loading"));
        expect(result.current.status).toBe("empty");
    });

    it("happy path: a lesson with only a speak-and-record exercise feeds the shuffle", async () => {
        hoisted.lessons = {
            "a.json": lessonOf("a.json", ["cloze"]),
            "b.json": lessonOf("b.json", ["ext:al-speak-and-record"]),
        };
        const {result} = renderHook(() => useShuffleLesson({setId: "set-1", title: "Shuffle"}));
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.sourceLessonCount).toBe(2);
        expect(result.current.lesson?.steps.map((s) => s.exercise?.type).sort()).toEqual([
            "cloze",
            "ext:al-speak-and-record",
        ]);
    });
});

describe("Endless pools lessons by the shell's playable definition", () => {
    it("happy path: a set whose only exercise is speak-and-record plays it", async () => {
        hoisted.lessons = {"a.json": lessonOf("a.json", ["ext:al-speak-and-record"])};
        const {result} = renderHook(() => useEndlessLesson({setId: "set-1", title: "Endless"}));
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.step?.exercise?.type).toBe("ext:al-speak-and-record");
    });

    it("edge: a set with only unrenderable exercises is empty", async () => {
        hoisted.lessons = {"a.json": lessonOf("a.json", ["hologram"])};
        const {result} = renderHook(() => useEndlessLesson({setId: "set-1", title: "Endless"}));
        await waitFor(() => expect(result.current.status).not.toBe("loading"));
        expect(result.current.status).toBe("empty");
    });
});
