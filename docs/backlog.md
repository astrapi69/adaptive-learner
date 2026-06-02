# Adaptive Learner Backlog

Daily-planning view of items outside the phase plan. The
authoritative roadmap lives in [ROADMAP.md](ROADMAP.md); use
this file for granular items + status.

## Strategic Expansion: Content-Repository MVP

See [docs/explorations/](explorations/) for the full strategic plan:

- [EXP-INDEX.md](explorations/EXP-INDEX.md): 17 explorations overview
- [BACKLOG.md](explorations/BACKLOG.md): 223 tasks across 5 phases
- [ROADMAP-PHASE-1-VORSCHLAG.md](explorations/ROADMAP-PHASE-1-VORSCHLAG.md): Sprint plan for Phase 1

This expansion transforms Adaptive Learner from an AI-chat-only
tool into a full learning platform with downloadable content
sets, interactive exercises, and dual-mode operation
(Content-only + AI-augmented).

State: **post v1.52.0 (DE->EN A1 content — 5 sets / 75 lessons —
+ BACKUP-API-RESTORE-01 backend restore-coverage fix, production
DB guard, and the Lesson-Creator resumed-draft P0 fix).** Prior:
**v1.51.0 (Phase 66 / EXP-022 — Visual Learning Path
+ Dexie backup overhaul: File System Access API save-to-disk, a
"Your backup contains" preview, and a data-loss fix restoring the
10 gamification/progress/SRS/missions tables the Dexie export had
silently dropped; BACKUP-API-RESTORE-01 filed P1). Prior:
post v1.49.0 (Phase 65 — API-key UX + Community Sharing
via PR + Analysis loading: API-key format validation + live Test
button + rollback/restore cache (`ApiKeyBackup`, Alembic 0025,
Dexie v24), stable `secret.key` Fernet source + UI-editable
secrets.yaml keys; community sharing opens a GitHub pull request;
chat-import Analyze loading indicator with real Cancel; friendly
voice/mic errors. Plus, unreleased on main: native help
translations in 6 languages — HELP-CONTENT-TRANSLATIONS-01).**
Prior: **v1.48.0 (Phase 64 — Community Sharing UX + Smart Lesson
Organization: four-step share wizard, placement engine,
duplicate/variation detection, author credit, contribution
history, Missing-Lessons suggestions; content schema 1.2 -> 1.3;
merges Smart Next-Step Suggestions after lesson completion +
EXP-021 Lesson-Creator exploration).** Earlier:
**v1.47.0 (Phase 63 — Lesson Flow Control: pause/abandon/resume +
autosave + auto-resume, paused-lessons widget, lesson splitter;
Word Tiles @dnd-kit reorder, mobile overflow fixes, backend CSP
pass).**
Phase history through Phase 64 +
per-release notes live in
[changelog/releases/](../changelog/releases/). 29 tables on
the sync surface. 13 plugins, 29 SQLAlchemy models,
1047 (+1 skipped) + 1031 + 2624 = 4702 tests green
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

## P1 — Architecture / Hygiene Debt

- [ ] **BACKUP-API-RESTORE-01**: Backend ``_RESTORE_ORDER`` covers
  only 18 of the 30 exported tables. ``backup_service.py``'s
  ``_gather_user_rows`` iterates the full ``sync_service.TABLES``
  surface on EXPORT (30 tables incl. gamification, lesson_progress,
  element_errors, missions, subjects/tags taxonomy), but
  ``_RESTORE_ORDER`` stops at ``imported_messages`` — so a backup
  restored in API mode silently IGNORES every gamification /
  progress / SRS / missions / taxonomy row in the file. The data is
  exported but un-restorable on the API side. Surfaced while fixing
  the Dexie-side equivalent (BACKUP-DIR-EXPORT-01, which extended
  the Dexie ``RESTORE_ORDER`` to all 30 tables — the frontend is now
  complete; the backend is the remaining half). Fix: extend
  ``_RESTORE_ORDER`` to mirror the Dexie order (badges before
  user_badges; subjects/tags before project_* M:N rows), then add a
  full-surface export->wipe->restore roundtrip test asserting the
  gamification/progress tables come back. Not active production data
  loss (the rows still live in the DB; only a cross-install / post-
  reset restore loses them), but it makes API-mode backups a partial
  lie the same way the Dexie bug did. Low risk: ``_restore_table``
  is generic; the new tables are direct user-scope mutable rows.

## P2 — Medium Value, Medium Effort

## P3 — Lower Value or Large Effort

- [ ] **DEP-MYPY-2-01**: Upgrade mypy 1.x -> 2.0 (held back in the
  v1.41.0 dep sweep — caret ``^1.20`` caps it). Major version;
  needs a dedicated migration session (new/renamed error classes,
  stricter defaults). Not urgent. Bump the pin in
  ``backend/pyproject.toml`` + every ``plugins/*/pyproject.toml``,
  re-lock, then fix the fallout under ``poetry run mypy app/``.
- [ ] **DEP-ANTHROPIC-105-01**: Upgrade the ai-anthropic plugin's
  ``anthropic`` SDK 0.55 -> 0.105 (held back in v1.41.0; out of the
  ``^0.55`` caret). A 50-version 0.x jump: the plugin's tests MOCK
  the SDK, so a green suite would NOT prove ``messages.create`` still
  works. Schedule a dedicated session that exercises a REAL API call
  (live key) before bumping the pin + lock.

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

- [ ] **BL-19**: Social features (share progress, study
  groups) — Requires multi-user. Far future.

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
