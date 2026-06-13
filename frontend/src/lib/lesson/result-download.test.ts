/**
 * Pins the result-download orchestration (#354): the Markdown/JSON
 * export composers produce exactly what the underlying pure builders
 * in ``result-export.ts`` produce, with the ISO-8601 date + filename
 * derived from the injected ``now``.
 */

import {describe, expect, it} from "vitest";

import {
    buildLessonJsonExport,
    buildLessonMarkdownExport,
} from "./result-download";
import {
    buildLessonResultJson,
    buildLessonResultMarkdown,
    collectWeakAreas,
    lessonResultFilename,
    type LessonResultLabels,
} from "./result-export";
import type {ContentLesson} from "../../storage/types";

const LESSON: ContentLesson = {
    id: "01",
    title: "Greetings",
    description: "",
    estimated_minutes: 5,
    cards: [{id: "c1", front: "hello", back: "hola", tags: ["a1"]}],
    steps: [
        {id: "intro", type: "theory", title: "Intro", body: "..."},
        {
            id: "ex-free",
            type: "exercise",
            title: "Say hello",
            exercise: {
                id: "ex-free",
                type: "free_text",
                prompt: "Translate 'hello'",
                card_ids: ["c1"],
                accept: ["hola"],
                distractors: [],
            },
        },
    ],
};

const LABELS: LessonResultLabels = {
    title: "Lesson result",
    date: "Date",
    score: "Score",
    correctWord: "correct",
    mistakesHeading: "Mistakes",
    noMistakes: "No mistakes - perfect run!",
    question: "Question",
    yourAnswer: "Your answer",
    noAnswer: "(none)",
    correctAnswer: "Correct",
    weakAreasHeading: "Weak areas",
};

const NOW = new Date("2026-06-12T18:30:00Z");

describe("buildLessonMarkdownExport", () => {
    it("matches the underlying builder + ISO filename", () => {
        const {markdown, filename} = buildLessonMarkdownExport({
            lesson: LESSON,
            correct: 1,
            total: 1,
            pct: 100,
            sessionErrors: [],
            breakdown: [],
            labels: LABELS,
            now: NOW,
        });
        expect(markdown).toBe(
            buildLessonResultMarkdown({
                lessonTitle: LESSON.title,
                dateStr: "2026-06-12",
                correct: 1,
                total: 1,
                pct: 100,
                breakdown: [],
                weakAreas: collectWeakAreas([]),
                labels: LABELS,
            }),
        );
        expect(filename).toBe(lessonResultFilename(LESSON.title, NOW));
        expect(filename).toContain("2026-06-12");
    });
});

describe("buildLessonJsonExport", () => {
    it("matches the underlying builder, pretty-printed, with .json filename", () => {
        const {json, filename} = buildLessonJsonExport({
            lesson: LESSON,
            progress: null,
            correct: 1,
            total: 1,
            pct: 100,
            sessionErrors: [],
            now: NOW,
        });
        const expected = buildLessonResultJson({
            lesson: LESSON,
            progress: null,
            dateStr: "2026-06-12",
            correct: 1,
            total: 1,
            pct: 100,
            weakAreas: collectWeakAreas([]),
        });
        expect(JSON.parse(json)).toEqual(expected);
        expect(json).toBe(JSON.stringify(expected, null, 2));
        expect(filename).toBe(lessonResultFilename(LESSON.title, NOW, "json"));
        expect(filename.endsWith(".json")).toBe(true);
    });
});
