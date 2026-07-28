---
description: Frontend pitfalls - TipTap, React effects, CSS specificity, Vitest/happy-dom, TypeScript/Vite toolchain, prettier hook
globs:
  - frontend/**/*
alwaysApply: false
---

# Frontend pitfalls
## TipTap image node in AdaptiveLearner is `imageFigure`, not `image`

AdaptiveLearner's editor (`frontend/src/components/Editor.tsx`) does NOT load `@tiptap/extension-image`. It loads `@pentestpad/tiptap-extension-figure`, which registers its node under `name: "imageFigure"`. `@tiptap/extension-image` IS in `package.json` but is never imported.

**Consequence**: any TipTap doc that contains a plain `{type: "image", ...}` node fails the editor's strict ProseMirror schema. The unknown node breaks doc construction and the editor renders empty — for the WHOLE doc, not just the image.

Anyone writing an HTML→TipTap converter, a TipTap-emitting importer, or generating TipTap JSON from any other source (AI, scraper, migration) MUST emit `imageFigure`, not `image`. Same attrs (`{src, alt, title}`) — the imageFigure node spec is `content: "inline*"` so omitting `content` is fine; the schema accepts both `{type, attrs}` and `{type, attrs, content: []}`.

**Symptom of the wrong type**: title + metadata appear in the editor chrome, the editor body is empty, no console error in the browser (ProseMirror logs the schema rejection at debug level only). The article-list dashboard shows everything fine because it reads `Article.title` directly, not `content_json`. The bug is invisible until someone actually opens the editor.

**Why this is easy to miss**:
- TipTap's official docs and tutorials universally use `image` in code samples, so any importer modeled on those docs gets the type wrong by default.
- The toolbar's image-upload button works regardless: `Figure.addCommands.setImage(...)` dispatches an `imageFigure`-typed node internally, masking that the schema doesn't accept the literal name `image`.
- The editor's own markdown serializer at `Editor.tsx:1396` handles `type === "image"` as if it expected to see one, which is misleading; the serializer is reading nodes already in the doc, where they would only appear if some other extension produced them.

If a switch to `@tiptap/extension-image` ever happens (e.g. dropping the Figure extension), be aware that both extensions register a `setImage` command. Adding both side-by-side will silently shadow one toolbar behavior.

Walker shipped with this bug originally (commit `b986397`); fix landed in `cfd8b57` along with a regression-pin test in `tests/test_walker.py::test_image_node_type_is_imageFigure_not_image` that fails loudly with the actionable error message if the type ever regresses to `image`. A one-time data-fix script at `scripts/fix_medium_import_image_nodes.py` patched the 209 already-imported articles (152 had image nodes; 451 nodes total renamed).

## React 18 dev-mode double-effect-mount strands `mockImplementationOnce`

React 18 in development mode (Strict Mode and/or its testing-library equivalent) deliberately mounts components twice and runs effects twice to surface non-idempotent setup. Combined with happy-dom + Vitest, the result is that a `useEffect` calling an API mock fires twice on the first render.

If the test sets `mockImplementationOnce(returnValue)` per test, the FIRST useEffect call consumes the implementation and the SECOND call falls through to the default `vi.fn()` (which returns `undefined`) — the component then sees the default empty state and the test fails on a stale assertion.

**Fixes**:
- **Use `mockImplementation(...)` (no `Once`).** The implementation persists across both effect mounts. Per-test `afterEach { mock.mockClear() }` (NOT `mockReset`) keeps the implementation alive across test boundaries while still resetting call history.
- **Set a default implementation in the `vi.mock` factory itself**, e.g. `getPlugin: vi.fn(async () => ({ settings: {} }))`. Tests that don't care about the response can rely on the default; tests that do override per-test via `mockImplementation`. `mockClear` (not `mockReset`) preserves the factory default between tests.

The `mockClear` vs `mockReset` distinction matters specifically because of the factory-default pattern: `mockReset` strips the factory's implementation and the next test starts with a vanilla `vi.fn()` returning undefined, which crashes the next render's `useEffect` chain with `Cannot read properties of undefined (reading 'then')`.

## Globals invoked with `new` need a function constructor, not an arrow

`vi.stubGlobal("XMLHttpRequest", vi.fn(() => fakeXhr))` fails with `TypeError: () => fakeXhr is not a constructor` - arrow functions cannot be invoked with `new`. Stub with a regular function expression instead: `vi.stubGlobal("XMLHttpRequest", function () { return fakeXhr; })` (an explicitly returned object replaces the implicit `this`, so the pre-built fake becomes the result of `new`). Generalizes to every global callers invoke with `new` (`WebSocket`, `Worker`, `Notification`, ...): arrows break silently, a regular function or a class works.

## TipTap editor

### Storage format

TipTap stores as JSON. NOT HTML, NOT Markdown. TipTap CANNOT render Markdown. Markdown must be converted to HTML before storage.

- On import: convert Markdown files to HTML with the Python `markdown` library, then store as TipTap JSON.
- When switching WYSIWYG -> Markdown: convert JSON to Markdown (nodeToMarkdown).
- When switching Markdown -> WYSIWYG: convert Markdown to HTML, then to JSON.

### Extensions

- StarterKit does NOT include an image extension. `@tiptap/extension-image` is required separately.
- Figure/Figcaption: use `@pentestpad/tiptap-extension-figure`, NO custom code.
- Character count: use `@tiptap/extension-character-count`, NO custom code.
- Currently 15 official + 1 community extension installed (see CLAUDE.md).
- Before writing custom code, ALWAYS check whether an official TipTap extension exists.

### Peer dependencies

Community extensions (`@pentestpad/tiptap-extension-figure`, `tiptap-footnotes`) can silently upgrade to `@tiptap/core` v3. Always pin with `--save-exact`.

- `@pentestpad/tiptap-extension-figure`: pin to 1.0.12 (last v2-compatible); 1.1.0 requires `@tiptap/core` ^3.19.
- `tiptap-footnotes`: pin to 2.0.4 (last v2-compatible); 3.0.x requires `@tiptap/core` ^3.0.

`npm ci` in CI fails on peer-dep conflicts. Do NOT use `--legacy-peer-deps` as a fix.

### CSS

TipTap renders inside `.ProseMirror`. CSS selectors have to account for that.

- Specificity: `.ProseMirror p.classname` instead of `.tiptap-editor classname`.
- All styles MUST work through CSS variables (3 themes x light/dark = 6 variants).

## TypeScript 6 no longer auto-includes all `@types/*`

TS 5 silently included every `@types/*` package from `node_modules` when the `types` compilerOption was absent. TS 6 stopped doing this: if `@types/node` is installed transitively but not named in `types`, `import fs from "node:fs"` fails with `TS2591: Cannot find name 'node:fs'`.

Concrete: `frontend/src/components/ChapterSidebar.test.tsx` imports `node:fs`/`node:path` to load fixture data. Worked under TS 5 (`@types/node` came in transitively via `happy-dom`/`vite`/`vitest`). Broke on TS 6 bump.

Fix: add an explicit `@types/node` devDependency AND list it in `tsconfig.json` under `"types": ["node", "vite/client"]`. Both halves are needed - installing the package alone does not bring it in on TS 6.

Applies going forward: any `@types/*` you want in scope under TS 6 must be named in `types` explicitly.

## `@types/node` major bumps cascade into tsconfig `lib`

`@types/node@22` shipped polyfilled lib augmentations (e.g. typing `Array.prototype.at()` even under `lib: ES2020`). `@types/node@24` dropped them, deferring entirely to whatever lib the project declares. Symptom on a ^22 → ^24 bump: `TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.` even though no source code changed.

This is NOT a breakage in `@types/node`; it is correct behavior. The earlier convenience was the anomaly.

Fix at the consuming repo: bump `tsconfig.json` `target` and `lib` to `ES2022` together with the `@types/node` major bump. `Array.prototype.at()` is ES2022 standard library. Vite 8 / esbuild emit ES2022 fine; runtime is Node 24 / modern browsers. Zero source-side changes required.

General rule: when bumping `@types/node` across majors, run `tsc --noEmit` in the same change window. If it newly fails on stdlib globals, bump `lib` to match the runtime ES level - do NOT carry per-call workarounds (`as any[]`, casts) and do NOT pin `@types/node` back to the old major.

Concrete bump landed 2026-05-07 in commit on `main` after the v0.28.0 cycle: `^22.19.17` → `^24.12.2`, `target` + `lib` ES2020 → ES2022, 8 `.at(-1)` sites in `PreviewPanel.test.tsx` cleared without modification.

## Vite 7 requires Node 20.19+ / 22.12+

Vite 7 uses Node's `crypto.hash` top-level API which landed in Node 20.12+ / 21.7+ (backported to 22 LTS). On Node 18, `vite build` fails with `[postcss] crypto.hash is not a function` coming from `vite-plugin-pwa`'s postcss handling. The error is misleading: it is not a PWA/postcss bug, it is a Node version issue.

Vitest 4 does NOT exercise the same code path, so `npm run test` can still pass on Node 18 even though `npm run build` fails. Do not rely on tests alone to validate a Vite major bump; always build too.

CI runs Node 24 (`.github/workflows/{ci,coverage}.yml`), which is fine. Local envs on Node 18 must upgrade to Node 24+.

## Vite 8 migration (DEP-09 + SEC-01)

`vite-plugin-pwa@1.3.0` (published 2026-05-06) added Vite 8 to its peer-dep range (`^3.1.0 || ^4 || ^5 || ^6 || ^7 || ^8`) and unblocked the bump. The CVE chain `workbox-build` -> `@rollup/plugin-terser` -> `serialize-javascript` (3 high-severity advisories: GHSA-5c6j-r48x-rmvq RCE + GHSA-qj8w-gfj5-8c6v DoS) clears as a side effect; `npm audit --audit-level=high` returns zero high findings after the bump. The unrelated moderate `uuid` advisory (GHSA-w5hq-g745-h8pq) stays open and is its own track.

Vite 8 (Rolldown) requires `manualChunks` as a function, not an object. Vite 7 used Rollup, which accepted both forms. Vite 8 ships Rolldown by default, which only accepts the function form. Symptom: `Invalid output options ... For the "manualChunks". Invalid type: Expected Function but received Object` followed by `TypeError: manualChunks is not a function at rolldown/dist/shared/...`. Fix: convert the package-list-per-chunk object to a function that matches the module id and returns the chunk name. Use a trailing slash (`id.includes('/node_modules/${pkg}/')`) to prevent prefix collisions (`react` vs `react-dom` vs `react-router-dom`). The `id` is always an absolute path; bare-package matching is unreliable.

DEP-04 landed Vite 6 -> 7 deliberately because vite-plugin-pwa 1.2.0 did not yet ship Vite 8 compat; DEP-09 + SEC-01 paired in one session because both items resolve on the same upstream release.

Vitest 4 covers the matrix `vite: ^6 || ^7 || ^8`; bumping Vite alone keeps Vitest configuration untouched. The `@vitest/coverage-v8` peer-dep is exact-pinned to its own Vitest version, so when bumping Vitest itself bump both in lockstep or `npm install` will downgrade the parent.

The check that caught this in production was the build step, not the test step (per `lessons-learned.md` rule "Do not rely on tests alone to validate a Vite major bump; always build too"). Vitest 707/707 passed with the broken `manualChunks` config. `npm run build` was the first signal.

## CSS specificity trap: `h2 + p` loses to `p:not(:first-child)`

Specificity for `[data-app-theme="classic"] .ProseMirror h2 + p`: (0, 1, 1, 2) - 1 attr, 1 class, 2 elements.

For `[data-app-theme="classic"] .ProseMirror p:not(:first-child)`: (0, 1, 2, 1) - 1 attr, 1 class + 1 pseudo-class = 2 "classes", 1 element. The pseudo-class pushes the base rule ahead of the adjacent-sibling override.

When both rules match (a paragraph that directly follows a heading AND is not the first child), the higher-specificity `:not(:first-child)` wins and the heading override never applies.

Fix: append `:not(:first-child)` to each `h* + p` override. Combined (0, 1, 2, 2) beats the base (0, 1, 2, 1).

Generalizes: any CSS override against a `:not(:first-child)` base rule needs at least the same pseudo-class weight.

## TipTap `useEditor` does NOT flush `editor.storage` reads to React

Inline reads like `{editor?.storage.characterCount?.words()}` in JSX do not update reliably on every content transaction. TipTap's built-in re-render fires on selection changes, not every content edit.

Two viable patterns:

1. `useEditorState` selector (TipTap-idiomatic). Wraps `useSyncExternalStore`, subscribes to the editor's transactionNumber, re-runs the selector per transaction.
2. `useState` + `editor.on('update')` listener (plain React). Manually `setWordCount(...)` on every update event.

Choose pattern 2 when running under React `StrictMode` + Playwright + Vite dev server. `useSyncExternalStore` under that combination produced stale renders even though storage updates fired. The plain-listener path bypasses `useSyncExternalStore` entirely.

Cleanup: always pair `editor.on('update', cb)` with `editor.off('update', cb)` in the same `useEffect` cleanup to avoid leaks across hot-reload cycles.

## Prefix testid selectors match every nested testid that shares the prefix

A selector like `[data-testid^='session-card-']` cleanly matches each card root AND every nested child testid that shares the prefix (`session-card-menu-{id}`, `session-card-menu-delete-{id}`). `toHaveCount(N)` returns `2N` or more per visible card.

Fix: `[data-testid^='session-card-']:not([data-testid*='-menu-'])`, or give the root a distinct testid like `session-card-root-{id}`.

Same shape as the `[class^=""]` overmatch antipattern. Always test a prefix selector against the full rendered surface before shipping.

## Global CSS rules: distinguish viewport containers from app container

Setting `overflow: hidden` on `html, body, #root` as a single rule blocks document scroll but also blocks every full-page component that relied on scroll (Settings, Dashboard, GetStarted, Help).

Correct pattern when preventing document-level scroll for editor zoom behavior:

```css
html, body { height: 100%; overflow: hidden; }  /* viewport lock */
#root { height: 100%; overflow-y: auto; }       /* app scroll */
```

html and body control the browser viewport. `#root` is the React application root and must remain scrollable for pages that don't implement their own scroll container.

When a layout fix requires setting `overflow: hidden` on one of the three, think explicitly about whether full-page components inside the app need internal scroll, and expose it via `#root`.

### Incident record

- `ef7ce5c`: added `html, body, #root { overflow: hidden; }` as fix for a zoom-related layout bug. Broke scroll on Settings, Dashboard, Onboarding, Help pages.
- `c25483e`: split the rule. Kept html/body locked (preserves zoom fix), restored `#root overflow-y: auto`.

## React `useEffect` deps + i18n test mocks: the `t` function isn't stable

Symptom: a component's fetch-on-open effect kept failing in tests because the `setError` call in the rejection branch never landed. Looked like a race condition but wasn't. The effect's dep array included the i18n `t` helper:

```typescript
useEffect(() => {
    let cancelled = false
    api.something.fetch(...)
        .then(...)
        .catch((err) => {
            if (cancelled) return
            setError(...)
        })
    return () => { cancelled = true }
}, [open, kind, ids, t])  // <-- t here
```

In production the i18n provider memoises `t` so the dep is stable. In the test setup, the i18n mock returns a fresh `t` function on every render:

```typescript
vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k, fallback) => fallback, ...}),
}))
```

Result: every parent re-render produces a new `t`, so the effect cancels its prior run and refetches. The rejection from the previous run lands while the new run's `cancelled` closure is still false, BUT the previous run set `cancelled=true` in its own closure. The catch sees `if (cancelled) return` and bails out before `setError` fires. The error never surfaces to the user.

Fix: omit `t` from the dep array when the request shape doesn't actually depend on it (the fallback string in the toast was the only consumer). Add an `eslint-disable-next-line` with a comment explaining why:

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, kind, ids])
```

Generalises to any hook function the i18n mock returns fresh per render — `useDialog`, `useNavigate` (when its callback closure captures state), etc. When a test fails because a state update "never happens" but the production code looks correct, check the effect dep array against the hooks consumed inside it.

The right fix is NOT to memoise the mock's `t` per-render (that defeats the point of mocks). The right fix is to scope the effect's deps to what genuinely affects the request.

## Run vitest from `frontend/`, not the repo root

Vitest's config lives in `frontend/vite.config.ts`. Running `npx vitest run` from the repo root finds no config, defaults to the `node` environment, and produces `ReferenceError: document is not defined` across every test that touches the DOM. In a real 2026-05-12 incident, 101 of 120 test files failed with this error before I noticed the cwd was wrong — completely misleading red flag suggesting something I'd just edited broke the entire test environment.

### Tells in the failure output

- Per-file `setup: 0ms` (happy-dom didn't initialise).
- `environment: 0ms` in the summary line.
- The error itself: `ReferenceError: document is not defined` (or `window` / `HTMLElement` / similar).
- Files that passed earlier in the same session suddenly all fail.

### Three reliable invocations

1. `make test-frontend` from anywhere (the Makefile cd's into `frontend/` before running vitest).
2. `cd frontend && npx vitest run` — direct, fast, same result as the Makefile target.
3. `cd frontend && npx vitest run src/path/to/file.test.tsx` for a targeted re-run.

### Failure modes

- `npx vitest run` from repo root → no config found → wrong environment → 100% red flag on DOM-touching tests.
- `poetry run vitest` (mixed up with backend tooling) → vitest not in the Python venv → command-not-found.

Concrete rule: when a recent edit "breaks every vitest file at once," check the cwd before suspecting the code. A green run minutes ago in the same session and a red run now with `setup: 0ms` is the cwd diagnostic, not a regression.

## Radix DropdownMenu + happy-dom is brittle for Vitest

Radix DropdownMenu (`@radix-ui/react-dropdown-menu`) renders its menu content through a portal and uses pointer events plus focus-scope state for the open transition. happy-dom's portal + focus-scope simulation is incomplete, so a Vitest that mounts a component using DropdownMenu can:

- Render the trigger button correctly (works).
- Open the menu on `fireEvent.click(trigger)` — intermittent. Sometimes the menu content never lands in the DOM; sometimes it lands but `findByTestId` for an item inside `<DropdownMenu.Portal>` returns nothing.
- Throw `setState during render` from `@radix-ui/react-focus-scope` when both `fireEvent.pointerDown` + `fireEvent.click` fire in rapid succession (the workaround pattern most documentation suggests).

The F2c session burned ~30 min trying every combination of `fireEvent.click`, `fireEvent.pointerDown` + `fireEvent.pointerUp`, `userEvent.click`, and adding `act()` wrappers. None of them produced a stable test.

### Concrete rule for new Vitest files that exercise a Radix DropdownMenu

1. **Test the trigger button's existence** via `findByTestId` on the trigger. This works reliably and pins regressions where the trigger disappears entirely (e.g. the kebab gets accidentally hidden behind a conditional).

2. **Do NOT attempt to assert on the menu content** via `findByTestId` inside `<DropdownMenu.Portal>`. The portal timing in happy-dom makes this flaky. Defer the assertion to an E2E spec in a real browser.

3. **Test the action handler in isolation** when the handler is non-trivial — pass the handler in by prop or extract it from the component so the unit test can invoke it directly. The F3 Toolbar tests do this: the primary Copy button (not behind a portal) gets full Vitest coverage including clipboard write and toast assertions; the chevron dropdown's two items are covered only by the matching Playwright spec.

If a future test needs reliable DropdownMenu-open in unit tests, consider:
- A test-only `defaultOpen` prop on the wrapping component.
- A controlled-open variant in production code that the test can force open.
- Switching to a non-portal alternative for the menu.

None of these is worth the complexity for the current use cases; the E2E split is the cleaner answer.

## Split-button (default + chevron disclosure) for primary + alternative outputs

Surfaced 2026-05-14 designing the v0.32.0 F3 Copy button.

When a feature has two outputs where one is the obvious 90%-case default and the other is a discrete alternative ("Copy as Markdown" vs "Copy as plain text"), use a split-button: a primary action button glued to a chevron disclosure that exposes the alternative.

### Anti-patterns this avoids

- **Two equal-weight buttons** ("[Copy MD] [Copy plain]"): forces the user to make a format decision in technical jargon every time, even when they know they want the default. Doubles the toolbar footprint.
- **A modal "Copy options" dialog**: extra round-trip for the 90%-case; users have to read + click to confirm what they already wanted.
- **Right-click context menu only**: invisible to anyone who doesn't know to right-click. Discoverability dies.

### Implementation pattern (verified in F3)

1. Primary button + chevron use the same Radix DropdownMenu trigger that's already in the codebase.
2. The dropdown menu has the primary action first (so a user who opens the menu by mistake doesn't have to re-orient) plus the alternative below it.
3. The primary button's default click bypasses the menu entirely — one click, no flicker.
4. Tooltip on the chevron says "More options" / "Copy options" so users know it expands the action set.

Cross-platform precedent: GitHub's "Squash and merge" / "Create a merge commit" / "Rebase and merge" split button, Notion's "Copy" → "Copy link" / "Copy as Markdown" picker, Linear's view-switcher. The pattern is well-understood.

### When NOT to use a split-button

- Three or more alternatives at roughly equal weight: use a full menu, not a split. Cognitive load of "pick one of three" is higher than "default plus one alternative".
- The alternatives have no clear primary: use a regular dropdown.
- The action is destructive: a split-button can fire the primary by accident. Use a confirm dialog instead.

## The `prettier-frontend` pre-commit hook reformats whole files (no config + 4-space code)

Surfaced 2026-06-12 during the TipTap v2->v3 migration (#311 / #315). `frontend/` has no prettier config (no `.prettierrc`, no `prettier` key in `package.json`), but the entire `frontend/src` tree is authored in 4-space indent + `{x}` (no inner brace spaces). The `prettier-frontend` pre-commit hook (`.pre-commit-config.yaml`, `entry: cd frontend && npx prettier --write`) therefore runs prettier with its defaults (2-space, `{ x }`, 80-col) and rewrites every staged `frontend/src` file in full to a style nothing else in the repo uses. Touch one line, the hook reformats the whole file.

CI already skips this hook: `.github/workflows/ci.yml` sets `SKIP: prettier-frontend,eslint` for the pre-commit job. So prettier is enforced nowhere except this misconfigured local hook. Committing its output is wrong — it produces hundreds of lines of churn inconsistent with the codebase.

### Rules until the config is fixed (a 4-space `.prettierrc` or dropping the hook — filed as a follow-up)

1. Commit `frontend/src` changes with `SKIP=prettier-frontend git commit`. The ESLint hook still runs (and is the real gate); only the spurious reformatter is skipped. This mirrors CI exactly.
2. Never commit the hook's reformatting. If a commit aborted after the prettier hook ran, the 2-space rewrite is sitting in your worktree — see the stash trap below.

### Corollary: `git stash` captures pre-commit-hook worktree edits

The same session lost time to this. Sequence that bites:

1. `git add` a `frontend/src` file (clean 4-space edit), `git commit`.
2. The `prettier-frontend` hook rewrites the file to 2-space in the worktree, then the commit aborts (e.g. the ESLint hook failed on an unrelated pre-existing error). pre-commit restores unstaged changes but leaves the prettier rewrite in the worktree (the file shows `MM`).
3. `git stash push -- <file>` now captures the 2-space rewrite, not your clean edit.
4. Later `git stash pop` + commit (with prettier skipped) silently commits the whole-file reformat. (This actually happened in #314 and needed the follow-up #315 to undo.)

### Tells + fix

- After an aborted commit, check `git diff --stat`: a ~20-line change showing as 200+ changed lines means the hook reformatted the file.
- Recover the clean edit with `git restore <file>` before stashing — `git restore` pulls from the index (your staged clean edit), discarding the worktree reformat. Verify with `git diff --cached` (should be only your real change) before committing.

General rule: a pre-commit hook that mutates files (`prettier --write`, `ruff format`, `--fix`) leaves those mutations in the worktree when the commit fails. Treat the worktree as dirty-with-hook-output after any aborted commit; don't stash or re-commit blind.
