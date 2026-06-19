import { describe, expect, it } from "vitest";

import {
  ALLOWED_EXERCISE_TYPES,
  buildExerciseGenerationPrompt,
  detectLanguageHint,
  recommendedCardCount,
  type TheoryStep,
} from "./exercise-generation-prompt";

const ANSIBLE_STEPS: TheoryStep[] = [
  {
    id: "s1",
    title: "Module",
    body: "Wähle das passende Modul (file, copy, service, apt, shell) für die Aufgabe.",
  },
  {
    id: "s2",
    title: "Hosts",
    body: "Mit dem Schlüsselwort 'all' lassen sich alle Hosts über hosts:-Zeilen ansprechen.",
  },
  {
    id: "s3",
    title: "Idempotenz",
    body: "Idempotenz bedeutet, dass Ansible Tasks sicher mehrfach ausführen kann.",
  },
];

describe("buildExerciseGenerationPrompt", () => {
  it("embeds the theory bodies as context", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toContain("file, copy, service, apt, shell");
    expect(prompt).toContain("Idempotenz");
    expect(prompt).toContain("Module");
  });

  it("lists exactly the five allowed types and forbids multiple_choice", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    for (const type of ALLOWED_EXERCISE_TYPES) {
      expect(prompt).toContain(type);
    }
    expect(prompt).toMatch(/no multiple_choice/i);
  });

  it("requests a JSON cards[] output with a worked example", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toMatch(/JSON ONLY/i);
    expect(prompt).toContain('"cards"');
    expect(prompt).toContain('"pairs"');
    expect(prompt).toContain('"distractors"');
    expect(prompt).toContain('"accepts"');
  });

  it("demands a mix of at least 3 different types", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toMatch(/at least 3 DIFFERENT exercise types/i);
  });

  it("carries the quality criteria (no trivia, no verbatim, plausible distractors)", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toMatch(/no trivial questions/i);
    expect(prompt).toMatch(/no verbatim quotes/i);
    expect(prompt).toMatch(/plausible but unambiguously wrong/i);
    expect(prompt).toMatch(/Invent nothing/i);
  });

  it("derives the language from the theory (German here) and states it", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toContain("(de)");
  });

  it("honours an explicit language override", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS, { language: "fr" });
    expect(prompt).toContain("(fr)");
  });

  it("caps the requested count at maxCards", () => {
    const many: TheoryStep[] = Array.from({ length: 20 }, (_, i) => ({
      id: `s${i}`,
      body: `Body ${i}`,
    }));
    const prompt = buildExerciseGenerationPrompt(many, { maxCards: 5 });
    expect(prompt).toMatch(/Create 5 exercises \(at most 5\)/i);
  });
});

describe("recommendedCardCount", () => {
  it("asks for at least one per ~2.5 steps, never below 3, capped at maxCards", () => {
    expect(recommendedCardCount(2, 8)).toBe(3); // floor of 3
    expect(recommendedCardCount(10, 8)).toBe(4); // ceil(10/2.5)=4
    expect(recommendedCardCount(40, 8)).toBe(8); // capped
  });
});

describe("detectLanguageHint", () => {
  it("flags German on umlauts/ß", () => {
    expect(detectLanguageHint("Die Übung prüft das Verständnis.")).toBe("de");
  });

  it("flags German on stopwords without umlauts", () => {
    expect(detectLanguageHint("der hund und die katze ist nicht hier")).toBe("de");
  });

  it("defaults to English otherwise", () => {
    expect(detectLanguageHint("The quick brown fox jumps over the lazy dog.")).toBe("en");
  });
});
