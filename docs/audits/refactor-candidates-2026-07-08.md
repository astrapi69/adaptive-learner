# Refactor candidates audit (2026-07-08)

Analysis-only pass. **No code was changed.** The deliverable is this
prioritized, assignment-ready list of refactor sessions plus one tracking
issue. Each row is a single-concern PR that fits one session.

All numbers below were measured in-session (`wc -l`, `git log --since`,
`grep` fan-in, the size/complexity gate scripts). Where a value is an
approximation, it says so.

## Step 1: What the existing instruments already say

The project already has measuring instruments. Read first, then extend.

### Size gates

| Instrument | Threshold | Current state |
|---|---|---|
| `check-file-sizes.sh` | warn > 500 lines, **error > 1000** (hard) | `.filesize-baseline` is **empty** (all launcher entries removed in #1064). So the 1000-line hard gate has **zero exceptions**. |
| `check-directory-size.sh` | warn/gate > 15 flat source files per dir | `.dirsize-baseline` has **no active entries** (all god-folders resolved). |
| `.filesize-whitelist` | cohesive single-concern large files (exempt) | 6 entries (see Class D below). |

**Key consequence:** any file that grows past 1000 lines blocks CI with no
grandfathering. Four frontend files are within ~120 lines of that wall
(`WordTilesExercise.tsx` 962, `content-loader-dexie.ts` 907,
`ClozeExercise.tsx` 887, `backup.ts` 884). This is the gate-proximity
cluster; the next feature that touches one of them will break the build.

### Complexity gate

`check-complexity.sh --gate`: Python radon rank D/E/F (cc > 20); TypeScript
eslint `complexity > 20`. `.complexity-baseline` has **exactly one** entry:

```
frontend/src/storage/lessons/lesson-progress-dexie.ts 22
```

**Key finding:** the gate passes with only that one tolerated offender.
Therefore **no other function in the repo exceeds cyclomatic complexity 20**.
The god-files below are large by *breadth* (many small functions / sections /
state blocks in one file), **not** by deep per-function complexity. The pain
is cohesion, not branch depth. That is why "mechanical split" (Class A) is the
dominant class here: the pieces are already small and separable.

### eslint complexity exceptions

No per-file `eslint-disable complexity` overrides were found among the
candidates; complexity is enforced only via the warn-view (threshold 15) and
the gate (threshold 20), both clean.

## Step 2: Measurements

### Frontend (top source files, excl. tests)

| File | Lines | Changes/6mo* | Fan-in** | Test | Responsibility indicators |
|---|---|---|---|---|---|
| components/exercises/renderers/WordTilesExercise.tsx | 962 | 28 | 2 | yes | DnD reorder logic + rendering + equivalence |
| storage/content/content-loader-dexie.ts | 907 | 26 | 3 | yes | 14 exports: fetch/cache + AI-check + user-set CRUD |
| components/exercises/renderers/ClozeExercise.tsx | 887 | - | 3 | yes | two render modes + per-blank SRS fan-out |
| storage/backup/backup.ts | 884 | - | 4 | yes | 7 exports; data-integrity (export/import) |
| components/settings/backup/BackupSection.tsx | 861 | - | 2 | yes | backup UI + compare + restore |
| components/settings/integrations/ContentRepoSettingsSection.tsx | 852 | - | - | yes | repo list + add + validate + remove |
| storage/ai/session-flow.ts | 845 | - | 2 | yes | AI session orchestration |
| types/domain.ts | 811 | 32 | high | n/a | **type definitions only (Class D)** |
| storage/sync/sync-engine.ts | 803 | - | 5 | yes | push + pull + conflict |
| components/exercises/renderers/matching-parts.tsx | 781 | - | - | yes | matching sub-renderers |
| storage/dexie/db-rows.ts | 726 | - | high | n/a | **row-shape data model (Class D, whitelisted)** |
| pages/lesson/Session.tsx | 724 | 23+ | 2 | yes | 16 useState / 6 useEffect, only 3 sub-components |
| components/sync/SyncConflictDialog.tsx | 705 | - | - | yes | conflict-resolution UI |
| pages/lesson/Lesson.tsx | 698 | ~83 | 2 | yes | 10 useState / 6 useEffect, 13 sub-components / 22 uses |
| storage/dexie-storage.ts | 697 | **72** | 1 | yes | IStorageService god-object, 20 namespaces (mixed inline + delegated) |
| components/lesson/summary/LessonSummary.tsx | 686 | - | - | yes | summary + export + next-step |
| hooks/content/useShareWizard.ts | 683 | - | - | yes | share-wizard state machine |
| lib/content/analysis/analysis-to-lesson.ts | 682 | - | - | yes | deterministic lesson generator (cohesive) |
| pages/content/ImportDetail.tsx | 673 | 26+ | 2 | yes | 17 useState / 4 useEffect |
| pages/content/Content.tsx | 624 | ~76 | 2 | yes | 7 useState, 16 sub-components / 27 uses |

\* Combined across old and new paths where a file was moved by a prior
god-folder split (e.g. `pages/Settings.tsx` + `pages/system/Settings.tsx`).
Blank = not in the top-25 churn list.
\*\* Approximate: `grep` on the import stem, excluding tests; barrel
re-exports can hide some edges.

### Backend / plugins (top source files, excl. tests)

| File | Lines | Funcs | Whitelisted | Note |
|---|---|---|---|---|
| backend/app/models/__init__.py | 1814 | - | yes | single-file domain model (Class D) |
| backend/app/schemas/__init__.py | 1764 | - | yes | Pydantic schemas (Class D) |
| plugins/.../content-loader/schema.py | 1147 | - | yes | lesson schema, EXP-039 source (Class D) |
| plugins/.../session/prompts.py | 1118 | - | yes | prompt templates (Class D) |
| plugins/.../session/session_runner.py | 921 | 17 | no | already decomposed (avg ~54 lines/func) |
| backend/app/services/sync_service.py | 918 | 10 | no | hotspot (27/6mo); sync surface |
| plugins/.../assessment/questions.py | 907 | - | yes | static question data (Class D) |
| backend/app/services/backup_restore.py | 810 | 22 | no | already decomposed (avg ~37 lines/func) |

Backend went through Cohesion Phase 2 (#372, #412); none of these files
carries a `cc > 20` offender (gate is clean). They are large by the breadth
of a single concern, already function-decomposed, and tested.

## Step 3 + 4: Classification and priority

Ordering weights (descending): **Schmerz** (hotspot x breadth) >
**Risiko** (fan-in x thin coverage) > **Gate-proximity** > **effort/value**
(Class A before B). Note: every candidate below **has tests**, so
coverage-risk is uniformly low; that pushes Class C down and makes the
ordering lean on hotspot + gate-proximity + effort.

### The assignment-ready list (sorted by priority)

| # | File(s) | Lines | Class | Concrete problem (not "too big") | Target state | Effort / risk | PR title | Agent |
|---|---|---|---|---|---|---|---|---|
| 0 | pages/system/Settings.tsx | 865 -> 229 | A | six inline tabpanels + ~270-line general-tab head | one panel per tab under `settings/tabs/` | **DONE (#1447/#1448)** | - | - |
| 1 | storage/dexie-storage.ts | 697 | B | **#1 hotspot (72 changes/6mo)**; the `IStorageService` object mixes 25 delegated namespace modules with ~5 still-inline namespaces (AI phrase/score, zip export, GitHub, danger-zone token) | extract the remaining inline namespaces into `storage/*` modules (pattern already established for the other 20) | 1 session; low risk (fan-in 1, tested) but touched constantly | `refactor(storage): extract remaining inline dexie namespaces into modules` | CCW |
| 2 | pages/lesson/Lesson.tsx | 698 | A | hotspot (~83 changes/6mo), known god-file; already composes 13 sub-components but keeps 10 useState/6 useEffect of step-orchestration inline | pull step-orchestration into a `useLessonPlayer` hook + extract the inline blocks; shell mounts sub-panels | 1 session; low risk (leaf route, tested) | `refactor(lesson): extract Lesson page orchestration into a hook + panels` | CCW |
| 3 | pages/content/Content.tsx | 624 | A | hotspot (~76 changes/6mo), known god-file; 16 sub-components already but 7 inline state blocks + section markup | extract the content sections into panels/hooks, shell becomes a thin composer | 1 session; low risk (tested) | `refactor(content): split Content page into section panels` | CCW |
| 4 | components/exercises/renderers/WordTilesExercise.tsx | 962 | A | **gate-proximity #1: 962 of the 1000 hard cap** (no baseline exception); DnD reorder logic + equivalence + rendering in one file | extract the tile-DnD/equivalence logic into a hook + sub-renderers | 1 session; low risk (tested, @dnd-kit) | `refactor(exercises): split WordTilesExercise DnD logic from rendering` | CCW |
| 5 | storage/content/content-loader-dexie.ts | 907 | A/B | gate-proximity (907/1000) + hotspot (26/6mo); 14 exports spanning fetch/cache, AI content-check, and user-set CRUD | split by concern into 3 modules under `storage/content/` | 1 session; medium risk (fan-in 3, tested) | `refactor(storage): split content-loader-dexie by concern` | CCW |
| 6 | components/exercises/renderers/ClozeExercise.tsx | 887 | A | gate-proximity (887/1000); two render modes + per-blank SRS derivation inline | extract cloze-blank logic + render-mode sub-components | 1 session; low risk (tested) | `refactor(exercises): split ClozeExercise blank logic from render modes` | CCW |
| 7 | pages/lesson/Session.tsx | 724 | B | 16 useState/6 useEffect but only 3 sub-components: chat, streaming, rating, and step concerns are interwoven inline (least pre-separated of the pages) | needs a design pass: extract chat/streaming/rating into hooks + panels | 1 session (design + split); medium risk (tested) | `refactor(session): decompose Session page concerns into hooks + panels` | CC (design) then CCW |
| 8 | pages/content/ImportDetail.tsx | 673 | B | 17 useState/4 useEffect: analysis view + save-as-lesson + share concerns mixed | extract save + share flows into hooks/sub-components | 1 session; medium risk (tested) | `refactor(content): split ImportDetail save/share concerns` | CC then CCW |
| 9 | storage/backup/backup.ts | 884 | C | gate-proximity (884/1000) + **data-integrity**: export/import round-trip. Unit tests exist but the real gate is the BACKUP-AKZEPTANZTEST (manual round-trip) | split export vs import vs shape helpers; gate the PR on the manual round-trip, not just units | 1 session; **higher risk** (data-loss class, fan-in 4) | `refactor(storage): split backup export/import concerns` | CC (with acceptance round-trip) |
| 10 | storage/sync/sync-engine.ts | 803 | B | highest fan-in (5) among candidates; push/pull/conflict in one engine | split by push / pull / conflict-resolution | 1 session; medium risk (tested) | `refactor(sync): split sync-engine into push/pull/conflict` | CC then CCW |

Secondary (real but lower value, revisit when touched): `BackupSection.tsx`
(861), `ContentRepoSettingsSection.tsx` (852), `session-flow.ts` (845),
`matching-parts.tsx` (781), `SyncConflictDialog.tsx` (705),
`LessonSummary.tsx` (686), `useShareWizard.ts` (683). None is a current
hotspot; splitting now is optional polish.

## Class D: deliberately left (with rationale)

Leaving a large-but-cohesive file alone is as much a decision as splitting
one. These are **not** candidates:

| File | Lines | Why left |
|---|---|---|
| backend/app/models/__init__.py | 1814 | single-file domain model; data only, whitelisted. Splitting scatters one schema. |
| backend/app/schemas/__init__.py | 1764 | Pydantic schemas mirroring the models; data only, whitelisted. |
| plugins/.../content-loader/schema.py | 1147 | lesson schema, the EXP-039 authoritative source for JSON-Schema + TS-type generation; whitelisted. |
| plugins/.../session/prompts.py | 1118 | prompt-string templates, no behavior; whitelisted. |
| plugins/.../assessment/questions.py | 907 | static question data; whitelisted. |
| frontend/src/types/domain.ts | 811 | type definitions only, no runtime behavior. |
| frontend/src/storage/dexie/db-rows.ts | 726 | row-shape data model (frontend pendant of models); whitelisted. |
| backend session_runner.py / backup_restore.py / sync_service.py | 921 / 810 / 918 | already function-decomposed in Cohesion Phase 2; no `cc > 20` offender; tested. Large by single-concern breadth. `sync_service.py` is a hotspot (27/6mo) and is the one **watch item** here, but it is not a mechanical win and its split would be data-critical. |
| lib/content/analysis/analysis-to-lesson.ts | 682 | one cohesive deterministic generator; a prior split attempt (#496) brought it under cc20; splitting further scatters the algorithm. |

The rule of thumb applied: if the only justification is "cleaner", it is
Class D. A candidate needs a concrete pain (hotspot, gate-proximity, or
interwoven concerns) to earn a slot.

## Gaps / caveats

- **Fan-in numbers are approximate** (`grep` on import stems, tests excluded;
  barrel re-exports may hide edges). They are directional, not exact.
- **Per-function cyclomatic complexity was not exhaustively enumerated** for
  every candidate; instead the gate result is used as ground truth (gate
  clean with one baseline entry => no `cc > 20` outside it). That is
  sufficient to conclude the pain is breadth, not depth, but it does not rank
  functions within a file.
- Change-frequency merges old/new paths by hand where a rename is obvious;
  a file split by an earlier refactor undercounts unless both paths were
  summed.
