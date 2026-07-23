/**
 * Content-Loader cached read paths (#1780 — extracted from
 * content-loader-dexie.ts).
 *
 * Owns the after-download reads: lesson listing, single-lesson parse
 * (with set-inherited language pair / domain), and the base64-decoded
 * asset Blob (Phase 54).
 */

import { parseLesson } from "../../lib/content/engine";

import type { ContentLesson, ContentLessonList } from "../types";
import { getDb } from "../dexie/db";
import {
  base64ToBytes,
  fileKey,
  mimeTypeForAssetPath,
} from "./content-loader-sources";
import { latestCachedRow } from "./content-loader-listing";

export async function listLessonsDexie(
  source: string,
  setId: string,
): Promise<ContentLessonList> {
  const cached = await latestCachedRow(source, setId);
  if (!cached) {
    const err: Error & { status?: number } = new Error(
      `Set ${source}/${setId} is not cached.`,
    );
    err.status = 404;
    throw err;
  }
  const db = getDb();
  const files = await db.contentSetFiles
    .where("set_pk")
    .equals(cached.id)
    .toArray();
  const lessons = files
    .map((f) => f.filename)
    .filter((name) => name.startsWith("lessons/"))
    .map((name) => name.slice("lessons/".length))
    .sort();
  return {
    set_id: setId,
    source,
    version: cached.version,
    lessons,
  };
}

export async function getLessonDexie(
  source: string,
  setId: string,
  filename: string,
): Promise<ContentLesson> {
  const cached = await latestCachedRow(source, setId);
  if (!cached) {
    const err: Error & { status?: number } = new Error(
      `Set ${source}/${setId} is not cached.`,
    );
    err.status = 404;
    throw err;
  }
  const db = getDb();
  const file = await db.contentSetFiles.get(
    fileKey(cached.id, `lessons/${filename}`),
  );
  if (!file) {
    const err: Error & { status?: number } = new Error(
      `Lesson ${filename} not found in ${source}/${setId}`,
    );
    err.status = 404;
    throw err;
  }
  // The single-JSON source adapter (Content-Engine, EXP-042) parses the raw
  // lesson JSON and injects the set-inherited language pair / domain: a lesson
  // file doesn't carry them (the parent set is authoritative), and consumers
  // that gate on them need them — notably the per-theory read-aloud button
  // (canRead requires lesson.target_language). A lesson that declares its own
  // (e.g. an exported standalone) keeps it.
  return parseLesson(file.body, cached);
}

/** Phase 54 / v1.37.0 — read a cached asset by relative path
 *  (e.g. ``img/sunrise.png``). Returns null when the set isn't
 *  cached or the asset wasn't bundled with the download (the
 *  resolver hook then falls back to a placeholder SVG /
 *  text-only display).
 *
 *  Assets are stored base64-encoded in ``contentSetFiles.body``
 *  alongside the lessons; this function decodes them and wraps
 *  the bytes in a Blob with the MIME type inferred from the
 *  path extension. The caller (asset resolver) is responsible
 *  for ``URL.createObjectURL`` + ``URL.revokeObjectURL``. */
export async function getAssetDexie(
  source: string,
  setId: string,
  assetPath: string,
): Promise<Blob | null> {
  const cached = await latestCachedRow(source, setId);
  if (!cached) return null;
  const db = getDb();
  const file = await db.contentSetFiles.get(
    fileKey(cached.id, `assets/${assetPath}`),
  );
  if (!file) return null;
  if (file.encoding !== "base64") {
    // Defensive: the download orchestrator always writes
    // assets with ``encoding: "base64"``; an unknown
    // encoding means the row was written by a future
    // version we don't understand. Falling back to null is
    // safer than guessing.
    return null;
  }
  const bytes = base64ToBytes(file.body);
  // Cast through ArrayBuffer because the Blob constructor's
  // BlobPart type wants an ArrayBuffer-backed view, not a
  // generic ArrayBufferLike (SharedArrayBuffer would not
  // round-trip through atob anyway).
  return new Blob([bytes.buffer as ArrayBuffer], {
    type: mimeTypeForAssetPath(assetPath),
  });
}
