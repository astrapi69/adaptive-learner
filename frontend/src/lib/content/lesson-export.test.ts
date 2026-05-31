import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";

import { generateLessonFromAnalysis } from "./analysis-to-lesson";
import {
  buildContentSetZip,
  buildManifestYaml,
  communityIssueUrl,
  communityPrUrl,
  MAX_PR_URL_LENGTH,
  contentSetFileName,
  lessonFileName,
  lessonJson,
} from "./lesson-export";
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

const META = {
  set_id: "analysis-conv-1",
  title: "Spanish travel",
  language: "es",
  level: "beginner",
  description: "Ordering food.",
};

function lesson() {
  return generateLessonFromAnalysis(ANALYSIS, { id: "analysis-conv-1" });
}

describe("lesson-export filenames", () => {
  it("slugifies the title for the JSON filename", () => {
    expect(lessonFileName("Spanish Travel!")).toBe(
      "spanish-travel-lesson.json",
    );
  });
  it("slugifies the title for the ZIP filename", () => {
    expect(contentSetFileName("Spanish Travel!")).toBe(
      "spanish-travel-set.zip",
    );
  });
  it("falls back when the title is unsluggable", () => {
    expect(lessonFileName("!!!")).toBe("lesson-lesson.json");
  });
});

describe("lessonJson", () => {
  it("is valid JSON of the lesson with no user data", () => {
    const l = lesson();
    const parsed = JSON.parse(lessonJson(l));
    expect(parsed.id).toBe(l.id);
    expect(parsed.steps.length).toBe(l.steps.length);
    // No user-data keys anywhere in the serialized lesson.
    const blob = lessonJson(l);
    expect(blob).not.toMatch(/user_id|progress|error_history|user_answer/);
  });
});

describe("buildManifestYaml", () => {
  it("produces a one-entry ContentManifest that re-parses", () => {
    const yaml = buildManifestYaml(META, 1);
    const parsed = parseYaml(yaml);
    expect(parsed.schema_version).toBe("1.1");
    expect(parsed.sets).toHaveLength(1);
    expect(parsed.sets[0].id).toBe("analysis-conv-1");
    expect(parsed.sets[0].language).toBe("es");
    expect(parsed.sets[0].lesson_count).toBe(1);
  });
});

describe("buildContentSetZip", () => {
  it("packs manifest.yaml + lessons/ that round-trip", async () => {
    const l = lesson();
    const blob = await buildContentSetZip(META, [l]);
    expect(blob).toBeInstanceOf(Blob);
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const manifestText = await zip.file("manifest.yaml")!.async("string");
    const manifest = parseYaml(manifestText);
    expect(manifest.sets[0].title).toBe("Spanish travel");
    const lessonFile = zip.file(`lessons/${l.id}.json`);
    expect(lessonFile).not.toBeNull();
    const parsedLesson = JSON.parse(await lessonFile!.async("string"));
    expect(parsedLesson.id).toBe(l.id);
    expect(parsedLesson.steps.length).toBe(l.steps.length);
  });
});

describe("communityIssueUrl", () => {
  it("builds a pre-filled GitHub issue URL", () => {
    const url = communityIssueUrl(
      "astrapi69/adaptive-learner-content",
      META,
      1,
    );
    expect(url).toMatch(
      /^https:\/\/github\.com\/astrapi69\/adaptive-learner-content\/issues\/new\?/,
    );
    const qs = new URL(url).searchParams;
    expect(qs.get("title")).toBe("New lesson: Spanish travel (es beginner)");
    expect(qs.get("body")).toContain("Spanish travel");
    expect(qs.get("body")).toContain("Maintainer");
  });

  it("stamps validation ✓ when no issues were acknowledged", () => {
    const url = communityIssueUrl("o/r", META, 1, {
      sourceLanguage: "en",
      targetLanguage: "es",
      placement: "sets/en/es-beginner",
      exerciseCount: 6,
      cardCount: 12,
    });
    const body = new URL(url).searchParams.get("body") ?? "";
    expect(body).toContain("schema ✓ · quality ✓");
    expect(body).not.toContain("shared with warnings");
  });

  it("surfaces acknowledged quality findings so the maintainer sees them", () => {
    const url = communityIssueUrl("o/r", META, 1, {
      sourceLanguage: "en",
      targetLanguage: "es",
      placement: "sets/en/es-beginner",
      exerciseCount: 0,
      cardCount: 3,
      validationIssues: [
        "Lesson has 0 exercises; at least 5 are required.",
        "Source and target language are identical.",
      ],
    });
    const body = new URL(url).searchParams.get("body") ?? "";
    expect(body).toContain("⚠ shared with warnings");
    expect(body).toContain("Quality-check findings (acknowledged by author):");
    expect(body).toContain("- Lesson has 0 exercises");
    expect(body).toContain("- Source and target language are identical");
  });
});

describe("communityPrUrl", () => {
  // A minimal lesson — the JSON stays small so it fits comfortably
  // under MAX_PR_URL_LENGTH.
  const LESSON = {
    id: "01",
    title: "Greetings",
    estimated_minutes: 10,
    cards: [{ id: "c1", front: "hello", back: "hola", tags: [] }],
    steps: [{ id: "s1", type: "theory" as const, body: "Hola = hello." }],
  };

  it("builds a GitHub Web new-file URL with filename + value", () => {
    const url = communityPrUrl({
      repo: "astrapi69/adaptive-learner-content",
      branch: "main",
      placement: "sets/en/es-a1",
      lesson: LESSON,
    });
    expect(url).not.toBeNull();
    expect(url).toMatch(
      /^https:\/\/github\.com\/astrapi69\/adaptive-learner-content\/new\/main\?/,
    );
    const qs = new URL(url!).searchParams;
    expect(qs.get("filename")).toBe(
      "sets/en/es-a1/lessons/greetings-lesson.json",
    );
    const value = qs.get("value") ?? "";
    expect(value).toContain('"id": "01"');
    expect(value).toContain('"title": "Greetings"');
  });

  it("returns null when the encoded URL would exceed the length cap", () => {
    // Pump the lesson body so its JSON pushes the URL past
    // MAX_PR_URL_LENGTH.
    const big = "x".repeat(MAX_PR_URL_LENGTH * 2);
    const url = communityPrUrl({
      repo: "o/r",
      branch: "main",
      placement: "sets/en/es-a1",
      lesson: { ...LESSON, steps: [{ id: "s1", type: "theory", body: big }] },
    });
    expect(url).toBeNull();
  });
});
