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

Baselines are always **reviewed** image by image, and **never**
`--update-snapshots`-ed to silence a diff that reveals a real bug — fix
the bug; regenerate only after an intended visual change. Where they are
*rendered* differs by surface, because font anti-aliasing differs per
machine:

- **Per-feature screenshots** (`e2e/visual/features/`): captured on a
  consistent maintainer machine via `make capture-screenshots`.
- **Visual-regression baselines** (`e2e/visual/screenshots/`): rendered
  **in CI**, not on any dev machine (#1532) — see the refresh flow below.

### Refreshing visual-regression baselines (CI-rendered, #1532/#1662)

A visual-critical PR (lesson components/pages, exercise renderers,
`global.css`/theme CSS) must carry the affected `e2e/visual/screenshots/`
PNGs — the "Visual baseline gate" (#1640) blocks the merge otherwise. The
PNGs must come from CI so their anti-aliasing matches the nightly diff.

**Preferred — auto-sync (#1662).** Add the `refresh-visual-baselines`
label to the PR (or `gh workflow run visual-baseline-sync.yml -f
pr_number=<N>`). The `visual-baseline-sync` workflow renders the
baselines in CI and pushes them onto the PR branch as a
`chore(visual): refresh baselines` commit — no artifact download. Then
**review every changed PNG in the PR** before merge; auto-sync is a
proposal, never a blind accept.

**One-time maintainer setup:**

1. Create the `refresh-visual-baselines` label once
   (`gh label create refresh-visual-baselines -d "Render + push CI visual baselines onto this PR"`).
2. *(Optional, recommended)* add a `VISUAL_BASELINE_TOKEN` repo secret — a
   PAT or App token with `contents: write` + `pull-requests: write`. With
   it, the auto-sync push re-triggers the "Visual baseline gate" and it
   goes green on its own. Without it the push still lands, but a
   `GITHUB_TOKEN`-authored push does not re-trigger PR workflows, so the
   gate check must be re-run once (the workflow's PR comment says so).

**Manual fallback (maintainer machine, artifact download works there):**
dispatch `visual-regression.yml` with `update_baselines=true`,
`gh run download <run-id> --name visual-baselines`, review + copy the PNGs
into `e2e/visual/screenshots/`, commit.

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

## Device-only limits (named, not gaps)

Some behaviour is observable only on a real device: no mock, headless
browser or fake API reproduces it, and a test claiming to cover it would
assert something it cannot see. These are the named limits - each entry
says what the automated cells prove, what they cannot, and what covers
the rest. The model to follow is the header comment of
[`e2e/dexie/lesson-tts.spec.ts`](../../e2e/dexie/lesson-tts.spec.ts): state
what the test proves, what it cannot prove, and where the remaining proof
comes from.

The list is open. Adding an entry is normal; deleting one means proving
the behaviour became observable - not writing a test that looks at it.

1. **Storage eviction under pressure + standalone (home-screen) mode on a
   phone.** iOS/Android evict IndexedDB for installed web apps under
   storage pressure. Not reproducible in `fake-indexeddb` (unit) nor in
   headless Chromium (e2e). The revived
   `e2e/smoke/backup-restore.spec.ts` covers the `.alb` logic path; the
   manual BACKUP-AKZEPTANZTEST round-trip
   ([`quality-checks.md`](../../.claude/rules/quality-checks.md)) covers
   exactly this device-specific remainder.
2. **iOS Safari cuts a single speech utterance after ~15s** (#1928). The
   chunking mechanism is pinned in Chromium
   (`e2e/dexie/lesson-tts.spec.ts`); the cutoff itself stays a manual
   device check - the spec's header says so explicitly.
3. **Real speech-synthesis engines and voices.** Headless browsers ship
   no voices, so both the unit tests and the e2e spec inject a fake
   `speechSynthesis`. Every claim about real engine behaviour (voice
   availability, per-language quality, engine pauses) rests on the
   device check.
4. **iOS viewport zoom behaviour** (#1569; `user-scalable=no` is
   deliberate, stance revised in #1610).
   `frontend/src/styles/ios-zoom-guard.test.ts` pins the markup; the
   behaviour itself is only observable on the device.
