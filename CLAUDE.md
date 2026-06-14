# Adaptive Learner

Adaptive learning platform implementing the six-method learning
model (Asterios Raptis, *Von Theorie zur Praxis*, Medium series).
A complete, plugin-driven application: assessment, 7-step learning
sessions across 6 methods, streaming AI replies via 3 providers,
chat-history import + analysis, multi-cycle auto-loop, dual storage
(SQLite + browser IndexedDB), local-network sync, file-based key
configuration, gamification, voice, Anki + NotebookLM exports, PWA.

- **Repository:** https://github.com/astrapi69/adaptive-learner
- **Current state:** **v1.79.0** (minor release -
  **XP visibility + bidirectional matching + complexity burn-down complete**:
  two user-facing features land on the maintenance thread. **XP visibility**
  (#505/#510) surfaces points where the learner sees them - a persistent header
  badge (`NavXpBadge`, both storage modes via `gamification.getState`, live on
  route change / focus / XP-affecting celebrations) + a `+N XP` lesson-summary
  reward pill computed with the same parity-tested formula the award path uses;
  built on a new generic props-driven `shared/XpBadge`. **Bidirectional matching
  selection** (#507/#509) lets the learner start a pair from the B (right)
  column, not only A->B. The **complexity burn-down is complete** - the
  `validateGeneratedLesson` split was the final offender (#497) and the last
  baseline entries dropped (#498-#504); `.complexity-baseline` is empty. The
  **radon hard gate is Phase 2** (#494/#495: blocks cc > 20, warns > 15), a
  **plugin-tests CI job** runs the full 1018-test plugin suite (#471), and a
  **reusability policy** (#474/#477 + `.claude/rules/reusability.md`) governs the
  first extracted `shared/` primitives (ListRow #460, ProgressBar #462,
  LessonStepNav #476, XpBadge #510). Plus a **P1 matching fix** - score by
  matched value, not index, for duplicate pairs (#480/#481). 31 commits, no
  schema/API/data change.)
  v1.78.0 = (maintenance/code-hygiene release -
  **complexity burn-down + governance + flaky-test fixes**: the grandfathered
  `.complexity-baseline` offenders decomposed one at a time under the Phase 2
  hard ratchet CI gate (#408) - the 1156-line session `routes.py` split (#412,
  the last backend cohesion-baseline entry; `.filesize-baseline` is now empty)
  plus the burn-down batch across backend + frontend, each behaviour-preserving
  (LessonPage 67->12 #418, ImportDetail 58->18 #420, backup-diff previewRow
  54->3 #422, buildContentSetRow 49->13 #424, AiSettingsPanel/ApiKeyRow 45->9
  #428, MatchingExercise 45->17 #433, build_analysis_context 33->3 #416,
  buildAnalysisContext 33->3 #448, formatEventLog 40->4 #436,
  NextStepSuggestions 36->14 #438, plus the CCW frontend batch -
  FreeText/PictureChoice/WordTiles/Cloze/ContentSetRow/Navigation/
  parseChatImport/validateLesson, #442-#460); two governance rules added to the
  Vibe Coding Policy - Release-Freeze (#410) and No-Amend-on-open-PR (#412/#414
  origin); two flaky-test fixes - the lesson-tts stale-assertion realignment
  (#165/#425) and pytest-randomly reactivated to catch ordering leaks
  (#426/#429); and the EXP-025 (author-provided lesson sets, Refs #142) +
  EXP-026 (user lessons in the content tree, Refs #97) design explorations.
  29 commits, no schema/API/data change.)
  v1.77.0 = (architecture release -
  **R-M-W data-integrity (3 phases) + god-file decomposition complete + 3 CI
  watchers + Vibe Coding Policy**: the three-phase Dexie read-modify-write
  remediation closes the lost-update class across the storage layer - Phase 1
  atomic increments via `table.modify()` / `db.transaction` with an idempotent
  `session.end` status-guard (#395), Phase 2 the create-race ensure helpers +
  unique indexes (`&user_id`, `&key`, compound `&[user_id+badge_id]`) with the
  v25->v27 dedup migration (#398), Phase 3 the 13 full-replace `update` methods
  wrapped in `db.transaction` (#402), all under #390; the god-file decomposition
  is complete across backend (session `append_message` -> `session_runner`
  #352, `backup_service` split #353, startup/config/sync_push/sources
  extractions #353, AI-caller consolidation #340) and frontend (api `client.ts`
  split #396, storage types/db-rows/dexie namespaces #364/#392/#360/#365/#366,
  and the Settings/Backup/ShareWizard/Content/Lesson page splits
  #387/#385/#389/#403/#356/#358/#406); three warn-only CI watchers ship -
  cohesion #371, security-scan #378, complexity #405 (radon + eslint,
  `make check-complexity`); plus the Vibe Coding Policy #383, backend
  parameter-dataclasses (`ProgressUpdate` #376, context dataclasses #382), a
  feature-state policy (visible-but-disabled, never hidden) #336, and the
  gitflow branching model #334; an npm-audit `qs` override #379; no schema/API/
  data change.)
  v1.76.0 = (maintenance -
  **exercise-renderer dedup + ownership-check consolidation + backup-button
  unification**: a `useControlledExercise` hook + a shared `ExerciseFooter`
  remove ~300 lines of lifecycle duplication across all 5 exercise renderers,
  zero behaviour/test change (#322, PRs #323-#328); the per-user backup/sync
  ownership check is consolidated into one canonical pair in `sync_service`
  (`row_belongs_to_user` + `record_belongs_to_user`; backup imports them),
  closing a security-directional drift, behaviour-preserving on all reachable
  data since every mapped `user_id` column is non-nullable (#329/#330); the
  Danger-Zone backup button now uses the same `saveBackupToDisk` helper as the
  Settings export, pinned by a cross-component parity test (#331/#332); TTS no
  longer reads raw Markdown aloud (#320/#321); the Dexie-mode CI gate runs
  inside the `mcr.microsoft.com/playwright` container instead of the hanging
  `cdn.playwright.dev` download (#317/#319); the misconfigured
  `prettier-frontend` pre-commit hook removed (#316/#318); and content-set
  download now accepts the content repo's optional `domain_label` field,
  fixing a 400 on sets carrying it (e.g. the psychology set) (#333); no
  schema/API/data change.)
  v1.75.0 = (minor - **TipTap editor stack migrated
  v2 -> v3**: the whole `@tiptap/*` stack (23 packages) bumped 2.27.2 ->
  3.26.1 in one atomic change (#311/#314) - a mixed v2/v3 tree does not
  compile (v3 extensions need v3 core), the failure mode that defeated the
  prior piecemeal Dependabot bumps and prompted the major-hold. The only
  code deltas are the v3 breaking-API changes, verified against the
  installed 3.26.1 packages rather than guessed: `TextStyle` + `Table`
  lost their default export (-> named imports), StarterKit v3 now bundles
  `Link` + `Underline` (disabled so the custom standalone ones do not
  collide), `setContent`'s second arg is an options object
  (`{emitUpdate: false}`), and `NodeViewContent` is generic with a
  NoInfer'd `as` prop (`NodeViewContent<"code">`); `Editor`/`JSONContent`/
  `NodeViewProps` type imports unchanged (still re-exported from core).
  3953 vitest + 88 dexie-smoke green with zero test changes; the
  Dependabot `@tiptap` major-hold (#305) removed so minor/patch flow via
  the group again. Also: a pre-existing `@eslint/js` 10 (#310)
  `no-useless-assignment` break fixed in 5 files (#312/#313), and the two
  migrated editor files restored to the repo's 4-space style after an
  inadvertent prettier reformat (#315). No schema/API/data change.
  v1.74.0 = maintenance/infrastructure on top of
  v1.73.0's feature-strategy work: the 438 pre-existing ESLint warnings
  cleared and the gate tightened to `--max-warnings 0` so the Frontend
  Tests CI job is green again (#220/#292); a dexie-smoke E2E CI workflow
  (#301/#302); the whole `@tiptap/*` stack reconciled to a consistent v2
  tree (2.27.2) (#304) + Dependabot configured to hold `@tiptap` major
  bumps (#306); CI installs frontend deps with `--legacy-peer-deps`
  (#293/#294); and Dependabot bumps - `@astrapi69/feature-strategy` 0.1.1,
  `@types/node` 25, `@vitejs/plugin-react` 6, `@eslint/js` 10, ruff, and
  the minor-patch groups (#295-#300, #307-#310). Visual baselines
  unchanged. Frontend tooling + CI + deps; no schema/API/data change.
  v1.73.0 = minor - **feature-strategy
  integration**: a central registry + strategy from
  `@astrapi69/feature-strategy` replaces the ad-hoc per-button API-key
  checks + Dexie-mode section hiding with three states
  (active/disabled/hidden) resolved from one memoised, reactive
  `{mode, hasAiKey}` context, so AI gates flip without a reload; migrated
  Import-Detail, Anki, NotebookLM, Dashboard, Pronunciation, the Settings
  Sync section, and the Learning-Repo git controls; descriptors carry the
  `active` default, the strategy holds only the deviation rules and fails
  closed on an unknown id (#287). Plus E2E feature tests for the no-key
  surfaces (content-repo import #278, Anki #279, NotebookLM #280), the
  NotebookLM AI buttons key-gated (#281), the TipTap
  extension-highlight/-table-cell/-task-item pinned back to 2.27.2 to fix
  the v3-vs-core-v2 MISSING_EXPORT build break (#267/#288), Progress.test
  wrapped in TestFeatureProvider (#289/#290), and dependency bumps
  ESLint 10 / mypy 2.1 / minor-patch groups / GH actions (#258-#266).
  Frontend + test-infra + dependency hygiene; no schema/API/data change.
  v1.72.2 = patch — **3 P3 code-hygiene items:
  inline-styles→Tailwind, an Anki empty state, and all frontend import
  cycles removed**). Frontend only; no schema/API/data change.
  **Import-Detail + Import (#275):** ~52 inline `style={{…}}` migrated to
  token-backed Tailwind utilities (no functional change). **Anki empty
  state (#276):** `/anki` now shows an icon + title + body + import CTA +
  (no-key) API-key notice → Settings>Integrations instead of a one-line
  muted `<p>`; new `anki.empty_*` in 8 langs. **Import cycles (#252):** the
  3 madge cycles (all type-only back-edges from `storage/types.ts` into
  impl modules) resolved by extracting the shared types into 3 pure modules
  (`content-validation-types.ts`, `storage/export-types.ts`,
  `api/request-types.ts`); madge now 0, `check-circular` baseline 3→0.
  v1.72.1 = patch — **dark-theme button-background
  fix + a11y fixes, both surfaced once the v1.72.0 visual + axe suites
  actually ran**. Frontend + test-infra only; no schema/API/data change.
  **Raw `<button>` background (#271):** with Tailwind preflight off a raw
  `<button>` with no `bg-*` inherited the UA `buttonface` (~#efefef) — a
  theme-independent near-white box with invisible text on all 6 dark themes
  (LearningPath SetRow, NotDownloaded, Dashboard project cards); the
  unfinished half of v1.71.0's `#185` (`color:inherit`) — the base-layer
  rule now also sets `background-color:transparent`, guard-pinned in
  `contrast.test.ts`. **a11y (#273):** 5 serious axe violations fixed
  (`aria-progressbar-name` on mission + XP bars, `nested-interactive` on the
  ProfileRadar `role="img"` wrapper, `listitem` on Content knowledge groups,
  `color-contrast` via #271) — 0 violations across all 7 audited routes.
  **Test infra:** the visual `lesson-matching` view never baselined because
  the helper waited for the absent (controlled-mode) `matching-submit` — now
  drives `lesson-check` (#270), first committed baseline (5 views × 12
  themes); the axe suite never ran because it used `browser.newPage()` —
  now `browser.newContext()` (#272). v1.72.0 = patch — **dark-theme contrast &
  spacing sweep + a Session-Detail export fix**. Frontend + one
  tracking/storage fix; no schema/API/data change. **Session export
  (#209):** the export dropdown's `recent_sessions` id is the
  ProgressCommit id, but the export builder loads by `LearningSession`
  id — so every Session-Detail Markdown/PDF export failed with "Session
  … not found" in both modes; `recent_sessions` now carries `session_id`
  and the export targets it. **Bare `.btn` colour (#211):** the `.btn`
  base class set no text colour (only its variants did), so a
  variant-less `.btn` went invisible on dark surfaces (the v1.71.0
  `button{color:inherit}` reset only reached raw `<button>`); `.btn` now
  sets `color: var(--fg-primary)`, variants override, guard-pinned.
  **Also:** Missions reset → shadcn destructive (#205), ThemePicker
  inactive tab → `fg-secondary` + AA pin (#207), Donation badge →
  `--accent-fg` (#201), chart data-table trigger → `fg-primary` + shadcn
  `Table` (#218), Matching orange → cyan (#199), Learning-Repo settings
  layout + dev-info drop (#203), Dashboard tags spacing + Nav Help
  consistency (#213/#214), Lernmaterialien spacing (#216). v1.71.0 =
  minor — **clearer Matching result
  feedback + Enter in the correction round + a systematic dark-theme
  button-contrast fix + test-isolation fixes**. Frontend + test infra,
  no schema/API change. **Matching results (#191):** after checking, a
  wrong pair spells out both sides instead of relying on colour — a red
  "Deine Antwort: …" (X icon) and a green, bold "Richtige Antwort: …"
  (check icon) on separate lines; a correct pair confirms the link as a
  single "A → B" line (Lucide arrow). New `your_answer` + reworded
  `correct_hint` i18n in all 8 langs; all colours via the AA-pinned
  `--matching-correct/-error` tokens. **Correction-round Enter (#187):**
  the lesson-end `CorrectionBlock` now runs its cloze controlled with an
  external "Antwort prüfen" button + the shared `useLessonEnterKey`
  hook, so Enter checks the cloze exactly like the main + error-replay
  runners (the three surfaces can't drift). **Systematic button
  contrast (#185):** with Tailwind preflight off a raw `<button>` fell
  back to the UA `buttontext` (≈ black) on dark surfaces; a base-layer
  `button { color: inherit }` fixes the whole class while losing to every
  explicit `text-*` utility, so shadcn `<Button>` variants and
  intentionally-coloured buttons are untouched (root cause behind the
  per-surface #146/#148/#177/#179 fixes). **Console warning (#119):** the
  content-repo token password input is wrapped in a form. **Test
  isolation:** an autouse fixture resets the session-shared
  content-loader cache between tests so the cross-identity backup
  round-trip stops flaking under pytest-randomly (#164), and the lesson
  read-aloud Dexie-gate spec gets headroom + a retry (#165). **Content
  (content-repo #33):** the Miller "7 ± 2" cloze accepts keyboard-typeable
  +/- forms. v1.70.2 = patch — **theme contrast + Matching exercise
  fixes**. **Secondary buttons (#179):** soft-pop's `secondary` variant
  rendered white-on-teal (1.86:1); its `--bg-secondary` is corrected to a
  readable dark tone, and `contrast.test.ts` now pins every shadcn
  button-variant colour pair across all 12 themes. **Matching pair
  colours (#181):** matched pairs no longer use red — a dedicated
  red-free `--matching-pair-1..7` palette in `global.css`, decoupled from
  the shared `--chart-*` data-chart palette. **Matching result state
  (#183):** after checking, pair number badges stay visible, correct
  pairs are green on both tiles, wrong pairs are red on both tiles and
  show the correct partner as a hint, and unmatched tiles stay neutral;
  new per-theme `--matching-correct-bg/-fg` + `--matching-error-bg/-fg`
  tokens, WCAG-AA verified. v1.70.1 = patch — **onboarding / assessment /
  content-browser / landing UX fixes**. Frontend only, no schema/API
  change. **Wizard height (#169):** the onboarding profile wizard gives
  its step area a uniform min-height so the panel no longer jumps
  between steps. **Assessment dead-ends (#171):** the first question
  gains a "Continue later" exit (the assessment is resumable) and
  leaving onboarding after the project is created navigates with
  ``replace`` so the browser back button no longer lands on the stale
  name/topic form. **Docs link (#173):** the landing "Read the
  documentation" link opens in a new tab (``rel="noopener noreferrer"``).
  **Tab order (#175):** the Topic help icon gets ``tabIndex={-1}`` so Tab
  flows Name -> Topic instead of catching the icon between them.
  **Dark-theme buttons (#177):** the Content Browser secondary actions
  (Import Lesson / Import Chat / Learning Path) + the Recommended-books
  toggle move from the surface-less ``ghost`` variant to the bordered
  ``outline`` variant so they stay visible at WCAG AA across all 12
  themes. v1.70.0 = minor — **first-run backup restore +
  v1.61-v1.69 documentation overhaul + context-sensitive in-app help +
  manual test plan**). **First-run restore (#150):** on an empty
  install the onboarding offers "Restore from backup" instead of a
  from-scratch start; the offer disappears once data is present.
  **Docs overhaul (#157):** the MkDocs help site gains a
  feature-oriented branch (Content Browser, multiple content
  repositories, backup & restore, content creation incl. ``books.yaml``,
  design tokens, sync, changelog) in all 8 languages plus refreshed
  lessons/getting-started/onboarding/themes pages; deployed at
  ``https://astrapi69.github.io/adaptive-learner/docs/``. **In-app help
  (#159):** the nav "?" opens the glossary entry for the current view
  (``lib/help-routes.ts`` ``helpKeyForPath``) instead of a fixed one,
  each help-drawer article gains a "Learn more" link to the matching
  docs page (``docs_slug`` + ``docsUrlForSlug``), and 9 new glossary
  terms (content repository, trust level, streak, assessment + the
  Dashboard/Content-Browser/Lesson/Settings views + backup) ship in all
  8 languages. **Manual test plan:** a pre-release QA checklist at
  ``docs/MANUAL-TESTPLAN.md``. v1.69.0 = minor — **theory example links +
  per-domain book recommendations + Error-Replay Enter shortcut +
  backup-restore title fix**. **Example links (#139, via Sprint 2 /
  #153):** a theory step can carry an optional ``example_url`` (+
  ``example_label``) rendered as a "View example" button; content
  schema 1.3 -> 1.4 (additive), client + content-repo validators reject
  a non-http(s) URL. **Book recommendations (#141):** a
  maintainer-curated ``books.yaml`` at the content repo root maps a
  domain to recommended books, shown in the Content Browser
  (``lib/content/book-recommendations.ts``, both storage modes, no
  backend). **Error-Replay Enter shortcut (#154):** "Fehler
  wiederholen" honors the same Enter shortcut as the main runner (Enter
  checks an answered exercise, then advances) via a shared
  ``useLessonEnterKey`` hook so the two runners can't drift. **Backup
  title fix (#134, recurrence):** the v1.67.1 synthesised manifest
  stores the title at ``name:`` (root) + ``sets[].title`` (nested), but
  the Dexie restore read it with a root-level-only ``/^title:/m`` regex
  -> never matched -> fell back to the raw ``set_id``
  (``analysis-<uuid>``) and step progress collapsed. Restore now parses
  the manifest with the real YAML parser and recovers the title + the
  other set fields (languages / level / domain / description /
  lesson_count), preferring the carried ``meta`` when present; proven by
  a real export->import round-trip through the actual
  ``createDexieBackup``/``restoreDexieBackup`` against fake-indexeddb.
  i18n updated in all 8 languages. v1.68.0 = minor — **lesson-result
  export + theory back-links + matched-pair visual overhaul + dark-mode
  contrast fixes**. **Export results (#138):** the lesson summary gains
  "Copy result" + "Save as file" — a Markdown report (score,
  per-exercise mistakes with the learner's answer + the correct answer,
  still-weak areas) for pasting into an AI assistant; pure builder
  (``lib/lesson/result-export.ts``), both storage modes.
  **Theory back-links (#140):** an exercise step shows a subtle
  "Re-read theory" link to the nearest preceding theory step (runtime-
  derived, no schema change); the theory step then offers "Back to
  exercise". Rendered once around the exercise dispatcher, so all five
  renderers inherit it. **Matched pairs (#145):** both tiles of a
  paired match share a distinct color (per-theme ``--chart-*`` palette,
  cycled) + a matching number badge — colorblind-safe (not color
  alone); slots assigned on pairing, freed on undo. **Domain-aware
  matching (#149):** a knowledge lesson (non-language domain, or
  source==target) uses neutral Term/Definition labels, drops the
  language names, and a non-translation instruction; domain threaded
  Lesson → Dispatcher → MatchingExercise. **Read-aloud (#147):** no
  longer swaps the theory body to a plain-text follow-along while
  speaking — the rendered Markdown (headings/lists/code) stays; audio
  just plays. **Dark-mode contrast:** ``<Button asChild>`` + router
  ``<Link>`` anchors keep their variant text color (#146 — the unlayered
  ``a { color: var(--accent) }`` was overriding the layered utility, so
  accent text landed on an accent background), and outline/ghost
  buttons (the lesson "Previous" button) set an explicit
  ``text-foreground`` so they no longer fall back to invisible UA black
  with preflight off (#148). **Also (#143):** the search icon moved to
  the right of the field + uniform matching/word-tile card heights;
  **About > Credits** now names Claude (Anthropic) for AI assistance
  (architecture, code, content, documentation). i18n updated in all 8
  languages. v1.67.1 = maintenance — **systematic
  backup-restore fix + deploy-safe lazy-route reload + subject-filter UX
  polish**. **Backup restore (#115, #117):** a generic type-coercion +
  matching layer replaces the prior point-fixes — unique-key matching
  for the 13 non-id-UNIQUE tables (the ``user_settings``/``user_xp``/
  ``user_streaks`` singletons + composite keys) with FK-graph-derived
  child remap and placeholder reclaim (older backup / clean-install no
  longer hit a UNIQUE violation), JSON serialization for dict/list
  values bound to Text columns (``badges.tier_thresholds``, lesson/note
  content, anki tags — fixes ``sqlite3.ProgrammingError: type 'dict' is
  not supported``), and empty-table skip on export + import; verified
  end-to-end through the real backup API. **Lazy-route reload (#113):**
  the GH-Pages build auto-reloads once on a stale-deploy chunk-fetch
  failure (``lazyWithReload`` + Workbox ``cleanupOutdatedCaches``)
  instead of crashing with "Failed to fetch dynamically imported
  module". **Subject filter (#111):** the Dashboard filter hides at ≤1
  subject, orders most-used-first, and groups by category above 5.
  v1.65.0 = minor — **resumable assessment + an
  Enter-key lesson shortcut + clearer matching exercises + a
  design-token architecture pass**. **Resumable assessment (#106):**
  abandoning the assessment partway persists the in-flight progress
  (current question + answers + start time, project-scoped in
  localStorage, mode-agnostic), the learner resumes where they left off,
  and the Dashboard/Settings actively invite "Continue / Create / Retake
  learning profile"; progress is cleared once the profile is computed.
  **Enter-key shortcut (#103):** Enter checks an answered exercise then
  advances; free-text/cloze fields submit on Enter (no newline); steps
  aside for controls that own Enter; Settings > Learning toggle
  (default on). **Design tokens (#101):** the last hardcoded colors in
  ``global.css`` (danger text, highlighter mark, highlight.js palette,
  toast shadow) route through tokens; the ``no-hardcoded-colors`` guard
  now also covers non-theme CSS + fixed-palette Tailwind classes; new
  ``docs/DESIGN-TOKENS.md`` + ``.claude`` rule. **Matching distinction
  (#108):** the term/definition columns get theme-derived blue/green
  tints + an aria-hidden A/B chip (not colour-only), via ``color-mix()``
  tokens across all 12 themes, AA-verified. **Fix:** the assessment
  result no longer overlaps the radar summary / table link with the
  preferred-method badge (#105).
  v1.64.0 = minor — **onboarding overhaul: a
  two-field quick start + an optional one-question-per-screen profile
  wizard, with the assessment now opt-in**. **Onboarding (#92, #94):**
  the quick-start form requires only **name + topic** (the rest take
  defaults); submitting then offers an invite — "Jump right in" goes
  straight to the Dashboard, "Set up profile" enters the new
  ``OnboardingWizard`` (goal / timeframe / daily minutes / current
  problem / opt-in assessment, one question per screen, each pre-filled
  so "Next" always advances, progress bar + Back, persists via
  ``getStorage().projects.update`` so both storage modes work). The
  assessment is **no longer mandatory** — reachable only from the
  wizard's final step. **Fixes:** the Content Browser (and any tall page)
  no longer shows a second scrollbar — ``html``/``body`` lock both axes
  (``overflow: hidden``) so ``#root`` is the sole scroll container (#42);
  the sticky lesson footer is pinned to the viewport bottom across steps
  (no mid-screen float / vertical jump; ``lesson-page`` fills the
  viewport, the step grows to absorb slack; regression pin
  ``e2e/dexie/lesson-footer-stability.spec.ts``) (#43); a WCAG contrast
  pin for ``--accent``-as-text (≥4.5:1 on bg-primary/surface, ≥3:1 on
  bg-elevated) plus a catppuccin-mocha nudge so all 12 themes pass
  computationally (#96).
  v1.63.0 = minor — **6 recommended WCAG-AA theme
  presets + systematic i18n audit + dashboard subject filter scoped to
  the user**. **Theme presets:** the Appearance picker leads with a
  **Recommended** sub-tab — `catppuccin-latte`/`supabase`/`graphite`
  (light) + `catppuccin-mocha`/`soft-pop`/`amethyst-haze` (dark),
  generated from tweakcn presets by
  ``scripts/generate_preset_themes.py`` as full 43-token themes with
  **computationally-enforced WCAG AA** (`contrast.test.ts` across all 12
  themes); the classic 6 are unchanged. **i18n audit (#80):** the 77
  seeded subject/category names rendered English everywhere — a new
  ``subjects.*`` catalog (60 keys × 8 langs) + ``lib/subjectI18n.ts``
  (`translateSubjectName`/`translateSubjectPath`, fallback to
  ``subject.name`` for proper nouns) translate them; plus **92 `t()`
  keys called in code but missing from every catalog** (the whole
  `editor.*` toolbar, danger-zone, dashboard metrics, learning-path aria)
  added + translated in all 8 langs. **Filter (#72):** the Dashboard
  subject filter lists only the user's subjects (hidden when none).
  **Fixes:** theme `accent-foreground` uses the on-accent colour for AA
  (#82); `dashboard.no_data` key added (#84); a `backup_service` mypy
  `no-any-return` (#87).
  v1.62.0 = minor — **backup-restore data-integrity hardening +
  GitHub-Pages build provenance + content cache-bust + UI/i18n
  conformance**. Type-driven restore datetime coercion (#57) +
  orphaned-child-row skip with a full FK-order audit (#64); Vite
  ``__BUILD_HASH__``/``__BUILD_DATE__`` provenance so About stops showing
  "unknown" (#66); content cache pruned on version change in both storage
  modes (#62); sync section hidden without a backend (#51),
  missing-vs-unsupported `exercise_type` fallback (#55), dashboard
  ``taxonomy.*`` i18n keys (#76), shadcn buttons (#53/#68/#78), Language
  panel first in the Learning tab (#69); new `.claude/rules` governance
  (GITHUB-ISSUE-PFLICHT + ISSUE-LIFECYCLE, issues-as-queue,
  docstrings-over-inline) + Bibliogon issue templates/labels.
  v1.61.0 = minor — **app-wide shadcn button
  conformance + lesson resume-at-paused-step + cross-repo content
  validation + backup-restore data-integrity fixes**. **Button audit:**
  ~200 action buttons across all 13 page areas converted to shadcn
  ``<Button>`` (correct variant, 44px, lucide icon + responsive label,
  preserved a11y/testids; exercise tiles / editor toggles / graph nodes
  left raw by design — ``docs/audits/button-audit.md``); the backup
  actions are prominent (Create=default, Restore=outline) and scroll to
  top after restore. **Resume:** a paused lesson resumes at the exact
  step — ``LessonProgress.current_step`` (Alembic 0027 + Dexie, no
  version bump), persisted on step/autosave/pause, resumed at
  ``max(step_results-derived, current_step)``. **Content validation:**
  ``scripts/validate_bundled_content.py`` makes the content repo the
  single authority for the README CONTENT-STATS block (pre-commit writes,
  a ``Content stats drift`` CI job checks a FRESH content checkout,
  deploy double-checks); README now reports **330 lessons / 16 sets**.
  **Fixes:** backup restore UNIQUE-on-``badges.key`` (natural-key upsert
  + ``user_badges.badge_id`` remap), FK-topological ``_RESTORE_ORDER``,
  ``imported_conversation_id`` in backup columns, ``learning-repo`` git
  commits disable GPG signing.
  v1.60.0 = minor — **lesson-reading UX +
  Learning Path Achievement Map + Tailwind exercise renderers +
  help-glossary perf + B1 content complete**. **Auto-hide header
  during lessons:** scrolling down slides the sticky nav up (more
  reading space), scrolling up / reaching the top reveals it — scoped to
  ``/lesson`` / ``/review`` / ``/adaptive-lesson`` / ``/error-replay``
  via the new ``hooks/useScrollDirection.ts`` (observes the ``#root``
  scroll, 10px threshold) + a Tailwind ``-translate-y-full`` transform
  (``motion-reduce``-safe, no layout shift; the sticky lesson footer
  stays visible). **Learning Path now has 3 views — Persönlich / Map /
  Graph**: the new ``LearningPathMap`` groups progress by domain
  (bird's-eye mastery overview). **Settings** secondary actions go
  **icon-only on mobile** (consistent with Dashboard + Content).
  **Tailwind:** all **5 exercise renderers** (PictureChoice, Matching,
  FreeText, Cloze, WordTiles) migrated → app **~85-90% on Tailwind**; a
  post-migration theme audit (43-token parity, themed Dialog overlay) +
  dead-CSS removal. **Perf:** the help glossary is **lazy-loaded per
  language** — EN stays eager (synchronous fallback), the other 7 are
  on-demand chunks (``loadGlossaryLanguage`` + ``hooks/useGlossary.ts``),
  dropping the main ``index`` chunk **731→449 KB raw / 245→138 KB gzip**
  (closes ``PERF-HELP-GLOSSARY-LAZY-01``). **Fixes:** same-language chat
  imports (German grammar for German speakers, source==target) are
  auto-detected as **knowledge** domain content — the Save flow stamps
  the lesson domain (schema v1.3) and the Share Wizard inherits the pair
  instead of repairing it (E2E ``import-language-pipeline`` variant 2
  un-fixme'd; plus a Dexie async-load timing fix for the wizard, and a
  ``github_service`` mypy ``no-any-return`` cast). **Content: B1 roadmap
  complete** — new **de→es B1 / de→en B1 / de→fr B1** (15 lessons each),
  so de→en, de→es, de→fr each ship full **A1→A2→B1**; library now at
  **271 lessons / 13 sets / 4 domains** (~66h; 90 Psychologie).
  v1.59.0 = minor — **Learning Path Redesign: personal path with zoom
  levels** (the old ``/learning-path`` rendered all ~225 lessons as one
  xyflow graph; replaced by a two-level personal view —
  ``pages/LearningPathPersonal.tsx`` + pure
  ``lib/learning-path/personal-path.ts`` + ``hooks/usePersonalPath.ts``:
  per-downloaded-set rows sorted by last activity → inline accordion to
  per-lesson detail, ``[Nur meine]/[Alle Sets]`` toggle, next-CEFR-level
  offer; the original graph kept as ``LearningPathGraph``, lazy-loaded
  so **xyflow ~177 KB leaves the default bundle**). Also moved the mobile
  nav **hamburger to the left**.
  v1.58.0 = minor — **user-centric UX overhaul**.
  A shared **Continue Learning** ("Weitermachen") section
  (``components/ContinueLearning.tsx`` + pure helpers in
  ``lib/content/continue-learning.ts``) surfaces the most
  recently-touched lesson per set (newest first) with one action each —
  **resume** an in-flight/paused lesson (step n/total), **next** lesson
  pointer + stars after a completed one, or **set complete** — reading
  ``lessonProgress`` + set manifests through ``getStorage()`` so both
  storage modes carry it (each read ``safe()``-guarded; renders nothing
  while loading / no user). It lands on the **Content Browser** (top 5)
  and the **Dashboard** (top 3). The **Content Browser** is reordered
  around the learning flow: **search first** (full width), a compact
  **icon-only mobile action toolbar** (Import Lesson / Import Chat /
  Learning Path / Create — icon + label from ``md`` up, 44px targets),
  then Continue Learning above the set tree (My Lessons + Contributions
  hide while searching). The **Dashboard** leads with Continue Learning,
  then the actionable cards (paused / missions / focus / review), then
  gamification (XP / streak / badges), then the analytical panels. A
  **responsive button pattern** (icon-only on mobile, icon + text from
  ``md`` up; ``aria-label``/``title`` keep the accessible name) is
  applied to the secondary toolbars. 23 new frontend tests.
  v1.57.0 = minor — **community PR automation +
  Content Browser search**. **GitHub PR automation:** sharing a lesson
  now creates a real pull request programmatically (fork → commit →
  PR) instead of a pre-filled URL — backend ``github_service`` +
  ``/api/github/*`` proxy (token server-side) in API mode,
  browser-direct ``lib/github/github-api.ts`` in Dexie mode, via the
  new ``IStorageService.github`` namespace; graceful fallback to the
  URL flow on no-token / multi-lesson / failure. **GitHub PAT** stored
  Fernet-encrypted in ``secrets.yaml`` (``github.token_encrypted``),
  managed in **Settings → Integrations** (format-validated, Test shows
  the username, source line, Remove). **Content Browser search:** a
  full-width, debounced (300ms), case/diacritic-insensitive +
  German-digraph-aware instant filter over the cached library (set
  titles/descriptions/domain + lesson titles + card fronts/backs +
  tags) in ``lib/content/content-search.ts``; results replace the tree
  with highlighting + count + empty state, Cmd/Ctrl+K focus, index
  built lazily on first interaction (no backend, no new dep). Carries
  the **Tailwind Phase D** work merged since v1.56.0 (shadcn Progress
  XP bar + a11y fix, badge-tier dots, toast token alignment, Lucide
  nav + 44px targets, Help Drawer → shadcn Sheet, E2E Radix-Select
  migration). Content library at **225+ lessons / 10 sets / 4 domains
  (90 psychology** — full university course incl. the Intelligenz
  block 86-90).
  v1.56.0 = minor — **performance + PWA
  hardening**. **Perf:** ~460 KB gzip saved via lazy per-language i18n
  catalogs (main chunk 446→233 KB gzip, off every page) + a curated
  highlight.js (296→21 KB gzip on code lessons); bundle audit at
  ``docs/audits/performance-audit-2026-06-03.md``; Dexie + backend query
  layers audited healthy (no page-load N+1; ``BADGE-EVAL-NPLUS1-01`` P3
  filed). **PWA:** offline indicator + network-aware buttons, a
  localStorage background-sync queue for offline lesson-progress upserts,
  cache-management UI in Settings→Data, a 7-day/standalone-aware install
  prompt, and a service-worker StaleWhileRevalidate route for API-mode
  lesson caching. Also carries the **Tailwind/shadcn migration (Phases
  B + C** — buttons/Card/Badge, Lesson + Share dialogs, form inputs to
  shadcn Input/Select; 44px touch targets) and **backend API rate
  limiting (3-tier token-bucket) + OpenAPI docs** that landed since
  v1.55.0. **Fix:** restored the per-theory read-aloud control in Dexie
  mode (``getLessonDexie`` now injects the set's language pair/domain;
  closes ``TTS-E2E-HEADLESS-GUARD-01``). Content library at 215+ lessons
  (80 psychology, ~46h).
  v1.55.0 = minor — **Tailwind CSS v4 +
  shadcn/ui foundation (Phase A) + Error Replay**. Adopts **Tailwind
  CSS v4.3.0 + shadcn/ui** as the styling framework, installed
  ADDITIVELY (Phase A — the migration is incremental: components
  convert when touched, no Big Bang). Tailwind is configured CSS-first
  (``@theme`` in ``frontend/src/styles/tailwind.css``) and CONSUMES the
  existing 6-theme CSS variables (``bg-accent`` → ``var(--accent)``) so
  every theme keeps working; preflight is intentionally off and all
  Tailwind output is layered, so unlayered ``global.css`` always wins
  and existing pages stay pixel-identical. shadcn/ui base is wired
  (``components.json`` + ``cn()`` at ``@/lib/utils`` + ``@/*`` alias;
  no components installed yet — the semantic-token bridge lands with
  the first one); ``LessonStickyFooter`` is the proof-of-concept;
  ``.claude/rules/`` + this file updated to adopt Tailwind; full guide
  at ``docs/development/tailwind-migration.md``. Ships **Error Replay**
  ("Fehler wiederholen" — after a lesson, retry only the exercises you
  failed, ``/error-replay/...`` + ``error-replay.ts``) with
  priority-aware next-step suggestions (error replay is PRIMARY at 0-1
  stars), TTS read-aloud for lesson cards, and Stryker frontend
  mutation testing wired (nightly, opt-in). Carries forward the 10
  sets / 200 lessons / 3 domains content library.
  v1.54.0 = minor — **import-time language
  pipeline + big content release**. Languages are captured at IMPORT
  time (chat language + auto-detected learning language) and inherited
  through the whole pipeline — analysis → save-as-lesson → share — so
  nothing is guessed/patched downstream (``ImportedConversation`` gains
  ``source_language``/``target_language``; Alembic 0026 + Dexie v25). The
  analysis prompt gets a learner-language context block; sharing is
  **domain-aware** (source==target ships as non-language ``knowledge``
  content). **Content: 10 sets / 200 lessons across 3 domains** — FR/ES/EN
  **A2** for German speakers, DE→EN A1, Python Grundlagen, Psychologie
  (65). Folds in the v1.53.1/.2 fixes (single two-phase button on
  Adaptive/Review; community-PR attachment for all lesson sizes;
  ShareWizard source inheritance). v1.53.0 = minor — **content schema v1.3
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
- `design-tokens.md` — design-token architecture (no hardcoded colors; see `docs/DESIGN-TOKENS.md`)
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
  Vitest 4, react-router-dom 7, Tailwind CSS 4 + shadcn/ui
  (adopted v1.54.0+, incremental migration), react-toastify,
  Recharts 3, TipTap 2 (StarterKit + 15 extensions),
  Dexie 4 (IndexedDB), html5-qrcode, sql.js + jszip (Anki .apkg)
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
LearningPath (``/learning-path`` — since the redesign the default is
``LearningPathPersonal``, a two-level personal list: one SetRow per
downloaded set sorted by last activity (Level 1) that expands inline
to per-lesson detail (Level 2), built by ``buildPersonalPath`` /
``usePersonalPath``; the original @xyflow/react graph from Phase 66 /
EXP-022 is kept as ``LearningPathGraph``, lazy-loaded only when the
user picks the Graph view so xyflow leaves the default bundle),
NotFound.

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
| content-loader | /sets, /sets/{src}/{id}/download, /sets/{src}/{id}/lessons[/{filename}] | EXP-002 — downloads structured lesson sets from public GitHub repos, caches locally (FS + Dexie). Foundation of the v1.27.0 no-API-key path. EXP-023 Phase A (#118): besides the official repo, one **user content repository** can be connected (Settings > Data), validated, synced (manual + 24h auto), cached, and browsed with a source badge/filter — both modes, source-as-identifier + `isOfficialSource()`. EXP-023 Phase B (#122): **multiple** user repos (list/add/remove/reorder, order = precedence; legacy single-repo migrated), share via `/add-repo` deep link + QR, automatic technical validation (Trust 0→1: ≥1 lesson + no executable content, re-checked each sync), per-repo source filter, and private/coach repos via a per-repo token (localStorage, out of the exportable config). EXP-023 Phase C slice (#124): a curated `recommended-repos.json` (official repo root) drives a Settings discovery section + one-click add + an "Officially recommended" (Trust 3) badge, plus a local-only per-repo star rating; community ratings / Trust 2 / central index / coach aggregation need a shared backend and stay deferred. |
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

## Branching model (gitflow, #334)

- `main` — **releases only** (tags vX.Y.Z). Written solely by a `release/*`
  merge (or a `hotfix/*` for emergencies). Never develop here.
- `develop` — active development; the **default branch**. All `feature/*` /
  `fix/*` / `chore/*` branches start here and PR back here.
- `release/vX.Y.Z` — cut from `develop`; version bump + changelog +
  `make release-test`, then merge to `main` (tag) and back to `develop`
  (`make release-prepare` / `make release-finish`).
- `hotfix/vX.Y.Z` — the only branch cut from `main`; merges to `main` +
  `develop`.

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
- **v1.60.0 baseline:** backend 1158 (+1 skipped) + plugins
  1009 + Vitest 3395 = **5562 tests**. E2E
  smoke (17 spec files) runs separately via
  `cd e2e && npx playwright test`. **Dexie-mode release
  gate** (73 specs incl. the Phase 61 interactive journeys —
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
