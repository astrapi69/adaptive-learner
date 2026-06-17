# Adaptive Learner Backlog

Daily-planning view of items outside the phase plan. The
authoritative roadmap lives in [ROADMAP.md](ROADMAP.md); use
this file for granular items + status.

## Strategic Expansion: Content-Repository MVP

> **EXP-023 Phases A + B + C slice SHIPPED (v1.67.0; #118 / #122 / #124).**
> Phase A: one user content repository (connect / validate / sync / cache /
> browse, both modes). Phase B: **multiple** repos (list / add / remove /
> reorder = precedence, legacy single-repo migrated), share via `/add-repo`
> deep link + QR, automatic technical validation (Trust 0→1, re-checked each
> sync), per-repo source filter, and private/coach repos via a per-repo
> token. Official repo stays the default + non-removable. Phase C slice: a
> curated `recommended-repos.json` drives a discovery section + one-click add
> + an "Officially recommended" (Trust 3) badge, plus local-only per-repo
> star ratings (the discovery fetch is gated until the catalogue is
> published — see commit 70108061). **EXP-025 (author-provided lesson sets):
> AUTH-01 (book-metadata schema + validator, #529) + AUTH-02 (book-companion
> rendering, #531) SHIPPED.** **EXP-026 (fold user lessons into the content
> tree): UGC-01..07 SHIPPED (#97).** Still deferred (need a shared backend):
> community ratings, Trust 2 (community-verified), central index server,
> coach progress aggregation, one-time invite tokens, Share-Wizard
> direct-push, and AUTH-03+ (cross-repo author publishing flow).
> See [EXP-023](explorations/EXP-023-multi-content-repository.md).

See [docs/explorations/](explorations/) for the full strategic plan:

- [EXP-INDEX.md](explorations/EXP-INDEX.md): 25 explorations overview
- [BACKLOG.md](explorations/BACKLOG.md): 223 tasks across 5 phases
- [ROADMAP-PHASE-1-VORSCHLAG.md](explorations/ROADMAP-PHASE-1-VORSCHLAG.md): Sprint plan for Phase 1

This expansion transforms Adaptive Learner from an AI-chat-only
tool into a full learning platform with downloadable content
sets, interactive exercises, and dual-mode operation
(Content-only + AI-augmented).

State: **post v1.84.0 (maintenance: P1 content-repo import CORS-safe + retry + progress + dialog a11y #645; P2 inline Markdown in exercise prompts + labels #647; P2 clickable Settings profile picture with preview dialog #639; P2 backup import declines foreign JSON files gracefully #643/#641; user-repo import E2E test #637; EXP-031 ZIP-backup-format design exploration #644; no schema/API/data change; see changelog/releases/v1.84.0.md); prior post v1.83.0 (maintenance + gap-hardening: P1 review-session fix — Enter + element de-dup + live XP badge #631; P2 theory markdown-table styling #633; P2 theory back-link by topic #635; gap-hardening audit #630 — cloze Tab nav #623, hints feature-not-available policy #624, Dashboard favorites Top-5 cap #625, review "repeat in 2 days" #626, free-text "Fast! Achte auf:" typo hint #627, Dashboard Quick-Review button #628; no schema/API/data change; see changelog/releases/v1.83.0.md); prior post v1.82.0 (hint economy with XP cost + SRS impact + statistics #611 (Alembic 0030); smart review queue — weakness tiers + attempt history + cross-lesson mix capped at 20 #612 (Alembic 0031); PWA update prompt — polled version.json + SW prompt mode #614; Test Impact Analysis on PR CI — vitest --changed + pytest --testmon, full suite nightly + release #617; architecture-doc audit #620; recommended-repos discovery E2E reactivated #610; manual test plan automated — 52 Playwright specs across 7 sessions + nightly workflow #621; additive Alembic 0030+0031 on element_errors, Dexie schema unchanged; see changelog/releases/v1.82.0.md); prior post v1.81.0 (biggest feature release: Learning Statistics #584, SRS viz #592, staged hints #595, favorites #598, review UX #602, Dashboard gamification #583, lesson UX #589, offline UX #605, keyboard shortcuts #587, Hindi UI #571, LanguagePicker #568, event recording EXP-028 #566, avatar crop #560, Settings sidebar #549, editable username #579, gamification API #573, recommended-repos live #574, 20+ shared/ components; CI night-shift #552/#576; starlette CVE #607; EXP-027..030 docs; see changelog/releases/v1.81.0.md); prior post v1.80.0 (EXP-026 user-lesson folding into the content tree #97 + EXP-025 book companion #142 (AUTH-01/02) + user profile picture #508 + localized split titles #512 + a11y #514/#515 + maintenance #511/#537/#540/#541; see changelog/releases/v1.80.0.md); prior post v1.79.0 (minor: XP visibility #505/#510 + bidirectional matching selection #507/#509 + complexity burn-down complete (final offender #497, baseline empty) + radon hard gate Phase 2 #494/#495 + plugin-tests CI job (1018-test suite) #471 + reusability policy + shared primitives #474/#477 + P1 matching duplicate-pair scoring fix #480/#481; no schema/API/data change; see changelog/releases/v1.79.0.md); prior post v1.78.0 (maintenance/code-hygiene: complexity burn-down under the Phase 2 hard ratchet #408; the 1156-line session routes.py split #412 (last backend cohesion-baseline entry; .filesize-baseline now empty); a behaviour-preserving burn-down batch #416-#460 (LessonPage 67->12, ImportDetail 58->18, backup-diff previewRow 54->3, buildContentSetRow 49->13, ApiKeyRow 45->9, MatchingExercise 45->17, build_analysis_context 33->3, formatEventLog 40->4, NextStepSuggestions 36->14, plus the CCW frontend batch); two governance rules - Release-Freeze #410 + No-Amend-on-open-PR #412/#414; two flaky-test fixes - lesson-tts #165/#425 + pytest-randomly reactivated #426/#429; EXP-025 (Refs #142) + EXP-026 (Refs #97) design docs; no schema/API/data change; see changelog/releases/v1.78.0.md); prior post v1.77.0 (architecture release: the three-phase Dexie read-modify-write data-integrity remediation #390 -> #395/#398/#402; completion of the god-file decomposition across backend + frontend #341/#353/#354; three warn-only CI watchers - cohesion #371, security-scan #378, complexity #405; the Vibe Coding Policy #383; backend parameter-dataclasses #376/#382; a feature-state policy #336; the gitflow branching model #334; an npm-audit fix #379; no schema/API/data change; see changelog/releases/v1.77.0.md); prior post v1.76.0 (maintenance: a useControlledExercise hook + a shared ExerciseFooter remove ~300 lines of lifecycle duplication across all 5 exercise renderers, zero behaviour/test change #322/#323-#328; the per-user backup/sync ownership check deduplicated into one canonical pair in sync_service (row_belongs_to_user + record_belongs_to_user) - security-directional drift closed, behaviour-preserving on all reachable data since every mapped user_id is non-nullable #329/#330; both backup buttons unified onto one saveBackupToDisk helper with a cross-component parity test #331/#332; TTS no longer reads raw Markdown aloud #320/#321; the Dexie-mode CI gate runs in the mcr.microsoft.com/playwright container instead of the hanging cdn.playwright.dev download #317/#319; the misconfigured prettier-frontend hook removed #316/#318; content-set download accepts the content repo's optional domain_label field, fixing a 400 on the psychology set #333; no schema/API/data change; see changelog/releases/v1.76.0.md); prior post v1.75.0 (minor - TipTap editor stack migrated v2 -> v3: the whole @tiptap/* stack (23 packages) bumped 2.27.2 -> 3.26.1 in one atomic change #311/#314 (a mixed v2/v3 tree does not compile - the failure mode that defeated the prior piecemeal Dependabot bumps and prompted the major-hold); only the v3 breaking-API deltas as code changes, verified against the installed 3.26.1 packages - TextStyle/Table default -> named imports, StarterKit's bundled Link/Underline disabled, setContent({emitUpdate: false}), generic NodeViewContent<"code">; 3953 vitest + 88 dexie-smoke green, zero test changes; Dependabot @tiptap major-hold removed #305/#306; pre-existing @eslint/js-10 no-useless-assignment break fixed in 5 files #312/#313; the two migrated editor files restored to the repo 4-space style after an inadvertent prettier reformat #315; no schema/API/data change; see changelog/releases/v1.75.0.md); prior post v1.74.0 (maintenance/infrastructure: 438 ESLint warnings cleared + gate tightened to --max-warnings 0 so Frontend Tests CI is green again #220/#292; dexie-smoke E2E CI workflow #301/#302; @tiptap/* reconciled to a consistent v2 tree (2.27.2) #304 + Dependabot @tiptap major-hold #306; CI installs with --legacy-peer-deps #293/#294; Dependabot bumps - feature-strategy 0.1.1 / @types/node 25 / @vitejs/plugin-react 6 / @eslint/js 10 / ruff / minor-patch groups #295-#300, #307-#310; visual baselines unchanged; see changelog/releases/v1.74.0.md); prior post v1.73.0 (minor - feature-strategy integration: central registry + strategy replaces ad-hoc API-key gating with active/disabled/hidden states + a reactive {mode, hasAiKey} context (#287); E2E feature tests - content-repo import #278, Anki #279, NotebookLM #280; NotebookLM AI buttons key-gated #281; TipTap extensions pinned back to 2.27.2 to fix the v3/core-v2 MISSING_EXPORT build break #267/#288; Progress.test wrapped in TestFeatureProvider #289/#290; dependency bumps #258-#266; see changelog/releases/v1.73.0.md); prior post v1.72.2 (patch — Import-Detail + Import inline styles -> token-backed Tailwind #275; Anki empty state with icon/title/body/import-CTA/API-key-notice in 8 langs #276; all 3 frontend import cycles resolved via pure type modules (content-validation-types / storage/export-types / api/request-types), madge 0, check-circular baseline 3->0 #252; see changelog/releases/v1.72.2.md); prior post v1.72.1 (patch — dark-theme button-background fix #271 (raw <button> no longer inherits UA buttonface ~#efefef on dark themes; base-layer background-color:transparent, the unfinished half of v1.71.0's #185) + 5 serious axe a11y fixes #273 (aria-progressbar-name on mission/XP bars, nested-interactive on the ProfileRadar role=img wrapper, listitem on Content knowledge groups, color-contrast via #271 — 0 violations on all 7 audited routes) + visual lesson-matching baselined via lesson-check #270 + the axe suite now runs via browser.newContext() #272; see changelog/releases/v1.72.1.md); prior post v1.72.0 (minor — CI/quality-infrastructure build-out: ESLint (#222), security scanning (#224), coverage floors (#225), madge circular-dep guard (#251), Dependabot (#253), Prettier step 1 (#254), bundle analyzer (#255), Stylelint (#257), Playwright visual regression (#244) + axe-core (#246); plus dark-theme contrast/layout + Import-Detail UX fixes (#226/#228/#230/#232/#234/#236/#238/#240/#242); see changelog/releases/v1.72.0.md); prior post v1.71.1 (patch: dark-theme contrast & spacing sweep + Session-Detail export fix #209 + bare .btn base colour #211; see changelog/releases/v1.71.1.md); prior post v1.71.0 (minor: clearer Matching result feedback - wrong pair shows "Deine Antwort" (red/X) + "Richtige Antwort" (green/bold/check) on separate lines, correct pair confirms "A -> B" with a green check, new your_answer + reworded correct_hint i18n in 8 langs via AA-pinned matching tokens (#191); Enter works in the lesson-end correction round (CorrectionBlock) via a controlled cloze + shared useLessonEnterKey hook (#187); systematic dark-theme button contrast - base-layer button{color:inherit} so raw buttons stop falling back to UA black with preflight off, losing to explicit text-* utilities (#185); content-repo token password input wrapped in a form (#119); test isolation - content-loader cache reset between tests fixes the flaky cross-identity backup round-trip under pytest-randomly (#164) + lesson-tts Dexie-gate spec headroom/retry (#165); content fix - Miller "7 ± 2" cloze accepts keyboard-typeable +/- forms (content #33); see changelog/releases/v1.71.0.md); prior post v1.70.2 (patch: theme contrast + Matching-exercise fixes - soft-pop secondary button white-on-teal fixed + every button-variant colour pair pinned across 12 themes (#179); red removed from Matching pair colours via a dedicated red-free --matching-pair-1..7 palette (#181); Matching result state distinguishes correct/wrong pairs - badges persist, correct green both tiles, wrong red both tiles + correct-partner hint, unmatched neutral, new per-theme --matching-correct/-error tokens AA-verified (#183); see changelog/releases/v1.70.2.md); prior post v1.70.1 (patch: onboarding / assessment / content-browser / landing UX fixes - uniform onboarding-wizard step height (#169); assessment first-step "Continue later" exit + replace-navigation history fix so browser-back doesn't land on the onboarding form (#171); landing docs link opens in a new tab (#173); onboarding Name -> Topic tab order, Topic help icon out of the tab order (#175); Content Browser secondary buttons ghost -> outline so they stay visible at WCAG AA in dark themes (#177); see changelog/releases/v1.70.1.md); prior post v1.70.0 (minor — first-run backup restore on an empty install (#150) + a comprehensive v1.61-v1.69 MkDocs documentation overhaul in all 8 languages, deployed at https://astrapi69.github.io/adaptive-learner/docs/ (#157) + context-sensitive in-app help (the nav "?" opens the current view's entry, help articles gain a "Learn more" link to the docs site, 9 new glossary terms in all 8 languages) (#159) + a manual pre-release QA test plan at docs/MANUAL-TESTPLAN.md; see changelog/releases/v1.70.0.md); prior post v1.69.0 (minor — theory example links (#139) + per-domain book recommendations (#141) via Sprint 2 (#153); Enter-key shortcut in the Error-Replay runner via a shared useLessonEnterKey hook (#154); backup-restore title fix — restore parses the manifest sets[].title so a restored set keeps its title (not the analysis-<uuid> set_id) + step progress (#134), proven by a real export->import round-trip; see changelog/releases/v1.69.0.md); prior post v1.68.0 (minor — lesson-result export + theory back-links (#138/#140); matched-pair color + number-label overhaul (#145); dark-mode contrast fixes — button-styled anchors keep their variant color (#146) + outline/ghost buttons set an explicit foreground (#148); read-aloud no longer reflows the theory panel (#147); domain-aware matching wording for knowledge lessons (#149); search-icon-right + uniform exercise-card heights (#143); About AI-assistance credit naming Claude (Anthropic); see changelog/releases/v1.68.0.md); prior post v1.67.1 (patch — restored user-generated lessons keep their title + step progress: Dexie-origin user sets store the title in the contentSets row with no manifest.yaml, so the API restore landed them manifest-less (Dashboard showed the set_id, step count collapsed to "Fortsetzen"); restore now synthesises a one-set manifest from the backup metadata (#134); + EXP-024 Phase 1 backend repository-pattern refactor, internal only (#133); see changelog/releases/v1.67.1.md); prior post v1.67.0 (backup is a complete self-contained snapshot + EXP-023 user content repositories: full 30-table export (empty=[]) + restore logging + scrollable per-table import summary + persistent error toasts (#126); subjects reconcile by (parent_id,name) (UNIQUE + Alembic 0028 dedup, null-aware root match, self-ref remap) — no fresh-install taxonomy duplication (#127); cross-identity re-home so a prior-identity backup lands, 0 errors vs 192 (#129); downloaded content sets travel in the backup (wire 1.3.0, both modes) so restored lessons open + user-generated sets aren't lost (#130); EXP-023 multi user content repos A/B/C (#118/#122/#124); Chrome password-form console cleanup (#119); new BACKUP-AKZEPTANZTEST gate; see changelog/releases/v1.67.0.md); prior post v1.66.0 (maintenance — systematic backup-restore fix (generic unique-key matching for 13 non-id-UNIQUE tables + FK-graph child remap + placeholder reclaim; JSON serialization for dict/list values in Text columns, fixes `type 'dict' is not supported`; empty-table skip on export+import; verified end-to-end through the real backup API) (#115, #117); GH-Pages stale-deploy chunk-reload via `lazyWithReload` + `cleanupOutdatedCaches` (#113); subject-filter UX — hide at <=1, most-used-first, category groups above 5 (#111); see changelog/releases/v1.66.0.md); prior post v1.65.0 (resumable assessment — abandon-and-resume with project-scoped localStorage progress + Dashboard/Settings Continue/Create/Retake invites, cleared on completion (#106); Enter-key lesson shortcut — check then advance, free-text/cloze submit on Enter, Settings>Learning toggle (#103); design-token architecture — `global.css` colors routed through tokens + `no-hardcoded-colors` guard extended to CSS + Tailwind palette + `docs/DESIGN-TOKENS.md` (#101); matching exercises — blue/green side tints + A/B chip via `color-mix()` tokens, AA-verified (#108); fix — assessment result radar/badge overlap (#105); see changelog/releases/v1.65.0.md); prior post v1.64.0 (onboarding overhaul — a two-field quick start (name + topic, the rest defaulted) + an optional one-question-per-screen profile wizard (`OnboardingWizard`: goal / timeframe / daily minutes / current problem / opt-in assessment), assessment now OPT-IN ("Jump right in" -> Dashboard; assessment only from the wizard's last step) (#92, #94); fixes — Content Browser single scrollbar (`html`/`body` lock both axes so `#root` is the sole scroll container) (#42) + sticky lesson footer pinned across steps (`lesson-page` fills the viewport, step grows `flex-auto`; regression pin `e2e/dexie/lesson-footer-stability.spec.ts`) (#43) + a WCAG contrast pin for `--accent`-as-text + a catppuccin-mocha nudge so all 12 themes pass computationally (#96); see changelog/releases/v1.64.0.md); prior post v1.63.0 (6 recommended WCAG-AA theme presets + systematic i18n audit (#80 — `subjects.*` data-i18n for 77 seeded names + 92 missing `t()` keys incl. the whole `editor.*` toolbar, all 8 langs) + dashboard subject filter scoped to the user (#72) + theme/i18n fixes (#82/#84/#87); see changelog/releases/v1.63.0.md); prior post v1.62.0 (backup-restore data-integrity hardening (#57 datetime coercion + #64 orphan-FK-skip) + GitHub-Pages build provenance (#66) + content cache-bust (#62) + UI/i18n conformance (#51/#55/#76/#53/#68/#78/#69) + `.claude` governance + Bibliogon templates/labels; see changelog/releases/v1.62.0.md); prior post v1.61.0 (app-wide shadcn button conformance (~200 buttons across 13 page areas) + lesson resume-at-paused-step (LessonProgress.current_step, Alembic 0027 + Dexie) + cross-repo content validation (validate_bundled_content.py + a Content-stats CI gate + README CONTENT-STATS block, 330 lessons / 16 sets) + backup-restore fixes (badges.key natural-key upsert + user_badges.badge_id remap, FK-topological _RESTORE_ORDER, imported_conversation_id in backup columns); see changelog/releases/v1.61.0.md); prior v1.60.0 (lesson-reading UX + Learning Path Achievement Map + Tailwind exercise renderers + help-glossary perf + B1 content complete: auto-hide lesson header on scroll (useScrollDirection on #root, motion-safe Tailwind transform, sticky footer stays); Learning Path Map view (domain-grouped; 3 views: Persönlich / Map / Graph); Settings icon-only mobile buttons; all 5 exercise renderers migrated to Tailwind (~85-90 %) + theme audit (43-token parity, themed Dialog overlay) + dead-CSS removal; help glossary lazy per language (main index chunk 731->449 KB raw / 245->138 KB gzip, PERF-HELP-GLOSSARY-LAZY-01); same-language imports auto-detected as knowledge domain (Save stamps lesson domain, Share Wizard inherits the pair; E2E variant 2 un-fixme'd) + Dexie async-load wizard fix + github_service mypy cast; B1 content complete — de->es/en/fr B1 (15 each), 271 lessons / 13 sets / ~66 h); prior v1.59.0 (Learning Path Redesign — personal path with zoom levels: two-level view replaces the all-225-lessons xyflow graph as the default (Level 1 set rows sorted by last activity with progress dots + action; Level 2 accordion lesson detail with stars/mastery/dates + adaptive/retry-errors); "Nur meine" / "Alle Sets" filter + collapsible not-downloaded section, both persisted; next-CEFR-level offer on completion; xyflow kept as a lazy-loaded alternative view, removed from the default bundle; nav hamburger moved left on mobile); prior v1.58.0 (user-centric UX overhaul: Continue Learning ("Weitermachen") section on the Content Browser + Dashboard surfacing the most recently-touched lesson per set; Content Browser reordered search-first with icon-only mobile action buttons; Dashboard reordered Continue-Learning-first; responsive icon/text button pattern); prior v1.57.0 (community PR automation — fork -> commit -> PR for community sharing, GitHub PAT in Settings -> Integrations; Content Browser instant search; Tailwind Phase D; psychology to 90 lessons); prior v1.56.0 (performance + PWA hardening: ~460 KB gzip saved via lazy i18n catalogs + curated highlight.js, bundle audit, Dexie/backend queries verified healthy; offline indicator + network-aware buttons, background-sync queue, cache-management UI, install prompt, API-mode lesson caching; carries the Tailwind/shadcn migration Phases B-D + backend rate-limiting/OpenAPI; restored per-theme read-aloud in Dexie mode); prior v1.55.0 (Tailwind CSS v4 + shadcn/ui foundation (Phase A) + Error Replay; prior v1.54.0: import-time language pipeline + big content release; prior v1.53.0: content schema v1.3 + Python course +
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
[changelog/releases/](../changelog/releases/). 30 tables on
the sync surface. 13 plugins, 30 SQLAlchemy models,
1215 + 1018 + 4139 = 6372 tests green
(backend + plugins + Vitest; verified 2026-06-15). Closed in this release line: BL-04 (QR scan,
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

- [x] **#508 — User profile picture** — SHIPPED on `develop` (#535), pending
  the v1.80.0 release. Avatar in nav + About + Dashboard (`InitialsAvatar` +
  `AvatarUpload` shared primitives), both storage modes; no backend account
  system. Closed 2026-06-15.
- [ ] **BACKEND-RADON-REMAINDER-01**: opportunistic backend complexity
  burn-down for any module still above the radon warn band (cc > 15) now
  that the Phase 2 hard gate (#494/#495: blocks cc > 20, warns > 15) is
  live and `.complexity-baseline` is empty. No grandfathered offenders
  remain; this is for new warn-tier functions as they surface. Opportunistic.
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

- **AUTH-03+ — cross-repo author publishing flow** (EXP-025): the
  remaining author-companion scope beyond AUTH-01/02 (#529/#531, shipped) —
  publishing/maintaining a book companion repo across repositories. Needs
  shared-backend / cross-repo infrastructure (same dependency as the EXP-023
  deferred set: community ratings, Trust 2, central index, coach
  aggregation). Deferred until that infrastructure lands.
