/**
 * Unit tests for the browser-direct pronunciation prompt builders + parsers
 * (#903). The Dexie key resolution + AI calls are covered by the dexie gate;
 * here we pin the pure functions.
 */

import { describe, expect, it } from "vitest";

import {
  buildJudgePrompt,
  buildPhrasePrompt,
  parseJudge,
  parsePhrase,
} from "./pronunciation-ai";

describe("buildPhrasePrompt", () => {
  it("substitutes language, level, focus and the avoid-list", () => {
    const prompt = buildPhrasePrompt({
      language: "Spanish",
      level: "intermediate",
      focus: "rolled r",
      previous: ["hola amigo", "buenos dias"],
    });
    expect(prompt).toContain("phrase in Spanish");
    expect(prompt).toContain("Intermediate difficulty");
    expect(prompt).toContain("highlights rolled r");
    expect(prompt).toContain("Avoid these phrases");
    expect(prompt).toContain("buenos dias");
  });

  it("defaults level/focus and omits the avoid-clause when no history", () => {
    const prompt = buildPhrasePrompt({ language: "French" });
    expect(prompt).toContain("Beginner difficulty");
    expect(prompt).toContain("common sounds");
    expect(prompt).not.toContain("Avoid these phrases");
  });
});

describe("parsePhrase", () => {
  it("parses the phrase field", () => {
    expect(parsePhrase('{"phrase": "Bonjour le monde"}')).toBe("Bonjour le monde");
  });
  it("strips a json fence", () => {
    expect(parsePhrase('```json\n{"phrase":"Hola"}\n```')).toBe("Hola");
  });
  it("returns null on empty/invalid/missing", () => {
    expect(parsePhrase('{"phrase": ""}')).toBeNull();
    expect(parsePhrase("not json")).toBeNull();
    expect(parsePhrase(null)).toBeNull();
  });
});

describe("buildJudgePrompt", () => {
  it("substitutes target, actual and language", () => {
    const prompt = buildJudgePrompt({
      target: "el gato",
      actual: "el gado",
      language: "Spanish",
    });
    expect(prompt).toContain("Target phrase (in Spanish): el gato");
    expect(prompt).toContain("learner said");
    expect(prompt).toContain("el gado");
  });
});

describe("parseJudge", () => {
  it("parses a well-formed verdict", () => {
    const v = parseJudge(
      JSON.stringify({
        matches: true,
        score: 0.85,
        feedback: "Nice!",
        missed_sounds: ["r"],
      }),
    );
    expect(v).toEqual({
      matches: true,
      score: 0.85,
      feedback: "Nice!",
      missed_sounds: ["r"],
    });
  });

  it("clamps the score and derives matches when absent", () => {
    const v = parseJudge('{"score": 1.5, "feedback": "x"}');
    expect(v?.score).toBe(1);
    expect(v?.matches).toBe(true); // 1 >= 0.7
  });

  it("coerces a string score + string matches", () => {
    const v = parseJudge('{"score": "0.4", "matches": "false"}');
    expect(v?.score).toBeCloseTo(0.4);
    expect(v?.matches).toBe(false);
  });

  it("returns null on malformed input", () => {
    expect(parseJudge("not json")).toBeNull();
    expect(parseJudge(null)).toBeNull();
    expect(parseJudge("[1,2,3]")).toBeNull();
  });
});
