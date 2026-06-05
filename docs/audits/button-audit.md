# Button Audit — app-wide shadcn/ui conformance

**Date:** 2026-06-05
**Branch:** `chore/button-audit`
**Baseline:** main @ `77d814e2` (after PRs #30–#39; includes CCW's lesson-icon + backup-FK work).

Systematic audit of every button across the 13 page areas against the
shadcn/ui Button standard adopted in v1.54.0+ (Tailwind migration). The
reference implementations are `components/ui/button.tsx` and the two
already-conforming sections `CacheManagementSection.tsx` +
`BackupSection.tsx` (PR #39).

## Conformance criteria

| | Criterion |
|---|---|
| **A** | Uses shadcn `<Button>` (not raw `<button>` / legacy `.btn` / `className="primary"`). |
| **B** | Correct variant: primary action = `default`; secondary = `outline`/`secondary`; destructive = `destructive`; icon-only toolbar = `ghost`. |
| **C** | 44px touch target (Button gives `min-h-11` on every size automatically; raw buttons need `min-h-[44px]`). |
| **D** | lucide icon + responsive label (icon-only mobile, icon+text desktop via `hidden md:inline`). **Exception:** primary action buttons (Prüfen/Check, Weiter/Next, Speichern/Save, Confirm, Share) keep text **always**. |
| **E** | `aria-label` present when icon-only. |
| **F** | Disabled state visible (`disabled:opacity-50` — automatic on Button). |

## Classification

- **VIOLATION** — an action button that should be shadcn `<Button>` but isn't, or has the wrong variant / missing a11y.
- **CONFORMING** — already shadcn `<Button>` done right.
- **INTENTIONAL-RAW** — a legitimately raw interactive element where shadcn `<Button>` is the wrong tool. These are **excluded** from the fix scope and listed at the bottom.

### Intentional-raw (NOT converted — by design)

These are interactive widgets, not action buttons. Converting them to `<Button>` would break their custom state/interaction:

- **Exercise option tiles** — `WordTilesExercise` (placed/scrambled tiles + reorder arrows), `MatchingExercise` (pair tiles), `PictureChoiceExercise` (image options), `ClozeExercise` (blank input/select controls). Custom selected/correct/wrong states + drag.
- **Rich-text `EditorToolbar`** — ~20 bold/italic/list/align/undo toggle buttons (`aria-pressed` toggles). Out of scope.
- **xyflow graph nodes** — `LessonNodeView`, `SetGroupNodeView` (node/group state visualization).
- **Curriculum tree controls** — `TopicNode` (expander + inline add/rename/delete), `CardEditor`/`ExerciseGenerator` drag handles + icon-only row actions.
- **Card-row click targets** — `ContinueLearning` row link, `BadgeGallery` badge cards + role="tab" filter pills, `DashboardBadgeWidget` badge tiles, `DashboardFilterBar` tag chips, `Settings` role="tab" tab strip.

## Summary by page area

| # | Page area | Files | Violations | Conforming | Intentional |
|---|---|---|---:|---:|---:|
| 1 | Settings (all tabs except Daten) | 9 | 42 | 0 | 1 |
| 2 | Lesson viewer + exercises + replay | 14 | 54 | 20 | 20 |
| 3 | Dashboard + Content Browser + Share | 10 | 23 | 24 | 8 |
| 4 | Create Lesson + Import + Anki | 6 | 19 | 17 | 5 |
| 5 | Learning Path (3 views) + Session | 13 | 25 | 0 | 7 |
| 6 | Modals / Dialogs + Nav + Help + misc | 15 | 38 | 0 | 20+ |
| | **TOTAL** | **~67** | **~201** | **~81** | **~60+** |

## Fix progress (per-page commits) — ALL DONE

- [x] 1. Settings tabs — Settings.tsx, SyncSection, ExportSection, NotebookLMSection, GamificationSettingsSection, GitHubIntegrationSection, ModelPicker, DangerZoneSection, BackupCompare
- [x] 2. Lesson viewer — Lesson.tsx, Review.tsx, AdaptiveLesson.tsx, ErrorReplayLesson.tsx, LessonTtsMiniPlayer, LessonResumeDialog, LessonList + exercise hint/submit/retry buttons
- [x] 3. Dashboard + Content — Dashboard.tsx, DashboardBadgeWidget, Content.tsx (Share icon), ShareWizard, SaveOfflineLessonModal, ImportLessonModal, SpacedRecommendations, DashboardFilterBar
- [x] 4. Create Lesson + Import — CreateLesson (icons), CardEditor, ExerciseGenerator, ImportDetail, Anki
- [x] 5. Learning Path + Session — LearningPathPersonal/Map/Graph, NotDownloadedSection, Session, Curriculum, RatingDialog, MethodSwitchBanner
- [x] 6. Modals/Nav/Help — Navigation, HelpDrawer, ErrorReportDialog, SyncConflictDialog, AddTopicDialog, QRScannerModal, InstallPrompt, Onboarding, Assessment, Landing, Pronunciation, LearningRepo, NotFound, CurriculumDescriptionEditor

### Decisions taken during the fix (kept INTENTIONAL-RAW, not converted)

- **SetRow / LessonRow / SetDetail** (learning-path list rows) — `<Link>`/`<span>` styled with `cn()` Tailwind, already 44px + accessible. Converting routing-heavy list rows to `<Button asChild>` is high-risk / low-gain; left raw.
- **RatingDialog** 1–5 rating selectors, **Landing** language picker (role="radio"), **Onboarding** subject chips (`tag-badge`), **HelpDrawer** related-concept pills, **DashboardFilterBar** tag chips, **DashboardBadgeWidget** badge tiles — radio-group / chip / card-tile widgets, not action buttons.
- **EditorToolbar** (~20 toggles), exercise option tiles, xyflow graph nodes, curriculum TopicNode + CardEditor/ExerciseGenerator drag handles + icon-only row actions — interactive widgets, out of scope.

### Test-pin update

`Lesson.test.tsx` had three 44px-target pins asserting the literal `min-h-[44px]`; updated to `min-h-11` (shadcn Button's 44px class). No behavior change.

---

## 1. Settings (all tabs — Daten already fixed in PR #39)

### pages/Settings.tsx
| Line | Button | Verdict | Fix |
|---|---|---|---|
| 523 | tab strip `role="tab"` | INTENTIONAL-RAW | tab control |
| 705 | Save model `.btn-primary` | VIOLATION | `<Button>` |
| 715 | Use default `.btn-secondary` | VIOLATION | `variant="secondary"` |
| 877 | Save key `.btn-primary` | VIOLATION | `<Button>` |
| 896 | Test `.btn-secondary` | VIOLATION | `variant="secondary"` |
| 926 | Remove key `.btn-danger` | VIOLATION | `variant="destructive"` |
| 994 | Keep old key `.btn-primary` | VIOLATION | `<Button>` |
| 1002 | Save anyway `.btn-secondary` | VIOLATION | `variant="secondary"` |
| 1011 | Cancel `.btn-link` | VIOLATION | `variant="link"` |
| 1020 | Restore working key `.btn-link` | VIOLATION | `variant="link"` |
| 1040 | Restore link `.btn-link` | VIOLATION | `variant="link"` |

### components/SyncSection.tsx — 6 VIOLATIONS
Sync Now (default), Unpair (secondary), Generate Pairing (default), Copy Link (secondary), Scan QR (default), Connect (secondary). All `.btn-*` → `<Button>`.

### components/ExportSection.tsx — 4 VIOLATIONS
Preview (secondary), Markdown (default), PDF (default), Close (secondary).

### components/NotebookLMSection.tsx — 4 VIOLATIONS
Generate questions (default), Download ZIP (secondary), Download guide (secondary), Delete (destructive).

### components/GamificationSettingsSection.tsx — 2 VIOLATIONS
View all badges (secondary), Reset (dynamic variant via prop, not conditional className).

### components/GitHubIntegrationSection.tsx — 3 VIOLATIONS
Test (secondary), Save (default), Remove (link).

### components/ModelPicker.tsx — 4 VIOLATIONS
toggle (secondary), Retry (secondary), suggestion-row + option-row (these are list-select rows — convert to `<Button variant="ghost">` or keep as documented intentional; treat as ghost).

### components/DangerZoneSection.tsx — 5 VIOLATIONS
Create backup (secondary), Reset Everything (destructive, drop inline style), Cancel (secondary), Continue (default), final Reset (destructive, drop inline style).

### components/BackupCompare.tsx — 3 VIOLATIONS
Export as Markdown (secondary), two disclosure table-head toggles (ghost).

---

## 2. Lesson viewer + exercises + error replay

### pages/Lesson.tsx — 9 VIOLATIONS / 4 CONFORMING
- 563 `<Link className="btn">` → `<Button asChild>`
- 599, 624 navigate-to-content `.btn` → `<Button>`
- 659 Pause `.btn` (min-h ok) → `<Button variant="ghost">`
- 764, 817 auto-read / speed controls → `<Button variant="ghost" size="sm">`
- 1037 Prev `.btn` → `<Button variant="outline">`
- 1053 Check, 1072 Next `.btn-primary` → `<Button>` (keep text)
- Summary buttons 1661–1729 already CONFORMING.

### pages/Review.tsx — 7 VIOLATIONS
Back-to-dashboard (outline), open-browser (default), error-back (outline), Prev (outline), Check (default), Next (default), Exit (default).

### pages/AdaptiveLesson.tsx — 7 VIOLATIONS
Same shape as Review (back/open/error/prev/check/next/exit).

### pages/ErrorReplayLesson.tsx — 6 VIOLATIONS
Back-to-browser (outline), Check (default), Next (default), Done (default), Retry (default), Back (outline).

### exercises/* shared controls (hint / submit / retry) — 13 VIOLATIONS
WordTiles (hint ghost-sm, submit default, retry outline-sm), Matching (submit, retry), PictureChoice (submit, retry), FreeText (hint, submit, retry), Cloze (hint, submit, retry). Tiles themselves = INTENTIONAL-RAW.

### components/lesson/LessonTtsMiniPlayer.tsx — 4 VIOLATIONS
Prev/Play-pause/Next/Stop → `<Button variant="ghost" size="icon">` (aria-label/aria-pressed kept).

### components/lesson/LessonResumeDialog.tsx — 2 VIOLATIONS
Continue (default), Start over (outline).

### components/LessonList.tsx — 5 VIOLATIONS
Add lesson (default), Cancel (outline), Save (default), Edit (ghost icon), Delete (destructive icon).

### CONFORMING (no change): LessonExitDialog (5), NextStepSuggestions (5).

---

## 3. Dashboard + Content Browser + Share

### pages/Dashboard.tsx — 5 VIOLATIONS
Open Settings (default), Dismiss (secondary), Pronunciation/Create-lesson/Learning-Path quick actions (secondary; already have icon + min-h, just swap element).

### components/badges/DashboardBadgeWidget.tsx — 1 VIOLATION
View-all hybrid `.btn` → `<Button variant="secondary">`. (Badge tiles/count/next = INTENTIONAL-RAW.)

### pages/Content.tsx — 1 VIOLATION
Share-with-Community button missing icon → add `Share2`/`Upload`. (Rest CONFORMING — Content is the model page.)

### components/content/ShareWizard.tsx — 8 VIOLATIONS
Regenerate (default), Show differences (link), Copy PR desc (secondary), Share manually (secondary), Share (default), Done/Close (secondary), Back (secondary), Continue (default).

### components/content/SaveOfflineLessonModal.tsx — 2 VIOLATIONS
Cancel (secondary), Save (default).

### components/content/ImportLessonModal.tsx — 2 VIOLATIONS
Cancel (secondary), Import (default).

### components/SpacedRecommendations.tsx — 2 VIOLATIONS
Start (default), Dismiss (secondary).

### components/DashboardFilterBar.tsx — 1 VIOLATION
Clear filters (secondary-sm). (Tag chips = INTENTIONAL-RAW.)

### CONFORMING: BadgeGallery, ContinueLearning, most of Content.

---

## 4. Create Lesson + Import + Anki

### pages/CreateLesson.tsx — 2 VIOLATIONS
Save-local + Save-and-share missing icons (Download / Share2). Rest CONFORMING.

### components/create-lesson/CardEditor.tsx — 8 VIOLATIONS
Add (default), CSV toggle (outline), CSV import (default), Clear-all (link), Clear cancel (secondary), Clear confirm (default), Edit cancel (secondary), Edit save (default). Drag handle + row icon actions = INTENTIONAL-RAW.

### components/create-lesson/ExerciseGenerator.tsx — 1 VIOLATION
Generate (default). Drag/delete row = INTENTIONAL-RAW.

### pages/ImportDetail.tsx — 1 VIOLATION
Cancel-analysis link `.analysis-cancel-link` → `<Button variant="link">`.

### pages/Anki.tsx — 7 VIOLATIONS
Export (default), Save edit (default), Cancel edit (outline), Accept/toggle (dynamic variant), Edit (outline), Reject (outline), Remove (destructive). Add `type="button"` where missing.

### CONFORMING: Import.tsx (2).

---

## 5. Learning Path (3 views) + Session

### pages/LearningPathPersonal.tsx — 3 VIOLATIONS
FilterToggle + ViewSwitcher (raw min-h buttons → `<Button>`/ghost), empty-state CTA Link → `<Button asChild>`.

### pages/LearningPathMap.tsx — 2 VIOLATIONS
SetMapRow toggle (ghost/outline), empty-state CTA Link → `<Button asChild>`.

### pages/LearningPathGraph.tsx — 6 VIOLATIONS
Back Link `.btn-secondary`, Reset `.btn-secondary`, content Link `.btn-primary`, two filter `.btn-secondary`, cluster + launch `.btn-primary`.

### components/learning-path/NotDownloadedSection.tsx — 2 VIOLATIONS
Toggle (ghost-sm), download (outline; add aria-label on icon-only mobile).

### components/learning-path/SetRow.tsx / LessonRow.tsx / SetDetail.tsx — Link/span styled as button
Convert to `<Button asChild><Link>` (accent/outline). Row toggle → ghost. (Several found by the LP agent — treat as P2; these are nav-affordance links, lower risk, fix carefully to preserve routing.)

### pages/Session.tsx — 1 VIOLATION
End session `.btn-danger` → `<Button variant="destructive">`.

### pages/Curriculum.tsx — 2 VIOLATIONS
Create curriculum (default), Add root topic (secondary).

### components/RatingDialog.tsx — 3 VIOLATIONS
Cancel (secondary), Submit (default), rating radio buttons (keep as radio widget — re-check; treat star/rating selectors as INTENTIONAL-RAW, only convert Cancel/Submit).

### components/MethodSwitchBanner.tsx — 2 VIOLATIONS
Dismiss/secondary + accept/default.

### INTENTIONAL-RAW: TopicNode (4), LessonNodeView (1), SetGroupNodeView (1).

---

## 6. Modals / Dialogs + Nav + Help + misc

### components/Navigation.tsx — 3 VIOLATIONS
Hamburger (ghost icon), theme toggle (ghost icon), Help (ghost). Keep aria-labels.

### components/help/HelpDrawer.tsx — 2 VIOLATIONS
Close X (ghost icon), related-concept pills (outline or keep raw with aria — treat pills as low-risk).

### components/ErrorReportDialog.tsx — 5 VIOLATIONS
View history (secondary), toggle preview (secondary), copy preview (secondary), Close (secondary), Open on GitHub (default).

### components/SyncConflictDialog.tsx — 3 VIOLATIONS
Cancel (secondary), Apply (default), Smart Merge (secondary).

### components/AddTopicDialog.tsx — 2 VIOLATIONS
Cancel (secondary), Save (default).

### components/sync/QRScannerModal.tsx — 3 VIOLATIONS
Close (ghost icon), Retry (secondary), Close (secondary).

### components/InstallPrompt.tsx — 2 VIOLATIONS
Not now (secondary), Install (default).

### pages/Onboarding.tsx — 5 VIOLATIONS
Skip (secondary), Back (secondary), Later (secondary), Create project (default). Subject-suggestion chips = INTENTIONAL-RAW.

### pages/Assessment.tsx — 4 VIOLATIONS
Continue (default), Previous (secondary), Next (default), Evaluate (default).

### pages/Landing.tsx — 2 VIOLATIONS
Language picker (role="radio" — keep as radio group, treat as INTENTIONAL-RAW) + Start CTA (default). Re-check lang picker before converting.

### pages/Pronunciation.tsx — 3 VIOLATIONS
Back (secondary), Generate/Next (default), Submit (default).

### pages/LearningRepo.tsx — 3 VIOLATIONS
Re-render / Download ZIP / Persist-to-git (secondary, icon + responsive label).

### pages/NotFound.tsx — 1 VIOLATION
Home (default).

### components/CurriculumDescriptionEditor.tsx — 3 VIOLATIONS
Edit/Add (secondary), Cancel (secondary), Save (default).

### components/editor/EditorToolbar.tsx — INTENTIONAL-RAW (20+ toggle buttons, out of scope).
