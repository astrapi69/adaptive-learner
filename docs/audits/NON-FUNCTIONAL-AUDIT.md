# Non-functional UI audit

Tracking issue: [#350](https://github.com/astrapi69/adaptive-learner/issues/350).
Date: 2026-06-12. Scope: frontend only, both storage modes
(Dexie / GitHub-Pages with no API key, and API mode with a key).

## Goal

Every button, link, and menu item must do something meaningful. Dead
buttons, empty pages, unexplained "coming soon", crashes, and
unexplained `disabled` states are bugs. Features that genuinely need
new work are gated with `@astrapi69/feature-strategy` (disabled + a
visible reason), never hidden (policy #335).

## Method

Every route surface and its child components were swept for the
following classes:

- **P0** — a component calls `api.*` / `fetch()` directly instead of
  routing through `getStorage()` (the `IStorageService` abstraction).
  This crashes in Dexie / GitHub-Pages mode with HTTP 404.
- **(A)** dead `onClick` (no-op, `console.log`-only, `TODO`, or missing).
- **(B)** empty page / section with no icon + title + explanation.
- **(C)** "coming soon" / "not available" text without an explanation.
- **(E)** a link to a route that is not registered in `App.tsx`.
- **(F)** `disabled` with no adjacent reason / tooltip / feature-strategy
  gate.

Surfaces covered: Onboarding, Dashboard, LearningPath (Personal / Map /
Graph), Content Browser, CreateLesson, Lesson / Review / AdaptiveLesson /
ErrorReplay, Session, Curriculum, Progress, Pronunciation, Import /
ImportDetail, Anki, NotebookLM, Settings (all eight tabs), the
navigation shell, the help system, and the global feature-gating layer.

## Result

**No P0 or P1 functional defects were found.** The app is already in
good shape:

- **No P0 Dexie-crash risk.** No component calls `api.*` or `fetch()`
  directly; every storage access flows through `getStorage()`. API-mode
  only surfaces (e.g. the Settings sync section) are correctly gated on
  `resolveStorageMode() === "api"`.
- **No dead buttons / no-op handlers** across any surface.
- **No empty pages.** Empty states render an icon + title + explanation +
  a call-to-action (e.g. Content Browser "download a set to begin").
- **No `hidden` features.** The feature-strategy registry resolves every
  product feature to `active` or `disabled` (+ a localized reason); the
  fail-closed `hidden` state is reserved for unknown ids in tests, never
  for a shipped feature. Policy #335 holds.
- **No dead nav links.** Every navigation target resolves to a
  registered route.
- **Mandatory SPA 404 already implemented** (see below).

### Prior fixes verified still present

| Item | Issue | Status |
|------|-------|--------|
| Anki empty state (icon + title + body + import CTA + no-key API-key notice) | #276 | Present |
| NotebookLM AI buttons key-gated with a visible reason | #281 | Present |
| Desktop-only features disabled with a notice, not hidden | #335 | Present |
| Danger-Zone backup button uses the same `getStorage().backup.export()` + `saveBackupToDisk` helper as the Settings export | #332 | Present |

### Custom 404 for the SPA on GitHub Pages — already implemented

The requirement is satisfied by the **URL-preserving** fallback pattern
(cleaner than the `?/`-query redirect hack):

- `.github/workflows/deploy-gh-pages.yml` copies `frontend/dist/index.html`
  to `frontend/dist/404.html`, so GitHub Pages serves the SPA shell at the
  original deep URL.
- `frontend/src/App.tsx` registers a catch-all `<Route path="*" element={<NotFound />} />`.
- `frontend/src/pages/NotFound.tsx` renders a 404 with a working
  "back home" button and i18n strings.

No change was required here.

## Findings table

| # | Surface | Element | What happens | What should happen | Priority | Status |
|---|---------|---------|--------------|--------------------|----------|--------|
| 1 | Import (`/import`, `/import/:id`) | Nav "?" help button | Opened the generic `learning_project` glossary entry (fallback) instead of an import-relevant one | Open the conversation-analysis help, which is what the import flow is about | P1 | **FIXED** — `help-routes.ts` maps `/import` → `feature_conversation_analysis` (this PR) |
| 2 | Anki (`/anki`) | Nav "?" help button | Falls back to `learning_project` | Open an Anki/flashcard help entry | P2 | DEFERRED — no suitable glossary entry exists; needs a new `anki` concept authored in 8 languages |
| 3 | LearningPath (`/learning-path`) | Nav "?" help button | Falls back to `learning_project` | Open a learning-path help entry | P2 | DEFERRED — needs a new `learning_path` concept in 8 languages |
| 4 | Pronunciation (`/pronunciation`) | Nav "?" help button | Falls back to `learning_project` | Open a pronunciation help entry | P2 | DEFERRED — needs a new `pronunciation` concept in 8 languages |

Notes:

- Items 2-4 are **help-relevance refinements, not non-functional
  elements**: the "?" button works and opens a valid (if broad) glossary
  entry with related-concept links. Mapping them to a loosely-related
  existing key would degrade relevance more than the neutral fallback, so
  the correct fix is to author dedicated glossary entries — substantial
  8-language content work, hence P2.
- Item 1 is the one case with a clearly correct existing key
  (`feature_conversation_analysis` describes "analyze a chat import"),
  so it is fixed in this pass.

## Deferred (P2) follow-up

Author three glossary concepts — `anki`, `learning_path`,
`pronunciation` — in `frontend/src/data/help/concepts.*.json` (8
languages) and add the matching `ROUTE_HELP_KEYS` entries, so the
context-sensitive help button resolves a relevant entry on those three
routes instead of the `learning_project` fallback.
