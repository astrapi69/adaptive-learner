/**
 * #1896 — how many lessons of a user set still lack exercises.
 *
 * The batch "Generate for all lessons" button needs this BEFORE it
 * renders, so it can present itself as disabled-with-a-reason instead of
 * letting the learner click into an empty result (feature-state policy,
 * #335). The same count drives the batch orchestrator's candidate list,
 * so the counting rule lives here once and both paths import it.
 */

import { getStorage } from "../../../storage";
import type { ContentLesson, ContentSetEntry } from "../../../storage/types";

/** Number of exercise steps carried by one lesson. */
export function exerciseCountOf(lesson: ContentLesson): number {
  return lesson.steps.filter((step) => step.type === "exercise" && step.exercise).length;
}

/**
 * Count the lessons of a set that carry no exercise yet.
 *
 * Reads through ``getStorage().contentLoader``, so it works in both
 * storage modes and never touches the network or an AI provider.
 *
 * @param entry - The user-generated set.
 * @returns Number of lessons the batch generator would act on.
 *
 * @example
 * const pending = await countLessonsWithoutExercises(entry);
 * if (pending === 0) disableTheBatchButton();
 */
export async function countLessonsWithoutExercises(
  entry: ContentSetEntry,
): Promise<number> {
  const list = await getStorage().contentLoader.listLessons(entry.source, entry.id);
  let pending = 0;
  for (const filename of list.lessons) {
    const lesson = await getStorage().contentLoader.getLesson(
      entry.source,
      entry.id,
      filename,
    );
    if (exerciseCountOf(lesson) === 0) pending += 1;
  }
  return pending;
}
