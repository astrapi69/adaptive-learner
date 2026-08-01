/**
 * planSetUpdate — the live half of Weg C (#2308).
 *
 * Runs the same expectations against the shape EACH backing returns. There is
 * deliberately no mode branch in the module: it reads cached lessons through
 * the getStorage facade, so the point of the parametrised block is to prove
 * that absence rather than to exercise two implementations (#2053 asks for a
 * per-mode proof; a silent per-mode no-op is the failure it guards against).
 *
 * The application half is already pinned per mode elsewhere: Dexie in
 * ``storage/lessons/element-errors-dexie.remap.test.ts``, API in
 * ``backend/tests/test_element_errors_router.py``.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {planSetUpdate} from "./plan-set-update";
import type {PeekLesson, UpdateImpact} from "./update-impact";

const getLesson = vi.fn();

vi.mock("../../../storage", () => ({
    getStorage: () => ({contentLoader: {getLesson: (...a: unknown[]) => getLesson(...a)}}),
}));

/** A cached lesson as either backing hands it back: exercises nested under
 *  ``steps[].exercise``. Dexie reads it from IndexedDB, the API from the
 *  content cache on disk; the parsed shape is the same contract. */
function cachedLesson(oldKey: string) {
    return {
        id: "01",
        cards: [],
        steps: [
            {id: "s1", type: "theory", body: "..."},
            {
                id: "s2",
                type: "exercise",
                exercise: {id: "ex-1", type: "free_text", accept: [oldKey]},
            },
        ],
    };
}

const incoming: PeekLesson[] = [
    {filename: "01.json", exercises: [{id: "ex-1", type: "free_text", accept: ["Merci !"]}]},
];

const impact: UpdateImpact = {
    lostLessons: [],
    lostCards: [{lesson_id: "01.json", exercise_id: "ex-1", element_key: "Merci"}],
    breaking: true,
};

beforeEach(() => {
    getLesson.mockReset();
});

describe.each(["API mode", "Dexie mode"])("planSetUpdate (%s)", () => {
    it("proposes the corrected answer for the orphaned row", async () => {
        getLesson.mockResolvedValue(cachedLesson("Merci"));
        const plan = await planSetUpdate("owner/repo", "fr-a1", impact, incoming);
        expect(plan.certain).toEqual([
            {
                set_id: "fr-a1",
                lesson_id: "01.json",
                exercise_id: "ex-1",
                old: "Merci",
                new: "Merci !",
            },
        ]);
        expect(plan.uncertain).toEqual([]);
    });

    it("reads only the lessons the learner has rows in", async () => {
        getLesson.mockResolvedValue(cachedLesson("Merci"));
        await planSetUpdate("owner/repo", "fr-a1", impact, incoming);
        expect(getLesson).toHaveBeenCalledTimes(1);
        expect(getLesson).toHaveBeenCalledWith("owner/repo", "fr-a1", "01.json");
    });

    it("proposes nothing at all when nothing is lost", async () => {
        const plan = await planSetUpdate(
            "owner/repo",
            "fr-a1",
            {lostLessons: [], lostCards: [], breaking: false},
            incoming,
        );
        expect(plan).toEqual({certain: [], uncertain: []});
        expect(getLesson).not.toHaveBeenCalled();
    });

    it("an unreadable cached lesson yields uncertainty, never a guess", async () => {
        // An evicted cache means the version the rows were recorded against is
        // gone, so there is no position to read. Inferring from the incoming
        // version alone would be exactly the silent misassignment this design
        // refuses.
        getLesson.mockRejectedValue(new Error("not cached"));
        const plan = await planSetUpdate("owner/repo", "fr-a1", impact, incoming);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain).toHaveLength(1);
        expect(plan.uncertain[0].reason).toBe("not_in_cached");
    });
});
