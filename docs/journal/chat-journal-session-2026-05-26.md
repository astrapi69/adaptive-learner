# Chat Journal — 2026-05-26

Session shipped **three releases** (v1.26.1, v1.27.0, v1.28.0)
covering the public-deploy hardening + the first two halves of
the Content-Repository pivot. The GitHub Pages deployment now
works without an API key for the first time.

This entry doubles as a **handover document**: state, decisions
made (with rationale), gotchas, and the cleanest path into
Phase 45.

---

## Releases shipped today

| Tag | Phase | Headline |
|---|---|---|
| **v1.26.1** | post-Phase 42 patch | Dexie-mode crash fix + Dev Mode + friendly error mapping + Dexie release gate |
| **v1.27.0** | Phase 43 (Sprint 2) | Content-Loader plugin: download + cache lesson sets from public GitHub repos |
| **v1.28.0** | Phase 44 (Sprint 3 A-D) | Lesson viewer + matching + picture-choice exercises |

Test counts: started at 3061, ended at **3335** (+274 across all
three releases). Dexie smoke gate: 0 → 17 specs.

---

## 1. v1.26.1 — Public-deploy hardening

### What

Three protection layers on top of the v1.26.0 Phase 42 crash
fix:

1. **Dexie-mode crash fix** (commit `57aa243`): the Phase 42
   Learning Repository components called `api.*` unconditionally
   and 404'd on every GH-Pages visit. Gated each surface
   (`LearningRepoSettings`, `LearningRepo` page,
   `LearningRepoWidget`) on `resolveStorageMode()` with a
   friendly "only available in server mode" notice.

2. **Developer Mode + friendly errors** (commits `3c6db37` +
   `3eae5e4`):
   - New `useDevMode` hook + Settings toggle + nav `DEV` badge
     (off by default).
   - `notify.error()` now splits `displayMessage` from
     `originalMessage`. Production users see status-code-mapped
     friendly text (`ui.errors.404` → "This page or feature
     was not found.") instead of HTTP details. Dev-mode users
     see the technical message. The `ErrorReportDialog` always
     receives the technical message for the GitHub issue body.
   - 10 friendly error strings × 8 catalogues.

3. **Dexie-mode release gate** (commit `7483a6d`): new
   `make test-dexie-smoke` builds with `VITE_STORAGE_MODE=dexie`
   and runs 15 Playwright specs against a `vite preview` static
   server (no backend). Aggregated into `make release-test` as
   MANDATORY. Filed `.claude/rules/lessons-learned.md` rule
   **"Dexie-mode is part of the contract: same-commit or not
   at all"** — any new API-calling feature must route through
   `getStorage()` OR ship a friendly Dexie-mode fallback in
   the same commit.

### Files of note

- `frontend/src/hooks/useDevMode.ts` + `setDevModeEnabled` setter
- `frontend/src/utils/errorMessages.ts` — status-code → friendly key mapping
- `frontend/src/hooks/useI18n.ts` — exported `resolveI18n(key, fallback)` for non-React modules
- `e2e/dexie/dexie-mode.spec.ts` + `e2e/playwright.dexie.config.ts`

---

## 2. v1.27.0 — Phase 43, Content-Loader plugin

### What

A new plugin `adaptive-learner-plugin-content-loader` that
downloads structured lesson sets from public GitHub repos and
caches them locally. Works in both API mode (filesystem cache)
and Dexie mode (IndexedDB cache).

Nine atomic commits, ~3,500 LOC across backend + frontend +
i18n + pilot content + tests.

### Architectural decisions

1. **Cache location**:
   `get_cache_dir() / "content-loader" / {owner--name} / {set_id} / v{version} /`
2. **Source slug** = `owner/name` → `owner--name` (slash →
   double-hyphen). Same shape in filesystem and IndexedDB.
3. **GitHub adapter**: token-optional. Public repos work
   tokenless via `raw.githubusercontent.com`. Token resolution
   via three-layer secrets chain
   (env > `~/.config/adaptive_learner/secrets.yaml` > Fernet DB
   — Fernet layer deferred, returns `None`).
4. **Pilot content** lives at
   `docs/explorations/sample-content/fr-a1/` — Aster creates
   the actual `astrapi69/adaptive-learner-content` repo
   manually (D-105 still open).
5. **Set Browser** at `/content`; nav entry only (not
   default landing).
6. **Mode badge** rides with Content-Loader (P-113 + F-104
   folded into Phase 43; no separate Phase 47).

### Hookspecs (conceptual, not formally declared)

The plugin owns these three responsibilities via its routes;
formal `backend/app/hookspecs.py` declarations were not added
in Phase 43:

- `content_list_sets()` → list available + cached sets
- `content_download_set(source, set_id)` → fetch + cache
- `content_get_lesson(source, set_id, filename)` → resolve

When a future plugin needs to compose with the Content-Loader,
the natural shape would be to formalise these as hooks.

### Schema v1.0 (`adaptive_learner_content_loader.schema`)

Closed enums + frozen Pydantic models:

- `ExerciseType`: `matching` | `picture_choice` | `free_text` | `word_tiles`
- `StepType`: `theory` | `exercise`
- `Card`: id, front, back, optional notes/image/audio/tags
- `Exercise`: type-tagged with flat per-type fields:
  - MATCHING: `pairs: [{left, right}]`
  - PICTURE_CHOICE: `images: [{src, label, is_correct?: "true"}]`
    — the string literal `"true"` is load-bearing (Pydantic
    image dicts are `dict[str, str]`)
  - FREE_TEXT: `accept: [...]`
  - WORD_TILES: `tiles: [...]` + optional `accept_orderings: [[...]]`
- `LessonStep`: theory-body XOR exercise (enforced by model
  validator)
- `Lesson`: cards + ordered steps + referential-integrity check
  (every `exercise.card_ids` ref must exist in `cards`)

### Pilot content (D-105 manual step)

`docs/explorations/sample-content/fr-a1/`:
- `manifest.yaml` (repo root)
- `sets/language-fr-a1/manifest.yaml`
- `sets/language-fr-a1/lessons/01-greetings.json` (5 cards, 7 steps)
- `sets/language-fr-a1/lessons/02-numbers.json` (10 cards, 7 steps)
- `validate.py` — CI template; the actual content repo will run
  this same script in GitHub Actions

Both lessons use **all four exercise types** so the schema is
exercised end-to-end.

**TO DO (Aster, manual)**: create `astrapi69/adaptive-learner-content`
on GitHub, copy this whole directory tree to the repo root,
push to `main`. The Content-Loader's default source pin already
points there.

---

## 3. v1.28.0 — Phase 44, Lesson viewer + Matching + Picture-Choice

### What

Seven atomic commits. The Content-Loader from v1.27.0 now has a
viewer — users can open a downloaded set, walk through theory +
exercise steps, complete the two shipping exercise types
(matching + picture-choice), and see a summary screen with
their score + time spent.

### Architectural decisions (confirmed before code)

1. **Parallel `LessonProgress` system** (not integrated with the
   session plugin). The session plugin's 7-step AI-driven flow
   and the content-loader's N-step deterministic flow differ
   enough that unifying them is a Phase 46 concern (when SRS
   lands).
2. **Auto-skip unsupported exercise types** with a "Coming in
   v1.29.0" placeholder + Skip button so lessons stay
   completable.
3. **Route shape**: `/lesson/:setSlug/:setId/:filename`.

### Data model

New SQLAlchemy `LessonProgress` model + Alembic migration
`0018_lesson_progress`:

```
lesson_progress
├── id (uuid)
├── user_id (FK users, ondelete=CASCADE)
├── source, set_id, lesson_filename (composite UQ)
├── status: "in_progress" | "completed"
├── step_results (Text, JSON-encoded {step_id: {correct, total, attempts, completed_at}})
├── score_correct, score_total
├── time_spent_seconds
├── started_at, updated_at, completed_at
```

Service layer recomputes the aggregate score from
`step_results` on every upsert so the wire shape always
reflects the merged state.

### Frontend architecture

- New `IStorageService.lessonProgress` namespace on both
  `ApiStorage` (delegates to `/api/users/{id}/lesson-progress`)
  and `DexieStorage` (via `lesson-progress-dexie.ts`, composite
  key `{user_id}#{source-slug}#{set_id}#{filename}`).
- Dexie schema v17 adds `lessonProgress` table.
- `useLesson` hook combines `getStorage().contentLoader.getLesson` +
  `lessonProgress.get/upsert` + step-navigation state.
  Discriminated-union status (`loading` / `not-cached` / `ready` /
  `error`).
- `useLesson.recordStepResult(...)` persists per-step results
  via `lessonProgress.upsert`. The hook tracks per-step
  wall-clock time via `performance.now()` + a ref so the
  summary screen reads correctly.
- `lesson-anchors.ts` rewrites `theory.md#step-id` links to
  `#lesson-step-{id}`; the Lesson page's custom Markdown `a`
  component intercepts the click and calls `goToStepById`.

### Viewer page

`/lesson/:setSlug/:setId/:filename`:
- 4 load-state branches with stable testids:
  `lesson-loading` / `lesson-not-cached` / `lesson-error` /
  `lesson-page`.
- Progress bar `Step N of M` / `Summary`.
- Theory → react-markdown with the existing pipeline.
- Exercise → `ExerciseDispatcher` routes to MatchingExercise
  or PictureChoiceExercise; unsupported types render the
  placeholder.
- Summary card: score + time + mark-complete / start-over /
  back-to-browser buttons.

### Exercise components

- **MatchingExercise**: two-column tap-to-pair (deterministic
  shuffle keyed by exercise id). Reports `{correct, total}` on
  submit. Try-again resets.
- **PictureChoiceExercise**: 4-column grid (2-column on
  mobile). Graceful text-only fallback when `<img onError>`
  fires — useful because the Phase 43 download orchestrator
  **does NOT fetch `assets/`**. Picture-choice tiles currently
  render in text-only mode for every pilot exercise. The
  exercise stays playable; each image carries a textual label.

### Test count at end of v1.28.0

```
Backend pytest:     930 (+1 skipped)
Plugin tests:       826 (across 12 plugins)
Frontend Vitest:    1579
Dexie smoke gate:   17/17
Aggregate:          3335 (+ 1 skipped)
```

---

## 4. Architectural patterns proven across the three releases

### Atomic-green-commit cadence

Every commit kept `make test` green individually. Seven-commit
shape is comfortable for a phase the size of Phase 43 or 44:

1. Data model + storage namespace (foundation)
2. Loader / hook (read path)
3. Page shell + i18n + Dexie smoke gate update
4. Exercise component A
5. Exercise component B
6. Wire components into the viewer / dispatcher
7. Release bump + tag + publish

### Decision-confirmation discipline

For substantial phases, "If unsure: STOP and ask" — the prompt
+ user reply pattern preserves momentum without re-litigating
choices later. Phase 43 + 44 each opened with a written
decision proposal that the user green-lit before any code.

### Dexie-mode same-commit rule

Filed into `lessons-learned.md` after the v1.26.0 incident.
Every API-calling feature in Phase 43 + 44 routes through
`getStorage()` so both storage modes work. The smoke gate
catches future drift.

### i18n discipline

All 8 catalogues (de/el/en/es/fr/ja/pt/tr) updated in lockstep.
Native translations (not EN-passthrough) for short
user-visible strings. `make sync-i18n` mirrors to
`frontend/src/data/i18n/*.json`. Real umlauts (ä/ö/ü/ß) in DE.

### Mobile-first

44px touch targets enforced via `min-height: 44px` on every
interactive button. CSS grid columns collapse to single-column
under 600px viewport. Exercise components specifically:
matching collapses 2-col → 1-col, picture-choice collapses
4-col → 2-col.

---

## 5. Gotchas + IDE static-analysis false positives (recurring)

These come up in every plugin commit. They're false positives;
runtime tests pass via the Makefile target which uses the
correct venv.

### IDE diagnostics that look scary but aren't

| Diagnostic | Reality |
|---|---|
| `pytest`: Cannot find module | Pytest is in the backend venv (`PLUGIN_PYTHON`), not site-packages. Tests run fine via `make test-plugin-{name}`. |
| `app.exceptions` / `app.paths`: Cannot find module (inside plugin code) | Plugin runs inside backend venv at runtime where backend's `app.*` is on sys.path. Mirrors `learning-repo` plugin's pattern. |
| Pydantic kwargs: `Unexpected keyword argument 'unknown_field'` in tests | Intentional negative tests for `extra="forbid"`. Pydantic accepts kwargs at runtime then validates. |
| Parameter `client` unused | TestClient fixture is load-bearing for the lifespan even when the test body doesn't reference it. |
| `LessonProgress` Import unused (after first add) | Will be consumed by the upcoming `TableSpec` entry. |

### Real footguns

1. **`AdaptiveLearnerError` signature** takes `detail` as the
   FIRST positional arg, optional `extra` dict kwarg. Don't
   pass `(message, detail=detail)` — passes `detail` twice.
   The correct shape: `NotFoundError(err.detail)`.

2. **POST `/api/users` returns 201**, not 200. New tests should
   `assert response.status_code in (200, 201)`.

3. **Adding a new SQLAlchemy model = three test updates**:
   - Add `TableSpec` to `app.services.sync_service.TABLES`
   - Add table to `EXPECTED_TABLES` in
     `tests/test_initial_migration.py`
   - Add to `EXPECTED_MUTABLE` (or `EXPECTED_APPEND_ONLY`) in
     `tests/test_sync_surface_audit.py`
   Forgetting any of these turns the suite red.

4. **Dexie test isolation**: `_resetDbForTests()` only closes
   the connection. To wipe data between tests, explicitly
   `.clear()` each new table:

   ```typescript
   beforeEach(async () => {
       const db = getDb();
       try { await db.lessonProgress.clear(); } catch {}
       await _resetDbForTests();
   });
   ```

   Don't rely on `globalThis.indexedDB = new IDBFactory()`
   alone — Dexie can capture the old factory reference at
   construction time and read from the prior engine.

5. **Plugin venv**: every new plugin needs `cd plugins/{name}
   && poetry lock` AFTER the path-dep lands in
   `backend/pyproject.toml`. Without the lockfile, CI's
   per-plugin `poetry install` aborts with "pyproject changed
   significantly since poetry.lock". (See the
   `PLUGIN-LOCKFILE-DRIFT-01` lessons-learned rule.)

6. **`app.yaml` is gitignored, `app.yaml.example` is tracked**.
   Add new plugin to BOTH `plugins.enabled` lists; otherwise
   CI runs the example shape and the new plugin doesn't load.
   (Drift trap from the earlier coverage-workflow incident.)

7. **i18n key dot-notation vs YAML structure**: `t("repo.settings.error.load")`
   walks `strings.repo.settings.error.load` but the YAML uses
   underscored leaves (`settings_error_load`). The existing
   `repo.*` keys are a known cosmetic drift; the fallback
   strings via `t(key, fallback)` save the user from broken
   UI. New keys (Phase 44 `lesson.*`) use the cleaner nested
   structure that matches the dot-notation lookup.

8. **Image-asset fetching is a known gap**. The Content-Loader
   downloads only lesson `.json` files; `assets/{rel_path}`
   referenced by picture-choice exercises is NOT fetched.
   Picture-choice handles this via `<img onError>` text-only
   fallback. Phase 45 is the natural place to add asset
   fetching (or split as its own small follow-up).

---

## 6. State at end of session

### Git

```
HEAD:    b8a5974 (docs: post-release v1.28.0 documentation update)
Tag:     v1.28.0
Branch:  main, pushed to origin
Clean working tree.
```

### Files of interest for Phase 45

- `frontend/src/components/exercises/MatchingExercise.tsx` —
  template for the new free-text + word-tiles components
  (same `onComplete({correct, total})` contract)
- `frontend/src/components/exercises/PictureChoiceExercise.tsx` —
  template for text-input handling + fallback
- `frontend/src/pages/Lesson.tsx` — the `ExerciseDispatcher`
  is where the new components plug in. The
  `SUPPORTED_EXERCISE_TYPES` set needs `"free_text"` +
  `"word_tiles"` added when their components land.
- `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py` —
  schema fields the renderers consume:
  - FREE_TEXT: `accept: list[str]`, `hint?`, `distractors`
  - WORD_TILES: `tiles: list[str]`, `accept_orderings?: list[list[int]]`, `hint?`, `distractors`
- `e2e/dexie/dexie-mode.spec.ts` — extend with any new route
  if Phase 45 adds one (probably not; same `/lesson/...`
  route).

### Open backlog items (P0)

From `docs/backlog.md`:

- **PHASE-42-STORAGE-ABSTRACTION-01** — proper port of
  Learning Repository to `IStorageService`. Still open. Not
  blocking anything; the friendly fallback + smoke gate
  protect users.

From the Phase plan (the original Phase 43 prompt):

- **Phase 45**: Free-text + Word-tiles exercise renderers →
  v1.29.0 (Sprint 3 parts E-F)
- **Phase 46**: Lesson summary + SRS integration → v1.30.0
  (Sprint 3 part G — XP/streak/progress unification with
  the session plugin)

### What to do FIRST in the new session

1. `git log --oneline -10` — confirm `b8a5974` is HEAD.
2. `make test` — confirm 3335 (+1 skipped) baseline.
3. Read this journal entry.
4. Read `.claude/rules/lessons-learned.md`'s
   "Dexie-mode is part of the contract" rule.
5. Phase 45 kickoff prompt has its own scope + decisions —
   propose the commit plan before writing code.

---

## 7. Suggested Phase 45 shape (informed by Phase 44)

Per the original plan: free-text + word-tiles, tag as v1.29.0.

### Free-text scope

- `<FreeTextExercise>` component.
- Single text input. User types, hits Submit.
- Validation: exact match against `exercise.accept` first;
  Levenshtein fallback (typo tolerance, threshold ≤ 2 chars)
  for content-only mode.
- AI-augmented mode: out of scope for Phase 45 per
  EXP-005 split (P-114 is exercise-specific dual-mode work;
  it's natural to fold into Phase 45 OR defer to Phase 46
  alongside SRS).
- Wrong attempt → show correct answer + Try-again button.
- Mobile-first: input full-width, Submit button stretches.

### Word-tiles scope

- `<WordTilesExercise>` component.
- Tiles displayed shuffled. User taps to place into the
  answer slot (top), then taps a placed tile to return it.
- `accept_orderings` supports multiple correct orderings;
  empty list means only the canonical `tiles` order is right.
- Tap-to-place precedent set by MatchingExercise; no DnD
  library needed.
- Reports `{correct: 0|1, total: 1}`.

### Dispatcher wiring

Add `"free_text"` + `"word_tiles"` to the
`SUPPORTED_EXERCISE_TYPES` set in `Lesson.tsx`. Phase 44's
placeholder fallback then disappears for these types.

### Suggested commit cadence

5 atomic commits + 1 release commit:

1. FreeText exercise component (+ i18n)
2. Word-tiles exercise component (+ i18n)
3. Wire into dispatcher (small)
4. **Optional side-quest**: asset fetching for picture-choice
   (Phase 43 download orchestrator + Dexie cache extension).
   This makes the pilot picture-choice tiles render real
   images instead of text fallback. Small in scope (~200 LOC)
   if the user wants it bundled.
5. (CSS / docs / Dexie smoke nudges)
6. Release v1.29.0

After Phase 45, all four exercise types ship. Phase 46
(Lesson Summary + SRS) is the next architecturally distinct
unit.

### Pre-commit decisions Phase 45 should confirm

1. **Levenshtein threshold for free-text**: 1, 2, or
   percentage-based?
2. **AI semantic validation in free-text**: in Phase 45,
   or defer with the rest of P-114 to Phase 46?
3. **Asset fetching side-quest**: fold in or leave out?
4. **Word-tiles edge case**: if `accept_orderings` is empty,
   ONLY the canonical `tiles` order is correct — confirm
   per the schema, but worth re-checking with the user.

---

## 8. Lessons-learned rules touched this session

Added or updated in `.claude/rules/lessons-learned.md`:

- "Dexie-mode is part of the contract: same-commit or not at
  all" (v1.26.1)

Confirmed via repeated practice:

- "Articles-vs-Books parallel-surface asymmetry" doesn't apply
  here (no Books/Articles concept), but the spirit — every
  feature gets parallel storage-mode coverage — drove the
  Phase 43/44 design.
- "End-to-end behavior tests are not 'kwarg passes through'
  tests" — Phase 43 commit 6's TestClient round-trip + Phase
  44's `useLesson` mock-storage tests both follow this.

---

## 9. Things to verify in the new session before any code

Confirming the pre-flight discipline still works:

```bash
git log --oneline -5
git status --short
make test                  # expect 930 backend + 826 plugins + 1579 Vitest
make test-dexie-smoke      # expect 17/17 green
```

If any of these don't match the expected baseline, STOP and
investigate before proceeding.

---

End of journal entry for 2026-05-26.
