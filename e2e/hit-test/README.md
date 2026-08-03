# Hit-test offset harness (#1569)

A fast, self-contained bench for the **tap/click-lands-1-2-lines-below** bug
(#1569). It measures the desync between where a target is **rendered** and the
coordinate the browser **hit-tests**, in real Chromium, against an isolated
shell fixture — **no backend, no vite server**.

## Why this exists

The bug is a *visual-position vs hit-test-grid* desync. It is easy to fix the
wrong thing blindly (the #1570 attempt shipped and was reverted). This harness
turns the guesswork into a measurement we can **adjust anytime**: each scenario
is one factor combination; a reproducing scenario turns red with the measured
offset, and once a fix lands the same suite is the regression net.

The measurement that surfaces in headless: for a target, does
`document.elementFromPoint(rect-centre)` return that same target, and does a
real `mouse.click` at that centre activate it? `boundingBox()` and `mouse.click`
share the layout coordinate space, so they only disagree when a transform /
compositing layer offsets the hit-test grid from the CSSOM box — exactly the
class a **desktop-Chrome** repro would be.

## Run

```bash
make test-hit-test                 # from the repo root
# or, from e2e/:
npm run test:hittest
```

In the managed container the pre-installed Chromium may differ from the pinned
Playwright build; point at it explicitly:

```bash
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-*/chrome-linux/chrome \
  npx playwright test --config=playwright.hittest.config.ts
```

Two projects run every scenario: desktop `chromium` and touch-emulated
`mobile-chromium` (Pixel 7).

## Adjust

- **Scenarios**: edit the `SCENARIOS` array in
  [`hit-test-offset.spec.ts`](./hit-test-offset.spec.ts). Each row is a name, a
  fixture query string, a viewport, and the target index to aim at.
- **Fixture factors**: [`fixtures/shell.html`](./fixtures/shell.html) reproduces
  the app shell (`01-base.css`) and its aggravators as URL toggles:
  `shell`, `headerTransform`, `ancestorTransform`, `sticky`, `zoomMeta`,
  `scroll=N`, `n=N`. Add a new factor by adding a class + a toggle there.

## Current finding (2026-08-03)

On this isolated fixture, **all scenarios pass (Δrows=0)** in both desktop and
mobile-emulated headless Chromium. So — headlessly — the app shell
(`overflow:hidden` + `100dvh` + inner scroller), the header transform, an
ancestor transform, the sticky footer, the zoom viewport meta, and pre-scroll
do **not**, by themselves, desync the CSSOM box from the hit-test grid. The app
also applies no container-level CSS `zoom`/`transform: scale`. This narrows the
cause: the reproduction needs either the **real app DOM/CSS** or a **real
device** (the on-screen-keyboard / address-bar visual-viewport offset, which the
`?vvdiag=1` probe measures on hardware — see #1569).

## Next extension (planned)

An **app-level** spec that runs the same `elementFromPoint`-vs-`rect`
measurement against real routes (a Settings checkbox, a lesson field/MC tile) on
the **Dexie-mode preview build** (`VITE_STORAGE_MODE=dexie`, no backend — the
GH-Pages shape the bug is reported on). That is where the real app's CSS can
reproduce what the isolation fixture does not. Reuse the same assertion; add the
routes as scenarios.
