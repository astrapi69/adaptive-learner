/**
 * #2592 — carrying SRS/error rows across an IMPORT-OVERWRITE.
 *
 * Mirrors ``edit-remap.test.ts``'s mocking style (``getStorage`` mocked
 * wholesale) so this proves the ORCHESTRATION — peek the SAVED set, build the
 * identities, plan both dimensions, apply in the right order — without
 * re-testing ``planElementKeyRemaps`` / ``planExerciseIdRemaps`` (pinned in
 * ``remap-plan.test.ts`` / ``exercise-remap-plan.test.ts``) or the per-mode
 * storage write (pinned in ``element-errors-dexie.remap*.test.ts`` and the
 * backend router tests, plus this issue's own per-mode pins in
 * ``import-remap.modes.test.ts``).
 *
 * Every fixture row carries the REAL ``ElementError.lesson_id`` shape — the
 * BARE lesson filename ``listLessons()`` returns, no ``lessons/`` prefix.
 * That is not a stylistic choice: #2657 is the sibling path shipped inert for
 * exactly this reason, its fixtures having encoded the prefix its module
 * assumed.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    incomingLessonsToPeek,
    planImportOverwrite,
    applyImportOverwritePlan,
} from "./import-remap";
import type {ContentLesson} from "../../../storage/types";

const listLessons = vi.fn();
const getLesson = vi.fn();
const list = vi.fn();
const remapKeys = vi.fn();
const remapExerciseIds = vi.fn();

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        contentLoader: {listLessons, getLesson},
        elementErrors: {list, remapKeys, remapExerciseIds},
    }),
}));

const USER = "u1";
const SET = "imported-spanish-travel";
/** The bare filename listLessons() returns AND ElementError.lesson_id holds. */
const FILE = "l0.json";

function lessonWith(
    answer: string,
    opts: {exerciseId?: string; lessonId?: string} = {},
): ContentLesson {
    return {
        id: opts.lessonId ?? "l0",
        title: "Lesson",
        description: null,
        target_language: "es",
        source_language: "de",
        estimated_minutes: 5,
        cards: [],
        steps: [
            {id: "s1", type: "theory", title: "T", body: "Body"},
            {
                id: "s2",
                type: "exercise",
                exercise: {
                    id: opts.exerciseId ?? "ex-1",
                    type: "free_text",
                    accept: [answer],
                },
            },
        ],
        contributed_by: null,
        contributed_at: null,
    } as unknown as ContentLesson;
}

function row(
    element_key: string,
    opts: {exercise_id?: string; lesson_id?: string; set_id?: string} = {},
) {
    const exercise_id = opts.exercise_id ?? "ex-1";
    const lesson_id = opts.lesson_id ?? FILE;
    return {
        id: `${USER}#${SET}#${lesson_id}#${exercise_id}#${element_key}`,
        user_id: USER,
        set_id: opts.set_id ?? SET,
        lesson_id,
        exercise_id,
        element_key,
        element_type: "free_text",
        user_answer: "",
        correct_answer: element_key,
        error_count: 0,
        correct_streak: 1,
        last_error_at: null,
        last_attempt_at: "2026-08-13T00:00:00.000Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-08-13T00:00:00.000Z",
        updated_at: "2026-08-13T00:00:00.000Z",
    };
}

beforeEach(() => {
    listLessons.mockReset();
    getLesson.mockReset();
    list.mockReset();
    remapKeys.mockReset();
    remapExerciseIds.mockReset();
    listLessons.mockResolvedValue({lessons: [FILE]});
    getLesson.mockResolvedValue(lessonWith("Merci"));
    remapKeys.mockResolvedValue({applied: 0, skipped: 0});
    remapExerciseIds.mockResolvedValue({applied: 0, skipped: 0});
});

describe("incomingLessonsToPeek", () => {
    it("names each incoming lesson by the BARE filename ElementError.lesson_id holds", () => {
        const peek = incomingLessonsToPeek([lessonWith("Merci")]);
        expect(peek).toHaveLength(1);
        // Not "lessons/l0.json" - that shape matches no row (#2657).
        expect(peek[0].filename).toBe("l0.json");
        expect(peek[0].exercises.map((ex) => ex.id)).toEqual(["ex-1"]);
    });
});

describe("planImportOverwrite", () => {
    it("plans a certain element-key remap for a corrected answer text", async () => {
        list.mockResolvedValue([row("Merci")]);

        const plan = await planImportOverwrite(USER, SET, [lessonWith("Merci !")]);

        expect(plan.element.certain).toEqual([
            {set_id: SET, lesson_id: FILE, exercise_id: "ex-1", old: "Merci", new: "Merci !"},
        ]);
        expect(plan.element.uncertain).toEqual([]);
        expect(plan.exercise.certain).toEqual([]);
    });

    it("plans a certain exercise-id remap for a renamed exercise (#2569's dimension)", async () => {
        // Same content, exercise renamed: the row's exercise_id orphans even
        // though every element_key is untouched. The minimal element-only fix
        // would leave exactly this half of the reported scenario broken.
        list.mockResolvedValue([row("Merci")]);

        const plan = await planImportOverwrite(USER, SET, [
            lessonWith("Merci", {exerciseId: "ex-free-1"}),
        ]);

        expect(plan.exercise.certain).toEqual([
            {set_id: SET, lesson_id: FILE, old: "ex-1", new: "ex-free-1"},
        ]);
    });

    it("reads the learner's MASTERED rows too - they carry the most history", async () => {
        list.mockResolvedValue([]);

        await planImportOverwrite(USER, SET, [lessonWith("Merci !")]);

        expect(list).toHaveBeenCalledWith(USER, {
            setId: SET,
            includeMastered: true,
        });
    });

    it("reports an uncertain remap instead of staying silent", async () => {
        // The incoming file dropped an exercise, so every position after it is
        // shifted by an unknown amount: refused, never guessed.
        list.mockResolvedValue([row("Merci"), row("Danke", {exercise_id: "ex-2"})]);
        getLesson.mockResolvedValue({
            ...lessonWith("Merci"),
            steps: [
                {
                    id: "s2",
                    type: "exercise",
                    exercise: {id: "ex-1", type: "free_text", accept: ["Merci"]},
                },
                {
                    id: "s3",
                    type: "exercise",
                    exercise: {id: "ex-2", type: "free_text", accept: ["Danke"]},
                },
            ],
        } as unknown as ContentLesson);

        const plan = await planImportOverwrite(USER, SET, [
            lessonWith("Merci", {exerciseId: "ex-9"}),
        ]);

        const reported =
            plan.exercise.uncertain.length + plan.element.uncertain.length;
        expect(reported).toBeGreaterThan(0);
    });

    it("is a no-op with no lesson read at all when the set holds no rows", async () => {
        list.mockResolvedValue([]);

        const plan = await planImportOverwrite(USER, SET, [lessonWith("Merci !")]);

        expect(getLesson).not.toHaveBeenCalled();
        expect(listLessons).not.toHaveBeenCalled();
        expect(plan.element.certain).toEqual([]);
        expect(plan.exercise.certain).toEqual([]);
    });

    it("only reads the lessons the learner actually holds rows in", async () => {
        listLessons.mockResolvedValue({lessons: [FILE, "l1.json", "l2.json"]});
        list.mockResolvedValue([row("Merci")]);

        await planImportOverwrite(USER, SET, [lessonWith("Merci !")]);

        expect(getLesson).toHaveBeenCalledTimes(1);
        expect(getLesson).toHaveBeenCalledWith(
            "user-generated",
            SET,
            FILE,
        );
    });

    it("leaves rows uncertain rather than mapping from a lesson it could not read", async () => {
        list.mockResolvedValue([row("Merci")]);
        getLesson.mockRejectedValue(new Error("evicted"));

        const plan = await planImportOverwrite(USER, SET, [lessonWith("Merci !")]);

        expect(plan.element.certain).toEqual([]);
        expect(plan.element.uncertain.length).toBe(1);
    });
});

describe("applyImportOverwritePlan", () => {
    it("applies the exercise dimension BEFORE the element dimension", async () => {
        const order: string[] = [];
        remapExerciseIds.mockImplementation(async () => {
            order.push("exercise");
            return {applied: 1, skipped: 0};
        });
        remapKeys.mockImplementation(async () => {
            order.push("element");
            return {applied: 1, skipped: 0};
        });

        const result = await applyImportOverwritePlan(USER, {
            exercise: {
                certain: [{set_id: SET, lesson_id: FILE, old: "ex-1", new: "ex-2"}],
                uncertain: [],
            },
            element: {
                certain: [
                    {
                        set_id: SET,
                        lesson_id: FILE,
                        exercise_id: "ex-2",
                        old: "Merci",
                        new: "Merci !",
                    },
                ],
                uncertain: [],
            },
        });

        // The element plan's proposed exercise_id already assumes the exercise
        // remap has landed, so applying out of order looks a row up under an
        // exercise_id storage does not have yet.
        expect(order).toEqual(["exercise", "element"]);
        expect(result).toEqual({applied: 2, uncertain: 0});
    });

    it("writes nothing when the plan has no certain half, and still counts the uncertain", async () => {
        const result = await applyImportOverwritePlan(USER, {
            exercise: {certain: [], uncertain: []},
            element: {
                certain: [],
                uncertain: [
                    {
                        identity: {lesson_id: FILE, exercise_id: "ex-1", element_key: "Merci"},
                        reason: "shifted",
                    },
                ],
            },
        });

        expect(remapExerciseIds).not.toHaveBeenCalled();
        expect(remapKeys).not.toHaveBeenCalled();
        expect(result).toEqual({applied: 0, uncertain: 1});
    });
});
