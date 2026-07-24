/**
 * Unit tests for the browser-direct NotebookLM prompt builders + parsers
 * (#902). The Dexie assembly + AI calls are covered by the dexie-mode gate;
 * here we pin the pure functions.
 */

import { describe, expect, it } from "vitest";

import {
  buildQuestionPrompt,
  buildStudyGuidePrompt,
  parseQuestions,
  parseStudyGuide,
  type StudyGuideContext,
} from "./notebooklm-ai";

const baseCtx: StudyGuideContext = {
  topic: "Spanish A1",
  goal: "Conversational basics",
  timeframe: "3 months",
  daily_minutes: 20,
  profile: { deductive: 0.4, inductive: 0.6 },
  vocabulary: [{ word: "hola", translation: "hi", example: "Hola!" }],
  sessions: [
    { method: "deductive", started_at: "2026-06-01", messages: "USER: hi" },
  ],
};

describe("buildStudyGuidePrompt", () => {
  it("includes metadata, profile, vocabulary and sessions", () => {
    const prompt = buildStudyGuidePrompt(baseCtx);
    expect(prompt).toContain("Topic: Spanish A1");
    expect(prompt).toContain("Goal: Conversational basics");
    expect(prompt).toContain("deductive: 0.4");
    expect(prompt).toContain("hola → hi - Hola!");
    expect(prompt).toContain("=== Session 2026-06-01 (deductive) ===");
  });

  it("omits empty sections", () => {
    const prompt = buildStudyGuidePrompt({
      ...baseCtx,
      profile: {},
      vocabulary: [],
      sessions: [],
    });
    expect(prompt).not.toContain("Learning profile");
    expect(prompt).not.toContain("Vocabulary entries");
    expect(prompt).not.toContain("Recent sessions");
  });
});

describe("parseStudyGuide", () => {
  it("returns trimmed markdown unchanged", () => {
    expect(parseStudyGuide("# Guide\n\nbody")).toBe("# Guide\n\nbody");
  });

  it("strips an outer markdown fence", () => {
    expect(parseStudyGuide("```markdown\n# Guide\n```")).toBe("# Guide");
  });

  it("returns empty string on nullish input", () => {
    expect(parseStudyGuide(null)).toBe("");
    expect(parseStudyGuide("")).toBe("");
  });
});

describe("buildQuestionPrompt", () => {
  it("substitutes the limit and clips long content", () => {
    const prompt = buildQuestionPrompt("abc", 5);
    expect(prompt).toContain("produce 5 high-value study questions");
    expect(prompt).toContain("Material:\nabc");
  });
});

describe("parseQuestions", () => {
  it("parses a well-formed array", () => {
    const raw = JSON.stringify([
      {
        question: "What is X?",
        expected_answer: "X is Y",
        type: "explain",
        difficulty: "hard",
        topic: "basics",
      },
    ]);
    const out = parseQuestions(raw);
    expect(out).toHaveLength(1);
    expect(out[0].question_type).toBe("explain");
    expect(out[0].difficulty).toBe("hard");
  });

  it("strips a json fence", () => {
    const raw = '```json\n[{"question":"Q","type":"open"}]\n```';
    expect(parseQuestions(raw)).toHaveLength(1);
  });

  it("coerces out-of-range type and difficulty instead of dropping the row", () => {
    const raw = JSON.stringify([
      { question: "Q", type: "weird", difficulty: "impossible" },
    ]);
    const out = parseQuestions(raw);
    expect(out[0].question_type).toBe("open");
    expect(out[0].difficulty).toBe("medium");
  });

  it("skips rows without a question and returns [] on malformed input", () => {
    expect(parseQuestions(JSON.stringify([{ type: "open" }]))).toHaveLength(0);
    expect(parseQuestions("not json")).toHaveLength(0);
    expect(parseQuestions(null)).toHaveLength(0);
  });
});
