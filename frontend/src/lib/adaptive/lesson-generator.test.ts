/**
 * Tests for the rule-based adaptive lesson generator
 * (Phase 53C / v1.36.0 / Q-115, Q-116).
 */

import {describe, expect, it} from "vitest";

import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonExercise,
    ContentLessonStep,
} from "../../storage/types";

import type {ExerciseCandidate} from "./exercise-pool";
import {
    DEFAULT_GENERATOR_CONFIG,
    generateAdaptiveLesson,
} from "./lesson-generator";
import type {ErrorAnalysis, ErrorCluster, PrioritizedElement} from "./types";

const NOW = "2026-05-28T12:00:00Z";

function makeExercise(
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: overrides.id ?? "ex-1",
        type: overrides.type ?? "matching",
        prompt: overrides.prompt ?? "Match",
        card_ids: overrides.card_ids ?? ["c1"],
        pairs: null,
        images: null,
        accept: null,
        tiles: null,
        accept_orderings: null,
        distractors: [],
        hint: null,
        sentence: null,
        blanks: null,
        cloze_mode: null,
    };
}

function makeCandidate(
    overrides: Partial<ExerciseCandidate> & {
        element_key: string;
        exercise_id: string;
    } & Partial<{
        exercise_type: ContentLessonExercise["type"];
        difficulty: 1 | 2 | 3 | 4 | 5;
        is_generated: boolean;
        lesson_id: string;
    }>,
): ExerciseCandidate {
    const exType = overrides.exercise_type ?? "matching";
    return {
        exercise: makeExercise({id: overrides.exercise_id, type: exType}),
        source_set_id: overrides.source_set_id ?? "",
        source_lesson_id: overrides.lesson_id ?? "01.json",
        element_key: overrides.element_key,
        exercise_type: exType,
        difficulty_estimate: overrides.difficulty ?? 3,
        is_generated: overrides.is_generated ?? false,
    };
}

function makePrioritized(
    element_key: string,
    overrides: Partial<PrioritizedElement> = {},
): PrioritizedElement {
    return {
        element_key,
        set_id: overrides.set_id ?? "language-fr-a1",
        lesson_id: overrides.lesson_id ?? "01.json",
        exercise_id: overrides.exercise_id ?? "ex-1",
        element_type: overrides.element_type ?? "vocabulary",
        error_count: overrides.error_count ?? 2,
        correct_streak: 0,
        last_error_at: NOW,
        last_attempt_at: NOW,
        user_answer: "x",
        correct_answer: element_key,
        recency_weight: 1.0,
        priority_score: overrides.priority_score ?? 2,
    };
}

function emptyAnalysis(): ErrorAnalysis {
    return {
        prioritized_elements: [],
        error_clusters: [],
        weakness_profile: {},
        suggested_focus: [],
        total_errors: 0,
        active_elements: 0,
    };
}

function analysisFor(
    elements: PrioritizedElement[],
    clusters: ErrorCluster[] = [],
): ErrorAnalysis {
    return {
        prioritized_elements: elements,
        error_clusters: clusters,
        weakness_profile: {},
        suggested_focus: elements.slice(0, 3),
        total_errors: elements.reduce((s, e) => s + e.error_count, 0),
        active_elements: elements.length,
    };
}

function makeTheoryStep(id: string, body: string): ContentLessonStep {
    return {
        id,
        type: "theory",
        title: "Theory",
        body,
        exercise: null,
    };
}

function makeLessonWithTheory(
    id: string,
    theoryBody: string,
    cards: ContentLessonCard[] = [],
): ContentLesson {
    return {
        id,
        title: `Lesson ${id}`,
        description: null,
        estimated_minutes: 5,
        cards,
        steps: [makeTheoryStep(`theory-${id}`, theoryBody)],
    };
}

describe("generateAdaptiveLesson — empty cases (Q-116)", () => {
    it("produces a lesson with zero steps when analysis is empty", () => {
        const lesson = generateAdaptiveLesson(emptyAnalysis(), [], {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
        });
        expect(lesson.steps).toEqual([]);
        expect(lesson.title).toBe("Adaptive");
        expect(lesson.id).toBe(`adaptive-S-${NOW}`);
    });

    it("produces zero steps when pool is empty even with priorities", () => {
        const analysis = analysisFor([makePrioritized("merci")]);
        const lesson = generateAdaptiveLesson(analysis, [], {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
        });
        expect(lesson.steps).toEqual([]);
    });

    it("uses estimated_minutes derived from step count", () => {
        const lesson = generateAdaptiveLesson(emptyAnalysis(), [], {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
        });
        // Empty → 0 steps → floor(0/2) = 0, clamped to 1.
        expect(lesson.estimated_minutes).toBe(1);
    });
});

describe("generateAdaptiveLesson — basic selection (Q-115)", () => {
    it("picks exercises that target the prioritized elements", () => {
        const analysis = analysisFor([
            makePrioritized("merci"),
            makePrioritized("bonjour"),
        ]);
        const pool: ExerciseCandidate[] = [
            makeCandidate({element_key: "merci", exercise_id: "ex-merci"}),
            makeCandidate({element_key: "bonjour", exercise_id: "ex-bonjour"}),
        ];
        const lesson = generateAdaptiveLesson(analysis, pool, {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
        });
        const stepExerciseIds = lesson.steps
            .filter((s) => s.type === "exercise")
            .map((s) => s.exercise?.id);
        expect(stepExerciseIds).toEqual(
            expect.arrayContaining(["ex-merci", "ex-bonjour"]),
        );
    });

    it("respects max_exercises cap", () => {
        const analysis = analysisFor([makePrioritized("merci")]);
        const pool: ExerciseCandidate[] = Array.from({length: 10}, (_, i) =>
            makeCandidate({
                element_key: "merci",
                exercise_id: `ex-${i}`,
            }),
        );
        const lesson = generateAdaptiveLesson(analysis, pool, {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
            config: {max_exercises: 3},
        });
        const exerciseSteps = lesson.steps.filter((s) => s.type === "exercise");
        expect(exerciseSteps).toHaveLength(3);
    });
});

describe("generateAdaptiveLesson — type mix (Q-115)", () => {
    it("favors types with the largest deficit against targets", () => {
        // Mix says 50% free_text, 50% matching. Pool has BOTH
        // types available for each element — generator should
        // pick one of each across two exercises.
        const analysis = analysisFor([makePrioritized("merci")]);
        const pool: ExerciseCandidate[] = [
            makeCandidate({
                element_key: "merci",
                exercise_id: "ex-mat",
                exercise_type: "matching",
            }),
            makeCandidate({
                element_key: "merci",
                exercise_id: "ex-ft",
                exercise_type: "free_text",
            }),
        ];
        const lesson = generateAdaptiveLesson(analysis, pool, {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
            config: {
                max_exercises: 2,
                exercise_type_mix: {
                    matching: 0.5,
                    picture_choice: 0,
                    free_text: 0.5,
                    word_tiles: 0,
                    cloze: 0,
                },
                difficulty_curve: "mixed",
                variation_factor: 0.7,
            },
        });
        const types = lesson.steps
            .filter((s) => s.type === "exercise")
            .map((s) => s.exercise?.type)
            .sort();
        expect(types).toEqual(["free_text", "matching"]);
    });

    it("approximately matches type-mix weights over a longer lesson", () => {
        // Build a pool with abundant candidates of EVERY type
        // for each of 3 elements, then assert the final
        // distribution roughly tracks the default config mix.
        const analysis = analysisFor([
            makePrioritized("e1"),
            makePrioritized("e2"),
            makePrioritized("e3"),
        ]);
        const types: ContentLessonExercise["type"][] = [
            "matching",
            "picture_choice",
            "free_text",
            "word_tiles",
            "cloze",
        ];
        const pool: ExerciseCandidate[] = [];
        for (const element of ["e1", "e2", "e3"]) {
            for (const type of types) {
                for (let i = 0; i < 3; i++) {
                    pool.push(
                        makeCandidate({
                            element_key: element,
                            exercise_id: `${element}-${type}-${i}`,
                            exercise_type: type,
                        }),
                    );
                }
            }
        }
        const lesson = generateAdaptiveLesson(analysis, pool, {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
            config: {...DEFAULT_GENERATOR_CONFIG, difficulty_curve: "mixed"},
        });
        const exerciseSteps = lesson.steps.filter((s) => s.type === "exercise");
        expect(exerciseSteps).toHaveLength(10);
        const typeCounts: Record<string, number> = {};
        for (const step of exerciseSteps) {
            const t = step.exercise!.type;
            typeCounts[t] = (typeCounts[t] ?? 0) + 1;
        }
        // Default mix × 10 = matching:2, picture_choice:1,
        // free_text:3, word_tiles:2, cloze:2. The mix-deficit
        // algorithm should land within ±1 of each.
        expect(typeCounts.matching).toBeGreaterThanOrEqual(1);
        expect(typeCounts.free_text).toBeGreaterThanOrEqual(2);
        expect(typeCounts.cloze).toBeGreaterThanOrEqual(1);
    });
});

describe("generateAdaptiveLesson — difficulty curves", () => {
    it("ascending sorts by difficulty asc", () => {
        const analysis = analysisFor([
            makePrioritized("e1"),
            makePrioritized("e2"),
        ]);
        const pool: ExerciseCandidate[] = [
            makeCandidate({
                element_key: "e1",
                exercise_id: "hard",
                difficulty: 4,
                exercise_type: "free_text",
            }),
            makeCandidate({
                element_key: "e2",
                exercise_id: "easy",
                difficulty: 1,
                exercise_type: "picture_choice",
            }),
        ];
        const lesson = generateAdaptiveLesson(analysis, pool, {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
            config: {difficulty_curve: "ascending"},
        });
        const exerciseIds = lesson.steps
            .filter((s) => s.type === "exercise")
            .map((s) => s.exercise!.id);
        expect(exerciseIds[0]).toBe("easy");
        expect(exerciseIds[1]).toBe("hard");
    });

    it("descending sorts by difficulty desc", () => {
        const analysis = analysisFor([
            makePrioritized("e1"),
            makePrioritized("e2"),
        ]);
        const pool: ExerciseCandidate[] = [
            makeCandidate({
                element_key: "e1",
                exercise_id: "hard",
                difficulty: 4,
                exercise_type: "free_text",
            }),
            makeCandidate({
                element_key: "e2",
                exercise_id: "easy",
                difficulty: 1,
                exercise_type: "picture_choice",
            }),
        ];
        const lesson = generateAdaptiveLesson(analysis, pool, {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
            config: {difficulty_curve: "descending"},
        });
        const exerciseIds = lesson.steps
            .filter((s) => s.type === "exercise")
            .map((s) => s.exercise!.id);
        expect(exerciseIds[0]).toBe("hard");
        expect(exerciseIds[1]).toBe("easy");
    });
});

describe("generateAdaptiveLesson — theory step from clusters", () => {
    it("prepends a theory step from a lesson cluster's source", () => {
        const analysis = analysisFor(
            [makePrioritized("le"), makePrioritized("la")],
            [
                {
                    cluster_type: "lesson",
                    key: "03-articles.json",
                    element_keys: ["le", "la"],
                    error_count_total: 5,
                },
            ],
        );
        const lessons = new Map<string, ContentLesson>([
            [
                "03-articles.json",
                makeLessonWithTheory("03-articles.json", "French articles: le / la / les"),
            ],
        ]);
        const pool: ExerciseCandidate[] = [
            makeCandidate({element_key: "le", exercise_id: "ex-le"}),
            makeCandidate({element_key: "la", exercise_id: "ex-la"}),
        ];
        const lesson = generateAdaptiveLesson(analysis, pool, {
            lessons,
            title: "Adaptive: Articles",
            set_id: "language-fr-a1",
            now: NOW,
        });
        expect(lesson.steps[0].type).toBe("theory");
        expect(lesson.steps[0].body).toBe("French articles: le / la / les");
    });

    it("no theory step when clusters exist but source lessons aren't cached", () => {
        const analysis = analysisFor(
            [makePrioritized("le")],
            [
                {
                    cluster_type: "lesson",
                    key: "03-articles.json",
                    element_keys: ["le"],
                    error_count_total: 3,
                },
            ],
        );
        const pool: ExerciseCandidate[] = [
            makeCandidate({element_key: "le", exercise_id: "ex-le"}),
        ];
        const lesson = generateAdaptiveLesson(analysis, pool, {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
        });
        expect(lesson.steps.find((s) => s.type === "theory")).toBeUndefined();
    });
});

describe("generateAdaptiveLesson — determinism", () => {
    it("same inputs produce same output", () => {
        const analysis = analysisFor([
            makePrioritized("e1"),
            makePrioritized("e2"),
        ]);
        const pool: ExerciseCandidate[] = [
            makeCandidate({
                element_key: "e1",
                exercise_id: "ex-a",
                exercise_type: "matching",
            }),
            makeCandidate({
                element_key: "e1",
                exercise_id: "ex-b",
                exercise_type: "free_text",
            }),
            makeCandidate({
                element_key: "e2",
                exercise_id: "ex-c",
                exercise_type: "cloze",
            }),
        ];
        const opts = {
            lessons: new Map(),
            title: "Adaptive",
            set_id: "S",
            now: NOW,
        };
        const l1 = generateAdaptiveLesson(analysis, pool, opts);
        const l2 = generateAdaptiveLesson(analysis, pool, opts);
        expect(l1.id).toBe(l2.id);
        expect(l1.steps.map((s) => s.id)).toEqual(l2.steps.map((s) => s.id));
    });
});
