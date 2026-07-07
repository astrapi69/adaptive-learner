# Visual regression (#244 + #705)

Pixel-diff screenshots via Playwright's built-in `toHaveScreenshot()`,
run against the **dexie preview build** (no backend, the GH-Pages shape
real users meet, so themes resolve client-side). Catches theme/contrast
and responsive-layout regressions that unit tests can't see.

Two complementary matrices keep the baseline count manageable (one axis
each, not the full Cartesian product):

| Spec | Matrix | Count |
|------|--------|-------|
| `theme-regression.spec.ts` (#244, Phase 2) | 5 views × 12 themes, desktop 1440×900 | 60 |
| `critical-surfaces.spec.ts` (#705, Phase 1) | 16 surfaces × 3 viewports, default (light) theme | up to 48 |

### Phase 2 — themes (#244)

5 critical views (dashboard, learning-path, lesson-matching,
lesson-result, settings) across all 12 registered themes.

### Phase 1 — critical surfaces × viewports (#705)

16 surfaces at 3 responsive viewports — desktop `1920×1080`, tablet
`768×1024`, mobile `375×667`:

dashboard (empty + populated), content-browser, content-discover,
content-import (#1380), set-detail, lesson
theory, lesson cloze, lesson matching, lesson summary, review session,
statistics, settings (general/data/about), shortcut-help overlay.

A surface that can't be reached deterministically (e.g. the bundled set
has no cloze exercise) is `test.skip`-ped rather than committing a
meaningless baseline.

## Layout

- `theme-regression.spec.ts` — the 12 themes × 5 views matrix.
- `critical-surfaces.spec.ts` — the 16 surfaces × 3 viewports matrix.
- `helpers.ts` — `setTheme` (pins the theme before first paint via the
  real `adaptive-learner.theme` localStorage key), `freezeClock`,
  `settleForScreenshot`, and per-view/per-surface seeding (`gotoView`,
  `gotoSurface`) that reuses the onboarding + lesson-playthrough patterns
  from the dexie smoke specs.
- `screenshots/` — committed baseline PNGs. `*.png` is `binary` in
  `.gitattributes`.
- `../playwright.visual.config.ts` — dexie preview build, no backend,
  `maxDiffPixelRatio: 0.01`, `threshold: 0.2`, animations disabled.

## Generating / updating the baseline (maintainer)

The baseline is generated and **reviewed** on a consistent machine — font
anti-aliasing differs between machines, so baselines are not generated in
an ephemeral CI/web container. Claude Code writes the harness; the
maintainer runs `--update-snapshots` and reviews the PNGs. From the repo
root:

```bash
make test-visual-update   # builds the dexie frontend, then --update-snapshots
```

Then **review every changed PNG** and commit them.

### When a UI PR intentionally changes the layout

1. `make test-visual-update` (rebuilds dexie + regenerates baselines)
2. Review every changed PNG — confirm the diff is the intended change,
   not a regression.
3. `git add e2e/visual/screenshots/`
4. Commit: `test(visual): update baseline after <what changed>`

## Running the check

```bash
make test-visual          # build dexie frontend + compare against baseline
```

## Rules

- **Never** `--update-snapshots` to silence a diff that reveals a real
  bug. Fix the bug; regenerate only after an intended visual change.
- Visual tests are slow — they run as their own CI job
  (`.github/workflows/visual-regression.yml`), nightly + on demand,
  **not** on PRs and **not** in the smoke gate (#575 night-shift
  rationale).
- Theme slugs in `helpers.ts` mirror `frontend/src/lib/themes.ts`
  `THEME_IDS` exactly — keep them in sync if a theme is added/renamed.
