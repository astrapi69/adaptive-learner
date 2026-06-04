# Shared CSS cleanup — post exercise-renderer migration

**Date:** 2026-06-04
**Branch:** `feature/shared-css-cleanup`

After the exercise renderers moved to Tailwind, this audit checked the
shared `global.css` classes that *might* have become unused — the ones
the task named (`exercise-prompt-row`, `exercise-direction-instruction`,
`answer-feedback`, `cloze-sentence-code`, `btn*`) plus a full sweep of
every class selector in `global.css`.

## Method

For each class: `grep` across **all** `frontend/src/**/*.{tsx,ts}`
(components + tests), including string/template literals so
dynamically-built class names (`badge--${difficulty}`) are counted.
Zero real usages ⇒ delete. Any usage by an unmigrated component ⇒ keep.

## Named classes — ALL still used (KEEP)

| Class | Used by | Verdict |
|---|---|---|
| `exercise-prompt-row` | all 5 exercise renderers (prompt + read-aloud row) | **KEEP** |
| `exercise-direction-instruction` | `DirectionInstruction` + `MatchingExercise` | **KEEP** |
| `answer-feedback` (+ `.is-correct/.is-wrong/svg/-praise`) | `AnswerCelebration` + all 5 renderers + `Lesson.tsx`; supplies the correct/wrong **celebration animation** (the renderers keep the `is-correct`/`is-wrong` markers for it) | **KEEP** |
| `cloze-sentence-code` | `ClozeExercise` (code-mode font) + asserted in `ClozeExercise.test` | **KEEP** |
| `btn`, `btn-primary`, `btn-secondary`, `btn-danger`, `btn-spinner` | 212 / 69 / 62 / 2 / 2 usages across Settings, Backup, GitHub, Danger Zone, Curriculum, … (unmigrated) | **KEEP** |

The exercise migration deliberately **kept** these because they are
shared — and they are all still consumed by unmigrated components. The
renderer-specific CSS (`picture-*`, `matching-*`, `free-text-*`,
`word-tile*`, the cloze blanks) was already deleted in the migration
commits; nothing of it remains.

### Note (out of scope, flagged not fixed)

`btn-link` (5 usages) and `btn-sm` (1 usage) are referenced by
components but have **no** `global.css` definition — they are no-ops
that fall back to plain `.btn`. That is the *opposite* of dead CSS
(used-but-undefined), so it is not a cleanup target; left as-is.

## Full sweep — genuinely dead CSS REMOVED

A scan of all 611 class selectors flagged 32 zero-match candidates.
Vetting each: 29 are **false positives** — dynamically constructed
(`api-key-format-${state}`, `api-key-source-${source}`,
`badge--${difficulty}`, `lesson-node--${status}`,
`streak-cell--tier-${n}`, `nav-mode-badge-${mode}`,
`diff-marker-${kind}`, `content-source-*`, `content-share-*`) or
**xyflow library** runtime classes (`react-flow*`, applied by
`@xyflow/react` itself in the Graph view, not by our code).

**3 classes were genuinely dead and were removed:**

| Removed | Why it died |
|---|---|
| `.xp-widget__bar` | The XP bar was migrated to the shadcn `<Progress>` component in the Phase D gamification work (`dbe0adf5`); `XPWidget.tsx` now renders `<Progress className="my-1 h-2">`, so the old bar `<div>`s + their CSS are orphaned. |
| `.xp-widget__bar-fill` (rule + its `prefers-reduced-motion` `transition: none` override) | same — the fill `<div>` no longer exists. |
| `.api-key-last-test` | Zero references anywhere (component or test); orphaned by an earlier API-key Settings rework. |

Sibling XP classes that ARE still used (`.xp-widget`, `.xp-widget__header`,
`.xp-widget__level`, `.xp-widget__total`, `.xp-widget__footer`,
`.xp-notification*`) were kept.

## Result

- **Removed:** 3 dead rules (`xp-widget__bar`, `xp-widget__bar-fill` +
  its reduced-motion override, `api-key-last-test`).
- **Kept:** every task-named shared class (all still used) + every
  defined `btn*` + all dynamically-applied + xyflow classes.

No component or test referenced the removed classes, so behavior is
unchanged. `make`-level build + the `no-hardcoded-colors` / theme
guards + full Vitest stay green.
