# CC Session Handover — 2026-06-14

Self-contained handover for the next Claude Code (CC) session. You can continue
without follow-up questions. Branch model is gitflow: **`develop` is the active
branch**, `main` holds releases only.

---

## 1. State of `develop` (all commits since v1.77.0)

v1.77.0 (architecture release) is tagged on `main`. `develop` is ahead by the
following work, all merged via squash PRs (commit → PR in parens):

| Commit | What |
|---|---|
| `294e08cf` | ci: complexity Phase 2 — hard ratchet gate (#407) (#408) |
| `4abfd613` | docs: Release-Freeze governance rule (#409) (#410) |
| `6a00b926` | refactor(session): split the 1156-line `routes.py` god-file (#411) (#412) |
| `8271bebf` | fix(ci): strip trailing blank line from `.filesize-baseline` (#413) (#414) |
| `1c7760c4` | refactor(session): decompose `build_analysis_context` cc33→3 (#415) (#416) |
| `77e909c9` | refactor(lesson): decompose `LessonPage` cc67→12 (#417) (#418) |
| `d851aa9d` | refactor(import): decompose `ImportDetail` cc58→18 (#419) (#420) |
| `88c6a470` | refactor(backup-diff): `previewRow` switch → strategy map, cc54→3 (#421) (#422) |
| `a5b79838` | refactor(backup): decompose `buildContentSetRow` cc49→13 (#423) (#424) |
| `a939da9c` | fix(e2e): deterministic setup for the lesson-tts flake (#165) (#425) |
| `6470acad` | refactor(settings): extract `ApiKeyRow` from `AiSettingsPanel` cc45→9 (#427) (#428) |
| `552691f9` | test: reactivate pytest-randomly to catch test-ordering leaks (#426) (#429) |

Plus `a6407ef4` (post-v1.77.0 chat journal).

**Net effect on develop:**
- `.filesize-baseline` is now **empty** — every god-file is under the 1000-line
  ERROR threshold; the cohesion watcher (`scripts/check-file-sizes.sh`) blocks new
  ones. (#372 + #353 closed as done.)
- `.complexity-baseline` is the active ratchet (file-level). It started at 34
  offender files; the CCW burn-down (see §3) has it at **28** and shrinking. The
  complexity gate (`scripts/complexity_gate.py`, `make check-complexity-gate`) is
  a hard CI gate — a NEW over-threshold file or a regression above a file's frozen
  worst-cc FAILS. Shrink only via `make check-complexity-gate-update`.
- pytest-randomly is back in the backend dev deps, so `make test` runs backend +
  plugins under a random order. The suite is robust (verified across seeds).

`develop` is green and release-ready whenever v1.78.0 is to be cut.

---

## 2. Open issues (priority + next step)

| # | Title | Prio | Next step |
|---|---|---|---|
| **#430** | Extend pytest-randomly to the per-plugin CI locks | **Low (P3)** | Add `pytest-randomly` to each `plugins/*/pyproject.toml` dev group, `make lock-all-plugins`, run each plugin suite under a few seeds; harden if any breaks (none expected). Next cleanup cycle. |
| **#142** | Author-provided lesson sets for published books | **Feature (P2/P4)** | Product feature; needs a design pass before code. Not started. |
| **#97** | Merge user-generated lessons into content tree with badge | **Feature (P2/P4)** | Product feature; not started. |

No P0/P1 bugs open. No open PRs.

**Closed this session:** #372 (baseline god-files <1000), #353 (backend god-file
split) — both faktisch done; #164/#165 (flaky tests) fixed; #407/#409/#411/#413/#426
shipped.

---

## 3. In-flight parallel work (CCW — complexity burn-down)

A parallel session (CCW lane: frontend + cross-cutting refactors) is **burning
down the `.complexity-baseline`** — decomposing the grandfathered offenders one at
a time, each PR running `make check-complexity-gate-update` to shrink the baseline.
Done so far: `build_analysis_context`, `LessonPage`, `ImportDetail`, `previewRow`,
`buildContentSetRow`, `ApiKeyRow` (34 → 28 files).

**Coordination rules (critical — the shared worktree is the same `.git`):**
- Scope your session to **non-overlapping files**. CCW is in `frontend/src/**`
  components/lib + a few backend cc-offenders. If you must touch the same area,
  check `git log`/open PRs first.
- **Do NOT `--amend` + force-push** a PR that could be merged concurrently (see §5).
- Both sessions share the git index; a concurrent `git commit` can lose the
  index-lock race. If a commit "didn't land," re-check `git status` before retrying.

---

## 4. Next tasks by the priority hierarchy

Per `.claude/rules/vibe-coding.md` (and `docs/VIBE-CODING-POLICY.md` §Priority
Hierarchy): **merge open PRs → P0/P1 bugs → infrastructure → UI fixes →
cleanup/refactoring → features → release.**

Concretely, in order:
1. **Open PRs:** none right now. (If CCW opens burn-down PRs, review/merge first.)
2. **P0/P1 bugs:** none open.
3. **Infrastructure / cleanup:** continue the `.complexity-baseline` burn-down
   (coordinate with CCW so you don't both grab the same file). #430 (per-plugin
   pytest-randomly) is the queued low-prio infra item.
4. **Features:** #142 / #97 — only after a design doc; do NOT start blind.
5. **Release:** when the team decides, cut **v1.78.0** via the gitflow flow
   (`make release-prepare VERSION=1.78.0` → bump `backend/pyproject.toml` →
   `make sync-versions` → changelog `changelog/releases/v1.78.0.md` →
   `make release-test` → `make release-finish` → `make release-publish` → journal).
   See `.claude/rules/release-workflow.md`.

When idle / told "weiter": work the GitHub issue tracker as the queue
(`gh issue list --state open`), priority order above.

---

## 5. Known traps (do not relearn the hard way)

- **No `--amend` + force-push on an open PR** (now a rule in
  `.claude/rules/coding-standards.md` §Git). A force-push can desync GitHub's PR
  head; the PR may then merge the PRE-amend commit and silently drop your change.
  This actually happened (#412 merged without its eof fix → #414). **Always add a
  NEW commit;** the squash-merge still yields one clean commit.
- **Release freeze** (`.claude/rules/vibe-coding.md` §Release-Sperre): while a
  `release/X.Y.Z` branch exists, **no new PRs/merges to `develop`** until the
  release is tagged AND published — only the release workflow. Exception: a P0
  hotfix that blocks the release.
- **Shared-worktree / parallel-session isolation:** both CC sessions operate on the
  same checkout and `.git`. Index-lock races and PR-head desyncs are real (see §3).
  Scope to non-overlapping files; one concern per branch/PR.
- **R-M-W discipline (Dexie storage):** the #390 three-phase remediation is done
  (atomic `table.modify()` / `db.transaction`, unique indexes + dedup migration,
  full-replace transaction wrapping). Any NEW DexieStorage mutator must keep
  read-modify-write atomic (`db.transaction("rw", …)` or `table.modify()`), and
  every feature must work in BOTH storage modes (API + Dexie) or degrade gracefully
  — same-commit, not "follow-up" (see lessons-learned "Dexie-mode is part of the
  contract").
- **Test-isolation / shared caches:** module-level + filesystem caches survive test
  boundaries (`_isolate_content_cache`, `_isolate_secrets_files` fixtures). With
  pytest-randomly back on, a new shared-state leak fails loudly — fix it with
  per-test isolation, don't disable randomness.
- **Don't amend the cohesion/complexity baselines by hand** — use
  `make check-complexity-gate-update` (complexity) / edit `.filesize-baseline` only
  to add a justified entry (it may only shrink). An empty baseline is the success
  state; `check-file-sizes.sh` now handles it.
- **`prettier-frontend` pre-commit hook is misconfigured** (reformats whole files,
  CI skips it). Commit `frontend/src` changes with `SKIP=prettier-frontend` and rely
  on ESLint. See lessons-learned.
- **Run vitest from `frontend/`**, not the repo root (else `document is not defined`
  across all DOM tests). Use `make test-frontend`.

---

## 6. Authoritative references (read these, don't reinvent)

- `.claude/rules/` — loaded per task. Key files:
  - `architecture.md` — 4-layer architecture, dual storage, plugin structure.
  - `coding-standards.md` — naming, function design, **Git rules incl. No-Amend**.
  - `vibe-coding.md` — short rules, **priority hierarchy**, **Release-Sperre**.
  - `lessons-learned.md` — every known pitfall (the long one; skim by topic).
  - `quality-checks.md` — test strategy, BACKUP-AKZEPTANZTEST gate.
  - `release-workflow.md` — the full release procedure.
  - `ai-workflow.md` — GITHUB-ISSUE-PFLICHT, issues-as-queue, docs protocol.
- `docs/VIBE-CODING-POLICY.md` — the human-facing policy (prompt precision, layer
  discipline, test verification, security/deps, refactoring, git hygiene, priority
  hierarchy, **Release Freeze**, agent roles).
- `CLAUDE.md` — project overview, current state (v1.77.0), data model, plugins,
  commands. Always loaded.

**Standing rules:** GitHub issue BEFORE every bugfix (search/reopen first); `Closes
#NN` in the commit/PR; one concern per PR; branch from `develop`; `make test` green
before every commit; German production content uses real umlauts, code/identifiers
stay ASCII.
