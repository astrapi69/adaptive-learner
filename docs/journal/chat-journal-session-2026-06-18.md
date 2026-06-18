# Chat journal — 2026-06-18

## EXP-034 App-side integration (DIS-04 … DIS-07)

CCW autonomous session: implement the app-side of EXP-034 (Content
Discovery + Search Index), four sub-tasks, each as its own GitHub issue
→ feature branch → PR against `develop` → squash-merge.

### 1. DIS-04 — Search-index loader (#733 → PR #735)

- Goal: fetch each content repo's lean `search-index.json` so a learner
  can FIND material before downloading it (the `npm search` half).
- Result: `lib/content/search-index-loader.ts` (pure) —
  `fetchSearchIndex` (CORS-safe raw fetch via the existing
  `buildFileRequest`/`fetchWithRetry`, 24h localStorage cache,
  stale-while-revalidate, offline/error → cache or `[]`),
  `fetchAllIndices` (parallel, capped at 10 via `mapWithConcurrency`),
  `SearchableSet` + `parseSearchIndex`. 15 vitest cases.

### 2. DIS-05 — "Inhalte entdecken" page (#736 → PR #738)

- Goal: `/discover` page — debounced search + combinable filters
  (language/level/domain/trust/AI-checked) + sort, result list with
  badges + per-set download, empty states.
- Result: `pages/Discover.tsx` + nav link + route + dexie-smoke route
  case. Reusable props-driven shared components `SearchField`,
  `FilterBar`, `SetDiscoveryCard`. Pure `discover-index` (filter/sort/
  match) + `discover-repos` (official + recommended + user repo
  assembly). i18n `discover.*` + `nav.discover` in all 11 catalogs.
  57 new vitest cases; full suite 4977 green.

### 3. DIS-06 — Per-set download + removal (#739 → PR #740)

- Goal: download just one set with progress; remove a set keeping the
  index entry.
- Result: `downloadSet` gains optional `onProgress` (Dexie emits per
  lesson, API ignores); `SetDiscoveryCard` shows a live progress bar +
  a Remove action (deletes lessons via `deleteSet`, search-index cache
  stays → re-downloadable; non-official sources). 4 i18n keys × 11
  catalogs. Storage/Content suites 556 green.

### 4. DIS-07 — Content-Browser search: local + index (#741 → PR #742)

- Goal: the existing Content Browser search also searches the index,
  grouped "Your content" / "Available".
- Result: `components/content/AvailableContentResults.tsx` —
  self-contained (own index load + download-prompt dialog), loads the
  index once, filters by the active query excluding downloaded sets,
  lists matches under "Available to download" with a "not downloaded —
  download now?" prompt. ~2 lines added to the complexity-baselined
  `ContentPage`. 4 i18n keys × 11 catalogs. Full suite 5037 green.

### Notes / lessons

- **YAML 1.1 boolean keys**: bare `yes:` / `no:` mapping keys are parsed
  as `True`/`False` by PyYAML — quote them (`"yes":`) so the dotted
  i18n lookup `discover.filter.yes` resolves. Caught + fixed before the
  first sync.
- **`@/` alias in isolated content/ tests**: a single
  `src/components/content/*.test.tsx` run fails `@/components/ui/*`
  resolution (pre-existing — `BookCompanion.test` does the same); the
  full suite resolves it, so the full suite is the gate.
- Per-set download already existed (`downloadSetDexie` fetches one set);
  DIS-06 added the progress + removal UX around it, not a new download
  path.

All four PRs squash-merged to `develop`; all four issues auto-closed.
