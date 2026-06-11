# Visual regression (#244, infra block 8)

Pixel-diff screenshots of the 5 critical views across all 12 themes
(60 desktop / 1440×900 shots), via Playwright's built-in
`toHaveScreenshot()`. Catches theme/contrast regressions that unit
tests can't see.

## Layout

- `theme-regression.spec.ts` — the 12 themes × 5 views matrix.
- `helpers.ts` — `setTheme` (pins the theme before first paint via the
  real `adaptive-learner.theme` localStorage key) + per-view seeding
  (reuses the onboarding + lesson-playthrough patterns from the dexie
  smoke specs).
- `screenshots/` — committed baseline PNGs (created on first
  `--update-snapshots` run). `*.png` is `binary` in `.gitattributes`.
- `../playwright.visual.config.ts` — dexie preview build, no backend,
  `maxDiffPixelRatio: 0.01`, animations disabled, desktop 1440×900.

## Generating / updating the baseline (maintainer)

The baseline is generated and **reviewed** on a consistent machine — not
in this PR. From the repo root:

```bash
make test-visual-update   # builds the dexie frontend, then --update-snapshots
```

Then **review every changed PNG** and commit them. The first run creates
all 60 baselines.

## Running the check

```bash
make test-visual          # build dexie frontend + compare against baseline
```

## Rules

- **Never** `--update-snapshots` to silence a diff that reveals a real
  bug. Fix the bug; regenerate only after an intended visual change.
- Visual tests are slow — they run as their own CI job
  (`.github/workflows/visual-regression.yml`), **not** in the smoke gate.
  The workflow is `workflow_dispatch`-only until the baselines are
  committed; flip on the `pull_request` trigger afterwards.
- Theme slugs in `helpers.ts` mirror `frontend/src/lib/themes.ts`
  `THEME_IDS` exactly — keep them in sync if a theme is added/renamed.

## Follow-up

Mobile (375×812) baselines double the matrix to 120 — a deliberate
follow-up once the desktop baseline is stable.
