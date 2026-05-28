# Handover — after v1.33.0, before v1.34.0

**Written**: 2026-05-28 (end of Phase 50 session).

This document is the cold-pickup brief for the next session.
Anyone (or any model) reading this should be able to start work
on v1.34.0 without needing the prior conversation context.

---

## 1. What just shipped: v1.33.0

**Phase 50 — Dexie-Mode Lesson-XP Parity + i18n Repo-Key Fix +
Bibliogon-Residue Cleanup**. Three concurrent items closed
together (D-DEXIE-GAMIFICATION + the v1.26.0 dotted-path i18n
bug + the long-overdue Bibliogon-residue purge in
``.claude/rules/``).

Full per-release detail:
``changelog/releases/v1.33.0.md``. Per-commit detail in the
commit messages; the kickoff prompt is at
``docs/journal/kickoff-v1.33.0.md`` and remains useful as a
template for any future Phase that combines multiple themes
in one release.

### Test counts (the new baseline)

```
Backend pytest:     1002 (+1 skipped)
Plugin tests:       850 (12 suites; +4 from Phase 50A-C parity)
Vitest:             1895 (+21 from Phase 50 + B1)
Aggregate:          3747 (+1 skipped)
Dexie smoke gate:   18/18
```

### What landed (14 atomic + 1 release commit)

- **50A** — Lesson-XP parity fixture + Python goldens. 10
  ``compute_stars`` cases + 13 ``calculate_xp`` cases +
  per-case golden JSON files. Regen via
  ``LESSON_XP_PARITY_REGEN=1``. +2 pytest.
- **50B** — TypeScript lesson-XP rule. ``computeStars`` +
  ``calculateLessonSessionXp`` at
  ``frontend/src/lib/gamification/lesson-xp.ts``, plus banker's-
  rounding helper for parity with Python's ``round()``. **Parity
  passed on the first run**. +3 Vitest.
- **50C** — TypeScript streak + first-attempt helpers.
  ``currentStreakDays`` (Set<string> of ISO dates) +
  ``isFirstAttempt`` (raw JSON string). Python side: extracted
  ``is_first_attempt_from_step_results`` pure helper from the
  DB-aware wrapper. Added 9 streak + 15 first-attempt cases to
  the shared fixture. +2 pytest, +2 Vitest.
- **50D** — Dexie-mode lesson-XP on completion.
  ``awardLessonXpDexie`` + ``DexieStorage.lessonProgress.upsert``
  detects the in_progress→completed transition. Try/catch around
  the gamification side so a failure can't break a lesson
  completion (same defensive shape as the session-end wiring).
  +8 Vitest.
- **50E** — 4 lesson-badge predicates in TS.
  ``first_lesson`` / ``lessons_10`` / ``three_star_streak`` /
  ``review_master`` added to ``BUNDLED_BADGES`` (catalog now 28
  entries). 3 new helpers + 7 round-trip tests. Catalog length
  pin updated 24 → 28. +7 Vitest.
- **B1** — i18n repo.* key restructure. 23 flat keys nested
  under their dotted-path subsections in all 8 catalogs.
  Renderer-flat keys preserved. ``make sync-i18n`` regenerated
  the frontend JSON. New regression-pin test walks every dotted
  path the frontend calls. +1 Vitest.
- **C1** — Backlog hygiene. PHASE-42-STORAGE-ABSTRACTION-01
  marked closed + archived (was the last open P0). 17 BL-XX
  ``[x]``-items moved to ``docs/roadmap-archive/2026-05.md``.
  Active files now contain only open ``[ ]`` work. No code.
- **D1** — Removed BISAC/KDP § 2.5 from both handovers + the
  kickoff doc. Bibliogon-domain item (no Book model in Adaptive
  Learner) silently carried over for several releases.
- **D2** — Rewrote ``.claude/rules/architecture.md`` for the
  Adaptive Learner domain (no more "Book authoring platform" /
  "Chapter.content field" / ".bgb file formats" / "@dnd-kit
  chapter sorting"). React 19 + TypeScript 6 + Vite 8 + Dexie 4
  stack; dual-storage abstraction section; correct 13-route page
  list.
- **D3** — Swept the other 5 rules files
  (``coding-standards.md`` / ``code-hygiene.md`` /
  ``quality-checks.md`` / ``release-workflow.md`` /
  ``ai-workflow.md``) for inline Bibliogon examples
  (Book/Chapter/Pandoc/manuscripta/audiobook/LanguageTool/KDP).
- **D4** — Aggressive ``lessons-learned.md`` Bibliogon purge.
  **3415 → 1610 lines / 53% reduction**. Deleted 27 sections
  that were either pure Bibliogon-domain or had examples so
  Bibliogon-specific that the universal principle was buried.
  Surgical edits in surviving sections to replace remaining
  Bibliogon inline refs.
- **D5** — De-Bibliogon ``.claude/prompts/audit.md``. Header
  rewritten; TipTap-storage rule clarified for the actual
  ``SessionNote.body`` / ``Curriculum.description`` /
  ``Lesson.content`` fields; deployment ports corrected.
- **release** — version bump + ``make sync-versions`` (18 files)
  + changelog + tag ``v1.33.0`` (annotated).
- **post-release** (this commit) — CLAUDE.md + this handover.

---

## 2. What's open: candidates for v1.34.0

The v1.33.0 kickoff explicitly named v1.34.0 as the **content
expansion** release — 8 new French A1 lessons + 5 Spanish A1
pilot lessons. That was deferred from the start of the v1.33.0
session because the bugs/gaps in this release were more urgent
for current users.

### 2.1 More content (deferred to v1.34.0 from the v1.33.0 kickoff)

The content-loader infrastructure shipped in v1.27.0 (Phase 43)
+ lesson viewer + 4 exercise types (Phase 44-45) + SRS (Phase
46A-D) + lesson-XP for both storage modes (Phase 46E.1 +
Phase 50D). The pipeline is fully shipped. What's missing is
real content beyond the 2-lesson FR-A1 pilot at
``docs/explorations/sample-content/fr-a1/``.

The kickoff document spelled out a full plan:

- **French A1 Lessons 3-10** (8 new lessons): Articles,
  être/avoir, presentations, family, colors+clothing,
  restaurant, directions, passé composé.
- **Spanish A1 pilot** (5 new lessons): Saludos, Números/hora,
  Artículos/género, Ser/estar, En el restaurante.

Each lesson: 3-5 theory steps + 8-12 exercises across all 4
exercise types (matching, picture choice, free text, word
tiles), pedagogically progressive (vocabulary reuse, grammar
escalation), plausible distractors. ~200-300 lines JSON each.

Once the content lands at
``docs/explorations/sample-content/{fr-a1,es-a1}/`` it can be
copied into the future
``astrapi69/adaptive-learner-content`` repo for the content-
loader to consume directly.

### 2.2 Generic plugin-settings UI (D-plugin-settings-ui)

Still open from the v1.33.0 handover. The
``LearningRepoSettingsSection`` is the only component using the
new ``pluginSettings`` namespace. Other plugins have their own
ad-hoc settings UIs or no UI at all. A generic plugin-settings
UI driven by the bundled plugin-config JSON (with type inference
from the values: boolean → checkbox, string → text, integer →
number) would turn the new namespace into a real platform
feature. The 3 plugins with config that would benefit:
gamification (badge thresholds, XP rules), content-loader (cache
size, GitHub token slot), session (model overrides, streaming
opt-in).

### 2.3 EXP-013 Adaptive Lektionen Stufe 3 (carry-over)

Same as the v1.33.0 handover. Stufe-3 work beyond the v1.30.0
SRS foundation:
- Per-element grouping in the review session ("3 you struggle
  with from lesson 2; 2 from lesson 7") instead of flat priority
  order.
- Per-element progress visualisation on the Dashboard.
- AI-assisted hints when the same element fails 5+ times.

### 2.4 Dedup the duplicate ``currentStreakDays`` / banker's-rounding helpers

Phase 50D's commit message flagged a known DRY violation that
this release deliberately did NOT fix: ``currentStreakDays``
exists at three locations now —
``frontend/src/storage/gamification.ts:59`` (session-XP, v1.16.0),
``frontend/src/lib/gamification/streak.ts`` (lesson-XP, new in
Phase 50C), and ``frontend/src/storage/tracking.ts:78`` (a
third local copy). ``bankersRound`` similarly duplicated in
gamification.ts and lesson-xp.ts. New code consumes the
canonical ``lib/gamification/`` versions; existing session-XP
code keeps its local copies. A future small refactor can
converge them.

### 2.5 ``verify_version_pins.sh`` reminder line still mentions manuscripta

``scripts/verify_version_pins.sh`` prints a reminder at the
end:

```
Reminder: external AdaptiveLearner-owned deps (manuscripta,
pluginforge) are NOT auto-synced.
```

The Phase D3 sweep removed ``manuscripta`` references from the
rules + the release-workflow checklist, but the verify-script
helper text still names it. One-line edit; pick up alongside
the next release.

---

## 3. Architectural decisions still in force

Phase 50 added three:

| ID | What | Status |
|----|------|--------|
| **D-DEXIE-GAMIFICATION** | Lesson-XP runs locally in Dexie mode via parity-tested TS port | **CLOSED** by v1.33.0 / Phase 50 |
| **D-PARITY-FIXTURE-PATTERN** | Cross-language ports use shared fixture + per-case goldens + regen-via-env-var | New. Phase 49F + 50A-C both used this with zero drift. Reusable for any future port. |
| **D-RULES-DOMAIN-COHERENCE** | ``.claude/rules/`` describes Adaptive Learner, not Bibliogon | New. Audit checkpoint: ``grep`` for Bibliogon-residue keywords; zero matches required. |

Carry-over from v1.33.0 handover (one closed, one open, one renamed):

| ID | What | Status |
|----|------|--------|
| **D-DEXIE-GAMIFICATION** | (see above) | **CLOSED** by Phase 50 |
| **D-plugin-settings-ui** | Generic plugin-settings UI | Still open. See § 2.2. |

---

## 4. Gotchas + recurring false positives

Most of the IDE static-analysis false positives from prior
handovers still apply. Pattern unchanged.

### 4.1 IDE static-analysis false positives (ignorable)

| Diagnostic | Reality |
|---|---|
| `pytest`: Cannot find module | Backend venv issue. Tests run fine via `make test*`. |
| `sqlalchemy` / `sqlalchemy.orm`: Cannot find module | Same. |
| `alembic` / `alembic.config`: Cannot find module | Same. |
| `app.models` / `app.database` (in plugin code) | Plugin runs inside the backend venv at runtime where backend's `app.*` is on sys.path. |
| Parameter `client` unused (in pytest) | TestClient fixture is load-bearing for the lifespan. |

### 4.2 Real footguns surfaced this session

1. **Parity-test fixture leakage in Vitest with fake-indexeddb**:
   the IDBFactory swap + Dexie singleton close+reopen does not
   fully wipe cross-test data. Two test files in this session
   (lesson-xp-dexie.test.ts + the lesson-badges section of
   badges.test.ts) needed explicit ``await db.table.clear()``
   calls in their nested beforeEach blocks. Pattern documented
   in the lesson-xp-dexie test comments.
2. **archive_completed_task.py regex doesn't recognize
   multi-segment task IDs**: ``DONE_RE`` is
   ``^\s*-\s*\[x\]\s*\*\*([A-Z]+-[0-9]+[a-z]*)\*\*:?\s*(.*)$``
   — captures ``PHASE-42`` from ``**PHASE-42-STORAGE-ABSTRACTION-01**``,
   then the trailing closing ``\*\*`` doesn't match because the
   literal ID has more dashes. Result: ``--id`` lookups fail
   silently. Worked around manually in C1. Filed in this
   handover for a future regex fix.
3. **Python rounding ≠ JS rounding on exact-N.5 results**:
   Python's ``round()`` uses banker's rounding (round half to
   even); JavaScript's ``Math.round`` rounds half-away-from-zero.
   The lesson-XP formula multiplies a positive int by a
   multiplier in {1.0, 1.25, ..., 2.75} — most products are
   integers, but cases that hit exactly N.5 (e.g. 30 × 1.75 =
   52.5) would have diverged. Phase 50B's ``pythonRound``
   helper protects against this. Apply the same pattern to any
   future cross-language numeric port.
4. **i18n dotted-path keys must actually nest in the YAML**:
   ``t("repo.action.rerender", ...)`` walks ``key.split(".")``.
   Flat ``action_rerender`` under ``repo:`` never resolves —
   every call falls through to the second-arg fallback. The
   v1.33.0 fix nests the keys; the new regression-pin test
   would have caught the original bug six releases earlier had
   it existed then.

### 4.3 Discipline reinforced

- **Atomic-green-commit cadence at scale**: 14 source/docs
  commits + 1 release commit this session. Each individually
  green. Zero CI red events. Pre-flight chain stayed clean
  throughout.
- **Aggressive-but-principled cleanup of inherited prose**:
  ``lessons-learned.md`` was 3415 lines, ~40% Bibliogon-only.
  Deleted 53% / 1828 lines without losing any universal-
  discipline content. The threshold for keeping a section was
  "lesson is universal OR Adaptive-Learner-specific"; the
  threshold for deleting was "examples are so Bibliogon-domain
  that the universal principle is buried." Future cleanup
  passes can apply the same threshold to any newly-inherited
  prose.

---

## 5. State at end of session

### Git

```
HEAD:    <post-release commit> docs: post-release v1.33.0
Tag:     v1.33.0 (annotated, NOT YET pushed at the time of writing)
Branch:  main, ahead of origin/main by 16 commits + 1 tag
Clean working tree.
```

The user has NOT been asked to push yet. The pattern from prior
releases is: post-release commit → user authorizes push +
``gh release create``. The release notes for
``gh release create`` are ``changelog/releases/v1.33.0.md``.

### Recent commits (latest 16)

```
<this commit>    docs: post-release v1.33.0 documentation update
7b7dfb7 chore(release): bump version to v1.33.0
6b09dd4 docs(prompts): de-Bibliogon audit.md (Phase D5 / v1.33.0)
979a8fc docs(rules): aggressive Bibliogon purge of lessons-learned.md (Phase D4 / v1.33.0)
4482cf4 docs(rules): sweep Bibliogon residue from core rules files (Phase D3 / v1.33.0)
cb10a27 docs(rules): rewrite architecture.md for the Adaptive Learner domain (Phase D2 / v1.33.0)
a56a054 docs(journal): remove Bibliogon-residue BISAC/KDP refs (Phase D1 / v1.33.0)
a660245 docs(backlog): archive 18 closed items + PHASE-42 (Phase C1 / v1.33.0)
a2af622 fix(i18n): restructure repo.* keys to resolve dotted-path t() calls (Phase B1 / v1.33.0)
9baed5c feat(gamification): TypeScript lesson badge predicates for Dexie mode (Phase 50E)
7ab4ae3 feat(storage): Dexie-mode lesson-XP on completion (Phase 50D)
0babbe1 feat(gamification): TypeScript streak + first-attempt helpers (Phase 50C)
9443572 feat(gamification): TypeScript lesson-XP rule + parity proof (Phase 50B)
9129697 test(gamification): lesson-XP parity scaffold + Python goldens (Phase 50A)
c8f134f docs(journal): expand v1.33.0 handover + add kickoff prompt
2939fca docs: post-release v1.32.0 documentation update
```

### Files of interest for v1.34.0

#### For the content expansion (if pursued — § 2.1)

- ``docs/explorations/sample-content/fr-a1/`` — the 2-lesson
  FR-A1 pilot. New lessons go under ``sets/language-fr-a1/lessons/``
  using the same JSON schema. ``manifest.yaml`` lists the set;
  ``lesson_count`` field needs bumping per new lesson added.
- ``plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/models.py`` —
  Pydantic v2 ``Lesson`` schema v1.0 (LessonStep / Exercise /
  Card / ExerciseType). All new lessons must validate against
  this schema.
- ``frontend/src/components/lesson/`` — the 4 exercise renderers
  (matching, picture-choice, free-text, word-tiles). Every new
  exercise must use one of these four types.

#### For the generic plugin-settings UI (§ 2.2)

- ``frontend/src/components/LearningRepoSettingsSection.tsx``
  — the prototype for the generic form.
- ``frontend/src/data/plugin-config/*.json`` —
  type-inferrable defaults (5 plugins shipped).
- ``frontend/src/storage/types.ts`` `IPluginSettingsNamespace`
  shape.

#### For the parity-test-pattern (§ 2.4 + future ports)

- ``tests/fixtures/lesson-xp-parity/`` — current shape:
  ``input.json`` (case groups) + ``expected/{case}.json``
  (per-case goldens). Reusable for any future cross-language
  port.
- ``plugins/adaptive-learner-plugin-gamification/tests/test_xp_parity.py``
  + ``frontend/src/lib/gamification/lesson-xp.parity.test.ts``
  — both sides of the parity contract. Template for new ports.

---

## 6. Pre-flight discipline (the gate chain)

Unchanged from v1.31.0/v1.32.0/v1.33.0. Every commit:

```bash
make test                            # backend + plugins + Vitest
cd backend && poetry run mypy app/   # mandatory
cd backend && poetry run pre-commit run --all-files   # mandatory
# For release commits / Dexie-affecting commits, additionally:
make test-dexie-smoke                # Dexie release gate
cd frontend && npm run build         # production build
cd frontend && npx tsc --noEmit      # TypeScript check
```

---

## 7. Cold-pickup checklist for the next session

Run these in order before any code:

```bash
# 1. Confirm state
git log --oneline -5
git status --short

# 2. Baseline test gates (should all be green)
make test                  # expect 1002 backend + 850 plugins + 1895 Vitest
make test-dexie-smoke      # expect 18/18 green
cd backend && poetry run mypy app/                          # Success
cd backend && poetry run pre-commit run --all-files         # Passed

# 3. Confirm CI is green on the v1.33.0 push (once it lands)
gh run list --limit 5
```

If any baseline doesn't match, **STOP and investigate**
before proceeding with v1.34.0.

Then read, in order:
1. `CLAUDE.md`
2. `.claude/rules/` (all files — especially
   lessons-learned.md and ai-workflow.md; both are MUCH
   tighter post-Phase D)
3. This file (handover-to-v1.34.0.md)
4. `changelog/releases/v1.33.0.md` (the per-release detail)

Then propose the v1.34.0 commit plan with whatever candidate
from § 2 the user picks, wait for green-light, execute.

---

End of handover.
