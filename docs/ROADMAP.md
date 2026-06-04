# Adaptive Learner Roadmap

Current state: **v1.58.0 released 2026-06-04 (user-centric UX overhaul — a shared Continue Learning ("Weitermachen") section on the Content Browser + Dashboard surfacing the most recently-touched lesson per set (resume / next-lesson / set-complete), reading `LessonProgress` + set manifests through `getStorage()` so both storage modes carry it; the Content Browser reordered search-first with a compact icon-only mobile action toolbar (Import Lesson / Import Chat / Learning Path / Create, 44 px targets); the Dashboard reordered to lead with Continue Learning + the actionable cards (paused / missions / focus / review) before gamification; and a responsive button pattern (icon-only on mobile, icon + label from `md` up); 23 new frontend tests; see changelog/releases/v1.58.0.md).** Prior: **v1.57.0 released 2026-06-03 (community PR automation — sharing a lesson creates a real fork -> commit -> pull request (backend `github_service` + `/api/github/*` proxy in API mode, browser-direct `lib/github/github-api.ts` in Dexie mode, via `IStorageService.github`), GitHub PAT Fernet-encrypted in `secrets.yaml` and managed in Settings -> Integrations; Content Browser instant search (debounced 300 ms, case/diacritic-insensitive, German-digraph-aware, Cmd/Ctrl+K, lazy index); Tailwind Phase D (shadcn `Progress` XP bar + a11y, badge-tier dots, toast tokens, Lucide nav + 44 px targets, Help Drawer -> shadcn `Sheet`, E2E Radix-Select migration); psychology to 90 lessons / 225+ total; see changelog/releases/v1.57.0.md).** Prior: **v1.56.0 released 2026-06-03 (performance + PWA hardening: ~460 KB gzip saved via lazy per-language i18n catalogs (main chunk 446->233 KB gzip, off every page) + a curated highlight.js (296->21 KB gzip on code lessons); bundle audit at `docs/audits/performance-audit-2026-06-03.md`; Dexie + backend query layers audited healthy (no page-load N+1; `BADGE-EVAL-NPLUS1-01` P3 filed); PWA — offline indicator + network-aware buttons, a localStorage background-sync queue for offline lesson-progress upserts, cache-management UI in Settings->Data, a 7-day/standalone-aware install prompt, and a service-worker StaleWhileRevalidate route for API-mode lesson caching; carries the Tailwind/shadcn migration (Phases B-D — buttons/Card/Badge/Progress, Lesson + Share dialogs, form inputs to shadcn Input/Select, XP bar) + backend API rate limiting (3-tier token-bucket) + OpenAPI docs; fix — restored the per-theme read-aloud control in Dexie mode (`getLessonDexie` injects the set's language pair/domain; closes `TTS-E2E-HEADLESS-GUARD-01`; `IMPORT-LANG-PIPELINE-SELECT-MIGRATION-01` filed); content at 215+ lessons; see changelog/releases/v1.56.0.md).** Prior: **v1.55.0 released 2026-06-03 (CSS-framework foundation + Error Replay: adopts Tailwind CSS v4.3.0 + shadcn/ui as the styling framework (Phase A, additive — the migration is incremental: components convert when touched, no Big Bang). Tailwind is configured CSS-first (`@theme` in `frontend/src/styles/tailwind.css`) and CONSUMES the existing 6-theme CSS variables (`bg-accent` -> `var(--accent)` etc.) so all themes keep working; preflight is intentionally off and all Tailwind output is layered, so unlayered `global.css` always wins and existing pages stay pixel-identical. shadcn/ui base is wired (`components.json` + `cn()` at `@/lib/utils` + `@/*` alias; no components installed yet, the semantic-token bridge lands with the first component); `LessonStickyFooter` is the proof-of-concept; `.claude/rules/` + CLAUDE.md updated to adopt Tailwind; full guide at `docs/development/tailwind-migration.md`. Ships the **Error Replay** feature ("Fehler wiederholen" — after a lesson, retry only the exercises you failed, via `/error-replay/...` + `error-replay.ts`) with priority-aware next-step suggestions (error replay is PRIMARY at 0-1 stars), TTS read-aloud for lesson cards, and Stryker frontend mutation testing wired (nightly, opt-in). Carries forward the 10 sets / 200 lessons / 3 domains content library; see changelog/releases/v1.55.0.md).** Prior: **v1.54.0 released 2026-06-03 (import-time language pipeline + big content release: languages captured at IMPORT time (chat language + auto-detected learning language) and inherited through analysis -> save-as-lesson -> share so nothing is guessed downstream (`ImportedConversation` gains `source_language`/`target_language`, Alembic 0026 + Dexie v25); the analysis prompt gains a learner-language context block; sharing is domain-aware (source==target ships as non-language knowledge content, mirroring the content repo's validate_content.py); content grows to 10 sets / 200 lessons across 3 domains incl. FR/ES/EN A2 for German speakers, DE->EN A1, Python Grundlagen, Psychologie (65); folds in v1.53.1/.2 fixes (single two-phase button on Adaptive/Review, community-PR attachment for all sizes, ShareWizard source inheritance); see changelog/releases/v1.54.0.md).** Prior: **v1.53.0 released 2026-06-02 (content schema v1.3 + Python course + domain support: Card gains optional code fields (`code_snippet`/`code_language`/`expected_output`/`hint`/`difficulty`/`media_type`) and `CURRENT_SCHEMA_VERSION` bumps 1.2->1.3 (additive, major-match); sets/lessons carry a `domain` (non-language domains allow source==target, both validators); the Content Browser splits Sprachen (language tree) from Wissen (domain groups w/ icons); the lesson viewer renders syntax-highlighted code blocks via lazy `highlight.js` (language label, copy button, Output block, mobile scroll); code/formula cards drive code-aware exercises (monospace free-text textarea + whitespace/quote-tolerant case-sensitive matching + monospace cloze); a new Python Grundlagen course (`de/python-basics`, 15 lessons, 123 code-snippet cards, domain=programming) brings the library to 7 sets / 100 lessons / ~22h, all bundled; plus a fix so analysis-to-lesson source_language defaults to the app language not "en" (P3 follow-ups ANALYSIS-TARGET-DETECT-01 / ANALYSIS-DOMAIN-SUGGEST-01 / PLACEMENT-LANG-WARN-01 filed); see changelog/releases/v1.53.0.md).** Prior: **v1.52.0 released 2026-06-02 (DE->EN A1 content + backup-restore data-integrity fixes: a fifth A1 course — English for German speakers (`de/en-a1`, 15 lessons; false friends become/bekommen, gift/Gift, handy/Handy, chef/Chef, actual/aktuell; German-targeted distractors; progressive receptive->mixed->productive direction) brings the library to 5 sets / 75 lessons / ~12.5h, all bundled into the GH-Pages build; BACKUP-API-RESTORE-01 — API-mode restore now covers all 30 tables (was 16, silent data loss), restore order derived from the export/sync source with a parity test + 30-table round-trip, plus a per-table flush that fixes a latent FK violation on the FK-decoupled gamification/SRS/content tables; new `app/db_guard.py` refuses destructive full-table SQL against a production data dir from non-app processes; and a P0 Lesson-Creator fix — a resumed draft with an equal source/target language no longer blocks Step 1; see changelog/releases/v1.52.0.md).** Prior: **v1.51.0 released 2026-06-02 (Phase 66 / EXP-022 — Visual Learning Path: interactive `@xyflow/react` lesson graph at `/learning-path` with mastery-coloured nodes, set-group progress, dagre auto-layout, recommended-next node, error-cluster overlay, filter/search, stats sidebar, full a11y across all 6 themes, lazy-loaded ~100 KB; plus a Dexie backup overhaul — File System Access API save-to-disk, a "Your backup contains" preview, and a data-loss fix restoring the 10 gamification/progress/SRS/missions tables the Dexie export silently dropped; BACKUP-API-RESTORE-01 filed P1 for the backend mirror gap; see changelog/releases/v1.51.0.md).** Prior: **v1.49.0 released 2026-06-01 (Phase 65 — API-key UX + Community Sharing via PR + Analysis loading: instant API-key format validation (prefix + length per provider, green/red + Save gating), a live Test button (`POST /settings/{user}/test-api-key` + browser-direct in Dexie; classifies ok/invalid/rate_limit/network), and a rollback cache (new `ApiKeyBackup` model + Alembic 0025 + Dexie v24 + sync surface — Save auto-tests first, then Keep old / Save anyway / Restore last working); `secret.key` is now the stable Fernet key source (keys survive restarts) and secrets.yaml keys are UI-editable. Community sharing opens a GitHub PULL REQUEST (lesson JSON committed at `sets/{src}/{tgt-level}/lessons/{nn}-{slug}.json`, content-repo CI validates). Chat-import Analyze gains a loading indicator (phased progress + estimate + spinner + real Cancel via AbortSignal + friendly inline error). Friendly voice/mic errors instead of raw Web Speech codes. 30 SQLAlchemy models (added `ApiKeyBackup`). Full i18n in 8 languages).** Unreleased on main: **native help translations in 6 languages (ES / FR / EL / PT / TR / JA) — the 22-entry help glossary + the full 38-file `docs/help` tree per language, plus the 6 languages + native nav titles in `_meta.yaml`; PT/TR/JA flagged AI-generated pending native review (HELP-CONTENT-TRANSLATIONS-01).** Prior: **v1.48.0 (Phase 64 — Community Sharing UX + Smart Lesson Organization: four-step share wizard + smart placement engine, lesson-level duplicate/variation detection, author credit + contribution history, Missing-Lessons suggestions, content schema 1.2 -> 1.3; merges Smart Next-Step Suggestions after lesson completion; EXP-021 Lesson-Creator exploration).** Earlier: **v1.47.0 (Phase 63 — Lesson Flow Control) and v1.46.0 (Phase 62 — EXP-018 Exercise Direction).** Test baseline as of v1.48.0: 1064 (+1 skipped) backend + 997 plugin + 2816 Vitest = 4877 green; v1.49.0 adds the API-key-validation / analysis-loading / voice-error tests on top. Playwright smoke spec files run separately; the Dexie-mode release gate runs via `make test-dexie-smoke`.

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
| 43 | v1.27.0 | **Content-Loader Plugin** (2026-05-26) — `/content` downloads structured lesson sets from public GitHub repos and caches them locally (filesystem + IndexedDB); Pydantic lesson schema v1.0; Dexie v16 + Set Browser. EXP-002/EXP-005 foundation, the first no-API-key path. |
| 44 | v1.28.0 | **Lesson Viewer + Matching + Picture-Choice** (2026-05-26) — new `/lesson` route + the first two exercise renderers; `LessonProgress` model + Alembic 0018 + Dexie v17. EXP-002 Sprint 3 A-D. |
| 45 | v1.29.0 | **Free-Text + Word-Tiles Exercises** (2026-05-27) — the viewer now ships every exercise type the v1.0 schema knows; frontend-only. EXP-002 Sprint 3 E-F. |
| 46A-D | v1.30.0 | **Element-Level Error Tracking + SRS Review** (2026-05-27) — per-element `ElementError`, mastery at 3-consecutive-correct, SRS scheduler (1d/3d/7d), `/review/:setId` + Dashboard widget; Alembic 0019 + Dexie v18. EXP-007/P-129. |
| 46E-G | v1.31.0 | **Gamification Integration + LessonProgress↔LearningSession Unification** (2026-05-27) — `kind="content"` pseudo-project, lesson-XP rule, 4 new badges incl. `review_master`. |
| 49 | v1.32.0 | **Learning-Repo Storage Abstraction** (2026-05-27) — ports the ~957-LOC Python renderer to TypeScript so the Learning Repository works in Dexie mode; 2 new `IStorageService` namespaces; Dexie v19. Closes the v1.26.1 server-only gap. (Phases 47-48 were never assigned.) |
| 50 | v1.33.0 | **Dexie-Mode Lesson-XP Parity + i18n Repo-Key Fix** (2026-05-28) — Dexie-mode users earn lesson-XP/badges byte-identical to API mode (cross-language parity goldens); fixes 23 unresolved `repo.*` i18n keys; `.claude/rules` Bibliogon-residue cleanup. |
| 51 | v1.34.0 | **Content Expansion: French A1 + Spanish A1 + GH-Pages bundling** (2026-05-28) — 15 A1 lessons bundled into the static build so first-time visitors see content offline; authoring guide EN+DE. |
| 52 | v1.35.0 | **Token-Diff + Cloze Exercise** (2026-05-28) — token-level feedback on every surface; a 5th exercise type (Cloze, auto-generated from the learner's mistakes); end-of-lesson correction round; schema 1.0→1.1. EXP-007. |
| 53 | v1.36.0 | **Adaptive Lesson Generation** (2026-05-28) — rule-based, deterministic, client-side: reads per-element error history, classifies weaknesses, synthesises a personalised lesson the existing viewer renders unmodified; `/adaptive-lesson/:setId` + Dashboard FocusAreasCard. EXP-013. |
| 54 | v1.37.0 | **Asset Fetching for Picture-Choice** (2026-05-28) — lesson sets ship binary images via a manifest-declared `assets/` dir; deterministic placeholder SVGs + text-only fallback; works in API / Dexie / GH-Pages. |
| 55 | v1.38.0 | **Praise + Celebration** (2026-05-29) — earned, scaled micro-feedback: 8-lang praise catalogs, shared `AnswerCelebration`, milestone overlays, CSS-only confetti, Feedback-Intensity + Sounds settings, full reduced-motion path. EXP-008. |
| 56 | v1.39.0 | **Daily Missions** (2026-05-29) — up to 3 deterministic, adaptive goals/day on the Dashboard, evaluated against existing data; new `missions` plugin (13th) + `UserMission` + Alembic 0021 + Dexie v20. EXP-010. |
| 57 | v1.40.0 | **Badge Tiers + Badge Gallery** (2026-05-29) — all 28 badges gain bronze/silver/gold (static siblings + dynamic high-water-mark); tier-coloured SVG generator; BadgeGallery drawer; Alembic 0022 + Dexie v21. |
| 58 | v1.41.0 | **UX/UI Audit + Multi-Theme System** (2026-05-29) — semantic CSS-variable token set across 6 themes (light/dark/ocean/forest/high-contrast/sepia) + auto; ThemePicker; Recharts recolouring; WCAG re-audit; Dexie v21 upgrade bugfix. |
| 59 | v1.42.0 | **Analysis-to-Lesson Converter + Community Sharing** (2026-05-29) — turns a chat-import analysis into a replayable offline lesson; backend-free export/import/share loop; "My Lessons" in `/content`; `saveUserSet`/`deleteSet` namespace. |
| — | v1.42.1 | **Patch** (2026-05-29) — fixes the Save-as-Offline-Lesson 422 in API mode; Settings tab reorg (Help/About split, identity moved to Data). |
| — | v1.43.0 | **Content Repo Online** (2026-05-30) — the official `astrapi69/adaptive-learner-content` repo exists + is validated end-to-end; same-id sets deduped across bundle + GitHub (higher version wins); Bundled/GitHub source badge; Share re-enabled; docs-verification system gates releases + CI. |
| 60 | v1.44.0 | **Content Validation Pipeline + Language-Pair Tree** (2026-05-30) — content sets declare a language PAIR (target + source); `sets/{source}/{target-level}/` tree; schema 1.1→1.2 + Dexie v22; client-side validator gates Share + opt-in AI review; content-repo CI. |
| 61 | v1.45.0 | **Quality Sweep** (2026-05-30) — audit-first, then fixes: security P2 (`read_lesson` guard), coverage (missions 14→41, ApiStorage 100%, config_overlay 90%, 3 interactive Dexie E2E journeys), architecture + performance fixes, dead-code removal, tree-placement + duplicate detection in the share pipeline, minor/patch deps. |
| — | v1.45.1 | **Patch / docs-sync** (2026-05-30) — this phase-history table refreshed through Phase 61; cross-language badge-catalog parity golden (`tests/fixtures/badge-catalog/`); BL-23 + BL-24 archived as already-shipped. No runtime change. |
| 62 | v1.46.0 | **EXP-018 Exercise Direction (Receptive vs Productive)** (2026-05-30) — every exercise carries an optional `direction` (schema stays 1.2); SRS tracks mastery PER direction (Alembic 0023 + Dexie v23 re-key; "fully mastered" needs both); direction-aware renderers (Matching column flip + eye/pencil instruction hint; cloze exempt) via `resolveDirectionDisplay`; review queue weights productive 1.2x; adaptive `direction_strategy` (auto/receptive_first/productive_focus/balanced) + Settings control + Dashboard mastery split; pilot lessons progressive direction. Folds in a P0 analysis-to-lesson Save fix (language pair + CEFR + title_native + shareable-gate) and the lesson-content migration out of the app repo into `astrapi69/adaptive-learner-content` (build sources it via `ADAPTIVE_LEARNER_CONTENT_DIR` + GH-Pages content-repo checkout). |
| 63 | v1.47.0 | **Lesson Flow Control** (2026-06-01) — lessons pause/abandon/resume (`LessonProgress` gains paused/abandoned states + timestamps, Alembic + Dexie); back-button exit dialog + resume-or-start-over dialog; 30s autosave + auto-resume on tab return; Dashboard `PausedLessonsCard`; paused-lesson retention sweep + Settings control; lesson splitter for oversized imports (configurable 5-20 exercises, TS+Python cross-language parity test). Folds in Word Tiles touch-capable drag-to-reorder (`@dnd-kit`), mobile horizontal-scroll fixes (3 overflow sources + 320/375/414 regression spec), lower-friction community sharing (GH web PR editor, informational validator), and a backend CSP/security-header middleware (Phase 61 audit P3). |
| 64 | v1.48.0 | **Community Sharing UX + Smart Lesson Organization** (2026-06-01) — a four-step share wizard (`ShareWizard`): smart `placement-engine.ts` (tree path + auto-numbered `{nn}-{slug}.json` + new-set detection + content auto-detection), lesson-level duplicate/variation/supplement detection (extends `duplicate-detection.ts`), optional author credit (`contributed_by`/`contributed_at`, remembered in localStorage, viewer credit line + GitHub-issue author), local contribution history (`contribution-history.ts`, "My Contributions" + Community Contributor at 5 shares), and `gap-detector.ts` Missing-Lessons suggestions. Content schema 1.2 -> 1.3 (additive `variation_of`/`variation_note`/`contributed_by`/`contributed_at`). Merges Smart Next-Step Suggestions after lesson completion (`useNextStepSuggestions` + themed card: adaptive / review / set-complete / resume awareness). Adds the EXP-021 Lesson-Creator exploration. Full i18n in 8 languages. |
| 65 | v1.49.0 | **API-key UX + Community Sharing via PR + Analysis loading** (2026-06-01) — Settings > AI: instant API-key **format validation** (Anthropic `sk-ant-` ≥ 90 / OpenAI `sk-` ≥ 40 / Gemini `AI` ≥ 30, green/red + checkmark, Save gated), a live **Test** button (`POST /api/settings/{user}/test-api-key` server-mode + browser-direct in Dexie; ok / invalid / rate_limit / network), and a **rollback cache** (new `ApiKeyBackup` model + Alembic 0025 + Dexie v24 + sync surface: Save auto-tests first; a working key is saved + remembered as last-known-good, a failing key offers Keep old / Save anyway / Restore). `secret.key` is now the persistent Fernet key source (API keys survive restarts) and secrets.yaml-sourced keys are UI-editable (path corrected to `~/.config/adaptive_learner/secrets.yaml`). **Community sharing opens a GitHub PULL REQUEST** (was an issue): lesson JSON committed at `sets/{src}/{tgt-level}/lessons/{nn}-{slug}.json`, content-repo CI validates; small lessons pre-fill the create-file editor, large ones download + open the upload page; no token required. Chat-import **Analyze** gains a **loading indicator** (phased progress + estimated time + spinner + real **Cancel** via AbortSignal + friendly inline error + smooth results reveal). Voice dictation shows **friendly mic errors** (no-device / offline / permission) instead of raw Web Speech codes. 30 SQLAlchemy models (added `ApiKeyBackup`). Both storage modes; full i18n in 8 langs. |

Annotated tags + GitHub Releases ship same-day; see `git tag` for the full list. Per-release notes live in [changelog/releases/](../changelog/releases/).

---

## Next phases (planned)

**Phase 63 candidate — remaining UX polish from manual testing.**
(Phase 62 shipped EXP-018 Exercise Direction instead; these two
viewer UX items remain.) Two UX items surfaced in manual testing
of the lesson viewer:

- **Matching-exercise visibility bug.** The selected/paired state
  in the Matching exercise is hard to read in some themes. (v1.38.0
  already shipped a Matching UX pass — selected state, instructions,
  column headers, wrong-pair shake — so this is the residual
  visibility follow-up, not the whole exercise.)
- **Word-Tiles drag-to-reorder.** Word-Tiles currently builds the
  answer by tap-to-append; drag-to-reorder is the requested
  interaction upgrade. @dnd-kit is the sanctioned DnD library
  (see coding-standards.md).

Known longer-horizon follow-ups (no committed phase):

- **Per-topic-folder triplet** (`concepts.md` / `tasks.md` /
  `solutions.md`) for the Learning Repository — Article 3's
  "Drei-Datei-Prinzip"; folders currently ship only the stub
  README. Trigger: a user wants the deeper structure.
- **Method-experiment git branches** + **GitHub-push automation**
  for `learning-repo`. Trigger: user demand for method A/B
  comparison or a "share my learning repo publicly" flow.
- **EXP-013 Stufe 3 — AI-augmented adaptive generation.** The
  Phase 53 rule-based pipeline is sufficient for the headline
  promise; the AI-augmented layer (P-150..P-152) was explicitly
  deferred.

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
- **ANALYSIS-TARGET-DETECT-01.** Content-based target-language
  detection for analysis-to-lesson. Today the target is guessed from
  ``analysis.topic`` only; infer it from the actual card-content
  language (e.g. card backs / vocabulary) so a German-about-German
  grammar chat is recognised as a domain (source == target) set
  rather than a language pair. Follow-up to the v1.52.x source-default
  fix, which covers the 90% case (source = app language).
- **ANALYSIS-DOMAIN-SUGGEST-01.** When analysis-to-lesson detection
  yields source == target (e.g. German grammar for German speakers),
  auto-suggest a non-language ``domain`` ("grammar" / "education")
  in the save modal. The content validator already permits
  source == target for ``domain != "language"``.
- **PLACEMENT-LANG-WARN-01.** In the placement / save flow, warn when
  the card content language doesn't match the chosen
  ``source_language`` (e.g. card backs are German but source is set to
  English): "Die Kartenrueckseiten sind auf Deutsch, aber die
  Ausgangssprache ist Englisch. Stimmt das?" Advisory only, never a
  hard block.

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
