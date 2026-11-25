/**
 * Tests for the element-level stable_id key migration (#3960), the twin of
 * the #2130 exercise-level one. Mode-agnostic: it reads and writes through
 * the getStorage facade, so simulating the backing covers both API and Dexie
 * mode (the storage calls themselves are pinned per mode elsewhere).
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

const listErrors = vi.fn();
const getLesson = vi.fn();
const remapKeys = vi.fn();
const retireUnservable = vi.fn();
const notifyReviewsChanged = vi.fn();

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {list: listErrors, remapKeys, retireUnservable},
        contentLoader: {getLesson},
    }),
}));
vi.mock("../../review/reviewsChanged", () => ({
    notifyReviewsChanged: () => notifyReviewsChanged(),
}));

import type {ElementError} from "../../../storage/types";
import {migrateSetElementKeys, planElementKeyMigration} from "./element-key-migration";
import type {PeekExercise} from "./update-impact";

const MATCHING: PeekExercise = {
    id: "ex-match-1",
    type: "matching",
    pairs: [
        {left: "casa", right: "Haus", stable_id: "pair-x1"},
        {left: "perro", right: "Hund"},
    ],
};

function row(id: string, over: Partial<ElementError> = {}): ElementError {
    return {
        id,
        set_id: "es-a1",
        lesson_id: "01.json",
        exercise_id: "ex-match-1",
        element_key: "casa",
        direction: "target_to_source",
        mastered: false,
        retired_at: null,
        ...over,
    } as ElementError;
}

beforeEach(() => {
    vi.clearAllMocks();
    remapKeys.mockResolvedValue({applied: 0, skipped: 0});
    retireUnservable.mockResolvedValue({retired: 0});
    getLesson.mockResolvedValue({steps: [{exercise: MATCHING}]});
});

describe("planElementKeyMigration (#3960)", () => {
    it("maps an element's text onto its stable_id, and leaves an element without one", () => {
        const remaps = planElementKeyMigration("es-a1", [{filename: "01.json", exercises: [MATCHING]}]);
        expect(remaps).toEqual([
            {set_id: "es-a1", lesson_id: "01.json", exercise_id: "ex-match-1", old: "casa", new: "pair-x1"},
        ]);
    });

    it("names the exercise by both of its ids, since a row may sit on either (#2130)", () => {
        const remaps = planElementKeyMigration("es-a1", [
            {filename: "01.json", exercises: [{...MATCHING, stable_id: "greetings-match-x7"}]},
        ]);
        expect(remaps.map((remap) => remap.exercise_id)).toEqual(["greetings-match-x7", "ex-match-1"]);
    });

    it.each<[string, PeekExercise, {old: string; new: string}]>([
        [
            "a cloze blank",
            {id: "ex", type: "cloze", cloze_mode: "type", blanks: [{accept: ["soy"], stable_id: "blank-b1"}]},
            {old: "soy", new: "blank-b1"},
        ],
        [
            "the collapsed key of a multiple choice with one minted option",
            {
                id: "ex",
                type: "multiple_choice",
                options: [
                    {text: "si", correct: true, stable_id: "opt-2"},
                    {text: "no", correct: false},
                ],
            },
            {old: "si", new: "opt-2"},
        ],
    ])("covers %s", (_label, exercise, expected) => {
        const remaps = planElementKeyMigration("es-a1", [{filename: "01.json", exercises: [exercise]}]);
        expect(remaps).toEqual([
            {set_id: "es-a1", lesson_id: "01.json", exercise_id: "ex", ...expected},
        ]);
    });

    it.each<[string, PeekExercise]>([
        [
            "the text is not unique in the exercise",
            {
                ...MATCHING,
                pairs: [
                    {left: "el", right: "der", stable_id: "pair-a"},
                    {left: "el", right: "das", stable_id: "pair-b"},
                ],
            },
        ],
        [
            "the text is another element's key as well",
            {
                ...MATCHING,
                pairs: [
                    {left: "casa", right: "Haus", stable_id: "pair-x1"},
                    {left: "x", right: "y", stable_id: "casa"},
                ],
            },
        ],
        ["the exercise type has no key rule here", {id: "ex", type: "ext:not-adopted"}],
        ["the type has no element-level stable_id", {id: "ex", type: "free_text", accept: ["hola"]}],
        [
            "a multiselect cloze, whose key is not built from its blanks",
            {
                id: "ex",
                type: "cloze",
                cloze_mode: "multiselect",
                accept: ["a", "b"],
                blanks: [{accept: ["a"], stable_id: "blank-1"}],
            },
        ],
    ])("proposes nothing when %s", (_label, exercise) => {
        const remaps = planElementKeyMigration("es-a1", [{filename: "01.json", exercises: [exercise]}]);
        expect(remaps).toEqual([]);
    });
});

describe("planElementKeyMigration: a multiple choice minted in steps (#3962)", () => {
    const options = [
        {text: "si", correct: true, stable_id: "opt-2"},
        {text: "claro", correct: true, stable_id: "opt-1"},
        {text: "no", correct: false},
    ];

    it("maps the mixed keys onto the current key, beside the all-text one", () => {
        const remaps = planElementKeyMigration("es-a1", [
            {filename: "01.json", exercises: [{id: "ex", type: "multiple_choice", options}]},
        ]);
        expect(remaps.map((remap) => remap.new)).toEqual(["opt-1, opt-2", "opt-1, opt-2", "opt-1, opt-2"]);
        expect(remaps.map((remap) => remap.old).sort()).toEqual(["claro, opt-2", "claro, si", "opt-1, si"]);
    });
});

describe("migrateSetElementKeys (#3960)", () => {
    it("re-keys the rows that sit on a text key, and only those", async () => {
        listErrors.mockResolvedValue([row("a"), row("b", {element_key: "perro"})]);
        remapKeys.mockResolvedValue({applied: 1, skipped: 0});

        const result = await migrateSetElementKeys("u1", "owner/repo", "es-a1");

        expect(listErrors).toHaveBeenCalledWith("u1", {
            setId: "es-a1",
            includeMastered: true,
            includeRetired: true,
        });
        expect(remapKeys).toHaveBeenCalledWith("u1", [
            {set_id: "es-a1", lesson_id: "01.json", exercise_id: "ex-match-1", old: "casa", new: "pair-x1"},
        ]);
        expect(retireUnservable).not.toHaveBeenCalled();
        expect(notifyReviewsChanged).toHaveBeenCalledTimes(1);
        expect(result).toEqual({applied: 1, skipped: 0, superseded: 0});
    });

    it("retires a text-keyed row whose stable_id row exists already, as superseded", async () => {
        const stale = row("stale");
        const live = row("live", {element_key: "pair-x1"});
        listErrors.mockResolvedValue([stale, live]);
        remapKeys.mockResolvedValue({applied: 0, skipped: 1});
        retireUnservable.mockResolvedValue({retired: 1});

        const result = await migrateSetElementKeys("u1", "owner/repo", "es-a1");

        expect(retireUnservable).toHaveBeenCalledWith("u1", ["stale"], "superseded");
        expect(result).toEqual({applied: 0, skipped: 1, superseded: 1});
        expect(notifyReviewsChanged).toHaveBeenCalledTimes(1);
    });

    it("leaves a superseded row that is mastered or retired already", async () => {
        const stored = [
            row("mastered", {mastered: true}),
            row("retired", {retired_at: "2026-11-01T00:00:00Z"}),
            row("live", {element_key: "pair-x1"}),
        ];
        // The storage honours ``includeMastered``; the retired row is told
        // apart by the migration itself.
        listErrors.mockImplementation(async (_userId: string, opts: {includeMastered?: boolean}) =>
            stored.filter((entry) => opts.includeMastered || !entry.mastered),
        );
        remapKeys.mockResolvedValue({applied: 0, skipped: 2});

        await migrateSetElementKeys("u1", "owner/repo", "es-a1");

        expect(retireUnservable).not.toHaveBeenCalled();
    });

    it("writes nothing when no row sits on a text key (a second run)", async () => {
        listErrors.mockResolvedValue([row("live", {element_key: "pair-x1"})]);
        const result = await migrateSetElementKeys("u1", "owner/repo", "es-a1");
        expect(remapKeys).not.toHaveBeenCalled();
        expect(notifyReviewsChanged).not.toHaveBeenCalled();
        expect(result).toEqual({applied: 0, skipped: 0, superseded: 0});
    });

    it("reads nothing for a learner without rows in the set", async () => {
        listErrors.mockResolvedValue([]);
        await migrateSetElementKeys("u1", "owner/repo", "es-a1");
        expect(getLesson).not.toHaveBeenCalled();
    });

    it("leaves the rows of a lesson that cannot be read; a later run retries", async () => {
        listErrors.mockResolvedValue([row("a")]);
        getLesson.mockRejectedValue(new Error("evicted"));
        const result = await migrateSetElementKeys("u1", "owner/repo", "es-a1");
        expect(remapKeys).not.toHaveBeenCalled();
        expect(result).toEqual({applied: 0, skipped: 0, superseded: 0});
    });
});
