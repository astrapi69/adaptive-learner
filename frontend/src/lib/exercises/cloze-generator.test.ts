/**
 * Tests for the cloze generator
 * (Phase 52E / v1.35.0 / P-127, Q-111).
 *
 * Pins the algorithm precedence (token_roles → card front → free_text
 * prompt → null), the deterministic distractor ordering, the
 * single-marker invariant (rejecting multi-instance haystacks), and
 * the null-fallback that lets the caller replay gracefully.
 */

import {describe, expect, it} from "vitest";

import {generateClozeFromError} from "./cloze-generator";
import type {
    ContentLessonCard,
    ContentLessonExercise,
    ElementError,
} from "../../storage/types";

function _error(overrides: Partial<ElementError> = {}): ElementError {
    return {
        id: "err-1",
        user_id: "user-1",
        set_id: "language-fr-a1",
        lesson_id: "03-articles.json",
        exercise_id: "ex-match-articles",
        element_key: "un",
        element_type: "vocabulary",
        user_answer: "le",
        correct_answer: "un",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-05-27T12:00:00Z",
        last_attempt_at: "2026-05-27T12:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-05-27T12:00:00Z",
        updated_at: "2026-05-27T12:00:00Z",
        ...overrides,
    };
}

function _exercise(
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-src",
        type: "free_text",
        prompt: "Translate: a cat",
        card_ids: ["art-un"],
        distractors: ["le", "la", "les"],
        ...overrides,
    };
}

function _card(
    overrides: Partial<ContentLessonCard> = {},
): ContentLessonCard {
    return {
        id: "art-un",
        front: "un chat",
        back: "a cat (masculine)",
        tags: ["article"],
        ...overrides,
    };
}

describe("generateClozeFromError: card-based with token_roles", () => {
    it("uses the token_roles annotation when correct_answer matches a token", () => {
        const card = _card({
            front: "un chat",
            token_roles: [{token: "un", role: "article"}],
        });
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "un"}),
            sourceExercise: _exercise(),
            sourceCard: card,
        });
        expect(cloze).not.toBeNull();
        expect(cloze!.type).toBe("cloze");
        expect(cloze!.sentence).toBe("___ chat");
        expect(cloze!.blanks?.[0].accept).toEqual(["un"]);
        expect(cloze!.cloze_mode).toBe("type");
        expect(cloze!.card_ids).toEqual(["art-un"]);
    });

    it("ignores token_roles whose token does not match correct_answer", () => {
        // token_roles match for ``une`` but the error is on ``un``.
        // Falls back to literal-match in front, which also succeeds.
        const card = _card({
            front: "un chat",
            token_roles: [{token: "une", role: "article"}],
        });
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "un"}),
            sourceExercise: _exercise(),
            sourceCard: card,
        });
        expect(cloze).not.toBeNull();
        expect(cloze!.sentence).toBe("___ chat");
    });
});

describe("generateClozeFromError: card-front literal fallback", () => {
    it("blanks the literal correct_answer in card.front", () => {
        const card = _card({front: "yo soy"});
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "soy", user_answer: "estoy"}),
            sourceExercise: _exercise({card_ids: ["ser-soy"]}),
            sourceCard: card,
        });
        expect(cloze).not.toBeNull();
        expect(cloze!.sentence).toBe("yo ___");
    });

    it("rejects the front when correct_answer appears more than once", () => {
        // Multi-instance haystack — the i↔i mapping is ambiguous.
        const card = _card({front: "le le chat"});
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "le"}),
            sourceExercise: _exercise(),
            sourceCard: card,
        });
        expect(cloze).toBeNull();
    });

    it("returns null when correct_answer does not appear in front", () => {
        const card = _card({front: "yo soy"});
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "estoy"}),
            sourceExercise: _exercise({type: "matching"}),
            sourceCard: card,
        });
        expect(cloze).toBeNull();
    });
});

describe("generateClozeFromError: free_text prompt fallback", () => {
    it("blanks the answer in a free_text prompt that contains it", () => {
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "Bonjour"}),
            sourceExercise: _exercise({
                type: "free_text",
                prompt: "Complete: Bonjour means hello.",
            }),
            sourceCard: null,
        });
        expect(cloze).not.toBeNull();
        expect(cloze!.sentence).toBe("Complete: ___ means hello.");
    });

    it("does NOT use prompt fallback when sourceExercise is not free_text", () => {
        // matching/picture_choice/word_tiles/cloze prompts are
        // questions, not sentences containing the answer.
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "Bonjour"}),
            sourceExercise: _exercise({
                type: "matching",
                prompt: "Match these — Bonjour is one of them",
            }),
            sourceCard: null,
        });
        expect(cloze).toBeNull();
    });

    it("returns null when free_text prompt does not contain answer", () => {
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "Bonjour"}),
            sourceExercise: _exercise({
                type: "free_text",
                prompt: "How do you say 'hello' in French?",
            }),
            sourceCard: null,
        });
        expect(cloze).toBeNull();
    });
});

describe("generateClozeFromError: distractor ordering (deterministic)", () => {
    it("user_answer first, then source distractors filtered for correct", () => {
        const card = _card({front: "un chat"});
        const cloze = generateClozeFromError({
            error: _error({
                correct_answer: "un",
                user_answer: "le",
            }),
            sourceExercise: _exercise({
                distractors: ["le", "la", "les", "un"], // un should be filtered
            }),
            sourceCard: card,
        });
        expect(cloze).not.toBeNull();
        // user_answer "le" is first; "un" filtered; "le" deduped; "la", "les" preserved.
        expect(cloze!.distractors).toEqual(["le", "la", "les"]);
    });

    it("omits user_answer from distractors when it equals correct", () => {
        const card = _card({front: "un chat"});
        const cloze = generateClozeFromError({
            error: _error({
                correct_answer: "un",
                user_answer: "un",
            }),
            sourceExercise: _exercise({
                distractors: ["le", "la"],
            }),
            sourceCard: card,
        });
        expect(cloze!.distractors).toEqual(["le", "la"]);
    });

    it("emits an empty distractor list when source has none and no user_answer", () => {
        const card = _card({front: "un chat"});
        const cloze = generateClozeFromError({
            error: _error({
                correct_answer: "un",
                user_answer: "",
            }),
            sourceExercise: _exercise({distractors: []}),
            sourceCard: card,
        });
        expect(cloze!.distractors).toEqual([]);
    });
});

describe("generateClozeFromError: determinism", () => {
    it("same inputs → byte-identical output", () => {
        const args = {
            error: _error({correct_answer: "un"}),
            sourceExercise: _exercise({distractors: ["le", "la", "les"]}),
            sourceCard: _card({front: "un chat"}),
        };
        const a = generateClozeFromError(args);
        const b = generateClozeFromError(args);
        expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    });

    it("derived id encodes exercise + element_key for stable cache joins", () => {
        const cloze = generateClozeFromError({
            error: _error({
                exercise_id: "ex-XYZ",
                element_key: "soy",
                correct_answer: "soy",
            }),
            sourceExercise: _exercise(),
            sourceCard: _card({front: "yo soy"}),
        });
        expect(cloze!.id).toBe("gen-cloze-ex-XYZ-soy");
    });
});

describe("generateClozeFromError: null fallback (replay path)", () => {
    it("returns null when correct_answer is empty", () => {
        const cloze = generateClozeFromError({
            error: _error({correct_answer: ""}),
            sourceExercise: _exercise(),
            sourceCard: _card(),
        });
        expect(cloze).toBeNull();
    });

    it("returns null when sourceCard is null and source is not free_text", () => {
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "un"}),
            sourceExercise: _exercise({type: "matching"}),
            sourceCard: null,
        });
        expect(cloze).toBeNull();
    });

    it("does not crash when source distractors is undefined", () => {
        const sourceExercise = _exercise();
        // Force distractors to undefined to simulate cached payloads
        // missing the field — TypeScript optional fields can be
        // genuinely absent at runtime.
        delete (sourceExercise as Partial<ContentLessonExercise>)
            .distractors;
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "un", user_answer: "le"}),
            sourceExercise,
            sourceCard: _card({front: "un chat"}),
        });
        expect(cloze).not.toBeNull();
        expect(cloze!.distractors).toEqual(["le"]);
    });
});

describe("generateClozeFromError: context-free blank guard (#adaptive-matching-hints)", () => {
    // A knowledge/vocab card whose FRONT *is* the answer (front === correct_answer)
    // would blank out to a bare "___" with no surrounding context. Rendered, that is
    // an unsolvable input whose only scaffolding is the app's auto length/first-letter
    // hints ("The answer has N letters", "It starts with X") — the exact "unlösbare"
    // shape reported for adaptive lessons. The generator must decline these so the
    // caller replays the original exercise instead of serving a hint-only blank.
    it("returns null when the answer spans the entire card front (bare '___')", () => {
        // Mirrors 'Die Währung des Geistes' card `sinnkrise` (front === 'Sinnkrise').
        const cloze = generateClozeFromError({
            error: _error({
                correct_answer: "Sinnkrise",
                element_key: "sinnkrise",
            }),
            sourceExercise: _exercise({
                type: "free_text",
                // Prompt does NOT contain the answer, so the free_text-prompt
                // fallback can't rescue it either — the only candidate haystack
                // is the card front, and blanking it leaves no context.
                prompt: "Als was gilt die moderne Zeitarmut?",
            }),
            sourceCard: _card({
                front: "Sinnkrise",
                back: "Die moderne Zeitarmut ist eine Sinnkrise.",
            }),
        });
        expect(cloze).toBeNull();
    });

    it("returns null when the answer spans the entire free_text prompt", () => {
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "Wertschaetzung"}),
            sourceExercise: _exercise({
                type: "free_text",
                prompt: "Wertschaetzung",
            }),
            sourceCard: null,
        });
        expect(cloze).toBeNull();
    });

    it("still builds a cloze when real context surrounds the blank (regression)", () => {
        // The common vocab shape (front is a phrase containing the answer) must
        // keep working — only the context-free collapse is rejected.
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "Verletzlichkeit"}),
            sourceExercise: _exercise({type: "free_text"}),
            sourceCard: _card({front: "Freiwillige Verletzlichkeit"}),
        });
        expect(cloze).not.toBeNull();
        expect(cloze!.sentence).toBe("Freiwillige ___");
    });
});

describe("generateClozeFromError: card_ids referential integrity (handover § 5.9)", () => {
    it("preserves sourceCard.id when available so SRS threading continues", () => {
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "un"}),
            sourceExercise: _exercise(),
            sourceCard: _card({id: "art-un"}),
        });
        expect(cloze!.card_ids).toEqual(["art-un"]);
    });

    it("emits empty card_ids when sourceCard is null", () => {
        const cloze = generateClozeFromError({
            error: _error({correct_answer: "Bonjour"}),
            sourceExercise: _exercise({
                type: "free_text",
                prompt: "Say Bonjour.",
            }),
            sourceCard: null,
        });
        expect(cloze!.card_ids).toEqual([]);
    });
});
