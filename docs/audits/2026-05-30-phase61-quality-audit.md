# Phase 61 — Quality Audit (v1.45.0)

**Date:** 2026-05-30 · **Baseline:** v1.44.0 (commit `c02dc09`) · **Branch:** `main`

This is the AUDIT-FIRST deliverable for Phase 61 (Parts A + C + D1). No
fixes have been applied. HTML coverage reports live under
`docs/audits/coverage/{backend,frontend}/`.

---

## Pre-flight gates — ALL GREEN

| Gate | Result |
|---|---|
| `make test` (backend + plugins + Vitest) | ✅ backend 1035 passed (+1 skipped), plugins all green, Vitest 2616 passed |
| `npm run build` | ✅ built; PWA precache 111 entries |
| Vitest full (`npx vitest run`) | ✅ 237 files / 2628 passed |
| `make test-dexie-smoke` | ✅ 19 passed (25.3s) |

> **Note on Vitest counts:** `make test` reported 236 files/2616, a plain
> `npx vitest run` reports 237/2628. The delta is a conditionally-included
> test file; both runs are fully green. (See Finding T-1.)

---

## PART A — Test Coverage

### A1 — Backend: **92% overall** (4887 stmts, 404 missed)

Backend is in excellent shape. The service layer is mostly >89%; the
weak spots are config/infra files, not business logic.

| File | Cov | Missed | Note |
|---|---|---|---|
| `app/config_overlay.py` | **51%** | 48 | Config merge/overlay — error & precedence branches untested |
| `app/routers/content.py` | **67%** | 19 | Content-validation routes (Phase 60, newest) |
| `app/logging_config.py` | 69% | 9 | Logging setup |
| `app/paths.py` | 74% | 8 | Path helpers (some branches) |
| `app/services/secrets_template.py` | 80% | 7 | Permission-audit branches |
| `app/services/reset_service.py` | 81% | 9 | |
| `app/main.py` | 84% | 48 | Lifespan/startup branches |
| `app/services/sync_service.py` | 85% | 32 | Conflict-resolution edge paths |
| `app/services/backup_service.py` | 89% | 22 | Restore edge cases |
| `app/services/model_discovery.py` | 89% | 18 | |
| `app/services/conversation_analysis.py` | 90% | 19 | AI error paths |

Everything else ≥90%. **0 files at 0%.** Already above the >90% target at
the aggregate; only `config_overlay.py` (51%) and `routers/content.py`
(67%) are below the per-file bar for service/router code.

### A2 — Plugins (own-tests coverage)

> **Important caveat:** these numbers measure each plugin package as
> covered by *its own* `tests/` suite only. The plugins are also
> exercised heavily by the backend integration suite (`backend/tests/`,
> 1035 tests via TestClient), which is NOT counted here. **Real combined
> coverage is materially higher** — especially for `session`, `anki`,
> `notebooklm`, `gamification`. Treat the low numbers as "own-suite gaps"
> not "untested code". A combined-coverage run is a follow-up if you want
> the true figure.

| Plugin | Own-tests cov | Tests | Stmts | Missed |
|---|---|---|---|---|
| ai-anthropic | 87% | 35 | 94 | 12 |
| ai-gemini | 87% | 34 | 95 | 12 |
| ai-openai | 85% | 32 | 94 | 14 |
| content-loader | 80% | 287 | 1285 | 261 |
| learning-repo | 79% | 53 | 597 | 127 |
| tracking | 78% | 64 | 229 | 51 |
| assessment | 64% | 110 | 163 | 58 |
| tools | 61% | 58 | 142 | 55 |
| session | **38%** | 215 | 1060 | 660 |
| missions | **38%** | 14 | 217 | 134 |
| notebooklm | **34%** | 27 | 370 | 243 |
| gamification | **33%** | 54 | 604 | 402 |
| anki | **31%** | 20 | 303 | 209 |

Weakest own-suites: `anki`, `gamification`, `notebooklm`, `missions`,
`session`. `missions` (38% / only 14 tests) is the clearest real gap —
it's a newer plugin and its 14 tests are genuinely thin relative to a
217-stmt generator + evaluator.

### A3 — Frontend: **84.45% lines** / 82.47% stmts / 79.36% funcs / 72.17% branches

Above the >80% line target. Exercises are very well covered. Weak spots:

**Storage layer (parity concern — maintainer flagged):**

| File | Cov | Note |
|---|---|---|
| `storage/notebooklm.ts` | **3.63%** | Effectively untested (ApiStorage namespace) |
| `storage/anki.ts` | **35.78%** | |
| `storage/api-storage.ts` | **45.52%** | **ApiStorage is the DEFAULT mode but is far less unit-tested than DexieStorage (76.87%).** Vitest exercises the Dexie path; ApiStorage relies on E2E. |
| `storage/dexie-storage.ts` | 76.87% | (for contrast) |

**Components / pages:**

| File | Cov |
|---|---|
| `components/NotebookLMSection.tsx` | 23% |
| `lib/content/duplicate-detection.ts` | 26% |
| `lib/anki/apkg-builder.ts` | 30% |
| `pages/ImportDetail.tsx` | 33% |
| `components/SyncSection.tsx` | 35% |
| `components/GamificationSettingsSection.tsx` | 39% |
| `pages/Anki.tsx` | 42% |
| `api/client.ts` | **50%** | central API client — half-covered |
| `pages/AdaptiveLesson.tsx` / `hooks/useAdaptiveLesson.ts` | 52% / 57% |

**Exercises (all 5 types) — strong:** ExerciseDispatcher 73%, WordTiles
89%, Matching 93%, Cloze 98%, FreeText/PictureChoice 100%.

**Hooks — mostly strong:** weakest are `useAdaptiveLesson` 57%,
`useCountUp` 62%; the rest ≥81%.

### A4 — E2E gaps

17 smoke specs + 1 Dexie gate exist. The Dexie gate walks 17 routes but
**render-only** (no interaction). 10 of 11 maintainer-listed journeys
have **no end-to-end interaction coverage**; 1 is partial:

| Flow | Status |
|---|---|
| Content download + lesson playthrough (all 5 exercise types) | **MISSING** |
| Adaptive lesson generation + completion | **MISSING** (empty-errors render only) |
| Review session flow `/review` | **MISSING** (empty-queue render only) |
| Mission assignment + completion + celebration | **MISSING** |
| Analysis-to-lesson conversion + save + replay | **MISSING** |
| Import lesson from file | **MISSING** |
| Export lesson (JSON + ZIP) | **MISSING** (only Markdown report/curriculum export tested) |
| Badge tier upgrade | **MISSING** |
| Theme switching (6 themes render) | **MISSING** |
| Settings tab navigation (7 tabs) | **PARTIAL** (only API-key save tested) |
| Content Browser tree + language filter | **MISSING** (render-only) |

Highest-value first targets: a single cached-lesson playthrough hitting
all 5 exercise types, and the Content Browser tree + language filter.

---

## PART C — Internal Code Audit

### C1 — Dead code (show-before-delete)

**High-confidence actionable:**

- `backend/app/services/pairing.py:104` — `peek_token` — zero references anywhere (not even a test).
- `frontend/src/lib/themes.ts:82` — `DEFAULT_THEME` — referenced nowhere.
- `frontend/src/lib/feedback/feedbackPref.ts:188` — `FEEDBACK_PREF_KEYS` — referenced nowhere.
- `frontend/src/lib/content/content-validator.ts:61` — `CEFR_LEVELS` — referenced nowhere.
- `frontend/src/lib/content/content-validator.ts:94` — `treePlacement` — referenced nowhere.

**Dead component cluster (test-covered, no production render path):**

- `frontend/src/components/ProjectTaxonomy.tsx` → imports `SubjectBrowser.tsx`; plus `TagManager.tsx`. All three imported only by their own tests. Onboarding does taxonomy inline instead. (MEDIUM — may be intentionally parked for a future Settings/Curriculum surface; confirm before deleting.)

**Tests-only / dynamic-reach (NOT recommended for deletion — they pin
regressions or are dispatch surfaces):** backend `adaptive_lesson.analyze_errors`/`analysis_to_dict` (parity port), `settings.resolve_default_model`; ~13 frontend `*_PREF_KEYS` and helper exports used only by their pinning tests; storage `anki.extractFromSession`, 3× `notebooklm.*`, `gamification.evaluateBadges`; `plugins.manifests/health/errors` (manifest-driven-UI infra, no consumer yet).

No dead hooks. Full list with line numbers retained in this audit's working notes.

### C2 — Architectural consistency

| Check | Result |
|---|---|
| `api.*` in pages | 1 documented server-only exception (`LearningRepo.tsx:110` git-persist, gated on `storageMode==="api"`). Suggest an inline `// server-only` comment. **Not a violation.** |
| `fetch()` in components | **1 real finding:** `components/SyncSection.tsx:396` — raw `fetch("/api/sync/pair/generate")` bypassing the api client, throwing bare `Error` not `ApiError`. Sync is server-only, but it should route through the central client. (MEDIUM) |
| Plugin structure | Uniform. AI plugins are hook-only by design (no routes.py). Clean. |
| Sync coverage | Clean — all 29 models in `sync_service.TABLES`. |
| Dexie schema | Clean — 32 tables, no orphans/missing (3 extra = local-cache/config by design). |
| Dexie smoke route coverage | **1 gap:** `/import/:conversationId` (ImportDetail) is nav-reachable but NOT walked by the Dexie gate. (MEDIUM) |
| **Doc drift** | CLAUDE.md says "Sync surface: 31 tables"; actual is **29**. (LOW) |

### C3 — Error handling

Strong overall. No `HTTPException` in services. No bare/silent excepts.
Frontend storage calls are wrapped and surface friendly errors.

- `backend/app/main.py:218` — `_load_app_config` swallows a config-parse failure with `except Exception: project = {}` and **no log line**. A malformed `app.yaml` becomes invisible. (LOW — add `logger.warning`.)
- Several parse-or-default helpers (`imports.py:68`, `lesson_progress.py:44`, `extract_json.py:96`, `sync_service.py:660`) return defaults without logging — acceptable by design, listed for completeness.

### C4 — Performance (fix only HIGH impact)

- `export_service.py:251` — **N+1**: per-session `SessionRating` query inside the export loop. Fix: pre-fetch ratings in one `IN (...)` query (mirror the `topic_by_id` pattern two lines up). (MEDIUM)
- Dexie full-table scans ignoring the `project_id` index, run on hot paths (badge eval on every completion, dashboard streaks): `storage/badges.ts:61,79,97,113,176`, `storage/streaks.ts:65,188`, `storage/gamification.ts:199`. Mechanical fix: `.where("project_id").anyOf([...])` instead of `.filter(s => ids.has(...))`. Cheap on a fresh install, degrades as `learningSessions` grows. (MEDIUM)
- `Content.tsx:534-546` — `buildContentTree(...)` + set lists recomputed every render (no `useMemo`); Content has many state triggers. (MEDIUM)
- `useI18n.ts:117` — provider `value` object recreated every render (no `useMemo`); app-wide consumer. (LOW)
- **Bundle:** `html5-qrcode` is statically bundled into the **Settings chunk (542 KB)** via `SyncSection.tsx:41`. It's only needed when the QR scanner opens. `React.lazy` the `QRScannerModal` → big win on a commonly-visited page. jszip/sql.js already correctly lazy-loaded. `index` chunk is 1.14 MB (storage + bundled badge data + shell) — under the 2 MB concern bar. (MEDIUM)
- Other N+1-shaped loops (notebooklm generators, badge seeding, tree ancestry walks) are bounded/startup-only — LOW, not worth fixing.

### C5 — Security

- **No P0/P1.** No key exposure (eventRecorder redacts keys + strips URL query params), no XSS sinks (zero `dangerouslySetInnerHTML`/`innerHTML`), CORS has no wildcard default, `secrets.yaml`/`identity.yaml` written `0o600` + startup permission audit.
- **P2:** `plugins/.../content_loader/cache.py:255` (`read_lesson`) joins `set_id`/`source`/`filename` into a path with **no resolve()+startswith guard** — unlike its sibling `read_asset` which has one. Mitigated by the route's plain `{filename}` converter (blocks `/`) + JSON-parse gate, so it's defense-in-depth, not an open exploit. Recommend adding the same guard `read_asset` already uses. (P2)
- **P3:** (a) Gemini model-discovery sends key in URL query string (`model-discovery.ts:283`) — Google's required convention, browser-direct, query stripped from telemetry; acceptable. (b) No CSP header anywhere — cheap defense-in-depth for the GH-Pages deploy. (c) `secrets_template`/`identity` write-then-chmod TOCTOU (sub-ms window; neither file holds a real secret at write time).

### C6 — Consistency

Clean: naming (PascalCase components / camelCase fns / snake_case Python),
date handling (uniformly `datetime.now(UTC)`; the one local-time use in
`missions/schedule.ts` is intentional midnight-rollover), null handling,
and i18n error-message tone. No findings.

---

## PART D1 — Dependency sweep (minor/patch only; majors listed, NOT applied)

### Apply (minor + patch, low risk)

**Frontend:**
- `@types/react` 19.2.14 → 19.2.15
- `@vitest/coverage-v8` 4.1.6 → 4.1.7 + `vitest` 4.1.6 → 4.1.7 (lockstep)
- `dexie` 4.4.2 → 4.4.3
- `lucide-react` 1.16.0 → 1.17.0
- `react-router-dom` 7.15.1 → 7.16.0
- `vite` 8.0.13 → 8.0.14

**Backend:**
- `pydantic-core` 2.46.4 → 2.47.0
- `uvicorn` 0.46.0 → 0.48.0 (minor)

**Launcher:**
- `packaging` 26.1 → 26.2
- `platformdirs` 4.9.6 → 4.10.0
- `pyinstaller-hooks-contrib` 2026.4 → 2026.5

### MAJOR — list only, you decide per dep (NOT applied)

| Dep | Current | Latest | Held by |
|---|---|---|---|
| `anthropic` | 0.55.0 | 0.105.2 | **DEP-ANTHROPIC-105-01** (intentional hold) |
| `mypy` | 1.20.2 | 2.1.0 | **DEP-MYPY-2-01** (intentional hold) |
| `@vitejs/plugin-react` | 5.2.0 | 6.0.2 | major |
| `@types/node` | 24.12.4 | 25.9.1 | major (would force tsconfig `lib` review — see lessons-learned) |
| `sql.js` | 1.13.0 | 1.14.1 | minor-but-wasm; verify apkg build before applying |
| `@tiptap/*` (all) | 2.x | 3.23.6 | major (DEP-TIPTAP; peer-dep pinning required) |

---

## Findings index (for the fix phase)

**Test-infra:**
- **T-1 (P3):** `lib/content/duplicate-detection.test.ts` "diacritic-insensitive title match" fails **only** under full-suite parallel `--coverage`; green under `make test`, plain `vitest run`, isolated, and subset-coverage. `normaliseTitle` is a pure function → coverage-instrumentation/worker-scheduling flake, not a product bug. Does not block any gate. Decide: quarantine, force single-thread for that file, or investigate the worker race.

**Security:** P2 `read_lesson` traversal guard; P3 CSP, Gemini-URL-key (accept), TOCTOU.
**Architecture:** SyncSection `fetch()`→api client; `/import/:id` Dexie smoke gap; CLAUDE.md "31 tables"→29.
**Performance:** export_service N+1; Dexie index scans (badges/streaks/gamification); Content.tsx useMemo; html5-qrcode lazy-load.
**Error handling:** main.py:218 silent config fallback.
**Dead code:** `peek_token`, 4 lib consts/fn, ProjectTaxonomy/SubjectBrowser/TagManager cluster.
**Coverage gaps:** backend `config_overlay`/`routers/content`; plugin own-suites (missions, anki, gamification, notebooklm, session); frontend ApiStorage/notebooklm/anki/api-client; E2E 10 missing journeys.
