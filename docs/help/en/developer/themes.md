# Theme system

Phase 58 (v1.41.0) replaced the old light/dark pair with a
six-theme system on a single `data-theme` dimension, plus an
`auto` choice that follows the OS.

## How it works

- **Canonical color tokens** live in
  `frontend/src/styles/themes/theme-<id>.css`, one block per
  `data-theme` value (`light`, `dark`, `ocean`, `forest`,
  `high-contrast`, `sepia`). Each file defines the **full**
  semantic token set - there is no light-fallthrough.
- **Theme-agnostic tokens** (spacing, radius, fonts, the brand
  method palette) and the **legacy aliases** (`--bg`, `--surface`,
  `--fg`, `--danger`, ...) live in `styles/global.css :root`. The
  aliases resolve *through* the canonical tokens, so older rules
  follow the active theme automatically.
- The theme files are imported from `main.tsx`, **light first**, so
  the active theme wins the equal-specificity tie against `:root`.
- `frontend/src/lib/themes.ts` is the registry: `THEMES`, the
  `ThemeId` / `ThemeChoice` types, `resolveTheme(choice, prefersDark)`
  for the `auto` mapping, and the preview-card swatches.
- `frontend/src/hooks/useTheme.ts` owns the applied `data-theme`
  attribute and persists the choice under `adaptive-learner.theme`
  (it migrates the pre-58E `adaptive-learner-theme` key once).
- `index.html` carries a tiny inline script that applies the saved
  theme **before first paint** (no flash). It mirrors the hook's
  resolution; keep the two in sync.
- Charts (Recharts) can't read CSS variables in SVG attributes, so
  `lib/chartTheme.ts` + `useChartTheme` read the computed token values
  and re-read on `data-theme` change.

## Token set (defined by every theme)

Backgrounds (`--bg-primary/secondary/surface/elevated/overlay`),
text (`--fg-primary/secondary/muted/inverse`), borders
(`--border-primary/subtle/accent`), interactive
(`--interactive-bg/hover/active/disabled`), accent
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), status pairs
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
exercise feedback (`--exercise-correct/-wrong/-selected/-matched`),
`--star`, chart series (`--chart-1..6`), and shadows
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts` fails if any theme is missing one of
these or adds an extra; `styles/contrast.test.ts` asserts WCAG 2.1 AA
across all six themes.

## How to add a new theme

1. **Copy** an existing file, e.g.
   `cp theme-dark.css theme-midnight.css`, and change the selector to
   `[data-theme="midnight"]`. Keep **every** token - change only the
   values. Do not add component styles here.
2. **Register** it in `lib/themes.ts`: add a `ThemeMeta` entry to
   `THEMES` (id, English `label`, `family` light|dark, and a `swatch`
   for the Settings preview) and add the id to the `ThemeId` union.
3. **Import** it in `main.tsx` after `theme-light.css` (order only
   matters relative to light).
4. **Allow it in the pre-paint guard**: add the id to the `valid`
   array in the inline `<script>` in `index.html`.
5. **i18n**: add `ui.themes.midnight` to all eight catalogs under
   `backend/config/i18n/*.yaml`, then run `make sync-i18n`.
6. **Verify**: `npx vitest run src/styles/themes src/styles/contrast`
   - the completeness + contrast pins must stay green (fix values
   until contrast passes AA in your new theme).

That's it - the ThemePicker, pre-paint script, charts, and every
component pick the new theme up automatically because they all read
the canonical tokens.

## Rules

- **No hardcoded colors** in components. `styles/no-hardcoded-colors.test.ts`
  enforces it for `.tsx` styles (a documented allowlist covers chart
  resolvers, decorative confetti, and data colors).
- **Every theme defines every token.** No `inherit`-from-light gaps -
  that was the F1 audit bug (undefined tokens rendering light hex in
  dark mode).
- **Theme switch is instant** - a `data-theme` swap, never a reload.
