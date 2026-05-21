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
- [ ] **BL-13**: E2E Playwright expansion — Current: 7 smoke
  specs + 16 viewport pins. Expand to cover: multi-cycle
  session, conversation import+analysis, backup/restore,
  sync pairing, export.
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

- [ ] **BL-18**: Gamification (XP, badges, leaderboard) —
  Could increase engagement. Risk: gimmicky if not done well.
- [ ] **BL-19**: Social features (share progress, study
  groups) — Requires multi-user. Far future.
- [ ] **BL-20**: Voice input/output (TTS/STT) — Speak
  answers, hear AI response. Useful for language learning.
  Large scope.
- [ ] **BL-21**: Anki deck export — Generate Anki-compatible
  `.apkg` files from session content. Connects to "Three
  Pillars" article.
- [ ] **BL-22**: NotebookLM integration — Auto-generate
  NotebookLM-compatible study materials from sessions. API
  availability unclear.

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
