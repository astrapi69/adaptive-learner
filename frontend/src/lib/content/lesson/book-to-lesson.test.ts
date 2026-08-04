import {describe, it, expect} from "vitest";

import {
    buildBookLesson,
    buildBookLessons,
    buildBookLessonsUserSetInput,
    buildBookUserSetInput,
    normalizeBook,
    type BookLessonInput,
} from "./book-to-lesson";
import {validateLessonShape} from "../validation/lesson-schema-validator";
import type {LessonMeta} from "./lesson-draft";
import type {ContentLessonExercise} from "../../../storage/types";
import type {TheoryStep} from "../../ai/generation/exercise-generation-prompt";

const META: LessonMeta = {
    title: "Klassische Konditionierung",
    titleNative: "",
    sourceLanguage: "de",
    targetLanguage: "de",
    level: "A1",
    description: "Pawlow und die Reize",
    author: "Asterios",
    domain: "language",
};

const THEORY: TheoryStep[] = [
    {
        id: "theory-1",
        title: "Pawlows Reize",
        body:
            "Ein neutraler Reiz wird durch Kopplung mit einem unbedingten " +
            "Reiz zu einem bedingten Reiz. Diese Reizkonditionierung erklaert " +
            "die bedingte Reaktion.",
    },
    {
        id: "theory-2",
        title: "Banduras Lernen am Modell",
        body:
            "Bandura zeigte, dass Menschen durch Beobachtung eines Modells " +
            "lernen, ganz ohne eigene Verstaerkung.",
    },
];

/** A free-text exercise whose prompt clearly belongs to the Pawlow/Reiz
 *  theory step, not the Bandura one. */
const REIZ_EXERCISE: ContentLessonExercise = {
    id: "ai-ex-1-free-text",
    type: "free_text",
    prompt: "Was wird aus einem neutralen Reiz nach der Kopplung?",
    card_ids: [],
    accept: ["ein bedingter Reiz", "bedingter Reiz"],
    distractors: [],
};

const MODEL_EXERCISE: ContentLessonExercise = {
    id: "ai-ex-2-free-text",
    type: "free_text",
    prompt: "Wie lernen Menschen laut Bandura durch Beobachtung eines Modells?",
    card_ids: [],
    accept: ["am Modell", "Beobachtung"],
    distractors: [],
};

const INPUT: BookLessonInput = {
    meta: META,
    theorySteps: THEORY,
    exercises: [REIZ_EXERCISE, MODEL_EXERCISE],
};

describe("buildBookLesson", () => {
    it("keeps the rephrased theory steps as theory steps in order", () => {
        const lesson = buildBookLesson(INPUT);
        const theorySteps = lesson.steps.filter((s) => s.type === "theory");
        expect(theorySteps.map((s) => s.id)).toEqual(["theory-1", "theory-2"]);
        expect(theorySteps[0].body).toContain("bedingten Reiz");
    });

    it("appends one exercise step per exercise", () => {
        const lesson = buildBookLesson(INPUT);
        const exerciseSteps = lesson.steps.filter((s) => s.type === "exercise");
        expect(exerciseSteps).toHaveLength(2);
        expect(exerciseSteps[0].exercise?.id).toBe("ai-ex-1-free-text");
    });

    it("writes theory_ref linking each exercise to its topical theory step", () => {
        const lesson = buildBookLesson(INPUT);
        const byExId = new Map(
            lesson.steps
                .filter((s) => s.type === "exercise")
                .map((s) => [s.exercise?.id, s]),
        );
        // The Reiz exercise must point at theory-1, the Bandura exercise at
        // theory-2 — the shipped #709 resolver assigns them by text overlap.
        expect(byExId.get("ai-ex-1-free-text")?.theory_ref).toBe("theory-1");
        expect(byExId.get("ai-ex-2-free-text")?.theory_ref).toBe("theory-2");
    });

    it("produces a lesson that passes the structural validator", () => {
        // buildBookLesson calls validateGeneratedLesson internally; a throw
        // here means the book lesson is not schema-valid.
        expect(() => buildBookLesson(INPUT)).not.toThrow();
    });

    it("has no manual cards (the AI exercises are self-contained)", () => {
        const lesson = buildBookLesson(INPUT);
        expect(lesson.cards).toEqual([]);
    });
});

describe("normalizeBook", () => {
    it("returns null when no title is given (no book block)", () => {
        expect(normalizeBook(null)).toBeNull();
        expect(normalizeBook({title: "   "})).toBeNull();
        expect(normalizeBook({author: "X"})).toBeNull();
    });

    it("trims and keeps the optional fields when a title is present", () => {
        const book = normalizeBook({
            title: "  KI fuer Einsteiger  ",
            author: " Asterios Raptis ",
            url: " https://example.com/book ",
            asin: " B0F43H6T2M ",
        });
        expect(book).toEqual({
            title: "KI fuer Einsteiger",
            author: "Asterios Raptis",
            url: "https://example.com/book",
            asin: "B0F43H6T2M",
        });
    });

    it("drops blank optional fields to null", () => {
        const book = normalizeBook({title: "Only Title", author: "  "});
        expect(book).toEqual({
            title: "Only Title",
            author: null,
            url: null,
            asin: null,
        });
    });
});

describe("buildBookUserSetInput", () => {
    it("carries the book block into the set input when present", () => {
        const lesson = buildBookLesson(INPUT);
        const book = normalizeBook({title: "KI fuer Einsteiger", author: "Asterios"});
        const setInput = buildBookUserSetInput(INPUT, lesson, book);
        expect(setInput.book).toEqual({
            title: "KI fuer Einsteiger",
            author: "Asterios",
            url: null,
            asin: null,
        });
        expect(setInput.lessons).toEqual([lesson]);
        expect(setInput.origin).toBe("imported");
        expect(setInput.target_language).toBe("de");
    });

    it("omits the book block (null) when no book title is given", () => {
        const lesson = buildBookLesson(INPUT);
        const setInput = buildBookUserSetInput(INPUT, lesson, null);
        expect(setInput.book).toBeNull();
    });
});

describe("buildBookLessons (batch, #1949)", () => {
    it("builds one lesson per generated entry, in order", () => {
        const lessons = buildBookLessons(META, [
            {title: "Kapitel 1: Reize", theorySteps: THEORY, exercises: [REIZ_EXERCISE]},
            {title: "Kapitel 2: Modelllernen", theorySteps: THEORY, exercises: [MODEL_EXERCISE]},
        ]);
        expect(lessons).toHaveLength(2);
        expect(lessons[0].title).toBe("Kapitel 1: Reize");
        expect(lessons[1].title).toBe("Kapitel 2: Modelllernen");
    });

    it("gives each lesson a unique id even when titles collide", () => {
        const lessons = buildBookLessons(META, [
            {title: "Einführung", theorySteps: THEORY, exercises: [REIZ_EXERCISE]},
            {title: "Einführung", theorySteps: THEORY, exercises: [MODEL_EXERCISE]},
            {title: "", theorySteps: THEORY, exercises: [REIZ_EXERCISE]},
        ]);
        const ids = lessons.map((l) => l.id);
        expect(new Set(ids).size).toBe(3);
    });

    it("produces schema-valid lessons (validator does not throw)", () => {
        expect(() =>
            buildBookLessons(META, [
                {title: "A", theorySteps: THEORY, exercises: [REIZ_EXERCISE]},
                {title: "B", theorySteps: THEORY, exercises: [MODEL_EXERCISE]},
            ]),
        ).not.toThrow();
    });
});

describe("buildBookLessonsUserSetInput (batch, #1949)", () => {
    it("carries all lessons into one set input with the set metadata", () => {
        const lessons = buildBookLessons(META, [
            {title: "Kapitel 1", theorySteps: THEORY, exercises: [REIZ_EXERCISE]},
            {title: "Kapitel 2", theorySteps: THEORY, exercises: [MODEL_EXERCISE]},
        ]);
        const input = buildBookLessonsUserSetInput(META, lessons, null);
        expect(input.lessons).toHaveLength(2);
        expect(input.title).toBe("Klassische Konditionierung");
        expect(input.target_language).toBe("de");
        expect(input.origin).toBe("imported");
        expect(input.book).toBeNull();
    });

    it("carries the book block when present", () => {
        const lessons = buildBookLessons(META, [
            {title: "Kapitel 1", theorySteps: THEORY, exercises: [REIZ_EXERCISE]},
        ]);
        const book = normalizeBook({title: "KI fuer Einsteiger"});
        const input = buildBookLessonsUserSetInput(META, lessons, book);
        expect(input.book?.title).toBe("KI fuer Einsteiger");
    });
});

/** An AI-generated text-extension exercise (#2355): a categorization drill,
 *  the shape `cardsToExercises` emits for an `ext:al-categorization` card. */
const CATEGORIZATION_EXERCISE: ContentLessonExercise = {
    id: "ai-ex-3-ext-al-categorization",
    type: "ext:al-categorization",
    prompt: "Ordne die Begriffe den Kategorien zu.",
    card_ids: [],
    distractors: [],
    ext_payload: {
        categories: [
            {name: "Reize", items: ["neutraler Reiz", "unbedingter Reiz"]},
            {name: "Reaktionen", items: ["bedingte Reaktion"]},
        ],
    },
} as ContentLessonExercise;

describe("buildBookLesson — extension declaration + load guard (#2355)", () => {
    it("declares requires_extensions for a generated ext exercise AND passes the load guard", () => {
        const lesson = buildBookLesson({
            meta: META,
            theorySteps: THEORY,
            exercises: [REIZ_EXERCISE, CATEGORIZATION_EXERCISE],
        });
        expect(lesson.requires_extensions).toContain("ext:al-categorization@1");
        // The critical assertion: the full load guard (schema + declaration
        // consistency) accepts the generated lesson. A generated ext exercise
        // WITHOUT the declaration would be refused here (undeclaredExtensionErrors).
        const shape = validateLessonShape(lesson);
        expect(shape.errors).toEqual([]);
        expect(shape.ok).toBe(true);
    });

    it("does NOT declare requires_extensions for a core-only lesson", () => {
        const lesson = buildBookLesson(INPUT);
        expect(lesson.requires_extensions ?? []).toEqual([]);
        expect(validateLessonShape(lesson).ok).toBe(true);
    });
});
