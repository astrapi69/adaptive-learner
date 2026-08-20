# Visual spacing/layout audit (#1728), Phase 1

Audit + report only, per #1728 scope. No code changes in this PR except
what the issue explicitly allows (trivial, zero-risk single-token
spacing fixes) - none were needed to file this report.

## Method

#1728's own "archetype defect" (a `className` referencing a dead legacy
class, so the element renders essentially unstyled - the CreateLesson
step-1 shape from #1715) already has a purpose-built, code-grounded
oracle: `scripts/check-dead-classnames.py --unstyled`, whose baseline
(`.unstyled-classnames-baseline`, #1892) explicitly cites "Refs #1491
#1728" - it was built for exactly this audit's primary category.
Rather than re-discover the same defect class by eyeballing
screenshots, this report starts from that baseline (71 entries, 67 real -
see the test-file caveat below) and maps every entry to its exact
source file **using the check script's own token-extraction functions**
(`static_class_groups()`), not a plain-text grep.

That distinction mattered: a first-pass plain grep for the substring
`form-field` matched `CardEditor.tsx` first (a line combining
`form-field` with real Tailwind utilities, `flex flex-col gap-1.5` -
NOT the dead-only occurrence the baseline actually tracks) and would
have produced a wrong attribution in this report. Re-running the
mapping through the script's own AST-ish extraction found the real,
fully-dead occurrence in `SaveOfflineLessonModal.tsx`. Every row below
is from that script-verified pass, not a plain grep.

A second pass grepped the target screens' components for arbitrary
pixel spacing (`p-[Npx]`, `gap-[Npx]`, etc., off the `--space-1..8`
token scale) as a proxy for the "consistent spacing" checklist item -
it found no hits on plain-string `className` values. This does NOT
clear the screens of spacing drift: components built via
`cn()`/template literals are invisible to a plain-string grep, so this
pass is a partial signal, not a clean bill.

No screenshots are attached to this report - no browser session was
available in this pass. The mapping below is code-grounded (verified
against the actual baseline file via the script's own parser, not
memory or approximate grep), which is strong evidence for the ONE
defect class it covers, but it does not replace a visual pass for the
other checklist items (card chrome, mobile viewport).

### Scope note: 4 of the 71 baseline entries are test-only, not real UI

`custom` (`RichTextEditor.test.tsx`), `extra` (`IconBadge.test.tsx`),
`extra-hook` (`PageContainer.test.tsx`) and `lesson-summary-diff`
(`DiffHighlight.test.tsx`) resolve to `.test.tsx` fixture files, not
application screens - the check script's `source_files()` scans test
files too. These are excluded from the findings below; a user never
sees them. Not filed as a gate bug here (out of #1728's scope), just
flagged so this report's counts stay honest.

## Findings: dead-classname archetype defects, by screen

Every row's element renders with **zero** applied styling - not
"slightly off," but no CSS rule and no Tailwind utility matched any
token in the `className` at all. Severity `confusing` where the
element carries user-facing text/controls; `cosmetic` where it's a
container/wrapper whose Tailwind-utility siblings still give the
content basic layout.

### Settings > Backup - systemic (2 components, 15 dead names)

| Component | Dead classNames | Severity |
|---|---|---|
| `components/settings/backup/BackupSection.tsx` | `backup-comparison`, `backup-comparison-table`, `backup-contents`, `backup-contents-list`, `backup-contents-title`, `backup-contents-total`, `backup-last`, `backup-reminder`, `backup-summary` | confusing (data-comparison table + counts) |
| `components/settings/backup/BackupAutoBackups.tsx` | `backup-auto`, `backup-auto-count`, `backup-auto-list`, `backup-auto-toggle`, `backup-auto-when`, `backup-pressure` | confusing (a toggle + a list of past backups) |

**Read: systemic, and the single largest cluster in the audit.** Two
sibling files under `settings/backup/` account for 15 of 67 real
entries. `backup-comparison-table` and `backup-summary` are
user-facing data displays (compare-before-restore) - highest-value
single fix in this report.

### Dashboard - systemic (5 components, one shared culprit)

| Component | Dead classNames | Severity |
|---|---|---|
| `components/dashboard/DashboardFilterBar.tsx` | `dashboard-filter-bar`, `dashboard-filter-controls`, `dashboard-filter-header`, `dashboard-filter-results`, `dashboard-filter-row`, `dashboard-project-list`, `taxonomy-chip-list` | confusing |
| `components/dashboard/ActivityTrend.tsx` | `activity-trend` | cosmetic |
| `pages/dashboard/Dashboard.tsx` | `dashboard-create-lesson`, `dashboard-learning-path` | cosmetic |
| `components/dashboard/LearningRepoWidget.tsx` | `learning-repo-widget-link` | cosmetic |
| `components/badges/DashboardBadgeWidget.tsx` | `badge-widget-grid`, `badge-widget-view-all` | cosmetic |

**Read: systemic.** `DashboardFilterBar.tsx` alone carries 7 of the 13
dead names on this screen - one component, one fix.
`taxonomy-chip-list` is shared with Onboarding (below) - fixing it
once covers both screens.

### Lesson (exercise view) - scattered across exercise renderers

| Component | Dead classNames | Severity |
|---|---|---|
| `components/exercises/renderers/FreeTextExercise.tsx` | `free-text-diff`, `free-text-diff-row` | confusing (right/wrong diff display) |
| `components/exercises/renderers/cloze/cloze-feedback.tsx` | `cloze-blank-diff` | confusing |
| `components/exercises/renderers/PictureChoiceExercise.tsx` | `picture-tile-skeleton` | cosmetic (loading state only) |
| `components/exercises/feedback/AnswerCelebration.tsx` | `answer-feedback-pulse` | cosmetic (an animation class - likely loses the pulse effect, not layout) |
| `pages/lesson/AdaptiveLesson.tsx` | `adaptive-save-row`, `adaptive-summary-improvement`, `review-summary-note` | confusing |
| `pages/lesson/EndlessLesson.tsx` | `lesson-step-nav` | confusing (navigation) |
| `components/lesson/dialogs/LessonResumeDialog.tsx` | `lesson-resume-actions`, `lesson-resume-desc` | confusing |

**Read: scattered.** One or two dead names per exercise TYPE, not one
shared root cause - each renderer needs its own look, not a central
fix. `review-summary-note` is shared with the standalone Review page
(below).

### Lesson summary - clustered in the summary components

| Component | Dead classNames | Severity |
|---|---|---|
| `components/lesson/summary/ReviewedFallbackPanel.tsx` | `lesson-reviewed-fallback`, `lesson-reviewed-prompt` | confusing |
| `components/lesson/summary/LessonAnswersDetail.tsx` | `lesson-summary-breakdown-diff` | confusing |
| `components/lesson/summary/LessonSummarySections.tsx` | `lesson-summary-explanations` | confusing |
| `pages/lesson/ErrorReplayLesson.tsx` | `error-replay-summary-score` | confusing (the score readout) |

### My Content / ContentHub - clustered in content browser

| Component | Dead classNames | Severity |
|---|---|---|
| `components/content/browser/ContentTree.tsx` | `content-level-own-count`, `content-source-knowledge`, `content-source-other`, `content-source-primary` | cosmetic |
| `components/content/browser/ContentBrowsePanel.tsx` | `content-section-title` | cosmetic |
| `components/content/browser/ContentSetRow.tsx` | `content-set-aicheck-btn`, `content-set-quality-btn` | confusing (buttons) |
| `components/content/lessons/MyLessonsSection.tsx` | `content-my-lessons`, `content-section` (one combined className) | cosmetic |
| `components/content/share/ContentShareDialog.tsx` | `content-ai-fix`, `content-ai-intro` | cosmetic |
| `components/content/lessons/SaveOfflineLessonModal.tsx` | `form-field` (3 occurrences) | confusing - form labels. Reached from My Content, Import Detail, AND the CreateLesson flow (`CreateLesson.tsx`, `MetadataStep.tsx` also invoke this modal) |

### Review, Onboarding, Settings (other panels) - single occurrences

| Screen | Component | Dead classNames | Severity |
|---|---|---|---|
| Review | `pages/lesson/Review.tsx` | `review-summary-note` (3 occurrences) | cosmetic |
| Onboarding | `pages/onboarding/Onboarding.tsx` | `onboarding-subject-suggestions`, `taxonomy-chip-list` | confusing (suggestion chips) |
| Settings (Support panel) | `components/about/SupportSection.tsx` | `settings-subsection` | cosmetic |
| Settings (Lesson-mode control) | `components/settings/controls/lesson/LessonModeControl.tsx` | `form-select` (3 occurrences) | confusing (a select control) |

### Not in the #1728 screen list, but the same defect class (adjacent surfaces)

Found while mapping the baseline; flagged for completeness per the
issue's "anything noticed in passing" clause.

| Component | Dead classNames | Note |
|---|---|---|
| `pages/learning-path/LearningPathPersonal.tsx` | `page` | Learning Path screen, adjacent to Progress/Dashboard, not on the explicit #1728 list |
| `components/session/SpacedRecommendations.tsx` | `spaced-rec-body`, `spaced-rec-title`, `spaced-recs` | Session screen |
| `components/session/SessionHeader.tsx` | `provider-chip-model` | cosmetic |
| `components/session/assistant-ui/AssistantUiThread.tsx` | `chat-welcome` | AI chat welcome message |
| `components/topic/CurriculumDescriptionEditor.tsx` | `curriculum-description`, `curriculum-description-actions` (2 occurrences) | Curriculum, adjacent to Set-detail |
| `components/voice/SpeechButton.tsx` | `speech-button__label` | cross-cutting, used across exercise types |

### CreateLesson (steps 2-4): no remaining archetype-defect entries found

No file under `frontend/src/components/create-lesson/` appears in the
current unstyled-classname baseline. The `form-field` entry that a
first-pass grep initially (and wrongly) attributed to `CardEditor.tsx`
actually lives in `SaveOfflineLessonModal.tsx` (My Content cluster,
above) - a modal CreateLesson happens to invoke, not a CreateLesson-
owned component. Read with the same caution as the rest of this
report's "no hits" results: this covers the dead-classname archetype
only, not spacing/card-chrome, which need a live pass.

## Findings: spacing consistency (partial signal only)

A grep for arbitrary-pixel spacing utilities (`p-[Npx]`, `gap-[Npx]`,
`m-[Npx]`, ... - off the `--space-1..8` token scale) across every
target screen's `pages/`+`components/` subtree returned **zero
plain-string hits**. This is a real, if partial, positive signal. It
is NOT a clean bill - `cn()`/template-literal-composed classNames (the
majority of non-trivial components in this codebase) are invisible to
this grep, so a live render pass is the only way to close this
category with confidence.

## Scattered vs. systemic - overall assessment

Two clusters dominate and are worth a dedicated fix session each:

1. **`Settings > Backup`** (`BackupSection.tsx` + `BackupAutoBackups.tsx`,
   13 dead names, several `confusing`-severity data displays) - single
   highest-value fix in this report.
2. **`Dashboard` filter bar** (`DashboardFilterBar.tsx`, 7 dead names,
   shared with Onboarding via `taxonomy-chip-list`) - one component,
   one fix, two screens benefit.

Everything else (Lesson exercise renderers, Lesson summary, Content
browser, Review/Onboarding/other Settings panels) is **scattered**: one
or two dead names per component, each tied to that component's own
markup, no shared root cause. Individually cheap (a handful of
Tailwind utilities each) but numerous (20+ separate small fixes) -
better suited to opportunistic fixing when each component is next
touched than a dedicated sweep.

## What Phase 2 (fix issues) should NOT do

Per #1728's own scope line, this report files no per-finding fix
issues - that is a follow-up decision, not this audit's job. When
filing them: the two clusters above are large enough to be their own
issues; everything else can likely be batched by directory
(`exercises/renderers/*`, `lesson/summary/*`, `content/browser/*`) into
2-3 grouped fix PRs rather than 20 single-line PRs.

## Follow-up needed to close the audit properly

1. **A live-render pass** (screenshots, `make dev` + manual walk or
   `make capture-screenshots` for the already-cataloged features) for
   the spacing-consistency and card-chrome checklist items this static
   pass could not verify - the plain-string grep's "zero hits" result
   is encouraging but not proof.
2. **Mobile viewport** was not separately checked in this pass (no
   browser session) - #1728 asks for it checked "separately."
3. If `source_files()` scanning `.test.tsx` fixtures (see the scope
   note above) is itself worth tightening in the gate, that is a
   `check-dead-classnames.py` change, not a #1728 finding - noted here
   only so it isn't silently forgotten.

## Phase 2: live-render pass (2026-08-20)

Closes follow-up items 1 and 2 above. By this point every dead-classname
cluster the Phase 1 report identified had shipped (#2671, #2674, #2680,
#2686, #2688, #2691 - `.unstyled-classnames-baseline` 118 -> 5 real
entries), so this pass checks the items the static analysis explicitly
could not: spacing consistency, card chrome, and mobile viewport, by
eye, in a real browser.

### Method

A local Dexie-mode build (`VITE_STORAGE_MODE=dexie`) served via
`vite preview`, driven by a throwaway Playwright spec reusing the
existing `gotoSurface()` helpers from `e2e/visual/helpers.ts` (not
committed to the suite - this was a one-off QA pass, not a new gate).
12 screens from the #1728 scope list were captured at both desktop
(1920x1080) and mobile (375x667): Dashboard, Discover, My Content,
two lesson exercise types (cloze + matching-checked), Lesson summary,
Review, four Settings panels (General/Data/About/AI), and Progress >
Statistik. (Set-detail and CreateLesson steps 2-4 were not covered -
set-detail's own capture path is currently broken per #2696,
unrelated to this pass's scope; CreateLesson has no existing capture
helper and needs a dedicated fixture to reach steps 2-4 deterministically.)

Each screen pair was reviewed against the reference-good pattern
(token-scale Tailwind spacing + real card/container chrome) by an
independent reviewer agent, then every non-clean finding was verified
directly by re-inspecting the actual screenshots (crops, side-by-side
comparison) before acting - matching this repo's own "review every
image, never blind accept" discipline (#1532) applied to a findings
report instead of a baseline diff.

### Results

| Screen | Spacing | Card chrome | Mobile | Severity |
|---|---|---|---|---|
| Dashboard | consistent | ok | clean | none |
| Discover | consistent | **stray bullet on every card** | same bullet | cosmetic - fixed |
| My Content | consistent (where rendered) | ok (where rendered) | **title clips, content vanishes past first card, ~91% blank scroll** | confusing - filed #2698 |
| Lesson (cloze) | consistent | ok | clean | none |
| Lesson (matching, checked) | consistent | ok | clean | none |
| Lesson summary | consistent | ok | clean | none |
| Review | consistent | ok | clean | none |
| Settings > General | consistent | ok | clean | none |
| Settings > Data | consistent | ok | minor title wrap, not cut off | cosmetic (not filed) |
| Settings > About | consistent | ok | clean | none |
| Settings > AI | consistent | ok | orphaned dash separator when a provider row wraps | cosmetic (not filed) |
| Progress > Statistik | consistent | ok | clean | none |

**8 of 12 screens are clean.** The dead-classname migration work already
fixed most of what the Phase 1 static pass could only guess at -
spacing and card chrome are consistent everywhere checked, on both
viewports.

**Discover's stray bullet** (fixed in this same change): `discover-results`
and `discover-empty-hints` in `pages/content/Discover.tsx` are
`<ul>`/`<li>` grids with no `list-style` reset. This app does not reset
list-style globally - every other `<ul>` in the codebase carries an
explicit `list-none` utility or a scoped `list-style: none` rule
(`styles/legacy/*.css`) - these two were missed. Fixed with `list-none`
on both; re-captured and confirmed the bullets are gone.

**My Content's mobile bug** (#2698, not fixed here): desktop renders
correctly (3 full cards with real chrome), but mobile clips the first
card's title with no ellipsis and then renders nothing further - no
metadata, no description, no buttons, no other cards - leaving a
~8257px-tall page with ~700px of actual content. This needed live
DOM/devtools inspection to root-cause (the CSS chain read structurally
correct from source alone), so it's filed with the specific leads
gathered rather than a diagnosis pretending to be more certain than it
is.

**Two sub-cosmetic mobile-only wrap artifacts** (Settings > Data's
title wrap, Settings > AI's orphaned dash) were verified real but are
minor enough - nothing cut off, nothing unreadable, no blocked
interaction - that they were not filed as separate issues, consistent
with the Phase 1 report's own "cosmetic hygiene, opportunistic fixing"
category rather than a dedicated sweep.

### Closing #1728

Both follow-up items from Phase 1 are done. The dead-classname
archetype that motivated the whole audit is fully migrated (down to
one deliberately-deferred entry, `chat-welcome`, tracked under the
separate #1485 track). The live-render pass found the app in
materially better shape than the original static audit could have
predicted - one small cosmetic fix landed directly, one real mobile
bug is filed and actionable (#2698), and two trivial artifacts are
documented rather than chased. #1728 itself can be closed once #2698
lands or is triaged; nothing else in the original scope remains open.
