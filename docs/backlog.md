# Adaptive Learner Backlog

Daily-planning view of items outside the phase plan. The
authoritative roadmap lives in [ROADMAP.md](ROADMAP.md); use
this file for granular items + status.

State: **post v1.8.0 (Phase 21 / Sync Gaps shipped).** BL-05
(step_evaluations + session_notes sync) shipped in v1.8.0
across `872cf84` (21A step_evaluations) and `f83aeb4`
(21B session_notes mutable + conflict resolution). BL-06
(sync.* i18n YAML migration) shipped in `1c22895` (21C).
Bundled bonus: pluginforge ^0.7.0→^0.8.0 in `c4670c0`.
imported_conversations + imported_messages joined the sync
surface in `3f98bf1` (21D); the 16-table sync surface audit
locks the invariant in `2c8bee8` (21E).

Items ordered by impact and dependency chain. P0 = next up,
P5 = speculative. Within each tier, smaller-scope and
unblocking items come first; alphabetical-by-ID as final
tiebreaker.

---

## P0 — Next Releases (Prompts ready)

- [ ] **BL-03**: pluginforge-app-template repo — Export a
  v0.0.0-template tag into astrapi69/pluginforge-app-template.
  Add README explaining how to fork. Validates PluginForge
  ecosystem (3 repos: framework, template, app).
- [ ] **BL-25**: Claude.ai per-conversation Markdown export
  collapses to one big user message. The 80%-case input for
  "I want to import this chat" is the `Export this chat as
  Markdown` button inside Claude.ai. Today the entire
  72-KB / 50-turn transcript lands as a single ``user``
  message, no role boundaries, no per-turn timestamps,
  ``source="manual"``. Auto-detect routes to
  ``markdown_parser`` (correct — it is .md, not the JSON bulk
  export), but neither ``## Prompt:`` nor ``## Response:`` is
  in ``recogniseMarker``'s allowlist. Phase 33 audit fixture
  + Vitest regression-pin at
  ``frontend/src/chat_import/__fixtures__/claude-markdown-export.md``
  + ``claude_markdown_export.audit.test.ts``; full findings
  in ``docs/manual-tests/phase-33-import-audit.md``. Minimal
  fix: add ``prompt`` to USER_MARKERS + ``response`` to
  ASSISTANT_MARKERS in
  ``frontend/src/chat_import/markdown_parser.ts``. Proper
  fix: also stamp ``source="claude"`` (separate BL-28) and
  extract per-turn timestamps (the line after the header is
  ``D.M.YYYY, HH:MM:SS``). Blocks A2 / A3 / A4 / A5 of the
  Phase 33 manual flow. P0 because every downstream feature
  (analysis quality, curriculum generation, targeted session
  start, Anki extraction, NotebookLM package) silently
  degrades on this input shape.
- [ ] **BL-26**: ``markdown_parser`` allowlist misses generic
  "Prompt:" / "Response:" headers used by multiple chat
  exporters. Smaller in scope than BL-25 but the same root
  cause: a minimal ``## Prompt:\n...\n## Response:\n...``
  shape collapses to a single user message because neither
  "prompt" nor "response" is in the role allowlists. Filing
  separately so the regression-pin test in
  ``claude_markdown_export.audit.test.ts`` (the
  ``BL-26 — Claude.ai 'Prompt:' / 'Response:'`` case) can
  flip green independently of full fixture parity. Same fix
  closes both.

## P1 — Architecture / Hygiene Debt

- [ ] **BL-27**: ``vocabulary`` field — spec / code drift
  between SYSTEM_PROMPT, parseAnalysisResponse, and downstream
  consumers. The TypeScript type
  (``ConversationAnalysisResult.vocabulary?: VocabularyEntry[]``)
  is declared; the Anki Dexie path
  (``frontend/src/storage/anki.ts``
  ``extractFromConversationDexie``) reads
  ``analysis_result.vocabulary``; the NotebookLM exporter
  (``frontend/src/lib/export/notebooklm-package.ts``)
  collects it across analyzed conversations to fill
  ``vocabulary.md``. BUT: the SYSTEM_PROMPT in
  ``frontend/src/chat_import/analysis.ts:56-125`` does NOT
  list ``vocabulary`` in the JSON schema it asks for, and
  ``parseAnalysisResponse`` (same file, lines 246-280) does
  NOT read it even if a model emits it unprompted. Result:
  Anki "vocabulary path" in Dexie mode is dead code; the
  ``vocabulary.md`` in NotebookLM ZIPs is always empty; the
  Anki vocabulary import in v1.17.0's flow is gated on a
  field nothing populates. Fix: extend SYSTEM_PROMPT to ask
  for ``vocabulary: [{word, translation, example?, phonetic?,
  tags?}]`` when the topic looks language-related, and add
  the ``vocabulary`` read in ``parseAnalysisResponse``. Audit
  details in ``docs/manual-tests/phase-33-import-audit.md``.

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

- [ ] **BL-28**: Source-stamp Claude.ai per-conversation
  Markdown exports as ``source="claude"`` (currently
  ``source="manual"``). Once BL-25 lands, the parser will
  produce 50 alternating turns from a Claude .md export —
  but the dispatcher path still reads as a markdown fallback
  and stamps ``source="manual"`` for the
  ``ImportedConversation`` row. The H1 + metadata block at
  the top of the file is a strong signature
  (``# <title>\n\n**Created:** ... \n**Link:**
  https://claude.ai/chat/...``). Wire ``detectFormat`` to
  recognize it and route through a thin Claude-Markdown
  variant of the parser (or just have ``markdown_parser``
  detect the signature and override ``source``). Cosmetic
  for analysis (source field is informational), but useful
  for telemetry + future per-source UI affordances.
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
  lifecycle visibility in Settings → Plugins. The installed
  manager exposes `inspect_plugin(name)` (returns a
  `PluginInspection` with `activated_at` + `last_config_change`
  + `source`) plus the `on_plugin_activated` /
  `on_plugin_deactivated` / `on_config_refreshed` event hooks
  — none of them are surfaced in the UI yet. Estimated scope:
  add `GET /api/plugins/inspect/{name}` (~20 LOC + 1 happy-path
  test), render the two timestamps + source on each plugin row
  in the Settings panel (~40 LOC frontend). Trigger: the next
  time the Settings → Plugins panel gets touched for any
  reason, fold this in. Audit
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
