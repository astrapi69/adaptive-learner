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

State: **post v1.47.0 (Phase 63 — Lesson Flow Control:
pause/abandon/resume + 30s autosave + auto-resume, Dashboard
paused-lessons widget, lesson splitter for oversized imports,
retention sweep; folds in Word Tiles @dnd-kit touch reorder,
mobile horizontal-scroll fixes, lower-friction sharing, and a
backend CSP/security-header pass).** Prior: **v1.46.0 (Phase 62
— EXP-018 Exercise Direction: per-direction SRS, direction-aware
renderers + adaptive strategy; P0 Save fix + content migration
into adaptive-learner-content).**
Phase history through Phase 63 +
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
