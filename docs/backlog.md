# Adaptive Learner Backlog

Daily-planning view of items outside the phase plan. The
authoritative roadmap lives in [ROADMAP.md](ROADMAP.md); use
this file for granular items + status.

State: **post v1.6.0 (Phase 19 / Streaming Learning Response
shipped).** BL-23 (SSE streaming, deferred from 18D) shipped
in v1.6.0 across three commits: 19A foundation (`03edb2b`),
19B-1 SSE route + frontend reader + UI (`5b04d7a`), 19B-2
Dexie browser-direct streaming (`4bdcb21`).

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
- [ ] **BL-04**: QR-Code camera scan for sync — Phase 13
  shipped paste-the-link only. Add navigator.mediaDevices
  .getUserMedia + jsQR or html5-qrcode for native camera
  scanning. Mobile UX improvement.

## P1 — High Value, Clear Scope

- [ ] **BL-05**: Sync gap: step_evaluations + session_notes —
  Excluded from v1.0.0 sync due to schema mismatch between
  Dexie and backend. Align schemas, add to sync surface.
- [ ] **BL-06**: Sync i18n strings — Currently inline `t()`
  fallbacks. Add proper `sync.*` keys to all 8 YAML catalogs.

## P2 — Medium Value, Medium Effort

- [ ] **BL-07**: Global subjects/tags — Shared taxonomy
  across projects (Mathematics, Languages, Programming, etc.).
  Useful when user has 5+ learning projects. Enables
  cross-project analytics.
- [ ] **BL-08**: Swipe gestures on Assessment — Left/right
  swipe for next/previous question on mobile. Touch-event
  handling, accessibility (keyboard equivalent,
  reduced-motion). Deferred from Phase 9.
- [ ] **BL-09**: Provider model picker via API — Currently
  static datalist suggestions. Fetch available models from
  provider API (Anthropic `/v1/models`, OpenAI `/v1/models`).
  Show real model list in Settings.
- [ ] **BL-10**: Backup compare UI — Side-by-side comparison
  of two backup files. Show diff per table (added, changed,
  removed records). Useful for auditing before restore.

## P3 — Lower Value or Large Effort

- [ ] **BL-11**: PT/TR/JA translations (native quality) —
  Currently EN-passthrough. Need native speakers or
  professional translation for 213+ keys x 3 languages +
  12 assessment questions x 3 languages.
- [ ] **BL-12**: Rich-text in notes (TipTap) — Add TipTap
  editor for SessionNotes and Curriculum/Lesson descriptions.
  Code snippets, math formulas, highlighting. Large
  dependency (TipTap ecosystem).
- [ ] **BL-13**: E2E Playwright expansion — Current: 7 smoke
  specs + 16 viewport pins. Expand to cover: multi-cycle
  session, conversation import+analysis, backup/restore,
  sync pairing, export.

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
