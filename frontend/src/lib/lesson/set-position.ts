/**
 * Where a lesson sits inside its set (#2793).
 *
 * The lesson runner knew only its SUCCESSOR: `useLessonSetContext` computed
 * `list.lessons.indexOf(filename)`, read `lessons[idx + 1]` and threw the
 * index away — so "previous lesson", "jump N back" and "how far am I" had no
 * data behind them anywhere in the app.
 *
 * This module turns that one-way lookup into the full position: the 1-based
 * index, the total, and both neighbours. Pure and storage-agnostic — it takes
 * the filename list the content loader already returns, so it works
 * identically in API and Dexie mode and is testable without a storage mock.
 *
 * @example
 * const pos = resolveSetPosition(["01.json", "02.json", "03.json"], "02.json");
 * // {index: 2, total: 3, previous: "01.json", next: "03.json"}
 */

/** A lesson's place in its set, 1-based for display. */
export interface SetPosition {
  /** 1-based position of the current lesson ("Lesson 2 of 3" -> 2). */
  index: number;
  /** Number of lessons in the set. */
  total: number;
  /** Filename of the preceding lesson, or ``null`` on the first. */
  previous: string | null;
  /** Filename of the following lesson, or ``null`` on the last. */
  next: string | null;
}

/**
 * Resolve a lesson's position within its set's lesson list.
 *
 * @param lessons - The set's lesson filenames, in set order.
 * @param filename - The current lesson's filename.
 * @returns The position, or ``null`` when the lesson is not in the list
 *   (an unknown filename, an empty list, or a list that has not loaded yet) —
 *   callers then simply omit the position UI, matching the silent-degrade
 *   contract of the surrounding set-context reads.
 */
export function resolveSetPosition(
  lessons: readonly string[],
  filename: string,
): SetPosition | null {
  const idx = lessons.indexOf(filename);
  if (idx < 0) return null;
  return {
    index: idx + 1,
    total: lessons.length,
    previous: idx > 0 ? lessons[idx - 1] : null,
    next: idx < lessons.length - 1 ? lessons[idx + 1] : null,
  };
}

/**
 * Resolve the lesson ``steps`` positions away from the current one, clamped
 * to the set's bounds — the primitive behind "jump 3 lessons back".
 *
 * @param lessons - The set's lesson filenames, in set order.
 * @param filename - The current lesson's filename.
 * @param steps - Signed offset; negative goes back, positive forward.
 * @returns The target filename, or ``null`` when the current lesson is
 *   unknown or the offset does not move (already at the clamped edge).
 */
export function lessonAtOffset(
  lessons: readonly string[],
  filename: string,
  steps: number,
): string | null {
  const idx = lessons.indexOf(filename);
  if (idx < 0 || lessons.length === 0) return null;
  const target = Math.min(Math.max(idx + steps, 0), lessons.length - 1);
  return target === idx ? null : lessons[target];
}
