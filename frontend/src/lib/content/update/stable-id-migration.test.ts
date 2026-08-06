/**
 * Tests for the #2130 stable-id key migration. Mode-agnostic: the migration
 * reads + writes through the getStorage facade, so simulating the backing
 * covers both API and Dexie mode (the decision path is identical).
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    migrateSetExerciseIds,
    planExerciseIdMigration,
} from "./stable-id-migration";

const listErrors = vi.fn();
const getLesson = vi.fn();
const remapExerciseIds = vi.fn();

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {list: listErrors, remapExerciseIds},
        contentLoader: {getLesson},
    }),
}));

beforeEach(() => {
    listErrors.mockReset();
    getLesson.mockReset();
    remapExerciseIds.mockReset();
    remapExerciseIds.mockResolvedValue({applied: 0, skipped: 0});
});

describe("planExerciseIdMigration (#2130)", () => {
    it("maps every exercise that carries a differing stable_id", () => {
        const remaps = planExerciseIdMigration("ja-a1", [
            {
                filename: "01.json",
                exercises: [
                    {id: "ex-match-1", stable_id: "greetings-match-x7", type: "matching"},
                    {id: "ex-pic-2", stable_id: "greetings-pic-a2", type: "picture_choice"},
                ],
            },
        ]);
        expect(remaps).toEqual([
            {set_id: "ja-a1", lesson_id: "01.json", old: "ex-match-1", new: "greetings-match-x7"},
            {set_id: "ja-a1", lesson_id: "01.json", old: "ex-pic-2", new: "greetings-pic-a2"},
        ]);
    });

    it("skips exercises without stable_id (pre-1.9 content) and identical ids", () => {
        const remaps = planExerciseIdMigration("ja-a1", [
            {
                filename: "01.json",
                exercises: [
                    {id: "ex-old", type: "matching"},
                    {id: "same-id", stable_id: "same-id", type: "matching"},
                    {id: "ex-null", stable_id: null, type: "matching"},
                ],
            },
        ]);
        expect(remaps).toEqual([]);
    });
});

describe("migrateSetExerciseIds (#2130)", () => {
    it("re-keys the rows of the lessons the learner holds rows in", async () => {
        listErrors.mockResolvedValue([
            {set_id: "ja-a1", lesson_id: "01.json", exercise_id: "ex-match-1", element_key: "k"},
        ]);
        getLesson.mockResolvedValue({
            steps: [{
                exercise: {id: "ex-match-1", stable_id: "greetings-match-x7", type: "matching"},
            }],
        });
        remapExerciseIds.mockResolvedValue({applied: 1, skipped: 0});
        const res = await migrateSetExerciseIds("u1", "owner/repo", "ja-a1");
        expect(res).toEqual({applied: 1, skipped: 0});
        expect(getLesson).toHaveBeenCalledWith("owner/repo", "ja-a1", "01.json");
        expect(remapExerciseIds).toHaveBeenCalledWith("u1", [
            {set_id: "ja-a1", lesson_id: "01.json", old: "ex-match-1", new: "greetings-match-x7"},
        ]);
    });

    it("does nothing when the learner has no rows in the set", async () => {
        listErrors.mockResolvedValue([]);
        const res = await migrateSetExerciseIds("u1", "owner/repo", "ja-a1");
        expect(res).toEqual({applied: 0, skipped: 0});
        expect(getLesson).not.toHaveBeenCalled();
        expect(remapExerciseIds).not.toHaveBeenCalled();
    });

    it("does nothing when the cached lessons carry no stable_ids (pre-1.9 set)", async () => {
        listErrors.mockResolvedValue([
            {set_id: "ja-a1", lesson_id: "01.json", exercise_id: "ex-match-1", element_key: "k"},
        ]);
        getLesson.mockResolvedValue({
            steps: [{exercise: {id: "ex-match-1", type: "matching"}}],
        });
        const res = await migrateSetExerciseIds("u1", "owner/repo", "ja-a1");
        expect(res).toEqual({applied: 0, skipped: 0});
        expect(remapExerciseIds).not.toHaveBeenCalled();
    });

    it("an unreadable lesson contributes nothing (its rows keep their key)", async () => {
        listErrors.mockResolvedValue([
            {set_id: "ja-a1", lesson_id: "01.json", exercise_id: "ex-a", element_key: "k"},
            {set_id: "ja-a1", lesson_id: "02.json", exercise_id: "ex-b", element_key: "k"},
        ]);
        getLesson.mockImplementation(async (_s: string, _id: string, filename: string) => {
            if (filename === "02.json") throw new Error("evicted");
            return {
                steps: [{exercise: {id: "ex-a", stable_id: "stable-a", type: "matching"}}],
            };
        });
        remapExerciseIds.mockResolvedValue({applied: 1, skipped: 0});
        const res = await migrateSetExerciseIds("u1", "owner/repo", "ja-a1");
        expect(res).toEqual({applied: 1, skipped: 0});
        expect(remapExerciseIds).toHaveBeenCalledWith("u1", [
            {set_id: "ja-a1", lesson_id: "01.json", old: "ex-a", new: "stable-a"},
        ]);
    });
});
