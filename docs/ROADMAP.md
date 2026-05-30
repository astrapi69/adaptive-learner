# Adaptive Learner Roadmap

Current state: **v1.45.0 released 2026-05-30 (Phase 61 — quality sweep: security P2 read_lesson guard, coverage (missions 14→41, ApiStorage 45→100%, config_overlay 51→90%, 3 interactive Dexie E2E journeys), architecture (SyncSection→api client, /import/:id in the gate), performance (export N+1, html5-qrcode lazy), dead-code removal, tree-placement + duplicate detection in the share pipeline, minor/patch deps).** 1047 (+1 skipped) backend + 1031 plugin + 2624 Vitest = 4702 tests green (+1 skipped). 17 Playwright smoke spec files run separately; the Dexie-mode release gate (23 specs) runs via `make test-dexie-smoke`.

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
| 22 | v1.9.0 | Global Subjects and Tags — 4 new tables (subjects, tags, project_subjects, project_tags) join the sync surface (20 tables); pre-seeded subjects.yaml with 80+ nodes across 8 categories; SubjectBrowser + TagManager + ProjectTaxonomy + DashboardFilterBar components; Onboarding subject suggester + tag input. PluginForge ^0.8.0→^0.9.0 (hard-filter transition active). BL-07 closed. |
| 23 | v1.10.0 | Swipe Gestures on Assessment + Session — useSwipe hook (horizontal-only, velocity-gated, reduced-motion-aware), Assessment swipe+keyboard navigation with one-shot hint, CycleProgress swipe-to-peek overlay, TopicNode iOS-style swipe-to-reveal actions, Settings → Interface gesture toggle. BL-08 closed. |
| 24 | v1.11.0 | Provider Model Picker via API — model_discovery service (Anthropic + OpenAI + Gemini /v1/models with 1-hour cache + chat-only filtering), GET /settings/{id}/available-models endpoint, browser-direct model-discovery for Dexie mode (sessionStorage cache), Settings ModelPicker dropdown component with Recommended/All grouping + offline fallback, model validation on session start (warn + fallback to default when override not in cached list), model name + context-window in session header. BL-09 closed. |
| 25 | v1.12.0 | Backup Compare UI — client-side `lib/backup-diff.ts` engine (UUID matching, chunked async processing, append-only vs mutable split, high-volume tables flagged for summary rendering), shared BackupCompare React component with sortable/filterable per-table cards + field-level diff tables, Settings Compare Backups picker (file/file or file/current), pre-restore diff preview replacing the v0.7.0 row-count table (Restore button gains "(N added, M updated)" dynamic label), Dexie auto-backup "Compare as A/B" controls feeding the same surface, Markdown report exporter (zero-delta tables omitted, high-volume tables summarised, field-level old → new lines), 35 new i18n keys (DE+EN translated, 6 EN-passthrough). BL-10 closed. |
| 26 | v1.13.0 | PT/TR/JA Native Translations — full Brazilian Portuguese, Turkish, and Japanese translations replacing the EN-passthrough placeholders. `test_i18n_translation_audit.py` pins no-passthrough heuristic + ≥90% divergence from EN. BL-11 closed. |
| 27 | v1.14.0 | Rich-Text Notes with TipTap — session-rating notes, curriculum descriptions and lesson content graduate from `<textarea>` to TipTap StarterKit + 15 extensions (bold/italic/underline/strike, H1-H3, bullet+ordered+task lists, blockquote, inline code, code blocks with lowlight syntax highlighting in 11 languages, links, character count). BL-12 closed. |
| 28 | v1.15.0 | E2E Playwright Expansion — 10 new smoke specs land alongside the existing 6 (multi-cycle auto-loop, conversation import + analysis, backup roundtrip, sync pairing UI, MD export, subjects/tags filter, rich-text rating, 3-chunk SSE streaming, model picker, no-key empty state). 16 spec files total at v1.15.0. BL-13 closed. |
| 29 | v1.16.0 | Gamification (XP, Badges, Streaks) — `UserXP` singleton with exponential level curve, 24 badges across 5 categories seeded from YAML, `UserStreak` with freeze stockpile + weekend mode + GitHub-style heatmap. Dashboard widgets + Settings → Gamification toggles. BL-18 closed. |
| 30 | v1.17.0 | Anki Deck Export — client-side .apkg builder (sql.js + JSZip lazy-loaded), AI-extracted `AnkiCardSuggestion` candidates from sessions + conversations, `/anki` page with accept / reject / inline-edit + filters, byte-compatible vocabulary extraction transform shared by backend and frontend. BL-21 closed. |
| 31 | v1.18.0 | Voice (TTS + STT + Pronunciation Practice) — Web Speech API integration; SpeechButton on AI replies + Assessment results, MicButton on Session input with interim transcripts; new pronunciation plugin (phrase generator + judge prompt, Languages-subject-gated eligibility). BL-20 closed. |
| 32 | v1.19.0 | NotebookLM Integration Patterns — new notebooklm plugin: `StudyQuestion` AI-generated active-recall questions, one-shot study guide generator (~30K chars context), client-side NotebookLM-optimized ZIP export (summary + vocabulary + rules + errors + flashcards + sessions). BL-22 closed. |
| 33 | v1.19.1-v1.19.2 | Phase 33 import-pipeline audit — dedicated Claude.ai per-conversation Markdown parser (`claude_md_parser.ts`) closes BL-25/26/28 (full timestamp extraction, role boundary preservation, source attribution). Vocabulary extraction in analyzer closes BL-27 (SYSTEM_PROMPT + `parseAnalysisResponse` extended; chunked merge dedup). `metadata.created_at` ISO normalisation closes BL-29 (US + DE locale support). |
| 34 | v1.20.0 | `secrets.yaml` API-Key Storage for Desktop Mode — three-layer config chain (env > `~/.config/adaptive_learner/secrets.yaml` > Fernet-encrypted DB column) for AI provider keys + default-model overrides. New `ApiKeySource` enum on `UserSettingsOut` (`env` / `secrets_yaml` / `settings` / `none`) drives the per-provider source badge + Save-button gating in the Settings UI. Auto-generated commented template with `chmod 0600` on first run; permission audit on subsequent runs. `_ENV_SECRET_OVERRIDES` populated with 6 entries (3 providers × {api_key, default_model}). All 6 plugin/router callers migrated from `get_decrypted_api_key` to `resolve_api_key`. i18n in all 8 catalogs. |
| 35 | v1.21.0 | Comprehensive Documentation Update — documentation-only release. 10 sub-phases per [docs/audits/docs-staleness-2026-05-22.md](audits/docs-staleness-2026-05-22.md): CLAUDE.md rewrite (46K → <10K), both READMEs rewritten (v0.8.1 → v1.20.0), ROADMAP table extended through Phase 34, CONCEPT post-v1.5.0 milestones, project-reference rebuilt against shipped architecture, MkDocs help pages version-refreshed. 137 stale version refs closed. |
| 36 | v1.21.1 | Import + Analysis Bugfixes — five regressions surfaced by the v1.21.0 manual smoke against real Claude.ai per-conversation Markdown: analysis language mismatch, silent re-import duplication, curriculum / session CTA always creating duplicates instead of resuming, Anki extraction silently failing. New columns on `imported_conversations` + `curriculums` + `learning_sessions`, paired Dexie schema bumps. |
| 37 | v1.22.0 | Error-Toast + GitHub Issue Report Framework — 5xx error toasts gain a "Report Issue" button opening a Radix dialog with a pre-filled GitHub issue URL (error + optional env info + opt-in sanitised action history). Exception-handler chain extended in DEBUG mode (stacktrace + endpoint + method embedded in response body); new in-memory action recorder on the frontend. |
| 38 | v1.23.0 | In-App Contextual Help System — 22 glossary concepts (curriculum, learning project, learning profile, learning session, the six learning methods, the seven cycle steps, five app features) surfaced via dotted-underline `HelpTooltip` + slide-over `HelpDrawer` with full Markdown articles. Settings > Help browser + search. v1.23.1 + v1.23.2 followed with tooltip mounts on all post-onboarding routes, Recharts width-warning fix, stronger dotted-underline visibility, icon-button a11y sweep, and a button-tooltip user preference toggle. |
| 39 | v1.24.0 | WCAG 2.1 Level AA Accessibility Audit + Remediation — full audit + atomic fixes for the two real AA violations surfaced; new dev dependency, regression tests pin each finding. 380-line audit at [docs/audits/wcag-2026-05-23.md](audits/wcag-2026-05-23.md). |
| 40 | v1.24.1 | Release-Automation Hardening — Bibliogon's 4-Tier model adopted: package-lock propagation, open-set version-literal discovery, advisory WARN wiring, aggregate `make release-*` targets, 4-Tier architecture documentation, plugin refactor unblocking the verify chain. No user-visible runtime changes. |
| 41 | v1.25.0 | Identity Persistence + Browser-Wipe Recovery + Danger Zone — `~/.config/adaptive_learner/identity.yaml` writes on user / project / language changes. Frontend Landing flow recovers from disk (API mode) or IndexedDB (Dexie mode) after a `localStorage` wipe. Settings > About > Identity status panel surfaces the resolved identity. Settings > Danger Zone ships a three-step typed-confirm reset: `POST /api/reset` truncates every table and scrubs `ai.*` from `secrets.yaml` while preserving the Fernet `secret_key`. 13 new i18n keys across 8 catalogs. Two new backend endpoints. Six atomic commits. |
| **42** | **v1.26.0** | **Git-Backed Learning Repository (BL-30)** — new `learning-repo` plugin emits per-project Markdown artefacts (`README.md`, `LEARNING_STATS.md`, `CHEATSHEET.md`, `ROADMAP.md` + numbered topic folders) from existing DB state via three endpoints (render JSON, export-zip, persist-to-git). Opt-in `git init` + commit-on-render with semantic subject `Cycle N — U X/10, T Y/10`; tags `cycle-{N}-mastered` on Article-1 § 8 exit threshold (Understanding ≥ 9/10 AND Transfer ≥ 8/10 stable over 2 cycles). New core endpoint `/api/plugin-settings/{plugin_name}` (GET + PATCH) closes the architecture-rule gap on UI-editable plugin settings. New `SessionNote.kind` column (`"note"` / `"meta_learning"`) is the Article-3 "Meta-Learning Insight" slot. Frontend ships `/projects/:projectId/learning-repo` page + Dashboard widget + Settings panel. i18n `repo.*` block in all 8 catalogs (DE+EN native, 6 AI-translated). Seven atomic commits per the BL-30 plan; implements Asterios Raptis' *Von Theorie zur Praxis* Article 3 pattern.** |

Annotated tags + GitHub Releases ship same-day; see `git tag` for the full list. Per-release notes live in [changelog/releases/](../changelog/releases/).

---

## Next phases (planned)

**Phase 43 candidate** — no committed item yet. The post-BL-30
backlog (see [backlog.md](backlog.md)) carries several P2 / P3
candidates but none are pulled forward; the next phase is set
in the v1.26.0 → v1.27.0 review.

Known follow-ups to BL-30 that may shape Phase 43:

- **Per-topic-folder triplet** (`concepts.md` / `tasks.md` /
  `solutions.md`). Article 3's "Drei-Datei-Prinzip" — folders
  currently ship only the stub README. Becomes a phase when a
  user actually wants the deeper structure.
- **Method-experiment git branches**. Article 3's "branches
  as method experiments" — short-lived git branches per
  learning method to support A/B comparisons. Trigger: a user
  reports wanting to compare two methods on the same topic.
- **GitHub-push automation for `learning-repo`**. Trigger:
  user demand for a "share my learning repo publicly" flow.

Other deferred work:

- **BL-14..17 — SaaS-tier items.** Multi-user, JWT auth,
  Postgres migration, Stripe / premium plugins. Deferred
  until the single-user-per-browser model hits an
  obstacle.

BL-03 (`pluginforge-app-template` repo) shipped externally
ahead of Phase 42 — `astrapi69/pluginforge-app-template`
exists at tag `v0.1.0` (created 2026-05-17). PluginForge
ecosystem triple is validated.

---

## P3 — Lower value or large effort

- **PT/TR/JA native-speaker review.** Phase 26 / v1.13.0
  shipped AI-translated PT/TR/JA. Native review of the
  catalogs (~220 keys + 60 assessment strings per language)
  remains an open follow-up; opportunistic when a native
  speaker reports awkward phrasings.
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

- **BL-19 — Social features (share progress, study groups)** (requires multi-user; see P4).
- **Method-experiment branching for the Learning Repository.**
  Once BL-30 (Phase 42 candidate) ships its synchronous render path,
  the optional `git`-on-disk surface could grow short-lived branches
  per learning method to support A/B experiments. Trigger: a user
  reports actually wanting to compare two methods on the same topic.
- **Push notifications.** SW is registered, foundation is there;
  notification opt-in + delivery + a "next session due" trigger
  would be its own phase.
- **Native iOS / Android wrappers.** Capacitor / Tauri Mobile.
  Lower priority than the PWA route since installable PWA covers
  most use cases.

BL-18 (Gamification), BL-20 (Voice), BL-21 (Anki),
BL-22 (NotebookLM) all shipped — see the Phase history table
above for the release each landed in.

---

## Open backlog

See [backlog.md](backlog.md) for the granular daily-planning view.

Archive: [docs/roadmap-archive/](roadmap-archive/) (not yet populated;
phase completions are recorded in `changelog/releases/v*.md`).
