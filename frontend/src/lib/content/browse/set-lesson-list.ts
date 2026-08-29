/**
 * The set page's lesson list (#2793 stages 2-3).
 *
 * Until now a set was only ever a LAUNCHER: ``/content/set/:id`` resolved the
 * set and jumped into lesson 1, and the single surface that listed a set's
 * lessons with their state lived two clicks deep in the learning path, behind
 * a non-deep-linkable expander. So "jump to the third lesson back" and "how far
 * am I in this set" had no reachable answer.
 *
 * This module is the model behind the list: pure, storage-agnostic, and built
 * from the two shapes storage already returns (``contentLoader.listLessons``
 * and ``lessonProgress.list``), so it is testable without a mock and identical
 * in API and Dexie mode.
 *
 * @example
 * const list = buildSetLessonList({setId, lessons, progress});
 * list.percent;          // 67
 * list.currentFilename;  // "02.json" - where "continue" should land
 */

import type {LessonProgress} from "../../../storage/types";

/** How far the learner got with one lesson of the set. */
export type SetLessonStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed";

/** One row of the set's lesson list. */
export interface SetLessonEntry {
  /** 1-based position in set order (what "Lesson 3 of 12" counts). */
  index: number;
  filename: string;
  status: SetLessonStatus;
  /** Score of the completed run, when there is one. */
  scoreCorrect: number | null;
  scoreTotal: number | null;
  /** True for the lesson "continue" would resume. */
  isCurrent: boolean;
}

/** The whole list plus the set-level progress figures. */
export interface SetLessonList {
  lessons: SetLessonEntry[];
  total: number;
  completed: number;
  /** Completed share in whole percent (0 for an empty set). */
  percent: number;
  /** First unfinished lesson, or ``null`` when the set is done. */
  currentFilename: string | null;
}

export interface SetLessonListInput {
  setId: string;
  /** The set's lesson filenames, in set order. */
  lessons: readonly string[];
  /** Progress rows; rows of other sets are ignored. */
  progress: readonly LessonProgress[];
}

function statusOf(row: LessonProgress | undefined): SetLessonStatus {
  if (!row) return "not_started";
  if (row.status === "completed") return "completed";
  if (row.status === "paused") return "paused";
  if (row.status === "in_progress") return "in_progress";
  // "abandoned" reads as not started: the learner gets a clean offer again.
  return "not_started";
}

/** Build the set's lesson list with per-lesson state and set-level progress. */
export function buildSetLessonList(input: SetLessonListInput): SetLessonList {
  const rows = new Map<string, LessonProgress>();
  for (const row of input.progress) {
    if (row.set_id !== input.setId) continue;
    const existing = rows.get(row.lesson_filename);
    // Keep the most advanced row per lesson: a completed run wins.
    if (!existing || (existing.status !== "completed" && row.status === "completed")) {
      rows.set(row.lesson_filename, row);
    }
  }

  const firstUnfinished = input.lessons.find(
    (filename) => statusOf(rows.get(filename)) !== "completed",
  );

  const lessons: SetLessonEntry[] = input.lessons.map((filename, i) => {
    const row = rows.get(filename);
    const status = statusOf(row);
    return {
      index: i + 1,
      filename,
      status,
      scoreCorrect: status === "completed" ? (row?.score_correct ?? null) : null,
      scoreTotal: status === "completed" ? (row?.score_total ?? null) : null,
      isCurrent: filename === firstUnfinished,
    };
  });

  const completed = lessons.filter((l) => l.status === "completed").length;
  const total = lessons.length;
  return {
    lessons,
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    currentFilename: firstUnfinished ?? null,
  };
}
