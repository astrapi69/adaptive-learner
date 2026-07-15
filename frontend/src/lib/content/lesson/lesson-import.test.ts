import { describe, it, expect } from "vitest";

import { generateLessonFromAnalysis } from "../analysis/analysis-to-lesson";
import { buildContentSetZip, lessonJson } from "./lesson-export";
import {
  asImportedCopy,
  MAX_IMPORT_FILE_SIZE,
  nextCopySetId,
  parseImportFile,
  type ImportedSet,
} from "./lesson-import";
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

describe("parseImportFile — size guard (#1672)", () => {
  it("rejects a file larger than the cap without parsing", async () => {
    // Report an oversized file WITHOUT allocating the bytes: a File's
    // ``size`` is what the guard reads, so stub it on a tiny blob.
    const file = new File(["{}"], "huge.json", { type: "application/json" });
    Object.defineProperty(file, "size", { value: MAX_IMPORT_FILE_SIZE + 1 });
    const result = await parseImportFile(file);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it("accepts a file at exactly the cap", async () => {
    const file = new File([lessonJson(lesson())], "ok.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "size", { value: MAX_IMPORT_FILE_SIZE });
    const result = await parseImportFile(file);
    expect(result.ok).toBe(true);
  });
});

describe("parseImportFile — partial ZIP import (#1672)", () => {
  async function zipWith(entries: Record<string, string>): Promise<File> {
    const JSZipMod = (await import("jszip")).default;
    const zip = new JSZipMod();
    zip.file(
      "manifest.yaml",
      "schema_version: '1.4'\nname: Mixed\nsets:\n  - id: mixed\n    title: Mixed set\n    language: es\n    level: beginner\n",
    );
    const dir = zip.folder("lessons");
    for (const [name, body] of Object.entries(entries)) {
      dir?.file(name, body);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    return new File([blob], "mixed-set.zip", { type: "application/zip" });
  }

  it("imports the valid lessons and reports the skipped ones", async () => {
    const good = lesson();
    const broken = { id: "x", title: "Broken", steps: "nope" };
    const file = await zipWith({
      "01-good.json": lessonJson(good),
      "02-broken.json": JSON.stringify(broken),
    });
    const result = await parseImportFile(file);
    expect(result.ok).toBe(true);
    expect(result.set?.lessons).toHaveLength(1);
    expect(result.set?.lessons[0].id).toBe(good.id);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped?.[0].file).toContain("02-broken.json");
    expect(result.skipped?.[0].error).toBeTruthy();
  });

  it("fails all-or-nothing when every lesson is invalid", async () => {
    const file = await zipWith({
      "01-a.json": JSON.stringify({ id: "a" }),
      "02-b.json": "{not json",
    });
    const result = await parseImportFile(file);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid|no valid/i);
  });
});

describe("collision helpers (#1672)", () => {
  it("nextCopySetId appends -copy then -copy-N", () => {
    expect(nextCopySetId("imported-x", new Set())).toBe("imported-x-copy");
    expect(nextCopySetId("imported-x", new Set(["imported-x-copy"]))).toBe(
      "imported-x-copy-2",
    );
    expect(
      nextCopySetId(
        "imported-x",
        new Set(["imported-x-copy", "imported-x-copy-2"]),
      ),
    ).toBe("imported-x-copy-3");
  });

  it("asImportedCopy gives a fresh id + a copy title suffix", () => {
    const set: ImportedSet = {
      set_id: "imported-x",
      title: "Spanish travel",
      language: "es",
      level: "beginner",
      description: null,
      lessons: [lesson()],
    };
    const copy = asImportedCopy(set, new Set(["imported-x"]), "copy");
    expect(copy.set_id).toBe("imported-x-copy");
    expect(copy.title).toBe("Spanish travel (copy)");
    // Original untouched; lessons carried over.
    expect(set.set_id).toBe("imported-x");
    expect(copy.lessons).toHaveLength(1);
  });
});

describe("round-trip export -> import (#1672)", () => {
  it("re-imports an exported lesson identically", async () => {
    const original = lesson();
    const file = new File([lessonJson(original)], "rt.json", {
      type: "application/json",
    });
    const result = await parseImportFile(file);
    expect(result.ok).toBe(true);
    expect(result.set?.lessons[0]).toEqual(original);
  });
});
