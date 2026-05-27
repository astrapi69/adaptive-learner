# Handover — after v1.31.0, before v1.32.0

**Written**: 2026-05-27 (end of Phase 46 sub-phases E-F-G
session).

This document is the cold-pickup brief for the next
session. Anyone (or any model) reading this should be
able to start work on v1.32.0 without needing the prior
conversation context.

---

## 1. What just shipped: v1.31.0

**Phase 46 sub-phases E-F-G — Gamification Integration +
LessonProgress↔LearningSession Unification + Docs**
(EXP-007 / P-129). Closes Phase 46. With v1.31.0 shipped,
content lesson completions now feed the existing XP /
streak / badge / ProgressCommit machinery transparently
via a pseudo-project layer that needed zero new hookspec.

Full per-release detail:
``changelog/releases/v1.31.0.md``. Per-commit detail
inferred from the git log (no chat-journal entry written
this session — the per-release file + this handover are
the system of record for the v1.31.0 session).

### Test counts (the new baseline)

```
Backend pytest:     1004 (+1 skipped)
Plugin tests:       838 (12 suites)
Vitest:             1755
Aggregate:          3597 (+1 skipped)
Dexie smoke gate:   18/18
```

### What landed

**46F.1** — ``LearningProject.kind`` column + Alembic
0020 + sync surface (2 backend tests).

**46F.2** — ``app/services/lesson_session_unification.py``
+ hook fire from ``lesson_progress.upsert_progress`` (11
backend tests).

**46E.1** — ``xp_service.compute_stars`` +
``calculate_lesson_session_xp`` + dispatch in
``GamificationPlugin.on_session_complete`` (12 pure
plugin tests + 1 e2e XP-value pin).

**46E.2** — 4 new badge predicates + seed catalog (24 →
28) + 64 native i18n entries (11 backend integration
tests).

**46F.3** — ``frontend/src/lib/learning-project.ts`` +
filter applied in Dashboard / Export / Anki + Dexie row
back-fill (7 Vitest tests).

**46G.1** — ``docs/help/{en,de}/user-guide/lessons.md``
+ ``_meta.yaml`` + mkdocs regen.

**46G.2** —
``docs/help/{en,de}/developer/lessons-and-srs.md`` +
``_meta.yaml`` + mkdocs regen.

**Release** — version bump + ``make sync-versions`` +
changelog + tag v1.31.0 (pushed). GitHub release at
``https://github.com/astrapi69/adaptive-learner/releases/tag/v1.31.0``.

**Post-release** (this commit) — CLAUDE.md update +
this handover.

---

## 2. What's open: candidates for v1.32.0

There is **no committed plan** for v1.32.0 yet. The
following are open work items the v1.31.0 session left on
the table; the next session's first conversation should
pick scope.

### 2.1 PHASE-42-STORAGE-ABSTRACTION-01 (P0, carried over)

Still open from the v1.26.x cycle. Phase 42's
Learning-Repo plugin shipped without routing through
``IStorageService``; the v1.26.1 hotfix landed a
friendly-error mapper that hides the failure in Dexie
mode, but the proper port was deferred. Reviving this
item closes a real Dexie-mode functionality gap:
backend-only users see Learning Repository working
fully; GH-Pages users see a "Dexie unavailable" message.

### 2.2 Dexie-mode lesson-XP gap (new, from v1.31.0)

v1.31.0 closed the lesson-XP loop for API-mode users.
Dexie-mode users get the review loop but NOT the
lesson-XP / lesson-badge side effects (no backend, no
on_session_complete hook). Three options:

- **(a) Port the XP rule to TypeScript** and run it
  inside DexieStorage's lesson-completion path. Pros:
  honest port. Cons: dual-implementation drift risk;
  bands / multipliers need cross-language test pairing.
- **(b) Service-worker shim** of on_session_complete
  that runs the gamification rules in Dexie mode. Pros:
  closer to a single source of truth. Cons: heavier
  infra; SW environment differs from Node.
- **(c) Accept the gap, document, defer**. Dexie users
  are GH-Pages visitors; they get the review loop and
  the chat-session XP via the API path when they switch
  modes.

Recommendation: **(c)** for v1.32.0; revisit when actual
Dexie-mode user feedback comes in. The current
``v1.31.0.md`` already documents the gap as a deliberate
non-goal.

### 2.3 Adaptive Lektionen Stufe 3 (BACKLOG)

EXP-013 in the backlog has Stufe-3 items beyond the SRS
foundation v1.30.0 shipped. Possibles:
- Per-element grouping in the review session ("here are
  3 you struggle with from lesson 2; here are 2 from
  lesson 7") instead of flat priority order.
- Per-element progress visualisation on the Dashboard
  ("you have 32 elements in flight; 18 mastered this
  week").
- AI-assisted hints when the same element fails 5+
  times.

### 2.4 Backlog cleanup

Several items in the prior session's backlog (P-131..P-140
from BACKLOG.md, EXP-013 Phase 2) were effectively closed
by the v1.30.0 + v1.31.0 work. The next session could
batch-close them with a clear "marked done by v1.30.0
SRS / v1.31.0 unification" annotation.

---

## 3. Architectural decisions still in force

Phase 46 is closed; the five v1.30.0/v1.31.0 decisions
(D1 lazy pseudo-project + D2 method="content" + D3
review=replay + D4 MASTERY_THRESHOLD=3 + D5 reuse
on_session_complete) are now production-truth, not
proposals. Future work should respect them; revisiting any
of them is a deliberate architectural change, not a
casual tweak.

The two carry-overs that are still open:

| ID | What | Trigger to revisit |
|----|------|--------------------|
| **D-storage-abstraction** | Should Learning Repository plugin route through IStorageService? | Backlog item PHASE-42-STORAGE-ABSTRACTION-01 |
| **D-dexie-gamification** | Should Dexie-mode lessons award XP locally? | First user report from a GH-Pages visitor saying "I completed a lesson, where's my XP?" |

---

## 4. Gotchas + recurring false positives

Most of the IDE static-analysis false positives from
prior handovers still apply. Pattern unchanged.

### 4.1 IDE static-analysis false positives (ignorable)

| Diagnostic | Reality |
|---|---|
| `pytest`: Cannot find module | Backend venv issue. Tests run fine via `make test*`. |
| `sqlalchemy` / `sqlalchemy.orm`: Cannot find module | Same. |
| `alembic` / `alembic.config`: Cannot find module | Same. |
| `app.models` / `app.database` (in plugin code) | Plugin runs inside the backend venv at runtime where backend's `app.*` is on sys.path. |
| Parameter `client` unused (in pytest) | TestClient fixture is load-bearing for the lifespan. |

### 4.2 Real footguns surfaced this session

1. **ruff-format auto-applies to files OTHER than what you
   touched.** During 46E.1 the formatter reformatted
   ``lesson_session_unification.py`` (from the 46F.2
   commit) because it picked up a deferred format-fix
   when run from a different cwd. Resolution was to
   include the reformat in the next commit and note it
   in the body. Going forward: re-run `pre-commit run
   --all-files` before AND after each commit to catch
   these early.

2. **Conftest collision when running pytest across
   plugin + backend dirs simultaneously**. Workaround:
   run them in separate Bash calls, each from the
   correct cwd. The shell's cwd does NOT persist between
   Bash tool calls — every call starts at the project
   root.

3. **TypeScript strict-mode strikes again on schema
   additions.** Adding ``kind`` to ``LearningProject``
   required updates to ``DashboardFilterBar.test.tsx``
   (fixture builder) and ``session-flow.ts`` (Dexie
   project DTO construction). Any future field addition
   to a domain type will need the same sweep: grep for
   ``: LearningProject = {`` or
   ``LearningProject = ({`` and update every fixture +
   constructor.

4. **Test count = 28 was hardcoded in
   `test_badge_yaml.py`**. The catalog-count test fails
   loud (it's a regression-pin), but a YAML-only badge
   addition would still pass; the symmetry test in
   `test_gamification_badges_integration.py` catches
   YAML/evaluator drift. Both pins are useful — keep
   them.

### 4.3 Discipline reinforced

- **Atomic-green-commit cadence still scales**: 9 source
  commits + 1 release commit + 1 post-release commit in
  this session, each individually green. No CI red
  events this session (the v1.30.0 chain had 2 CI red
  events from skipping mypy + pre-commit; the v1.31.0
  chain ran the full gate before every commit and
  stayed clean).
- **Decision-confirmation discipline**: the 5 pre-
  commit decisions (4 from the handover + 1 ordering
  decision F-before-E) kept momentum tight. The same
  pattern works for v1.32.0.
- **i18n native translations**: not English passthrough.
  Real umlauts (ä/ö/ü/ß) in DE per the lessons-learned
  rule. Native Japanese phrasing. 8 catalogues every
  time.

---

## 5. State at end of session

### Git

```
HEAD:    <post-release commit> docs: post-release v1.31.0
Tag:     v1.31.0 (annotated, pushed to origin)
Branch:  main, in sync with origin/main
Clean working tree.
```

### Recent commits (latest 12)

```
<post-release commit hash> docs: post-release v1.31.0
e475c68  chore(release): bump version to v1.31.0
162e557  docs(developer): lessons + SRS internals page EN + DE (46G.2)
d7a0fcc  docs(help): lessons + reviews user-guide page EN + DE (46G.1)
8fabf26  feat(frontend): hide content-kind pseudo-project from project pickers (46F.3)
01cbde1  feat(gamification): 4 content-lesson badges + i18n (46E.2)
c888ec7  feat(gamification): XP rule for content lesson sessions (46E.1)
8ae5bc7  feat(lesson): pseudo-project + LearningSession write on completion (46F.2)
b9f13b6  feat(model): LearningProject.kind column + Alembic 0020 (46F.1)
43dd06b  docs: add v1.31.0 handover journal entry outlining scope and architectural decisions
6cfc993  docs: post-release v1.30.0 documentation update
7386744  chore(release): bump version to v1.30.0
```

### CI status

CI was green throughout this session (no recovery commits
needed). The v1.31.0 launcher builds + release-gate kicked
off automatically on tag push:
``gh run list --limit 5`` (immediately post-push) shows
3 Launcher jobs (Linux / macOS / Windows) + 1 Release Gate
all in flight. Confirm green at session start with
``gh run list --limit 5`` before any v1.32.0 work.

### Files of interest for v1.32.0

#### For the Dexie-mode lesson-XP gap (if pursued)

- ``frontend/src/storage/dexie-storage.ts`` — entry point
  for any local XP awarding.
- ``frontend/src/lib/lesson-summary.ts`` — already has
  ``computeStars``; the lesson-formula XP would land
  here or in a sibling ``lib/lesson-xp.ts``.
- ``plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/xp_service.py`` — the
  authoritative formula to port.

#### For the Phase 42 storage abstraction (if pursued)

- ``frontend/src/components/LearningRepoSettingsSection.tsx``
  — current direct ``api.pluginSettings.*`` callsites.
- ``frontend/src/pages/LearningRepo.tsx`` — same.
- ``frontend/src/storage/dexie-storage.ts`` — where the
  new namespace would land.
- ``frontend/src/storage/api-storage.ts`` — paired
  ApiStorage implementation.

#### For EXP-013 Stufe 3 (if pursued)

- ``backend/app/services/element_srs.py`` — scheduler;
  per-lesson grouping would extend the priority sort.
- ``frontend/src/pages/Review.tsx`` — review-session
  page that would render the grouping UI.
- ``frontend/src/components/dashboard/ReviewQueueCard.tsx``
  — Dashboard widget that would gain a per-week
  progress strip.

---

## 6. Pre-flight discipline (the gate chain)

Unchanged from v1.30.0/v1.31.0. Every commit:

```bash
make test                            # backend + plugins + Vitest
cd backend && poetry run mypy app/   # mandatory
cd backend && poetry run pre-commit run --all-files   # mandatory
# For release commits, additionally:
make test-dexie-smoke                # Dexie release gate
cd frontend && npm run build         # production build
```

If pre-commit's ruff-format fires it MODIFIES the files
in place; re-run, re-stage, commit. Don't try to commit
the "red" run.

---

## 7. Cold-pickup checklist for the next session

Run these in order before any code:

```bash
# 1. Confirm state
git log --oneline -5
git status --short

# 2. Baseline test gates (should all be green)
make test                  # expect 1004 backend + 838 plugins + 1755 Vitest
make test-dexie-smoke      # expect 18/18 green
cd backend && poetry run mypy app/   # expect "Success: no issues found"
cd backend && poetry run pre-commit run --all-files   # expect all Passed

# 3. Confirm CI is green on the v1.31.0 push
gh run list --limit 5
```

If any baseline doesn't match, **STOP and investigate**
before proceeding with v1.32.0.

Then read, in order:
1. `CLAUDE.md`
2. `.claude/rules/` (all files — especially
   lessons-learned.md and ai-workflow.md)
3. This file (handover-to-v1.32.0.md)
4. `changelog/releases/v1.31.0.md` (the per-release detail)

Then propose the v1.32.0 commit plan with whatever
candidate from § 2 the user picks, wait for green-light,
execute.

---

End of handover.
