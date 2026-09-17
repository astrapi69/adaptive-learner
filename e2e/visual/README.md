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
| `critical-surfaces.spec.ts` (#705, Phase 1) | 20 surfaces × 3 viewports, default (light) theme | up to 60 |

### Phase 2 — themes (#244)

5 critical views (dashboard, learning-path, lesson-matching,
lesson-result, settings) across all 12 registered themes.

### Phase 1 — critical surfaces × viewports (#705)

20 surfaces at 3 responsive viewports — desktop `1920×1080`, tablet
`768×1024`, mobile `375×667`:

dashboard (empty + populated), content-browser, content-discover,
content-import (#1380), content-my-lessons (#3011), create-lesson,
set-detail, lesson theory, lesson cloze, lesson matching, lesson summary,
review session, statistics, settings (general/data/about/ai/learning),
shortcut-help overlay.

`content-import` and `content-my-lessons` are the same tab in two states:
the first seeds no own lesson, so the "My Lessons" section is absent by
construction (`ImportActionsPanel` renders it only for
`userSets.length > 0`); the second seeds one through the Create-Lesson
wizard. Without the second, that section and everything in it — the six
row actions, the combine selection, the fork badge, the create button —
sat in no motif at all, and any change to it compared green (#3011).

A surface that can't be reached deterministically (e.g. the bundled set
has no cloze exercise) is `test.skip`-ped rather than committing a
meaningless baseline.

### Deterministic height, not just deterministic content (#3016)

Since the capture follows the app scroller instead of the viewport, a
late render changes the IMAGE HEIGHT, not just what sits below the fold.
Three habits keep that from turning into flaky baselines, all of them
already applied in `helpers.ts`:

- **Wait for the surface's own ready signals**, every loading placeholder
  it publishes, not just the first one (`settleDashboard`).
- **Reach the surface the way the app does.** Both dashboard motifs enter
  via a client-side route change, because `page.goto` fires
  `beforeunload` on the lesson route and that handler writes the very
  progress row the dashboard reads on mount. When a read and a write
  start from the same action, no wait can order them.
- **Pin live values.** A number that depends on what the network has
  delivered so far (the offline-cache count) cannot agree between the run
  that renders a baseline and the run that compares against it; pin the
  source to a fixture, as `pinContentRegistry` and `pinLessonCacheEmpty`
  do.

## Layout

- `theme-regression.spec.ts` — the 12 themes × 5 views matrix.
- `critical-surfaces.spec.ts` — the 20 surfaces × 3 viewports matrix.
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

Baselines **must** be rendered in CI, not on a dev machine — font
anti-aliasing differs per machine (#1532). The CI-first flows:

**Auto-sync (#1662, preferred — no artifact download).** Add the
`refresh-visual-baselines` label to the PR (or
`gh workflow run visual-baseline-sync.yml -f pr_number=<N>`). The
`visual-baseline-sync` workflow renders the baselines in CI and pushes
them onto the PR branch as a `chore(visual): refresh baselines` commit.
Then **review every changed PNG in the PR** — auto-sync never means blind
accept. This removes the manual download → commit handshake that used to
bounce back to the maintainer machine on every visual-critical PR.

> One-time setup: create the `refresh-visual-baselines` label, and
> (optional but recommended) add a `VISUAL_BASELINE_TOKEN` PAT secret so
> the push re-triggers the "Visual baseline gate" automatically. Without
> the PAT the push still lands; the gate must be re-run once. See
> [`docs/developer/testing.md`](../../docs/developer/testing.md).

**Manual fallback (maintainer machine, where the artifact download works):**

1. `gh workflow run visual-regression.yml --ref <pr-branch> -f update_baselines=true`
2. `gh run download <run-id> --name visual-baselines --dir /tmp/vb`
3. Review every changed PNG — confirm the diff is the intended change,
   not a regression — then copy the changed PNGs into
   `e2e/visual/screenshots/`.
4. Commit: `test(visual): update baseline after <what changed>`

`make test-visual-update` regenerates locally, but a locally-rendered
baseline drifts from CI's anti-aliasing — use it only to preview a diff,
not to commit the baselines that CI diffs against.

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
