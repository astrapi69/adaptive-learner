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

/** One lesson dropped from a partial set import, with the specific
 *  reason it failed validation (surfaced to the user). */
export interface SkippedLesson {
  /** File name inside the ZIP (e.g. ``lessons/02-broken.json``). */
  file: string;
  error: string;
}

export interface ImportParseResult {
  ok: boolean;
  set?: ImportedSet;
  /** Specific, human-readable failure when ``ok`` is false. */
  error?: string;
  /** Non-empty on a PARTIAL set import: some lessons validated and were
   *  kept (in ``set``), these failed and were skipped. Absent when every
   *  lesson imported cleanly. */
  skipped?: SkippedLesson[];
}

/**
 * Maximum accepted import file size (5 MiB). A shared lesson JSON or a
 * content-set ZIP is small; anything larger is refused BEFORE parsing so
 * a broken or hostile file cannot exhaust memory. Guards both the ``.json``
 * and ``.zip`` paths.
 */
export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

function importSetId(seed: string): string {
  const slug = slugify(seed) || "lesson";
  return `imported-${slug}`;
}

/**
 * Slug-safe set id derived from ``setId`` that does not collide with any
 * id in ``existing``. Appends ``-copy``, then ``-copy-2``, ``-copy-3`` …
 * Used by the "import as a copy" collision choice so an imported set never
 * silently overwrites an existing one.
 */
export function nextCopySetId(setId: string, existing: Set<string>): string {
  let candidate = `${setId}-copy`;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${setId}-copy-${n}`;
    n += 1;
  }
  return candidate;
}

/**
 * Return a COPY of ``set`` with a fresh, non-colliding id and a
 * ``"{title} ({copyLabel})"`` title, for the "import as a copy" choice on
 * a name collision. The original is left untouched. ``copyLabel`` is the
 * localized word for "copy" (defaults to the English literal so pure
 * callers/tests need not pass it).
 */
export function asImportedCopy(
  set: ImportedSet,
  existing: Set<string>,
  copyLabel = "copy",
): ImportedSet {
  return {
    ...set,
    set_id: nextCopySetId(set.set_id, existing),
    title: `${set.title} (${copyLabel})`,
  };
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
  // Partial import (#1672): keep the lessons that validate, collect the
  // ones that don't with a specific reason. A set with SOME valid lessons
  // imports the valid ones + reports the skipped; a set with NONE fails.
  const lessons: ContentLesson[] = [];
  const skipped: SkippedLesson[] = [];
  for (const name of lessonFiles.sort()) {
    try {
      const parsed: unknown = JSON.parse(await zip.files[name].async("string"));
      lessons.push(asValidLesson(parsed));
    } catch (err) {
      skipped.push({ file: name, error: (err as Error).message });
    }
  }
  if (lessons.length === 0) {
    return {
      ok: false,
      error:
        skipped.length > 0
          ? `no valid lessons (${skipped.length} invalid); first: ${skipped[0].error}`
          : "ZIP has no lessons/*.json files",
    };
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
    skipped: skipped.length > 0 ? skipped : undefined,
  };
}

/** Parse + validate an import file by extension. Refuses an oversized file
 *  before parsing (memory-safety guard, #1672). */
export async function parseImportFile(file: File): Promise<ImportParseResult> {
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    const maxMiB = Math.round(MAX_IMPORT_FILE_SIZE / (1024 * 1024));
    return { ok: false, error: `file too large (max ${maxMiB} MiB)` };
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) return parseZipSet(file);
  if (name.endsWith(".json")) return parseJsonLesson(file);
  return { ok: false, error: "unsupported file type (expected .json or .zip)" };
}
