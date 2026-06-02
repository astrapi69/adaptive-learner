# Lesson Read-Aloud (TTS) — QA / Test-Pyramid Audit

- **Date:** 2026-06-02
- **Branch:** `qa/lesson-tts-read-aloud` (off `feature/lesson-tts-read-aloud`)
- **Scope:** every commit of the read-aloud feature, C1 → tests
  (`main..feature/lesson-tts-read-aloud`, 9 commits).
- **Baseline gates (GREEN):** `tsc --noEmit`, `npm run build`,
  `VITE_STORAGE_MODE=dexie npm run build`, Vitest (full suite 3128),
  backend `test_i18n_translation_audit`.
- **Purpose:** investigate each commit against the test pyramid
  (pure-unit → component → page-integration → E2E → mutation) and
  against test-management practice (gate membership, isolation,
  coverage-doc currency). Gaps are listed with the commit that
  introduced them. **This audit changes no product code and adds no
  tests** — it is the input to a follow-up fix pass.

---

## 1. Feature test inventory (as-built)

| Layer | Files | Tests |
|---|---|---|
| Pure unit | `lib/lesson/tts-text.test.ts`, `hooks/useReadAloud.test.ts` (helpers only), `components/lesson/ReadAlongText.test.tsx` (tokenizer) | 11 + 4 + (tokenizer subset) |
| Component | `components/lesson/ReadAloudButton.test.tsx`, `ReadAlongText.test.tsx`, `LessonTtsMiniPlayer.test.tsx`, `components/exercises/exercise-tts.test.tsx` | 6 + 5 + 4 + 4 |
| Page integration | `pages/Lesson.tts.test.tsx`, `pages/Lesson.tts.integration.test.tsx` | 20 + 7 (runtime) |
| E2E (Dexie smoke) | `e2e/dexie/lesson-tts.spec.ts` | 3 specs — **authored, not yet executed** |
| Mutation | — | none (Stryker not wired repo-wide) |

≈ **61 Vitest tests + 3 E2E specs.** The base of the pyramid (pure
logic) and the component layer are solid; the gaps cluster at (a) the
voice-lib seam, (b) two untested branches, (c) the reduced-motion
requirement, and (d) the unexecuted E2E.

---

## 2. Per-commit coverage map

| Commit | Adds | Tests shipped | Pyramid gap (→ §3) |
|---|---|---|---|
| `ba4522cb` **C1** engine hook + button + `speak(onBoundary)` | `useReadAloud.ts`, `ReadAloudButton.tsx`, `speech-synthesis.ts` onBoundary | helper unit (4), button component (6) | **B1** onBoundary unpinned; **C1g** hook not unit-tested; **B3** pulse reduced-motion; **D2** `readLessonSpeed` mutation |
| `8bb2955d` **C2** wire theory + 5 prompts; `markdownToSpeech`; `ttsLang`/`codeMode` | dispatcher + 5 renderers + `tts-text.ts` | `exercise-tts.test` (4): free_text/matching/cloze + code-suppress + no-ttsLang | **D1** picture/word_tiles prompt only at integration; **D2** `markdownToSpeech` mutation; note: helper first tested in C7 |
| `5df5b326` **C3** auto-read toggle | `useReadAloud` prefs, `Lesson.tsx` | `Lesson.tts.test` auto-read theory/prompt/toggle | auto-read prefs helpers only indirectly tested (folds into **C1g**) |
| `5974ede3` **C4** speed controls + no-voice warning | `useReadAloud` speed-ref + `voiceAvailable`, `Lesson.tsx` | speed visibility/persist/restart | **B2** `voiceAvailable=false` + `lesson-tts-novoice` never exercised |
| `bd76067b` **C5** follow-along highlight | `ReadAlongText.tsx`, `Lesson.tsx` swap | tokenizer + activeTokenIndex + render (5); page swap-in | **B3** `.tts-active` reduced-motion; **D3** word-advance not asserted at page level; **D2** tokenizer mutation |
| `0c4a01ed` **C6** i18n + `R` shortcut | 8 catalogs, `Lesson.tsx` | R reads/stops/ignored-in-input | i18n parity **covered** by `i18n-sync.test` (not a gap) |
| `e6ade972` **C7** continuous read + auto-advance | `collectTheoryRun`/`runStepForChar`, `Lesson.tsx` | helper unit; page Read-all + boundary advance | **D2** `collectTheoryRun`/`runStepForChar` mutation |
| `7f15478e` **C8** mini-player + pause/resume + `theoryBlockAround` | component, `useReadAloud` pause/resume, `tts-text.ts` | component (4); helper; page next/play-pause | engine `pause/resume` guard only indirectly tested (folds into **C1g**); **D2** `theoryBlockAround` mutation |
| `d2121196` **tests** integration + E2E | `Lesson.tts.integration.test.tsx`, `e2e/dexie/lesson-tts.spec.ts` | 7 integration | **B4** E2E spec **not executed** |

---

## 3. Prioritised gap list

### Tier B — regression-pin worthy / explicit-spec / operational

- **B1 — `speak()` `onBoundary` option is unpinned.** _(C1 `ba4522cb`)_
  `lib/voice/speech-synthesis.test.ts` pins that `speak()` attaches
  `onstart`/`onend`/`onerror`, but **not** `onboundary` (grep: 0
  matches). The follow-along highlight (C5) and continuous auto-advance
  (C7) both depend on that one line; deleting it would pass the voice-
  lib suite and break two features, caught only indirectly.
  _Fix:_ one assertion in `speech-synthesis.test.ts` that `onBoundary`
  is wired to `utter.onboundary`.

- **B2 — no-voice fallback path is untested.** _(C4 `5974ede3`)_
  `useReadAloud` sets `voiceAvailable=false` and the Lesson renders the
  `lesson-tts-novoice` / `lesson.tts.no_voice` notice — but no test
  exercises it. Every existing test runs with an **empty** voice list,
  which hits the `voices.length === 0` short-circuit that keeps
  `voiceAvailable=true`. The user-facing degradation branch (target
  language has no installed voice) can regress silently.
  _Fix:_ a hook/page test with a non-empty voice list that has no match
  for the requested lang → assert `lesson-tts-novoice` renders.

- **B3 — `prefers-reduced-motion` is not pinned for the TTS
  animations.** _(C1 `ba4522cb` button pulse; C5 `bd76067b`
  `.tts-active`)_ The feature spec explicitly required "no highlight
  animation under reduced-motion". The CSS implements it, but there is
  no regression pin — and the repo already has the exact pattern
  (`src/styles/reduced-motion.test.ts`, `content-set-action.test.ts`).
  happy-dom runs no layout, so a CSS-source pin is the right tool.
  _Fix:_ a `src/styles/*.test.ts` asserting the
  `@media (prefers-reduced-motion: reduce)` block disables
  `read-aloud-pulse` and drops the `.tts-active` wash for a static
  underline.

- **B4 — the Dexie E2E smoke spec has never been executed.**
  _(tests `d2121196`)_ `e2e/dexie/lesson-tts.spec.ts` is authored and
  wired (vite-preview starts, the runner reaches browser launch), but
  the chromium binary could not be downloaded in the authoring
  environment, so it has **no known-good run** — the "wired ≠ working"
  trap from `lessons-learned.md`. It is in `e2e/dexie/` so
  `make test-dexie-smoke` will pick it up.
  _Fix (operational, no code):_ run `make test-dexie-smoke` (or
  `npx playwright install chromium` first) before merge; record the
  first green run.

### Tier C — isolation / process

- **C1g — `useReadAloud` has no direct hook test.** _(C1 `ba4522cb`,
  extended C4 `5974ede3`, C8 `7f15478e`)_ Only the pure speed helpers
  are unit-tested; the engine's logic — named-voice vs `pickVoice`
  fallback, `setSpeed` mid-playback re-speak, `pause`/`resume` guard,
  `stop` reset, `onBoundary → boundaryIndex` — is covered **only
  indirectly** through `Lesson.tts.test.tsx`. A `renderHook` unit test
  would isolate the engine from the page and pin these branches
  directly.

- **C2g — `docs/audits/current-coverage.md` was not updated.**
  _(whole feature)_ The ai-workflow rule says to update the canonical
  coverage doc immediately when tests land; this feature added ≈61
  Vitest tests + 3 E2E specs with no coverage-doc delta entry.

### Tier D — nice-to-have / redundant / repo-level

- **D1 — picture_choice + word_tiles prompt buttons** are pinned only
  by the page integration test, not by a focused component test.
  _(C2 `8bb2955d`)_ `exercise-tts.test.tsx` covers free_text / matching
  / cloze; the other two are exercised via
  `Lesson.tts.integration.test.tsx`. Adequate, but asymmetric.

- **D2 — pure-logic functions are un-mutation-tested.** _(repo-level;
  targets: `markdownToSpeech` C2, `tokenizeForReadAlong` /
  `activeTokenIndex` C5, `collectTheoryRun` / `runStepForChar` C7,
  `theoryBlockAround` C8, `readLessonSpeed` C1)_ These are textbook
  Stryker targets, but Stryker is still "to be set up" repo-wide
  (`quality-checks.md`). Not a feature regression — flagged so the
  feature's pure core is on the list when mutation testing is wired.

- **D3 — the word-advance highlight is not asserted at the page
  level.** _(C5 `bd76067b`)_ `ReadAlongText` unit tests cover the
  active-word logic for a given `activeChar`, and the page test asserts
  the follow-along view swaps in — but no page test drives
  `boundaryIndex` forward to assert the highlight moves (the page tests'
  `FakeUtterance` never fires `onboundary`). The unit layer covers the
  logic; this is belt-and-suspenders.

---

## 4. Adequately covered (verified, not gaps)

- **i18n parity for `lesson.tts.*` across 8 catalogs** — covered by
  `src/data/i18n/i18n-sync.test.ts` ("every key in en.json is present
  in every other catalog") + the backend EN-passthrough audit. _(C6)_
- **Code-content suppression** — `exercise-tts.test` + the integration
  test both assert no read-aloud on a `media_type:"code"` exercise.
- **Two-phase button / controlled mode** unaffected — the existing
  exercise + lesson suites stayed green throughout (TTS self-hides
  without a synth mock).

---

## 5. Recommendation

Before merging PR #2, close the four **Tier-B** items (three are a
single test assertion each; **B4** is "run the gate"). **C1g** and
**C2g** are worth doing in the same pass for a clean isolation story +
coverage-doc delta. Tier-D items are deferrable (D2 rides the future
Stryker adoption). Suggested fix-commit ordering, each green
individually and each referencing the gap ID + origin commit:

1. `test(voice): pin speak() onBoundary wiring (B1 / C1 ba4522cb)`
2. `test(lesson-tts): no-voice fallback branch (B2 / C4 5974ede3)`
3. `test(styles): reduced-motion pin for TTS pulse + .tts-active (B3 / C1+C5)`
4. `test(lesson-tts): direct useReadAloud hook unit (C1g)`
5. run `make test-dexie-smoke`, record the result (B4 / d2121196)
6. `docs(audits): refresh current-coverage with the TTS delta (C2g)`

---

## 6. Fix-pass results (2026-06-02, branch `qa/lesson-tts-read-aloud`)

Executed the §5 plan. Feature Vitest coverage **≈61 → 73** (+12); full
suite **3140 green**; `tsc --noEmit` clean.

| Item | Status | Evidence |
|---|---|---|
| **B1** onBoundary wiring | ✅ **closed** | `speech-synthesis.test.ts` +2 (positive + unset) |
| **B2** no-voice fallback branch | ✅ **closed** | `useReadAloud.engine.test.ts` — `voiceAvailable=false` with a non-matching voice list |
| **B3** reduced-motion pin | ✅ **closed** | `styles/lesson-tts-motion.test.ts` (+4), brace-aware reduced-motion extraction |
| **C1g** direct hook test | ✅ **closed** | `useReadAloud.engine.test.ts` (+6): voice resolution, onBoundary→index, setSpeed re-speak, pause/resume, stop reset |
| **B4** run Dexie smoke | ⛔ **blocked (environment)** | chromium / chrome-headless-shell downloads are network-blocked in the authoring sandbox; the spec compiles + the preview server starts (runner reaches browser launch). **Action: run `make test-dexie-smoke` in CI / a browser-enabled env before merge.** |
| **C2g** coverage doc | ➖ **n/a → recorded here** | `docs/audits/current-coverage.md` does not exist repo-wide (the ai-workflow convention is uninstantiated); this feature's coverage delta is tracked in this audit |
| **D1 / D2 / D3** | ⏸ **deferred** | D1 redundant (integration covers picture/word_tiles); D2 rides future Stryker adoption; D3 belt-and-suspenders (unit covers the highlight logic) |

**Net:** every Tier-B regression-pin gap is closed except B4, which is
blocked only by the sandbox's lack of a browser binary — it is wired,
compiles, and must be run once in CI. The feature's pure core + engine
+ reduced-motion are now pinned directly rather than only via the page.
