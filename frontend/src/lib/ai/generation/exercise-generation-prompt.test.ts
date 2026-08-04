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

  it("names every allowed core type in the RULES 'Core types' line", () => {
    const lines = buildExerciseGenerationPrompt(ANSIBLE_STEPS).split("\n");
    const idx = lines.findIndex((line) => /Core types:/i.test(line));
    expect(idx, "prompt must carry a 'Core types:' rule").toBeGreaterThanOrEqual(0);
    // The joined core-types sentence may wrap across the next line; take both
    // so a trailing type on the continuation line still counts.
    const coreText = `${lines[idx]}\n${lines[idx + 1] ?? ""}`;
    for (const type of ALLOWED_EXERCISE_TYPES) {
      expect(coreText, `core-types line must list ${type}`).toContain(type);
    }
  });

  it("carries a TYPE FIELDS entry for every allowed type (no half-integrated type)", () => {
    const lines = buildExerciseGenerationPrompt(ANSIBLE_STEPS).split("\n");
    for (const type of ALLOWED_EXERCISE_TYPES) {
      // Each type has its own "- <type>:" field spec line.
      const hasFieldLine = lines.some((line) => line.startsWith(`- ${type}:`));
      expect(hasFieldLine, `TYPE FIELDS must document ${type}`).toBe(true);
    }
  });

  it("does not carry a leftover 'no multiple_choice' contradiction", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).not.toMatch(/no multiple_choice/i);
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

  it("couples type choice to learning goal (suitability beats variety) — EXP-041", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toMatch(/TYPE SELECTION/i);
    expect(prompt).toMatch(/suitability beats variety/i);
  });

  it("restricts word_tiles to fixed-order sentences and forbids it for free definitions — EXP-041", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toMatch(/word_tiles ONLY for a sentence with ONE fixed/i);
    expect(prompt).toMatch(/NEVER for free definitions/i);
  });

  it("routes single-answer definitions to cloze or picture_choice, not word_tiles — EXP-041", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toMatch(/definition or fact with ONE correct answer -> cloze/i);
    expect(prompt).toMatch(/Do NOT model it as\s+word_tiles/i);
  });

  it("forbids exact-match types for free explanations / 'in your own words' goals — EXP-041", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toMatch(/in your own words/i);
    expect(prompt).toMatch(/do NOT create an exact-match type/i);
  });

  it("keeps the variety floor while subordinating it to suitability — EXP-041", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toMatch(/at least 3 DIFFERENT exercise types/i);
    expect(prompt).toMatch(/suitability beats variety/i);
  });

  it("guides multiple_choice usage incl. the multiple (select-all) flag", () => {
    const prompt = buildExerciseGenerationPrompt(ANSIBLE_STEPS);
    expect(prompt).toMatch(/multiple_choice/);
    expect(prompt).toMatch(/select all that apply|multiple: true|all correct/i);
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

describe("buildExerciseGenerationPrompt — regeneration (AIX-05)", () => {
  const STEPS: TheoryStep[] = [{ id: "s1", title: "T", body: "Some theory text." }];

  it("has no regeneration block on a first generation", () => {
    expect(buildExerciseGenerationPrompt(STEPS)).not.toContain("REGENERATION");
  });

  it("includes the user feedback when provided", () => {
    const prompt = buildExerciseGenerationPrompt(STEPS, {
      feedback: "Make the questions noticeably harder.",
    });
    expect(prompt).toContain("REGENERATION");
    expect(prompt).toContain("harder");
  });

  it("lists previous questions to avoid", () => {
    const prompt = buildExerciseGenerationPrompt(STEPS, {
      feedback: "more variety",
      avoidQuestions: ["What is X?", "Define Y."],
    });
    expect(prompt).toContain("Do NOT repeat");
    expect(prompt).toContain("What is X?");
    expect(prompt).toContain("Define Y.");
  });
});
