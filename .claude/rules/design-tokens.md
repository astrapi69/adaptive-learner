---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: Design token architecture, CSS variables, Tailwind integration, theme enforcement
globs:
  - frontend/src/**/*.css
  - frontend/src/**/*.tsx
  - frontend/src/styles/**/*
alwaysApply: false
---

# Design Token Architecture

All visual properties are driven by design tokens (CSS variables). A contributor re-themes the app by editing one `theme-*.css` file and touching no component. This rule is enforced by tests, not just convention.

Full catalogue + "how to build a theme": `docs/policies/DESIGN-TOKENS.md`.

## Token Layers

**Per-theme tokens** — the 44 canonical tokens, defined once per theme in `frontend/src/styles/themes/theme-<id>.css`. Backgrounds, text, borders, interactive, accent, status, exercise feedback, star, charts, shadows. Switching `[data-theme]` flips all of them. Every theme MUST define the EXACT same set (pinned by `themes.test.ts`).

**Theme-agnostic tokens** — values that are the same in every theme by construction. They live in `global.css :root` (NOT in the 12 theme files, so `themes.test.ts` parity is untouched). Examples: `--method-*` (brand palette), `--danger-fg` (white on the always-red danger), `--code-*` (syntax palette, with a `[data-theme="dark"]` override block), `--mark-*`, layout (`--space-*`, `--radius-*`).

**Legacy aliases** — `--surface`, `--danger`, … resolve THROUGH the canonical tokens. Kept for old CSS; prefer the semantic names.

## Rules

**No raw color literals** (`#hex` / `rgb()` / `rgba()` / `hsl()`) in a consumer declaration. A literal is allowed ONLY as the value of a `--token:` definition. In a component (`.tsx`) or a consumer CSS rule (`color: …`), reference a token: `color: var(--fg-primary)`.

**No fixed-palette Tailwind utilities** (`bg-blue-500`, `text-red-600`, `border-slate-200`). Use the token-backed utilities (`bg-accent` → `var(--accent)`, `text-fg-primary`) or an arbitrary value over a token (`bg-[var(--bg-elevated)]`). New UI uses Tailwind utilities; they resolve to the CSS variables via the `@theme inline` bridge in `styles/tailwind.css`.

**No inline styles with color values.** Same rule as above; route through a token.

**Same principle for every component class** — Cards, Badges, Inputs, Dialogs, Toasts, Progress, Nav, Charts, Exercise renderers. Each references semantic tokens, never a direct value.

**Shadows, radii, spacing are tokens too** (`--shadow-elevated`, `--radius-md`, `--space-4`), not magic numbers-with-color.

## Justified Exceptions

A consumer literal is permitted only when it is genuinely not a themeable surface, and must be marked so the guard skips it:

**CSS:** an inline `/* token-exempt: <reason> */` comment ON THE SAME LINE as the literal (e.g. the camera viewfinder frame, white over the live feed).

**`.tsx`:** an entry in the `ALLOWLIST` ratchet in `no-hardcoded-colors.test.ts`, with the reason. The allowlist only shrinks. Documented classes: chart colors (Recharts needs resolved strings — read via `chartTheme.ts`), camera surfaces, user-tag seed colors (data, not chrome), and computed contrast over the fixed brand method palette.

## Enforcement (`frontend/src/styles/no-hardcoded-colors.test.ts`)

Four guards, all in `make test` (guard 4 in `legacy-alias-ratchet.test.ts`):

1. `.tsx` color literals → allowlist ratchet.
2. Non-theme CSS consumer literals → only `--token:` definitions and `token-exempt:` lines pass (theme files are excluded — they ARE the palette).
3. Fixed-palette Tailwind utility classes → must be zero.
4. Legacy alias references (`var(--surface)`, …) in consumer `.ts(x)` → count per alias pinned exactly; a migration lowers the pin (#3051).

Companions: `themes.test.ts` (token parity), `contrast.test.ts` (WCAG AA, 12 themes).

Standalone CLI gate (#1169): `make verify-theme` runs `scripts/verify_theme.py` (token completeness, undefined `var()` references, WCAG and badge contrast, `.theme-baseline.json` ratchet), then the Vitest guards above; see `docs/policies/DESIGN-TOKENS.md`.

**When adding a setting/feature that needs a new color:** add a token, do not inline a value. If it varies by theme, add it to all 12 `theme-*.css`; if it is the same everywhere, add it to `global.css :root`.
