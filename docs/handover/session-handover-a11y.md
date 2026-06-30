# Session Handover — Phase 39 (WCAG 2.1 AA Accessibility Audit)

**Target release**: v1.24.0
**Status at handover**: planned, not started
**Created**: 2026-05-23 (during v1.23.2)
**Self-contained**: this document is the complete brief. A
fresh Claude Code session should be able to start with it +
the current `main` branch and ship Phase 39 end-to-end.

---

## Why this phase exists

v1.23.2 closed three specific issues (Recharts dimension
warning, HelpTooltip visibility, icon-button tooltip sweep).
During the same session the user added a comprehensive
accessibility audit as a "v1.23.2 must-have" — but the scope
was clearly a minor-release shape (7 atomic commits, ~30
files, new dependencies, audit doc). We negotiated the
scope: v1.23.2 ships the three bug fixes; the full audit
ships as **Phase 39 / v1.24.0** with its own changelog and
audit doc.

The user's stated motivation: "This is not optional — it's a
legal requirement in many markets (WCAG 2.1 AA)." Take this
as a hard constraint. The target is WCAG 2.1 Level AA, not
AAA (AAA is aspirational).

## Pre-flight (start of session)

```bash
git log --oneline -10
make test       # MUST stay green throughout the phase
cd frontend && npm run build
cd ..
```

Last release tag should be `v1.23.2`. Baseline tests:
- Backend pytest: 848 passed + 1 skipped
- Frontend Vitest: 1401 passed (124 files)
- Build: 50 precache entries, ~3527 KiB

If those numbers don't match, surface the delta before
starting — there have been intervening commits that may
have shifted the baseline.

## Scope — seven atomic commits

The user laid out a precise commit structure. Stick to it
unless a logical group genuinely combines (e.g. a single
file touched by two commits gets split cleanly via two
edits). Each commit must be green on its own (`make test` +
`npm run build` clean).

### C1 — Skip-to-content link + semantic HTML + landmark structure

**Acceptance**:
- A "Skip to main content" link is the FIRST focusable
  element in the DOM. Hidden visually until focused (the
  standard `clip: rect(0,0,0,0)` until `:focus` then
  reveals to the top-left). Skips to `#main` (the page's
  `<main>` element).
- Every page uses semantic landmarks: `<nav>` for
  navigation, `<main>` for the primary content
  (id="main"), `<header>` for the app header,
  `<footer>` if present.
- Heading hierarchy verified: every page has exactly one
  `<h1>`; `<h2>` follows `<h1>`; no skipped levels.
- Lists use `<ul>`/`<ol>`/`<li>`, not `<div>` + bullets
  (audit `frontend/src/components` and `frontend/src/pages`).
- Tables use `<th scope="col">` / `<th scope="row">` where
  applicable.

**Files likely touched**: `App.tsx` (wrap routes in
`<main id="main">`), `Navigation.tsx` (already `<nav>`),
each page component (verify `<main>` wrap + h1 presence),
`global.css` (skip-link visually-hidden + focus rules).

**Test**: `frontend/src/components/SkipToContent.test.tsx`
asserting first-focusable + visibility-on-focus + href
target. Plus an E2E spec on the smoke list verifying
keyboard `Tab` lands on the skip link first.

**Commit message hint**: `feat(a11y): skip-to-content link + landmark structure (Phase 39 C1)`

### C2 — Keyboard navigation + focus management

**Acceptance**:
- Every page is fully operable with keyboard only (`Tab`,
  `Shift+Tab`, `Enter`, `Space`, `Escape`, arrow keys).
- Focus indicators visible on every interactive element.
  Project uses `outline` already (`global.css` line range
  ~ search for `:focus-visible`); verify nothing has
  `outline: none` without a replacement.
- Modals/drawers close on `Escape`. Verify:
  `ErrorReportDialog`, `HelpDrawer`, `RatingDialog`,
  `AddTopicDialog`, `QRScannerModal`,
  `SyncConflictDialog`. Radix Dialog handles this by
  default; non-Radix custom modals need explicit
  `addEventListener('keydown', escape)`.
- `SessionChat` input receives focus automatically on
  mount (already does via the existing textarea ref —
  verify).
- `RatingDialog` 1-5 buttons use the radio-group pattern
  (already `role="radiogroup"` + `role="radio"` —
  verify arrow key navigation works; if not, add
  keyboard handlers).
- Tab order is logical (left-to-right, top-to-bottom) on
  every page. The Dashboard, Settings, and Curriculum
  pages are the riskiest because they have many
  controls.

**Files likely touched**: `App.tsx`, custom modals,
`RatingDialog.tsx`, page components.

**Test**: focused unit tests where possible; the broad
keyboard walkthrough may need a manual checklist documented
in the audit doc (C4 covers the doc).

**Commit message hint**: `feat(a11y): keyboard navigation + focus management (Phase 39 C2)`

### C3 — ARIA attributes pass

**Acceptance**:
- All form inputs have associated `<label htmlFor=>` +
  matching `id`. Placeholders are NOT a substitute for
  labels.
- Required fields marked with `aria-required="true"` (or
  the native `required` attribute, which is equivalent).
- Validation errors linked to their fields via
  `aria-describedby`. Surface the error text in a
  ``<span id="<field>-error">`` near the field.
- Toast notifications get `role="alert"` (react-toastify
  has this built-in; verify it lands on the right
  elements).
- Loading states announced via `aria-busy="true"` on the
  loading container + `aria-live="polite"` on a status
  region when relevant.
- Every icon-only button has `aria-label` (the v1.23.2
  sweep covered the user-listed surfaces; do a fresh
  grep to find any remaining gaps).

**Audit recipe**:

```bash
# Buttons without aria-label (false positives expected; manual review):
grep -rn "<button" frontend/src --include="*.tsx" \
  | grep -v ".test." \
  | grep -v "aria-label" \
  | head -40

# Inputs without associated label:
grep -rn "<input" frontend/src --include="*.tsx" \
  | grep -v ".test." \
  | grep -v "htmlFor\|aria-label" \
  | head -40
```

**Files likely touched**: form components (Onboarding,
Settings, Curriculum, ImportDetail, RatingDialog), toast
config in `App.tsx`.

**Test**: per-form unit tests verifying label+input
association via `getByLabelText`.

**Commit message hint**: `feat(a11y): ARIA labels + live regions + form associations (Phase 39 C3)`

### C4 — Chart accessibility (text alternatives)

**Acceptance** — three components, three deliverables each:

| Chart | Text summary | Data table alternative | aria-label |
|---|---|---|---|
| `ProfileRadar` | "Deine staerkste Methode: Deduktiv (0.8)" rendered as a visible caption below or beside the chart | Optional — the radar's data points map to 6 method weights, can list them | `aria-label` on `<RadarChart>` parent reflecting the dominant method |
| `ProgressTimeline` | "10 sessions over 4 weeks; understanding trending up" caption | "Show as table" toggle revealing a `<table>` with the same data (session #, understanding, stress) | `aria-label` summarising current period |
| `MethodDistribution` | "Most used: Deduktiv (3 sessions, 42%)" caption | Optional — bar chart values can list inline | `aria-label` reflecting the top method |
| `StreakCalendar` | Each cell already has visible date + count; ensure `aria-label="3 Sessions am 15. Mai"` per cell | N/A (already tabular layout) | Already has per-cell labels via inline tooltip |

**Implementation pattern**: extract a `<ChartSummary>`
component that takes the same data the chart consumes and
renders a screen-reader-only `<div className="sr-only">`
plus a visible caption (configurable via prop). The data
table alternative ships behind a `<details><summary>` so
sighted users don't see the table by default but anyone can
expand it.

**i18n**: new `ui.a11y.chart_summary_*` keys. 8 catalogs.
EN + DE handwritten. PT/TR/JA translated. ES/FR/EL
passthrough (per the existing project pattern).

**Files likely touched**:
`frontend/src/components/{ProfileRadar,ProgressTimeline,MethodDistribution,StreakCalendar}.tsx`
plus a new `components/charts/ChartSummary.tsx` helper.

**Test**: per-chart test asserting both the visible
summary text + the screen-reader-only summary text are
rendered, plus the data-table toggle.

**Commit message hint**: `feat(a11y): chart text summaries + data table alternatives (Phase 39 C4)`

### C5 — Color contrast + colorblind-safe method colors

**Acceptance**:
- Every text + background pair meets WCAG AA contrast:
  4.5:1 for normal text, 3:1 for large text (>=18pt or
  14pt bold). Use a tool like contrast-checker; the
  audit doc records the actual ratios per palette.
- The 5 theme palettes × light/dark = 10 variants all
  pass. Check `--fg` on `--bg`, `--fg-muted` on
  `--surface`, button text on accent backgrounds, etc.
- Method colors (`METHOD_COLORS` in
  `frontend/src/lib/constants.ts` — 6 entries) are
  distinguishable for deuteranopia + protanopia
  (red-green colorblindness, the most common forms).
  Use a simulator (Color Oracle, Sim Daltonism, or
  online tool); if any two methods become
  indistinguishable, swap one to a different hue + add a
  texture/pattern alternative.
- Information NEVER conveyed by color alone. Status dots
  must pair with a text label or icon. Method badges
  already pair color + text — good.
- High-contrast mode (Windows / Chrome) doesn't break
  the layout. Test with `forced-colors: active`; ensure
  `--fg` / `--bg` aren't hardcoded.

**Files likely touched**: `frontend/src/styles/global.css`,
`frontend/src/lib/constants.ts` (METHOD_COLORS).

**Test**: a Python or TypeScript helper that computes
contrast ratios and asserts they meet AA. Place in
`backend/tests/test_color_contrast.py` or
`frontend/src/styles/contrast.test.ts`.

**Commit message hint**: `feat(a11y): WCAG AA color contrast + colorblind-safe method colors (Phase 39 C5)`

### C6 — `@axe-core/react` integration + fix remaining violations

**Acceptance**:
- `@axe-core/react` added to `frontend/devDependencies`.
  NEVER ship in production.
- Dev-mode hook in `frontend/src/main.tsx`:

  ```tsx
  if (import.meta.env.DEV) {
    import('@axe-core/react').then(({default: axe}) => {
      import('react').then((React) => {
        import('react-dom').then((ReactDOM) => {
          axe(React, ReactDOM, 1000);
        });
      });
    });
  }
  ```

- Run the app, navigate through every route, capture the
  axe console output, fix every "critical" and "serious"
  violation. "Moderate" violations fixed where feasible.
  "Minor" violations documented in
  `docs/audits/wcag-YYYY-MM-DD.md`.
- `make test` + `npm run build` stay green after every
  fix. Bundle impact zero (axe is dev-only).

**Files likely touched**: `frontend/package.json`,
`frontend/src/main.tsx`, plus whatever components axe flags.

**Test**: dev-only — axe runs in the browser console.
Production bundle verification: `npm run build` then
`grep axe dist/assets/*.js` — should be empty.

**Commit message hint**: `feat(a11y): @axe-core/react integration + critical/serious violations fixed (Phase 39 C6)`

### C7 — `prefers-reduced-motion` audit

**Acceptance**:
- Every CSS animation respects
  `@media (prefers-reduced-motion: reduce)`. Existing
  rules in `global.css` (lines ~475, ~498, ~893) cover
  some — verify they cover ALL animations.
- The cycle-progress pulse, XP notification slide,
  swipe-gesture indicator, typing indicator scan line,
  and the new help-term hover transition: each should
  short-circuit to either no animation or an instant
  state change.
- The Phase 38 HelpTooltip transition
  (`transition: background-color 120ms ease-in-out`)
  should respect the preference. Either add the rule in
  `global.css` or use the CSS-in-JS pattern.

**Implementation**: one new media query block in
`global.css` listing every selector that animates, with
`animation: none !important; transition: none !important;`.

**Test**: a CSS-rule presence test — read `global.css`,
verify the `prefers-reduced-motion: reduce` block contains
every animated selector. Place in
`frontend/src/styles/global.test.ts` (new file).

**Commit message hint**: `feat(a11y): prefers-reduced-motion respected across all animations (Phase 39 C7)`

## The audit document

**Path**: `docs/audits/wcag-YYYY-MM-DD.md` (use the date of
the session that writes it).

**Required sections**:

1. **Standard targeted**: WCAG 2.1 Level AA.
2. **Date + Adaptive Learner version**: snapshot.
3. **Tools used**: `@axe-core/react` (versioned), manual
   keyboard testing (describe the walkthrough), color
   contrast tool (e.g. WebAIM Contrast Checker, link).
4. **Per-page walkthrough**: for each of the 13 routes,
   describe what VoiceOver / NVDA would announce as the
   user tabs through. We can't run a real screen reader,
   but we can describe the expected announcement from the
   markup. Format:

   ```
   ## /dashboard
   1. Tab -> "Skip to main content, link"
   2. Tab -> "Adaptive Learner, link to Home"
   3. Tab -> "Dashboard, current page, navigation"
   ...
   ```

5. **Findings by severity**: critical / serious / moderate /
   minor. Each entry: violation type (axe rule id),
   affected files, fix or deferred-with-reason.
6. **Deferred items**: anything punted to a later release,
   with a rationale and a backlog item ID.
7. **Regression hooks**: list every test added during the
   audit so future regressions surface in CI.

The audit doc is the AUDIT TRAIL. Treat it like the
v0.30.0+ MkDocs nav discipline — checked in CI later. For
now, manual but always present.

## Stop conditions

The user said "If unsure: STOP and ask". Real STOP triggers
during this phase:

- A WCAG criterion that requires a substantial UX rework
  (e.g. the assessment question UI doesn't map cleanly to
  a radio group → ask before redesigning).
- A color-contrast failure that would require changing the
  brand palette (`--accent` etc.) → ask, this is a brand
  decision.
- A keyboard-navigation contract that conflicts with the
  swipe-gesture system (Phase 23E) → ask before disabling
  swipe in keyboard mode.
- The audit doc finds an "AAA" item the user wants fixed.
  AAA is aspirational; if a fix is cheap, do it; if not,
  surface the trade-off.

## Release: v1.24.0

After C1-C7 + the audit doc land:

1. Bump `backend/pyproject.toml` to `1.24.0`.
2. `make sync-versions` + `make sync-versions-check`.
3. Write `changelog/releases/v1.24.0.md` (use v1.23.2's
   format as a template). Include the link to the audit doc.
4. `make test` + `npm run build` green.
5. `git commit -m "chore(release): bump version to v1.24.0"`.
6. `git tag -a v1.24.0`.
7. `git push origin main --tags`.
8. `gh release create v1.24.0 --notes-file
   changelog/releases/v1.24.0.md --title "Adaptive Learner
   v1.24.0"`.

## Backlog items to file or update

- `WCAG-AAA-ASPIRATIONAL` (P5) — any AAA items that
  surfaced during the audit but didn't ship. List each
  with a one-line rationale for deferral.
- `HELP-CONTENT-TRANSLATIONS-01` (P3, already filed) —
  Phase 39 will likely add new tooltip / chart-summary
  strings that land as EN-passthrough for ES/FR/EL.
  Update the item with the new key prefixes.

## Anti-scope (do NOT do in Phase 39)

- Do not rewrite the i18n catalog structure. Stay within
  the existing `ui.*` / `ui.tooltips.*` / `ui.a11y.*`
  namespaces.
- Do not change the swipe-gesture system. It's
  preference-gated and keyboard users skip it.
- Do not migrate to a new dialog primitive. Radix Dialog
  (Phase 37) + the inline-styled custom dialogs are the
  current shape. Audit them as-is.
- Do not add server-side accessibility logic. The audit is
  pure frontend.
- Do not bump dependencies beyond `@axe-core/react`. The
  Phase 38 stack (react-markdown, Radix, lucide-react)
  stays on its current pins.

## Files that already have good a11y patterns to mirror

- `MicButton.tsx`, `SpeechButton.tsx`, `HelpLink.tsx` —
  the `useButtonTooltips` + `aria-label` always pattern.
- `RatingDialog.tsx` — `role="radiogroup"` + per-button
  `aria-checked` shape is correct.
- `Navigation.tsx` — landmark + skip-link friendly
  starting point.
- `ErrorReportDialog.tsx`, `HelpDrawer.tsx` — Radix
  Dialog with `aria-label` on close and focus management.

## Files known to need work (a non-exhaustive starting list)

- `pages/Settings.tsx` — many controls, complex form
  structure; verify label-input associations.
- `pages/Curriculum.tsx` — tree structure; verify
  keyboard navigation works for `TopicTree`.
- `pages/Assessment.tsx` — question flow; verify radio
  groups + arrow key navigation.
- `components/SyncSection.tsx` — copy/paste UI; verify
  copy buttons have aria-labels.
- `components/CurriculumDescriptionEditor.tsx`,
  `components/LessonList.tsx` — rich text editors;
  verify TipTap's built-in a11y + custom toolbar buttons.

## One more thing

The Phase 38 commit chain is the model for atomic
green-between-commits work. Mirror that discipline here.
Each of the 7 sub-commits should leave `make test` +
`npm run build` clean; the audit doc is updated
incrementally (not deferred to the end).

Good luck. The work is real but well-scoped.
