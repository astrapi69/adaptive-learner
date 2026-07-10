// GENERATED from scripts/generate_lesson_schema.py (EXP-039). DO NOT EDIT.
// Shared content quality minimums. The numbers come from the engine
// mirror schema/quality-rules.json, re-emitted here for the frontend and
// carried by the content repo too. Refresh via `make sync-schema`.

/** Quality minimums. Below any of these = cannot share. */
export const QUALITY = {
  minExerciseTypes: 2,
  minExercisesPerLesson: 5,
  minFreeTextAccepts: 2,
  minMatchingPairs: 3,
  minTheorySteps: 1,
} as const;
