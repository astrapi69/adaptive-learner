/**
 * Shared shapes of the set-action hooks (#3271). Split out of
 * ``useContentSetActions`` together with the hooks that use them; the
 * delete-target types stay re-exported from ``useContentSetActions`` so no
 * caller changes.
 *
 * @example
 * const target: LessonDeleteTarget = { entry, filename: "01.json", title: "Intro" };
 */

import type { Dispatch, SetStateAction } from "react";

import type { ContentSetEntry } from "../../../storage/types";

/** Optimistic set-list mutation after a delete/download/status change. */
export type SetSetsDispatch = Dispatch<SetStateAction<ContentSetEntry[]>>;

/** What a single-lesson delete targets (#2064): the set, the lesson's cache
 *  filename, a display title, and an optional callback to refresh the caller's
 *  per-lesson list after a successful delete. */
export interface LessonDeleteTarget {
  entry: ContentSetEntry;
  filename: string;
  title: string;
  onDeleted?: () => void;
}

/** What a bulk (multi-select) lesson delete targets (#2065): the set, the
 *  selected lessons' cache filenames, and an optional refresh callback. The
 *  whole selection is removed in one atomic re-save + one atomic learner-data
 *  delete (no per-lesson loop of writes). */
export interface BulkLessonDeleteTarget {
  entry: ContentSetEntry;
  filenames: string[];
  onDeleted?: () => void;
}
