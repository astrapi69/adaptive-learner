# Session journal — 2026-07-19

## 1. Editable exercises in Create-Lesson step 3 (#1844)

- Goal: make each GENERATED exercise in the `/create-lesson` step-3 list
  editable in place (all five types), not just delete/regenerate.
- Verify-first: read the engine `schema/exercise.schema.json` for the exact
  per-type shape (matching `pairs{left,right}`, free_text `accept[]`, cloze
  `sentence` + `blanks[].accept`, word_tiles `tiles[]`, picture_choice
  `images{src,label,is_correct}`), and reused the step-2 inline-edit pattern
  (`CardEditor.SortableCardRow`) + `StringListEditor`.
- Result:
  - New pure lib `lib/content/lesson/exercise-edit.ts`
    (`validateExerciseEdit` / `normalizeExerciseEdit` / `countClozeMarkers`)
    — per-type validation gates + trim/normalize on commit (cloze blanks
    synced to the `___` marker count).
  - New `components/create-lesson/ExerciseEditor.tsx` — inline editor with a
    per-type field renderer; `StringListEditor` reused for free_text accepts
    and cloze blank accepts; `CardImageField` reused for picture_choice src.
  - `ExerciseGenerator` row gains a Pencil edit button that opens the editor
    inline (mirrors the card row); `onUpdate` threaded through
    `WizardSteps` → `CreateLesson`.
  - i18n: `create_lesson.exercises.edit.*` (30 keys) added to all 11
    catalogs (real umlauts in de; native script in el/hi), `make sync-i18n`.
- UI decision: **inline expansion**, not a dialog — matches the existing
  step-2 card row edit, keeps context in the sortable list, and avoids a
  focus-trap modal over an already-list-shaped surface.
- Scope: all five types shipped in one PR (they share one editor shell + one
  `onUpdate` plumbing change, so five PRs would only re-touch the same
  files). In the creator itself only matching + free_text generate from plain
  cards (cloze/word_tiles need example sentences, picture_choice needs card
  images), but the editor supports all five because the AI/book path and the
  #1740 edit-lesson reverse-mapping can carry them.
- Tests (TDD): `exercise-edit.test.ts` (21) pins validator/normalizer per
  type; `ExerciseEditor.test.tsx` (16) pins per-type render + commit +
  validation-blocks; `ExerciseGenerator.test.tsx` gains edit-open/commit/
  cancel + delete regression.
- Device verification: `e2e/dexie/exercise-edit.spec.ts` — real Dexie build,
  Chromium: edit a free-text prompt → play the lesson → the edited prompt
  renders in the player; matching editor round-trips across a reopen; delete
  still removes the row. Existing `lesson-creator.spec.ts` still green.
- Issue: #1844. PR: (see branch `claude/editable-exercises-step-3-rassla`).
