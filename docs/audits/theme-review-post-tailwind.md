# Theme Review — post-Tailwind migration

**Date:** 2026-06-04
**Branch:** `fix/theme-review-tailwind`
**Scope:** all 6 themes (light, dark, ocean, forest, high-contrast, sepia)
after the Phase B/C/D + Exercise-Renderer Tailwind migrations
(~85-90% of the app).

---

## Methodology — and its honest limit

This review was performed in a headless environment with **no browser**.
True pixel-level visual inspection (perceived contrast, focus-ring
visibility, 375px overflow, "does it look right") therefore needs
**Aster's eyes** and is listed under "Needs visual judgment" below.

What CAN be verified rigorously — and was — is **token integrity**: in
this codebase every colour flows through a CSS variable that is
redefined per `[data-theme]`, so if (a) every theme defines the same
token set, (b) no component references an undefined token, (c) no
component hardcodes a colour, and (d) the shadcn bridge maps every
semantic utility onto a themed var, then **theme-correctness holds by
construction** — a migrated component recolours across all 6 themes
exactly as its pre-migration CSS did. That is the property this audit
establishes, backed by the existing automated guards.

---

## Automated guards (all green)

| Guard | What it pins | Result |
|---|---|---|
| `styles/themes/themes.test.ts` | every theme defines the **same** token set | ✅ all 6 define an identical **43-token** set |
| `styles/contrast.test.ts` | WCAG 2.1 AA contrast across all 6 themes | ✅ pass |
| `styles/no-hardcoded-colors.test.ts` | no hardcoded colours in component styles | ✅ pass |

Combined: **200 assertions pass.**

---

## Token-integrity audit (this review)

### 1. Referenced-vs-defined token diff (whole `src/`)

Extracted every `var(--token)` referenced in `*.tsx/*.ts/*.css` and
diffed against the defined set (theme files + `global.css` aliases +
the `@theme` bridge). **No undefined-token bug exists.** Every flagged
token resolves:

- `--confetti-*`, `--radix-select-trigger-*`, `--rich-text-min-height`,
  `--x` — **runtime-injected** inline (per-particle confetti, Radix
  Select, the editor). Not theme tokens.
- `--method-*` — theme-agnostic brand palette, defined in `global.css`
  (`--method-deductive: #3b82f6`, …). Dynamic
  `var(--method-${dominant_method})` resolves to a defined token.
- `--status-error-fg`, `--status-warning-fg`, `--surface-hover` — used
  **only with a safe fallback** (`var(--surface-hover, var(--surface))`),
  so they degrade gracefully in every theme even though no theme defines
  the primary (a deliberate progressive-enhancement hook).
- `--text-muted` — defined as a legacy alias in `global.css`
  (`--text-muted: var(--fg-muted)`); resolves correctly in all themes.
  (The FreeText code-language label uses it; it is **not** undefined.)

### 2. Legacy-alias resolution

The migrated exercise renderers reuse the exact `var(--…)` names from
their original CSS (`--surface`, `--surface-2`, `--fg`, `--fg-muted`,
`--border`, `--border-strong`, `--exercise-correct/wrong/selected/matched`,
`--success`, `--danger`, `--bg-overlay`, `--shadow-elevated`). Verified:
the aliases resolve through the canonical per-theme tokens
(`--surface → --bg-surface`, `--border-strong → --border-accent`, …) and
the `--exercise-*` feedback colours are defined **per theme** (guard-pinned
parity). Because the migration copied every token, colour value, and
`color-mix` percentage **verbatim**, no per-theme rendering change was
introduced.

### 3. Hardcoded-colour scan (app-wide, incl. Tailwind arbitrary values)

Scanned all `*.tsx` for `[#hex]`, `rgb()/hsl()`, and palette literals
(`bg-white`, `text-slate-500`, …) that the CSS-only guard would not
catch. **Exactly one** hit app-wide (now fixed — see below). The
migrated exercises / Sheet / Help Drawer / Badge Gallery / Nav are
**100% token-based** (every colour is `var(--…)` or
`color-mix(... var(--…) ...)`).

### 4. shadcn semantic-token bridge

`styles/tailwind.css` maps every shadcn utility the migrated components
use (`bg-background`, `text-foreground`, `bg-card`, `bg-popover`,
`text-muted-foreground`, `border-border`, `border-input`,
`focus-visible:ring-ring`, `bg-primary`, `bg-destructive`, …) onto a
themed var. All targets are in the 43-token canonical set, so
Button / Dialog / Input / Select / Progress / Sheet / Badge recolour
across all 6 themes by construction.

### 5. `answer-feedback` interaction (verified, no regression)

Each exercise result keeps the `is-correct` / `is-wrong` markers while
the visible colour moved to a Tailwind `text-[var(--…)]` utility.
Checked the precedence: `.answer-feedback.is-correct` (unlayered) sets
only an **animation**, not a `color`, so it does **not** override the
layered Tailwind colour — the result text renders the correct,
original-matching colour AND still fires the celebration pulse/flash.
Keeping the markers was the right call.

---

## Fix applied

**`fix(theme)`: Dialog overlay → themed overlay token.**
`components/ui/dialog.tsx` rendered its scrim as `bg-black/50` — a flat,
theme-agnostic literal (the one hardcoded-colour hit). The app's native
drawers and the new `ui/sheet.tsx` use `var(--bg-overlay)`, which is
theme-aware (dark `rgba(0,0,0,.6)`, **high-contrast `rgba(0,0,0,.85)`**,
**sepia `rgba(60,45,25,.45)`** warm-tinted, …). Aligned the Dialog
overlay to `bg-[var(--bg-overlay)]` so every modal scrim is consistent
with the Sheet and correct per theme (notably a stronger scrim in
high-contrast). Affects every shadcn Dialog (ErrorReport, lesson/share
dialogs).

No other code fixes were made: the token-integrity audit found **no**
wrong-colour / undefined-token / invisible-text / missing-border defects
in the migrated surface. Forcing speculative cosmetic edits on a surface
that cannot be visually confirmed would risk introducing the very
regressions this audit rules out, so they were deliberately not made.

---

## Per-screen status (token-level)

All screens below render through the audited token surface; none
reference an undefined token or a hardcoded colour. Marked ✅ = token-clean.

| Screen | Status |
|---|---|
| Dashboard (Continue Learning, XP, streak, missions, badges) | ✅ token-clean |
| Content Browser (search, tree, My Lessons, download) | ✅ token-clean |
| Lesson Viewer (theory + all 5 exercise types + result + summary) | ✅ token-clean (exercises migrated this cycle, verbatim colours) |
| Learning Path (set rows, lesson detail, progress dots) | ✅ token-clean *(actively being redesigned in parallel — re-check after that merge)* |
| Create Lesson (4 steps) | ✅ token-clean |
| Import (language pickers, analysis) | ✅ token-clean (Radix Select via bridge) |
| Share Wizard (4 steps) | ✅ token-clean |
| Settings (all tabs) | ✅ token-clean |
| Error Replay | ✅ token-clean |
| Help Drawer / Badge Gallery (Sheet) | ✅ token-clean (themed `--bg-overlay`, 44px close) |

---

## Needs Aster's visual judgment (cannot be verified headless)

1. **shadcn `accent` = brand tint (by design).** The bridge intentionally
   leaves shadcn's `bg-accent` (a "hover surface" token) resolving to the
   **brand accent tint** rather than a neutral grey (documented in the
   migration guide). Any shadcn component using `hover:bg-accent` shows a
   brand-coloured hover. Confirm this reads well in every theme,
   especially **high-contrast** and **sepia**.
2. **Exercise feedback tints in high-contrast.** Correct/wrong/selected
   tiles use `color-mix(... 12-18% ... , var(--surface))`. These
   percentages are **unchanged from the original CSS**, but high-contrast
   users may benefit from stronger tints — a pre-existing question the
   migration did not alter. Visual call.
3. **Hint-toggle touch target.** The FreeText / Cloze / WordTiles
   "Need a hint?" text links gained `min-h-11` (44px) for the touch-target
   guideline; this adds a little vertical space around the link. Confirm
   it looks intentional, not loose.
4. **Focus-ring visibility** on keyboard nav across themes (inputs use
   `focus:outline`/`focus:shadow` with `--accent`; shadcn uses
   `ring-ring` → `--accent`). Tab through a lesson + a dialog in each theme.
5. **375px overflow** on the exercise screens (grids/tiles/word-tile rows)
   and Settings — layout, not colour; needs a real viewport.

---

## Conclusion

The Tailwind migration is **theme-correct by construction**: 43-token
parity across all 6 themes (guard-pinned), WCAG AA contrast (guard-pinned),
zero undefined-token references, zero hardcoded colours in the migrated
surface, full shadcn bridge coverage, and verbatim colour values carried
over from the original CSS. One genuine consistency defect (a flat
`bg-black/50` Dialog scrim) was found and fixed. Remaining items are
visual-judgment calls, not token defects, and are listed above for a
real-browser pass across the 6 themes.
