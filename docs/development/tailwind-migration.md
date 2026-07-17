# Tailwind CSS + shadcn/ui migration

Adaptive Learner adopted **Tailwind CSS v4** + **shadcn/ui** as its CSS
framework in v1.54.0+ (Phase A). The migration is **incremental**: the
framework is installed and configured now, and existing components are
migrated to it **as they are touched** by other work — never as a Big Bang
rewrite. This document is the contract for that migration.

## Why Tailwind + shadcn/ui

- **Consistency.** Utility classes plus a small set of shadcn primitives
  give every new screen the same spacing, radius, and color vocabulary
  without each component reinventing CSS.
- **Less bespoke CSS.** `frontend/src/styles/global.css` had grown past
  3,500 lines of per-component rules. Tailwind moves styling to the markup
  and shrinks the global sheet over time.
- **shadcn/ui** gives accessible, un-opinionated component source we own and
  restyle (it wraps Radix UI, which the app already uses), instead of a
  heavyweight component library.
- **Our theme system stays.** Tailwind **consumes** the existing CSS
  variables; it does not replace them (see below). The 6 themes keep working
  unchanged.

## How the theme integration works

The canonical design tokens live where they always have:

- `frontend/src/styles/global.css` — layout tokens + the `* { box-sizing }`
  reset + per-component rules (being migrated away over time).
- `frontend/src/styles/themes/theme-*.css` — the color tokens, one block per
  `[data-theme]` value (`light` / `dark` / `ocean` / `forest` /
  `high-contrast` / `sepia`).

`frontend/src/styles/tailwind.css` is the Tailwind entry point. It maps a
Tailwind utility namespace onto those existing variables with a
**`@theme inline`** block:

```css
@theme inline {
  --color-bg-primary: var(--bg-primary);
  --color-accent: var(--accent);
  --color-accent-fg: var(--accent-fg);
  --radius-app: var(--radius-md, 8px);
  /* ... */
}
```

`@theme inline` is the key: the token is **not** re-emitted as a new
variable, so the generated utility reads the runtime variable directly —
e.g. `.bg-accent { background-color: var(--accent) }`. Because `--accent`
(and friends) are redefined per `[data-theme]`, **every Tailwind utility
recolors automatically when the theme switches**, with zero component
changes.

Available theme-bound utilities (Tailwind `{prefix}-{token}` naming):

| Utility examples | Resolves to |
|---|---|
| `bg-bg-primary` `bg-bg-secondary` `bg-bg-surface` `bg-bg-elevated` | `var(--bg-*)` |
| `text-fg-primary` `text-fg-secondary` `text-fg-muted` | `var(--fg-*)` |
| `bg-accent` `text-accent` `bg-accent-hover` `text-accent-fg` | `var(--accent*)` |
| `text-success` `text-error` `text-warning` `text-info` | status vars |
| `border-border` `border-border-subtle` | `var(--border-*)` |
| `rounded-app` | `var(--radius-md)` |
| `font-sans` `font-mono` | `var(--font-sans/mono)` (owned by global.css) |

Tailwind's full default palette (`bg-red-500`, `p-4`, `flex`, ...) is also
available for non-themed utilities.

### Tailwind v4 is CSS-first (no `tailwind.config.ts`)

We installed Tailwind **v4** (the `@tailwindcss/vite` plugin). v4 is
configured **in CSS** via `@theme`, not via a v3-style `tailwind.config.ts`
(the Vite plugin does not auto-load a JS config; it would need an explicit
`@config` directive, which would leave a dead file). Content/template
scanning is automatic in v4 — there is no `content: [...]` array to
maintain. If you find a `tailwind.config.ts` example online, it is v3; the
equivalent here is the `@theme` block in `tailwind.css`.

### Preflight is intentionally OFF

`tailwind.css` imports only the **theme** and **utilities** layers, **not**
Tailwind's preflight (base reset):

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
```

The app predates Tailwind and relies on browser defaults + global.css for
un-styled elements (heading sizes, list bullets, body/fieldset margins).
Pulling in preflight would silently restyle every page. The one app-wide
reset that matters (`* { box-sizing: border-box }`) already lives in
global.css, so utilities and shadcn components work without preflight.

All Tailwind output is **layered**; global.css and the theme sheets are
**unlayered**, so they always win the cascade. That is what keeps existing
pages pixel-identical while the migration is in progress. Re-introducing a
scoped preflight is a deliberate later-phase decision, not the default.

> **Cascade gotcha when migrating.** Because Tailwind utilities are layered
> and global.css is unlayered, an existing unlayered rule **beats** a
> Tailwind utility on the same element (e.g. global `input { background }`
> wins over `bg-bg-surface`). When you migrate a component, **remove the
> competing global.css rule in the same change** so the utility takes
> effect. Bare-element selectors that only set neutral things (the global
> `button { font-family; cursor }`) do not conflict with color/spacing
> utilities, so brand-new buttons style correctly without edits.

## Rules

### New code

- **Use Tailwind utility classes.** Do not add new rules to
  `global.css` or new per-component CSS files.
- Prefer the theme-bound utilities (`bg-bg-surface`, `text-fg-primary`,
  `bg-accent`, `rounded-app`, ...) so the component is theme-correct by
  construction.
- Use the `cn()` helper from `@/lib/utils` to compose conditional classes
  (`clsx` + `tailwind-merge`).
- For UI primitives, use shadcn/ui (see below) rather than hand-rolling.

### Existing code

- **Migrate when you touch it, not proactively.** If you are already editing
  a component for a feature or bugfix, convert its styles to Tailwind as part
  of that change and delete the now-dead global.css rules. Do **not** open
  standalone "migrate component X" changes unless explicitly planned.
- When migrating, verify the component in **all 6 themes** and check the
  Dexie-mode gate still passes (`make test-dexie-smoke`).
- The proof-of-concept seed for the lesson navigation is
  `frontend/src/components/lesson/LessonStickyFooter.tsx`.

## Using shadcn/ui

The base setup is wired (`components.json`, `cn()` at `@/lib/utils`, the
`@/*` path alias, and the `clsx` / `tailwind-merge` /
`class-variance-authority` deps). Add components individually:

```bash
cd frontend
bunx shadcn@latest add button
bunx shadcn@latest add dialog tabs
```

Components land in `frontend/src/components/ui/`. **Do not** bulk-add the
whole library; pull each primitive in when a migration needs it.

Which shadcn component replaces what:

| shadcn component | Use for |
|---|---|
| Dialog | All modals (replacing direct Radix Dialog usage) |
| Tabs | Settings page tabs |
| Toast / Sonner | Toast notifications (currently react-toastify) |
| Button | All buttons (consistency) |
| Input | All form inputs |
| Select | All dropdowns |
| Card | All card components |

### First-component step: add the shadcn semantic-token bridge

shadcn components reference **semantic** tokens (`bg-primary`,
`text-primary-foreground`, `bg-background`, `bg-muted`, `border-border`,
`ring-ring`, `bg-accent` as a *hover surface*, ...). These are **not** wired
in Phase A on purpose:

- shadcn's `accent` means a muted hover surface, which **collides** with our
  brand `accent` (vivid indigo). The mapping must be decided deliberately,
  against a real rendered component.

So **when you install the first shadcn component**, also add a semantic-token
bridge to `tailwind.css` mapping shadcn's tokens onto our theme vars — for
example mapping shadcn `--primary` to our brand `--accent`, shadcn `accent`
(hover surface) to `--interactive-hover`, `--background`/`--foreground` to
`--bg-primary`/`--fg-primary`, `--border`/`--input` to `--border-primary`,
`--destructive` to `--error`, and `--ring` to `--accent`, then expose them
via a second `@theme inline` block (`--color-primary`, `--color-background`,
`--color-muted`, ...). Define both a light default and the per-`[data-theme]`
overrides only where the theme var names differ. Verify the rendered
component in all 6 themes before committing — that visual check is exactly
why the bridge is deferred to first-component time rather than guessed now.

## Verifying after Tailwind changes

```bash
cd frontend
bun run build          # utilities compile; bundle size sane
bun run test           # Vitest (includes the POC regression pin)
cd .. && make test-dexie-smoke   # GH-Pages-shape build, every route renders
```

For a theme spot-check, switch `[data-theme]` in the running app (Settings →
Appearance) and confirm a migrated component recolors with the rest of the
page.
