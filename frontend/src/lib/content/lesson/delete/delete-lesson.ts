/**
 * Pure helpers for the single-lesson delete (#2064).
 *
 * Deleting ONE lesson of a user-generated set is a full re-save of the set
 * without that lesson: ``saveUserSet`` purges + rewrites the cache atomically,
 * so the dropped lesson file is gone and ``lesson_count`` is recomputed, while
 * every remaining lesson keeps its id/filename (no renumbering, #2064 decision
 * #3). Only user-generated sets are supported — a downloaded repo set would
 * resurrect the lesson on the next re-download (decision #5).
 *
 * These helpers are pure (no storage/React); the orchestration (learner-data
 * purge, SW-cache purge, favorite removal) lives in ``useContentSetActions``.
 */

import { USER_GENERATED_SOURCE } from "../../../../storage/types";
import type {
  ContentLesson,
  ContentSetEntry,
  SaveUserSetInput,
  UserLessonOrigin,
} from "../../../../storage/types";

/** The cache filename of a lesson — mirrors ``saveUserSet``'s
 *  ``lessons/{id}.json`` layout (the ``lessons/`` prefix is stripped by
 *  ``listLessons``, so this is the bare filename used everywhere else:
 *  progress rows, SRS cards, deep links, favorites). */
export function lessonFilename(lesson: ContentLesson): string {
  return `${lesson.id}.json`;
}

/** Only user-generated sets support per-lesson delete (decision #5). */
export function isUserGeneratedSet(entry: ContentSetEntry): boolean {
  return entry.source === USER_GENERATED_SOURCE;
}

/** Build the ``SaveUserSetInput`` that re-persists a user set with exactly the
 *  given lessons, preserving all set-level metadata (title / languages / level
 *  / description / book) from the catalog entry. */
export function buildUserSetInputFromEntry(
  entry: ContentSetEntry,
  lessons: ContentLesson[],
): SaveUserSetInput {
  return {
    set_id: entry.id,
    title: entry.title,
    title_native: entry.title_native ?? null,
    language: entry.language,
    target_language: entry.target_language,
    source_language: entry.source_language,
    level: entry.level,
    origin: (entry.domain as UserLessonOrigin) ?? "imported",
    description: entry.description ?? null,
    book: entry.book ?? null,
    lessons,
  };
}

/** The outcome of removing one lesson from a set's lesson list. */
export interface LessonRemoval {
  /** ``false`` when ``filename`` matched no lesson (a no-op for the caller). */
  found: boolean;
  /** Re-save input for the remaining lessons; ``null`` when the removed lesson
   *  was the LAST one (the caller deletes the whole set instead) or when the
   *  lesson was not found. */
  input: SaveUserSetInput | null;
  /** Lessons left after the removal. */
  remaining: number;
}

/**
 * Remove the lesson identified by ``filename`` from ``lessons`` and build the
 * re-save input for the remainder.
 *
 * @param entry The set's catalog entry (source of the preserved metadata).
 * @param lessons Every lesson currently in the set.
 * @param filename The lesson to remove (e.g. ``01-intro.json``).
 */
export function removeLessonFromSet(
  entry: ContentSetEntry,
  lessons: ContentLesson[],
  filename: string,
): LessonRemoval {
  const remaining = lessons.filter((lesson) => lessonFilename(lesson) !== filename);
  if (remaining.length === lessons.length) {
    return { found: false, input: null, remaining: lessons.length };
  }
  if (remaining.length === 0) {
    return { found: true, input: null, remaining: 0 };
  }
  return {
    found: true,
    input: buildUserSetInputFromEntry(entry, remaining),
    remaining: remaining.length,
  };
}

/** The outcome of removing SEVERAL lessons from a set in one operation (#2065). */
export interface LessonsRemoval {
  /** The requested filenames that actually matched a lesson (a subset). Empty
   *  when none matched — the caller then treats the delete as a no-op. */
  found: string[];
  /** Re-save input for the lessons that remain; ``null`` when the removal
   *  empties the set (the caller deletes the whole set instead) or when nothing
   *  matched. */
  input: SaveUserSetInput | null;
  /** Lessons left after the removal. */
  remaining: number;
  /** ``true`` when the selection removed every lesson of the set — the set is
   *  now empty and should be deleted entirely rather than re-saved. */
  emptied: boolean;
}

/**
 * Remove every lesson named in ``filenames`` from ``lessons`` in one pass and
 * build the re-save input for the remainder (#2065 multi-select delete).
 *
 * The removal is a single atomic re-save of the set without the selected
 * lessons: the surviving lessons keep their ids/filenames (no renumbering,
 * #2064 decision #3) and their relative order (a filter preserves order), so
 * ``LessonProgress`` / SRS rows and the stored display order stay attached to
 * the survivors. When the selection covers ALL lessons, ``emptied`` is set and
 * ``input`` is ``null`` — the caller deletes the whole set (no empty husk).
 *
 * @param entry The set's catalog entry (source of the preserved metadata).
 * @param lessons Every lesson currently in the set.
 * @param filenames The lessons to remove (e.g. ``["02-body.json", "04-end.json"]``).
 */
export function removeLessonsFromSet(
  entry: ContentSetEntry,
  lessons: ContentLesson[],
  filenames: readonly string[],
): LessonsRemoval {
  const targets = new Set(filenames);
  const found = lessons
    .map((lesson) => lessonFilename(lesson))
    .filter((filename) => targets.has(filename));
  if (found.length === 0) {
    return { found: [], input: null, remaining: lessons.length, emptied: false };
  }
  const remaining = lessons.filter((lesson) => !targets.has(lessonFilename(lesson)));
  if (remaining.length === 0) {
    return { found, input: null, remaining: 0, emptied: true };
  }
  return {
    found,
    input: buildUserSetInputFromEntry(entry, remaining),
    remaining: remaining.length,
    emptied: false,
  };
}
