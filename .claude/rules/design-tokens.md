# Design token architecture

All visual properties are driven by design tokens (CSS variables).
A contributor re-themes the app by editing one `theme-*.css` file and
touching no component. This rule is enforced by tests, not just
convention. Full catalogue + "how to build a theme":
[docs/DESIGN-TOKENS.md](../../docs/DESIGN-TOKENS.md).

## The token layers

1. **Per-theme tokens** — the 44 canonical tokens, defined once per
   theme in `frontend/src/styles/themes/theme-<id>.css`. Backgrounds,
   text, borders, interactive, accent, status, exercise feedback, star,
   charts, shadows. Switching `[data-theme]` flips all of them. Every
   theme MUST define the EXACT same set (pinned by `themes.test.ts`).
2. **Theme-agnostic tokens** — values that are the same in every theme
   by construction. They live in `global.css :root` (NOT in the 12
   theme files, so `themes.test.ts` parity is untouched). Examples:
   `--method-*` (brand palette), `--danger-fg` (white on the always-red
   danger), `--code-*` (syntax palette, with a `[data-theme="dark"]`
   override block), `--mark-*`, layout (`--space-*`, `--radius-*`).
3. **Legacy aliases** — `--surface`, `--danger`, … resolve THROUGH the
   canonical tokens. Kept for old CSS; prefer the semantic names.

## Rules

- **No raw color literals (`#hex` / `rgb()` / `rgba()` / `hsl()`) in a
  consumer declaration.** A literal is allowed ONLY as the value of a
  `--token:` definition. In a component (`.tsx`) or a consumer CSS rule
  (`color: …`), reference a token: `color: var(--fg-primary)`.
- **No fixed-palette Tailwind utilities** (`bg-blue-500`,
  `text-red-600`, `border-slate-200`). Use the token-backed utilities
  (`bg-accent` → `var(--accent)`, `text-fg-primary`) or an arbitrary
  value over a token (`bg-[var(--bg-elevated)]`). New UI uses Tailwind
  utilities; they resolve to the CSS variables via the `@theme inline`
  bridge in `styles/tailwind.css`.
- **No inline styles with color values.** Same rule as above; route
  through a token.
- **Same principle for every component class** — Cards, Badges, Inputs,
  Dialogs, Toasts, Progress, Nav, Charts, Exercise renderers. Each
  references semantic tokens, never a direct value.
- **Shadows, radii, spacing are tokens too** (`--shadow-elevated`,
  `--radius-md`, `--space-4`), not magic numbers-with-color.

## Justified exceptions

A consumer literal is permitted only when it is genuinely not a
themeable surface, and must be marked so the guard skips it:

- **CSS**: an inline `/* token-exempt: <reason> */` comment ON THE SAME
  LINE as the literal (e.g. the camera viewfinder frame, white over the
  live feed).
- **`.tsx`**: an entry in the `ALLOWLIST` ratchet in
  `no-hardcoded-colors.test.ts`, with the reason. The allowlist only
  shrinks. Documented classes: chart colors (Recharts needs resolved
  strings — read via `chartTheme.ts`), camera surfaces, user-tag seed
  colors (data, not chrome), and computed contrast over the fixed brand
  method palette.

## Enforcement (`frontend/src/styles/no-hardcoded-colors.test.ts`)

Three guards, all in `make test`:

1. `.tsx` color literals → allowlist ratchet.
2. Non-theme CSS consumer literals → only `--token:` definitions and
   `token-exempt:` lines pass (theme files are excluded — they ARE the
   palette).
3. Fixed-palette Tailwind utility classes → must be zero.

Companion pins: `themes.test.ts` (every theme defines the same token
set), `contrast.test.ts` (WCAG AA across all 12 themes).

Standalone CLI gate (#1169): `make verify-theme` runs
`scripts/verify_theme.py` (stdlib-only token-completeness + undefined
`var()`-reference + WCAG-contrast + semantic-badge-contrast matrix gate,
with a `.theme-baseline.json` ratchet) and then calls the three Vitest
guards above. Use it as a single theme gate where the node toolchain is
not available; see `docs/DESIGN-TOKENS.md` § Enforcement.

When adding a setting/feature that needs a new color: add a token, do
not inline a value. If it varies by theme, add it to all 12
`theme-*.css`; if it is the same everywhere, add it to `global.css
:root`.
