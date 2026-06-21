/**
 * Lesson import (Phase 59E / v1.42.0).
 *
 * Parses + validates a shared lesson file — a single ``.json`` lesson
 * or a ``.zip`` content set (manifest.yaml + lessons/) — into a set
 * ready to save under "My Lessons" (origin = "imported"). Closes the
 * sharing loop: User A exports (59D), User B imports here. No server,
 * no account, fully offline.
 *
 * Validation happens BEFORE import: a malformed file returns a
 * specific error message rather than corrupting the cache. Lessons
 * are validated with the same invariant checker the generator uses
 * (``validateGeneratedLesson``), so an imported lesson is held to the
 * exact schema the viewer expects.
 */

import { parse as parseYaml } from "yaml";

import type { ContentLesson } from "../../../storage/types";
import { slugify, validateGeneratedLesson } from "../analysis/analysis-to-lesson";

export interface ImportedSet {
  set_id: string;
  title: string;
  language: string;
  level: string;
  description: string | null;
  lessons: ContentLesson[];
}

export interface ImportParseResult {
  ok: boolean;
  set?: ImportedSet;
  /** Specific, human-readable failure when ``ok`` is false. */
  error?: string;
}

function importSetId(seed: string): string {
  const slug = slugify(seed) || "lesson";
  return `imported-${slug}`;
}

/** Validate a parsed value as a ContentLesson; returns the lesson or
 *  throws with a specific message. */
function asValidLesson(value: unknown): ContentLesson {
  if (!value || typeof value !== "object") {
    throw new Error("not a lesson object");
  }
  const lesson = value as ContentLesson;
  // Throws ``generated lesson invalid: ...`` on any schema breach.
  validateGeneratedLesson(lesson);
  return lesson;
}

/** Parse a single-lesson ``.json`` file. */
async function parseJsonLesson(file: File): Promise<ImportParseResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    return { ok: false, error: `invalid JSON: ${(err as Error).message}` };
  }
  try {
    const lesson = asValidLesson(parsed);
    return {
      ok: true,
      set: {
        set_id: importSetId(lesson.title || lesson.id),
        title: lesson.title,
        language: "en",
        level: "imported",
        description: lesson.description ?? null,
        lessons: [lesson],
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Parse a ``.zip`` content set (manifest.yaml + lessons/*.json). */
async function parseZipSet(file: File): Promise<ImportParseResult> {
  let zip;
  try {
    const JSZipMod = (await import("jszip")).default;
    zip = await JSZipMod.loadAsync(await file.arrayBuffer());
  } catch (err) {
    return { ok: false, error: `not a valid ZIP: ${(err as Error).message}` };
  }
  const manifestFile = zip.file("manifest.yaml");
  if (!manifestFile) {
    return { ok: false, error: "ZIP is missing manifest.yaml" };
  }
  let manifest: {
    name?: string;
    description?: string;
    sets?: Array<{
      id?: string;
      title?: string;
      language?: string;
      level?: string;
      description?: string;
    }>;
  };
  try {
    manifest = parseYaml(await manifestFile.async("string")) ?? {};
  } catch (err) {
    return {
      ok: false,
      error: `invalid manifest.yaml: ${(err as Error).message}`,
    };
  }
  const setMeta = manifest.sets?.[0];
  if (!setMeta) {
    return { ok: false, error: "manifest.yaml has no sets" };
  }

  const lessonFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("lessons/") && name.endsWith(".json"),
  );
  if (lessonFiles.length === 0) {
    return { ok: false, error: "ZIP has no lessons/*.json files" };
  }
  const lessons: ContentLesson[] = [];
  for (const name of lessonFiles.sort()) {
    try {
      const parsed: unknown = JSON.parse(await zip.files[name].async("string"));
      lessons.push(asValidLesson(parsed));
    } catch (err) {
      return { ok: false, error: `${name}: ${(err as Error).message}` };
    }
  }

  const title = setMeta.title || manifest.name || "Imported set";
  return {
    ok: true,
    set: {
      set_id: importSetId(setMeta.id || title),
      title,
      language: setMeta.language || "en",
      level: setMeta.level || "imported",
      description: setMeta.description ?? manifest.description ?? null,
      lessons,
    },
  };
}

/** Parse + validate an import file by extension. */
export async function parseImportFile(file: File): Promise<ImportParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) return parseZipSet(file);
  if (name.endsWith(".json")) return parseJsonLesson(file);
  return { ok: false, error: "unsupported file type (expected .json or .zip)" };
}
