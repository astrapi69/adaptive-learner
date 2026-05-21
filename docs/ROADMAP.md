# Adaptive Learner Roadmap

Current state: **v1.8.0 released (Phase 21 / Sync Gaps: step_evaluations + session_notes + i18n keys shipped 2026-05-20).**

## Phase history (completed)

| Phase | Release | Headline |
|---|---|---|
| 1 | v0.1.0 | Skeleton strip + domain models + core routers + plugin hookspecs |
| 2-4 | v0.1.0 | Backend domain wiring + 7 plugins + frontend pages |
| 5 | v0.2.0 | Multi-provider AI (Anthropic / OpenAI / Gemini), server-side orchestration |
| 6 | v0.3.0 | Per-(method, step) prompt matrix, Lesson CRUD, Playwright smoke specs |
| 7 | v0.4.0 | Cycle-step advance, Dashboard polish, model picker, spaced recommendations |
| 7-extras | v0.4.1 | Skip-button hoist, favicon `.ico` fallback, CI Release Gate fix |
| 8 | v0.5.0 | Dual-prompt AI cycle transitions, StepEvaluation persistence, tracking aggregates |
| 9 | v0.6.0 | Mobile PWA — responsive UI, service worker, install prompt, offline indicator |
| 10 | v0.7.0 | Dexie parallel storage + GitHub Pages deploy — IStorageService, browser-direct AI, public site |
| 11 | v0.8.0 | Comprehensive MkDocs documentation (DE + EN) — 28 pages across User Guide / Concept / Developer / API, deployed at /docs/ |
| 12 | v0.9.0 | Chat-history import + AI analysis — paste/upload ChatGPT/Claude/Gemini transcripts, extract structured learning insights |
| 13 | v1.0.0 | Local-network sync with AI-merge — bidirectional WiFi sync between devices with intelligent conflict resolution |
| 14 | v1.1.0 | About tab in Settings — five-section panel + system-info endpoint, storage-mode-aware |
| 15 | v1.2.0 | Backup + restore — Dexie + API parity, auto-backup rotation, compare UI, full Settings integration |
| 16 | v1.3.0 | Learning progress export (PDF + Markdown) — 3 report types (Progress / Session / Curriculum), identical wire shape across storage modes |
| 17 | v1.4.0 | Auto-Loop: continue learning after step 7 — topic-transition evaluator, cycle counter, multi-cycle session summary |
| 18 | v1.5.0 | Async AI Calls + Performance — async SQLAlchemy foundation, parallel step-eval + topic-transition at cycle boundary, per-message timing metrics |
| 19 | v1.6.0 | Streaming Learning Response — ai_complete_stream hookspec + 3 provider impls, POST /message/stream SSE route, inline frontend SSE reader, browser-direct Dexie streaming, incremental SessionChat rendering |
| 20 | v1.7.0 | QR-Code Camera Scan for Sync Pairing — html5-qrcode dep, QRScanner + QRScannerModal + QRImageUpload, viewfinder overlay with reduced-motion, haptic feedback, file-upload fallback. BL-04 closed. |
| 21 | v1.8.0 | Sync Gaps: step_evaluations + session_notes + i18n + imported_conversations + imported_messages — Dexie schema v3+v4+v5 aligning with backend Alembic 0006+0007, 62 sync.* keys to YAML catalogs, full 16-table sync surface audit, PluginForge ^0.7.0→^0.8.0. BL-05 + BL-06 closed. |
| **22** | **v1.9.0** | **Global Subjects and Tags — 4 new tables (subjects, tags, project_subjects, project_tags) join the sync surface (20 tables); pre-seeded subjects.yaml with 80+ nodes across 8 categories; SubjectBrowser + TagManager + ProjectTaxonomy + DashboardFilterBar components; Onboarding subject suggester + tag input. PluginForge ^0.8.0→^0.9.0 (hard-filter transition active). BL-07 closed.** |

Annotated tags + GitHub Releases ship same-day; see `git tag` for the full list. Per-release notes live in [changelog/releases/](../changelog/releases/).

---

## Next phase (planned)

**Phase 23 candidates** — current top of backlog (see [backlog.md](backlog.md) for full P0..P5 view):

- **BL-03 — pluginforge-app-template repo.** Export a
  v0.0.0-template tag into astrapi69/pluginforge-app-template.
  Validates PluginForge ecosystem (3 repos: framework,
  template, app).
- **BL-08 — Swipe gestures on Assessment.** Deferred from
  Phase 9.
- **BL-09 — Provider model picker via API.** Anthropic +
  OpenAI ``/v1/models``.
- **BL-10 — Backup compare UI.** Side-by-side diff per table.

---

## P1 — High-value, clear scope

- **BL-05 — Sync gap: step_evaluations + session_notes.**
  Excluded from v1.0.0 sync due to schema mismatch between
  Dexie and backend. Align schemas, add to sync surface.
- **BL-06 — Sync i18n strings.** Currently inline `t()`
  fallbacks. Add proper `sync.*` keys to all 8 YAML catalogs.

---

## P2 — Medium value, medium effort

- **BL-08 — Swipe gestures on Assessment** (deferred from Phase 9)
- **BL-09 — Provider model picker via API** (Anthropic + OpenAI `/v1/models`)
- **BL-10 — Backup compare UI** (side-by-side diff per table)

---

## P3 — Lower value or large effort

- **BL-11 — PT/TR/JA native-quality translations**
- **BL-12 — Rich-text in notes (TipTap)**
- **BL-13 — E2E Playwright expansion** (multi-cycle, import, backup, sync, export)
- **iOS-Safari `apple-mobile-web-app-*` meta tags.** Manifest
  is standard-compliant; iOS PWA install works but the
  iOS-specific status-bar / title meta tags aren't wired. Add
  if iOS users report degraded standalone UX.
- **Per-route SW cache TTL overrides.** Today everything under
  `/api/` is 24h LRU. Defer until usage pattern shows real
  need.
- **"Force refresh" + "Opt out of offline cache" in Settings UI.**
  Power-user knobs for the SW cache.

---

## P4 — Future / SaaS

- **BL-14 — PostgreSQL migration**
- **BL-15 — JWT authentication**
- **BL-16 — Multi-user support** (requires BL-14 + BL-15)
- **BL-17 — Stripe integration** (requires BL-14 + BL-15 + BL-16)

---

## P5 — Speculative

- **BL-18 — Gamification (XP, badges, leaderboard)**
- **BL-19 — Social features (share progress, study groups)** (requires multi-user)
- **BL-20 — Voice input/output (TTS/STT)**
- **BL-21 — Anki deck export** (.apkg from session content)
- **BL-22 — NotebookLM integration**
- **Push notifications.** SW is registered, foundation is there;
  notification opt-in + delivery + a "next session due" trigger
  would be its own phase.
- **Native iOS / Android wrappers.** Capacitor / Tauri Mobile.
  Lower priority than the PWA route since installable PWA covers
  most use cases.

---

## Open backlog

See [backlog.md](backlog.md) for the granular daily-planning view.

Archive: [docs/roadmap-archive/](roadmap-archive/) (not yet populated;
phase completions are recorded in `changelog/releases/v*.md`).
