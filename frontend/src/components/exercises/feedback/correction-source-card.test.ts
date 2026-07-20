/**
 * Pins the correction-round source-card resolution (#1870).
 *
 * Regression guard for the bug this file was extracted to fix: the resolver
 * matched ``card.id === element_key``, but ``element_key`` is a content string
 * (never a card id), so the primary match was dead code and it always fell
 * back to the first referenced card — the wrong card whenever the missed
 * element belongs to a non-first card. The fix anchors on ``front`` /
 * ``token_roles``, consistent with the two other cloze-from-error callers.
 */

import {describe, expect, it} from "vitest";

import {resolveCorrectionSourceCard} from "./correction-source-card";
import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonExercise,
} from "../../../storage/types";

function _card(overrides: Partial<ContentLessonCard> = {}): ContentLessonCard {
    return {
        id: "c1",
        front: "un",
        back: "a (masc.)",
        ...overrides,
    } as ContentLessonCard;
}

function _exercise(
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-src",
        type: "matching",
        prompt: "Match",
        card_ids: ["c1", "c2"],
        distractors: [],
        ...overrides,
    };
}

function _lesson(cards: ContentLessonCard[]): ContentLesson {
    return {cards} as ContentLesson;
}

describe("resolveCorrectionSourceCard (#1870)", () => {
    it("picks the card whose front matches the missed element, even when it is NOT the first referenced card", () => {
        // The learner missed "deux" — the front of the SECOND referenced card.
        const c1 = _card({id: "c1", front: "un"});
        const c2 = _card({id: "c2", front: "deux"});
        const lesson = _lesson([c1, c2]);
        const exercise = _exercise({card_ids: ["c1", "c2"]});

        const card = resolveCorrectionSourceCard(lesson, exercise, "deux");

        // Pre-fix this returned c1 (first referenced) because the id-match was
        // dead code; the front anchor picks the correct card.
        expect(card?.id).toBe("c2");
    });

    it("matches a token_roles annotation when the front is a phrase", () => {
        const c1 = _card({id: "c1", front: "le chat"});
        const c2 = _card({
            id: "c2",
            front: "un chien",
            token_roles: [{token: "un", role: "article"}],
        });
        const lesson = _lesson([c1, c2]);
        const exercise = _exercise({card_ids: ["c1", "c2"]});

        const card = resolveCorrectionSourceCard(lesson, exercise, "un");

        expect(card?.id).toBe("c2");
    });

    it("falls back to the first referenced card when nothing matches the element", () => {
        const c1 = _card({id: "c1", front: "un"});
        const c2 = _card({id: "c2", front: "deux"});
        const lesson = _lesson([c1, c2]);
        const exercise = _exercise({card_ids: ["c1", "c2"]});

        const card = resolveCorrectionSourceCard(lesson, exercise, "trois");

        expect(card?.id).toBe("c1");
    });

    it("never resolves a card by id and never returns an unreferenced card", () => {
        // A card whose id happens to equal the element_key but is NOT
        // referenced by the source exercise must not be picked (the old bug).
        const referenced = _card({id: "c1", front: "un"});
        const trap = _card({id: "deux", front: "zzz"}); // id == element_key
        const lesson = _lesson([referenced, trap]);
        const exercise = _exercise({card_ids: ["c1"]});

        const card = resolveCorrectionSourceCard(lesson, exercise, "deux");

        expect(card?.id).toBe("c1");
    });

    it("returns null when the source exercise references no cards", () => {
        const lesson = _lesson([_card({id: "c1", front: "un"})]);
        const exercise = _exercise({card_ids: []});

        expect(resolveCorrectionSourceCard(lesson, exercise, "un")).toBeNull();
    });
});
