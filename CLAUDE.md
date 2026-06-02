# Adaptive Learner

Adaptive learning platform implementing the six-method learning
model (Asterios Raptis, *Von Theorie zur Praxis*, Medium series).
A complete, plugin-driven application: assessment, 7-step learning
sessions across 6 methods, streaming AI replies via 3 providers,
chat-history import + analysis, multi-cycle auto-loop, dual storage
(SQLite + browser IndexedDB), local-network sync, file-based key
configuration, gamification, voice, Anki + NotebookLM exports, PWA.

- **Repository:** https://github.com/astrapi69/adaptive-learner
- **Current state:** **v1.53.1** (patch — **bug fixes**: single
  two-phase button on the Adaptive/Review pages (was showing both
  Pruefen + Weiter); community-PR file attachment now works for
  all lesson sizes (create-file flow, never null); + regression
  pins for analysis-context-on-resume and the lesson-nav
  hamburger). v1.53.0 = minor — **content schema v1.3
  (technical content) + Python course + domain support**).
  **Schema v1.3:** Card gains optional ``code_snippet`` /
  ``code_language`` / ``expected_output`` / ``hint`` / ``difficulty``
  (1-5) / ``media_type`` (text|code|formula|diagram); all optional, so
  pre-v1.3 lessons load unchanged (``CURRENT_SCHEMA_VERSION`` 1.2→1.3,
  major-match support). **Domain support:** sets/lessons carry a
  ``domain`` (default ``language``); non-language domains
  (programming, psychology) allow source==target (both validators).
  The Content Browser splits **Sprachen** (source→target→level tree)
  from **Wissen** (domain groups w/ code/brain/calculator icons).
  **Code rendering:** ``highlight.js`` (lazy) code blocks in the
  lesson viewer — language label, copy button, ``Output:`` block,
  mobile scroll. **Code-aware exercises:** code/formula cards drive a
  monospace free-text textarea with whitespace/quote-tolerant
  case-sensitive matching + monospace cloze. **Content:** new
  **Python Grundlagen** (``de/python-basics``, 15 lessons, 123
  code-snippet cards, domain=programming) joins the library — now
  **7 content sets, 100 lessons** (~22h), all bundled. **Fix:**
  analysis-to-lesson ``source_language`` defaults to the app language
  (not ``en``); P3 follow-ups ANALYSIS-TARGET-DETECT-01 /
  ANALYSIS-DOMAIN-SUGGEST-01 / PLACEMENT-LANG-WARN-01 filed.
  v1.52.0 = minor — **DE→EN A1 content**
  + **backup-restore data-integrity fixes**.
  **Content:** a fifth A1 course — **English for German speakers**
  (``de/en-a1``, 15 lessons) — joins ``de/es-a1``, ``de/fr-a1``,
  ``en/es-a1``, ``en/fr-a1``: **5 content sets, 75 lessons** (~12.5h),
  all bundled into the GitHub Pages build. DE→EN drills classic
  false friends (become/bekommen, gift/Gift, handy/Handy,
  chef/Chef, actual/aktuell), German-targeted distractors (missing
  third-person -s, do-support, uncountable plurals), and a
  progressive receptive→mixed→productive direction (EXP-018).
  **BACKUP-API-RESTORE-01 (P1):** API-mode backup exported all 30
  tables but ``_RESTORE_ORDER`` listed only 16 — a restore silently
  dropped 14 tables (gamification / lesson-progress / SRS-error /
  missions / anki / study-question / taxonomy / api-key-backup).
  Restore order now **derives from the export source**
  (sync surface, FK-ordered) so the two can't drift; a parity test
  pins export==restore==sync, and a 30-table round-trip verifies
  data survives. **Per-table flush during restore** fixes a latent
  FK violation (single end-commit let SQLAlchemy reorder inserts by
  ORM relationships, but the gamification/SRS/content tables are
  FK-decoupled). **New ``app/db_guard.py``:** a process-wide guard
  refuses full-table DELETE/DROP/TRUNCATE against a
  production-marked data dir from any non-app process (the running
  app opts in via ``mark_app_runtime()``). **P0 fix:** the Lesson
  Creator's "Next" silently failed on Step 1 when a *resumed draft*
  had source==target language; ``loadLessonDraft`` now repairs an
  equal pair so a resumed draft is always advanceable.
  v1.51.0 = minor - **Phase 66 / EXP-022
  Visual Learning Path** + a **Dexie backup overhaul**.
  An interactive @xyflow/react graph at ``/learning-path`` shows
  the learner's full lesson journey: set-group nodes (progress
  bar, per-direction mastery, collapsible) + lesson nodes
  (status, stars 0-3, receptive/productive mastery pills, XP,
  recommended badge, lock). Dagre auto-layout (TB) + draggable
  nodes with per-user localStorage position persistence + Reset
  button. Status/direction filters + full-text search (Enter
  navigates to first match) + stats sidebar. Error-cluster panel:
  shared error patterns (≥ 2 lessons) grouped by tag with
  one-click adaptive lesson launch. Nav link, Content Browser
  button, Dashboard quick action. WCAG a11y: role="status" on
  loading, aria-label on all controls, React.memo on node views,
  memoized callbacks. Lazy-loaded (xyflow ~100 KB). Both storage
  modes. **Backup (BACKUP-DIR-EXPORT-01):** Dexie-mode "Save to
  disk" via the File System Access API
  (``showSaveFilePicker`` + download fallback + cancel handling),
  a "Your backup contains" record-count preview, and a
  **data-loss fix** — the Dexie backup had drifted to 20 tables
  while the backend sync surface grew to 30, silently dropping
  every gamification / lesson-progress / SRS-error / missions /
  anki / study-question row on export; the Dexie export now
  covers the full 30-table surface.
  v1.50.0 = minor - **Lesson Creator
  (EXP-021)** — a standalone, no-API-key way to build a complete
  shareable lesson. New ``/create-lesson`` route +
  ``CreateLesson.tsx`` 4-step wizard: **Metadata → Card Editor →
  Exercise Generator → Save/Share**. Card editor has
  drag-and-drop reorder (``@dnd-kit``) + **CSV import**;
  exercises **auto-generate** from cards across all 5 types
  (shared generator module) with a manual editor for advanced
  control; **lesson templates** (Blank / Vocabulary / Grammar /
  Conversation); **draft auto-save** to localStorage; **preview**
  in the real LessonViewer before save; entry points in the
  Content Browser + Dashboard; **save locally** + **share via
  PR** (Phase 64 pipeline). Also: **native Save-to-disk backup**
  (File System Access API + full Dexie sync-surface coverage);
  both storage modes, no migration, full i18n in 8 langs.
  v1.49.0 = minor - **Phase 65 — API-key
  UX + Community Sharing via PR + Analysis loading**. API keys
  get instant **format validation** (prefix + length per
  provider, green/red + checkmark, Save gated), a live **Test**
  button (backend ``POST /settings/{user}/test-api-key`` +
  browser-direct in Dexie; classifies ok/invalid/rate_limit/
  network), and a **rollback cache** (new ``ApiKeyBackup`` model
  + Alembic 0025 + Dexie v24 + sync surface): Save auto-tests
  first, a working key is saved + backed up, a failing key
  triggers Keep old / Save anyway / Restore. ``secret.key`` is
  now the stable Fernet key source (keys survive restarts) and
  secrets.yaml keys are UI-editable (path corrected to
  ``~/.config/adaptive_learner/secrets.yaml``). **Community
  sharing now opens a GitHub PULL REQUEST** (not an issue): the
  lesson JSON lands at ``sets/{src}/{tgt-level}/lessons/
  {nn}-{slug}.json`` and the content-repo CI validates it
  (``communityPrUrl`` + ``communityUploadUrl`` + ``buildPrBody``;
  small lessons pre-fill the create-file editor, large ones
  download + upload-page). The chat-import **Analyze** action
  gets a **loading indicator** (phased progress + estimate +
  spinner + real Cancel via AbortSignal + friendly inline
  error). Voice dictation shows **friendly mic errors**
  (no-device / offline / permission) instead of raw Web Speech
  codes. Both storage modes; full i18n in 8 langs. **30
  SQLAlchemy models** (added ``ApiKeyBackup``).
  v1.48.0 = minor - **Phase 64 —
  Community Sharing UX + Smart Lesson Organization**, with
  **Smart Next-Step Suggestions** after lesson completion.
  Sharing a lesson is now a four-step wizard: a smart
  **placement engine** (auto tree path + auto-numbered
  ``{nn}-{slug}.json`` filename + "you're the first" new-set
  detection + content auto-detection), an advisory
  **duplicate/variation/supplement** scan (lesson-level card +
  exercise overlap; share as a ``variation_of`` or extract only
  the new exercises), the quality summary, then share + a
  confetti celebration. Optional **author credit**
  (``contributed_by`` / ``contributed_at``, remembered locally,
  shown as a muted viewer credit line + in the GitHub issue). A
  local **contribution history** ("My Contributions" +
  "Community Contributor" at 5 shares, localStorage — no Dexie
  bump) and encouraging **Missing-Lessons** gap suggestions.
  Content schema 1.2 -> 1.3 (additive ``variation_of`` /
  ``variation_note`` / ``contributed_by`` / ``contributed_at``).
  New ``placement-engine.ts`` / ``gap-detector.ts`` /
  ``contribution-history.ts`` + lesson-level detection in
  ``duplicate-detection.ts`` + the ``ShareWizard`` component, all
  Vitest-covered. **Smart Next-Step Suggestions** (merged from
  ``feature/smart-next-steps``): the lesson summary proposes a
  sensible next step (adaptive lesson from errors, review queue,
  next lesson in set / set complete, resume awareness) via
  ``useNextStepSuggestions`` + a themed card. EXP-021 documents a
  future standalone Lesson Creator. Full i18n in 8 languages.
  v1.47.0 = minor - **Phase 63 — Lesson
  Flow Control**. Lessons are no longer all-or-nothing: they can
  be paused, abandoned and resumed. ``LessonProgress`` gains
  ``paused``/``abandoned`` states + ``paused_at``/``abandoned_at``
  timestamps (Alembic + Dexie, both modes); a back-button exit
  dialog offers Pause/Abandon/Continue and a resume-or-start-over
  dialog greets a paused lesson; 30s autosave + auto-resume on
  tab return; a Dashboard ``PausedLessonsCard``; a lesson
  splitter for oversized imports (configurable 5-20 exercises,
  TS+Python cross-language parity test); a paused-lesson
  retention sweep + Settings control. Folds in Word Tiles
  touch-capable drag-to-reorder (``@dnd-kit`` replacing native
  HTML5 drag, which never fired on touch), mobile
  horizontal-scroll fixes (3 overflow sources + a 320/375/414
  regression spec), lower-friction community sharing (GitHub web
  PR editor + informational validator), and a backend
  CSP/security-header middleware (Phase 61 audit P3 — strict
  ``default-src 'none'`` for the API, CDN-aware policy for the
  Swagger paths). v1.46.0 = minor - **Phase 62 — EXP-018
  Exercise Direction (Receptive vs Productive)**. Every exercise
  now carries an optional ``direction`` (``target_to_source`` =
  receptive/recognise, default; ``source_to_target`` =
  productive/produce; ``both``/``random``); schema stays 1.2
  (additive). The SRS tracks mastery PER DIRECTION:
  ``ElementError`` gains a ``direction`` column + the per-element
  unique constraint grows to include it (Alembic 0023 + Dexie
  v23 re-keys existing rows to receptive), so a card has
  independent receptive + productive rows and is "fully mastered"
  only when BOTH are (``is_fully_mastered`` /
  ``isFullyMastered``). Renderers are direction-aware via
  ``resolveConcreteDirection`` + ``resolveDirectionDisplay`` (the
  exercise-data-centric approach — Matching flips its columns,
  all non-cloze renderers show an eye/pencil instruction hint;
  cloze is in-context and skips direction); attempts stamp their
  concrete direction centrally in ``element-attempt.ts``. The
  review queue weights productive errors 1.2x and carries the
  direction into the synthesised review; the adaptive generator
  gains a ``direction_strategy`` (auto/receptive_first/
  productive_focus/balanced, default auto — receptive until
  recognition is solid, then productive) fed by a new Settings >
  Learning "Preferred exercise direction" control; the Dashboard
  FocusAreasCard shows a receptive/productive mastery split.
  Pilot lessons gained a progressive direction (1-5 receptive,
  6-8 mixed, 9-10 mostly productive). Also folds in a **P0
  fix** (analysis-to-lesson Save flow now sets a real language
  pair + ``title_native`` + CEFR level and gates Save on a
  shareable lesson — 5 validator-caught bugs) and a **content
  migration**: lesson content moved OUT of the app repo into
  ``astrapi69/adaptive-learner-content``; the build sources it via
  ``ADAPTIVE_LEARNER_CONTENT_DIR`` (default sibling checkout) and
  the GH-Pages deploy checks the content repo out (CI-verified
  bundling). v1.45.1 = patch - docs-sync: ROADMAP
  phase-history table refreshed through Phase 61 (was 19 phases
  behind), a cross-language badge-catalog parity golden
  (``tests/fixtures/badge-catalog/catalog.json`` pins
  ``badges.yaml`` <-> ``badges-data.ts`` so API-mode and
  Dexie-mode catalogs cannot drift), and BL-23 (settings race)
  + BL-24 (E2E GET matcher) archived as already-shipped; no
  runtime change. v1.45.0 = minor - **Phase 61 — Quality
  Sweep**. Audit-first pass (``docs/audits/2026-05-30-phase61-
  quality-audit.md``) then fixes: security P2 (``read_lesson``
  path-traversal guard), coverage (missions plugin 14→41,
  ApiStorage delegation 45%→100%, ``config_overlay`` 51%→90%,
  + 3 interactive Dexie E2E journeys: lesson playthrough across
  all 5 exercise types, Content Browser tree+filter, adaptive
  lesson), architecture (SyncSection routes through the api
  client → ``ApiError``; ``/import/:id`` in the Dexie gate),
  performance (export N+1 → one ``IN`` query; ``html5-qrcode``
  ``React.lazy`` out of the Settings chunk), dead-code removal
  (``peek_token``, ``DEFAULT_THEME``, ``FEEDBACK_PREF_KEYS``,
  the ProjectTaxonomy/SubjectBrowser/TagManager cluster), and
  the tree-placement verification + duplicate detection folded
  into the Phase 60 share pipeline (placement preview,
  conflicting-marker language heuristic, CEFR/word-count
  warnings, similar-title duplicate warning, enriched GitHub
  issue; content-repo CI now enforces the
  ``sets/{src}/{tgt-level}`` directory). Minor/patch deps
  applied (frontend react-router 7.16 / vite 8.0.14 / dexie
  4.4.3 / lucide 1.17; backend uvicorn 0.48 / platformdirs
  4.10); majors (anthropic, mypy, tiptap 3, vitejs-react 6,
  types-node 25, sql.js) + launcher deps held for dedicated
  sessions. v1.44.0 = **Phase 60 —
  Content Validation Pipeline + Language-Pair Tree**. Content
  sets now declare a language PAIR: ``target_language`` (what
  the learner LEARNS) + ``source_language`` (what they SPEAK -
  the language card backs / notes / theory are written in), so
  "French for English speakers" is a different set from "French
  for German speakers". Schema 1.1 → 1.2 (backward compatible:
  the old ``language`` key is a read alias for
  ``target_language``; ``source_language`` defaults to ``en``;
  optional ``title_native`` = target-language title; optional
  ``path`` = repo-relative source-language dir). Bundled +
  external content reorganised into a ``sets/{source}/{target-
  level}/`` tree mirrored 1:1 (single bundled source
  ``bundled:adaptive-learner-content``); the loader resolves a
  set's files via its ``path`` (Python ``ContentSet.base_path``
  + TS ``setBasePath``), Dexie schema **v22** backfills the pair
  on cached rows. The /content Set Browser became a source →
  target → level **tree** filtered by the learner's app language
  (+ opt-in extra source languages, Settings → Learning); other
  source languages collapse under "Other source languages". New
  **German-source** pilot sets (``de/fr-a1`` + ``de/es-a1``).
  TWO-LAYER content validation: a client-side
  ``content-validator.ts`` (schema + language pair + quality
  minimums — ≥5 exercises, ≥2 types, ≥1 theory, free-text ≥2
  accepts + distractors, matching ≥3 pairs, no empty cards)
  gates *Share with Community*, plus an OPT-IN AI review
  (``ai-content-validator.ts``, both modes; backend
  ``POST /api/content/validate-lesson``) for translation /
  grammar / level / cultural accuracy with per-suggestion
  auto-fix - AI never blocks sharing. The content repo gains a
  CI workflow (``docs/ci/adaptive-learner-content/`` mirror:
  ``validate_content.py`` + ``validate-content.yml``) running
  the same checks on every PR. New ``content.tree.*`` /
  ``content.validation.*`` / ``content.ai_validation.*`` /
  ``settings.source_languages.*`` i18n in 8 langs. v1.43.0 =
  the official ``astrapi69/adaptive-learner-content`` content
  repo now exists and is validated end-to-end, bringing the
  Content Browser online with it. Same-id sets are deduped across the
  bundled offline content and the GitHub repo (higher version
  wins; on a tie GitHub is preferred over the build-time-frozen
  bundle; when GitHub is unreachable only the bundled/cached
  entry survives, so the offline fallback stays intact). A
  Bundled/GitHub source badge renders on each downloaded set
  card, and Share with Community is re-enabled now the repo
  exists. Shared dedupe helpers per storage mode -
  ``dedupeContentEntries`` / ``compareVersions`` in
  ``content-loader-dexie.ts`` (Dexie); ``_dedupe_content_entries``
  / ``_compare_versions`` in the content-loader ``service.py``
  (API). Also folds in a documentation-verification system
  (``scripts/verify_docs.py`` + ``make verify-docs-discipline``
  + ``generate_docs_checklist.py``) that gates releases and CI
  on README/ROADMAP/CLAUDE.md currency. v1.42.1 = patch - fixed
  the Save-as-Offline-Lesson 422 in API mode (``saveUserSet``
  double-encoded its POST body) plus a Settings tab reorg
  (Help/About split, swipe-gesture to Learning, identity to
  Data). v1.42.0 = **Phase 59 —
  Analysis-to-Lesson Converter + Community Content Sharing**.
  Turns a chat-import analysis into a complete, replayable
  **offline lesson** and adds a backend-free sharing loop.
  New ``frontend/src/lib/content/`` modules:
  ``analysis-to-lesson.ts`` (deterministic, offline generator —
  theory from topic/summary/subtopics/strengths/weaknesses/
  error_patterns/suggested_curriculum; matching + free-text +
  cloze + word-tiles from ``vocabulary[]``; quality scales with
  vocab; <4 vocab → theory-only; Python mirror
  ``content-loader/analysis_to_lesson.py`` for API mode),
  ``lesson-export.ts`` (standalone lesson JSON, content-set ZIP
  via JSZip, pre-filled GitHub-issue community pathway — zero
  user data in exports), ``lesson-import.ts`` (validate + import
  ``.json``/``.zip``, schema-checked before save),
  ``adaptive-snapshot.ts`` (snapshot an adaptive lesson to a
  self-contained, slug-safe, replayable set). New
  ``IStorageService.contentLoader.saveUserSet`` + ``deleteSet``
  persist user-generated lessons into the SAME cache as
  downloaded sets (``source: "user-generated"``; Dexie
  IndexedDB + API filesystem cache; backend ``POST /user-sets``
  + ``DELETE /sets/{src}/{id}``; no new tables). New
  **"My Lessons"** section in ``/content`` (Play/Edit/Delete/
  Export/Share + empty state), a **"Save as Offline Lesson"**
  modal on ``/import/{id}``, an **Import Lesson** modal, and a
  **"Save this lesson?"** button on the adaptive-lesson summary.
  Generated lessons validate against schema v1.1 (no special
  "generated" schema) and play in the unmodified viewer. New
  ``content.*`` i18n in 8 langs. 9 atomic sub-phase commits;
  green through ``make test`` + ``npm run build`` + Vitest +
  ``make test-dexie-smoke``.
  v1.41.0 = Phase 58 (UX/UI Audit +
  Multi-Theme System). Full dark-mode audit
  (``docs/audits/ux-theme-audit-2026-05-29.md``) then a
  complete **semantic CSS variable system**: the canonical
  token set (backgrounds / text / borders / interactive /
  accent / status pairs / exercise feedback / charts / star /
  shadows) is defined per theme in
  ``frontend/src/styles/themes/theme-*.css`` — **6 themes**
  (light, dark, **ocean**, **forest**, **high-contrast**,
  **sepia**) + an **auto** mode following the OS. Fixed the F1
  audit class (~10 tokens were referenced but never defined,
  rendering light hex in dark mode). ``global.css`` keeps only
  theme-agnostic tokens + legacy aliases (resolve through the
  canonical tokens). ``lib/themes.ts`` registry + reworked
  ``useTheme`` (choice persisted under ``adaptive-learner.theme``,
  one-time migration from the old hyphen key, live OS-follow);
  **pre-paint script** in ``index.html`` (no flash);
  **ThemePicker** (Settings > General > Appearance, preview
  cards, instant swap). Charts recolor via
  ``lib/chartTheme.ts`` + ``useChartTheme`` (Recharts can't read
  CSS vars in SVG attrs). All 5 exercise types + celebration +
  stars + badge-tier use ``--exercise-*`` / ``--star``. New
  ``ui.themes.*`` + ``settings.theme*`` i18n in 8 langs. Pins:
  ``themes.test.ts`` (every theme defines the same token set),
  ``contrast.test.ts`` (WCAG 2.1 AA across all 6 themes),
  ``no-hardcoded-colors.test.ts`` (component styles). Folds in:
  the **58I accessibility re-audit**
  (``docs/audits/wcag-2026-05-29.md`` — Content download
  ``aria-live``, global ``:focus-visible`` baseline; axe already
  dev-wired), a **Dexie v21 upgrade bugfix** (a dynamic
  ``import()`` inside the IndexedDB upgrade transaction finished
  it early → ``DatabaseClosedError`` on /import for every v1.40.0
  upgrade; ``BUNDLED_BADGES`` extracted to ``badges-data.ts`` and
  static-imported), a content-loader warn-gate, and an in-range
  dependency sweep (backend lock; mypy 2.0 + anthropic 0.105
  held). 11 atomic sub-phase commits; green through
  ``make test`` + ``npm run build`` + Vitest +
  ``make test-dexie-smoke``.
  v1.40.0 = Phase 57 (Badge Tiers
  + Badge Gallery; the EXP-010 follow-up deferred from
  v1.39.0). All 28 badge keys are kept (no merge/removal)
  and gain a **bronze/silver/gold** tier. Two shapes:
  **static visual tiers** (sibling families render as one
  progression — ``sessions_10/50/100`` → bronze/silver/gold,
  ``level_5/10/25``, ``streak_3/7/30/100``; each keeps its
  row) and **dynamic tiers** (``lessons_10`` 10/50/100 +
  ``review_master`` 50/200/500 climb in place — high-water
  mark, never demote — awarding the XP **delta** per step,
  double-award-guarded). Identical evaluation in both
  storage modes, pinned by a cross-language parity golden
  (``tests/fixtures/badge-tier-parity/``). New tier-coloured
  **SVG generator** (``frontend/src/lib/badges/badge-svg.ts``:
  ~10 geometric glyphs × bronze/silver/gold/locked, inline
  data URIs, offline). New **BadgeGallery** drawer
  (``frontend/src/components/badges/``: filter + sort +
  expand-to-tier-breakdown; locked badges stay greyed but
  visible), opened from Settings > Gamification + the
  enhanced **Dashboard badge widget** (recent tier mini-icons
  + next-badge pointer). Tier upgrades **celebrate** via the
  v1.38.0 bus (silver chime / gold chord + glow,
  ``badge_tier_upgrade`` event, reduced-motion-safe). DB:
  ``UserBadge.tier`` + ``updated_at`` + ``Badge.base_tier`` +
  ``tier_thresholds``; Alembic ``0022`` (column add + static
  backfill); Dexie **v21**; ``user_badges`` sync promoted
  append-only → MUTABLE (monotonic tier). New
  ``gamification.tier.*`` + ``gamification.gallery.*`` i18n in
  8 langs. Closes P-158, D-127, F-129, Q-122. Also folds in a
  Matching-exercise UX fix (obvious selected state,
  instructions, column headers, wrong-pair shake, 8-lang
  strings). 7 atomic sub-phase commits (6 feature + 1 fix);
  every individually green through ``make test`` +
  ``npm run build`` + Vitest + ``make test-dexie-smoke``.
  **28 badges** in the catalog.
  v1.39.0 = Phase 56 (EXP-010
  Missionen und Plaketten, the active-motivation layer;
  shipped the missions subset, badge tiers deferred to
  v1.40.0). Daily missions: up to 3 deterministic,
  adaptive, achievable goals per day on the Dashboard,
  evaluated live against EXISTING data (LessonProgress /
  ElementError / streak) — no new tracking beyond one
  ``UserMission`` table. New ``missions`` plugin (13th):
  ``MissionTemplate`` Pydantic catalog (22 templates / 5
  categories in ``templates.yaml``, ``make sync-missions``
  → frontend bundle), seeded-PRNG adaptive generator
  (new/active/veteran eligibility, one pick per difficulty
  slot, no back-to-back repeats) + progress evaluator —
  both TS (Dexie, primary GH-Pages path) and Python (API
  mode, ``GET /today`` + ``POST /regenerate``). Only checks
  computable from existing data are assignable
  (``SUPPORTED_CHECK_FUNCTIONS``; 5 catalog entries stay
  un-assigned until tracking exists). Completion awards the
  template's bonus XP once (``xp_awarded`` guard, both
  modes) + fires the v1.38.0 celebration bus
  (``mission_complete`` + ``all_missions_complete`` sounds +
  a new ``mission_complete`` praise category + confetti
  all-clear). ``DailyMissionsCard`` dashboard widget;
  ``MissionSettingsControl`` (on/off, count 1-3, difficulty
  mix, reset) in the reorganized **tabbed Settings** page
  (Bibliogon pattern: General / AI / Learning / Plugins /
  Data / Help — all panels stay mounted, inactive ones
  ``hidden``, so deep links + testids keep working). New
  visual-only **Solo / Multiplayer mode indicator**
  (coming-soon, no infrastructure). Timezone-aware
  local-midnight rollover (uncompleted missions expire, NO
  penalty) + streak-joker. ``UserMission`` model + Alembic
  0021 + Dexie v20 + sync surface (MUTABLE) + a new
  ``missions`` ``IStorageService`` namespace (Dexie + Api).
  **Deferred to v1.40.0 / Phase 57:** badge tiers
  (bronze/silver/gold, EXP-010 56E) + the badge-gallery
  drawer (56G). 11 atomic sub-phase commits; every
  individually green through ``make test`` + ``npm run
  build`` + Vitest + ``make test-dexie-smoke``.
  v1.38.0 = Phase 55 (EXP-008 Lob
  und Celebration, the emotional layer). Everything
  mechanical already worked (error tracking, adaptive
  lessons, XP/badges) but the moment of success felt flat;
  v1.38.0 adds earned, scaled micro-feedback. New
  ``backend/config/praise/{8 langs}.yaml`` phrase catalogs
  (``make sync-praise`` → ``frontend/src/data/praise/``)
  with a no-repeat session phrase-picker. Shared
  ``AnswerCelebration`` across all 5 exercise types (haptic
  + intensity-gated praise + CSS pulse/flash/icon
  animations; wrong answers show the diff, never criticism).
  Lesson summary counts the score up, shows a per-star
  message, and on a perfect run adds a dynamic praise phrase
  + CSS-only confetti (30 particles, no canvas/library).
  Milestone overlays (streak 7/30/100, mastery 50/100/500,
  level-up) via a de-duplicating ``celebrationQueue`` +
  globally-mounted ``MilestoneHost`` (sequential, auto-
  dismiss). Settings > Interface gains a 3-level
  **Feedback Intensity** control (subtle/normal/
  enthusiastic, live, ``useFeedbackIntensity``) and a
  **Sounds** toggle + volume + Test (six runtime-synthesized
  Web Audio effects, zero audio files, OFF by default, lazy
  AudioContext). ``celebration-bus.ts`` is the decoupled
  dispatch (sound + subscribers + ``celebrate*`` milestone
  helpers); ``celebration-stats.ts`` snapshots gamification
  at lesson completion and celebrates milestones + new
  badges. "Best streak" reuses the maintained
  ``longest_streak_days`` (no migration). Full
  ``prefers-reduced-motion`` path (all animations off,
  effective intensity forced to subtle). All frontend-only,
  works in both storage modes. 8 atomic sub-phase commits +
  1 release; every individually green through
  ``make test`` + ``npm run build`` + Vitest +
  ``make test-dexie-smoke``.
  v1.37.0 = Phase 54 (Asset
  Fetching for Picture Choice Exercises). Picture Choice
  exercises stop being text-only: lesson sets can now ship
  binary images via a manifest-declared ``assets/``
  directory, with deterministic placeholder SVGs
  (multilingual colour swatches + large numerals + avatar
  fallback) as a backup for color / number / unknown
  labels, and a text-only fallback as the final safety
  net. Three modes — API, Dexie, and the GitHub Pages
  offline build — all support images end-to-end. New
  ``ContentSetAsset`` Pydantic model with strict path +
  extension + size validators (≤ 500 KiB per asset; soft
  warning for set total > 10 MiB; whitelist:
  ``.png/.jpg/.jpeg/.webp/.svg``, no GIF, no BMP). New
  Python ``cache.read_asset`` + service-layer asset fetch
  alongside lesson JSON. New TypeScript ``getAsset``
  namespace on ``IStorageService`` (ApiStorage → backend
  proxy; DexieStorage → IndexedDB blob via existing
  ``contentSetFiles`` table, no Dexie schema bump). New
  process-wide ref-counted blob URL resolver +
  ``useAsset`` hook with full lifecycle management
  (``URL.revokeObjectURL`` on final unmount, in-flight
  de-duplication for parallel resolves). New
  ``PictureChoiceTile`` sub-component with the 4-layer
  resolution chain (authored asset → legacy callback →
  placeholder SVG → text-only). New backend endpoint
  ``GET /api/plugins/content-loader/sets/{src}/{id}/assets/{path:path}``
  with immutable Cache-Control headers (versioned cache
  layout makes the URLs stable). Pilot content needs zero
  JSON changes — existing ``assets/img/...`` references
  fall through gracefully, and colour / number lessons get
  proper rendering from the placeholder generator
  automatically. Content-authoring guide extended in EN +
  DE with full asset format / sizing / placement
  documentation. 8 atomic sub-phase commits + 1 release;
  every individually green through the full gate chain.
  v1.36.0 = Phase 53 (EXP-013 Adaptive Lesson Generation).
  THE core promise of the application: the system now
  ADAPTS to the learner. Reads
  the per-element error history, identifies weakness
  patterns, classifies them in language-specific terms
  (article_gender / spelling_accent / verb_conjugation /
  word_order), and synthesises a personalised lesson on
  demand — all rule-based, deterministic, no AI calls, fully
  client-side so the GitHub Pages deployment works without
  an API key. New ``/adaptive-lesson/:setId`` route takes
  ``ElementError[]`` + cached content + the user's learning
  profile and emits a synthetic ``ContentLesson`` the
  existing viewer renders unmodified, with transparency
  display before the lesson (focus areas + source error
  count) and improvement indicator after (+N mastered this
  session). Dashboard gets a new FocusAreasCard widget
  showing the user's top focus elements + a "Start adaptive
  lesson" CTA. Six new TypeScript modules in
  ``frontend/src/lib/adaptive/`` (analyzer + pool builder
  + lesson generator + variation + classifier + types),
  Python parity for the analyzer pinned by JSON goldens.
  AI-augmented generation (EXP-013 Stufe 3 / P-150-P-152)
  deferred to a future phase; the rule-based pipeline is
  sufficient for the headline promise. Closes P-133, P-134,
  P-137, P-138, P-139, F-114, F-115, F-116, Q-114, Q-115,
  Q-116, D-110 (with P-140 tag persistence and the EXP-013
  Stufe 3 AI work split off as explicitly-deferred
  follow-ups). 10 atomic sub-phase commits + 1 release;
  every individually green through the full gate chain.
  v1.35.0 = Phase 52 (EXP-007 Token-Diff + Cloze Exercise
  Type). Wires token-level visual feedback into every
  existing exercise feedback surface, adds a fifth exercise
  type (Cloze / fill-in-the-blank) that auto-generates from
  a learner's specific mistakes, ships a lesson-end
  correction round that drills exactly the words the
  learner missed, and extends review sessions to vary the
  shape (cloze for free-text + word-tiles errors) instead
  of pure replay.
  Closes P-126 / P-127 / P-128 / P-130 / F-111 / F-112 /
  F-113 / Q-110 / Q-111 / Q-112 from the EXP-007 task list.
  Schema 1.0 → 1.1: ExerciseType gains CLOZE; new
  ``sentence`` / ``blanks`` / ``cloze_mode`` fields on
  Exercise (marker-based with visible ``___`` tokens, two
  render modes ``"type"`` + ``"select"``, per-blank SRS
  fan-out via ``deriveClozeAttempts``); optional
  ``token_roles`` annotation on Card with a closed enum of
  seven grammatical roles (article / verb / noun / adjective
  / preposition / gender_marker / tense_marker) for the
  cloze generator's role-aware blank selection. The
  generator (``generateClozeFromError``, deterministic + no
  AI) is consumed by both the correction round at lesson
  end AND ``synthesizeReviewLesson``'s per-item branch
  (free_text + word_tiles → cloze, matching + picture_choice
  → replay, generator failure → replay). LessonStepResult
  gains optional ``user_answer`` so the lesson summary's
  per-exercise breakdown renders the same token-diff as the
  inline wrong-answer surface. Plus one folded-in
  UX-critical bugfix: AI session bubbles now render Markdown
  via the existing react-markdown + remark-gfm pipeline
  (the HelpDrawer + LessonViewer pipeline) — pre-fix they
  rendered raw asterisks for ``**bold**``, raw pipes for
  tables, etc. 10 atomic sub-phase commits + 1 release +
  1 post-release; every individually green through the full
  gate chain.
  v1.34.0 = Phase 51 (Content Expansion: French A1 + Spanish
  A1 + GH-Pages bundling). First release where Adaptive
  Learner ships a real learning experience out of the box:
  15 A1-level language lessons across two pairs, bundled
  into the GitHub Pages build so first-time visitors see
  lessons immediately without any external content repo.
  v1.27.0 (Phase 43) shipped the content-loader
  infrastructure; v1.34.0 filled it with real pedagogically-
  progressive content.
  Phase 51A: 8 new French A1 lessons (3-10): articles,
  être/avoir, self-introduction, family, colors+clothing,
  restaurant, directions, passé composé. Phase 51B: 5 new
  Spanish A1 lessons covering greetings/intro, numbers+time,
  articles+gender, ser/estar (the A1 challenge with a worked
  decision rule), restaurant. All 15 lessons use 3-5 theory
  steps + 8-12 exercises mixing all 4 exercise types per
  lesson; new parametrized pytest at
  ``test_pilot_content.py`` discovers + validates every JSON
  file via glob. Phase 51C: content-authoring guide in EN+DE
  under ``docs/help/{en,de}/developer/authoring-content.md``,
  wired into _meta.yaml + mkdocs.yml. Phase 51D: build-time
  bundling via ``copy-bundled-content.mjs`` (predev /
  prebuild npm hook) + new ``bundled:`` source-prefix
  handling in ``content-loader-dexie.ts``. GH-Pages now
  works fully offline; canonical content stays in
  ``docs/explorations/sample-content/``. Plus a bugfix:
  session + lesson headers now show topic / set context
  (``Topic: ${project.topic}`` line in Session.tsx,
  ``Set: ${setTitle}`` line in Lesson.tsx) — multi-tab
  learners can finally tell at a glance which project /
  which set is open in each tab. 6 atomic content + bugfix
  commits + 1 release + 1 post-release; every individually
  green through the full gate chain.
  v1.33.0 = Phase 50 (Dexie-Mode Lesson-XP Parity + i18n
  Repo-Key Fix + Bibliogon-Residue Cleanup). Closed
  D-DEXIE-GAMIFICATION (open as a deferred-on-purpose gap
  since v1.31.0): Dexie-mode users at
  ``https://astrapi69.github.io/adaptive-learner/`` now earn
  lesson-XP + lesson-badges identical to API-mode users. TS
  port of ``compute_stars`` + ``calculate_lesson_session_xp``
  + ``current_streak_days`` + ``is_first_attempt`` from the
  Python xp_service under ``frontend/src/lib/gamification/``,
  wired through ``DexieStorage.lessonProgress.upsert`` so the
  in_progress→completed transition fires the award + badge
  evaluator. Cross-language parity-test methodology proven in
  Phase 49F applied a second time — both the lesson-XP rule
  and the streak/first-attempt helpers pinned to shared JSON
  goldens under ``tests/fixtures/lesson-xp-parity/``, **passed
  on the first run** byte-identically. 4 new lesson badges
  added to ``BUNDLED_BADGES`` (catalog now 28 entries).
  Also fixes a silent i18n bug since v1.26.0: the
  Learning Repository's 23 ``repo.action.*`` /
  ``repo.settings.toast.*`` / etc. dotted-path keys were
  stored as flat YAML and never resolved — every catalog
  fell through to the English fallback for ~6 release cycles.
  All 8 catalogs restructured; new Vitest regression-pin
  walks every dotted path the frontend calls and asserts
  resolution. Also: ``.claude/rules/`` swept of Bibliogon
  residue inherited from the fork (architecture.md rewritten
  end-to-end; lessons-learned.md 3415 → 1610 lines / 53%
  reduction; coding-standards + code-hygiene + quality-checks
  + release-workflow + ai-workflow + prompts/audit.md all
  cleaned of Book/Chapter/Pandoc/manuscripta/audiobook/KDP
  references). 14 atomic commits + 1 release commit; every
  individually green through the full gate chain.
  v1.32.0 = Phase 49 (Learning Repo Storage Abstraction).
  Closed PHASE-42-STORAGE-ABSTRACTION-01, open since v1.26.1:
  the Learning Repository feature now works in BOTH storage
  modes. GitHub-Pages visitors get the full render + ZIP
  download surface client-side instead of the v1.26.1 "only
  available in server mode" placeholder.
  Ports the Python renderer (~957 LOC across 10 modules) to
  TypeScript under ``frontend/src/lib/learning-repo/`` — 4
  meta-file renderers + topic-folder generator + RenderContext
  + Dexie loader + labels (reads bundled i18n) + thresholds.
  Cross-renderer parity proof: shared JSON fixture +
  golden Markdown tree, both renderers pinned, **passed on
  the first run** (byte-identical output). Adds 2 new
  ``IStorageService`` namespaces: ``pluginSettings`` (with
  bundled YAML defaults at
  ``frontend/src/data/plugin-config/*.json``, regenerated by
  new ``make sync-plugin-config``) + ``learningRepo`` (with
  JSZip client-side pack for export). Dexie schema v18 → v19
  (additive ``pluginSettings`` table). Removes the v1.26.1
  friendly-error fallback panels from
  ``LearningRepoSettingsSection`` + ``LearningRepo`` page +
  Dashboard widget. Git persist stays server-only (needs
  filesystem + git binary) — the button is disabled in Dexie
  mode with a friendly tooltip.
  v1.31.0 = Phase 46 sub-phases E-F-G (Gamification
  Integration + LessonProgress↔LearningSession Unification +
  Docs, EXP-007 / P-129; pseudo-project with
  ``kind="content"``, lesson-XP rule, 4 new badges including
  ``review_master``, frontend pseudo-project filter).
  v1.30.0 = Phase 46 A-D — Element-Level Error Tracking +
  SRS Review Sessions, EXP-007 / P-129 (every wrong answer
  writes a per-element ``ElementError`` row keyed by the
  specific word / pair / phrase missed; mastery flips at 3
  consecutive correct, demotes on wrong; new SRS scheduler
  with 1d/3d/7d bands; new ``/review/:setId`` route +
  Dashboard ``<ReviewQueueCard>`` widget; Alembic 0019 +
  Dexie schema v18 + ``IStorageService.elementErrors``
  namespace; expanded LessonSummary with 0-3 star rating).
  v1.29.0 = Phase 45 — Free-Text + Word-Tiles Exercises,
  EXP-002 Sprint 3 parts E-F (the v1.28.0 viewer now ships
  every exercise type the v1.0 lesson schema knows about;
  no backend / schema changes).
  v1.28.0 = Phase 44 — Lesson Viewer + Matching +
  Picture-Choice exercises, EXP-002 Sprint 3 parts A-D
  (new route ``/lesson/:setSlug/:setId/:filename``, the
  first two exercise renderers, new ``LessonProgress``
  model + Alembic 0018 + Dexie schema v17 + the
  ``IStorageService.lessonProgress`` namespace).
  v1.27.0 = Phase 43 — Content-Loader Plugin, EXP-002 +
  EXP-005 foundations). The app stops
  requiring an API key for the headline use case: the new
  ``/content`` page downloads pre-built lesson sets from
  public GitHub repos and caches them locally
  (filesystem in API mode, IndexedDB in Dexie/GH-Pages
  mode). The new ``adaptive-learner-plugin-content-loader``
  ships with a typed Pydantic v2 lesson schema v1.0
  (Lesson / LessonStep / Exercise / Card / ExerciseType
  enum), a manifest parser with forward-compat
  schema-version gating, a tokenless GitHub raw-URL
  adapter (optional token via three-layer secrets chain),
  an atomic version-reconciled cache, and FastAPI routes
  under ``/api/plugins/content-loader/*``. Frontend ships
  a new ``contentLoader`` namespace on ``IStorageService``,
  Dexie schema v16 with two new tables (``contentSets`` +
  ``contentSetFiles``), and the Set Browser page at
  ``/content``. App-mode badge in the nav (driven by
  ``useApiKeyStatus``) renders "AI+Content" vs "Content"
  so the user always knows which features are available.
  Pilot French A1 set (2 lessons / 14 cards / 9 exercises
  across all four ExerciseType variants) lives at
  ``docs/explorations/sample-content/fr-a1/``, ready to
  copy into the future
  ``astrapi69/adaptive-learner-content`` repo. v1.26.1
  (patch): closes the Phase 42 Dexie-mode crash (the
  ``LearningRepoSettings`` / ``LearningRepo`` page /
  Dashboard widget called ``api.*`` unconditionally and
  blew up on the GitHub Pages deployment with HTTP 404
  for every visitor). Three protection layers ship
  alongside the immediate fix: (1) **Developer Mode**
  toggle in Settings > Interface — off by default, when
  on shows full HTTP status / endpoint / stack in error
  toasts and a red DEV badge in the nav; (2) **friendly
  error mapping** so production users never see "HTTP
  404" / endpoint paths / stack traces — every
  ``ApiError`` now maps to a ``ui.errors.*`` i18n string,
  with eventRecorder still capturing full technical
  detail for the "Report Issue" GitHub-issue body; (3)
  **Dexie-mode release gate** (``make test-dexie-smoke``)
  — Playwright walks every nav-reachable route against a
  ``VITE_STORAGE_MODE=dexie`` build with no backend, any
  error toast or page crash blocks the tag. Aggregated
  into ``make release-test`` as MANDATORY. Bundle-size
  win as a side effect: route-level ``React.lazy()``
  drops the main chunk 2,137 kB → 838 kB and clears the
  Workbox 2 MB precache cap workaround. v1.26.0 = Phase
  42 (Git-Backed Learning Repository, BL-30): new
  ``learning-repo`` plugin emits per-project Markdown
  artefacts (README, LEARNING_STATS, CHEATSHEET, ROADMAP
  + numbered topic folders) from existing DB state via
  three endpoints — ``GET /api/plugins/learning-repo/render/{project_id}``
  (JSON), ``POST .../export-zip/{project_id}`` (ZIP), and
  opt-in ``POST .../persist/{project_id}`` which writes
  the tree to
  ``~/.local/share/adaptive_learner/repos/{project_id}/``
  and runs ``git commit`` with a semantic subject
  ("Cycle N — U X/10, T Y/10"). Tags
  ``cycle-{N}-mastered`` when the Article-1 § 8 exit
  threshold is met. Core endpoint
  ``/api/plugin-settings/{plugin_name}`` (GET + PATCH)
  backstops the architecture-rule "every non-INTERNAL
  setting MUST be UI-editable". v1.25.0 = Phase 41
  identity persistence + Danger Zone. See
  [changelog/releases/v1.41.0.md](changelog/releases/v1.41.0.md)
  for the per-release detail and `git log --oneline` for
  the feature history across Phases 1–57.
- **API reference:** FastAPI OpenAPI at `/api/docs` + `/openapi.json`
- **Configuration:** [docs/configuration.md](docs/configuration.md)
  (three-layer chain: env > `~/.config/adaptive_learner/secrets.yaml`
  > Fernet-encrypted DB column).
- **User + developer docs:** MkDocs site under `docs/help/{en,de}/`.

## Development guidelines

Detailed rules in `.claude/rules/`:

**Always relevant:**
- `architecture.md` — layered architecture, plugin structure, UI
- `coding-standards.md` — naming, function design, tests, deps

**On demand:**
- `code-hygiene.md` — linting, error handling, API conventions
- `lessons-learned.md` — known pitfalls
- `quality-checks.md` — test strategy, pre-commit checklists
- `ai-workflow.md` — feature/plugin order, docs protocol
- `release-workflow.md` — `make sync-versions` chain, tag pattern

On a conflict between this file and the rules, **the rules win**.

## Tech stack

- **Backend:** Python 3.11+, FastAPI ^0.136, SQLAlchemy ^2.0,
  Pydantic v2, Alembic, aiosqlite, cryptography (Fernet),
  platformdirs, pluginforge ^0.10.0, Poetry
- **Frontend:** React 19, TypeScript 6 (strict), Vite 8,
  Vitest 4, react-router-dom 7, react-toastify, Recharts 3,
  TipTap 2 (StarterKit + 15 extensions), Dexie 4 (IndexedDB),
  html5-qrcode, sql.js + jszip (Anki .apkg)
- **PWA:** vite-plugin-pwa, Workbox SW (NetworkFirst on GET
  `/api/`), SVG + maskable PNG icons
- **Testing:** pytest ^9, Vitest 4 (happy-dom), Playwright (E2E)
- **Tooling:** Poetry, npm, Docker, Make, ruff, pre-commit
- **Node engine:** ≥24.0.0

## Architecture (short)

4 layers: Frontend → Backend → PluginForge → Plugins. Backend
exposes core (users / projects / settings with `key_source_*` /
backup / export / sync / system) + plugin routes (assessment /
session with streaming + pronunciation / tracking / tools /
imports / curriculum / lessons / anki / gamification /
notebooklm). Frontend renders its routes via React Router:
Landing, Onboarding, Assessment, Dashboard, Session, Curriculum,
Progress, Settings, Import, ImportDetail, Anki, Pronunciation,
Content, Lesson, Review, AdaptiveLesson, LearningRepo,
CreateLesson (Phase 65 / EXP-021 — the standalone 4-step Lesson
Creator at ``/create-lesson``),
LearningPath (Phase 66 / EXP-022 — interactive @xyflow/react
graph at ``/learning-path``), NotFound.

**Dual storage** (since v0.7.0): `IStorageService` interface with
two implementations. `ApiStorage` talks to the FastAPI backend
(default); `DexieStorage` keeps everything in browser IndexedDB
with browser-direct AI provider calls. Settings toggle picks the
mode at startup (reload required to switch).

**Key resolution** (since v1.20.0 / Phase 34): every AI call
walks env > `~/.config/adaptive_learner/secrets.yaml` >
Fernet-encrypted DB column > none. Settings UI shows the per-
provider source ("Key from: secrets.yaml" / "environment" /
"Settings") and disables the input when externally managed.

## Commands

```bash
make install          # Poetry + npm + plugins
make dev              # backend (18001) + frontend (15174)
make dev-bg / dev-down
make test             # backend + plugins + Vitest (no coverage)
make test-backend     # pytest backend only
make test-plugins     # all 11 plugin test suites
make test-frontend    # Vitest only
make test-coverage    # opt-in coverage (CI runs the equivalent)
make prod / prod-down # Docker Compose
make clean / help
make sync-versions    # propagate backend/pyproject.toml to all 18 version-bearing files
make sync-i18n        # regenerate frontend/src/data/i18n/*.json from backend YAML
make docs-serve / docs-build  # MkDocs site (port 8000)
make archive-task     # interactive: move closed backlog items to roadmap-archive/YYYY-MM.md
```

E2E tests: `cd e2e && npx playwright test` (NOT on the `make test`
default path).

## Session start (Claude Code)

1. `git log --oneline -10` — recent changes
2. `make test` — green baseline
3. Read this file + relevant `.claude/rules/` per the task

## Data model

**30 SQLAlchemy models** in `backend/app/models/__init__.py`:

User, UserSettings, ApiKeyBackup, LearningProject,
LearningProfile, Curriculum, LearningTopic, Lesson,
LearningSession, SessionMessage, SessionRating, SessionNote,
ProgressCommit, StepEvaluation, MethodSwitch,
ImportedConversation, ImportedMessage, Subject, Tag,
ProjectSubject, ProjectTag, UserXP, Badge, UserBadge,
UserStreak, AnkiCardSuggestion, StudyQuestion, LessonProgress,
ElementError, UserMission.

Mirrored Pydantic v2 schemas in `backend/app/schemas/`. Sync
surface: 30 tables (`sync_service.ALL_SYNC_TABLES`). Full spec in
[docs/adaptive-learner-project-reference.md](docs/adaptive-learner-project-reference.md).

## Plugins (13 shipped)

All under `plugins/`. Routes mounted at `/api/plugins/<name>/*`.

| Plugin | Routes | Purpose |
|---|---|---|
| ai-anthropic | hook-only | `ai_complete*` provider for `claude-*` |
| ai-openai | hook-only | `ai_complete*` provider for `gpt-*` |
| ai-gemini | hook-only | `ai_complete*` provider for `gemini-*` |
| assessment | /questions, /evaluate, /profile/{id} | 12 questions, 6-method weights |
| session | /start, /{id}/message, /message/stream, /rate, /end, switch, /pronunciation/* | 7-step cycles, dual-prompt eval, streaming, auto-loop |
| tracking | /progress/{id}, /commits/{id} | ProgressCommit writer + dashboard aggregator |
| tools | /recommendations/{id}, /spaced/{id} | Method-tailored tool list + spaced practice |
| gamification | /xp/*, /badges/*, /streak/*, /reset | XP/level, badge catalog, streak heatmap |
| anki | /cards CRUD, /extract/{session,conversation}, /mark-exported | AI-extracted flashcards + .apkg export |
| notebooklm | /questions CRUD, /generate/{session,project}, /study-guide/{id} | Active-recall questions + study guide + ZIP export |
| learning-repo | /render/{id}, /export-zip/{id}, /persist/{id} | Article-3 Git-backed Learning Repository (Markdown artefacts + opt-in `git commit` + `cycle-N-mastered` tags) |
| content-loader | /sets, /sets/{src}/{id}/download, /sets/{src}/{id}/lessons[/{filename}] | EXP-002 — downloads structured lesson sets from public GitHub repos, caches locally (FS + Dexie). Foundation of the v1.27.0 no-API-key path. |
| missions | /templates, /today/{user_id}, /regenerate/{user_id} | EXP-010 — daily missions: deterministic adaptive per-user/per-day goals (static catalog) evaluated against existing data; `UserMission` is the only new table. |

All 10 hooks live in `backend/app/hookspecs.py`:
`get_assessment_questions`, `calculate_profile`,
`create_session_prompt`, `ai_complete` (sync, firstresult),
`ai_complete_async` (v1.5.0+), `ai_complete_stream` (v1.6.0+),
`recommend_method_switch`, `on_session_complete`,
`get_progress_summary`, `get_tool_recommendations`.

## Directory structure (top level)

```
adaptive-learner/
├── backend/app/           FastAPI app, routers, services, models, hookspecs
├── backend/config/        app.yaml + i18n/ (8 catalogs)
├── backend/tests/         pytest backend suite
├── plugins/               11 plugin packages
├── frontend/src/          api/, chat_import/, components/, hooks/, lib/,
│                          pages/ (13 routes), storage/ (IStorageService +
│                          ApiStorage + DexieStorage, 22 namespaces),
│                          data/ (Dexie bundles), types/, styles/
├── e2e/smoke/             Playwright smoke specs (16 spec files)
├── launcher/              PyInstaller cross-OS launcher
├── docs/                  audits/, manual-tests/, help/ (MkDocs DE+EN), configuration.md
├── changelog/releases/    per-release notes vX.Y.Z.md
├── scripts/               sync_versions, sync_i18n, anonymize_chat_export, ...
└── Makefile, docker-compose.yml, install.sh, install.ps1
```

## Core conventions

- i18n catalogs: `backend/config/i18n/{lang}.yaml` for 8 langs
  (DE, EN, ES, FR, EL, PT, TR, JA), all fully translated.
  `make sync-i18n` mirrors to `frontend/src/data/i18n/*.json`.
- German content uses **real umlauts** (ä, ö, ü, ß) in
  `de.yaml`, `docs/help/de/**`, plugin German content. ASCII
  in code identifiers + filenames. See lessons-learned.md.
- Python: type hints, snake_case, Pydantic v2, SQLAlchemy 2.0
  mapped columns.
- TypeScript: strict mode, no `any` without comment.
- CSS: custom properties; 6 self-contained themes via
  `[data-theme]` (light/dark/ocean/forest/high-contrast/sepia)
  + auto. Canonical tokens in `styles/themes/theme-*.css`; every
  theme defines the full set. No hardcoded colors in components.
- Commits: English, conventional (feat/fix/refactor/docs).
- E2E: `data-testid` selectors only.
- **Secrets**: never in committed config. Three-layer chain:
  env > `~/.config/adaptive_learner/secrets.yaml` > Fernet-
  encrypted DB. App fails hard if `ADAPTIVE_LEARNER_SECRET_KEY`
  is unset (no silent generated default).

## Tests

- `make test` must stay green after every change.
- **v1.53.1 baseline:** backend 1125 + plugins
  1009 + Vitest 3045 = **5179 tests**. E2E
  smoke (17 spec files) runs separately via
  `cd e2e && npx playwright test`. **Dexie-mode release
  gate** (23 specs incl. the Phase 61 interactive journeys —
  full lesson playthrough across all 5 exercise types,
  Content Browser tree + language filter, adaptive lesson —
  plus /import/:id and the Phase 49 Learning Repository
  surface that renders client-side) runs via
  `make test-dexie-smoke`; aggregated into
  `make release-test` so a red gate blocks the tag.

## Test isolation

Two layers in `backend/tests/conftest.py`:

1. `ADAPTIVE_LEARNER_TEST=1` + tmp `ADAPTIVE_LEARNER_DATA_DIR` set
   BEFORE any `app.*` import; SQLite in-memory.
2. Production data dirs carry a `.adaptive-learner-production`
   marker. If a test sees it, the run aborts (`returncode=2`).

Use the `app.paths` helpers (`get_data_dir`, `get_config_dir`,
etc.); CWD-relative `Path("...")` and frozen module-level path
imports are forbidden.

## Pre-commit hooks

`cd backend && poetry run pre-commit install`. Hooks: standard
whitespace + YAML/JSON checks, ruff (`--fix` + format),
`roadmap-archive-reminder` (non-blocking), and
`plugin-lock-paired-with-pyproject` (blocks staged plugin
pyproject changes without a paired `poetry.lock`).

## Related projects

- [pluginforge](https://github.com/astrapi69/pluginforge) — plugin framework (PyPI)
- [bibliogon](https://github.com/astrapi69/bibliogon) — upstream book-authoring application; adaptive-learner inherited its plugin infrastructure + test discipline + launcher shape, then diverged on domain entirely
