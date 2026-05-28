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
