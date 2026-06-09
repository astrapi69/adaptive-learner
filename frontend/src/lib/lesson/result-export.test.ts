import {describe, it, expect} from "vitest";

import type {ElementError} from "../../storage/types";
import type {ExerciseBreakdownEntry} from "../lesson-summary";
import {
    buildLessonResultMarkdown,
    collectWeakAreas,
    lessonResultFilename,
    type LessonResultLabels,
} from "./result-export";

const LABELS: LessonResultLabels = {
    title: "Lesson result",
    date: "Date",
    score: "Score",
    correctWord: "correct",
    mistakesHeading: "Mistakes",
    noMistakes: "No mistakes - perfect run!",
    question: "Question",
    yourAnswer: "Your answer",
    correctAnswer: "Correct",
    weakAreasHeading: "Weak areas",
};

function entry(over: Partial<ExerciseBreakdownEntry>): ExerciseBreakdownEntry {
    return {
        stepId: "s1",
        title: "Translate 'hello'",
        exerciseType: "free_text",
        attempted: true,
        correct: 0,
        total: 1,
        fullyCorrect: false,
        canonicalAnswer: "hola",
        userAnswer: "ola",
        ...over,
    };
}

function elementError(over: Partial<ElementError>): ElementError {
    return {
        id: "e1",
        user_id: "u1",
        set_id: "set",
        lesson_id: "01.json",
        exercise_id: "ex1",
        element_key: "k1",
        element_type: "vocabulary",
        user_answer: "ola",
        correct_answer: "hola",
        error_count: 2,
        correct_streak: 0,
        last_error_at: null,
        last_attempt_at: "2026-06-09",
        mastered: false,
        mastered_at: null,
        created_at: "2026-06-09",
        updated_at: "2026-06-09",
        ...over,
    } as ElementError;
}

describe("buildLessonResultMarkdown", () => {
    it("renders header, mistakes with your/correct answer, and weak areas", () => {
        const md = buildLessonResultMarkdown({
            lessonTitle: "Greetings",
            dateStr: "2026-06-09",
            correct: 4,
            total: 6,
            pct: 67,
            breakdown: [
                entry({}),
                entry({
                    stepId: "s2",
                    fullyCorrect: true,
                    correct: 1,
                    title: "ok one",
                }),
            ],
            weakAreas: [{label: "hola", count: 2}],
            labels: LABELS,
        });
        expect(md).toContain("# Lesson result: Greetings");
        expect(md).toContain("Date: 2026-06-09");
        expect(md).toContain("Score: 4/6 correct (67%)");
        expect(md).toContain("## Mistakes");
        expect(md).toContain("- Question: Translate 'hello'");
        expect(md).toContain("  Your answer: ola");
        expect(md).toContain("  Correct: hola");
        // The fully-correct step is not listed as a mistake.
        expect(md).not.toContain("ok one");
        expect(md).toContain("## Weak areas");
        expect(md).toContain("- hola (2x)");
    });

    it("omits 'Your answer' when no text answer was recorded", () => {
        const md = buildLessonResultMarkdown({
            lessonTitle: "L",
            dateStr: "d",
            correct: 0,
            total: 1,
            pct: 0,
            breakdown: [
                entry({exerciseType: "matching", userAnswer: null}),
            ],
            weakAreas: [],
            labels: LABELS,
        });
        expect(md).not.toContain("Your answer");
        expect(md).toContain("Correct: hola");
    });

    it("shows the no-mistakes line on a perfect run and omits empty weak areas", () => {
        const md = buildLessonResultMarkdown({
            lessonTitle: "L",
            dateStr: "d",
            correct: 3,
            total: 3,
            pct: 100,
            breakdown: [entry({fullyCorrect: true, correct: 1})],
            weakAreas: [],
            labels: LABELS,
        });
        expect(md).toContain("- No mistakes - perfect run!");
        expect(md).not.toContain("## Weak areas");
    });
});

describe("collectWeakAreas", () => {
    it("dedupes by element_key, drops mastered rows, sorts by count desc", () => {
        const areas = collectWeakAreas([
            elementError({element_key: "k1", correct_answer: "hola", error_count: 2}),
            elementError({element_key: "k1", correct_answer: "hola", error_count: 5}),
            elementError({element_key: "k2", correct_answer: "adios", error_count: 3}),
            elementError({element_key: "k3", correct_answer: "si", mastered: true}),
        ]);
        expect(areas).toEqual([
            {label: "hola", count: 5},
            {label: "adios", count: 3},
        ]);
    });

    it("falls back to element_key when correct_answer is empty", () => {
        const areas = collectWeakAreas([
            elementError({element_key: "word-42", correct_answer: ""}),
        ]);
        expect(areas[0].label).toBe("word-42");
    });
});

describe("lessonResultFilename", () => {
    it("produces an ASCII, dated, slugified filename", () => {
        const name = lessonResultFilename(
            "Grüße & Höflichkeit",
            new Date("2026-06-09T10:00:00Z"),
        );
        expect(name).toBe("lesson-result-grusse-hoflichkeit-2026-06-09.md");
    });
});
