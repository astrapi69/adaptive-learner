# Design token architecture

All visual properties of the app are driven by **design tokens**
(CSS variables). Anyone who wants to recolor the app or build a
new theme edits a single `theme-*.css` file and touches no
component. This rule is enforced by tests, not just convention.
The full token reference is in
[`docs/policies/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/DESIGN-TOKENS.md).

---

## The token layers

1. **Per-theme tokens** — the canonical set of 44 tokens, defined
   once per theme in `frontend/src/styles/themes/theme-<id>.css`
   (backgrounds, text, borders, interactive, accent, status,
   exercise feedback, star, charts, shadows). Switching
   `[data-theme]` flips all of them. **Every theme must define the
   exact same set** (pinned by `themes.test.ts`).
2. **Theme-agnostic tokens** — values that are the same in every
   theme by construction (e.g. brand palette, syntax colors,
   layout spacing). They live in `global.css :root`.
3. **Legacy aliases** — old names like `--surface`, `--danger`
   that resolve **through** the canonical tokens.

---

## The rules (in brief)

- **No raw color literals** (`#hex`, `rgb()`, `hsl()`) in a
  consumer declaration. A literal is allowed only as the value of
  a `--token:` definition. In components and CSS rules you
  reference tokens: `color: var(--fg-primary)`.
- **No Tailwind utilities with a fixed palette** (`bg-blue-500`).
  Use token-backed utilities (`bg-accent` → `var(--accent)`) or an
  arbitrary value over a token.
- **No inline styles with color values.**
- **Shadows, radii, spacing are tokens too**
  (`--shadow-elevated`, `--radius-md`, `--space-4`).

---

## Building or adapting a theme

1. Copy an existing `theme-<id>.css` as a template.
2. Set all 44 canonical tokens (parity is mandatory).
3. Mind **WCAG AA contrast** — `contrast.test.ts` checks all
   themes computationally.
4. Register the theme; the picker under Settings → Appearance
   picks it up.

If a new feature needs a new color: **add a token**, not a
literal. If it varies by theme, add it to all `theme-*.css`; if it
is the same everywhere, add it to `global.css :root`.

---

## Enforcement

Three guards run in `make test`
(`no-hardcoded-colors.test.ts`): color literals in `.tsx` (via an
only-shrinking allowlist), color literals in non-theme CSS, and
Tailwind utilities with a fixed palette (must be zero). In
addition, `themes.test.ts` (token parity) and `contrast.test.ts`
(AA across all themes).

---

## Related pages

- [Theme system](../developer/themes.md) — the shipped themes + picker
- [`docs/policies/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/DESIGN-TOKENS.md) — full token list
