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

State: **post v1.64.0 (onboarding overhaul — a two-field quick start (name + topic, the rest defaulted) + an optional one-question-per-screen profile wizard (`OnboardingWizard`: goal / timeframe / daily minutes / current problem / opt-in assessment), assessment now OPT-IN ("Jump right in" -> Dashboard; assessment only from the wizard's last step) (#92, #94); fixes — Content Browser single scrollbar (`html`/`body` lock both axes so `#root` is the sole scroll container) (#42) + sticky lesson footer pinned across steps (`lesson-page` fills the viewport, step grows `flex-auto`; regression pin `e2e/dexie/lesson-footer-stability.spec.ts`) (#43) + a WCAG contrast pin for `--accent`-as-text + a catppuccin-mocha nudge so all 12 themes pass computationally (#96); see changelog/releases/v1.64.0.md); prior post v1.63.0 (6 recommended WCAG-AA theme presets + systematic i18n audit (#80 — `subjects.*` data-i18n for 77 seeded names + 92 missing `t()` keys incl. the whole `editor.*` toolbar, all 8 langs) + dashboard subject filter scoped to the user (#72) + theme/i18n fixes (#82/#84/#87); see changelog/releases/v1.63.0.md); prior post v1.62.0 (backup-restore data-integrity hardening (#57 datetime coercion + #64 orphan-FK-skip) + GitHub-Pages build provenance (#66) + content cache-bust (#62) + UI/i18n conformance (#51/#55/#76/#53/#68/#78/#69) + `.claude` governance + Bibliogon templates/labels; see changelog/releases/v1.62.0.md); prior post v1.61.0 (app-wide shadcn button conformance (~200 buttons across 13 page areas) + lesson resume-at-paused-step (LessonProgress.current_step, Alembic 0027 + Dexie) + cross-repo content validation (validate_bundled_content.py + a Content-stats CI gate + README CONTENT-STATS block, 330 lessons / 16 sets) + backup-restore fixes (badges.key natural-key upsert + user_badges.badge_id remap, FK-topological _RESTORE_ORDER, imported_conversation_id in backup columns); see changelog/releases/v1.61.0.md); prior v1.60.0 (lesson-reading UX + Learning Path Achievement Map + Tailwind exercise renderers + help-glossary perf + B1 content complete: auto-hide lesson header on scroll (useScrollDirection on #root, motion-safe Tailwind transform, sticky footer stays); Learning Path Map view (domain-grouped; 3 views: Persönlich / Map / Graph); Settings icon-only mobile buttons; all 5 exercise renderers migrated to Tailwind (~85-90 %) + theme audit (43-token parity, themed Dialog overlay) + dead-CSS removal; help glossary lazy per language (main index chunk 731->449 KB raw / 245->138 KB gzip, PERF-HELP-GLOSSARY-LAZY-01); same-language imports auto-detected as knowledge domain (Save stamps lesson domain, Share Wizard inherits the pair; E2E variant 2 un-fixme'd) + Dexie async-load wizard fix + github_service mypy cast; B1 content complete — de->es/en/fr B1 (15 each), 271 lessons / 13 sets / ~66 h); prior v1.59.0 (Learning Path Redesign — personal path with zoom levels: two-level view replaces the all-225-lessons xyflow graph as the default (Level 1 set rows sorted by last activity with progress dots + action; Level 2 accordion lesson detail with stars/mastery/dates + adaptive/retry-errors); "Nur meine" / "Alle Sets" filter + collapsible not-downloaded section, both persisted; next-CEFR-level offer on completion; xyflow kept as a lazy-loaded alternative view, removed from the default bundle; nav hamburger moved left on mobile); prior v1.58.0 (user-centric UX overhaul: Continue Learning ("Weitermachen") section on the Content Browser + Dashboard surfacing the most recently-touched lesson per set; Content Browser reordered search-first with icon-only mobile action buttons; Dashboard reordered Continue-Learning-first; responsive icon/text button pattern); prior v1.57.0 (community PR automation — fork -> commit -> PR for community sharing, GitHub PAT in Settings -> Integrations; Content Browser instant search; Tailwind Phase D; psychology to 90 lessons); prior v1.56.0 (performance + PWA hardening: ~460 KB gzip saved via lazy i18n catalogs + curated highlight.js, bundle audit, Dexie/backend queries verified healthy; offline indicator + network-aware buttons, background-sync queue, cache-management UI, install prompt, API-mode lesson caching; carries the Tailwind/shadcn migration Phases B-D + backend rate-limiting/OpenAPI; restored per-theme read-aloud in Dexie mode); prior v1.55.0 (Tailwind CSS v4 + shadcn/ui foundation (Phase A) + Error Replay; prior v1.54.0: import-time language pipeline + big content release; prior v1.53.0: content schema v1.3 + Python course +
domain support — 7 sets / 100 lessons; code rendering +
code-aware exercises; analysis-to-lesson source-language fix).**
Prior: **v1.52.0 (DE->EN A1 content — 5 sets / 75 lessons —
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

## P2 — Medium Value, Medium Effort

## P3 — Lower Value or Large Effort

- [ ] **BADGE-EVAL-NPLUS1-01**: Badge evaluation fires one query per
  badge. `evaluateBadgesForUser` (`frontend/src/storage/badges.ts`) and
  `badge_service.evaluate_user` (gamification plugin) both load the
  catalog + earned rows (2 queries), then iterate ~28 evaluators where
  ~14 predicate / tier-metric helpers EACH run their own query, many
  re-scanning the SAME tables (sessions, lessonProgress, elementErrors,
  userXp) -> ~16-30 queries per evaluation. NOT on a page-load path
  (runs after lesson/session completion). Fix: build a shared metrics
  snapshot once and thread it through all predicates, in BOTH modes
  (keep the cross-language parity golden green). Cross-cutting refactor
  of 14+ functions x2 modes -> deferred. Filed from the 2026-06-03
  performance audit (B-1 / C-1).
- [ ] **PERF-EAGER-GLOBS-01**: Remaining `eager: true`
  `import.meta.glob` sites bundle all-language data into their consuming
  chunk. `src/lib/praise/phrase-picker.ts:45` (praise, 72 KB dir, lands
  in the `celebration-bus` chunk) and `dexie-storage.ts:2304`
  (plugin-config, 28 KB dir). Convert to lazy per-key loading like the
  i18n glob fix (F-1). Low impact — praise loads during lessons,
  plugin-config is small. Opportunistic. Filed from the 2026-06-03
  performance audit (F-4).
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
