# Performance Audit — 2026-06-03

Scope: frontend bundle (Part A), Dexie query patterns (Part B),
backend query patterns (Part C). This document is the master
performance-audit report; Part A (bundle) is complete and gated for
review before any fix lands. Parts B and C are scanned post-review.

Method:

- `npx vite build` (Rolldown) for chunk file sizes.
- `npx vite-bundle-visualizer` treemap, parsed for per-module
  composition inside each chunk.
- Numbers are **gzipped** unless stated; raw shown alongside.

---

## Part A — Bundle Analysis

### Totals

| Metric | Value |
|---|---|
| Total JS, all chunks | 5.0 MB raw / **1.54 MB gzip** |
| CSS (index + vendor-ui + LearningPath) | 166 KB raw / **28 KB gzip** |
| PWA precache | 130 entries / 5.7 MiB (includes bundled content) |
| **Main entry `index` (loads on EVERY page)** | 1.35 MB raw / **446 KB gzip** |

The headline problem is the main `index` chunk: 446 KB gzip is
downloaded by every first-time visitor before any page renders, and
~190 KB of that is wasted (see F-1).

### Top chunks (gzip)

| Chunk | gzip | raw | Loaded | Notes |
|---|---|---|---|---|
| `index` (entry) | 446 KB | 1.35 MB | every page | **~190 KB is all-8-language i18n (F-1)** |
| `es` | 296 KB | 894 KB | on code-block render | **full highlight.js, ~190 langs (F-2)** |
| `content-utils` | 145 KB | 462 KB | on editor mount | TipTap + ProseMirror + lowlight (inherent) |
| `vendor-charts` | 118 KB | 412 KB | Dashboard / Progress | recharts 3 + redux-toolkit + d3 |
| `QRScannerModal` | 110 KB | 376 KB | QR scan only | html5-qrcode — already lazy ✓ |
| `LearningPath` | 81 KB | 261 KB | /learning-path only | xyflow + dagre — already lazy ✓ |
| `vendor-react` | 56 KB | 178 KB | every page | react-dom — inherent |
| `vendor-markdown` | 51 KB | 165 KB | help / markdown | already split ✓ |
| `Settings` | 49 KB | 176 KB | /settings | includes qrcode generator |
| `db` (dexie lib) | 34 KB | 106 KB | Dexie mode | inherent |

### Lazy-loading state — verified GOOD

All 21 route pages are `React.lazy` in `App.tsx`. Confirmed already
lazy / dynamic:

- `@xyflow/react` + `dagre` → isolated in the lazy `LearningPath`
  chunk. ✓
- `html5-qrcode` → `React.lazy` via `QRScannerModal` (Phase 61 fix
  holds). ✓
- `sql.js` (WASM) + `jszip` → dynamic `import()` in
  `apkg-builder.ts` / `lesson-export.ts` / `notebooklm-package.ts`. ✓
- `recharts` → only reachable from the lazy Dashboard/Progress pages
  (own `vendor-charts` chunk). ✓
- `@dnd-kit/sortable` → its own `sortable.esm` chunk (48 KB raw),
  pulled only by the lazy CreateLesson / WordTiles paths. ✓

So the problem is **not** missing route-level lazy loading. It is
**eager data globs** baking content into shared chunks, and one
dynamic import pulling far more than it needs.

### Findings

#### F-1 (P0) — All 8 i18n catalogs are bundled into the main entry

`src/storage/dexie-storage.ts:443`:

```ts
const catalogs = import.meta.glob("../data/i18n/*.json",
  { eager: true, import: "default" });   // <-- eager
```

`dexie-storage.ts` is reached by `getStorage()` on every page, so the
eager glob inlines **all eight** language catalogs into `index`:

| el | ja | de | fr | es | pt | tr | en |
|----|----|----|----|----|----|----|----|
| 31 KB | 28 KB | 27 KB | 27 KB | 26 KB | 26 KB | 26 KB | 24 KB |

= **~215 KB gzip** in the main bundle; a user needs exactly one.

**Fix:** drop `eager`, `await` the matched importer (the `get`
function is already `async`). Each language becomes its own chunk;
first paint downloads ~25 KB instead of ~215 KB. Net **~190 KB gzip
off every page load.** Lowest-risk, highest-impact change in the
audit. (`labels.ts:198` does the same eager i18n glob into the lazy
LearningRepo chunk — fix in passing.)

#### F-2 (P1) — Full highlight.js (all ~190 languages) on code blocks

`src/components/content/CodeBlock.tsx:35`:

```ts
const hljs = (await import("highlight.js")).default;  // entire library
```

This is the `es` chunk: **296 KB gzip / 894 KB raw**, 194 language
modules — mathematica (36 KB), isbl, gml, sqf, 1c, maxima, x86asm,
stata, mel, lsl, gauss, arduino … none of which appear in a language /
Python / psychology learning app. The file comment even claims a
"~tens-of-KB highlighter", which is false today.

**Fix:** import `highlight.js/lib/core` and register only the
languages the content uses — mirror the set already curated in
`src/components/editor/code-block-config.ts` (bash, css, java, js,
json, markdown, python, sql, ts, xml, yaml). `highlightAuto` still
works across the registered set. Expected: `es` chunk **296 KB → ~25
KB gzip** (a ~270 KB saving on the first code lesson). Lazy already,
so no change to non-code lessons.

#### F-3 (P2) — Help glossary content eager-globbed into main

`src/lib/help-glossary.ts:22` uses `import.meta.glob("../data/help/*.json",
{ eager: true })`. help-glossary is imported by `useButtonTooltips` /
`HelpTooltip` / `HelpDrawer`, some reachable from the always-mounted
shell, so help content (the `help/*.el.json`, `methods.el.json`, … seen
in the `index` treemap) is partly baked into the main bundle. The
`data/help` dir is 412 KB on disk.

**Fix (deferred, not a one-liner):** help-glossary exposes a
*synchronous* typed lookup API; making the glob lazy requires an async
init or a provider-level preload. Filed as a backlog item with measured
impact rather than rushed into this pass.

#### F-4 (P3) — praise + plugin-config eager globs

`src/lib/praise/phrase-picker.ts:45` (praise, 72 KB dir) and
`dexie-storage.ts:2304` (plugin-config, 28 KB dir) are eager. Praise
lands in the `celebration-bus` chunk (loaded during lessons), plugin-
config is small. Low impact; convert opportunistically.

### Part A — fix plan + VERIFIED results

Approved 2026-06-03: F-1 + F-2 fixed now (commit C2); F-3 → backlog
`PERF-HELP-GLOSSARY-LAZY-01` (P2); F-4 → backlog `PERF-EAGER-GLOBS-01`
(P3).

| Change | Before (gzip) | After (gzip) | Saving |
|---|---|---|---|
| **F-1** main `index` chunk (every page) | 446 KB | **233 KB** | **−213 KB / page load** |
| F-1 i18n catalogs | 8× inlined in main | 8 per-lang chunks (~25 KB ea.) | user fetches 1 |
| **F-2** highlight.js on first code block | 296 KB (full lib, ~190 langs) | **21 KB** (shared core + 11 grammars) | **−275 KB** |
| F-2 side effect: editor `content-utils` | 145 KB | 131 KB | grammars de-duped into shared chunk |

Implementation:

- **F-1**: `dexie-storage.ts:440` i18n glob → non-eager + `await`;
  `labels.ts:191` `labelsFor` made `async` (non-eager glob), cascaded
  through `renderer.ts` `renderRepository` (now async) + its two
  `dexie-storage` call sites + the labels/renderer/parity tests. Each
  language is now its own chunk, shared by both consumers.
- **F-2**: new `src/lib/content/hljs.ts` imports `highlight.js/lib/core`
  + the 11 grammars the content uses (mirrors `code-block-config.ts`);
  `CodeBlock.tsx` dynamic-imports it instead of the full `highlight.js`.
  Rolldown extracts the shared core + grammars into one chunk used by
  both CodeBlock and the editor. CodeBlock does NOT pull the editor.

Verified: `npx tsc --noEmit` clean; full Vitest suite 3199/3199 green;
`npx vite build` confirms the chunk sizes above. No new dependencies,
no schema changes, no component-tree changes (parallel-safe with the
Tailwind migration).

---

## Part B — Dexie query optimization

_To be completed after Part A review._

## Part C — Backend query optimization

_To be completed after Part A review._
