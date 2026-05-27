# Chat Journal — 2026-05-27

Session shipped **v1.29.0** (Phase 45 — Free-Text +
Word-Tiles Exercises, EXP-002 Sprint 3 parts E-F). The
two exercise renderers the v1.28.0 viewer was missing now
ship; pilot French A1 lessons walk end-to-end with all
four exercise types scored.

Three source commits + one release commit + one
post-release docs commit, in atomic-green-commit cadence
identical to Phase 43 + 44.

---

## 1. Pre-flight + decisions

### 1.1 Pre-flight (09:03)

- **Original prompt**: "Go. Option 1. Start Phase 45 — run
  pre-flight and propose the commit plan."
- **Optimized prompt**: same shape — the kickoff prompt
  inherited from the prior session's handover was already
  self-contained.
- **Goal**: confirm v1.28.0 baseline before any source
  edits, surface the four pre-commit decisions the
  handover doc flagged.
- **Result**:
  - HEAD `977b02b` (the handover doc itself, one ahead of
    the journal's `b8a5974` baseline reference).
  - `make test` clean: 930 backend (+1 skipped) + 826
    plugins + 1579 Vitest = 3335 (+1 skipped).
  - `make test-dexie-smoke` 17/17.
  - Read the schema, the matching/picture templates, and
    the dispatcher to ground the proposal in actual code
    shape rather than the handover summary.

### 1.2 Decision proposal (09:08)

- Four decisions surfaced explicitly:
  - **D1**: Levenshtein threshold 1, case-insensitive,
    NFC normalization.
  - **D2**: Defer P-114 AI semantic validation to Phase 46.
  - **D3**: Asset fetching as a separate follow-up phase,
    not bundled into Phase 45.
  - **D4**: Confirm `accept_orderings: null` = canonical-
    only (matches schema docstring).
- User green-lit all four as recommended.

---

## 2. Source commits

### 2.1 Commit 1 — FreeTextExercise (ef43863, 09:16)

- **Goal**: ship the FreeText exercise renderer in
  isolation, NOT wired into the dispatcher yet.
- **Result**:
  - New `frontend/src/components/exercises/FreeTextExercise.tsx`
    with `isFreeTextCorrect(input, accept)` exported as a
    pure matcher for testing.
  - 27 Vitest cases pin the matcher contract
    (case-insensitive + NFC + Levenshtein 1) AND the
    component behaviour (submit lifecycle, Enter key,
    hint toggle, retry, empty-state).
  - 8 i18n keys per catalogue × 8 catalogues = 64 new
    i18n strings, native translations.
  - CSS block added next to picture-exercise in
    `frontend/src/styles/global.css`, mobile-first 44px
    touch floor.
  - TypeScript clean; full `make test` green at
    930 + 826 + 1606 = 3362.
- **Commit**: `ef43863`.

### 2.2 Commit 2 — WordTilesExercise (4383070, 09:23)

- **Goal**: ship the WordTiles tap-to-place renderer in
  the same shape as commit 1.
- **Result**:
  - New `frontend/src/components/exercises/WordTilesExercise.tsx`
    with `isWordTilesCorrect(placed, tileCount, acceptOrderings)`
    exported for direct testing.
  - 25 Vitest cases pin: matcher (8 cases including the
    D4 canonical-only-when-absent rule + the schema's
    "canonical is always accepted even when
    accept_orderings is present" property), 3 render, 3
    tap-to-place lifecycle, 5 submit, 4 hint, 3 edge.
  - Multi-order pilot ("I really love you" with one
    alt ordering [0,2,1,3]) exercises the
    accept_orderings code path end-to-end.
  - 10 i18n keys × 8 catalogues = 80 new strings, native
    translations including German with proper umlauts.
  - CSS block: two stacked tile zones (scrambled bar +
    answer row), `flex-wrap` so tiles wrap on narrow
    viewports. Same 44px touch floor.
  - Tests green at 930 + 826 + 1631 = 3387.
- **Commit**: `4383070`.

### 2.3 Commit 3 — Dispatcher wiring (8441e84, 09:27)

- **Goal**: smallest possible wiring change to make
  Phase 45 user-visible. Append two strings to the
  supported-types set, add two if-branches, two imports.
- **Result**:
  - `frontend/src/pages/Lesson.tsx` diff is the minimal
    set: +2 imports, +2 set entries, +24 LOC for the
    two new if-branches.
  - `frontend/src/pages/Lesson.test.tsx` repurposed the
    pre-existing "placeholder for free_text" test (now
    obsolete because free_text is supported) into four
    new tests:
    - dispatcher routes picture_choice → picture-exercise
      (fills a parity gap that pre-existed Phase 45)
    - dispatcher routes free_text → free-text-exercise
    - dispatcher routes word_tiles → word-tiles-exercise
    - placeholder still fires for FUTURE unknown types
      (defensive regression-pin, simulated via TypeScript
      cast since the type union is closed)
  - Extracted `_renderWithStep(exercise)` helper.
  - `make test` green at 930 + 826 + 1634 = 3390.
  - `make test-dexie-smoke` 17/17 (no new routes, but
    the build needs to succeed with the wired dispatcher).
- **Commit**: `8441e84`.

---

## 3. Release commit (c91e4af, 09:33)

- **Goal**: lock-step version sync + per-release notes.
- **Result**:
  - Hand-edited `backend/pyproject.toml` `1.28.0 → 1.29.0`.
    `make sync-versions` propagated to 17 derived files
    (frontend/package.json + lock, launcher pyproject +
    spec + __init__.py, 10 plugin pyprojects, install.sh +
    install.ps1 regenerated from templates).
  - `make sync-versions-check` + `verify_version_pins.sh
    1.29.0` both clean.
  - Wrote `changelog/releases/v1.29.0.md` (138 lines)
    following the v1.28.0 shape: Why this release / What
    changed / i18n / What's deferred / Upgrade notes.
    Decisions D1-D4 documented explicitly so future
    sessions don't re-litigate.
  - Re-ran `make test` and `make test-dexie-smoke` post-
    sync. Both green. `cd frontend && npm run build`
    succeeded.
- **Commit**: `c91e4af`.
- **Tag**: `v1.29.0` (annotated, local; push happens in
  the next bash batch).

---

## 4. Post-release docs (this commit)

- **Goal**: CLAUDE.md state line + test-count baseline,
  this journal entry, ROADMAP touchpoint.
- **Result**:
  - CLAUDE.md "Current state" rewritten for v1.29.0;
    v1.28.0 paragraph compressed to a one-paragraph
    summary; v1.27.0 paragraph unchanged.
  - CLAUDE.md test baseline line updated to
    `backend 930 (+1 skipped) + plugins 826 + Vitest 1634
    = 3390 tests (+1 skipped)`.
  - CLAUDE.md changelog link bumped to v1.29.0.
  - ROADMAP.md: no Phase 45 items tracked there (the
    spec lives in `docs/explorations/BACKLOG.md`'s flat
    reference table which isn't a checkbox tracker; F-108
    + F-109 + Q-107 + Q-108 closed by this session
    implicitly).
  - This journal entry.

---

## 5. Statistics

| Metric | Start | End | Delta |
|---|---|---|---|
| Backend pytest | 930 (+1 skipped) | 930 (+1 skipped) | 0 |
| Plugin tests (12 suites) | 826 | 826 | 0 |
| Vitest | 1579 | 1634 | +55 |
| **Aggregate** | **3335 (+1 skipped)** | **3390 (+1 skipped)** | **+55** |
| Dexie smoke specs | 17 | 17 | 0 |
| Commits this session | — | 5 | — |
| LOC added | — | ~2100 (incl. 218 i18n) | — |

Phase 45 ships entirely on the frontend. No backend
changes, no Alembic migration, no Dexie schema bump, no
dependency changes, no Phase 45.5 asset-fetching scope
creep.

---

## 6. State at end of session

### Git

```
HEAD:    (post-release docs commit, this entry's commit)
Tag:     v1.29.0 (annotated, awaiting push)
Branch:  main, ready to push to origin
Clean working tree.
```

### Files of interest for Phase 45.5 (asset fetching)

- `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/cache.py`
  — extend `download_set()` to also fetch every
  `assets/{rel_path}` referenced by picture_choice
  exercises in the set's lessons.
- `frontend/src/storage/api/content-loader.ts` +
  `frontend/src/storage/dexie/content-loader-dexie.ts`
  — add an `getAsset(source, setId, rel)` method
  returning a blob URL or fetched bytes.
- `frontend/src/pages/Lesson.tsx` — pass a
  `resolveImageSrc` prop to PictureChoiceExercise that
  resolves to the cached asset URL.
- `frontend/src/db/dexie.ts` — schema v18 adds a
  `contentSetAssets` table keyed
  `{source-slug}#{set_id}#{rel_path}` storing the blob.

### Files of interest for Phase 46 (SRS + AI in exercises)

- `plugins/adaptive-learner-plugin-session/` — the
  existing 7-step session flow's XP / streak / progress-
  commit hooks need a content-loader-aware shape.
- `backend/app/models/__init__.py` — possible new
  `CardReview` table (or extend `StepEvaluation`) for
  per-card SRS scheduling.
- `frontend/src/components/exercises/*Exercise.tsx` —
  if P-114 AI semantic validation lands per Phase 46,
  the four renderers each get an optional `aiValidate`
  prop OR (preferred) the dispatcher injects an
  AI-aware wrapper that intercepts `onComplete`.

### Open decisions for Phase 45.5

- Asset format: blob in Dexie vs base64 string vs URL
  passthrough to GitHub raw?
  - **Dexie blob** preserves offline-first.
  - **URL passthrough** is the cheapest path but
    requires network every reload.
- Total cache size budget: 50 MB hard cap?
- Schema v18 migration shape — the existing
  `contentSets` + `contentSetFiles` tables stay; a
  separate `contentSetAssets` table is cleaner than
  reusing `contentSetFiles` for binary blobs.

### Open decisions for Phase 46

- Per-card SRS schedule storage: extend
  `LessonProgress.step_results` JSON OR a dedicated
  `CardReview` table?
- AI dispatch shape: `aiValidate(input, accept,
  context)` returning `{correct, reason}` — runs at
  the dispatcher layer wrapping the renderer's
  `onComplete`, NOT inside each renderer.
- Lesson summary screen: keep its current local shape
  OR replace with a Phase-46-aware
  "session summary" component that mirrors the AI
  session plugin's post-cycle screen?

---

## 7. Lessons reinforced (no new rules filed)

- **Atomic-green-commit cadence still works** at
  3-source-commit phase size. Each commit individually
  green, each commit minimum diff.
- **Pre-commit decision proposals** (Phase 43 + 44 + 45
  pattern) keep momentum tight. The four-decision
  preamble took ~15 minutes of source-read + proposal
  + user confirmation; the implementation followed
  without re-litigation.
- **i18n catalogues mirror cleanly** when the
  `make sync-i18n` toolchain is the only writer.
  Manual edits never touch the JSON files.
- **Dexie-mode same-commit rule** held trivially here
  because Phase 45 is pure-frontend with no new API
  surface — both storage modes work identically. The
  v1.26.1 rule's discipline pays off as long as
  every new API-calling feature routes through
  `getStorage()` OR ships a friendly Dexie fallback.

---

## 8. Things to verify in the new session before any code

```bash
git log --oneline -5
git status --short
make test                  # expect 930 backend + 826 plugins + 1634 Vitest
make test-dexie-smoke      # expect 17/17 green
```

If any baseline doesn't match, STOP and investigate
before proceeding with Phase 45.5 or Phase 46.

---

End of journal entry for 2026-05-27.
