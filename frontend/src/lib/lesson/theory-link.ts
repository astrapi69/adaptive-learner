/**
 * Theory back-link resolution (#140).
 *
 * Pure, runtime-only mapping from an exercise step to the theory
 * step it practices: the nearest theory step that precedes it in
 * the lesson. No schema field — the lesson's existing step order
 * and ``type`` are the only inputs, so any lesson supports it
 * without content changes.
 */

import type {ContentLessonStep} from "../../storage/types";

/**
 * Find the index of the nearest theory step that appears before
 * ``currentIndex``.
 *
 * Returns ``null`` when the current step is itself a theory step,
 * when ``currentIndex`` is out of range, or when no theory step
 * precedes it (so the UI offers no link rather than a dead one).
 */
export function findPrecedingTheoryIndex(
    steps: ContentLessonStep[],
    currentIndex: number,
): number | null {
    const current = steps[currentIndex];
    if (!current || current.type === "theory") return null;
    for (let i = currentIndex - 1; i >= 0; i--) {
        if (steps[i].type === "theory") return i;
    }
    return null;
}
