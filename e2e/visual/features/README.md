# Per-feature screenshot baselines (#1023)

One labelled screenshot per **feature** (not per generic surface), used for
**both** pixel-diff regression and a documentation gallery. Complements the
two regression matrices in `../` (`theme-regression.spec.ts`,
`critical-surfaces.spec.ts`), which are organised by theme/surface rather than
by feature.

## Layout

```
e2e/visual/features/
  <feature-name>/
    <shot>.png          desktop, 1280×720
    <shot>.mobile.png   mobile,  375×812
```

- **Folders + files are kebab-case.** One folder per feature, one PNG per
  capturable state.
- **Default theme: `dark`.** Captured client-side via the real
  `adaptive-learner.theme` localStorage key (see `../helpers.ts` `setTheme`).
- **Viewports:** desktop `1280×720` (`<shot>.png`) + mobile `375×812`
  (`<shot>.mobile.png`). A desktop-anchored surface (e.g. a dialog) is
  captured desktop-only via `desktopOnly: true` in the `FEATURES` map.

## Source of truth

`../../scripts/capture-feature-screenshots.ts` — the `FEATURES` map pairs each
screenshot `path` (`<feature>/<shot>`) with a `setup(page)` that drives the
**dexie preview build** (no backend, the GH-Pages shape) into the state to
capture. A `setup` that can't reach its state deterministically returns
`false`, and the shot is skipped rather than committing a meaningless baseline.

## Generating / verifying (maintainer)

Baselines are generated + **reviewed** on a consistent machine — font
anti-aliasing differs between machines, so they are NOT generated in an
ephemeral CI/web container.

```bash
make capture-screenshots   # build dexie frontend, then --update-snapshots
# review every changed PNG, then:
git add e2e/visual/features/
git commit -m "test(visual): capture <feature> baselines"

make verify-screenshots    # pixel-compare against the committed PNGs
```

**Never** `--update-snapshots` to silence a diff that reveals a real bug — fix
the bug; regenerate only after an intended visual change.

## Captured features

| Folder | Shots | Feature |
|--------|-------|---------|
| `dashboard-tabs/` | `uebersicht`, `aktivitaet`, `missionen` | Tabbed Dashboard (#858) |
| `content-hub/` | `entdecken`, `meine-inhalte`, `import` | Content Hub tabs (#856) |
| `progress-hub/` | `uebersicht`, `statistik`, `meine-pfade` | Progress Hub tabs |
| `matching-animation/` | `matching-pairing`, `matching-resolved` | Matching pair selection + resolution |
| `lesson-modes/` | `practice`, `exam`, `timed` | Lesson mode toggle |
| `answer-toggle/` | `meine-antwort`, `aufloesung` | Exercise answer toggle (#1004) |
| `github-export/` | `share-dialog` | GitHub repo-export dialog (#1009) |
| `qr-code/` | `share-app` | QR-code app sharing (#775) |

## Manual-capture features (not web-reachable)

Some product features are **not** reachable by Playwright and are captured by
hand into the matching folder:

- **`launcher/`** — the desktop launcher is a native PyInstaller/Docker GUI
  (`launcher/`), not a web route. Capture its states (Docker-not-running
  dialog, step-checklist progress window, port field) manually with the OS
  screenshot tool and drop the PNGs here, kebab-case, same naming convention.

These folders carry a `.gitkeep` until their PNGs exist.
