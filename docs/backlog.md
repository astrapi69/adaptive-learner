# Adaptive Learner Backlog

Daily-planning view of items outside the phase plan. The
authoritative roadmap lives in [ROADMAP.md](ROADMAP.md); use
this file for granular items + status.

State: **post v1.26.0 (Phase 42 / Git-Backed Learning
Repository shipped).** Phase history through Phase 42 +
per-release notes live in
[changelog/releases/](../changelog/releases/). 28 tables on
the sync surface. 11 plugins, 25 SQLAlchemy models,
912 (+1 skipped) + 670 + 1479 = 3061 tests green
(+1 skipped). Closed in this release line: BL-04 (QR scan,
v1.7.0), BL-05/06 (sync gaps, v1.8.0), BL-07 (subjects/tags,
v1.9.0), BL-08 (gestures, v1.10.0), BL-09 (model picker,
v1.11.0), BL-10 (backup compare, v1.12.0), BL-11 (PT/TR/JA
native, v1.13.0), BL-12 (TipTap, v1.14.0), BL-13 (E2E
expansion, v1.15.0), BL-18 (gamification, v1.16.0), BL-21
(Anki, v1.17.0), BL-20 (voice, v1.18.0), BL-22 (NotebookLM,
v1.19.0), BL-25/26/27/28 (import parser audit, v1.19.x),
BL-29 (metadata.created_at ISO normalisation, v1.19.2),
BL-03 (pluginforge-app-template, shipped externally),
**BL-30 (Git-Backed Learning Repository, v1.26.0)**.
Phases 35-41 (v1.21.0..v1.25.0) shipped without consuming
BL-IDs: Phase 35 doc-staleness refresh, Phase 36 import
bugfixes, Phase 37 error-toast + GitHub-issue framework,
Phase 38 in-app help system, Phase 39 WCAG 2.1 AA, Phase 40
release-automation hardening, Phase 41 identity persistence
+ Danger Zone.

Items ordered by impact and dependency chain. P0 = next up,
P5 = speculative. Within each tier, smaller-scope and
unblocking items come first; alphabetical-by-ID as final
tiebreaker.

---

## P0 — Next Releases (Prompts ready)

- [ ] **PHASE-42-STORAGE-ABSTRACTION-01**: The Learning
  Repository feature (Phase 42 / BL-30) shipped with direct
  ``api.*`` calls from
  ``LearningRepoSettingsSection.tsx`` / ``LearningRepo.tsx``
  / ``LearningRepoWidget.tsx``, violating the architecture
  rule "IStorageService is the only interface
  pages/components use." Production-blocking symptom (HTTP
  404 on every Settings / Dashboard / Learning-Repo view in
  Dexie / GitHub-Pages mode) was patched in commit 57aa243
  by gating components on ``resolveStorageMode()`` and
  rendering a friendly "only available in server mode"
  message. The proper fix is:
  - Add ``pluginSettings`` namespace to ``IStorageService``;
    ApiStorage delegates to ``api.pluginSettings.*``,
    DexieStorage persists in a new ``plugin_settings``
    Dexie table (or localStorage).
  - Add ``learningRepo`` namespace to ``IStorageService``;
    ApiStorage delegates to ``api.learningRepo.*``,
    DexieStorage runs the renderer client-side over the
    Dexie DB (port ``backend/app/services/learning_repo``
    to TypeScript). ``persist`` (git commits) stays
    server-only — DexieStorage throws a typed
    ``FeatureNotAvailableInDexieMode`` error.
  - Components route through ``getStorage()`` only; the
    storage-mode branch lives inside the storage
    implementations, not at every call site.
  - Filed 2026-05-26 from the GitHub Pages crash report.

- [x] **BL-25**: Claude.ai per-conversation Markdown export
  collapses to one big user message. Closed by the dedicated
  ``frontend/src/chat_import/claude_md_parser.ts`` shipped
  in Phase 33. Auto-detect now stamps ``source="claude"``,
  produces 50 alternating turns from the real 73-KB fixture,
  preserves every per-turn timestamp as ISO-8601 local-naive
  (``D.M.YYYY, HH:MM:SS`` → ``YYYY-MM-DDTHH:MM:SS``), keeps
  internal H2 headings and ``plaintext`` thought-process
  fences inside the surrounding response body, and skips
  the top-of-file metadata block. Regression-pinned via
  ``claude_md_parser.test.ts`` (20 unit cases) +
  ``claude_markdown_export.audit.test.ts`` (17 fixture cases).
- [x] **BL-26**: ``markdown_parser`` allowlist misses generic
  "Prompt:" / "Response:" headers. Closed alongside BL-25 by
  the new dedicated ``claude_md_parser``. The generic
  ``markdown_parser`` semantics are intentionally unchanged
  (it remains the no-marker-found fallback for free-form
  pastes); the minimal-shape regression-pin moved into
  ``claude_md_parser.test.ts`` ("BL-26 minimal shape").
- [x] **BL-29**: ``metadata.created_at`` from
  ``claude_md_parser`` was passed through verbatim as the
  raw locale-specific string (``M/D/YYYY H:MM:SS`` for US
  exports, ``D.M.YYYY HH:MM:SS`` for DE exports). Import.tsx
  forwarded that as ``source_created_at`` in the POST body;
  the backend Pydantic ``datetime`` validator rejected it
  with HTTP 422 (``Unprocessable Entity``) on every Claude
  .md import attempt at v1.19.1. Surfaced in production
  immediately after the v1.19.1 release. Closed in v1.19.2
  by ``normaliseMetadataDate`` which converts both
  locale shapes (and pre-existing ISO strings) to ISO-8601
  local-naive, returning ``undefined`` when the shape is
  unrecognised so the field gets dropped rather than
  triggering another 422. Regression-pinned via 4 new cases
  in ``claude_md_parser.test.ts`` (US, DE with/without
  comma, ISO pass-through, unrecognised) plus the existing
  audit case re-pointed at the ISO output.

## P1 — Architecture / Hygiene Debt

- [x] **BL-27**: ``vocabulary`` field spec/code drift closed
  in Phase 33. ``SYSTEM_PROMPT`` now describes the optional
  ``vocabulary`` field with full field semantics; the AI
  decides per-conversation whether to emit it (language-
  learning topics yes, everything else no — the prompt
  carries that conditional). ``parseAnalysisResponse``
  reads ``vocabulary`` via the new ``asVocabularyArray``
  projector (drops malformed entries, returns undefined on
  empty so non-language analyses don't pretend to carry
  vocabulary). ``mergeAnalyses`` concatenates + dedupes
  vocabulary across chunked-transcript chunks by
  (word, translation) tuple. The Anki Dexie vocabulary path
  and the NotebookLM ``vocabulary.md`` consumer now have
  data to read. Regression-pinned via 13 cases in
  ``analysis.vocabulary.test.ts``.

## P2 — Medium Value, Medium Effort

- [x] **BL-07**: Global subjects/tags — Shared taxonomy
  across projects (Mathematics, Languages, Programming, etc.).
  Closed in v1.9.0 / Phase 22 — see
  `changelog/releases/v1.9.0.md`.
- [x] **BL-08**: Swipe gestures on Assessment — Left/right
  swipe for next/previous question on mobile. Closed in
  v1.10.0 / Phase 23 — see `changelog/releases/v1.10.0.md`.
  Also covered Session CycleProgress peek + Curriculum
  topic swipe-to-reveal + Settings toggle (broader scope
  than the original BL-08).
- [x] **BL-09**: Provider model picker via API — Currently
  static datalist suggestions. Fetch available models from
  provider API (Anthropic `/v1/models`, OpenAI `/v1/models`).
  Show real model list in Settings. Closed in v1.11.0 /
  Phase 24 — see `changelog/releases/v1.11.0.md`.
- [x] **BL-10**: Backup compare UI — Side-by-side comparison
  of two backup files. Show diff per table (added, changed,
  removed records). Useful for auditing before restore.
  Closed in v1.12.0 / Phase 25 — see
  `changelog/releases/v1.12.0.md`.

## P3 — Lower Value or Large Effort

- [x] **BL-03**: pluginforge-app-template repo. Closed —
  `astrapi69/pluginforge-app-template` is published
  (created 2026-05-17, tag `v0.1.0`); validates the
  PluginForge ecosystem triple
  (framework / template / app).
- [ ] **BACKUP-DIR-EXPORT-01**: Best-effort "Save backup to
  disk" feature for Dexie-mode users. Originally scoped as
  Phase 41C (auto-backup to
  ``~/.config/adaptive-learner/backup-latest.json`` via the
  File System Access API), deferred after the Phase 41 audit
  showed browser sandboxing makes silent writes to an
  arbitrary user-readable path infeasible:
  ``showSaveFilePicker()`` is always interactive,
  ``navigator.storage.getDirectory()`` is the sandboxed
  Origin Private File System (not visible to the user's file
  manager), and the "persist a directory handle via
  IndexedDB" workaround dies the moment IndexedDB is wiped —
  exactly the failure mode this layer was supposed to
  address. The two-layer recovery shipped in Phase 41
  (identity.yaml + Dexie self-recovery from existing tables)
  covers ~95% of real-world post-wipe scenarios, so the
  follow-up is an *interactive* "Save backup to disk" Settings
  action (different UX shape than auto-backup): user clicks,
  ``showSaveFilePicker`` prompts, a single timestamped JSON
  drops to their downloads folder. Trigger: a user reports
  losing data after a full browser-data clear in Dexie mode
  + at least one request for "can I export a JSON I keep
  somewhere".
- [ ] **HELP-CONTENT-TRANSLATIONS-01**: Translate the 22-entry
  help glossary content (``backend/config/help/*.yaml``) for
  ES / FR / EL / PT / TR / JA. Currently EN-passthrough — the
  bundles for these six languages are byte-identical copies of
  the EN authoring files with only the ``language`` field
  stamped to match the target locale. Each entry is a
  ``short`` (1-2 sentences) + ``long`` (200-500 words
  Markdown), so the full scope is ~22 × 6 × 2 ≈ 264 distinct
  text blobs (~10k words of educational content per
  language). PT / TR / JA need native-speaker review; ES /
  FR / EL can ride the EN passthrough until enough demand
  surfaces to invest in translation. The ``ui.help.*``
  catalog keys (button labels, dialog chrome) are NOT part of
  this item — those are short UI strings and were translated
  inline with the relevant Phase 38 commits. The Phase 26
  ``test_i18n_translation_audit`` only scans
  ``backend/config/i18n/*.yaml``, NOT
  ``backend/config/help/*.yaml``, so the passthrough
  bundles do not currently fail any test. Trigger: a user
  reports the help drawer reading awkwardly in one of the
  six languages, OR a translator volunteers a pass.
- [x] **BL-28**: Source-stamp Claude.ai per-conversation
  Markdown exports as ``source="claude"``. Closed alongside
  BL-25 — ``claude_md_parser.ts`` stamps the source on the
  ``NormalizedConversation`` it returns and ``detectFormat``
  returns ``"claude"`` for the .md signature.
- [x] **BL-11**: PT/TR/JA translations (native quality) —
  Currently EN-passthrough. Need native speakers or
  professional translation for 213+ keys x 3 languages +
  12 assessment questions x 3 languages. AI-translated pass
  shipped in v1.13.0 / Phase 26 — see
  `changelog/releases/v1.13.0.md`. Each YAML carries a
  "AI-translated, pending native speaker review" header
  comment; native review remains an open follow-up.
- [x] **BL-12**: Rich-text in notes (TipTap) — Shipped in
  v1.14.0 / Phase 27. RatingDialog session notes,
  Curriculum.description and Lesson.content all use a TipTap
  ``RichTextEditor`` (bold / italic / underline / strike,
  headings, lists incl. task lists, blockquote, links,
  highlight, text-align, undo/redo). Code blocks gain
  lowlight-backed syntax highlighting with a per-block
  language picker + copy button (11 languages: bash, css,
  html, java, javascript, json, markdown, python, sql,
  typescript, yaml). Markdown / PDF exports honour the new
  rich-text shape via ``lib/tiptap-to-markdown.ts``. Math
  formulas explicitly deferred — re-file when triggered.
  See ``changelog/releases/v1.14.0.md``.
- [x] **BL-13**: E2E Playwright expansion — Shipped in
  v1.15.0 / Phase 28. 10 new smoke specs covering
  multi-cycle session auto-loop, conversation import +
  analysis, backup export + restore roundtrip, sync pairing
  UI (desktop + mobile), Markdown export flows
  (progress / curriculum), subjects + tags filter bar,
  rich-text editor mount in RatingDialog, 3-chunk SSE
  streaming chat, and model picker surface. Full suite at
  release: 36 tests across 16 spec files; runtime 2.6 min.
  Two scope-limit notes filed for follow-up
  (``28C-DETAIL-GET-MOCK`` -> BL-24, ``28J-SETTINGS-RACE``
  -> BL-23). See ``changelog/releases/v1.15.0.md``.
- [ ] **BL-23**: Fix get_or_create_settings race condition —
  concurrent GET requests cause UNIQUE constraint violation
  under React strict-mode double-effect. Add
  SELECT ... FOR UPDATE or use INSERT ... ON CONFLICT DO
  NOTHING.
- [ ] **BL-24**: Fix page.route GET matcher for
  /api/imports/{id} in E2E — current workaround uses
  waitForRequest on POST instead of asserting detail-page
  cards.
- [ ] **PLUGINFORGE-LIFECYCLE-UI-01**: Consume v0.9.0
  lifecycle visibility in Settings → Plugins. Backend half
  SHIPPED 2026-05-23: ``GET /api/plugins/inspect/{name}`` +
  ``api.plugins.inspect()`` API client + ``PluginInspection``
  TypeScript type + 2 backend tests + 2 Vitest tests. The
  endpoint surfaces ``activated_at``, ``last_config_change``,
  ``source``, ``filter_reason``, ``load_error``, ``version``,
  ``target_application`` per plugin (404 on unknown name).
  Frontend half STILL PENDING: the scope estimate at filing
  time ("~40 LOC frontend, fold into the existing Settings →
  Plugins panel") assumed a Settings → Plugins panel exists.
  Re-audited Settings.tsx — no Plugins section currently
  exists in the UI. Building it from scratch is closer to
  150-200 LOC (list active plugins via
  ``api.plugins.health()`` or ``manifests()``, render a row
  per plugin with name + version + activated_at + source).
  Deferred until the next time Settings sees structural work,
  or someone reports needing the lifecycle info. The backend
  contract is stable and shipped; the panel can be built on
  top of it without further backend changes. Audit
  ([docs/audits/pluginforge-0.9.0-adoption-signal-2026-05-21.md](audits/pluginforge-0.9.0-adoption-signal-2026-05-21.md)).

## P4 — Future / SaaS

- [ ] **BL-14**: PostgreSQL migration — Replace SQLite with
  PostgreSQL for multi-user/SaaS deployment. Alembic
  migrations, connection pooling, Docker Compose with pg
  service.
- [ ] **BL-15**: JWT authentication — User login,
  registration, password reset. Required for multi-user.
  Consider OAuth (Google, GitHub) as alternative.
- [ ] **BL-16**: Multi-user support — Tenant isolation,
  shared curricula, team learning projects. Requires BL-14 +
  BL-15.
- [ ] **BL-17**: Stripe integration — Premium plugins,
  subscription tiers. Requires BL-14 + BL-15 + BL-16.

## P5 — Speculative (No concrete trigger)

- [x] **BL-18**: Gamification (XP, badges, leaderboard) —
  Closed in v1.16.0 / Phase 29. Shipped XP, 24 badges,
  enhanced streaks (freezes + weekend mode + heatmap), and
  Settings controls. Leaderboard intentionally NOT shipped —
  it requires multi-user infrastructure (see BL-19 / social
  features).
- [ ] **BL-19**: Social features (share progress, study
  groups) — Requires multi-user. Far future.
- [x] **BL-20**: Voice input/output (TTS/STT) —
  Closed in v1.18.0 / Phase 31. Web Speech API integration:
  SpeechButton on AI responses + Assessment results, MicButton
  for dictation in SessionChat, new Pronunciation Practice
  page for language-learning projects, new Voice settings
  section. Zero external cost (no ElevenLabs / cloud TTS).
  Graceful degradation on unsupported browsers.
- [x] **BL-21**: Anki deck export —
  Closed in v1.17.0 / Phase 30. New
  ``adaptive-learner-plugin-anki`` extracts flashcard
  candidates from sessions + conversations via the existing
  ``ai_complete`` hook + ships a client-side .apkg builder
  (sql.js + JSZip, lazy-loaded). Anki Connect API
  integration intentionally NOT shipped (out of scope per
  spec). Browser-direct AI session-extraction in Dexie mode
  filed as a polish patch.
- [x] **BL-22**: NotebookLM integration —
  Closed in v1.19.0 / Phase 32. NotebookLM has no public API,
  so direct integration isn't possible. The new
  ``adaptive-learner-plugin-notebooklm`` ships the next-best
  path: AI-generated active-recall study questions
  (``study_questions`` table + 3-tier difficulty), an
  AI-generated comprehensive study guide (one big AI call,
  ~30K-char content-clipping), and a client-side ZIP
  exporter that assembles a NotebookLM-optimized package
  (summary / vocabulary / rules / errors / flashcards /
  per-session excerpts as structured Markdown). Browser-
  direct AI in Dexie mode + inline-edit for questions filed
  as polish patches.

## Trigger-Gated Items

These activate when a specific condition is met:

| Item | Trigger |
|------|---------|
| BL-07 Global subjects | User creates 5th learning project |
| BL-11 PT/TR/JA | First non-DE/EN/ES/FR/EL user request |
| BL-14..17 SaaS | Decision to go commercial |
| BL-18..19 Social | 100+ active users |

## Blocked / Upstream Wait

*(none)*
