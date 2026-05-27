# Handover — after v1.32.0, before v1.33.0

**Written**: 2026-05-27 (end of Phase 49 session).

This document is the cold-pickup brief for the next session.
Anyone (or any model) reading this should be able to start
work on v1.33.0 without needing the prior conversation
context.

---

## 1. What just shipped: v1.32.0

**Phase 49 — Learning Repo Storage Abstraction**. Closes
PHASE-42-STORAGE-ABSTRACTION-01, open since v1.26.1 — the
last P0 carry-over in the backlog. Dexie-mode users at
`https://astrapi69.github.io/adaptive-learner/` now get the
full Learning Repository feature client-side: render, ZIP
download, settings panel, dashboard widget. Git persistence
stays server-only (button disabled with friendly tooltip in
Dexie mode).

Full per-release detail:
``changelog/releases/v1.32.0.md``. Per-commit detail in the
commit messages — no separate chat-journal entry written
this session.

### Test counts (the new baseline)

```
Backend pytest:     1005 (+1 skipped)
Plugin tests:       839 (12 suites)
Vitest:             1874
Aggregate:          3718 (+1 skipped)
Dexie smoke gate:   18/18
```

### What landed (8 atomic + 1 release + 1 post-release)

- **49A** — pluginSettings namespace + bundling. Dexie
  schema v18 → v19. New `make sync-plugin-config` +
  `scripts/sync_plugin_config_to_frontend.py`. 5 plugin
  configs bundled. +15 Vitest.
- **49B** — RenderContext interface + Dexie loader. Pure
  types + helpers + `deriveTopics` + `buildRenderContext`
  + `loadDexieContext`. +20 Vitest.
- **49C** — README + STATS renderers + thresholds + labels
  + topic-folder-slug. Labels read bundled i18n. +46
  Vitest.
- **49D** — CHEATSHEET + ROADMAP + topic-folders +
  orchestrator. +21 Vitest.
- **49E** — `ILearningRepoNamespace` on `IStorageService`
  + ApiStorage delegate + DexieStorage impl with JSZip
  pack. +12 Vitest.
- **49F** — Cross-renderer parity proof. Shared JSON
  fixture + golden Markdown tree under
  `tests/fixtures/learning-repo-parity/`. **Parity passed
  on the first run** (Python and TypeScript byte-identical
  output). +1 pytest, +2 Vitest.
- **49G** — Remove Dexie-mode fallback messages.
  LearningRepoSettings + LearningRepo page + Dashboard
  widget all render in both modes. Git persist disabled
  with tooltip in Dexie. +3 Vitest.
- **release** — version bump + sync-versions + changelog
  + tag v1.32.0 + GitHub release.
- **post-release** (this commit) — CLAUDE.md + this
  handover.

---

## 2. What's open: candidates for v1.33.0

There is **no committed plan** for v1.33.0 yet. The
following are candidate workstreams the v1.32.0 session
leaves on the table. The next session's first conversation
should pick scope.

### 2.1 Dexie-mode lesson-XP gap (deferred from v1.31.0)

v1.31.0 closed the lesson-XP loop for API-mode users.
Dexie-mode users get the review loop but NOT the
lesson-XP / lesson-badge side effects (no backend, no
on_session_complete hook). Three options remain (same
shape as the v1.31.0 handover):

- **(a) Port the XP rule to TypeScript** and run it inside
  DexieStorage's lesson-completion path. Pros: honest
  port. Cons: dual-implementation drift risk; bands /
  multipliers need cross-language test pairing — same
  pattern as the 49F renderer parity test.
- **(b) Service-worker shim** of on_session_complete that
  runs the gamification rules in Dexie mode. Pros: closer
  to a single source of truth. Cons: heavier infra.
- **(c) Accept the gap, document, defer**. Dexie users
  are GH-Pages visitors; they get the review loop and
  chat-session XP via the API path when they switch modes.

Recommendation: **(a)** now that 49F has proven the
shared-fixture + golden parity pattern. The XP formula is
small (~100 LOC); a parity test pinned to
`tests/fixtures/lesson-xp-parity/` would mirror the v1.32.0
shape exactly.

### 2.2 EXP-013 Adaptive Lektionen Stufe 3 (carry-over)

Same as the v1.31.0 handover listed. Stufe-3 work beyond
the v1.30.0 SRS foundation:
- Per-element grouping in the review session ("3 you
  struggle with from lesson 2; 2 from lesson 7") instead
  of flat priority order.
- Per-element progress visualisation on the Dashboard.
- AI-assisted hints when the same element fails 5+ times.

### 2.3 Backlog cleanup

Several items in the prior session's backlog (P-131..P-140
from BACKLOG.md, EXP-013 Phase 2) were effectively closed
by the v1.30.0–v1.32.0 work. The next session could batch-
close them with a clear "marked done by vX.Y" annotation.

### 2.4 i18n catalog cleanup for `repo.*` keys

Discovered during 49C: the existing `repo.*` block in
`backend/config/i18n/{lang}.yaml` has keys like
`action_persist` (flat) that the frontend `t()` call
`t("repo.action.persist", ...)` can never reach (dotted
path doesn't navigate flat keys). The page falls back to
the second-arg English text in EVERY language — i.e. the
existing i18n is broken for repo button labels. Two ways
to fix:

- (a) Restructure the YAML to nest `repo.action.persist`
  as actual nested objects.
- (b) Move the renderer-driven labels (which DO work via
  `labels_for`'s flat-key reader) to a separate top-level
  key like `repo_labels.*` and let `repo.*` carry only the
  frontend-facing dotted-path labels.

Recommendation: **(a)** — minor YAML restructure, no code
change needed. Affects all 8 catalogs but the
sync_i18n_to_frontend.py drift pin will catch any miss.

### 2.5 BISAC database for KDP plugin (P5, long-standing)

Still open from prior handovers. Not a v1.33.0 priority
unless it organically surfaces.

### 2.6 Settings UI consolidation for plugin configs

The `LearningRepoSettingsSection` is the only component
using the new `pluginSettings` namespace. Other plugins
have their own ad-hoc settings UIs or no UI at all. A
generic plugin-settings UI driven by the bundled
plugin-config JSON (with type inference from the values:
boolean → checkbox, string → text, integer → number) would
turn the new namespace into a real platform feature. The
3 plugins with config that would benefit:
gamification (badge thresholds, XP rules), content-loader
(cache size, GitHub token slot), session (model overrides,
streaming opt-in).

---

## 3. Architectural decisions still in force

Phase 49's 6 decisions (A pluginSettings bundling + B
module layout + C pure-functional labels + D parity proof
+ E Dexie v19 + F server-only persist) are now production-
truth. Future work should respect them; revisiting any is
a deliberate architectural change.

Carry-over from v1.31.0 handover (one closed, two open):

| ID | What | Status |
|----|------|--------|
| **D-storage-abstraction** | Learning Repository plugin via IStorageService | **CLOSED** by v1.32.0 / Phase 49 |
| **D-dexie-gamification** | Should Dexie-mode lessons award XP locally? | Still open. See § 2.1 — promoted from "defer" to "tractable via parity-test pattern". |
| **D-plugin-settings-ui** | Generic plugin-settings UI? | New. See § 2.6. |

---

## 4. Gotchas + recurring false positives

Most of the IDE static-analysis false positives from prior
handovers still apply. Pattern unchanged.

### 4.1 IDE static-analysis false positives (ignorable)

| Diagnostic | Reality |
|---|---|
| `pytest`: Cannot find module | Backend venv issue. Tests run fine via `make test*`. |
| `sqlalchemy` / `sqlalchemy.orm`: Cannot find module | Same. |
| `alembic` / `alembic.config`: Cannot find module | Same. |
| `app.models` / `app.database` (in plugin code) | Plugin runs inside the backend venv at runtime where backend's `app.*` is on sys.path. |
| Parameter `client` unused (in pytest) | TestClient fixture is load-bearing for the lifespan. |

### 4.2 Real footguns surfaced this session

1. **Existing i18n `repo.*` keys are unreachable from
   frontend t() calls** (see § 2.4). Surfaced during 49C
   when I noticed the goldens differed from the dataclass
   defaults — the Python labels factory reads flat
   `repo.action_persist` style keys; the frontend `t()`
   walks dotted paths and never resolves them. Result:
   button labels have ALWAYS shown the English fallback in
   every language. Not a v1.32.0 regression; pre-existing
   bug surfaced by the port work.
2. **JSZip dynamic import** is the right pattern even
   though the static import works. Reuse from
   `lib/anki/apkg-builder.ts` keeps the ~190 kB chunk off
   the cold-load path. Apply the same pattern to any
   future heavy lib (PDF generation, OCR, etc.).
3. **Vitest parity-test path resolution**: Node's `fs` +
   `__dirname` walk up to repo root for cross-language
   fixtures. Works in Vitest's node environment without
   any extra config. Pattern to mirror for any future
   shared-fixture parity test.
4. **`useCallback` deps after gate removal**: when 49G
   dropped the `storageMode !== "api"` gate inside
   `loadRepo`, the `storageMode` dep on the `useCallback`
   had to drop too — otherwise `loadRepo`'s identity
   changes when storageMode changes, useless re-render.
5. **Pre-commit's ruff scope** is `^backend/app/` only.
   Plugin code changes don't trigger ruff at commit time.
   Run `make test` to catch formatting issues in plugin
   code (mypy + plugin pytest exercise them).

### 4.3 Discipline reinforced

- **Atomic-green-commit cadence at scale**: 8 source
  commits + 1 release commit + 1 post-release commit
  this session. Each individually green. Zero CI red
  events. Pre-flight chain (make test + mypy +
  pre-commit + tsc + make test-dexie-smoke for any
  Dexie-affecting commit) stayed clean throughout.
- **Parity-test-first for cross-language ports**: 49F's
  golden-file approach was the right shape. Generating
  the goldens via the older renderer + asserting the
  new renderer matches catches drift at commit time.
  The TS renderer passed on the FIRST parity run — that
  validates the port methodology, not just the result.

---

## 5. State at end of session

### Git

```
HEAD:    <post-release commit> docs: post-release v1.32.0
Tag:     v1.32.0 (annotated, pushed to origin)
Branch:  main, in sync with origin/main
Clean working tree.
```

### Recent commits (latest 12)

```
<this commit>    docs: post-release v1.32.0 documentation update
4d5594a chore(release): bump version to v1.32.0
b912659 feat(learning-repo): full Dexie-mode support, remove fallback messages (49G)
74b8d65 test(learning-repo): cross-renderer parity proof — Python == TypeScript (49F)
3e7b1e3 feat(storage): learningRepo namespace — Dexie renders client-side (49E)
fef1550 feat(learning-repo): CHEATSHEET + ROADMAP + topic folders + orchestrator (49D)
9f8119e feat(learning-repo): TypeScript README + STATS renderers + thresholds + labels (49C)
c3e01dc feat(learning-repo): RenderContext TypeScript interface + Dexie loader (49B)
bc479c8 feat(storage): pluginSettings namespace + plugin-config bundling (49A)
cd4ab9c docs: post-release v1.31.0 documentation update
4d4d2dc docs: add v1.31.0 handover journal entry (43dd06b -> 4d4d2dc rebase)
e475c68 chore(release): bump version to v1.31.0
```

### CI status

CI was green throughout this session. The v1.32.0
launcher builds + release-gate kicked off on tag push;
confirm with `gh run list --limit 5` at session start.

### Files of interest for v1.33.0

#### For the Dexie-mode lesson-XP gap (if pursued — § 2.1)

- ``plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/xp_service.py`` — the
  authoritative formula to port (≈100 LOC for the
  lesson-XP path specifically).
- ``frontend/src/lib/learning-repo/`` — model for the
  new `frontend/src/lib/gamification/` module.
- ``tests/fixtures/learning-repo-parity/`` — template
  for `tests/fixtures/lesson-xp-parity/`.

#### For i18n catalog cleanup (§ 2.4)

- ``backend/config/i18n/{lang}.yaml`` `repo.*` blocks
  — restructure flat keys into nested objects under
  `repo.action.*`, `repo.toast.*`, etc.
- ``frontend/src/data/i18n/*.json`` — regenerated by
  `make sync-i18n` after YAML change.
- The drift pin `i18n-sync.test.ts` catches any miss.

#### For generic plugin-settings UI (§ 2.6)

- ``frontend/src/components/LearningRepoSettingsSection.tsx``
  — the prototype for the generic form.
- ``frontend/src/data/plugin-config/*.json`` —
  type-inferrable defaults (5 plugins shipped).

---

## 6. Pre-flight discipline (the gate chain)

Unchanged from v1.31.0/v1.32.0. Every commit:

```bash
make test                            # backend + plugins + Vitest
cd backend && poetry run mypy app/   # mandatory
cd backend && poetry run pre-commit run --all-files   # mandatory
# For release commits / Dexie-affecting commits, additionally:
make test-dexie-smoke                # Dexie release gate
cd frontend && npm run build         # production build
cd frontend && npx tsc --noEmit      # TypeScript check
```

---

## 7. Cold-pickup checklist for the next session

Run these in order before any code:

```bash
# 1. Confirm state
git log --oneline -5
git status --short

# 2. Baseline test gates (should all be green)
make test                  # expect 1005 backend + 839 plugins + 1874 Vitest
make test-dexie-smoke      # expect 18/18 green
cd backend && poetry run mypy app/                          # Success
cd backend && poetry run pre-commit run --all-files         # Passed

# 3. Confirm CI is green on the v1.32.0 push
gh run list --limit 5
```

If any baseline doesn't match, **STOP and investigate**
before proceeding with v1.33.0.

Then read, in order:
1. `CLAUDE.md`
2. `.claude/rules/` (all files — especially
   lessons-learned.md and ai-workflow.md)
3. This file (handover-to-v1.33.0.md)
4. `changelog/releases/v1.32.0.md` (the per-release detail)

Then propose the v1.33.0 commit plan with whatever
candidate from § 2 the user picks, wait for green-light,
execute.

---

End of handover.
