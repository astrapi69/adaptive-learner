# global.css analysis (2026-07-08)

Analysis-only pass. **No CSS was deleted, moved or rewritten.** The only
code that ships from this session is the inflow-stop guard (Step 4 below).
The deliverable is this document plus one tracking issue.

All numbers were measured in-session (`wc -l`, `grep`, a selector
extractor cross-checked against `src/` markup, the visual-baseline
inventory). Where a value can only be approximated (dead rules under
dynamic class composition), the confidence is stated. It is never
reported as certain.

Companion to `refactor-candidates-2026-07-08.md` (#1449). That pass could
not see this file: every size/complexity/cohesion gate
(`check-file-sizes.sh`, `check-complexity.sh`, `check-directory-size.sh`)
globs only `*.py *.ts *.tsx *.js *.jsx`. **CSS is a blind spot of the
instruments** - verified by reading `scripts/check-file-sizes.sh`
(`git ls-files ... '*.py' '*.ts' '*.tsx' '*.js' '*.jsx'`). That is the
structural reason a 7591-line stylesheet exists under a Tailwind-first
rule with nobody noticing.

## The core problem

CSS has no referential integrity. Nothing tells you which of the ~1160
rules still match live markup. A TypeScript symbol with zero fan-in trips
a linter; a CSS selector with zero matching elements trips nothing. So the
file only grows - a feature adds a page block, a migration rarely comes
back to remove the old one. The repo's own bug history proves the failure
mode: dead classes left after a Tailwind migration (#1419), classes
referenced in TSX but never defined in CSS (#1380, #1465), unlayered
global rules silently defeating authored Tailwind utilities (#211, #185,
#577, #1458). Every one of those is a symptom of the same missing
integrity.

## Step 1: Inventory (measured)

| Metric | Value |
|---|---|
| Total lines | **7591** |
| Rules (opening braces) | ~1163 |
| Distinct class selectors | 707 |
| Distinct id selectors | 11 (4 are false positives - `#hex` colour values my regex caught) |
| CSS custom-property definitions (`--x:`) | 77 |
| `var()` references | 1244 |
| `!important` | **7** (low - not the problem here) |
| `@media` blocks | 45 |
| `@keyframes` | 35 |
| `@font-face` | 0 (fonts live in `fonts-*.css`) |
| `@apply` | 0 |
| `@layer` | 6 (two small `@layer base` blocks; the rest is unlayered) |

### Other global CSS files (full picture)

global.css is the outlier, not the whole story - but it is 87% of the CSS
budget:

| File | Lines | Nature |
|---|---|---|
| `styles/global.css` | 7591 | this analysis |
| `styles/tailwind.css` | 143 | Tailwind entry + `@theme inline` token bridge (foundation) |
| `styles/themes/theme-*.css` (12) | ~57-87 each, ~830 total | the canonical 43-token themes (foundation, pinned by `themes.test.ts`) |
| `styles/toast-theme.css` | 60 | react-toastify token mapping |
| `styles/fonts-hangul.css` / `fonts-devanagari.css` | 29 / 28 | `@font-face` (foundation) |

**All CSS ≈ 8673 lines; global.css is 87.5% of it.**

### How it is loaded (why Tailwind never prunes it)

`main.tsx` imports `./styles/global.css` as a plain, **unlayered** static
import (after the layered `tailwind.css`). Consequences:

- The whole file ships to every user; there is no content-scan / purge
  step over it (Tailwind only purges its own utility generation).
- Being unlayered, every global.css rule **wins the cascade** over
  layered Tailwind utilities. This is by design (documented in
  `tailwind.css`: "unlayered rule in global.css wins") - but it is also
  the mechanism behind the #185/#211/#577/#1458 "authored utility
  silently defeated" bug family. Any migration out of this file must
  respect that the removed rule was previously winning.

### Growth analysis (honest limitation)

The working tree is a **shallow clone: 51 commits, all 2026-07-04 to
2026-07-08**. A true 3/6/12-month git growth curve **cannot be computed
here** and is not reported as one (numeric-claims discipline). Two proxies
are available instead:

1. **Recent commits touching the file** (shallow window): `+18` (#1463),
   `+11` (#1446), `+10` (#1415), `-36` (#1390, nav-sidebar removal),
   `-3` net (#1381). Net near-flat with feature adds partly offset by
   migration removals - growth is slow accretion, not a spike.
2. **In-file Phase tags** (the reliable growth proxy): section comments
   are stamped `Phase 2` through `Phase 66` and `v0.4.0` through `v1.35.0`.
   The distribution is continuous - essentially every development phase
   added a page or feature block. The heaviest contributors are the
   celebration/gamification waves (Phase 55 = 6 blocks, Phase 56/57 = 3
   each) and the early swipe/navigation work (Phase 23 = 4 blocks). The
   file grew one feature-block at a time over ~62 phases and never had a
   systematic reduction pass.

## Step 2: The five layers (measured, with line shares)

Boundaries are drawn at section-comment lines and are therefore
**approximate to a few lines**, but the shares are robust.

| Layer | Lines | Share | Verdict |
|---|---|---|---|
| **(1) Foundation / tokens** (L1-483) | 483 | 6.4% | **Legitimate. Stays.** |
| **(2) Component styles bypassing Tailwind** | ~6041 | 79.6% | **The debt.** The TAILWIND-ONLY violation. |
| **(3) Third-party-DOM overrides** (QR, ProseMirror, xyflow) | ~1067 | 14.1% | **Mostly legitimate** (see below). |
| **(4) Utility duplicates** | subset of L2 | - | Carve-out of L2, mechanical. |
| **(5) Presumed-dead rules** | ~60-90 | ~1% | Small. Confidence-tiered. |

Layers 4 and 5 are **carve-outs of Layer 2**, not separate regions -
they partition the migration work, they do not add to the line total.
Layers 1 + 2 + 3 partition the file.

**Legitimate-and-stays = Layer 1 + Layer 3 ≈ 1550 lines (~20%).**
The remaining ~80% (Layer 2) is the migration target.

### Layer 1 - Foundation (L1-483, legitimate)

`:root` tokens (method palette, matching-pair palette, `--space-*`,
`--radius-*`, `--font-*`, code-syntax palette), the box-sizing reset, the
`img/video/canvas` cap, the viewport-lock (`html/body/#root` scroll
model), inline-code + code-block base typography, the Phase 58I
`:focus-visible` baseline, Windows High-Contrast (WCAG 1.4.11), and the
two `@layer base` form-control padding blocks. This is not debt.

**Tests anchored to this layer** (must stay green through any change):
`themes.test.ts`, `contrast.test.ts` (28), `no-hardcoded-colors.test.ts`
(12), plus structural pins `input-padding-layer.test.ts`,
`hidden-reset.test.ts`, `single-scroll-container.test.ts`,
`app-shell-viewport.test.ts`, `ios-zoom-guard.test.ts`,
`matching-pair-palette.test.ts`, `reduced-motion.test.ts`. Roughly 16
test files assert directly against `global.css` text. They are the
regression net for the token layer AND for several Layer-2 blocks.

### Layer 2 - Component styles bypassing Tailwind (~6041 lines, the debt)

Organised page-by-page and feature-by-feature: Landing, Onboarding,
Assessment, Dashboard, Session chat, Settings (storage-mode toggle,
ModelPicker, provider list, key-source badge), Content tree, Lesson
viewer, Curriculum, correction round, next-step suggestions, gamification
(XP pill, missions, badges, streaks, Badge Gallery), celebration
(confetti, milestone overlay, feedback intensity), Anki, Pronunciation,
NotebookLM, voice/read-aloud, plus the large mobile `@media` override
stack. These style app-owned markup that could carry Tailwind utilities
instead. **This is the TAILWIND-ONLY debt.**

### Top-20 Layer-2 blocks (largest, with component mapping)

| # | Lines | Span | Block / component |
|---|---|---|---|
| 1 | 287 | L4805-5091 | Mobile `@media` override stack + iOS focus-zoom guard (#1353) - many components, one responsive block |
| 2 | 215 | L5345-5559 | BackupCompare -> `components/settings/backup/BackupCompare.tsx` |
| 3 | 165 | L800-964 | Assessment page + swipe/keyboard nav (Phase 23B) -> `pages/Assessment.tsx` |
| 4 | 157 | L2662-2818 | Content source->target->level tree (Phase 60) -> `components/content/browser/ContentTree.tsx` |
| 5 | 136 | L5209-5344 | ModelPicker -> `components/settings/ai/ModelPicker.tsx` |
| 6 | 133 | L2172-2304 | Storage-mode toggle (Phase 10F) -> Settings data tab |
| 7 | 123 | L4208-4330 | iOS swipe-to-reveal on touch (Phase 23D) -> RecentSessions rows |
| 8 | 121 | L541-661 | Landing page -> `pages/Landing.tsx` |
| 9 | 117 | L6470-6586 | Floating read-aloud mini-player (C8) -> lesson TTS |
| 10 | 116 | L7123-7238 | Chat-analysis loading indicator -> `pages/ImportDetail.tsx` |
| 11 | 110 | L3182-3291 | Smart Next-Step Suggestions (Phase 64) -> `components/lesson/NextStepSuggestions` |
| 12 | 109 | L3741-3849 | Theme picker preview cards (Phase 58E) -> `components/settings/ThemePicker` |
| 13 | 108 | L3524-3631 | XP-earned pill (#505) -> `shared/XpBadge` / lesson summary |
| 14 | 107 | L6780-6886 | Badge Gallery drawer (Phase 57) -> `components/badges/BadgeGallery` |
| 15 | 106 | L2819-2924 | Share placement preview + warnings (Phase 61) -> ShareWizard |
| 16 | 105 | L6887-6991 | Gold-badge glow (Phase 57) -> Badge Gallery / dashboard widget |
| 17 | 101 | L1994-2094 | Daily missions widget (Phase 56F) -> `components/gamification/DailyMissionsCard` |
| 18 | 97 | L3632-3728 | Milestone overlay (Phase 55D) -> `MilestoneHost` |
| 19 | 96 | L1313-1408 | Swipe-to-peek on CycleProgress (Phase 23C) -> `components/session/CycleProgress` |
| 20 | 95 | L2925-3019 | Lesson viewer page (Phase 44) -> `pages/lesson/Lesson.tsx` |

(Runners-up: Curriculum page L4115-4207 93, dashboard-grid migration
comment-stub L981-1063.)

### Layer 3 - Third-party-DOM overrides (~1067 lines, mostly legitimate)

Styling of DOM that a library renders, where you **cannot** attach a
Tailwind class to the element:

| Block | Lines | Span | Legitimacy |
|---|---|---|---|
| html5-qrcode scanner viewfinder overlay | 302 | L1444-1745 | Legitimate (camera surface, corner-bracket gradients). Sync-only; hidden in Dexie mode anyway. |
| ProseMirror / TipTap editor + lowlight code block | 412 | L5560-5971 | Mostly legitimate (`.ProseMirror` node typography is library-rendered). A subset (toolbar chrome) could be Tailwind. |
| @xyflow/react learning-path graph | 353 | L7239-7591 | Legitimate (`.react-flow__*` + node/edge internals are library-rendered; theme via `--xy-*` mapping). |

This layer largely **stays**. Trimming it is low-value and higher-risk;
exclude it from the early tranches.

### Layer 4 - Utility duplicates (carve-out of Layer 2, mechanical)

No large standalone "duplicate utility class" library exists here; instead
the duplication is **inside** the Layer-2 component rules. Declaration
counts in the file: `display:flex` 200, `gap:` 222, `align-items` 122,
`flex-direction` 96, `justify-content` 38, `padding:` 211, `display:grid`
14. The overwhelming majority of these map 1:1 to a Tailwind utility
(`flex`, `gap-2`, `items-center`, `flex-col`, `justify-between`, `p-*`,
`grid`). **Consequence for the plan: most Layer-2 migration is mechanical
utility replacement, not creative re-design** - which lowers the per-block
risk once a visual net is in place.

Evidence the migration path works and is already in use: eight
`... migrated to Tailwind utilities` comment stubs remain where CSS was
removed (`.dashboard-grid`, `.lesson-nav*`, MatchingExercise, FreeText,
WordTiles, Cloze, FreeText code-input). Those exercises now carry Tailwind
classes and their old CSS is gone - proof of concept for the whole Layer 2.

### Layer 5 - Presumed-dead rules (small, confidence-tiered)

**This is the honest headline: dead-rule removal is NOT where the line
savings are.** A static selector extractor flagged **64** class selectors
whose literal token does not appear in `src/`. But this codebase composes
class names dynamically at ~174 sites (`className={`...`}`, `clsx`, `cn`),
so static analysis massively over-reports. Verifying each candidate:

- **~44 are runtime/library classes** - `hljs-*` (lowlight applies them),
  `react-flow*` / `react-flow__*` (xyflow), `is-editor-empty` (ProseMirror
  placeholder). **LIVE.**
- **~12 are dynamically composed** - confirmed by grep:
  `streak-cell--tier-${...}`, `lesson-node--${status}`, `lp-edge--${kind}`,
  `nav-mode-badge-${mode}` (mode = `ai-augmented`/`content`),
  `api-key-source-${source}`, `api-key-format-${state}`,
  `diff-marker-${kind}`, `badge--${difficulty}`, `is-${role}` /
  `is-${status}` (chat bubbles, cycle steps, summary rows). **LIVE.**
- **~8 are genuinely unreferenced** - the real dead residue.

**Genuinely-dead residue (high confidence - literal selectors, no dynamic
stem, zero markup hits):**

| Selector | global.css lines | Note |
|---|---|---|
| `.analysis-cancel-link` | 7184, 7195 | superseded by button styling |
| `.onboarding-header-row` | 673, 4924 (base + mobile) | |
| `.lesson-summary-link` | 3301, 3314 | |
| `.btn-danger` | 532, 537 | superseded by shadcn Button variants |
| `.form-optional` | 741 | |

**Medium confidence (literal, zero hits, but a sibling stem is composed so
double-check before removal):** `.content-share-extra` (L2820),
`.content-share-placement-path` (L2826), `.content-source-native` (L2681).

Total genuinely-removable in Layer 5: roughly **60-90 lines** across ~8
selectors. Small. **The debt is live Layer-2 CSS that should be Tailwind,
not dead CSS.** Do not oversell dead-rule deletion as the win.

> Honesty note: dynamic template-literal and `clsx`/`cn` composition make
> any static dead-CSS verdict approximate. The residue above was
> hand-verified by grep; treat "medium confidence" as "confirm the
> component still exists before deleting."

## Step 3: Reduction plan in tranches (Class C)

CSS migration is **Class C** of the #1449 taxonomy: not a mechanical
split, and there is no classic unit-test net for rendered pixels. The net
is the **Playwright visual baselines**, plus the ~16 structural tests that
assert against `global.css` text.

### Visual-baseline coverage (measured)

Two suites, run daily + on release (not per-PR):

- `theme-regression.spec.ts`: **5 views x 12 themes = 60** baselines
  (1440x900). Views: `dashboard`, `learning-path`, `lesson-matching`,
  `lesson-result`, `settings`.
- `critical-surfaces.spec.ts`: **16 surfaces x 3 viewports x light = 48**
  baselines. Surfaces: dashboard (empty/populated), content
  browser/discover/import, set-detail, lesson theory/cloze/matching/summary,
  review-session, statistics, settings general/data/about, shortcut-help.

97 PNG baselines committed on disk (some combos skip when the seed state
is unreachable).

**Covered (safe-to-migrate first):** Dashboard, Content browser/discover/
import, Set-detail, Lesson viewer (theory/cloze/matching/summary/result),
Review, Statistics, Settings (general/data/about), Learning-path graph.
These Layer-2 (and Layer-3 xyflow) blocks have a pixel net.

**NOT covered by any visual baseline (higher-risk - add a baseline BEFORE
migrating):**

- Landing page (L541-661)
- Onboarding (L662-758)
- Assessment (L759-964)
- Session 7-step chat page + chat bubbles (L1244-1443, L1658-1745) -
  only the *lesson* runner is pinned, not the *session* chat
- Curriculum page + TipTap editor chrome (L4115-4330, L5560-5971)
- Anki (L6167-6243), Pronunciation (L6587-6657), NotebookLM (L6658-6732),
  voice/read-aloud mini-player (L6274-6586)
- Badge Gallery drawer (L6780-7058) - dashboard covers only the widget
- Settings AI/Learning/Plugins sub-panels, ImportDetail loading indicator
- QR scanner overlay (L1444-1745) - device-only, not baseline-able

For these, the tranche's precondition is a new committed baseline
(critical-surfaces matrix entry) captured on the maintainer's baseline
machine, exactly as #1380 did for Discover/Import.

### Tranches, prioritised (each = one small PR, green visual suite)

Do NOT execute any tranche in this session.

| # | Tranche | Est. line gain | Risk | Net required |
|---|---|---|---|---|
| T-A | **Layer 5 dead-rule removal** (high-confidence 5 selectors first, then the 3 medium after confirming the component exists) | ~60-90 | **Low** | existing structural tests + a grep pin "these selectors gone" |
| T-B | **Layer 4 utility-duplicate migration on baseline-covered blocks** (Dashboard, Content tree, Lesson viewer, Settings general/data, Statistics) - replace `.x{display:flex;gap:..}` with Tailwind utilities on the owning component | ~1500-2500 | **Medium** | the 60 theme-regression + 48 critical-surfaces baselines |
| T-C | **Layer 2 per-component migration, baseline-covered** - one component per PR (BackupCompare, ModelPicker, missions/badges widgets, next-step, XP pill) | ~2000 | **Medium** | same baselines; per-component diff |
| T-D | **Layer 2 per-component migration, NOT baseline-covered** - Landing, Onboarding, Assessment, Session chat, Curriculum, Anki, Pronunciation, NotebookLM, Badge Gallery drawer. Each PR **first** adds a visual baseline, then migrates. | ~1500 | **Higher** | NEW baseline as the PR's first commit |
| (skip) | **Layer 3** (QR / ProseMirror / xyflow) | - | high, low value | leave in place |
| (never) | **Layer 1** foundation | - | - | stays |

Sequence: T-A -> T-B -> T-C -> T-D. Foundation and legitimate Layer 3 stay.

### Explicit non-recommendation

**Do NOT split global.css into ten CSS files** (`landing.css`,
`settings.css`, ...). That relocates the lines without solving anything:
the referential-integrity gap remains (imported CSS is still un-purgeable,
still unlayered, still invisible to the gates), the cascade-order
guarantee gets harder to reason about across files, and the count on the
"CSS budget" is unchanged. The only split worth doing is the **token
layer** carve-out described in Step 4, and only because it lets the growth
guard exempt legitimate token additions cleanly. The reduction that
matters is **migration into Tailwind on the component**, not
redistribution across stylesheets.

## Step 4: Inflow stop (the one code PR)

Before the bulk can shrink, the inflow must stop - otherwise the file
refills faster than tranches drain it (the exact rationale behind
`.filesize-baseline`). Mechanism, mirroring the existing ratchet:

- New guard `scripts/check-css-size.sh` + a frozen `.css-size-baseline`
  (global.css at its current **7591** lines). global.css **may not grow**
  past the baseline; the check exits 1 on growth. It only ratchets down:
  after a reduction tranche, lower the baseline number.
- The failure message points authors to this audit doc and says where to
  put styles instead (Tailwind utilities on the component; a new token in
  `theme-*.css` / `global.css :root`).
- **Token/foundation exception:** rather than a fragile region-aware
  parser, the guard uses the same escape hatch as `.filesize-baseline` -
  a legitimate token addition bumps the one-line baseline number with a
  justifying comment. If token churn proves frequent, the clean follow-up
  is to extract the L1-483 foundation block into `styles/tokens.css`
  (imported alongside the themes) and point the guard only at the
  remaining component file; that keeps token edits entirely out of the
  guarded budget. Deferred, not built here, because it is a real code move
  (Class C) and this session ships only the guard.
- Wired into `.github/workflows/cohesion-check.yml` (which already runs
  `check-file-sizes.sh`) with `**/*.css` added to its path trigger, and a
  `make check-css-size` target for local use.

Status: tracking issue **#1467**; the guard (`scripts/check-css-size.sh`,
`.css-size-baseline` frozen at 7591, `make check-css-size`, wired into
`cohesion-check.yml`) ships in the PR that closes #1467. Verified in-session:
passes at baseline, exits 1 on a simulated +3-line growth, reports the
ratchet-down hint on a simulated shrink. **No line of global.css was
changed by this session** (still 7591).

## What is legitimate and stays

- **Layer 1 foundation (~483 lines, 6.4%)** - tokens, reset, focus,
  high-contrast, base form padding. Never migrated.
- **Legitimate Layer 3 (~1067 lines, 14.1%)** - QR overlay, ProseMirror
  node typography, xyflow graph internals. Library-rendered DOM that
  cannot carry a utility class.
- **Total legitimate ≈ 1550 lines (~20%).**

The other **~6041 lines (~80%)** is Layer 2 - app-component styling that
belongs on the component as Tailwind, drained over tranches T-A..T-D once
the inflow is stopped.

## Questions and assumptions

- **Growth curve over 3/6/12 months**: could not be computed (shallow
  51-commit clone). Reported via in-file Phase tags + shallow-window
  deltas instead, and the limitation is stated. Not a silent guess.
- **Layer boundaries**: drawn at section-comment lines, approximate to a
  few lines; the percentages are robust to that. Stated as approximate.
- **Dead-rule verdicts**: approximate by nature (dynamic class
  composition). Hand-verified by grep and confidence-tiered; "certain" is
  never claimed.
- **Component mapping of Top-20 blocks**: derived from section comments +
  a targeted grep of the owning file. One block (the 287-line mobile
  `@media` stack) spans many components by design and is labelled as such.
