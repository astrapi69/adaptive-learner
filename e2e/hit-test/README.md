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

## Two layers

| Layer | File | Server | Command |
|---|---|---|---|
| **Isolation** — the app shell + aggravators as toggles | `hit-test-offset.spec.ts` + `fixtures/shell.html` | none (`file://`) | `make test-hit-test` |
| **App-level** — real routes on the Dexie preview build | `hit-test-app.spec.ts` + `measure.ts` | `vite preview`, no backend | `make test-hit-test-app` |

Both use the same measurement (`elementFromPoint` at an element's rendered
centre must resolve back into that element); the app layer is non-destructive
(no clicks) so it sweeps every visible interactive element on a route.

## Run

```bash
make test-hit-test                 # isolation bench (fast, no build)
make test-hit-test-app             # real app (builds dist in Dexie mode first)
# or, from e2e/:
npm run test:hit-test
npm run test:hit-test-app
```

In the managed container the pre-installed Chromium may differ from the pinned
Playwright build; point at it explicitly:

```bash
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-*/chrome-linux/chrome \
  npx playwright test --config=playwright.hit-test.config.ts
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

**Isolation:** all scenarios pass (Δrows=0) in both desktop and mobile-emulated
headless Chromium. So — headlessly — the app shell (`overflow:hidden` +
`100dvh` + inner scroller), the header transform, an ancestor transform, the
sticky footer, the zoom viewport meta, and pre-scroll do **not**, by
themselves, desync the CSSOM box from the hit-test grid. The app also applies no
container-level CSS `zoom`/`transform: scale`.

**App-level:** all Settings interactive elements measure clean (0 desync of
44/93/69 on desktop, 31/80/56 on mobile-emulated). So the desync does **not**
reproduce against the real Settings surface in headless Chromium either — on
desktop OR touch-emulated (Pixel 7).

**Conclusion:** the render-vs-hit-test desync is not reproducible in headless
Chromium — not in isolation, not on the real app. The reproduction needs either
a **real touch device** (the on-screen-keyboard / address-bar visual-viewport
composited offset, which headless emulation does not replicate — measure it with
the `?vvdiag=1` probe on hardware, see #1569), or a **specific interaction the
sweep does not yet trigger**. This suite is now the bench + regression net for
when that state is identified.

## Next steps to chase the repro

- **Add a keyboard-open interaction**: in `hit-test-app.spec.ts`, focus a text
  field first (opening the on-screen keyboard on a real device / emulation that
  supports it), THEN measure the elements around it — the reported trigger.
- **Add a lesson route** (needs content setup via the `helpers/onboarding` +
  content fixtures the other Dexie specs use) to cover the MC/SC tiles and the
  `tiefe`-style input from the original report.
- **Add a WebKit project** once the class is understood (`browserName: "webkit"`)
  — the closest engine to mobile Safari available headlessly.
