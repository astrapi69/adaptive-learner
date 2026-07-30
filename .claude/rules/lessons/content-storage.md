---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: Content + dual-storage lifecycle pitfalls - Dexie/API parity, ghost content, source-language inheritance
globs:
  - frontend/src/storage/**/*
  - frontend/src/lib/content/**/*
  - plugins/adaptive-learner-plugin-content-loader/**/*
alwaysApply: false
---

# Content + storage-lifecycle pitfalls
## Dexie-mode is part of the contract: same-commit or not at all

Surfaced 2026-05-26 from the v1.26.0 Phase 42 / Learning Repository incident. The new `LearningRepoSettingsSection`, `LearningRepo` page, and `LearningRepoWidget` all called `api.pluginSettings.*` / `api.learningRepo.*` directly, bypassing `IStorageService`. The feature shipped to main, the GH-Pages workflow rebuilt with `VITE_STORAGE_MODE=dexie`, and every user landing on the public deployment got a raw `HTTP 404` toast on Settings, Dashboard, and the Learning-Repo page. The bug went undetected for ~24h because no automated gate exercised the GH-Pages-shape build.

### Rule

Any new feature whose default path makes an API call MUST either:

1. Route through `getStorage()` so `DexieStorage` carries the client-side path (preferred — keeps both modes alive), OR
2. Gracefully degrade in Dexie mode with a friendly, user-facing "not available in browser mode" message — shipped IN THE SAME COMMIT as the feature.

"We'll add the Dexie path in a follow-up" is exactly the pattern this rule exists to ban. Follow-ups land at "as soon as someone has time"; the GH-Pages deploy runs in minutes. The half-shipped state spends ~all of its time in production.

### Why the rule lives at this scope

The GitHub Pages deployment at `https://astrapi69.github.io/adaptive-learner/` is the first impression for every prospective user. Modern users have zero tolerance for raw HTTP errors and stack traces — one error toast and the tab is closed forever. Server-mode users (the dev's own machine) can take a degraded experience; public visitors cannot.

### Enforcement

- `make test-dexie-smoke` walks every nav-reachable route against the `VITE_STORAGE_MODE=dexie` build with NO backend. Any error toast or uncaught error fails the gate. Aggregated into `make release-test` so it cannot be skipped at release time.
- The gate exists in `e2e/dexie/dexie-mode.spec.ts` + `e2e/playwright.dexie.config.ts` and runs in ~20 seconds (vite preview + 15 chromium navigations + assertions).

### Concrete failure modes the rule prevents

- A component that imports `api.*` directly and crashes with 404 in Dexie mode (Phase 42 / Learning Repository).
- A settings panel that fetches plugin config from a backend-only endpoint (`/api/plugin-settings/{name}`) with no DexieStorage equivalent.
- A "save" button that toasts a raw `ApiError.detail` on failure instead of routing through the friendly mapper shipped in DEV-MODE-FRIENDLY-ERRORS-01.
- A new plugin route surfaced from a Settings tab where the plugin's manifest only mounts under ApiStorage's plugin discovery.

Pairs with "Operational gaps masquerade as wired infrastructure" — same family. A feature that works in API mode is not the same as a feature that works. A gate that only exercises one mode is operationally half-wired. `DEV-MODE-FRIENDLY-ERRORS-01` (closed in commit 3eae5e4) — the friendly-error mapper handles "API errors should never reach the user" at the toast layer; this rule handles the same problem at the architectural layer ("the API call shouldn't happen in the first place when Dexie has the data"). `PHASE-42-STORAGE-ABSTRACTION-01` (open backlog) — retroactive cleanup of the v1.26.0 incident; ports the Learning Repository to the storage abstraction so the Dexie-mode path works for real instead of merely degrading gracefully.

## One-mode fix: a storage change is proven in BOTH modes or it is not proven (#2053)

Surfaced 2026-07-25 fixing the recurring set-status-reset bug (#2038 / #2050). A change to a persistence/storage concern that is implemented and tested in only ONE of the two storage backings (Dexie vs API), then declared done, ships broken in the other mode — and the passing test in the fixed mode gives false confidence.

### The precedent chain

#1300 / #1351 added the set lifecycle status (active / deferred / completed) but persisted it only on the Dexie content-cache row. `ApiStorage.setSetStatus` / `setSetsStatus` were pure no-ops — the interface comment even CODIFIED it: "API mode is a no-op (the field is browser-local)". The Dexie-side test (`set-status.test.ts`) was green, so the feature was declared done. In API (server / desktop) mode the status reverted to "active" on every reload, for multiple releases, "thought fixed" each time.

#2038 / #2050 fixed it: one mode-agnostic store (`lib/content/browse/set-status-store.ts` — localStorage + Dexie `userData` mirror, the `dismissed-sets` pattern) overlaid on the read path in both modes, with a test per mode.

### Rule

Every storage/persistence change MUST be proven in BOTH modes (Dexie + API) by at least one test each. A green test in one mode is NOT evidence for the other. When the write path or read overlay differs per mode, each branch needs its own assertion.

A per-mode no-op is a red flag, not a shortcut. A `() => Promise.resolve()` on one implementation of an `IStorageService` method means that mode silently drops the data. If a value is browser-local (no backend column), give it ONE mode-agnostic home (localStorage + Dexie `userData` mirror, registered in `MANAGED_USER_DATA_KEYS` and rides the `.alb` backup's `local_storage` snapshot) instead of a Dexie-only row write paired with an API no-op.

Backup portability is part of the same check. A new browser-local store must survive Export → wipe → Import in both modes. Prefix-namespaced (`adaptive-learner.`) keys ride the snapshot automatically unless excluded — pin it with a round-trip test so it can never silently drift into the exclusion list.

Pairs with "Dexie-mode is part of the contract: same-commit or not at all" (above) — that rule says a feature must WORK in both modes; this one says it must be TESTED in both modes. A feature that works in one mode and is tested only there is the exact gap that let #1300/#1351 look done. "Operational gaps masquerade as wired infrastructure" — a test that exercises one mode is operationally half-wired.

## Source-language default: set at import time, inherited downstream

Languages are captured at IMPORT time (v1.54.0): the import detail page sets `ImportedConversation.source_language` (the chat language the learner SPEAKS) + `target_language` (what they LEARN), and they flow through the pipeline (analysis prompt -> save-as-lesson -> share). The root cause of the recurring "source shows en" bug was that NOTHING set the languages at the source, so every downstream form guessed/patched the previous step's bad data.

### Rule (current, v1.54.0+)

At import: source defaults to the app language (`useI18n().lang`); target is auto-detected from the chat content (`detectLearningLanguage`) — both editable, then persisted on the import via `imports.update`.

Downstream forms INHERIT the language pair instead of guessing:
- `SaveOfflineLessonModal` reads the import's pair (props), guessing only when absent (old imports).
- `ShareWizard` SOURCE default = the lesson's `source_language` when it is a valid ISO code DIFFERENT from the target; otherwise the app language (fallback for missing / invalid / source==target collisions in old pre-pipeline lessons). TARGET keeps the saved value when valid + different, else content detection, else empty.

Every form keeps the field EDITABLE so an old bad value is correctable.

### History (do not repeat)

The bug recurred THREE times before the root-cause fix. e0ddef6 patched only `SaveOfflineLessonModal`; v1.53.2 (commit c624bb2) made the ShareWizard source "always the app language" as a stopgap. v1.54.0 replaced that stopgap with the import-time pipeline + the inherit-valid-only rule above (the app-language default now lives at the import step, where it is correct, instead of overriding good data downstream). Do NOT reintroduce a downstream "always app language" override OR a guess that ignores the inherited pair — fix it at import time and inherit.

Pairs with Validation must run against the FORM STATE (the edited values), not the original lesson object. The ShareWizard step-1 gate recomputes inline every render from the `editSource` / `editTarget` / `editLevel` state, so a dropdown change re-validates immediately.

## Cross-layer assumptions must be pinned against REAL data shapes (the ghost-content recurrence class)

Surfaced 2026-07-18 as the THIRD recurrence of the same class:

1. #1445/#1446 (v2.1.0): removing a content repo left ghost progress. Fixed with the availability oracle - but only for the REMOVED-REPO facet, and its tests used hand-built `{source, id}` fixtures.
2. #1816 (#1818): the oracle assumed 'listSets contains ONLY loadable sets'. True in Dexie mode, FALSE in API mode (the index lists every set of a registered repo; `cached_version: null` marks not-downloaded). Dead Continue-Learning cards + 404 noise. The module was GREEN against its own faulty spec because the fixtures encoded the assumption instead of the real `ContentSetEntry` shape.
3. #1819: deleting a set purges only the file cache - progress/SRS rows and the Workbox `adaptive-learner-lessons` SW cache survive (deleted lessons were literally served from the SW cache).

### Rules

- A module that consumes another layer's output must pin that layer's REAL shape in its tests. Hand-built minimal fixtures encode the author's assumption; when the assumption is wrong, module and tests are green and wrong together. Copy the actual entry shape (here: `ContentSetEntry` incl. `cached_version`) into the fixture, or build fixtures from the producing module's test factories.
- Every dual-storage assumption needs an explicit API-vs-Dexie check. 'listSets = loadable' held in one mode only. When a helper's contract mentions `listSets` / `getLesson` / any `IStorageService` surface, ask per mode: does the invariant hold in BOTH implementations? If unsure, write the one-line probe test per mode instead of assuming.
- Content lifecycle is a LIFECYCLE, not a point fix. Add / remove / delete / re-add each have residue surfaces: DB rows (progress, SRS, favorites), FS/IndexedDB cache, the SW runtime cache, localStorage. A fix that cleans one surface for one operation (repo removal) and not its siblings (set deletion) guarantees the next recurrence. When touching any lifecycle operation, enumerate ALL residue surfaces and either clean them or document per surface WHY they stay (hide-not-delete is fine - silent survival is not).
- **Recurrences reopen the class, not just the instance.** When a bug is a facet of an earlier fixed class, say so in the issue, link the chain, and extend the ORIGINAL tests so the whole class is pinned - a sibling facet fixed in isolation is the seed of recurrence #3.
