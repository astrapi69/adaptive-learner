# Theme system

Phase 58 (v1.41.0) replaced the old light/dark pair with a system
of six classic themes on a single `data-theme` dimension, plus an
`auto` choice that follows the operating system. Phase 63
(v1.63.0) added six **recommended WCAG AA presets**, so the picker
carries **12 themes** in total.

## Recommended presets (Phase 63 / v1.63.0)

The picker under Settings → Appearance leads with a
**Recommended** sub-tab:

- **Light:** `catppuccin-latte`, `supabase`, `graphite`
- **Dark:** `catppuccin-mocha`, `soft-pop`, `amethyst-haze`

They were generated from tweakcn presets via
`scripts/generate_preset_themes.py` as complete 44-token themes,
with **computationally enforced WCAG AA** (`contrast.test.ts`
across all 12 themes). The classic six (`light`, `dark`, `ocean`,
`forest`, `high-contrast`, `sepia`) remain unchanged.

## How it works

- **Canonical color tokens** live in
  `frontend/src/styles/themes/theme-<id>.css`, one block per
  `data-theme` value (`light`, `dark`, `ocean`, `forest`,
  `high-contrast`, `sepia`). Each file defines the **complete**
  semantic token set - there is no fall-through to light.
- **Theme-agnostic tokens** (spacing, radius, fonts, the brand
  method palette) and the **legacy aliases** (`--bg`, `--surface`,
  `--fg`, `--danger`, ...) live in `styles/global.css :root`. The
  aliases resolve *through* the canonical tokens and thus follow
  the active theme automatically.
- The theme files are imported in `main.tsx`, **light first**, so
  the active theme wins the specificity tie against `:root`.
- `frontend/src/lib/themes.ts` is the registry: `THEMES`, the
  types `ThemeId` / `ThemeChoice`, `resolveTheme(choice,
  prefersDark)` for the `auto` mapping, and the preview swatches.
- `frontend/src/hooks/useTheme.ts` owns the applied `data-theme`
  attribute and stores the choice under `adaptive-learner.theme`
  (migrating the old `adaptive-learner-theme` key once).
- `index.html` contains a small inline script that applies the
  stored theme **before the first paint** (no flicker). It mirrors
  the hook's resolution; keep both in sync.
- Charts (Recharts) cannot read CSS variables in SVG attributes,
  so `lib/chartTheme.ts` + `useChartTheme` read the computed token
  values and re-read on a `data-theme` change.

## Token set (defined by every theme)

Backgrounds (`--bg-primary/secondary/surface/elevated/overlay`),
text (`--fg-primary/secondary/muted/inverse`), borders
(`--border-primary/subtle/accent`), interactive
(`--interactive-bg/hover/active/disabled`), accent
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), status pairs
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
exercise feedback (`--exercise-correct/-wrong/-selected/-matched`),
`--star`, chart series (`--chart-1..6`) and shadows
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts` fails if a theme is missing one of
these tokens or has an extra one;
`styles/contrast.test.ts` checks WCAG 2.1 AA across all 12 themes.
The full token reference is in
[Design token architecture](../architecture/design-tokens.md).

## Adding a new theme

1. **Copy** an existing file, e.g.
   `cp theme-dark.css theme-midnight.css`, and change the selector
   to `[data-theme="midnight"]`. Keep **every** token - change
   only the values. No component styles here.
2. **Register** it in `lib/themes.ts`: add a `ThemeMeta` entry to
   `THEMES` (id, English `label`, `family` light|dark and a
   `swatch` for the settings preview) and add the id to the
   `ThemeId` union.
3. **Import** it in `main.tsx` after `theme-light.css` (the order
   only matters relative to light).
4. **Allow it in the pre-paint guard**: add the id to the `valid`
   array in the inline `<script>` in `index.html`.
5. **i18n**: add `ui.themes.midnight` to every catalog under
   `backend/config/i18n/*.yaml` and run `make sync-i18n`.
6. **Check**: `bunx vitest run src/styles/themes src/styles/contrast`
   - the completeness and contrast pins must stay green (adjust
   the values until the contrast in the new theme meets AA).

That's it - the ThemePicker, the pre-paint script, the charts and
every component pick up the new theme automatically, because they
all read the canonical tokens.

## Rules

- **No hardcoded colors** in components.
  `styles/no-hardcoded-colors.test.ts` enforces this for `.tsx`
  styles (a documented allowlist covers chart resolvers,
  decorative confetti and data colors).
- **Every theme defines every token.** No gaps with inheritance
  from light - that was the F1 audit bug (undefined tokens that
  showed light hex in dark mode).
- **Theme switching is instant** - a `data-theme` swap, never a
  reload.
