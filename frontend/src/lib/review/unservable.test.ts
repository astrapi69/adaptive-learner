/**
 * Tests for telling apart the due rows no question can be built for (#3952):
 * permanent causes get a reason, a lesson that merely failed to load gets
 * none.
 */

import {describe, expect, it} from "vitest";

import type {ContentLesson, ReviewQueueItem} from "../../storage/types";
import {classifyUnservable} from "./unservable";

/** Every exercise holds the one pair "libro". */
function lesson(exerciseIds: string[]): ContentLesson {
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
                stable_id: `stable-${id}`,
                type: "matching",
                prompt: "p",
                card_ids: [],
                pairs: [{left: "libro", right: "book"}],
                distractors: [],
            },
        })),
    } as ContentLesson;
}

function row(
    id: string,
    lessonId: string,
    exerciseId: string,
    elementKey = "libro",
): ReviewQueueItem {
    return {
        id,
        lesson_id: lessonId,
        exercise_id: exerciseId,
        element_key: elementKey,
        direction: "target_to_source",
        last_attempt_at: "2026-11-01T00:00:00Z",
    } as ReviewQueueItem;
}

const NONE = {exercise_missing: [], lesson_missing: [], element_missing: []};

/** A lesson holding one exercise ``ex-1`` of the given shape. */
function lessonOf(exercise: Record<string, unknown>): Map<string, ContentLesson> {
    const one = {
        id: "L",
        title: "L",
        description: null,
        estimated_minutes: 5,
        cards: [],
        steps: [
            {
                id: "step-1",
                type: "exercise",
                title: null,
                exercise: {id: "ex-1", prompt: "p", card_ids: [], ...exercise},
            },
        ],
    } as unknown as ContentLesson;
    return new Map([["01.json", one]]);
}

const LOADED = new Map([["01.json", lesson(["ex-1"])]]);

describe("classifyUnservable", () => {
    it("leaves a row whose exercise the loaded lesson holds, by either id", () => {
        const result = classifyUnservable(
            [row("a", "01.json", "ex-1"), row("b", "01.json", "stable-ex-1")],
            LOADED,
            ["01.json"],
        );
        expect(result).toEqual(NONE);
    });

    it("names a row whose exercise the loaded lesson no longer holds", () => {
        const result = classifyUnservable(
            [row("a", "01.json", "ex-1"), row("gone", "01.json", "ex-removed")],
            LOADED,
            ["01.json"],
        );
        expect(result).toEqual({...NONE, exercise_missing: ["gone"]});
    });

    it("names a row whose lesson the set's listing no longer holds", () => {
        const result = classifyUnservable(
            [row("a", "01.json", "ex-1"), row("gone", "09-removed.json", "ex-9")],
            LOADED,
            ["01.json", "02.json"],
        );
        expect(result).toEqual({...NONE, lesson_missing: ["gone"]});
    });

    it.each<[string, readonly string[] | null]>([
        ["the listing still holds the lesson (the load failed)", ["01.json", "02.json"]],
        ["the listing could not be read", null],
        ["the listing is empty (the set is not downloaded)", []],
    ])("gives no reason when %s", (_label, listed) => {
        const result = classifyUnservable([row("later", "02.json", "ex-2")], LOADED, listed);
        expect(result).toEqual(NONE);
    });

    it("classifies every row of the queue, not one per element", () => {
        const result = classifyUnservable(
            [row("gone-fwd", "01.json", "ex-removed"), row("gone-back", "01.json", "ex-removed")],
            LOADED,
            ["01.json"],
        );
        expect(result.exercise_missing).toEqual(["gone-fwd", "gone-back"]);
    });
});

describe("classifyUnservable: the element is gone from a still existing exercise (#3958)", () => {
    it("names a row whose pair the matching exercise no longer holds", () => {
        const result = classifyUnservable(
            [row("kept", "01.json", "ex-1", "libro"), row("gone", "01.json", "ex-1", "perro")],
            LOADED,
            ["01.json"],
        );
        expect(result).toEqual({...NONE, element_missing: ["gone"]});
    });

    it.each<[string, Record<string, unknown>, string]>([
        [
            "a pair's stable_id",
            {type: "matching", pairs: [{left: "libro", right: "book", stable_id: "pair-x1"}]},
            "pair-x1",
        ],
        [
            "a pair's text although the pair has a stable_id by now (a row written before it was minted)",
            {type: "matching", pairs: [{left: "libro", right: "book", stable_id: "pair-x1"}]},
            "libro",
        ],
        [
            "a cloze blank's stable_id",
            {type: "cloze", cloze_mode: "type", blanks: [{accept: ["soy"], stable_id: "blank-b1"}]},
            "blank-b1",
        ],
        [
            "the collapsed key of a multiple choice",
            {type: "multiple_choice", options: [{text: "si", correct: true}, {text: "no", correct: false}]},
            "si",
        ],
    ])("leaves a row keyed by %s", (_label, exercise, key) => {
        const result = classifyUnservable(
            [row("kept", "01.json", "ex-1", key)],
            lessonOf(exercise),
            ["01.json"],
        );
        expect(result).toEqual(NONE);
    });

    it("leaves a free-text row whose answer changed: its generated cloze records under the row's own key", () => {
        // The prompt holds the row's answer in context, so the session
        // serves a generated cloze, not a replay of the changed exercise.
        const lessons = lessonOf({
            type: "free_text",
            prompt: "Yo veo el perro hoy.",
            accept: ["el perro grande"],
        });
        const stale = {
            ...row("kept", "01.json", "ex-1", "el perro"),
            element_type: "vocabulary",
            user_answer: "el pero",
            correct_answer: "el perro",
        } as ReviewQueueItem;
        const result = classifyUnservable([stale], lessons, ["01.json"]);
        expect(result.element_missing).toEqual([]);
    });

    it("names a free-text row whose answer changed when no cloze can be built: the replay records under the new answer", () => {
        const lessons = lessonOf({
            type: "free_text",
            prompt: "Translate: the dog",
            accept: ["el can"],
        });
        const stale = {
            ...row("gone", "01.json", "ex-1", "el perro"),
            element_type: "vocabulary",
            user_answer: "el pero",
            correct_answer: "el perro",
        } as ReviewQueueItem;
        expect(classifyUnservable([stale], lessons, ["01.json"]).element_missing).toEqual(["gone"]);
    });

    it("gives no reason for an exercise type whose key rule is not known here", () => {
        const result = classifyUnservable(
            [row("unknown", "01.json", "ex-1", "anything")],
            lessonOf({type: "ext:not-adopted", ext_payload: {}}),
            ["01.json"],
        );
        expect(result).toEqual(NONE);
    });

    it("classifies each direction's row of the gone element", () => {
        const result = classifyUnservable(
            [row("fwd", "01.json", "ex-1", "perro"), row("back", "01.json", "ex-1", "perro")],
            LOADED,
            ["01.json"],
        );
        expect(result.element_missing).toEqual(["fwd", "back"]);
    });
});

describe("classifyUnservable: a row another mechanism can still re-key (#3958)", () => {
    it("leaves the row the caller's exemption names, and judges the rest", () => {
        const result = classifyUnservable(
            [row("recoverable", "01.json", "ex-1", "perro"), row("gone", "01.json", "ex-1", "gato")],
            LOADED,
            ["01.json"],
            (item) => item.element_key === "perro",
        );
        expect(result).toEqual({...NONE, element_missing: ["gone"]});
    });

    it("does not let the exemption keep a row whose exercise is gone", () => {
        const result = classifyUnservable(
            [row("gone", "01.json", "ex-removed", "perro")],
            LOADED,
            ["01.json"],
            () => true,
        );
        expect(result).toEqual({...NONE, exercise_missing: ["gone"]});
    });
});

describe("classifyUnservable: a multiple-choice row keyed while its options were partly minted (#3962)", () => {
    const options = [
        {text: "si", correct: true, stable_id: "opt-2"},
        {text: "claro", correct: true, stable_id: "opt-1"},
        {text: "no", correct: false},
    ];

    it.each(["claro, opt-2", "opt-1, si", "claro, si", "opt-1, opt-2"])(
        "leaves the row keyed %s: the migration re-keys it",
        (key) => {
            const result = classifyUnservable(
                [row("kept", "01.json", "ex-1", key)],
                lessonOf({type: "multiple_choice", options}),
                ["01.json"],
            );
            expect(result).toEqual(NONE);
        },
    );

    it("still names a key no mix of the options yields", () => {
        const result = classifyUnservable(
            [row("gone", "01.json", "ex-1", "claro, vale")],
            lessonOf({type: "multiple_choice", options}),
            ["01.json"],
        );
        expect(result).toEqual({...NONE, element_missing: ["gone"]});
    });
});
