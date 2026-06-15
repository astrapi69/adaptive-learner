# Cohesion Audit - Adaptive Learner

- **Date:** 2026-06-13
- **Commit:** `d7bd7b5f` (branch `develop`)
- **Scope:** version-controlled production sources (Python under `backend/app`
  + `plugins/`, TypeScript under `frontend/src`). Test/spec files, generated
  build output (`site/`, `frontend/dev-dist/`), and `node_modules` are excluded.
- **Method:** file sizes via `wc -l`; Python function length / parameter count /
  import count via the stdlib `ast` module; TypeScript function length /
  parameter count / cyclomatic complexity via ad-hoc ESLint rules
  (`max-lines-per-function`, `max-params`, `complexity`). No new dependency was
  added (`radon` is blocked by PEP 668 on this host; the AST analyzer replaces it).

This is a one-time report. It grounds the Phase-2 split strategy (#372) and
documents the steady state enforced by the file-size watcher (#371,
`scripts/check-file-sizes.sh`). No refactoring happens here.

> **Post-burn-down update (2026-06-15, v1.79.0).** The campaign this report
> grounded is **complete**. Both `.filesize-baseline` and `.complexity-baseline`
> are now **empty** — every god-file in §2 was split (#372; the 1156-line
> session `routes.py` #412 was the last) and every complexity offender was
> burned down (#498–#504; `validateGeneratedLesson` #497 was the last). All
> four "Recommended next actions" in §8 are done: `upsert_progress` decomposed
> behind a `ProgressUpdate` dataclass (#375) then to cc ≤ 10 (#502);
> `backup-diff` previewRow 54→3 (#422); `eventRecorder`/`formatEventLog` 40→4
> (#436); parameter-object refactors landed via #376/#382. A live watcher run
> on develop reports **5 whitelisted, 0 baselined, 45 WARN (> 500), 0 ERROR**
> — the gate is green with no exceptions. The Phase 2 radon hard gate
> (#494/#495: blocks cc > 20, warns > 15) + the complexity watcher (#400) are
> live. The figures in §3–§8 below are the pre-burn-down snapshot, retained for
> history. **Score re-rated 7/10 → 9/10** (see §8).

---

## 1. How the watcher classifies large files

The watcher (#371) enforces two thresholds with two exception lists:

| Mechanism | File | Meaning |
|---|---|---|
| **WARN** > 500 lines | - | advisory, never blocks |
| **ERROR** > 1000 lines | - | blocks the merge (`exit 1`) |
| **Whitelist** | `.filesize-whitelist` | deliberately large + single-concern + cohesive; never an error |
| **Baseline (ratchet)** | `.filesize-baseline` | existing mixed-concern god-files, frozen at current size; may not grow; tracked for splitting in #372 |

A live run on this commit reports: **4 whitelisted (SKIP), 8 baselined (BASE),
35 WARN, 0 ERROR** -> the gate is green.

---

## 2. Files over 1000 lines (the ERROR tier)

10 production files exceed the 1000-line error threshold. 2 are legitimately
whitelisted; 8 are baselined debt.

| File | Lines | Classification | Cohesive? | Action |
|---|---:|---|---|---|
| `backend/app/models/__init__.py` | 1717 | Whitelist | Yes - single-file domain model, one concern (data structure) | Keep whitelisted |
| `backend/app/schemas/__init__.py` | 1586 | Whitelist | Yes - mirrored Pydantic API schemas, one concern | Keep whitelisted |
| `frontend/src/pages/Lesson.tsx` | 1779 | Baseline (CCW) | No - page shell mixing flow control, navigation, exercise dispatch, rendering | Split (#372) |
| `frontend/src/pages/Content.tsx` | 1542 | Baseline (CCW) | No - browser + search + tree + import + continue-learning | Split (#372) |
| `frontend/src/api/client.ts` | 1397 | Baseline (CCW) | No - every API namespace in one module | Split (#372) |
| `frontend/src/components/content/ShareWizard.tsx` | 1281 | Baseline (CCW) | No - multi-step wizard + placement + validation | Split (#372) |
| `frontend/src/pages/Settings.tsx` | 1226 | Baseline (CCW) | No - all settings tabs in one component | Split (#372) |
| `frontend/src/components/BackupSection.tsx` | 1170 | Baseline (CCW) | No - export + restore + compare + danger zone | Split (#372) |
| `plugins/.../session/adaptive_learner_session/routes.py` | 1156 | Baseline (**CC**) | No - many endpoints + glue (already 2031 -> 1156 via #341) | Split (#372) |
| `frontend/src/storage/db.ts` | 1153 | Baseline (CCW) | No - Dexie schema + all table accessors | Split (#372) |

Lane ownership (per #372): the 7 frontend files are CCW's; `session/routes.py`
is the backend (CC) backlog item.

---

## 3. Files 500-1000 lines (the WARN tier)

Advisory only - not blocked, but refactoring candidates. None are on the
critical path of the watcher.

### Backend / plugins (10 in the 500-1000 band, 2 of them whitelisted)

| File | Lines | Note |
|---|---:|---|
| `plugins/.../assessment/questions.py` | 907 | Whitelist - static question data |
| `plugins/.../session/prompts.py` | 728 | Whitelist - prompt templates |
| `backend/app/services/sync_service.py` | 909 | Per-table sync surface; split candidate |
| `plugins/.../session/session_runner.py` | 871 | Session orchestration; high import + complexity |
| `plugins/.../content-loader/schema.py` | 862 | Lesson schema (Pydantic); largely declarative |
| `backend/app/services/backup_restore.py` | 688 | Cohesive restore pipeline; leave unless it grows |
| `plugins/.../content-loader/service.py` | 603 | Could shed dedup/version helpers |
| `plugins/.../content-loader/models.py` | 600 | Pydantic models; largely declarative |
| `plugins/.../gamification/xp_service.py` | 573 | XP rules; cohesive |
| `plugins/.../gamification/badge_service.py` | 555 | Badge evaluation; high import count |

### Frontend (24 over 500, none whitelisted)

`ImportDetail.tsx` 974, `content-loader-dexie.ts` 928, `MatchingExercise.tsx`
862, `backup.ts` 850, `CreateLesson.tsx` 850, `sync-engine.ts` 803,
`types/domain.ts` 793, `ContentRepoSettingsSection.tsx` 778,
`WordTilesExercise.tsx` 733, `Session.tsx` 718, `SyncConflictDialog.tsx` 705,
`chat_import/analysis.ts` 659, `export/markdown-renderer.ts` 654,
`SyncSection.tsx` 624, `storage/session-flow.ts` 619, `dexie-storage.ts` 607,
`content/analysis-to-lesson.ts` 579, `Import.tsx` 572, `storage/ai-providers.ts`
563, `Onboarding.tsx` 557, `adaptive/lesson-generator.ts` 538,
`BackupCompare.tsx` 534, `AdaptiveLesson.tsx` 507, `create-lesson/CardEditor.tsx`
503.

`types/domain.ts` (793) is borderline-whitelistable (a shared type module, one
concern) but stays in WARN for now - it is well under 1000 and is not load-bearing
for the gate.

---

## 4. Functions over 50 lines

A function over 50 lines is a cohesion warning (coding-standards.md). 64 Python
and 256 TypeScript production functions exceed it. Most TS entries are whole
React component bodies (the function-level reflection of the page god-files in
section 2). The worst offenders:

### Python (top 12 of 64)

| Lines | File | Function | Params |
|---:|---|---|---:|
| 226 | `session/routes.py` | `append_message_stream` | 4 |
| 183 | `backend/app/services/lesson_progress.py` | `upsert_progress` | **14** |
| 137 | `content-loader/service.py` | `download_set` | 3 |
| 131 | `backend/app/services/backup_restore.py` | `_restore_table` | 5 |
| 121 | `backend/app/services/backup_restore.py` | `restore_backup` | 3 |
| 118 | `notebooklm/study_guide_generator.py` | `assemble_project_context` | 2 |
| 117 | `tracking/summary.py` | `aggregate_step_evaluations` | 1 |
| 101 | `session/routes.py` | `_event_stream` | 0 |
| 100 | `backend/app/startup.py` | `create_lifespan` | 3 |
| 99 | `session/session_runner.py` | `run_step_evaluation` | 2 |
| 91 | `gamification/badge_service.py` | `evaluate_user` | 2 |
| 90 | `backend/app/services/sync_push.py` | `push_records` | 5 |

`lesson_progress.upsert_progress` (183 lines, 14 parameters) is the single
highest-risk function in the backend and the best standalone cleanup target
(independent of the god-file splits).

### TypeScript (top 10 of 256, by line count)

| Lines | Function (file:line) |
|---:|---|
| 1311 | `Content` component (`pages/Content.tsx:108`) |
| 1009 | `Settings` component (`pages/Settings.tsx:117`) |
| 991 | `BackupSection` component (`components/BackupSection.tsx:104`) |
| 957 | `ShareWizard` component (`components/content/ShareWizard.tsx:170`) |
| 759 | `Lesson` component (`pages/Lesson.tsx:134`) |
| 710 | `CreateLesson` component (`pages/CreateLesson.tsx:97`) |
| 686 | `ContentRepoSettingsSection` (`components/ContentRepoSettingsSection.tsx:72`) |
| 638 | `ImportDetail` component (`pages/ImportDetail.tsx:91`) |
| 581 | `MatchingExercise` (`components/exercises/MatchingExercise.tsx:206`) |
| 527 | `Session` component (`pages/Session.tsx:65`) |

These confirm the section-2 god-files are single oversized component functions -
the split strategy is to extract sub-components and hooks (the pattern #354 used
for `useLessonFlowControl` / `useLessonNavigation` / `useContentSearch`).

---

## 5. Functions over 5 parameters

A high parameter count is an SRP smell (the caller assembles a wide,
positional context). 25 Python and 5 TypeScript production functions exceed 5.

### Python (top 10 of 25)

| Params | File | Function |
|---:|---|---|
| **14** | `backend/app/services/lesson_progress.py` | `upsert_progress` |
| 12 | `backend/app/repositories/imports_repo.py` | `create_conversation` |
| 10 | `backend/app/services/github_service.py` | `create_lesson_pr` |
| 9 | `session/topic_transition.py` | `evaluate_topic_transition[_async]` |
| 9 | `session/session_runner.py` | `_finalize_stream_exchange` |
| 9 | `content-loader/service.py` | `save_user_set` |
| 8 | `session/step_evaluator.py` | `evaluate_step[_async]` |
| 8 | `missions/generator.py` | `assign_daily_missions` |
| 8 | `backend/app/services/conversation_analysis.py` | `analyze_conversation_with_ai` |
| 7 | `content-loader/cache.py` | `store_set` |

Recommended remedy: introduce a dataclass / TypedDict context object
(coding-standards.md "Data between functions") for the worst cases -
`upsert_progress` (14), `create_conversation` (12), `create_lesson_pr` (10).

### TypeScript (all 5, each 6 params)

`api/client.ts:51` (constructor), `lib/github/github-api.ts:281` (`commitFile`),
`storage/ai-providers.ts` `anthropicStream` / `openaiStream` / `geminiStream`.
The three `*Stream` functions share a signature shape and are the natural
candidate for a single options object.

---

## 6. Import-density hotspots

High import count signals high coupling. Threshold: > 10 (Python), > 15 (TS).

### Python (top 12 of 32)

| Imports | File |
|---:|---|
| 37 | `backend/app/main.py` |
| 29 | `session/session_runner.py` |
| 27 | `gamification/badge_service.py` |
| 25 | `session/routes.py` |
| 22 | `backend/app/startup.py` |
| 17 | `backend/app/deps.py` |
| 16 | `content-loader/routes.py` |
| 16 | `backend/app/routers/sync.py` |
| 15 | `gamification/xp_service.py` |
| 14 | `learning-repo/routes.py` |
| 14 | `content-loader/service.py` |
| 14 | `backend/app/database.py` |

`main.py` (37) and `deps.py` (17) are composition roots - high import counts are
expected there and are not a cohesion defect. `session_runner.py` (29) and
`badge_service.py` (27) are genuine coupling hotspots worth watching.

### TypeScript (top 10 of 17)

| Imports | File |
|---:|---|
| 46 | `pages/Settings.tsx` |
| 44 | `pages/Lesson.tsx` |
| 35 | `pages/Dashboard.tsx` |
| 30 | `pages/Content.tsx` |
| 24 | `pages/ImportDetail.tsx` |
| 24 | `components/editor/RichTextEditor.tsx` |
| 23 | `App.tsx` |
| 22 | `pages/Session.tsx` |
| 21 | `storage/dexie-storage.ts` |
| 19 | `components/exercises/WordTilesExercise.tsx` |

The import hotspots correlate strongly with the section-2 god-files - splitting
those will lower these counts as a side effect.

---

## 7. Cyclomatic complexity (TypeScript)

Top complexity offenders (ESLint `complexity`, threshold 15):

| Complexity | Function (file:line) |
|---:|---|
| 80 | `ShareWizard.tsx:170` |
| 68 | `Lesson.tsx:134` |
| 58 | `ImportDetail.tsx:91` |
| 54 | `lib/backup-diff.ts:330` |
| 49 | `storage/backup.ts:809` |
| 45 | `MatchingExercise.tsx:206` |
| 45 | `Settings.tsx:723` |
| 40 | `utils/eventRecorder.ts:173` |
| 36 | `BackupSection.tsx:104` |
| 35 | `Content.tsx:108` |

69 TS functions exceed complexity 15. `lib/backup-diff.ts` (54) and
`utils/eventRecorder.ts` (40) are notable because they are NOT baselined
god-files - they are high-complexity logic in otherwise reasonably sized files,
so they are independent cleanup candidates.

---

## 8. Summary

| Metric | Count | Notes |
|---|---:|---|
| Production files > 1000 lines | 10 | 2 whitelisted, 8 baselined (#372) |
| Production files 500-1000 lines | 34 | 2 whitelisted; advisory WARN |
| Backend functions > 50 lines | 64 | worst: `upsert_progress` (183) |
| Frontend functions > 50 lines | 256 | mostly page-component bodies |
| Backend functions > 5 params | 25 | worst: `upsert_progress` (14) |
| Frontend functions > 5 params | 5 | all 6 params |
| Python import hotspots > 10 | 32 | `main.py` (37) is a composition root |
| TS import hotspots > 15 | 17 | correlate with the god-files |
| TS complexity > 15 | 69 | worst: `ShareWizard` (80) |
| Watcher errors on this commit | 0 | gate is green |

### Cohesion score: 9 / 10 (re-rated 2026-06-15; was 7/10 on 2026-06-13)

**Original 7/10 rationale (2026-06-13):** the architecture is sound and trending
positive: the backend god-files were split (#353), the frontend hooks/namespaces
were extracted (#354), and a regression gate is now in place (#371). What kept
the score from being higher was a real, bounded tail of debt: 8 mixed-concern
files still over 1000 lines and a handful of high-parameter / high-complexity
functions. All of it was visible, frozen against growth, and tracked - the
difference between managed debt and drift.

**Re-rated 9/10 (2026-06-15, v1.79.0):** that bounded tail is gone. The #372
split campaign is complete and `.filesize-baseline` is empty (0 baselined, 0
ERROR); the complexity burn-down is complete and `.complexity-baseline` is empty
(#498–#504); all four next-actions below landed (#375/#502, #422, #436,
#376/#382); and the gate is now backed by three live CI watchers (file-size
#371, complexity #400, security-scan #378) plus the Phase 2 radon hard gate
(#494/#495). The remaining −1 is the steady-state advisory tail: 45 files in the
500–1000 WARN band (page-component bodies, never blocking) — cohesive enough to
not warrant forced splitting, but the reason the score is not a perfect 10.

### Recommended next actions (input to #372 and standalone)

> **Status (2026-06-15): all four complete.** #1 `upsert_progress` → #375 +
> #502; #2 per-file splits → #372 (`.filesize-baseline` empty); #3 `backup-diff`
> #422 + `eventRecorder` #436; #4 parameter-objects → #376/#382. Retained below
> for history.

1. **Standalone, backend (CC), highest value:** refactor
   `lesson_progress.upsert_progress` (183 lines, 14 params) behind a context
   dataclass. Independent of any god-file split.
2. **#372, per-file splits** (lower the `.filesize-baseline` value as each lands):
   - Frontend (CCW): extract sub-components + hooks from `Lesson.tsx`,
     `Content.tsx`, `Settings.tsx`, `ShareWizard.tsx`, `BackupSection.tsx`;
     split `client.ts` per API namespace; split `db.ts` per table group.
   - Backend (CC): continue thinning `session/routes.py` toward the
     service/runner layers.
3. **Independent complexity cleanups (not baselined):** `lib/backup-diff.ts`
   (cx 54) and `utils/eventRecorder.ts` (cx 40).
4. **Parameter-object refactors:** `imports_repo.create_conversation` (12),
   `github_service.create_lesson_pr` (10), and the three `ai-providers` stream
   functions (6 each, shared shape).

When `.filesize-baseline` reaches empty, the > 1000 hard gate stands with no
exceptions and the cohesion score should be re-evaluated.
