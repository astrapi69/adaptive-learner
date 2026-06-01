# Mobile horizontal-scroll audit (P0)

**Date:** 2026-06-01
**Scope:** GH-Pages-shape (Dexie) build, measured at 320 / 375 / 414 px.
**Method:** Playwright against `vite preview` of the dexie `dist/`. For
each state: `documentElement.scrollWidth > clientWidth` (does the page
scroll) AND a per-element `getBoundingClientRect().right > viewport`
sweep (the ROOT cause, since the global `overflow-x: hidden` guard rail
clips the body but elements still report their real layout box).
Elements managing their own overflow (`overflow-x: auto|scroll|hidden`)
and `position: fixed` are excluded.

## Headline

The app is **mostly** responsive already — a prior fix
(`ae6ab92 fix(css): stop horizontal page scroll on mobile`) added the
global guard rails, and `e2e/dexie/no-horizontal-scroll.spec.ts` pins
**15 routes × 320/375/414** green. **But that spec has a blind spot:**
in a fresh Dexie session the **authenticated** routes (Dashboard,
Session, Progress, Settings) **redirect to onboarding**, so the spec
measures the onboarding redirect target, NOT the real pages. It also
visits a **stale / not-cached lesson route**, so it never renders real
lesson content. The real overflows live in exactly those blind spots.

## Confirmed overflows (root causes)

| # | Page / state | Element | Width(s) | right= | Cause |
|---|---|---|---|---|---|
| 1 | **Dashboard** (profile radar card) | `.dashboard-card` → `.profile-radar` → `.recharts-responsive-container` / `.recharts-wrapper` | **320 + 375** | ~817 (card sw≈816) | The Recharts radar renders at a fixed ~792px and the `.dashboard-card` (a grid item with default `min-width: auto`) grows to fit it, blowing out the grid cell. Missing `min-width: 0` on the card + a width-100% chain on the chart container. **This is the headline P0.** |
| 2 | **Settings → AI tab** | `.api-key-source` / `.api-key-source-none` ("Key from: …" badge) | **320 + 375** | 388 | The provider-key source badge is non-wrapping / too wide for the narrow column. |
| 3 | **Session header** | `.session-header-chips` / `.provider-chip` / `.provider-chip-model` | **320** only | 354 | The provider/model chips in the session header don't wrap at 320px. |

## Verified CLEAN

- Static unauthenticated routes (Landing, Onboarding, Assessment,
  Content, Import, ImportDetail, NotFound) at 320/375/414 — existing
  spec, green.
- **Lesson theory with markdown conjugation tables** (es-a1 04
  ser/estar, 06 -AR verbs) at 320px — the global
  `table { display:block; overflow-x:auto }` handles them. The newly
  authored Spanish A1 lessons do **not** overflow.
- **Matching exercise** rendered at 320px (verified twice) — clean
  (its columns stack to 1fr ≤600px).
- Progress, Curriculum (authenticated) at 320/375 — clean.
- Settings tabs general / learning / plugins / data / help / about at
  320/375 — clean (only the **AI** tab overflows).
- Session header at 375px — clean (only 320px overflows).

## NOT conclusively measured (recommend covering in the regression spec)

- **Badge gallery** drawer — its open trigger (`settings-view-all-badges`,
  Settings → plugins) didn't surface reliably in the harness; measure
  after onboarding.
- **free_text / cloze / word_tiles / picture_choice** renderers at
  320px in real lesson content — diag traversal was blocked because the
  matching exercise's shared "Check" button did not enable at 320px in
  the harness (clean render, but an interaction snag worth a separate
  look). The C4 regression spec should play a real lesson at 320px and
  assert per-step.
- **Help drawer** open state.

## Fix plan (pending review)

- **C2 (global):** verify/round out the safety net — `box-sizing`,
  `img/svg/canvas max-width:100%`, `pre/code` wrap, `table` block-scroll
  are largely present; add only what's missing. The `overflow-x:hidden`
  body guard stays as a backstop, NOT the fix.
- **C3 (per-component):**
  1. Dashboard radar — add `min-width: 0` to `.dashboard-card` (let grid
     cells shrink) and constrain `.profile-radar` to `width:100%`;
     ensure the Recharts `ResponsiveContainer` measures the constrained
     parent (no fixed `width`).
  2. Settings AI `.api-key-source` — allow wrap / shrink.
  3. Session `.session-header-chips` — `flex-wrap: wrap` + `min-width:0`.
- **C4 (regression):** extend `no-horizontal-scroll.spec.ts` to (a)
  onboard first and measure the REAL authenticated pages + all Settings
  tabs + badge gallery, and (b) play a real es-a1 lesson at 320px
  measuring each step. This closes the blind spot that let these
  through.
- **C5:** re-verify all pages at 320/375/414.
