# Testing reference

A pointer-level overview of the test surfaces. The authoritative test strategy
(pyramid, coverage targets, mutation testing) lives in
[`.claude/rules/quality-checks.md`](../../.claude/rules/quality-checks.md); this
page collects the developer-facing entry points.

## Everyday gate

```bash
make test            # backend + plugins + Vitest (fast, no coverage)
make check-types     # mypy + tsc --noEmit
```

`make test` must stay green after every change.

## End-to-end (Playwright)

| Suite | Config | Command |
|-------|--------|---------|
| Smoke | `e2e/playwright.config.ts` | `cd e2e && npx playwright test --project=smoke` |
| Dexie-mode gate | `e2e/playwright.dexie.config.ts` | `make test-dexie-smoke` |
| Visual regression | `e2e/playwright.visual.config.ts` | `make test-visual` |
| **Per-feature screenshots** | `e2e/playwright.features.config.ts` | `make verify-screenshots` |

## Visual regression vs per-feature screenshots

Two complementary screenshot surfaces, both run against the **dexie preview
build** (no backend, the GH-Pages shape):

- **Visual regression** (`e2e/visual/`, #244 + #705) — organised by
  *theme × view* and *surface × viewport*. Catches contrast/layout
  regressions across the matrix. Baselines in `e2e/visual/screenshots/`.
  - `make test-visual` — compare; `make test-visual-update` — regenerate.

- **Per-feature screenshots** (`e2e/visual/features/`, #1023) — organised by
  *feature*, one labelled PNG per capturable state, at the default `dark`
  theme and two viewports (desktop `1280×720` → `<shot>.png`, mobile
  `375×812` → `<shot>.mobile.png`). Doubles as a documentation gallery.
  Source of truth: the `FEATURES` map in
  `e2e/scripts/capture-feature-screenshots.ts`; layout + conventions in
  [`e2e/visual/features/README.md`](../../e2e/visual/features/README.md).
  - `make capture-screenshots` — capture/update (`--update-snapshots`);
    `make verify-screenshots` — compare.

Baselines are generated + **reviewed** on a consistent machine (font
anti-aliasing differs between machines), never in an ephemeral CI/web
container. **Never** `--update-snapshots` to silence a diff that reveals a real
bug — fix the bug; regenerate only after an intended visual change.

### Adding a feature screenshot

1. Add a `FeatureShot` to the `FEATURES` map in
   `e2e/scripts/capture-feature-screenshots.ts`: a kebab-case
   `<feature>/<shot>` `path` and a `setup(page)` that drives the dexie build
   into the state (returning `false` to skip when unreachable).
2. `make capture-screenshots`, review the new PNGs under
   `e2e/visual/features/<feature>/`, commit them.

A few features are **not** web-reachable by Playwright (the desktop launcher)
and are captured manually into the matching folder — see the features README.

### Feature-Screenshot-Katalog

- **Directory:** `e2e/visual/features/{feature-name}/`
- **Capture:** `make capture-screenshots`
- **Verify:** `make verify-screenshots`
- **Spec:** `e2e/scripts/capture-feature-screenshots.ts` (the `FEATURES` map)
- **No CI gate** (on-demand) — but **mandatory on UI PRs** (see
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md) and
  [`.claude/rules/quality-checks.md`](../../.claude/rules/quality-checks.md)).
  Pure backend / launcher / test / docs PRs are exempt.
- The existing **theme-regression** suite under `e2e/visual/`
  (`theme-regression.spec.ts` + `critical-surfaces.spec.ts`) stays
  independent — it is organised by theme/surface, this catalog by feature.
