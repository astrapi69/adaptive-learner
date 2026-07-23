/**
 * End-to-end adaptive-pipeline regression guard (#1668).
 *
 * Wires the exact synthesis the ``useAdaptiveLesson`` hook runs —
 * ``analyzeErrors`` → ``buildExercisePool`` → ``generateAdaptiveLesson`` —
 * against a lesson shaped like *Die Währung des Geistes* (`03-zeit.json`,
 * card ``sinnkrise`` whose ``front`` IS the answer). Before the #1668 fix the
 * shape-changed candidate for such an element collapsed to a context-free
 * ``"___"`` cloze, which the adaptive lesson then served as an unsolvable,
 * hint-only step. This test asserts the whole pipeline never emits such a
 * step, and that a healthy (phrase-front) element still yields a real cloze —
 * the automated proxy for the on-device Dexie check.
 */

import {describe, expect, it} from "vitest";

import {analyzeErrors} from "./error-analyzer";
import {buildExercisePool} from "./exercise-pool";
import {generateAdaptiveLesson} from "./lesson-generator";
import type {
    ContentLesson,
    ContentLessonExercise,
    ElementError,
} from "../../storage/types";

const NOW = "2026-07-15T00:00:00.000Z";

function error(overrides: Partial<ElementError> & {element_key: string}): ElementError {
    return {
        id: `err-${overrides.element_key}`,
        user_id: "user-1",
        set_id: "waehrung-des-geistes",
        lesson_id: "03-zeit.json",
        exercise_id: "ex-1",
        direction: "target_to_source",
        element_type: "vocabulary",
        user_answer: "x",
        correct_answer: overrides.element_key,
        error_count: 2,
        correct_streak: 0,
        last_error_at: NOW,
        last_attempt_at: NOW,
        mastered: false,
        mastered_at: null,
        created_at: NOW,
        updated_at: NOW,
        ...overrides,
    };
}

/** The real content shape: card ``front === answer`` (the degenerate case)
 *  plus a phrase-front card (the healthy case that must keep working). */
function lesson(): ContentLesson {
    const exSinnkrise: ContentLessonExercise = {
        id: "e-sinnkrise",
        type: "cloze",
        cloze_mode: "select",
        prompt: "Als was gilt die moderne Zeitarmut?",
        sentence: "Die moderne Zeitarmut ist keine Zeitkrise, sondern eine ___.",
        blanks: [{accept: ["Sinnkrise"]}],
        distractors: ["Geldkrise", "Energiekrise"],
        card_ids: ["sinnkrise"],
    };
    const exVerletzlichkeit: ContentLessonExercise = {
        id: "e-verletzlichkeit",
        type: "free_text",
        prompt: "Vertrauen ist keine Kontrolle, sondern freiwillige ___? (ein Wort)",
        card_ids: ["verletzlichkeit"],
        accept: ["Freiwillige Verletzlichkeit"],
        distractors: ["Sicherheit", "Gewissheit"],
    };
    return {
        id: "03-zeit.json",
        title: "Zeit",
        description: null,
        estimated_minutes: 10,
        cards: [
            // front === answer → blanking collapses to a bare "___".
            {id: "sinnkrise", front: "Sinnkrise", back: "…", tags: []},
            // phrase front → blanking keeps context ("Freiwillige ___").
            {
                id: "verletzlichkeit",
                front: "Freiwillige Verletzlichkeit",
                back: "…",
                tags: [],
            },
        ],
        steps: [
            {id: "s1", type: "theory", title: "T", body: "Theorie."},
            {id: "s2", type: "exercise", title: null, exercise: exSinnkrise},
            {
                id: "s3",
                type: "exercise",
                title: null,
                exercise: exVerletzlichkeit,
            },
        ],
    };
}

/** A cloze whose sentence has no letter/digit besides the marker — the
 *  unsolvable, hint-only shape #1668 removed. */
function isContextFreeCloze(
    exercise: ContentLessonExercise | null | undefined,
): boolean {
    if (!exercise || exercise.type !== "cloze") return false;
    const sentence = exercise.sentence ?? "";
    return !/[\p{L}\p{N}]/u.test(sentence.replace("___", ""));
}

describe("adaptive pipeline — no context-free cloze reaches the lesson (#1668)", () => {
    const lessons = new Map<string, ContentLesson>([["03-zeit.json", lesson()]]);
    const errors: ElementError[] = [
        error({
            element_key: "Sinnkrise",
            exercise_id: "e-sinnkrise",
            correct_answer: "Sinnkrise",
        }),
        error({
            element_key: "Freiwillige Verletzlichkeit",
            exercise_id: "e-verletzlichkeit",
            correct_answer: "Verletzlichkeit",
        }),
    ];
    const errorsByElementKey = new Map(errors.map((e) => [e.element_key, e]));

    function generate() {
        const analysis = analyzeErrors(errors, {now: NOW});
        const pool = buildExercisePool(analysis.prioritized_elements, {
            lessons,
            errorsByElementKey,
        });
        return generateAdaptiveLesson(analysis, pool, {
            lessons,
            title: "Adaptive Lektion",
            set_id: "waehrung-des-geistes",
            now: NOW,
            errorsByElementKey,
            elementErrors: errors,
        });
    }

    it("emits no bare '___' cloze step for a front-is-answer element", () => {
        const generated = generate();
        const offenders = generated.steps.filter((s) =>
            isContextFreeCloze(s.exercise),
        );
        expect(offenders).toHaveLength(0);
    });

    it("still produces a solvable lesson (real cloze survives for phrase fronts)", () => {
        const generated = generate();
        const clozes = generated.steps
            .map((s) => s.exercise)
            .filter((e): e is ContentLessonExercise => e?.type === "cloze");
        // The healthy element yields a context-bearing cloze ("Freiwillige ___").
        expect(clozes.some((c) => (c.sentence ?? "").includes("Freiwillige"))).toBe(
            true,
        );
        // And every cloze that made it in carries real context.
        expect(clozes.every((c) => !isContextFreeCloze(c))).toBe(true);
    });
});
