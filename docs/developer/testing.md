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

### Local prerequisites for the Dexie-mode gate (#2043)

The dexie-smoke specs obtain lesson content at runtime through
`DEFAULT_SOURCES` (`content-loader-sources.ts`): the bundled tree under
`dist/content/` first, then the upstream repo via
`raw.githubusercontent.com`. At least ONE channel must deliver:

- **Bundled**: check out `adaptive-learner-content` next to this repo (or
  set `ADAPTIVE_LEARNER_CONTENT_DIR`) before building; the build prints a
  `[copy-bundled-content] SKIP` line when it found none. A bundle-less
  build is fine as long as the browser can reach GitHub.
- **Runtime**: browser network access to `raw.githubusercontent.com`.

When neither channel delivers, the `content-probe` setup project fails
once with per-channel diagnostics and the dexie-smoke project is skipped
(`did not run`) - instead of ~34 specs failing with vague locator
timeouts. Reproduce that failure state on demand with
`CONTENT_PROBE_SIMULATE_UNOBTAINABLE=1`.

### Programmatic backup round-trip proof, content-verified (#2818/#2824/#2828)

BACKUP-AKZEPTANZTEST (`quality-checks.md`) requires a REAL manual
Export/Import round-trip in `make dev` before any backup-touching PR
merges - unit tests alone missed five consecutive "fixed" backup releases
(#49, #57, #64, #115, #117). That manual pass is still the gate; it is not
replaced by anything below.

What CAN complement it (proposed in #2828, not yet folded into the formal
rule - see that issue before treating this as a substitute for the manual
pass): a Playwright spec that drives the real app in a real browser,
captures the real downloaded file, and inspects its real bytes - stronger
than a `fake-indexeddb` unit test because it exercises the actual
export/download/re-import UI path, and reproducible/CI-able unlike the
manual pass.

Worked example: `e2e/dexie/backup-speech-recording-roundtrip.spec.ts`
(written for the #2824 fix - `speech_recordings` silently missing from the
Dexie `.alb` export). Pattern:

1. **Seed real data via raw IndexedDB**, not a mock - open the app's own
   live Dexie database (`indexedDB.open("adaptive-learner")` from
   `page.evaluate`) and `put()` a row shaped exactly like the app's own
   Dexie row type. Use this when the UI path to create the data needs
   hardware Playwright can't provide (here: a microphone) - only the
   capture step is bypassed, not the storage layer.
2. **Drive the real export button**, capture the real download
   (`page.waitForEvent("download")`), read the real file from disk
   (`download.path()` + `readFileSync`).
3. **Inspect the real bytes.** For a `.alb` (ZIP): `unzipSync` +
   `strFromU8` (`fflate`, already a project dependency - added to
   `e2e/package.json` as a devDependency rather than mocking the format).
   Assert a real size lower bound tied to the seeded payload (not just
   `> 0`) and the exact byte content of the seeded field inside
   `data.json` - not a truncated preview, not a length check.
4. **Wipe the store**, so the next step is provably doing the work.
5. **Drive the real import**: `fileInput.setInputFiles({name, mimeType,
   buffer})` with the exact bytes from step 2, confirm via the real
   restore-summary UI, then read the row back via a second raw IndexedDB
   read and assert it matches byte-for-byte.

Verify the spec itself the same way any regression test is verified: break
the fix under test (temporarily strip the relevant `BACKUP_TABLES` entry,
rebuild `VITE_STORAGE_MODE=dexie`, re-run - confirm RED at the expected
assertion), then restore and confirm GREEN. `git checkout -- <file>` after
a hand-edit is safe here specifically because the file was clean
(committed) before the edit - never do this on a file with real
uncommitted changes.

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

## LAN device debugging (iOS Safari, no Mac)

For device-only bugs (#2573, #1569) that need a real console, not a
guess. On a Linux dev machine Safari Web Inspector is not available, so
the loop is: serve the build over the LAN, open it on the phone, read
whatever error surfaces on the page itself.

```bash
make dev-lan-dexie   # builds VITE_STORAGE_MODE=dexie, serves it at
                      # 0.0.0.0:4173 (vite preview, no backend — the
                      # exact GH-Pages shape), prints the phone URL
```

This is plain HTTP by default. iOS Safari treats a plain-HTTP LAN
origin as non-secure, so the **service worker will not register** —
fine for reproducing an IndexedDB stall, not for a stale-SW/chunk-load
repro. For a secure-context repro:

1. Install [mkcert](https://github.com/FiloSottile/mkcert) and run its
   local CA once: `mkcert -install`.
2. Find the LAN IP `make dev-lan-dexie` prints (or `hostname -I`), then
   generate a cert for it: `mkcert 192.168.1.23 localhost 127.0.0.1`
   (produces `192.168.1.23+2.pem` + `192.168.1.23+2-key.pem` in the
   current directory).
3. Trust the mkcert CA on the phone too (AirDrop/email the
   `rootCA.pem` from `mkcert -CAROOT`, install the profile in iOS
   Settings) — otherwise Safari still flags the cert as untrusted.
4. Point `frontend/vite.config.ts`'s `preview.https` at the two files
   and re-run:
   ```bash
   ADAPTIVE_LEARNER_LAN_CERT=/path/to/192.168.1.23+2.pem \
   ADAPTIVE_LEARNER_LAN_KEY=/path/to/192.168.1.23+2-key.pem \
   make dev-lan-dexie
   ```
   The banner switches to `https://` and confirms the secure context.

**On-device console:** eruda (#2575), dev-only since #2610: the
`make dev-lan` / `dev-lan-dexie` builds carry it (`VITE_DEBUG_CONSOLE=1`)
and mount it **automatically** — open the LAN URL on the phone and the
console overlay is just there, no query flag to remember. In plain
`bun run dev` it stays behind `?debug=1` so it never surprises normal
desktop dev. The shipped build (production image, public GH-Pages)
contains no eruda chunk at all — a debug console in the deployed
artifact is an attack surface.

**Tap/viewport probe (the ghost-bug recorder, #1569/#2340/#2782):** the
`ViewportDiagnostic` overlay ships in EVERY build (it is query/setting
gated, not build-gated). Three equivalent ways to enable it, all sharing
one flag:

- Settings > General > Diagnostics > "Tap & viewport probe" toggle
  (takes effect live, no reload);
- `?vvdiag=1` on any URL (persists; `?vvdiag=0` clears);
- the `adaptive-learner.vv_diag` localStorage flag.

While enabled, every tap (element, `ΔY`, `@winY`, `@vvTop`) and every
significant viewport transition (keyboard open/close, scale change, a
phantom offset appearing) is appended to a persistent ring-buffer
protocol (`lib/diagnostics/vv-log`, capped at 500 entries, survives
reloads). Export it from the same Settings section ("Copy protocol") or
from the overlay's Copy button (last 8 taps only). Fix candidates for
the tap-offset stay togglable at runtime via `?vvfix=<id>`
(`novhd` / `vpheight` / `nolock` / `hardreset`, `?vvfix=off` clears); the
active candidate is recorded with every protocol entry.
