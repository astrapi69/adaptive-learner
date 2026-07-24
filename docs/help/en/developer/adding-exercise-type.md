# Adding a new exercise type

The canonical model is **not** extended on spec. A new exercise type is added
only when concrete content needs it, and then as one small additive PR. This is
the binding recipe, derived from the real `cloze`/`select` multiple-choice work
(#1342) and the EXP-039 schema pipeline.

Before you start, confirm the type is a genuine new **type**, not a
presentation or a convention already covered by the
[exercise type catalog](authoring-content.md#exercise-type-catalog-status)
(text multiple choice, True/False, dropdown/radio/checkbox are **not** new
types). It must be **binary SRS-gradable** (a single correct/incorrect outcome
per element) - that is the line the catalog's "deliberately excluded" list
draws.

## Steps

1. **EXP entry / justification.** Record the need, the binary grading
   semantics, and the delimitation from existing types in the relevant
   exploration (`docs/explorations/EXP-041-*` for exercise-type suitability, or
   a new EXP). No type without a documented reason.
2. **Pydantic model + enum.** Add the value to `ExerciseType` and the
   type-specific fields + `model_validator` (with `model_config =
   ConfigDict(extra="forbid")`) in
   `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py`.
   The schema (App) is the current source of truth (EXP-039).
3. **Run the generation.** `make sync-schema` regenerates `schema/*.json` and
   the TS lesson types (`frontend/src/storage/types/content/lesson-schema.generated.ts`)
   + the format-reference doc. **Never hand-edit** a generated artefact; the
   `make sync-schema-check` drift gate fails if you do.
4. **Bump the schema version.** Raise `CURRENT_SCHEMA_VERSION` in
   `models.py` by a **minor** (additive) step; old content keeps validating
   (major-version match).
5. **Register the renderer.** Add the branch + the type to
   `SUPPORTED_EXERCISE_TYPES` in
   `frontend/src/components/exercises/shell/ExerciseDispatcher.tsx`. The
   **registry must equal the enum** - a parity test enforces it, so an
   unrendered type fails CI (the invariant that prevents dead schema).
6. **Wire grading / SRS.** Emit an `ExerciseScored` from the renderer via
   `useControlledExercise`; the shared `onComplete` → `recordStepResult` path
   in `LessonStepView.tsx` already fans each attempt out through
   `getStorage().elementErrors.recordBulk` - reuse it, do not add a second
   recording path.
7. **Content-repo validation.** Extend the client validator
   (`frontend/src/lib/content/validation/content-validator.ts`) and, if the
   type affects the quality minimums, the shared `QUALITY_RULES` in
   `scripts/generate_lesson_schema.py` (vendored by learn-content-engine,
   which the content repos mirror pinned to its release).
8. **Authoring docs.** Add the type to the
   [catalog table](authoring-content.md#exercise-type-catalog-status) and a
   `### <type>` reference block with a JSON example (EN + DE).
9. **Tests.** Schema accepts a valid example and rejects an invalid one
   (missing required field / extra key); the renderer renders + grades
   correct/wrong; the SRS attempt is recorded; add a mobile visual baseline if
   the control's look is new.
10. **Follow-up (not this PR).** The `learn-content-engine` library adopts the
    extended schema during its migration; note it, do not block on it.

## Why this stays small

Because the schema is generated (step 3) and the dispatcher parity test forces
registry-equals-enum (step 5), a new type is an additive change with a fixed
shape: model → generate → renderer → grading → docs → tests. No parallel
hand-maintained mirror can drift, and no type can ship without a renderer.
