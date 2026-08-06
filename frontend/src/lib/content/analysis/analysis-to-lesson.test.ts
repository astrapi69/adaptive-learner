import { describe, it, expect } from "vitest";

import {
  cefrFromAnalysisLevel,
  detectTargetLanguage,
  generateLessonFromAnalysis,
  isSaveableLesson,
  isShareableLesson,
  summarizeGeneratedLesson,
  validateGeneratedLesson,
  slugify,
  DEFAULT_ANALYSIS_LESSON_LABELS,
} from "./analysis-to-lesson";
import type { ConversationAnalysisResult } from "../../../types/domain";

const RICH: ConversationAnalysisResult = {
  topic: "Spanish travel vocabulary",
  user_level: "beginner",
  summary: "A conversation about ordering food and asking directions.",
  recommended_focus: "Article gender agreement",
  subtopics: ["Restaurant", "Directions"],
  strengths: ["Good greeting vocabulary", "Confident with numbers"],
  weaknesses: ["Mixes up ser and estar"],
  error_patterns: ["Wrong article gender", "Missing accents"],
  suggested_curriculum: [
    {
      title: "Order in a cafe",
      description: "Practice cafe phrases.",
      priority: 1,
    },
    { title: "Ask for directions", description: "Where is ...?", priority: 2 },
  ],
  vocabulary: [
    {
      word: "la cuenta",
      translation: "the bill",
      example: "La cuenta, por favor.",
    },
    {
      word: "el agua",
      translation: "the water",
      example: "Quiero el agua fria.",
    },
    {
      word: "la calle",
      translation: "the street",
      example: "La calle esta cerca.",
    },
    { word: "izquierda", translation: "left", example: "Gira a la izquierda." },
    { word: "derecha", translation: "right", example: "La derecha" },
    {
      word: "gracias",
      translation: "thank you",
      tags: ["Polite Phrase", "basics"],
    },
  ],
};

describe("generateLessonFromAnalysis", () => {
  it("produces a schema-valid lesson (validator does not throw)", () => {
    const lesson = generateLessonFromAnalysis(RICH, { id: "conv-1" });
    // generate already calls validateGeneratedLesson; re-run to be explicit.
    expect(() => validateGeneratedLesson(lesson)).not.toThrow();
    expect(lesson.title).toBe("Spanish travel vocabulary");
    expect(lesson.id).toBe("conv-1");
    expect(lesson.estimated_minutes).toBeGreaterThanOrEqual(1);
    expect(lesson.steps.length).toBeGreaterThan(0);
  });

  it("is deterministic: same analysis -> identical lesson", () => {
    const a = generateLessonFromAnalysis(RICH, { id: "conv-1" });
    const b = generateLessonFromAnalysis(RICH, { id: "conv-1" });
    expect(a).toEqual(b);
  });

  it("derives a slug-safe id from the topic when none is given", () => {
    const lesson = generateLessonFromAnalysis(RICH);
    expect(lesson.id).toBe("analysis-spanish-travel-vocabulary");
  });

  it("builds the theory steps from the real analysis fields", () => {
    const lesson = generateLessonFromAnalysis(RICH, { id: "c" });
    const theoryIds = lesson.steps
      .filter((s) => s.type === "theory")
      .map((s) => s.id);
    expect(theoryIds).toContain("theory-overview");
    expect(theoryIds).toContain("theory-plan-0");
    expect(theoryIds).toContain("theory-plan-1");
    expect(theoryIds).toContain("theory-topics");
    expect(theoryIds).toContain("theory-strengths");
    expect(theoryIds).toContain("theory-weaknesses");
    expect(theoryIds).toContain("theory-errors");
    // Overview embeds summary + focus.
    const overview = lesson.steps.find((s) => s.id === "theory-overview");
    expect(overview?.body).toContain("ordering food");
    expect(overview?.body).toContain("Article gender agreement");
  });

  it("generates a mix of exercise types from vocabulary", () => {
    const lesson = generateLessonFromAnalysis(RICH, { id: "c" });
    const summary = summarizeGeneratedLesson(lesson);
    expect(summary.exercises).toBeGreaterThan(0);
    // Rich vocab (with examples) yields all four exercise types.
    expect(summary.exerciseTypeCounts.matching).toBeGreaterThan(0);
    expect(summary.exerciseTypeCounts.free_text).toBeGreaterThan(0);
    expect(summary.exerciseTypeCounts.cloze).toBeGreaterThan(0);
    expect(summary.exerciseTypeCounts.word_tiles).toBeGreaterThan(0);
  });

  it("orders exercises easy -> hard (matching before word_tiles)", () => {
    const lesson = generateLessonFromAnalysis(RICH, { id: "c" });
    const exTypes = lesson.steps
      .filter((s) => s.type === "exercise")
      .map((s) => s.exercise!.type);
    const firstMatching = exTypes.indexOf("matching");
    const firstTiles = exTypes.indexOf("word_tiles");
    expect(firstMatching).toBeGreaterThanOrEqual(0);
    if (firstTiles !== -1) expect(firstMatching).toBeLessThan(firstTiles);
  });

  it("only builds cloze/word_tiles from entries that have an example", () => {
    const lesson = generateLessonFromAnalysis(RICH, { id: "c" });
    // "derecha" example "La derecha" is one word after blanking? It
    // has 2 tokens so word_tiles is valid; "gracias" has no example.
    const cloze = lesson.steps.filter((s) => s.exercise?.type === "cloze");
    for (const step of cloze) {
      expect(step.exercise!.sentence).toContain("___");
      expect(step.exercise!.sentence!.match(/___/g)!.length).toBe(
        step.exercise!.blanks!.length,
      );
    }
    // The example-less "gracias" (index 5) gets no cloze/tiles.
    const ids = lesson.steps.map((s) => s.exercise?.id ?? "");
    expect(ids).not.toContain("ex-cloze-5");
    expect(ids).not.toContain("ex-tiles-5");
  });

  it("free_text accepts the translation (case variants)", () => {
    const lesson = generateLessonFromAnalysis(RICH, { id: "c" });
    const free = lesson.steps.find((s) => s.exercise?.type === "free_text");
    expect(free?.exercise!.accept).toContain("the bill");
    expect(free?.exercise!.prompt).toContain("la cuenta");
  });

  it("respects maxExercises", () => {
    const lesson = generateLessonFromAnalysis(RICH, {
      id: "c",
      config: { maxExercises: 3 },
    });
    expect(summarizeGeneratedLesson(lesson).exercises).toBe(3);
  });

  it("slugifies card tags and drops unsluggable ones", () => {
    const lesson = generateLessonFromAnalysis(RICH, { id: "c" });
    const graciasCard = lesson.cards.find((c) => c.back === "thank you");
    expect(graciasCard?.tags).toEqual(["polite-phrase", "basics"]);
  });

  it("falls back to a theory-only lesson when vocabulary is too small", () => {
    const thin: ConversationAnalysisResult = {
      topic: "Tiny chat",
      summary: "Short.",
      vocabulary: [
        { word: "hola", translation: "hi" },
        { word: "adios", translation: "bye" },
      ],
    };
    const lesson = generateLessonFromAnalysis(thin, { id: "thin" });
    const summary = summarizeGeneratedLesson(lesson);
    expect(summary.theoryOnly).toBe(true);
    expect(summary.exercises).toBe(0);
    expect(lesson.steps.length).toBeGreaterThanOrEqual(1);
    expect(() => validateGeneratedLesson(lesson)).not.toThrow();
  });

  it("handles a minimal analysis (topic + summary only)", () => {
    const minimal: ConversationAnalysisResult = {
      topic: "Just a topic",
      summary: "Only a summary, no vocabulary.",
    };
    const lesson = generateLessonFromAnalysis(minimal, { id: "m" });
    expect(summarizeGeneratedLesson(lesson).theoryOnly).toBe(true);
    expect(lesson.steps[0].id).toBe("theory-overview");
    expect(() => validateGeneratedLesson(lesson)).not.toThrow();
  });

  it("handles an empty analysis without throwing", () => {
    const lesson = generateLessonFromAnalysis({}, { id: "e" });
    expect(lesson.title).toBe(DEFAULT_ANALYSIS_LESSON_LABELS.fallbackTitle);
    expect(lesson.steps.length).toBeGreaterThanOrEqual(1);
    expect(() => validateGeneratedLesson(lesson)).not.toThrow();
  });
});

describe("validateGeneratedLesson", () => {
  it("rejects a non-slug lesson id", () => {
    expect(() =>
      validateGeneratedLesson({
        id: "Not Slug",
        title: "x",
        description: null,
        estimated_minutes: 1,
        cards: [],
        steps: [{ id: "theory-overview", type: "theory", body: "hi" }],
      }),
    ).toThrow(/slug-safe|must match pattern/);
  });

  it("rejects a theory step without a body", () => {
    expect(() =>
      validateGeneratedLesson({
        id: "ok",
        title: "x",
        description: null,
        estimated_minutes: 1,
        cards: [],
        steps: [{ id: "theory-overview", type: "theory", body: null }],
      }),
    ).toThrow(/needs a body/);
  });

  it("rejects an exercise referencing a missing card", () => {
    expect(() =>
      validateGeneratedLesson({
        id: "ok",
        title: "x",
        description: null,
        estimated_minutes: 1,
        cards: [],
        steps: [
          {
            id: "step-ex-0",
            type: "exercise",
            body: null,
            exercise: {
              id: "ex-free-0",
              type: "free_text",
              prompt: "Translate: x",
              card_ids: ["missing-card"],
              accept: ["y"],
              distractors: [],
            },
          },
        ],
      }),
    ).toThrow(/missing card/);
  });
});

describe("slugify", () => {
  it("strips accents and lowercases", () => {
    expect(slugify("Se présenter")).toBe("se-presenter");
  });
  it("collapses non-alphanumerics and trims hyphens", () => {
    expect(slugify("  Hello,  World!! ")).toBe("hello-world");
  });
  it("returns empty for unsluggable input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("EXP-018 fix: language pair + CEFR + shareability helpers", () => {
  it("detects the target language from common topic phrasings", () => {
    expect(detectTargetLanguage("French Grammar")).toBe("fr");
    expect(detectTargetLanguage("Grammaire française")).toBe("fr");
    expect(detectTargetLanguage("Spanish travel vocabulary")).toBe("es");
    expect(detectTargetLanguage("Deutsch lernen")).toBe("de");
    expect(detectTargetLanguage("日本語の文法")).toBe("ja");
    expect(detectTargetLanguage("Cooking tips")).toBeNull();
    expect(detectTargetLanguage(undefined)).toBeNull();
  });

  it("maps analysis levels to CEFR", () => {
    expect(cefrFromAnalysisLevel("beginner")).toBe("A1");
    expect(cefrFromAnalysisLevel("intermediate")).toBe("B1");
    expect(cefrFromAnalysisLevel("advanced")).toBe("C1");
    expect(cefrFromAnalysisLevel(undefined)).toBe("A1");
  });

  it("isShareableLesson requires >= 5 exercises across >= 2 types", () => {
    expect(
      isShareableLesson({
        theorySteps: 1,
        exercises: 0,
        exerciseTypeCounts: {},
        estimatedMinutes: 1,
        vocabularyCount: 1,
        theoryOnly: true,
      }),
    ).toBe(false);
    expect(
      isShareableLesson({
        theorySteps: 1,
        exercises: 5,
        exerciseTypeCounts: { matching: 1, free_text: 4 },
        estimatedMinutes: 8,
        vocabularyCount: 4,
        theoryOnly: false,
      }),
    ).toBe(true);
    // 5 exercises but only ONE type → not shareable.
    expect(
      isShareableLesson({
        theorySteps: 1,
        exercises: 5,
        exerciseTypeCounts: { free_text: 5 },
        estimatedMinutes: 8,
        vocabularyCount: 5,
        theoryOnly: false,
      }),
    ).toBe(false);
  });

  it("isSaveableLesson accepts a theory-only lesson with >= 1 step (#795)", () => {
    // One theory step, zero exercises → not shareable, but saveable.
    const theoryOnly = {
      theorySteps: 1,
      exercises: 0,
      exerciseTypeCounts: {},
      estimatedMinutes: 1,
      vocabularyCount: 0,
      theoryOnly: true,
    };
    expect(isShareableLesson(theoryOnly)).toBe(false);
    expect(isSaveableLesson(theoryOnly)).toBe(true);
    // A lesson with no steps at all is not saveable.
    expect(
      isSaveableLesson({
        theorySteps: 0,
        exercises: 0,
        exerciseTypeCounts: {},
        estimatedMinutes: 0,
        vocabularyCount: 0,
        theoryOnly: true,
      }),
    ).toBe(false);
  });
});
