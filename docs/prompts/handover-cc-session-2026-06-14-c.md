# CC Session Handover — 2026-06-14 (c)

Self-contained handover for the next Claude Code (CC) session. You can continue
without follow-up questions. Branch model is **gitflow**: `develop` is the
active branch (the GitHub default), `main` holds releases only (tags `vX.Y.Z`).

---

## 1. State of `develop`

**v1.79.0 is SHIPPED** — tagged `v1.79.0` on `main`, GitHub Release published
2026-06-14, merged back to `develop`. Release notes:
`changelog/releases/v1.79.0.md`. No schema / API / data-model change. The
**release freeze is LIFTED** (tagged + published) — normal develop flow.

v1.79.0 contents (minor): **XP visibility** (#505/#510 — `NavXpBadge` header
badge + `+N XP` lesson-summary pill + generic `shared/XpBadge`, both storage
modes, i18n 8 langs); **bidirectional matching** B→A (#507/#509); **P1 matching
duplicate-pair scoring fix** (score by value not index, #480/#481); complexity
burn-down complete; radon hard gate Phase 2 (#494/#495); plugin-tests CI job
(#471); reusability policy + `shared/` primitives (#474/#477).

**Commits on `develop` since the v1.79.0 tag** (post-release, all green):

| Commit | What |
|---|---|
| `dd70ed59` | Merge release/1.79.0 back into develop |
| `aebddb65` | docs: post-release chat journal + handover for v1.79.0 |
| `70108061` | fix(content): skip the recommended-repos fetch until the catalogue is published |

**Key state facts:**
- `.complexity-baseline` and `.filesize-baseline` both contain **only the header
  comment — zero offender entries**. Every god-file is under the 1000-line ERROR
  threshold and every unit is under the cc>20 hard gate. New over-threshold code
  blocks CI immediately (`scripts/complexity_gate.py` /
  `make check-complexity-gate`; `scripts/check-file-sizes.sh`). The baselines may
  only SHRINK (they're already at zero).
- `frontend/src/shared/` holds the app-agnostic, props-driven primitives:
  `XpBadge`, `ListRow`, `ProgressBar`, `LessonStepNav`, `MenuToggleButton`.
- pytest-randomly is active in the backend dev deps (`make test` runs under a
  random order; suite is seed-robust).

**Verified test counts (at v1.79.0, 2026-06-14):**

| Suite | Count | How |
|---|---|---|
| Backend (pytest) | **1215** | `cd backend && poetry run pytest --collect-only -q` |
| Plugins (13, pytest) | **1018** | per-plugin `pytest --collect-only` from the backend env |
| Frontend (Vitest) | **4080** | `cd frontend && npx vitest run` (353 files) |
| **Total** | **6313** | — |

(The `70108061` recommended-repos cleanup added one Vitest case: 4 → 5 in that
file. Re-collect before quoting a number — see the numeric-claims rule.)
`tsc --noEmit` clean; ESLint clean; Dexie-mode Playwright gate 88 passed.

Rolling status snapshot (always current): `docs/journal/handover-status-latest.md`.
Session narrative: `docs/journal/chat-journal-session-2026-06-14-c.md`.

---

## 2. Open issues (by priority)

| # | Prio | Title | Owner / note |
|---|---|---|---|
| #506 | P2 (UX) | XP/Points nicht sichtbar genug | **CLOSED** — shipped in #510 (v1.79.0). Was the official tracking issue; #505 was an inadvertent duplicate I created while the GraphQL search was rate-limited. Listed here only so you don't re-open it. |
| #142 | enhancement | Author-provided lesson sets for published books (EXP-025) | **CCW lane** (see §3) |
| #97 | enhancement | Merge user-generated lessons into content tree with badge (EXP-026) | **CCW lane** (see §3) |
| #508 | P3 | Feature: User profile picture | **CCW lane** (see §3) |

There are **no open bug issues** and **no CC-owned open issues** right now. The
remaining open issues are all in the CCW collective-task lane.

---

## 3. CCW collective task is running — DO NOT collide

A parallel **CCW (Claude Code Web / cloud) lane** is working a collective task
covering **#97, #142, #508**:

- **#142 / EXP-025** — author-provided lesson sets (book-companion content) as a
  use case of the EXP-023 multi-content-repository architecture. Design doc:
  `docs/explorations/EXP-025-author-provided-lesson-sets.md` (decisions E1–E8;
  the AUTH-0x interface points are defined there).
- **#97 / EXP-026** — fold "My Lessons" (user-generated) into the matching
  published set node with a badge. Design doc:
  `docs/explorations/EXP-026-user-lessons-in-content-tree.md` (carries the
  AUTH-06 interface contract to EXP-025).
- **#508** — user profile picture (P3).

**Coordination rules (critical):**
- CCW runs in **isolated git worktrees** and merges its own PRs to `develop`.
  Before starting anything, `git fetch` + `git log origin/develop` to see what
  CCW has merged; rebase/pull before branching.
- **Do not start frontend work on #97/#142/#508** — that is CCW's lane. Picking
  up the same files causes parallel-session conflicts (see the one-concern/one-
  branch memory + `reusability.md`).
- Scope any CC session to **non-overlapping files** (e.g. backend, infra, docs)
  unless explicitly handed a piece.

---

## 4. Next CC tasks (by priority)

**Currently: none queued for CC.** The bug queue is empty and the open
enhancements are CCW's. Hold for one of:

1. **Backend parts of AUTH (when CCW reaches the interface points).** EXP-025
   defines AUTH-0x seams; the backend/storage side of author-provided sets +
   the content-tree merge will need CC once CCW has the frontend + design
   locked. Wait for CCW to signal the handoff (a PR or an updated EXP doc) —
   don't pre-build against an unfinalized interface (review-before-implement
   rule).
2. **A new P0/P1 bug** if one is filed — then GITHUB-ISSUE-PFLICHT + failing-
   test-first + fix, per the issues-as-queue flow.
3. **An explicit task from Aster.**

When AUTH lands and `recommended-repos.json` is published in the content repo,
**flip `CATALOGUE_PUBLISHED` to `true`** in
`frontend/src/lib/content/recommended-repos.ts` in the same change (see §5).

---

## 5. Known traps

- **Release freeze (Vibe Coding Policy / `vibe-coding.md`).** While a
  `release/X.Y.Z` branch is open, NO new PRs/merges to `develop` until the
  release is tagged + published — only the release workflow. Currently NOT in a
  freeze (v1.79.0 shipped).
- **No-amend on open PRs (`coding-standards.md` § Git).** Never `--amend` +
  force-push a PR that could merge concurrently — add a NEW commit. (Amending a
  *local, unpushed* release-prep commit is fine; that's what v1.79.0 did.)
- **CCW worktrees.** The cloud lane uses isolated worktrees. Always `git fetch`
  + check `origin/develop` before branching; rebase before pushing to avoid
  clobbering CCW merges.
- **GitHub token / GraphQL quota expiry.** The shared GraphQL quota (5000/hr)
  was exhausted twice this session. `gh issue create` / `gh issue close` /
  `gh release create` use **GraphQL**; when they 403 with "rate limit", fall
  back to the **REST** endpoints (`gh api repos/.../issues`,
  `gh api repos/.../releases`) — REST core quota is a separate bucket and was
  healthy. Check with `gh api rate_limit --jq .resources`.
- **`recommended-repos.json` flag.** `CATALOGUE_PUBLISHED = false` in
  `frontend/src/lib/content/recommended-repos.ts` deliberately SKIPS the fetch
  so the not-yet-published file doesn't log a browser 404. The file ships later
  with **AUTH-03 (EXP-025)** — flip the flag to `true` in that same change.
  (The browser logs failed network requests itself; a JS-side silent catch does
  NOT remove the console 404 — only not-fetching does.)
- **`prettier-frontend` pre-commit hook is misconfigured** — it reformats whole
  `frontend/src` files to a 2-space style nothing in the repo uses (CI skips it
  too). Commit frontend changes with `SKIP=prettier-frontend git commit`. After
  an aborted commit, the hook's reformat sits in the worktree — `git restore`
  before stashing/recommitting. (Full detail in `lessons-learned.md`.)
- **`plugin-lock-paired-with-pyproject` hook** flags version-only plugin
  pyproject bumps; release-prep commits skip it
  (`SKIP=plugin-lock-paired-with-pyproject`) — a version line needs no lockfile
  change.
- **Doc version references are NOT auto-synced.** `make sync-versions` updates
  the 19 version-bearing files but NOT the README/README-de badges or the
  ROADMAP/backlog headers — fix those by hand each release; the
  `verify-docs-discipline` gate catches the drift (it caught it for v1.79.0).
- **Search issues before filing.** This session created #505 as a duplicate of
  #506 because the GraphQL search came back empty under a rate limit. Per
  GITHUB-ISSUE-PFLICHT, retry the search (or use REST) before `gh issue create`.

---

## 6. References — rules + policies

Always-relevant rules in `.claude/rules/`:
- `architecture.md` — 4-layer architecture, plugin structure, dual storage
  (`IStorageService` / ApiStorage / DexieStorage), feature-state policy.
- `coding-standards.md` — naming, function design (≤40 lines, single concern),
  gitflow + Git rules (no-amend), tests, deps.
- `reusability.md` — `shared/` primitives must be props-driven + app-agnostic
  (full policy: `docs/policies/REUSABILITY-POLICY.md`).
- `design-tokens.md` — no hardcoded colors; token-backed Tailwind only
  (`docs/policies/DESIGN-TOKENS.md`).

On-demand:
- `vibe-coding.md` — priority order + **release freeze** (full:
  `docs/policies/VIBE-CODING-POLICY.md`).
- `ai-workflow.md` — GITHUB-ISSUE-PFLICHT, ISSUE-LIFECYCLE, issues-as-queue,
  docs protocol, numeric-claims verification, self-clarification.
- `quality-checks.md` — test strategy, BACKUP-AKZEPTANZTEST gate, pre-commit
  checklist.
- `code-hygiene.md` — error-handling architecture (services throw
  `AdaptiveLearnerError`, never `HTTPException`; routers catch nothing),
  docstrings-over-inline, API conventions.
- `release-workflow.md` — `make release-prepare` / `release-test` /
  `release-finish` / `release-publish`; the 4-tier version model;
  `make sync-versions`.
- `lessons-learned.md` — known pitfalls (the hook traps, Dexie-mode-is-the-
  contract, module-level cache leaks across tests, the source-language pipeline,
  etc.).

Project root: `CLAUDE.md` (current-state summary, plugin table, commands,
session-start checklist). Roadmap/backlog: `docs/ROADMAP.md` (P0–P5 tiers) +
`docs/backlog.md` (pointer view).
