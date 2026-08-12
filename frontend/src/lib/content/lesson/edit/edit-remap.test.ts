/**
 * #2519 — carrying SRS/error rows across a LOCAL edit-save.
 *
 * Mirrors ``plan-set-update.test.ts``'s mocking style: ``getStorage`` is
 * mocked wholesale, so this proves the ORCHESTRATION (peek old vs new,
 * build identities, plan, apply) without re-testing ``planElementKeyRemaps``
 * itself (already pinned in ``remap-plan.test.ts``) or ``remapKeys``'s
 * per-mode storage write (already pinned in
 * ``element-errors-dexie.remap.test.ts`` / the backend router test).
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {lessonFilePath, remapOrphanedElementKeys} from "./edit-remap";
import type {ContentLesson} from "../../../../storage/types";

const list = vi.fn();
const remapKeys = vi.fn();

vi.mock("../../../../storage", () => ({
    getStorage: () => ({elementErrors: {list, remapKeys}}),
}));

const USER = "u1";
const SET = "created-buch";
const LESSON_ID = "01";
const FILE_PATH = "lessons/01.json";

function lessonWithFreeText(answer: string): ContentLesson {
    return {
        id: LESSON_ID,
        title: "Lesson",
        description: null,
        target_language: "de",
        source_language: "de",
        estimated_minutes: 5,
        cards: [],
        steps: [
            {id: "s1", type: "theory", title: "T", body: "Body"},
            {
                id: "s2",
                type: "exercise",
                exercise: {id: "ex-1", type: "free_text", accept: [answer]},
            },
        ],
        contributed_by: null,
        contributed_at: null,
    } as unknown as ContentLesson;
}

function row(element_key: string, exercise_id = "ex-1") {
    return {
        id: `${USER}#${SET}#${FILE_PATH}#${exercise_id}#${element_key}#target_to_source`,
        user_id: USER,
        set_id: SET,
        lesson_id: FILE_PATH,
        exercise_id,
        element_key,
        element_type: "free_text",
        user_answer: "",
        correct_answer: element_key,
        error_count: 0,
        correct_streak: 0,
        last_error_at: null,
        last_attempt_at: "2026-08-12T00:00:00.000Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-08-12T00:00:00.000Z",
        updated_at: "2026-08-12T00:00:00.000Z",
    };
}

beforeEach(() => {
    list.mockReset();
    remapKeys.mockReset();
});

describe("lessonFilePath", () => {
    it("builds the lessons/{id}.json path ElementError.lesson_id is stored under", () => {
        expect(lessonFilePath("01")).toBe("lessons/01.json");
    });
});

describe("remapOrphanedElementKeys", () => {
    it("carries a certain remap (a typo fix at a fixed position) into elementErrors", async () => {
        list.mockResolvedValue([row("Merci")]);
        remapKeys.mockResolvedValue({applied: 1, skipped: 0});

        const result = await remapOrphanedElementKeys(
            USER,
            SET,
            LESSON_ID,
            lessonWithFreeText("Merci"),
            lessonWithFreeText("Merci !"),
        );

        expect(remapKeys).toHaveBeenCalledWith(USER, [
            {set_id: SET, lesson_id: FILE_PATH, exercise_id: "ex-1", old: "Merci", new: "Merci !"},
        ]);
        expect(result).toEqual({applied: 1, uncertain: 0});
    });

    it("is a no-op when the edit did not change any element_key", async () => {
        list.mockResolvedValue([row("Merci")]);

        const result = await remapOrphanedElementKeys(
            USER,
            SET,
            LESSON_ID,
            lessonWithFreeText("Merci"),
            lessonWithFreeText("Merci"),
        );

        expect(remapKeys).not.toHaveBeenCalled();
        expect(result).toEqual({applied: 0, uncertain: 0});
    });

    it("is a no-op with no storage read of remapKeys when the lesson has no rows to carry", async () => {
        list.mockResolvedValue([]);

        const result = await remapOrphanedElementKeys(
            USER,
            SET,
            LESSON_ID,
            lessonWithFreeText("Merci"),
            lessonWithFreeText("Merci !"),
        );

        expect(remapKeys).not.toHaveBeenCalled();
        expect(result).toEqual({applied: 0, uncertain: 0});
    });

    it("only considers rows belonging to the edited lesson", async () => {
        list.mockResolvedValue([
            row("Merci"),
            {...row("Danke", "ex-2"), lesson_id: "lessons/02.json"},
        ]);
        remapKeys.mockResolvedValue({applied: 1, skipped: 0});

        await remapOrphanedElementKeys(
            USER,
            SET,
            LESSON_ID,
            lessonWithFreeText("Merci"),
            lessonWithFreeText("Merci !"),
        );

        expect(remapKeys).toHaveBeenCalledWith(USER, [
            {set_id: SET, lesson_id: FILE_PATH, exercise_id: "ex-1", old: "Merci", new: "Merci !"},
        ]);
    });

    it("reports an uncertain remap instead of silently dropping it (#2519's minimum fallback)", async () => {
        // The exercise itself vanished (its id no longer appears) - remap-plan
        // refuses to guess which surviving exercise it might have become
        // (same shape as remap-plan.test.ts's "vanished exercise" case).
        const old = lessonWithFreeText("Merci");
        const incoming: ContentLesson = {
            ...old,
            steps: [
                {id: "s1", type: "theory", title: "T", body: "Body"},
                {id: "s2", type: "exercise", exercise: {id: "ex-2", type: "free_text", accept: ["Danke"]}},
            ],
        } as unknown as ContentLesson;
        list.mockResolvedValue([row("Merci")]);

        const result = await remapOrphanedElementKeys(USER, SET, LESSON_ID, old, incoming);

        expect(remapKeys).not.toHaveBeenCalled();
        expect(result).toEqual({applied: 0, uncertain: 1});
    });
});
