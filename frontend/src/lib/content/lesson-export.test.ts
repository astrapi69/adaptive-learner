import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";

import { generateLessonFromAnalysis } from "./analysis-to-lesson";
import {
  buildContentSetZip,
  buildManifestYaml,
  buildPrBody,
  buildPrTitle,
  communityPrUrl,
  communityUploadUrl,
  MAX_PR_URL_LENGTH,
  contentSetFileName,
  lessonFileName,
  lessonJson,
  type CommunityPrDetails,
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

const PR_DETAILS: CommunityPrDetails = {
  title: "Spanish travel",
  sourceLanguage: "en",
  targetLanguage: "es",
  level: "A1",
  filePath: "sets/en/es-a1/lessons/16-spanish-travel.json",
  exerciseCount: 6,
  cardCount: 12,
  lessonCount: 1,
};

describe("buildPrTitle", () => {
  it("formats as 'content: {title} ({source}->{target} {level})'", () => {
    expect(buildPrTitle(PR_DETAILS)).toBe(
      "content: Spanish travel (en->es A1)",
    );
  });
});

describe("buildPrBody", () => {
  it("includes the metadata table, placement path, and validation line", () => {
    const body = buildPrBody(PR_DETAILS);
    expect(body).toContain("| Title | Spanish travel |");
    expect(body).toContain("| Source language | en |");
    expect(body).toContain("| Target language | es |");
    expect(body).toContain("sets/en/es-a1/lessons/16-spanish-travel.json");
    expect(body).toContain("schema 1.2 ✓ · quality ✓");
    expect(body).not.toContain("Contributed by");
  });

  it("adds the author row when an author is given", () => {
    const body = buildPrBody({ ...PR_DETAILS, author: "Maria S." });
    expect(body).toContain("| Contributed by | Maria S. |");
  });

  it("surfaces acknowledged quality findings", () => {
    const body = buildPrBody({
      ...PR_DETAILS,
      validationIssues: [
        "Lesson has 0 exercises; at least 5 are required.",
        "Source and target language are identical.",
      ],
    });
    expect(body).toContain("⚠ shared with warnings");
    expect(body).toContain("Quality-check findings (acknowledged by author):");
    expect(body).toContain("- Lesson has 0 exercises");
  });
});

describe("communityUploadUrl", () => {
  it("points at the repo's upload page for the lessons directory", () => {
    expect(
      communityUploadUrl(
        "astrapi69/adaptive-learner-content",
        "main",
        "sets/en/es-a1/lessons",
      ),
    ).toBe(
      "https://github.com/astrapi69/adaptive-learner-content/upload/main/sets/en/es-a1/lessons",
    );
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

  it("builds a create-file PR URL with the placement path + pre-filled title/body", () => {
    const url = communityPrUrl({
      repo: "astrapi69/adaptive-learner-content",
      branch: "main",
      filePath: "sets/en/es-a1/lessons/16-greetings.json",
      lesson: LESSON,
      prTitle: "content: Greetings (en->es A1)",
      prBody: "## New lesson\n...",
    });
    expect(url).not.toBeNull();
    expect(url).toMatch(
      /^https:\/\/github\.com\/astrapi69\/adaptive-learner-content\/new\/main\?/,
    );
    const qs = new URL(url!).searchParams;
    // Auto-numbered placement path (NOT the title-derived filename).
    expect(qs.get("filename")).toBe(
      "sets/en/es-a1/lessons/16-greetings.json",
    );
    expect(qs.get("message")).toBe("content: Greetings (en->es A1)");
    expect(qs.get("description")).toContain("New lesson");
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
      filePath: "sets/en/es-a1/lessons/16-greetings.json",
      lesson: { ...LESSON, steps: [{ id: "s1", type: "theory", body: big }] },
      prTitle: "content: Greetings (en->es A1)",
      prBody: "## New lesson",
    });
    expect(url).toBeNull();
  });
});
