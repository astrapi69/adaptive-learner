/**
 * explain-error tests (#599).
 *
 * Pins that the explanation derives from classifyError tags (article
 * gender by ending, spelling/accents) and returns null when nothing
 * matches.
 */

import {describe, expect, it} from "vitest";

import {explainError, explainErrors} from "./explain-error";
import type {ElementError} from "../../storage/types";

function ee(over: Partial<ElementError>): ElementError {
    return {
        id: "e",
        user_id: "u",
        set_id: "es-a1",
        lesson_id: "01.json",
        exercise_id: "ex",
        element_key: "libro",
        element_type: "card",
        user_answer: "la libro",
        correct_answer: "el libro",
        error_count: 1,
        correct_streak: 0,
        last_error_at: null,
        last_attempt_at: "2026-01-01T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...over,
    } as ElementError;
}

describe("explainError", () => {
    it("explains an article/gender error (la vs el)", () => {
        // The context-free article heuristic fires when both answers are
        // bare articles in the same set.
        const expl = explainError(ee({user_answer: "la", correct_answer: "el"}));
        expect(expl?.tag).toBe("article_gender");
        expect(expl?.key).toBe("review.explain_article_gender");
    });

    it("returns null when no pattern matches", () => {
        const expl = explainError(
            ee({user_answer: "hello", correct_answer: "world"}),
        );
        // no article/accent/etc. heuristic fires on unrelated words
        expect(expl).toBeNull();
    });
});

describe("explainErrors", () => {
    it("collects distinct explanations in display order", () => {
        const list = explainErrors([
            ee({user_answer: "la", correct_answer: "el"}),
            ee({user_answer: "cafe", correct_answer: "café"}),
        ]);
        const tags = list.map((e) => e.tag);
        // article_gender comes before spelling_accent in the fixed order
        expect(tags[0]).toBe("article_gender");
        expect(tags).toContain("spelling_accent");
    });
});
