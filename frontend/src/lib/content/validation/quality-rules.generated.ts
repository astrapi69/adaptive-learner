// GENERATED from scripts/generate_lesson_schema.py (EXP-039). DO NOT EDIT.
// Shared content quality minimums — the single source is the Python
// generator; schema/quality-rules.json carries the same numbers for the
// content repo. Edit the generator + run `make sync-schema`.

/** Quality minimums. Below any of these = cannot share. */
export const QUALITY = {
  minExercisesPerLesson: 5,
  minExerciseTypes: 2,
  minFreeTextAccepts: 2,
  minMatchingPairs: 3,
  minTheorySteps: 1,
} as const;
