import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { validateManifest } from "learn-content-engine";

import { generateLessonFromAnalysis } from "../analysis/analysis-to-lesson";
import {
  buildContentSetZip,
  buildManifestYaml,
  buildPrBody,
  buildPrTitle,
  communityPrUrl,
  communityUploadUrl,
  contentSetFileName,
  lessonFileName,
  lessonJson,
  type CommunityPrDetails,
} from "./lesson-export";
import { CURRENT_MANIFEST_SCHEMA_VERSION } from "../schema-version";
import type { ConversationAnalysisResult } from "../../../types/domain";

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
    expect(parsed.schema_version).toBe(CURRENT_MANIFEST_SCHEMA_VERSION);
    expect(parsed.sets).toHaveLength(1);
    expect(parsed.sets[0].id).toBe("analysis-conv-1");
    expect(parsed.sets[0].language).toBe("es");
    expect(parsed.sets[0].lesson_count).toBe(1);
  });

  it("#3244 writes the canonical language pair next to the legacy alias", () => {
    const parsed = parseYaml(
      buildManifestYaml({ ...META, target_language: "es", source_language: "de" }, 1),
    );
    expect(parsed.sets[0].target_language).toBe("es");
    expect(parsed.sets[0].source_language).toBe("de");
    expect(parsed.sets[0].language).toBe("es");
  });

  it.each([
    { name: "an empty level (stored before #3385)", level: "" },
    { name: "the engine's none sentinel", level: "none" },
    { name: "a CEFR level", level: "A1" },
  ])("#3385 exports $name as a manifest the engine accepts", ({ level }) => {
    const parsed = parseYaml(buildManifestYaml({ ...META, level }, 1));
    expect(parsed.sets[0].level).toBe(level === "" ? "none" : level);
    const result = validateManifest(parsed);
    expect(result.errors).toEqual([]);
  });

  it("#3244 derives target_language from language when only the alias is known", () => {
    const parsed = parseYaml(buildManifestYaml(META, 1));
    expect(parsed.sets[0].target_language).toBe("es");
    expect(parsed.sets[0].source_language).toBeUndefined();
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
  const ARGS = {
    repo: "astrapi69/adaptive-learner-content",
    branch: "main",
    filePath: "sets/en/es-a1/lessons/16-greetings.json",
    prTitle: "content: Greetings (en->es A1)",
    prBody: "## New lesson\n...",
  };

  it("builds a create-file URL with the placement path + pre-filled title/body", () => {
    const url = communityPrUrl(ARGS);
    expect(url).toMatch(
      /^https:\/\/github\.com\/astrapi69\/adaptive-learner-content\/new\/main\?/,
    );
    const qs = new URL(url).searchParams;
    // Auto-numbered placement path (NOT the title-derived filename).
    expect(qs.get("filename")).toBe("sets/en/es-a1/lessons/16-greetings.json");
    expect(qs.get("message")).toBe("content: Greetings (en->es A1)");
    expect(qs.get("description")).toContain("New lesson");
  });

  it("never carries the lesson content: path, message and description only (#3839)", () => {
    // GitHub receives this address the moment the editor opens, before the
    // learner confirms anything, and it lands in the browser history. So
    // the function does not even take the lesson.
    const qs = new URL(communityPrUrl(ARGS)).searchParams;
    expect(qs.get("value")).toBeNull();
    expect([...qs.keys()].sort()).toEqual(["description", "filename", "message"]);
  });
});
