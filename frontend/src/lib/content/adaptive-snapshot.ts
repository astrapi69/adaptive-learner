/**
 * Adaptive-lesson snapshot (Phase 59F / v1.42.0).
 *
 * Turns an in-memory adaptive ContentLesson (Phase 53C) into a
 * self-contained, schema-valid lesson that can be saved + replayed
 * offline from "My Lessons".
 *
 * Two fix-ups are required because the live adaptive lesson is built
 * for immediate rendering, not for persistence:
 *
 *   1. Slug-safe ids. The adaptive lesson id embeds an ISO timestamp
 *      (``adaptive-{set}-2026-..T..:..``) and step ids embed
 *      element keys that may contain non-slug characters. The schema
 *      requires ``^[a-z0-9]+(-[a-z0-9]+)*$`` ids, so every id is
 *      reissued as a positional slug.
 *   2. Self-contained exercises. The live lesson carries ``cards: []``
 *      while its exercises reference cards from the SOURCE set
 *      (looked up at render time). A standalone snapshot can't carry
 *      those cards, so ``card_ids`` are cleared — every exercise
 *      already holds its own data (pairs / accept / sentence+blanks /
 *      tiles), so it plays + scores without the card link.
 *
 * The result is a deterministic snapshot: replaying it later is
 * unaffected if the adaptive generator changes (it's stored verbatim).
 */

import type { ContentLesson, ContentLessonStep } from "../../storage/types";
import { slugify, validateGeneratedLesson } from "./analysis-to-lesson";

export function snapshotAdaptiveLesson(lesson: ContentLesson): ContentLesson {
  const id = slugify(lesson.id) || "adaptive-lesson";
  const steps: ContentLessonStep[] = lesson.steps.map((step, i) => {
    if (step.type === "theory" || !step.exercise) {
      return { ...step, id: `theory-${i}` };
    }
    return {
      ...step,
      id: `step-${i}`,
      exercise: { ...step.exercise, id: `ex-${i}`, card_ids: [] },
    };
  });
  const snapshot: ContentLesson = { ...lesson, id, cards: [], steps };
  // Throws on any residual schema breach — the save path never
  // persists an invalid lesson.
  validateGeneratedLesson(snapshot);
  return snapshot;
}
