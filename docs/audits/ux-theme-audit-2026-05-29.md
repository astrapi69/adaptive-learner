# UX/UI + Theme Audit — Dark Mode Focus

**Date:** 2026-05-29
**Phase:** 58A (v1.41.0 — UX/UI Audit + Theme System)
**Author:** Claude Code (review-before-fix gate)
**Status:** AUDIT ONLY — no fixes applied. Awaiting review before 58B+.

---

## Pre-flight baseline (all green)

| Check | Result |
|-------|--------|
| `make test` | 216 files / **2351** passed |
| `npm run build` | built, no errors |
| `npm run test` (Vitest) | covered by `make test` Vitest run (2351) |
| `make test-dexie-smoke` | **19** passed |

## Methodology

This is a **code-grounded** audit, not a screenshot sweep. Every issue is
pinned to a `file:line` and the exact CSS token involved, cross-referenced
against the *actual* dark-theme token set in
[global.css](../../frontend/src/styles/global.css#L77-L92). A code audit is
more actionable here than screenshots: it gives exact remediation targets and
catches the silent class of bug (a `var(--token)` that resolves to a
light-mode fallback because `--token` is never defined in either theme block —
invisible to the eye until you read the variable, then obviously wrong).

Where a "visual check in a running browser" is still required (e.g. confirming
a `color-mix` tint is bright enough at a given opacity), it is flagged as
**[needs visual confirm]** and will be re-verified in 58H.

## Current theme architecture (as-is)

- **One dimension only:** `data-theme="light"` (the `:root` defaults) and
  `data-theme="dark"`. Set by [useTheme.ts](../../frontend/src/hooks/useTheme.ts)
  in a `useEffect`, persisted to `localStorage["adaptive-learner-theme"]`.
- **33 CSS custom properties** defined in `:root`; the dark block overrides
  **15** of them. The rest are neutral/shared (spacing, radius, fonts, method
  palette) and intentionally inherit.
- **No `data-app-theme` dimension** (the architecture.md "5 palettes"
  description is stale Bibliogon residue — it does not exist in this codebase).
- **No pre-paint theme script** in [index.html](../../frontend/index.html):
  the `data-theme` attribute is only applied after React mounts and the
  `useEffect` fires → flash of light theme on every load in dark mode.

---

## Systemic findings (root causes — fix once, fixes many pages)

### F1 — Undefined semantic tokens silently fall through to light hex *(HIGH / dark-mode-breaking)*

10 semantic tokens are referenced via `var(--token, #lightfallback)` but are
**never defined** in `:root` *or* the dark block. In dark mode they resolve to
the light-mode hex fallback → a light-colored chip on a dark page.

Undefined-but-referenced (from `comm` diff of defined vs referenced):
`--info`, `--info-bg`, `--warning-bg`, `--surface-3`, `--text`, `--text-muted`,
`--bg-elevated`, `--accent-subtle`, `--muted`, `--shadow-md`.

Concrete dark-mode bugs this produces:

| File:line | Code | Dark-mode result |
|-----------|------|------------------|
| [Dashboard.tsx:225-227](../../frontend/src/pages/Dashboard.tsx#L225) | `var(--info-bg, #e3f2fd)` / `var(--info, #0d47a1)` | light-blue banner + dark navy text on dark page |
| [ApiKeyRequiredNotice.tsx:96-98](../../frontend/src/components/ApiKeyRequiredNotice.tsx#L96) | `var(--warning-bg, #fff3cd)` / `var(--warning, #856404)` | pale-yellow box, brown text — washed out on dark |
| [ImportDetail.tsx:593-594](../../frontend/src/pages/ImportDetail.tsx#L593) | `var(--warning-bg, #fff3cd)` | same pale-yellow on dark |
| [QRScannerModal.tsx:104-131](../../frontend/src/components/sync/QRScannerModal.tsx#L104) | `var(--surface, #fff)` / `var(--text, #000)` | `--text` is undefined → **black text** on dark modal |
| [DangerZoneSection.tsx:347](../../frontend/src/components/DangerZoneSection.tsx#L347) | `var(--surface-3, #ccc)` | light-grey track on dark |

**Root fix:** 58B defines the complete semantic token set in *every* theme.
Once `--info-bg`, `--warning-bg`, `--text`, `--surface-3` etc. exist, all of
these resolve correctly with zero per-component changes.

### F2 — Hardcoded colors in inline `style={{}}` (`.tsx`) *(MEDIUM)*

- **6** truly hardcoded color literals (no `var()`), **32** `var(--x, #hex)`
  with a light-mode fallback (the F1 class).
- True-hardcoded inventory:
  - [ProgressTimeline.tsx:104,112](../../frontend/src/components/ProgressTimeline.tsx#L104) — `stroke="#10b981"` / `"#ef4444"` (chart lines, see F4)
  - [Confetti.tsx:32-34](../../frontend/src/components/feedback/Confetti.tsx#L32) — `#fbbf24` / `#ec4899` / `#38bdf8` (decorative particles — review for visibility on each theme, not a contrast blocker)
  - [QRScanner.tsx:186](../../frontend/src/components/sync/QRScanner.tsx#L186) — `background: "#000"` (camera viewport — intentional, black is correct for a camera frame)
  - `DEFAULT_COLOR = "#6366f1"` in [TagManager](../../frontend/src/components/TagManager.tsx#L32) / [DashboardFilterBar](../../frontend/src/components/DashboardFilterBar.tsx#L98) / [ProjectTaxonomy](../../frontend/src/components/ProjectTaxonomy.tsx#L29) — user-tag default color seed; legitimate data, not chrome.
- Overlay scrims hardcoded as `rgba(0,0,0,0.5)` / `rgba(15,23,42,0.45)` in
  [SyncConflictDialog](../../frontend/src/components/SyncConflictDialog.tsx#L187),
  [ErrorReportDialog](../../frontend/src/components/ErrorReportDialog.tsx#L121),
  [BadgeGallery](../../frontend/src/components/badges/BadgeGallery.tsx#L128),
  [HelpDrawer](../../frontend/src/components/help/HelpDrawer.tsx#L80),
  [QRScannerModal](../../frontend/src/components/sync/QRScannerModal.tsx#L89).
  These should become `var(--bg-overlay)` (spec's overlay token) so each theme
  controls scrim darkness.

### F3 — Hardcoded colors in `global.css` outside the token blocks *(MEDIUM-HIGH)*

**54** hardcoded `#hex`/`rgba()` occurrences in CSS rules below line 160
(excluding the `.hljs-*` syntax-highlight block, which is already
dark-scoped). The big clusters:

- **Exercise feedback** (see F8): `.matching-tile.is-correct`,
  `.picture-tile.is-correct`, `.free-text-result`, `.word-tile.is-correct`,
  `.word-tiles-result`, `.lesson-summary-breakdown-row.is-correct/.is-wrong`
  all hardcode `#10b981` (green) / `#ef4444` (red).
- **Streak / celebration**: `#fbbf24` (amber star/glow) at lines 2476, 2725,
  2740, 2583-2585.
- **Status `color-mix` blends**: lines 5811-5903 hardcode `#f59e0b`,
  `#22c55e`, `#ef4444`, `#16a34a`, `#b45309`, `#b91c1c` for badge difficulty +
  warning surfaces.

### F4 — Recharts charts are not theme-aware *(HIGH for dark)*

Recharts `CartesianGrid`, `XAxis`, `YAxis`, `PolarGrid`, `PolarAngleAxis`,
tooltips render with **library-default light-grey** stroke/tick colors when no
explicit color is passed. On a dark background grid lines and axis labels are
near-invisible.

- [MethodDistribution.tsx:101](../../frontend/src/components/MethodDistribution.tsx#L101) — `<CartesianGrid>` default stroke
- [ProgressTimeline.tsx:95-112](../../frontend/src/components/ProgressTimeline.tsx#L95) — grid + axes default; lines hardcoded `#10b981`/`#ef4444`
- [ProfileRadar.tsx:100-106](../../frontend/src/components/ProfileRadar.tsx#L100) — polar axis defaults; fill `#6366f1` fallback
- [StreakCalendar.tsx](../../frontend/src/components/StreakCalendar.tsx) — heatmap cell scale [needs visual confirm on dark]
- All tooltips: default white background → fine in light, wrong in dark.

**Fix (58F):** thread CSS variables (`--chart-1..6`, `--border-subtle`,
`--fg-muted`) into Recharts `stroke`/`fill`/`tick`/`contentStyle` props.

### F5 — Flash of wrong theme on load *(MEDIUM)*

No inline `<script>` in `index.html` reads `localStorage` and sets
`data-theme` before first paint. Dark-mode users see a white flash every load.
Fix in 58E (spec requirement: applied before React mounts).

### F6 — localStorage key mismatch with spec *(LOW — decision needed)*

Current key: `adaptive-learner-theme`. Phase 58E spec says
`adaptive-learner.theme`. **Assumption taken:** keep the existing hyphen key
`adaptive-learner-theme` to avoid silently resetting every existing user's
saved preference; treat the spec's `.theme` as illustrative. **Flag for
review** — if a clean break is wanted, add a one-time migration read of the old
key. (See Questions & assumptions.)

### F7 — Token set is incomplete vs the target semantic system *(this is 58B)*

Only 33 tokens today; many are ad-hoc (`--surface`, `--surface-2`,
`--bg-alt`). The spec's target set (`--bg-primary/secondary/surface/elevated/
overlay`, `--fg-primary/secondary/muted/inverse`, `--border-*`,
`--interactive-*`, full `--success/-bg`, `--error/-bg`, `--warning/-bg`,
`--info/-bg`, `--accent/-hover/-fg/-subtle`, `--chart-1..6`,
`--exercise-correct/-wrong/-selected/-matched`) is not yet defined. 58B will
introduce these and alias the legacy names so existing rules keep working
during migration.

### F8 — Exercise feedback hues are fixed, not tokenized *(HIGH for dark/ocean/forest)*

Exercise correct/wrong states blend a fixed `#10b981`/`#ef4444` into
`var(--surface)` via `color-mix` (e.g.
[global.css:2955-2964](../../frontend/src/styles/global.css#L2955)). The
surface part adapts, but at 12-18% the fixed hue over a *dark* surface can drop
below a usable contrast, and over a *colored* theme (ocean/forest) green-on-
teal or red-on-green muddies. Needs `--exercise-correct/-wrong/-selected/
-matched` tokens with per-theme brightened values. **[needs visual confirm]**
especially dark + ocean + forest per the phase rules.

---

## Per-page dark-mode checklist

Legend: ✅ no theme-specific issue found · ⚠️ issue(s) below · 🔎 visual confirm in 58H

| Page / surface | Status | Notes (→ finding) |
|----------------|--------|-------------------|
| Landing | 🔎 | mostly token-driven; confirm hero/CTA contrast |
| Onboarding | 🔎 | step indicators — confirm active-step contrast |
| Assessment | 🔎 | option selected-state contrast |
| **Dashboard** | ⚠️ | info banner light-blue in dark (F1); widget cards 🔎; charts (F4); streak heatmap (F4) |
| — XP / level widget | 🔎 | progress bar contrast (F8-adjacent) |
| — Badge widget / gallery | ⚠️ | overlay scrim hardcoded (F2); locked-grey medallion on dark 🔎 |
| — Streak heatmap | ⚠️ | cell color scale not theme-aware (F4) |
| — Missions card | 🔎 | difficulty badge colors (F3, lines 5894-5903) |
| — Focus areas card | 🔎 | |
| **Session chat** | 🔎 | AI/user/system bubble backgrounds — confirm distinct in dark; step progress |
| **Lesson viewer** | ⚠️ | all 5 exercise types use fixed feedback hues (F8); summary stars `#fbbf24` (F3); correction block 🔎 |
| Review session | ⚠️ | reuses exercise components (F8) |
| Adaptive lesson | 🔎 | transparency/improvement banners — check token usage |
| Content browser | 🔎 | `.content-set-cached` uses `#10b981` (F3, line 2188) |
| Import / Analysis | ⚠️ | warning box light-yellow in dark (F1, ImportDetail:593); result borders ok (var) |
| Curriculum | 🔎 | topic tree + TipTap content |
| **Progress page** | ⚠️ | all charts not theme-aware (F4) |
| **Settings** | ⚠️ | DangerZone track `--surface-3` undefined (F1); generally token-driven |
| Help drawer | ⚠️ | overlay scrim hardcoded (F2) |
| Error dialogs / toasts / modals | ⚠️ | overlay scrims hardcoded (F2); toast bg 🔎 |
| Sync (QR scanner/modal) | ⚠️ | `--text` undefined → black text on dark modal (F1) |
| About / Identity / Donation | ⚠️ | `var(--danger, #c00)` ok-ish; DonationSection `rgba(255,255,255,0.2)` chip (F2) |

---

## Prioritized remediation map (drives 58B–58G)

| Pri | Finding | Resolved by |
|-----|---------|-------------|
| **A (dark-breaking)** | F1 undefined tokens | 58B (define full set) + 58C |
| **A** | F4 charts not theme-aware | 58F |
| **A** | F8 exercise feedback hues | 58B (tokens) + 58G |
| **B** | F3 hardcoded CSS status/feedback | 58B + 58C |
| **B** | F2 overlay scrims + inline hex | 58C |
| **B** | F5 pre-paint flash | 58E |
| **C** | F7 complete semantic system | 58B |
| **C (decision)** | F6 localStorage key | 58E (see Q&A) |

---

## Questions & assumptions

- **F6 localStorage key (NON-BLOCKING, conservative assumption taken):** spec
  says `adaptive-learner.theme`; code uses `adaptive-learner-theme`. Assumed
  **keep the existing key** so current users don't lose their saved preference,
  and add a migration read if a rename is desired. → review decision wanted.
- **Badge medallion colors (evidence-based answer):** bronze/silver/gold hex in
  [badge-svg.ts:40-43](../../frontend/src/lib/badges/badge-svg.ts#L40) are
  *semantic to the tier*, not theme chrome — kept as-is. Only the `locked` grey
  on a dark surface needs a visual check (🔎, 58G), not retokenizing.
- **Confetti/celebration particle colors (evidence-based answer):** decorative,
  over an overlay; kept as fixed festive palette but checked for visibility per
  theme in 58G rather than tokenized to semantic vars.
- **Visual-confirm items (🔎 / [needs visual confirm]):** every such item is
  re-verified in 58H by walking light, dark, high-contrast, ocean, forest in a
  running build. No 🔎 item is closed on code inspection alone.
- **Methodology limit:** no live screenshots captured in this pass; findings
  are static + token-resolution analysis. This is faithfully a *code* audit.

---

## Net result

The dark-mode problems are concentrated and mostly **systemic**, not
scattered per-component bugs: the dominant cause (F1) is a set of ~10
undefined tokens, and the second (F4) is Recharts defaults. Fixing the token
system (58B) + charts (58F) + exercise tokens (58G) resolves the large
majority. The per-component inline-hex cleanup (F2/F3) is mechanical. This
maps cleanly onto the planned 58B–58G sub-phases.
