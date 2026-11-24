/**
 * Tests for telling apart the due rows no question can be built for (#3952):
 * permanent causes get a reason, a lesson that merely failed to load gets
 * none.
 */

import {describe, expect, it} from "vitest";

import type {ContentLesson, ReviewQueueItem} from "../../storage/types";
import {classifyUnservable} from "./unservable";

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
                pairs: [],
                distractors: [],
            },
        })),
    } as ContentLesson;
}

function row(id: string, lessonId: string, exerciseId: string): ReviewQueueItem {
    return {
        id,
        lesson_id: lessonId,
        exercise_id: exerciseId,
        element_key: id,
    } as ReviewQueueItem;
}

const LOADED = new Map([["01.json", lesson(["ex-1"])]]);

describe("classifyUnservable", () => {
    it("leaves a row whose exercise the loaded lesson holds, by either id", () => {
        const result = classifyUnservable(
            [row("a", "01.json", "ex-1"), row("b", "01.json", "stable-ex-1")],
            LOADED,
            ["01.json"],
        );
        expect(result).toEqual({exercise_missing: [], lesson_missing: []});
    });

    it("names a row whose exercise the loaded lesson no longer holds", () => {
        const result = classifyUnservable(
            [row("a", "01.json", "ex-1"), row("gone", "01.json", "ex-removed")],
            LOADED,
            ["01.json"],
        );
        expect(result).toEqual({exercise_missing: ["gone"], lesson_missing: []});
    });

    it("names a row whose lesson the set's listing no longer holds", () => {
        const result = classifyUnservable(
            [row("a", "01.json", "ex-1"), row("gone", "09-removed.json", "ex-9")],
            LOADED,
            ["01.json", "02.json"],
        );
        expect(result).toEqual({exercise_missing: [], lesson_missing: ["gone"]});
    });

    it.each<[string, readonly string[] | null]>([
        ["the listing still holds the lesson (the load failed)", ["01.json", "02.json"]],
        ["the listing could not be read", null],
        ["the listing is empty (the set is not downloaded)", []],
    ])("gives no reason when %s", (_label, listed) => {
        const result = classifyUnservable([row("later", "02.json", "ex-2")], LOADED, listed);
        expect(result).toEqual({exercise_missing: [], lesson_missing: []});
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
