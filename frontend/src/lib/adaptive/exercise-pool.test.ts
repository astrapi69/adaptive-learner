/**
 * Tests for the exercise pool builder (Phase 53B / v1.36.0 /
 * Q-115 — generator-logic regression pins).
 */

import {describe, expect, it} from "vitest";

import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonExercise,
    ContentLessonStep,
    ElementError,
} from "../../storage/types";

import {buildExercisePool} from "./exercise-pool";
import type {PrioritizedElement} from "./types";

const NOW = "2026-05-28T12:00:00Z";

function makeCard(overrides: Partial<ContentLessonCard> = {}): ContentLessonCard {
    return {
        id: overrides.id ?? "card-1",
        front: overrides.front ?? "bonjour",
        back: overrides.back ?? "hello",
        notes: null,
        image: null,
        audio: null,
        difficulty: overrides.difficulty ?? null,
        tags: [],
        token_roles: overrides.token_roles ?? null,
    };
}

function makeExercise(
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: overrides.id ?? "ex-1",
        type: overrides.type ?? "matching",
        prompt: overrides.prompt ?? "Match",
        card_ids: overrides.card_ids ?? ["card-1"],
        pairs: overrides.pairs ?? null,
        images: overrides.images ?? null,
        accept: overrides.accept ?? null,
        tiles: overrides.tiles ?? null,
        accept_orderings: overrides.accept_orderings ?? null,
        distractors: overrides.distractors ?? [],
        hint: null,
        sentence: overrides.sentence ?? null,
        blanks: overrides.blanks ?? null,
        cloze_mode: overrides.cloze_mode ?? null,
    };
}

/**
 * A card-less exercise whose ``card_ids`` is genuinely ``undefined`` at
 * runtime. Simulates Dexie-mode raw content (#1636): the newer card-less
 * exercise types (``multiple_choice`` / ``ext:al-*``) are loaded straight
 * from JSON without a Pydantic ``model_dump``, so they can violate the
 * ``ContentLessonExercise`` compile-time promise that ``card_ids`` is
 * always present. The cast + delete produces that exact runtime shape.
 */
function makeCardlessExercise(
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    const exercise = makeExercise(overrides);
    delete (exercise as {card_ids?: string[]}).card_ids;
    return exercise;
}

function makeStep(exercise: ContentLessonExercise): ContentLessonStep {
    return {
        id: `step-${exercise.id}`,
        type: "exercise",
        title: null,
        body: null,
        exercise,
    };
}

function makeLesson(
    id: string,
    cards: ContentLessonCard[],
    exercises: ContentLessonExercise[],
): ContentLesson {
    return {
        id,
        title: `Lesson ${id}`,
        description: null,
        estimated_minutes: 5,
        cards,
        steps: exercises.map(makeStep),
    };
}

function makePrioritized(
    element_key: string,
    overrides: Partial<PrioritizedElement> = {},
): PrioritizedElement {
    return {
        element_key,
        set_id: overrides.set_id ?? "language-fr-a1",
        lesson_id: overrides.lesson_id ?? "01-greetings.json",
        exercise_id: overrides.exercise_id ?? "ex-1",
        element_type: overrides.element_type ?? "vocabulary",
        error_count: overrides.error_count ?? 2,
        correct_streak: 0,
        last_error_at: NOW,
        last_attempt_at: NOW,
        user_answer: overrides.user_answer ?? "x",
        correct_answer: overrides.correct_answer ?? element_key,
        recency_weight: 1.0,
        priority_score: overrides.priority_score ?? 2,
    };
}

function makeError(element_key: string, overrides: Partial<ElementError> = {}): ElementError {
    return {
        id: `err-${element_key}`,
        user_id: "user-1",
        set_id: overrides.set_id ?? "language-fr-a1",
        lesson_id: overrides.lesson_id ?? "01-greetings.json",
        exercise_id: overrides.exercise_id ?? "ex-1",
        element_key,
        element_type: overrides.element_type ?? "vocabulary",
        user_answer: overrides.user_answer ?? "x",
        correct_answer: overrides.correct_answer ?? element_key,
        error_count: overrides.error_count ?? 1,
        correct_streak: 0,
        last_error_at: NOW,
        last_attempt_at: NOW,
        mastered: false,
        mastered_at: null,
        created_at: NOW,
        updated_at: NOW,
    };
}

describe("buildExercisePool — authored exercises", () => {
    it("returns empty pool when no targets", () => {
        const lessons = new Map<string, ContentLesson>();
        lessons.set(
            "01.json",
            makeLesson(
                "01.json",
                [makeCard({id: "c1", front: "bonjour"})],
                [makeExercise({id: "ex-1", card_ids: ["c1"]})],
            ),
        );
        const pool = buildExercisePool([], {lessons});
        expect(pool).toEqual([]);
    });

    it("returns empty pool when no lessons cached", () => {
        const pool = buildExercisePool([makePrioritized("bonjour")], {
            lessons: new Map(),
        });
        expect(pool).toEqual([]);
    });

    it("finds an exercise via card.front literal match", () => {
        const card = makeCard({id: "c1", front: "bonjour"});
        const exercise = makeExercise({id: "ex-1", card_ids: ["c1"]});
        const lessons = new Map<string, ContentLesson>([
            ["01.json", makeLesson("01.json", [card], [exercise])],
        ]);
        const pool = buildExercisePool([makePrioritized("bonjour")], {
            lessons,
        });
        expect(pool).toHaveLength(1);
        expect(pool[0].exercise.id).toBe("ex-1");
        expect(pool[0].element_key).toBe("bonjour");
        expect(pool[0].is_generated).toBe(false);
    });

    it("finds an exercise via card.token_roles match", () => {
        const card = makeCard({
            id: "c1",
            front: "je suis",
            token_roles: [
                {token: "je", role: "noun"},
                {token: "suis", role: "verb"},
            ],
        });
        const exercise = makeExercise({id: "ex-2", card_ids: ["c1"]});
        const lessons = new Map<string, ContentLesson>([
            ["01.json", makeLesson("01.json", [card], [exercise])],
        ]);
        const pool = buildExercisePool([makePrioritized("suis")], {lessons});
        expect(pool).toHaveLength(1);
        expect(pool[0].exercise.id).toBe("ex-2");
    });

    it("skips exercises whose cards don't target the element", () => {
        const c1 = makeCard({id: "c1", front: "bonjour"});
        const c2 = makeCard({id: "c2", front: "merci"});
        const ex = makeExercise({id: "ex-merci", card_ids: ["c2"]});
        const lessons = new Map<string, ContentLesson>([
            ["01.json", makeLesson("01.json", [c1, c2], [ex])],
        ]);
        const pool = buildExercisePool([makePrioritized("bonjour")], {
            lessons,
        });
        expect(pool).toEqual([]);
    });

    it("collects exercises from MULTIPLE lessons in the cache", () => {
        const c1 = makeCard({id: "c1", front: "bonjour"});
        const c2 = makeCard({id: "c2", front: "bonjour"});
        const ex1 = makeExercise({id: "ex-1", card_ids: ["c1"], type: "matching"});
        const ex2 = makeExercise({id: "ex-2", card_ids: ["c2"], type: "free_text"});
        const lessons = new Map<string, ContentLesson>([
            ["01.json", makeLesson("01.json", [c1], [ex1])],
            ["02.json", makeLesson("02.json", [c2], [ex2])],
        ]);
        const pool = buildExercisePool([makePrioritized("bonjour")], {
            lessons,
        });
        expect(pool).toHaveLength(2);
        expect(pool.map((p) => p.exercise.id).sort()).toEqual(["ex-1", "ex-2"]);
    });
});

describe("buildExercisePool — difficulty estimates", () => {
    it.each([
        ["picture_choice", 1],
        ["matching", 2],
        ["free_text", 4],
        ["word_tiles", 4],
    ] as const)("estimates difficulty %s = %s", (type, expected) => {
        const card = makeCard({id: "c1", front: "bonjour"});
        const ex = makeExercise({id: "ex-1", type, card_ids: ["c1"]});
        const lessons = new Map<string, ContentLesson>([
            ["01.json", makeLesson("01.json", [card], [ex])],
        ]);
        const pool = buildExercisePool([makePrioritized("bonjour")], {
            lessons,
        });
        expect(pool[0].difficulty_estimate).toBe(expected);
    });

    it("cloze in type mode = 3, in select mode = 2", () => {
        const card = makeCard({id: "c1", front: "bonjour"});
        const exType = makeExercise({
            id: "ex-type",
            type: "cloze",
            card_ids: ["c1"],
            cloze_mode: "type",
            sentence: "___",
            blanks: [{accept: ["bonjour"]}],
        });
        const exSelect = makeExercise({
            id: "ex-sel",
            type: "cloze",
            card_ids: ["c1"],
            cloze_mode: "select",
            sentence: "___",
            blanks: [{accept: ["bonjour"]}],
            distractors: ["bonsoir"],
        });
        const lessons = new Map<string, ContentLesson>([
            ["01.json", makeLesson("01.json", [card], [exType, exSelect])],
        ]);
        const pool = buildExercisePool([makePrioritized("bonjour")], {
            lessons,
        });
        const typeDiff = pool.find((p) => p.exercise.id === "ex-type")?.difficulty_estimate;
        const selDiff = pool.find((p) => p.exercise.id === "ex-sel")?.difficulty_estimate;
        expect(typeDiff).toBe(3);
        expect(selDiff).toBe(2);
    });
});

describe("buildExercisePool — generated cloze augmentation", () => {
    it("emits a generated cloze candidate when an error is supplied", () => {
        const card = makeCard({id: "c1", front: "merci beaucoup"});
        const ex = makeExercise({
            id: "ex-1",
            type: "free_text",
            card_ids: ["c1"],
            prompt: "Translate 'thank you very much'",
            accept: ["merci beaucoup"],
        });
        const lessons = new Map<string, ContentLesson>([
            ["01-greetings.json", makeLesson("01-greetings.json", [card], [ex])],
        ]);
        const error = makeError("beaucoup", {
            user_answer: "boucoup",
            correct_answer: "beaucoup",
        });
        const errorsByElementKey = new Map([["beaucoup", error]]);
        const pool = buildExercisePool([makePrioritized("beaucoup")], {
            lessons,
            errorsByElementKey,
        });
        const generated = pool.filter((p) => p.is_generated);
        expect(generated.length).toBeGreaterThanOrEqual(1);
        expect(generated[0].exercise.type).toBe("cloze");
    });

    it("emits NO generated cloze when the card front IS the answer (bare '___' guard)", () => {
        // A knowledge/vocab card whose front === the answer would blank to a
        // context-free "___" — an unsolvable hint-only exercise. The generator
        // declines it, so the pool carries no degenerate generated candidate
        // (the authored exercise stays; the caller replays it). Mirrors
        // 'Die Währung des Geistes' card `sinnkrise` (front === 'Sinnkrise').
        const card = makeCard({id: "c1", front: "Sinnkrise"});
        const ex = makeExercise({
            id: "ex-1",
            type: "free_text",
            card_ids: ["c1"],
            prompt: "Als was gilt die moderne Zeitarmut?",
            accept: ["Sinnkrise"],
        });
        const lessons = new Map<string, ContentLesson>([
            ["03-zeit.json", makeLesson("03-zeit.json", [card], [ex])],
        ]);
        const error = makeError("Sinnkrise", {correct_answer: "Sinnkrise"});
        const errorsByElementKey = new Map([["Sinnkrise", error]]);
        const pool = buildExercisePool([makePrioritized("Sinnkrise")], {
            lessons,
            errorsByElementKey,
        });
        expect(pool.filter((p) => p.is_generated)).toHaveLength(0);
        expect(pool.filter((p) => !p.is_generated)).toHaveLength(1);
    });

    it("falls back gracefully when cloze generator returns null", () => {
        const card = makeCard({id: "c1", front: "merci"});
        const ex = makeExercise({
            id: "ex-1",
            type: "matching",
            card_ids: ["c1"],
        });
        const lessons = new Map<string, ContentLesson>([
            ["01-greetings.json", makeLesson("01-greetings.json", [card], [ex])],
        ]);
        // Use an answer that won't appear in card.front (so the
        // cloze generator's three paths all fail), but for which
        // the error_key matches card.front so the candidate
        // collection picks up the original exercise.
        const error = makeError("merci", {correct_answer: "nonexistent-token"});
        const errorsByElementKey = new Map([["merci", error]]);
        const pool = buildExercisePool([makePrioritized("merci")], {
            lessons,
            errorsByElementKey,
        });
        const generated = pool.filter((p) => p.is_generated);
        expect(generated).toHaveLength(0);
        // But the authored matching exercise should still be there.
        const authored = pool.filter((p) => !p.is_generated);
        expect(authored).toHaveLength(1);
    });
});

describe("buildExercisePool — determinism + dedup", () => {
    it("same inputs produce same output order", () => {
        const card = makeCard({id: "c1", front: "bonjour"});
        const ex1 = makeExercise({id: "ex-1", card_ids: ["c1"]});
        const ex2 = makeExercise({id: "ex-2", card_ids: ["c1"], type: "free_text"});
        const lessons = new Map<string, ContentLesson>([
            ["02.json", makeLesson("02.json", [card], [ex2])],
            ["01.json", makeLesson("01.json", [card], [ex1])],
        ]);
        const pool1 = buildExercisePool([makePrioritized("bonjour")], {lessons});
        const pool2 = buildExercisePool([makePrioritized("bonjour")], {lessons});
        expect(pool1.map((p) => p.exercise.id)).toEqual(
            pool2.map((p) => p.exercise.id),
        );
        // Lessons are iterated in sorted lesson_id order regardless
        // of Map insertion order:
        expect(pool1[0].source_lesson_id).toBe("01.json");
        expect(pool1[1].source_lesson_id).toBe("02.json");
    });

    it("dedupes (lesson_id, exercise_id, element_key) tuples", () => {
        // Two targets pointing at the same element_key shouldn't
        // double-emit the same exercise candidate (defensive — the
        // analyzer doesn't produce duplicates, but the builder is
        // robust against it).
        const card = makeCard({id: "c1", front: "bonjour"});
        const ex = makeExercise({id: "ex-1", card_ids: ["c1"]});
        const lessons = new Map<string, ContentLesson>([
            ["01.json", makeLesson("01.json", [card], [ex])],
        ]);
        const pool = buildExercisePool(
            [makePrioritized("bonjour"), makePrioritized("bonjour")],
            {lessons},
        );
        expect(pool).toHaveLength(1);
    });
});

describe("buildExercisePool — card-less exercise types (#1636 regression)", () => {
    it("does not crash scanning a cached lesson whose exercise has no card_ids", () => {
        // The builder scans EVERY exercise in EVERY cached lesson; a single
        // card-less multiple_choice / ext:al-* type must not throw on .some().
        const lessons = new Map<string, ContentLesson>([
            [
                "01.json",
                makeLesson(
                    "01.json",
                    [makeCard({id: "c1", front: "Gehirn"})],
                    [makeCardlessExercise({id: "ex-mc", type: "multiple_choice"})],
                ),
            ],
        ]);
        expect(() =>
            buildExercisePool([makePrioritized("Gehirn")], {lessons}),
        ).not.toThrow();
    });

    it("excludes a card-less exercise from card-target matches", () => {
        // No referenced cards -> the exercise cannot target the element via a
        // card, so it is correctly not a pool candidate (empty, not a crash).
        const lessons = new Map<string, ContentLesson>([
            [
                "01.json",
                makeLesson(
                    "01.json",
                    [makeCard({id: "c1", front: "Gehirn"})],
                    [makeCardlessExercise({id: "ex-mc", type: "multiple_choice"})],
                ),
            ],
        ]);
        expect(buildExercisePool([makePrioritized("Gehirn")], {lessons})).toEqual([]);
    });

    it("does not crash the generated-cloze path when the errored exercise is card-less", () => {
        // _generatedCandidate reads sourceExercise.card_ids (.includes/.length/[0]);
        // a free_text error recorded against a card-less exercise must not throw.
        const lessons = new Map<string, ContentLesson>([
            [
                "01.json",
                makeLesson(
                    "01.json",
                    [makeCard({id: "c1", front: "Gehirn"})],
                    [makeCardlessExercise({id: "ex-ft", type: "free_text"})],
                ),
            ],
        ]);
        const errors = new Map<string, ElementError>([
            ["Gehirn", makeError("Gehirn", {exercise_id: "ex-ft", lesson_id: "01.json"})],
        ]);
        expect(() =>
            buildExercisePool([makePrioritized("Gehirn", {exercise_id: "ex-ft"})], {
                lessons,
                errorsByElementKey: errors,
            }),
        ).not.toThrow();
    });

    it("still builds a pool for a mixed history with a normal card-referencing exercise", () => {
        // Regression baseline: a matching exercise WITH card_ids alongside a
        // card-less one still yields the card-referencing candidate.
        const lessons = new Map<string, ContentLesson>([
            [
                "01.json",
                makeLesson(
                    "01.json",
                    [makeCard({id: "c1", front: "Gehirn"})],
                    [
                        makeCardlessExercise({id: "ex-mc", type: "multiple_choice"}),
                        makeExercise({id: "ex-1", type: "matching", card_ids: ["c1"]}),
                    ],
                ),
            ],
        ]);
        const pool = buildExercisePool([makePrioritized("Gehirn")], {lessons});
        expect(pool).toHaveLength(1);
        expect(pool[0].exercise.id).toBe("ex-1");
    });
});

describe("authored card.difficulty as cold-start prior (#1599)", () => {
    // Explicit null-default decision: without an authored difficulty the
    // estimate is EXACTLY the type heuristic (matching = 2) — identical to
    // the behaviour before #1599. Authored values only shift the estimate.
    function poolFor(cardOverrides: Partial<ContentLessonCard>[]) {
        const cards = cardOverrides.map((ov, i) =>
            makeCard({id: `card-${i + 1}`, front: i === 0 ? "bonjour" : `w${i}`, ...ov}),
        );
        const ex = makeExercise({card_ids: cards.map((c) => c.id)});
        const lessons = new Map([["01.json", makeLesson("01.json", cards, [ex])]]);
        return buildExercisePool([makePrioritized("bonjour")], {lessons});
    }

    it("blends an authored difficulty into the estimate (matching 2 + authored 5 = 4)", () => {
        const pool = poolFor([{difficulty: 5}]);
        expect(pool[0].difficulty_estimate).toBe(4);
    });

    it("without authored difficulty the estimate is the pure type heuristic (unchanged)", () => {
        expect(poolFor([{}])[0].difficulty_estimate).toBe(2);
    });

    it("difficulty: null is ignored (neutral, behaves as unset)", () => {
        expect(poolFor([{difficulty: null}])[0].difficulty_estimate).toBe(2);
    });

    it("out-of-range values are ignored (0 and 9 are not valid priors)", () => {
        expect(poolFor([{difficulty: 0}])[0].difficulty_estimate).toBe(2);
        expect(poolFor([{difficulty: 9}])[0].difficulty_estimate).toBe(2);
    });

    it("averages across referenced cards, skipping unset ones (1 and 5 avg 3, type 2 = 3)", () => {
        const pool = poolFor([{difficulty: 1}, {difficulty: 5}, {}]);
        expect(pool[0].difficulty_estimate).toBe(3);
    });

    it("the generated-cloze candidate blends the source card's difficulty too", () => {
        const card = makeCard({id: "c1", front: "merci beaucoup", difficulty: 5});
        const ex = makeExercise({
            id: "ex-1",
            type: "free_text",
            card_ids: ["c1"],
            prompt: "Translate 'thank you very much'",
            accept: ["merci beaucoup"],
        });
        const lessons = new Map([
            ["01-greetings.json", makeLesson("01-greetings.json", [card], [ex])],
        ]);
        const error = makeError("beaucoup", {
            user_answer: "boucoup",
            correct_answer: "beaucoup",
        });
        const errorsByElementKey = new Map([["beaucoup", error]]);
        const pool = buildExercisePool([makePrioritized("beaucoup")], {
            lessons,
            errorsByElementKey,
        });
        const generated = pool.find((c) => c.is_generated);
        // generated cloze heuristic is 2 (select) or 3 (type); blended with
        // the source card's authored 5 both round to 4
        expect(generated?.difficulty_estimate).toBe(4);
    });
});
