import { describe, it, expect } from "vitest";

import { generateLessonFromAnalysis } from "./analysis/analysis-to-lesson";
import { buildContentSetZip, lessonJson } from "./lesson-export";
import { parseImportFile } from "./lesson-import";
import type { ConversationAnalysisResult } from "../../types/domain";

const ANALYSIS: ConversationAnalysisResult = {
  topic: "Spanish travel",
  summary: "Ordering food.",
  vocabulary: [
    {
      word: "la cuenta",
      translation: "the bill",
      example: "La cuenta, por favor.",
    },
    { word: "el agua", translation: "the water", example: "Quiero el agua." },
    {
      word: "la calle",
      translation: "the street",
      example: "La calle esta cerca.",
    },
    { word: "izquierda", translation: "left", example: "Gira a la izquierda." },
  ],
};

function lesson() {
  return generateLessonFromAnalysis(ANALYSIS, { id: "analysis-conv-1" });
}

describe("parseImportFile — JSON", () => {
  it("accepts a valid lesson JSON file", async () => {
    const file = new File([lessonJson(lesson())], "spanish.json", {
      type: "application/json",
    });
    const result = await parseImportFile(file);
    expect(result.ok).toBe(true);
    expect(result.set?.lessons).toHaveLength(1);
    expect(result.set?.title).toBe("Spanish travel");
    expect(result.set?.set_id).toMatch(/^imported-/);
  });

  it("rejects malformed JSON with a specific error", async () => {
    const file = new File(["{not json"], "bad.json");
    const result = await parseImportFile(file);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid JSON/i);
  });

  it("rejects a JSON that fails schema validation", async () => {
    // A theory step with no body violates the schema.
    const broken = {
      id: "x",
      title: "Broken",
      description: null,
      estimated_minutes: 1,
      cards: [],
      steps: [{ id: "theory-x", type: "theory", body: null }],
    };
    const file = new File([JSON.stringify(broken)], "broken.json");
    const result = await parseImportFile(file);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/needs a body|invalid/i);
  });
});

describe("parseImportFile — ZIP", () => {
  it("accepts a content-set ZIP and validates its lessons", async () => {
    const blob = await buildContentSetZip(
      {
        set_id: "analysis-conv-1",
        title: "Spanish travel",
        language: "es",
        level: "beginner",
        description: "Ordering food.",
      },
      [lesson()],
    );
    const file = new File([blob], "spanish-set.zip", {
      type: "application/zip",
    });
    const result = await parseImportFile(file);
    expect(result.ok).toBe(true);
    expect(result.set?.language).toBe("es");
    expect(result.set?.lessons).toHaveLength(1);
    expect(result.set?.lessons[0].id).toBe("analysis-conv-1");
  });
});

describe("parseImportFile — unsupported", () => {
  it("rejects an unsupported extension", async () => {
    const file = new File(["x"], "notes.txt");
    const result = await parseImportFile(file);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unsupported/i);
  });
});
