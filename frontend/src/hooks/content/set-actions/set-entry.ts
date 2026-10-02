/**
 * Small set-entry primitives shared by the set-action hooks (#3271): the
 * list key of a set and the read of all its cached lessons. The read routes
 * through ``getStorage()``, so it works in API and Dexie mode.
 *
 * @example
 * const keys = new Set(entries.map(setKey));
 * const lessons = await fetchSetLessons(entry);
 */

import { getStorage } from "../../../storage";
import type { ContentLesson, ContentSetEntry } from "../../../storage/types";

/** The ``source#id`` key a set is tracked under in list + download state. */
export const setKey = (entry: ContentSetEntry): string => `${entry.source}#${entry.id}`;

/** Fetch every cached lesson of a set, in listing order. */
export const fetchSetLessons = async (entry: ContentSetEntry): Promise<ContentLesson[]> => {
  const listing = await getStorage().contentLoader.listLessons(entry.source, entry.id);
  return Promise.all(
    listing.lessons.map((f) => getStorage().contentLoader.getLesson(entry.source, entry.id, f)),
  );
};
