# Design tokens

Every visual property in Adaptive Learner — color, shadow, radius,
spacing — comes from a **design token** (a CSS variable). No component
hardcodes a color. To re-theme the app you edit **one** file and touch
no component.

This is enforced, not just documented: see
[Enforcement](#enforcement) and `.claude/rules/design-tokens.md`.

## The three token layers

| Layer | Lives in | Flips on theme change? | Example |
|-------|----------|------------------------|---------|
| **Per-theme** | `frontend/src/styles/themes/theme-<id>.css` | Yes | `--bg-primary`, `--accent`, `--error` |
| **Theme-agnostic** | `frontend/src/styles/global.css` `:root` | No (same in every theme) | `--method-deductive`, `--danger-fg`, `--code-keyword`, `--space-4` |
| **Legacy aliases** | `global.css` `:root` | Via the canonical token | `--surface` → `var(--bg-surface)`, `--danger` → `var(--error)` |

`[data-theme="<id>"]` on `<html>` selects the active theme; switching it
re-points all 44 per-theme tokens, so every consumer recolors at once.
A small number of theme-agnostic tokens carry a `[data-theme="dark"]`
override block in `global.css` (the code-syntax palette, the highlighter
amber) — these are global concerns with a light/dark split, not
per-theme concerns.

## Per-theme token catalogue (44 tokens)

Defined identically (same names) in all 12 `theme-*.css` files;
`themes.test.ts` fails if any theme omits one.

**Backgrounds (5)** — `--bg-primary`, `--bg-secondary`, `--bg-surface`,
`--bg-elevated`, `--bg-overlay`

**Text (4)** — `--fg-primary`, `--fg-secondary`, `--fg-muted`,
`--fg-inverse`

**Borders (3)** — `--border-primary`, `--border-subtle`,
`--border-accent`

**Interactive (4)** — `--interactive-bg`, `--interactive-hover`,
`--interactive-active`, `--interactive-disabled`

**Accent (6)** — `--accent`, `--accent-hover`, `--accent-fg`
(on-accent foreground), `--accent-text` (accent used AS text, AA-pinned
since #96), `--accent-subtle`, `--accent-rgb`

**Status (8)** — `--success` / `--success-bg`, `--error` / `--error-bg`,
`--warning` / `--warning-bg`, `--info` / `--info-bg`

**Exercise feedback (4)** — `--exercise-correct`, `--exercise-wrong`,
`--exercise-selected`, `--exercise-matched`

**Star (1)** — `--star`

**Charts (6)** — `--chart-1` … `--chart-6` (read at runtime by
`lib/chartTheme.ts`; Recharts needs resolved strings, not `var()`)

**Shadows (3)** — `--shadow-card`, `--shadow-elevated`, `--shadow-md`

## Theme-agnostic tokens (`global.css :root`)

Same value in every theme by construction, so they are NOT in the theme
files (keeps `themes.test.ts` parity simple).

- **Brand method palette** — `--method-deductive`, `--method-inductive`,
  `--method-error_based`, `--method-dialogic`, `--method-contextual`,
  `--method-ai_adaptive`. Brand identity, fixed across themes; shared
  with `lib/constants.ts`. Charts read `--chart-*` instead.
- **On-danger foreground** — `--danger-fg` (white; `--danger`/`--error`
  is a saturated red in every theme, mirrors `--accent-fg` for accent).
- **Highlighter** — `--mark-bg`, `--mark-swatch-bg` (translucent amber
  for the TipTap mark; dark override in the `[data-theme="dark"]` block).
- **Code syntax palette** — `--code-keyword`, `--code-string`,
  `--code-number`, `--code-comment`, `--code-function`, `--code-tag`,
  `--code-attr`, `--code-meta` (highlight.js; light defaults +
  `[data-theme="dark"]` overrides).
- **Layout** — `--space-1…8`, `--radius-sm/md/lg`, `--font-sans`,
  `--font-mono`.

## How components consume tokens

### Tailwind + shadcn (the path for new UI)

Tailwind utilities resolve to the CSS variables through the
`@theme inline` bridge in `styles/tailwind.css`, so `bg-accent` is
`var(--accent)` and recolors with the theme automatically. Use the
token-backed utilities or an arbitrary value over a token
(`bg-[var(--bg-elevated)]`). Never a fixed-palette class
(`bg-blue-500`).

### Buttons — semantic groups, one token set each

The shadcn `<Button>` (`components/ui/button.tsx`) is the single source
for button styling. Each variant is a semantic group bound to tokens via
the bridge; change the token, every button of that group changes.

| Variant | Use for | Tokens (via bridge) |
|---------|---------|---------------------|
| `default` | primary action (Save, Create, Start) | `--color-primary` → `--accent`, `--color-primary-foreground` → `--accent-fg` |
| `secondary` | secondary action (Back) | `--color-secondary` → `--bg-secondary`, fg → `--fg-primary` |
| `destructive` | delete / reset | `--color-destructive` → `--error`, fg → `--fg-inverse` |
| `outline` | secondary navigation | `--color-input` border, hover → `--accent` / `--accent-fg` |
| `ghost` | contextual (show hint, filter) | hover → `--accent` / `--accent-fg` |
| `link` | inline link action | `--color-primary` text |

The same principle applies to every component class — Cards, Badges,
Inputs, Dialogs, Toasts, Progress, Nav, Charts, Exercise renderers: each
references semantic tokens, never a direct value.

## How to build a new theme

1. **Copy a close starting point.** Duplicate the nearest
   `frontend/src/styles/themes/theme-<id>.css` to
   `theme-<your-id>.css`.
2. **Edit the 44 token values.** Set every token for your palette. Do
   not add or remove token names — `themes.test.ts` requires the exact
   canonical set (use `theme-light.css` as the reference list).
3. **Register the id.** Add `<your-id>` to `THEME_IDS` (and its display
   metadata) in `frontend/src/lib/themes.ts`. The recommended presets
   are generated by `scripts/generate_preset_themes.py`; a hand-authored
   theme is registered directly.
4. **Pass the gates.** `make test-frontend` runs:
   - `themes.test.ts` — your theme defines the full token set.
   - `contrast.test.ts` — every text pair ≥ 4.5:1, UI/exercise ≥ 3:1,
     across your theme too (WCAG AA).
   - `no-hardcoded-colors.test.ts` — you did not inline any literal in a
     component.
5. **You touched no component.** That is the whole point: a theme is 44
   numbers in one file.

For an existing component that needs a *new* color, add a token (per
the matching layer above) and reference it — never inline a value.

## Enforcement

`frontend/src/styles/no-hardcoded-colors.test.ts` (in `make test`) has
three guards:

1. **`.tsx` color literals** — none, except a shrinking `ALLOWLIST`
   ratchet (chart colors, camera surfaces, user-tag seed colors,
   computed contrast over the brand palette).
2. **Non-theme CSS consumer literals** — a `#hex`/`rgb()`/`hsl()` is
   allowed only as the value of a `--token:` definition. A consumer
   declaration (`color: …`) with a literal fails unless the same line
   carries an inline `/* token-exempt: <reason> */` comment (e.g. the
   camera viewfinder frame). Theme files are excluded — they ARE the
   palette.
3. **Fixed-palette Tailwind classes** — `bg-blue-500` and friends must
   be zero.

Companions: `themes.test.ts` (token parity) and `contrast.test.ts`
(WCAG AA across all 12 themes).
