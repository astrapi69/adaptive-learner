# Adaptive Learner

Adaptive learning system based on the six-method learning model
(Asterios Raptis, *Von Theorie zur Praxis*, Medium series). The
plugin-loader infrastructure, layered architecture, test discipline,
and Python + React tech stack were extracted from the Bibliogon
project; the Bibliogon EXAMPLE-DOMAIN models (Book, Chapter, Article,
Author, ...) and every router, service, page and component that
depended on them are gone.

- **Repository:** https://github.com/astrapi69/adaptive-learner
- **Project plan:** [docs/adaptive-learner-project-reference.md](docs/adaptive-learner-project-reference.md) — domain models, hooks, plugins, API, roadmap
- **Concept:** [docs/CONCEPT.md](docs/CONCEPT.md) — short overview, points at the project plan
- **API reference:** FastAPI OpenAPI under `/api/docs` and `/openapi.json`
- **Current state (v1.14.0):** v1.13.0 plus Phase 27 —
  **Rich-Text Notes with TipTap.** Session-rating notes,
  curriculum descriptions and lesson content all graduate
  from plain ``<textarea>`` to a TipTap-based
  ``RichTextEditor`` (bold / italic / underline / strike,
  headings 1-3, bullet + ordered + task lists, blockquote,
  inline code, code blocks with lowlight syntax highlighting,
  links, text alignment, highlight, undo / redo,
  character-count read-out). Mobile-friendly toolbar
  (horizontal scroll, 40 px touch targets). 23 TipTap deps
  pinned to Bibliogon-aligned versions plus ``lowlight 3.3.0``.
  Code blocks gain a per-block native ``<select>`` language
  picker (11 grammars: bash / css / html / java / javascript
  / json / markdown / python / sql / typescript / yaml) and
  a copy-to-clipboard button via a React NodeView. Past
  session notes render on the Progress page via the same
  ``RichTextEditor`` in read-only mode. ``ProgressCommitOut``
  gains optional ``notes: str | None``; the tracking plugin's
  ``/commits`` endpoint LEFT JOINs ``session_ratings`` to
  populate it. Persistence stays on the existing TEXT columns
  — legacy plain text and serialised TipTap JSON co-exist
  via ``content-utils`` (``parseEditorContent`` /
  ``serializeEditorContent`` / ``isLegacyPlainText``).
  Markdown / PDF exports honour the new shape via
  ``frontend/src/lib/tiptap-to-markdown.ts``
  (``renderStoredContent`` walks the doc tree and emits GFM
  Markdown; plain text passes through verbatim). Backend
  tests 682 → 684 + frontend 921 → 1002 at release time;
  BL-12 closed. Math formulas deferred (no ``katex``
  dependency).

- **State (v1.13.0):** v1.12.0 plus Phase 26 —
  **PT/TR/JA Native Translations.** The three EN-passthrough
  catalogs (``backend/config/i18n/{pt,tr,ja}.yaml``) are now
  fully translated: Brazilian Portuguese (informal "você"
  form), Turkish (informal "sen" form), and Japanese
  (polite ``desu``/``masu``, not keigo). Each YAML carries
  an "AI-translated, pending native speaker review" header
  so future native review is targeted. The assessment
  plugin's ``QUESTIONS`` list gains ``text_pt`` / ``text_tr``
  / ``text_ja`` on every one of the 12 questions and 48
  answers; ``_LANG_TO_KEY`` adds three rows so the resolver
  picks the new fields automatically. A new
  ``backend/tests/test_i18n_translation_audit.py`` (12 tests)
  pins the translation quality: no EN-passthrough markers
  sneak back into pt/tr/ja, ≥90% of values diverge from EN,
  every assessment string is present and not byte-identical
  to text_en, and every new language is registered in
  ``_LANG_TO_KEY``. Backend tests 671 → 683 with the new
  audit; frontend 921 unchanged. BL-11 closed (native review
  remains a separate P3 follow-up).

- **State (v1.12.0):** v1.11.0 plus Phase 25 —
  **Backup Compare UI.** New ``frontend/src/lib/backup-diff.ts``
  is a client-side diff engine over two parsed
  ``BackupPayload`` objects: UUID-keyed matching produces
  per-table added / removed / changed (with field-level diff
  on mutable rows; append-only tables only surface
  added/removed). Chunked async processing (1000 rows per
  yield via ``requestIdleCallback`` with ``setTimeout(0)``
  fallback) keeps the UI responsive on 10 000+ row backups.
  Field blacklist drops ``updated_at`` from the change
  detector so a mere re-export doesn't surface every row.
  ``components/BackupCompare.tsx`` renders the diff as
  sortable / filterable per-table cards with green / red /
  amber / grey chips, expandable record lists and a
  field-level diff table per changed row.
  ``BackupSection`` gained a "Compare Backups" sub-section
  with two file pickers + a "Use current state" shortcut.
  The restore flow's v0.7.0 row-count table is now followed
  by the full diff preview (same component, ``hideExport``
  prop on); the Restore button label becomes "Restore
  ({{added}} added, {{updated}} updated)". Dexie auto-backup
  rows gained "Compare as A/B" buttons that load the
  rotated snapshot into the same compare surface via the
  new ``getAutoBackupPayload`` helper. The Markdown export
  produces the spec format (header with dates + versions +
  delta one-liner, summary table with zero-delta tables
  omitted, per-table sections with field-level ``old → new``
  lines, high-volume tables collapsed to a count summary,
  version watermark). 35 new i18n keys
  (``backup.compare_*`` + ``backup.auto_compare_*`` +
  ``backup.confirm_with_counts``) — DE+EN translated, 6
  EN-passthrough. Backend 671 + session-plugin 199 +
  frontend 921 at release time. BL-10 closed.

- **State (v1.11.0):** v1.10.0 plus Phase 24 —
  **Provider Model Picker via API.** New
  ``backend/app/services/model_discovery.py`` calls each
  provider's official ``/models`` endpoint (Anthropic +
  OpenAI + Gemini) via httpx with a 5 s timeout; results are
  cached in-memory per
  ``(provider, sha256(api_key)[:16])`` for 1 hour. Chat-only
  filter drops embedding / audio / DALL·E / moderation /
  deprecated-completion / vision-only models. New endpoint
  ``GET /api/settings/{user_id}/available-models?provider=…``
  decrypts the stored key and forwards. Browser-direct
  ``storage/model-discovery.ts`` mirrors the same shape for
  Dexie mode, cached in sessionStorage with the same TTL.
  ``ISettingsNamespace.getAvailableModels`` joined the
  storage contract; both backings implement it. New
  ``components/ModelPicker.tsx`` replaces the v0.4.0
  ``<datalist>`` input with a searchable dropdown grouped
  Recommended / All, showing human name + raw id +
  context-window badge; loading + error + no-key + offline-
  fallback states all rendered; default-model hint when no
  override is set. Session ``POST /message`` validates the
  chosen model against ``model_discovery.get_cached_models``;
  if a cache is populated and the model is not in it, the
  route falls back to ``DEFAULT_MODELS[provider]`` and
  surfaces a new ``model_warning`` field (separate from the
  fatal ``ai_error`` field). Session header now reads
  ``"<Provider>: <Model name>"`` with full id +
  context-window in the tooltip; resolution uses the
  available-models cache for the human name. 14 new i18n
  keys (``settings.model_picker_*``) — DE+EN translated, 6
  EN-passthrough. Backend 671 + session-plugin 199 +
  frontend 886 at release time. BL-09 closed.

- **State (v1.10.0):** v1.9.0 plus Phase 23 —
  **Swipe Gestures on Assessment + Session.** New
  ``hooks/useSwipe.ts`` is a reusable horizontal-swipe hook
  with a passive-touch contract: ``|dx| > |dy|`` to never
  hijack vertical scroll, default 50 px threshold (100 px
  with ``prefers-reduced-motion``), 0.15 px/ms velocity
  floor, ``enabled=false`` detaches listeners entirely.
  ``hapticSwipe()`` wraps ``navigator.vibrate(10)`` for
  subtle feedback. Assessment gains swipe + keyboard
  navigation (left/right arrows = prev/next, suppressed when
  an INPUT has focus), a one-shot first-question hint
  persisted in localStorage, and 200 ms GPU-accelerated
  slide animation honouring reduced-motion. CycleProgress
  gets swipe-to-peek: an informational overlay describing
  the previous / next cycle step (auto-dismisses after 2 s,
  tap-to-dismiss; cannot skip AI-driven steps). TopicNode
  gets iOS-style swipe-to-reveal: actions hidden by default
  on mobile (``@media (max-width: 768px)``), swipe-left
  exposes them with an accent left-border highlight,
  swipe-right or tap-elsewhere collapses; desktop unchanged.
  New Settings → Interface section with a single toggle
  persisting to
  ``localStorage["adaptive-learner.gestures_enabled"]``
  (default ON for touch-capable devices, OFF otherwise);
  ``lib/gesturePref.ts`` holds the helper. 3 new i18n keys
  per catalog (``settings.section_ui`` +
  ``settings.gestures`` + ``settings.gestures_description``;
  DE+EN translated, 6 EN-passthrough). Backend 649 +
  session-plugin 199 + frontend 856 at release time. BL-08
  closed.

- **State (v1.9.0):** v1.8.0 plus Phase 22 —
  **Global Subjects and Tags.** Four new domain tables join
  the sync surface: ``subjects`` (global hierarchical taxonomy,
  parent_id self-FK SET NULL), ``tags`` (per-user, unique on
  user_id+name, optional hex colour), ``project_subjects`` +
  ``project_tags`` (M:N with unique pair constraints). Sync
  classifications: Subjects + Tags MUTABLE, association rows
  APPEND-ONLY; Subjects use a new ``global`` scope (no
  user-filter — every device's taxonomy converges on the same
  tree). Alembic 0008 + Dexie schema v6 + sync surface pinned
  to 20 tables (was 16). Pre-seeded ``subjects.yaml`` ships
  80+ nodes across 8 top-level categories (Languages /
  Mathematics / Programming / Sciences / Music / Humanities /
  Social Sciences / Skills) with DE display names for every
  top-level + most sub-categories; the slug-keyed loader is
  idempotent and fires from the FastAPI lifespan. Full CRUD
  routes for Subjects (``/api/subjects``), Tags
  (``/api/users/{id}/tags`` + ``/api/tags/{id}``), and
  per-project assignment
  (``/api/projects/{id}/{subjects,tags}``); ApiStorage thin
  pass-through, DexieStorage full mirror. Three new components:
  ``SubjectBrowser`` (tree + search + add-custom),
  ``TagManager`` (per-user list + colour picker),
  ``ProjectTaxonomy`` (assignment chips). New Dashboard
  ``DashboardFilterBar`` filters by Subject + Tag with URL
  query params (shareable / bookmarkable) and lists matching
  projects; clicking switches the active projectId so the
  per-project widgets re-fetch. Onboarding gains a client-side
  Subject suggester (fuzzy match against the seed tree, top-5
  with ancestor paths) + comma-separated Tag input; both run
  as soft-fail steps after project creation. Bundled:
  PluginForge ^0.8.0→^0.9.0 (hard-filter transition for
  ``target_application`` is now active — all 7 plugins already
  declared it since v1.7.0 so the upgrade is transparent).
  Backend 648 + session-plugin 199 + frontend 816 at release
  time. BL-07 closed.

- **State (v1.8.0):** v1.7.0 plus Phase 21 —
  **Sync Gaps: step_evaluations + session_notes + i18n keys.**
  ``step_evaluations`` joins the sync surface after the Dexie
  schema v3 alignment (``suggested_step``→``to_step``,
  ``created_at``→``evaluated_at``). ``session_notes`` promoted
  from append-only to mutable: Alembic 0006 + Dexie v4 add
  ``updated_at`` with back-fill from ``created_at``; the
  conflict-resolution layer routes notes through the existing
  ``/api/sync/resolve`` path. ``imported_conversations`` +
  ``imported_messages`` join sync (append-only); Alembic 0007
  + Dexie v5 add ``created_at`` to the message rows with a
  parent-conversation back-fill. 62 ``sync.*`` i18n keys
  promoted from inline ``t(key, "fallback")`` args to the 8
  YAML catalogs (DE+EN hand-translated, 6 EN-passthrough);
  ``fallbacks.ts`` gains a sync block for first-paint
  resilience. ``test_sync_surface_audit.py`` pins the
  16-table sync surface against drift on both sides (backend
  + frontend symmetric coverage). Bundled: PluginForge
  ^0.7.0→^0.8.0 upgrade. Backend 612 + session-plugin 199 +
  frontend 759 at release time. BL-04 (closed v1.7.0), BL-05
  + BL-06 closed.

- **State (v1.7.0):** v1.6.0 plus Phase 20 —
  **QR-Code Camera Scan for Sync Pairing.** New
  ``html5-qrcode`` frontend dep (exact-pinned). New
  ``components/sync/QRScanner.tsx`` opens the rear camera on
  mount and stops every track on unmount / success / cancel
  (no zombie camera). ``QRScannerModal`` wraps it with a dark
  backdrop, Escape-to-close, body-scroll lock, viewfinder
  overlay (four corner brackets + animated scan-line) and
  success-checkmark animation. Both animations honour
  prefers-reduced-motion. Haptic feedback on success via
  ``navigator.vibrate?.(50)``. ``QRImageUpload`` is the
  fallback for restricted browsers — ``Html5Qrcode.scanFile``
  decodes a picked screenshot via the same
  ``parsePairingUri`` path. ``SyncSection.PhoneUnpairedView``
  is mobile-first: Scan-QR-Code is the primary CTA, paste-
  the-link lives inside a collapsed ``<details>`` element.
  Backend 606 + session-plugin 199 + frontend 751 at
  release time. BL-04 closed.

- **State (v1.6.0):** v1.5.0 plus Phase 19 —
  **Streaming Learning Response.** New ``ai_complete_stream``
  hookspec (firstresult=True) lets provider plugins yield an
  async iterator of text deltas. All three provider plugins
  (anthropic, openai, gemini) implement it via their SDK's
  native async streaming API. New ``call_ai_complete_stream``
  orchestrator helper falls back to ``call_ai_complete_async``
  when no plugin claims the call. New SSE route
  ``POST /api/plugins/session/{id}/message/stream`` emits three
  event types — ``start`` (user message), ``chunk`` (deltas),
  ``done`` (same shape as POST ``/message``). Frontend
  ``lib/sse-reader.ts`` is an inline fetch + ReadableStream
  parser (no external dep). ``ISessionNamespace.streamMessage``
  added to the storage contract; ApiStorage hits the SSE route,
  DexieStorage uses browser-direct provider SDKs via
  ``aiStream`` + ``sendMessageStream``. SessionChat renders a
  trailing cursor (▍) on streaming bubbles. The Thinking…
  placeholder is gone; tokens land in the bubble as they
  arrive. Backend 606 + session-plugin 199 + frontend 724 at
  release time.

- **State (v1.5.0):** v1.4.0 plus Phase 18 —
  **Async AI Calls + Performance.** New async SQLAlchemy
  foundation (``async_engine`` + ``AsyncSessionLocal`` +
  ``get_async_db``) lives alongside the sync setup; aiosqlite
  dep. New ``ai_complete_async`` hookspec is additive — no
  provider plugin must implement it. ``call_ai_complete_async``
  prefers the async hook when present, falls back to the sync
  hook wrapped in ``asyncio.to_thread``. At the step 6 → 7
  transition the session message route fires step-evaluation
  and topic-transition concurrently via ``asyncio.gather``
  (config flag ``async_evaluation: true``), saving ~T₂ of
  latency at the cycle boundary. New ``timings`` block on the
  message response carries learning_ms / evaluation_ms /
  topic_transition_ms / total_ms / parallel_saved_ms. SSE
  streaming (18D) deferred to v1.6.0 / Phase 19. Backend 551 +
  session-plugin 197 + frontend 699 at release time.

- **State (v1.4.0):** v1.3.0 plus Phase 17 —
  **Auto-Loop: Continue Learning After Step 7.** When the step
  evaluator advances a session to step 7 with advance=true, a
  third AI call (the topic-transition evaluator in
  ``plugins/.../session/topic_transition.py``) judges whether
  the learner integrated the topic and picks a new subtopic.
  On ``cycle_complete ∧ continue_recommended``, the route
  resets ``cycle_step`` to 1, increments ``cycle_count``, and
  appends the completed cycle's summary to ``cycle_topics``
  (both new columns on ``learning_sessions``, migration 0005).
  Hard cap of ``max_cycles`` (default 5) prevents runaway
  loops. Deterministic fallback keeps the v0.5.0 cap-at-7
  behaviour on any AI / parse failure. Frontend: ChatMessage
  carries ``kind: "cycle_transition"`` so SessionChat renders
  the loop as a dashed-border Cycle N card; Session header
  gets a cycle-counter badge; RatingDialog summarises the
  multi-cycle journey when ``cycle_count > 1``. Backend 542
  tests + plugin (session) 192 + frontend 699 at release time.

- **State (v1.3.0):** v1.2.0 plus Phase 16 —
  **Learning Progress Export (PDF + Markdown).** Three
  structured export types — Progress Report, Session Detail,
  Curriculum Overview — produced identically by
  ``backend/app/services/export_service.py`` and
  ``frontend/src/storage/export-builder.ts``. Same
  ``adaptive-learner-export`` v1.3.0 wire shape regardless of
  storage mode. Renderers in ``frontend/src/lib/export/``:
  ``markdown-renderer.ts`` dispatches by payload type and emits
  human-readable Markdown (star ratings, percentage bars, GFM
  tables, indented topic tree), ``markdown-to-html.ts`` is a
  light converter covering only the subset the renderer emits,
  ``pdf-generator.ts`` opens a hidden iframe with a
  print-optimised CSS document and triggers
  ``contentWindow.print()`` — the user picks "Save as PDF"
  in the browser dialog, zero external PDF library.
  ``IExportNamespace`` adds three methods to
  ``IStorageService``. New ``ExportSection.tsx`` in Settings
  exposes the three export entry points with Markdown / PDF /
  Preview buttons; the imported-conversation analyses render
  with structured fields (topic, level, strengths, weaknesses,
  recommended method, suggested curriculum). i18n keys under
  ``export.*`` across all 8 catalogs (DE+EN translated, six
  passthrough). Backend 542 tests + frontend 699 vitest at
  release time. v1.2.x backup + restore wiring carried
  forward unchanged.

## Development guidelines

Detailed rules live in `.claude/rules/` (inherited from Bibliogon; apply
to any well-engineered project of this shape).

**Always relevant:**
- `architecture.md` — layered architecture, plugin structure, UI strategy, data flow
- `coding-standards.md` — naming, function design, tests, dependencies

**On demand:**
- `code-hygiene.md` — linting, pre-commit, error handling, API conventions
- `lessons-learned.md` — known pitfalls (carries over Bibliogon-era learnings; prune as they prove irrelevant)
- `quality-checks.md` — test strategy, pre-commit checklists
- `ai-workflow.md` — order for features/plugins, docs protocol
- `release-workflow.md` — release process (triggered by "release new version")

On a conflict between CLAUDE.md and the rules, the rules win.

## Tech stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry
- **Frontend:** React 19, TypeScript 6 (strict), Vite 8, react-router-dom 7, react-toastify, Recharts 3, tree-model 1
- **PWA (v0.6.0):** vite-plugin-pwa, Workbox-generated service worker, manifest with SVG + maskable-PNG icons at 192/512
- **Storage (v0.7.0):** dexie ^4.4.2 (IndexedDB) + fake-indexeddb for tests; storage layer abstracts ApiStorage / DexieStorage behind one interface
- **Plugins:** pluginforge ^0.9.0 (PyPI, identity-gated via `target_application = "adaptive_learner"` — the v0.9.0 hard-filter transition is now active; plugins without `target_application` would be rejected, all 7 of ours have it set since v1.7.0), entry points under group `adaptive_learner.plugins`. v0.9.0 also adds lifecycle visibility (`activated_at` / `last_config_change` on `PluginState`, `inspect_plugin()` aggregator, `on_plugin_activated` event hooks); not yet consumed in our settings UI.
- **Launcher:** PyInstaller-based cross-OS desktop launcher (`launcher/`)
- **Testing:** pytest, Vitest, Playwright
- **Tooling:** Poetry, npm, Docker, Make, ruff, pre-commit

## Architecture (short)

4 layers: Frontend → Backend → PluginForge → Plugins. Details in
`.claude/rules/architecture.md`. Backend exposes core (users /
projects / settings / curricula / topics) + plugin routes
(assessment / session / tracking / tools). The frontend renders
eight routes via React Router: Landing, Onboarding, Assessment,
Dashboard, Session, Curriculum, Progress, Settings.

## Commands

```bash
make install              # Poetry + npm + plugins
make dev                  # backend (18001) + frontend (15174) in parallel
make dev-bg / dev-down    # background mode
make test                 # backend + frontend, no coverage
make test-coverage        # opt-in coverage run
make test-backend         # backend only
make test-frontend        # Vitest
make prod                 # Docker Compose
make prod-down            # stop Docker
make clean                # remove build artifacts
make help                 # all targets
```

E2E tests: `cd e2e && npx playwright test` (no specs yet; smoke spec
for the placeholder Landing lands in Phase 4A).

## Session start (Claude Code)

1. `git log --oneline -10` — recent changes
2. `make test` — green baseline
3. Read this file + `docs/adaptive-learner-project-reference.md` + relevant rules per the task

## Data model

19 SQLAlchemy models in `backend/app/models/`: User,
UserSettings, LearningProject, LearningProfile, Curriculum,
LearningTopic, Lesson, LearningSession, SessionMessage,
SessionRating, SessionNote, ProgressCommit, StepEvaluation,
MethodSwitch, ImportedConversation, ImportedMessage, Subject,
Tag, ProjectSubject, ProjectTag. Mirrored Pydantic v2 schemas
in `backend/app/schemas/`. Spec in
`docs/adaptive-learner-project-reference.md` §5.1.

## Plugins

Seven plugins shipped in v0.2.0, all under `plugins/`:

| Plugin | Routes | Hook coverage |
|--------|--------|---------------|
| assessment | /questions, /evaluate, /profile/{id} | get_assessment_questions, calculate_profile |
| ai-anthropic | (hook-only) | ai_complete (firstresult, model `claude-*`) |
| ai-openai | (hook-only) | ai_complete (firstresult, model `gpt-*`) |
| ai-gemini | (hook-only) | ai_complete (firstresult, model `gemini-*`) |
| session | /start, /{id}/message, /{id}/rate, /{id}/end, /switch-recommendation/{id}, /{id}/switch | create_session_prompt (firstresult), recommend_method_switch |
| tracking | /progress/{id}, /commits/{id} | on_session_complete, get_progress_summary |
| tools | /recommendations/{id} | get_tool_recommendations |

All eight hooks live in `backend/app/hookspecs.py`. PluginForge
bootstraps the registry in `backend/app/main.py`. v0.2.0:
POST /api/plugins/session/{id}/message orchestrates the AI
roundtrip server-side (fires `ai_complete` against the active
provider, persists user + assistant messages, returns a
composite); the v0.1.0 client-side orchestration is gone.

## Launcher

Cross-OS desktop launcher under `launcher/`, packaged with PyInstaller.
Produces a single-file installer-launcher binary per OS that bootstraps
the backend, opens the frontend in the user's browser, and manages
auto-update + uninstall. Carries over from Bibliogon unchanged in
shape; only branding renames in earlier cleanup passes.

## PWA (v0.6.0)

The frontend is an installable Progressive Web App. Wiring lives
in `frontend/vite.config.ts` under the `VitePWA` plugin block.

**Manifest** — `frontend/dist/manifest.webmanifest` (generated):

- `name: "Adaptive Learner"`, `short_name: "Adaptive"` (≤12 chars
  per Android home-screen recommendation)
- `display: "standalone"`, `theme_color: "#6366f1"` (matches
  the `--accent` CSS variable)
- Icons at 192 + 512 in both SVG (modern browsers) and PNG
  (`purpose: "any maskable"` for Android cropping). Sources in
  `frontend/public/icon-*.{svg,png}`; PNGs generated via
  ImageMagick from the SVGs (see `make pwa-icons` if you need
  to regenerate).
- `categories: ["education", "productivity"]` + `lang: "en"` for
  store-listing surfaces.

**Service worker strategy** — Workbox `generateSW` mode:

- Static assets (JS, CSS, fonts, icons, HTML) precached via
  `globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"]`.
- GET `/api/` → `NetworkFirst` with 4s timeout, 24h LRU,
  60-entry cap. Returning users see cached Dashboard / Progress
  / commits when offline.
- Mutating `/api/` (POST/PATCH/DELETE) → `NetworkOnly`. Never
  cache write responses.
- `navigateFallback: "/index.html"` for SPA routing.
- `navigateFallbackDenylist: [/^\/api\//]` keeps the SPA shell
  out of backend paths so real 4xx/5xx aren't masked.
- `offline.html` precached as the deep static fallback when
  even the SPA shell isn't reachable from cache.

**Install prompt** — `frontend/src/components/InstallPrompt.tsx`
captures the browser's `beforeinstallprompt` event, renders our
own dismissable banner (bottom-anchored), and persists dismissal
to `localStorage[adaptive-learner.install_dismissed]`. Auto-hides
on `appinstalled`.

**Online status** — `frontend/src/hooks/useOnlineStatus.ts`
subscribes to `online`/`offline` window events. Navigation
renders a `role="status"` indicator (dot-only on mobile, dot +
label on desktop). Session route's offline guard blocks new
session creation when offline and shows a localised inline
message.

**Mobile breakpoints** (responsive polish, not a mobile-first
rewrite):

- `@media (max-width: 768px)` is the canonical mobile cut-over.
  Hamburger drawer, 44×44 touch targets, layouts that stack
  vertically.
- `@media (max-width: 360px)` is the extreme-narrow safety net
  (smaller page padding).
- Desktop styles at ≥769px stay unchanged from v0.5.0.

**Testing** — `e2e/smoke/mobile-viewports.spec.ts` parametrises
4 device sizes (iPhone SE 375, iPhone 14 390, Pixel 7 412,
iPad 768) and pins no-horizontal-overflow + hamburger
visibility + online indicator on each. Lighthouse audits stay
manual (smoke-tester's side).

## Storage layer (v0.7.0)

Frontend has a single seam where the backing store is chosen.
Everything routes through `getStorage(): IStorageService`. Two
implementations satisfy the same contract:

- **`apiStorage`** (default): thin wrapper around
  `api/client.ts`. Same v0.6.0 behaviour, same backend roundtrips.
- **`dexieStorage`**: full local-first stack. Schema in
  `storage/db.ts` mirrors all 14 SQLAlchemy models;
  `storage/dexie-storage.ts` provides users / projects /
  settings / curricula CRUD; `storage/assessment.ts` ports the
  12-question pack + profile calculator; `storage/prompts.ts`
  carries the 42-cell system-prompt matrix loaded from
  `data/session-prompts.json`; `storage/step-evaluator.ts` is
  the dual-prompt Phase 8B port; `storage/session-flow.ts`
  orchestrates start + message; `storage/tracking.ts` and
  `storage/tools.ts` port the aggregators. AI calls fire direct
  from the browser via `storage/ai-providers.ts` (Anthropic +
  OpenAI + Gemini).

The factory reads `localStorage["adaptive-learner.storage_mode"]`
(set by Settings) then `VITE_STORAGE_MODE` (set by GH Pages
build) then defaults to `api`. Switching modes is intentionally
not a live-swap: Settings persists the choice and toasts a
reload-required notice.

API keys in Dexie mode live cleartext in IndexedDB
(`UserSettings.api_key_{provider}`). Acceptable per design:
data sits on the user's own device, no server roundtrip, AI
calls fire direct. ApiStorage never sees these.

## GitHub Pages deployment (v0.7.0 + v0.8.0)

`.github/workflows/deploy-gh-pages.yml` is the single
unified workflow. It builds:

- The frontend with `VITE_BASE=/adaptive-learner/`,
  `VITE_STORAGE_MODE=dexie`, `VITE_API_BASE=""` →
  `frontend/dist/` (self-contained PWA, browser-direct AI).
- The MkDocs site → `frontend/dist/docs/` (mkdocs-material +
  mkdocs-static-i18n DE/EN).

Both deploy together to GitHub Pages on every push to main.
Frontend at `https://astrapi69.github.io/adaptive-learner/`,
docs at `https://astrapi69.github.io/adaptive-learner/docs/`.
SPA-router 404 fallback handled by copying `index.html` to
`404.html`.

The legacy `docs.yml` workflow was removed in 11G to
prevent the dual-deploy-to-Pages conflict.

## Documentation site (v0.8.0)

`docs/help/` holds the public MkDocs source. Structure:

```
docs/help/
├── _meta.yaml          single source of truth for nav tree
├── de/                 German content (28 pages + landing)
│   ├── index.md
│   ├── user-guide/     getting-started, onboarding, assessment, ...
│   ├── concept/        philosophy, six-methods, seven-steps, ...
│   ├── developer/      architecture, setup, plugin-guide, ...
│   └── api/            overview, core-endpoints, ..., hooks
└── en/                 English mirror, same shape
```

Navigation is auto-generated:
- `_meta.yaml` declares title (DE + EN) + slug per page.
- `scripts/generate_mkdocs_nav.py` regenerates the
  `mkdocs.yml` nav block + the nav_translations under the
  EN locale.
- `make sync-mkdocs-nav` runs the generator; `make
  verify-mkdocs-nav` is the CI-friendly drift check.

In-app help reads `_meta.yaml` directly (the Settings >
Help panel in a future phase will list its tree). The
public docs site is built from the same Markdown via
`make docs-build`.

Local preview: `make docs-serve` (port 8000, hot-reload).

## Directory structure (short)

```
adaptive-learner/
├── backend/app/           # FastAPI shell + database + paths + hookspecs + plugin manager
├── backend/config/        # app.yaml + i18n/ (8 languages, skeleton catalogs)
├── backend/tests/         # 9 infrastructure tests
├── plugins/               # empty placeholder + README
├── frontend/public/       # static assets: favicon, icon-{192,512}.{svg,png},
│                          # offline.html (PWA fallback)
├── frontend/src/
│   ├── api/client.ts      # typed namespaces for every backend route
│   ├── components/        # ProfileRadar, ProgressTimeline, MethodDistribution,
│   │                      # SessionChat, CycleProgress, RatingDialog,
│   │                      # MethodBadge, MethodSwitchBanner, Navigation,
│   │                      # ErrorBoundary, ToolRecommendations,
│   │                      # SpacedRecommendations, RecentSessions,
│   │                      # SessionCounter, StepEvaluationInsights (v0.5.0),
│   │                      # InstallPrompt (v0.6.0), TopicTree, ...
│   ├── hooks/             # useI18n (fallbacks), useTheme (light/dark),
│   │                      # useOnlineStatus (v0.6.0)
│   ├── i18n/fallbacks.ts  # inline DE/EN/ES/FR/EL strings for first-paint resilience
│   ├── lib/
│   │   ├── constants.ts   # LearningMethod / CycleStep / METHOD_COLORS / AI_PROVIDERS
│   │   ├── learnerState.ts # typed localStorage wrapper (user_id / project_id / lang)
│   │   └── tree/          # TypedTreeNode<V, K> adapter on tree-model + buildTreeFromFlat
│   ├── pages/             # Landing, Onboarding, Assessment, Dashboard, Session,
│   │                      # Curriculum, Progress, Settings, NotFound
│   ├── storage/           # v0.7.0 — IStorageService + ApiStorage (delegates
│   │                      # to api/client) + DexieStorage (IndexedDB-backed).
│   │                      # ai-providers, prompts, step-evaluator,
│   │                      # session-flow, assessment, tracking, tools.
│   ├── data/              # v0.7.0 — bundled JSON for Dexie mode:
│   │                      # assessment-questions.json, session-prompts.json
│   ├── types/             # TypeScript interfaces matching Pydantic Out-schemas
│   ├── utils/notify.ts    # toast wrapper
│   └── styles/global.css  # full token set + mobile breakpoint rules (v0.6.0)
├── e2e/                   # Playwright smoke specs (landing, onboarding,
│                          # session, settings, curriculum, mobile-viewports)
├── launcher/              # cross-OS PyInstaller launcher
├── docs/
│   ├── adaptive-learner-project-reference.md  # the plan
│   ├── CONCEPT.md         # short overview
│   ├── ROADMAP.md         # open work items
│   ├── backlog.md         # daily planning view of ROADMAP
│   └── configuration.md   # config-chain docs
├── scripts/               # ROADMAP archival, version sync
├── .github/workflows/     # CI/CD pipelines
└── Makefile, docker-compose.yml, docker-compose.prod.yml, install scripts
```

## Core conventions

- i18n: catalogs in `backend/config/i18n/{lang}.yaml`. Reference language EN; mirror structure in DE, ES, FR, EL, PT, TR, JA.
- Python: type hints, snake_case, Pydantic v2, SQLAlchemy 2.0 mapped columns.
- TypeScript: strict mode, no `any`.
- CSS: custom properties, dark mode via `[data-theme="dark"]`.
- Commits: English, conventional (feat/fix/refactor/docs).
- E2E: `data-testid` selectors only.
- Secrets NEVER in committed config files. Three-layer chain: project `backend/config/app.yaml` < `~/.config/adaptive_learner/secrets.yaml` < env-vars (`ADAPTIVE_LEARNER_*`).

## Tests

- `make test` must stay green after every change.
- v0.8.0 baseline: backend 447, plugins 478 (across 7), frontend 387 (Vitest). Total 1312. Docs site: 28 content pages + landing, DE + EN parallel.
- E2E tests under `e2e/` are NOT on the `make test` default path.
  v0.3.0 shipped 7 Playwright smoke specs under `e2e/smoke/`
  (landing, onboarding+assessment, session, curriculum, settings);
  v0.6.0 adds `mobile-viewports.spec.ts` parametrising
  iPhone SE / iPhone 14 / Pixel 7 / iPad — 16 cases pinning
  no-horizontal-overflow + hamburger visibility + online
  indicator at each viewport.

## Test isolation

Tests run in a temporary data directory, never against production data.
Two layers of protection in `backend/tests/conftest.py`:

1. `ADAPTIVE_LEARNER_TEST=1` + `TEST_DATABASE_URL=sqlite:///:memory:` set BEFORE any `app.*` import. `ADAPTIVE_LEARNER_DATA_DIR` set to a process-scoped tmp dir.
2. Production data directories carry a `.adaptive-learner-production` marker file. If any test ever sees this marker, the run aborts with `pytest.exit(returncode=2)`.

Path conventions:
- `Path("uploads")` is forbidden (CWD-relative). Use the `app.paths` helpers.
- Frozen module-level imports of paths are forbidden — use the helper functions.

In-memory caches (lru_cache, module-level state) need explicit teardown
hooks in fixtures — see `.claude/rules/lessons-learned.md`.

## Pre-commit hooks

```bash
cd backend && poetry run pre-commit install
```

Hooks: trailing-whitespace, end-of-file-fixer, check-yaml/json,
check-merge-conflict, ruff (with `--fix`), ruff-format. Backend-only.

## Related projects

- [pluginforge](https://github.com/astrapi69/pluginforge) — plugin framework (PyPI)
- [bibliogon](https://github.com/astrapi69/bibliogon) — upstream from which this skeleton was extracted
