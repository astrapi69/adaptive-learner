/**
 * Content-Loader user-generated sets + lifecycle (#1780 — extracted
 * from content-loader-dexie.ts).
 *
 * Owns "My Lessons" persistence (Phase 59B) and the set lifecycle
 * operations: status transitions (#1300), single + bulk delete, and
 * bulk status (#1351).
 */

import type { ContentSetEntry, SaveUserSetInput } from "../types";
import { USER_GENERATED_SOURCE } from "../types";
import { getDb } from "../dexie/db";
import type { ContentSetRow, ContentSetFileRow } from "../dexie/db";
import { cacheKey, fileKey } from "./content-loader-sources";
import { rowToCachedEntry } from "./content-loader-listing";

/** User-generated sets carry a single, fixed version: re-saving an
 *  edited lesson overwrites in place rather than accumulating
 *  versions (the cache-version machinery is for upstream updates).
 *  Matches the backend's ``USER_SET_VERSION``. */
const USER_SET_VERSION = "1.0.0";

/** Persist a user-generated set into the same Dexie tables as
 *  downloaded sets. Overwrites any prior set with the same
 *  ``set_id`` under the user-generated source. */
export async function saveUserSetDexie(
  input: SaveUserSetInput,
  now: string,
): Promise<ContentSetEntry> {
  const db = getDb();
  const setPk = cacheKey(USER_GENERATED_SOURCE, input.set_id, USER_SET_VERSION);
  const targetLanguage = input.target_language ?? input.language;
  const sourceLanguage = input.source_language ?? "en";
  const row: ContentSetRow = {
    id: setPk,
    source: USER_GENERATED_SOURCE,
    branch: "",
    set_id: input.set_id,
    version: USER_SET_VERSION,
    title: input.title,
    title_native: input.title_native ?? null,
    language: targetLanguage,
    target_language: targetLanguage,
    source_language: sourceLanguage,
    level: input.level,
    domain: input.origin,
    lesson_count: input.lessons.length,
    description: input.description ?? null,
    tags: "[]",
    cover_image: null,
    downloaded_at: now,
    status: "active",
    manifest_yaml: "",
    // #1743 — persist the optional set-level book block so a book-authored
    // set surfaces it in "Vertiefe das Thema", same as a downloaded set.
    book: input.book ?? null,
  };
  const files: ContentSetFileRow[] = input.lessons.map((lesson) => ({
    id: fileKey(setPk, `lessons/${lesson.id}.json`),
    set_pk: setPk,
    filename: `lessons/${lesson.id}.json`,
    body: JSON.stringify(lesson),
    encoding: "text",
  }));
  await db.transaction("rw", db.contentSets, db.contentSetFiles, async () => {
    await _purgeSetRows(USER_GENERATED_SOURCE, input.set_id);
    await db.contentSets.put(row);
    await db.contentSetFiles.bulkPut(files);
  });
  return rowToCachedEntry(row);
}

/** Delete every cached row (set + files) for a source/set_id pair. */
export async function deleteSetDexie(
  source: string,
  setId: string,
): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.contentSets, db.contentSetFiles, async () => {
    await _purgeSetRows(source, setId);
  });
}

/** #1351 — a source/set_id pair, the unit of a bulk set operation. */
export interface SetRef {
  source: string;
  setId: string;
}

/** #1351 — delete many sets in ONE ``rw`` transaction (set rows + their
 *  files), not N separate round-trips. Idempotent per pair. */
export async function deleteSetsDexie(refs: SetRef[]): Promise<void> {
  if (refs.length === 0) return;
  const db = getDb();
  await db.transaction("rw", db.contentSets, db.contentSetFiles, async () => {
    for (const { source, setId } of refs) {
      await _purgeSetRows(source, setId);
    }
  });
}

/** Internal: remove the set rows + their files. Must run inside an
 *  existing ``rw`` transaction on both tables. */
async function _purgeSetRows(source: string, setId: string): Promise<void> {
  const db = getDb();
  const rows = await db.contentSets
    .where("set_id")
    .equals(setId)
    .filter((r) => r.source === source)
    .toArray();
  for (const existing of rows) {
    await db.contentSetFiles.where("set_pk").equals(existing.id).delete();
    await db.contentSets.delete(existing.id);
  }
}
