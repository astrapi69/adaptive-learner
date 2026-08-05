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
2. **Extend the format in the engine.** The canonical home of the lesson
   format is the
   [learn-content-engine](https://github.com/astrapi69/learn-content-engine)
   package: add the type to its schema, its hand-written semantic layer
   (`validate.ts`) and its
   [format reference](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md),
   then release the engine. A format change **starts in the engine** - the app's
   `schema/*.json` is a byte mirror of the pinned release with exactly one
   writer (`scripts/sync_schema_mirror_from_engine.py`, #2265).
3. **Bump the pin, run the sync.** Raise the `learn-content-engine` pin in
   `frontend/package.json`, then run `make sync-schema` in the **same PR**:
   it refreshes the mirror `schema/*.json` from the installed package and
   regenerates every derived artefact - the structural Pydantic layer
   (`plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema_generated.py`
   via `scripts/generate_pydantic_models.py`), the TS lesson types
   (`frontend/src/storage/types/content/lesson-schema.generated.ts`) and the
   format-reference doc. **Never hand-edit** a mirrored or generated
   artefact; the `make sync-schema-check` drift gate fails if you do.
4. **Semantic layer + schema version.** Layer the app-side cross-field rules
   as a thin subclass in
   `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py`
   (the structural fields are generated; only the semantics are
   hand-written), and keep `CURRENT_SCHEMA_VERSION` in `models.py` aligned
   with the pinned engine schema version (**minor** = additive; old content
   keeps validating via the major-version match).
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
   (`frontend/src/lib/content/validation/content-validator.ts`). The quality
   minimums live in the engine's `quality-rules.json` (mirrored into
   `schema/quality-rules.json`); if the type affects them, extend them in
   the engine, not in the app.
8. **Authoring docs.** Add the type to the
   [catalog table](authoring-content.md#exercise-type-catalog-status) and a
   `### <type>` reference block with a JSON example (EN + DE).
9. **Tests.** Schema accepts a valid example and rejects an invalid one
   (missing required field / extra key); the renderer renders + grades
   correct/wrong; the SRS attempt is recorded; add a mobile visual baseline if
   the control's look is new.
10. **Follow-up (not this PR).** The content repos
    (`adaptive-learner-content`) adopt the new type when they re-pin their
    engine release; note it, do not block on it.

## Why this stays small

Because the format is mirrored from the pinned engine release and every app
artefact derives from that mirror (step 3), and the dispatcher parity test
forces registry-equals-enum (step 5), a new type is an additive change with a
fixed shape: engine → pin → generate → renderer → grading → docs → tests. No
parallel hand-maintained copy can drift, and no type can ship without a
renderer.
