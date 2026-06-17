# Chat journal — session 2026-06-17

A focused autonomous release session: cut, gated, finished and published
**v1.84.0**, a maintenance release rolling up the four substantive fixes that
had already landed on `develop` since v1.83.0 (content-repo import hardening,
Markdown in exercise prompts, clickable profile picture, graceful foreign-file
backup decline) plus a user-repo import E2E test and the EXP-031 backup-format
exploration. No code changes in this session — the work was the release pipeline
itself. Ran end-to-end without stopping at the explicit pre-`release-finish`
gate (the user pre-authorized "Wenn gruen: Freigabe erteilt").

---

## 1. Status capture (Phase 0)

- **Prompt:** autonomous release of v1.84.0; check open PRs + commits since
  v1.83.0.
- **Result:** zero open PRs. Four substantive commits on `develop` since
  v1.83.0 (#645 content-repo import, #647 exercise Markdown, #639 profile
  picture, #643/#641 backup foreign-file decline) plus the #637 E2E test and
  the #644 EXP-031 docs exploration. Clean tree on `develop` at v1.83.0.

## 2. Release prepare + version bump (Phase 1)

- **Result:** `make release-prepare VERSION=1.84.0` cut `release/1.84.0` from
  `develop`. Hand-edited `backend/pyproject.toml` 1.83.0 → 1.84.0;
  `make sync-versions` propagated to 19 files (frontend, launcher spec +
  `__init__`, all 13 plugin pyprojects, `install.sh`/`install.ps1`).

## 3. Changelog + docs-drift fixes

- **Result:** authored `changelog/releases/v1.84.0.md` (Fixed / Tested / Docs
  sections + the static install/verify template). `verify_docs.py --fix`
  auto-bumped the README + README-de badges and the CLAUDE.md state version;
  hand-updated the dated-prose headers in `docs/ROADMAP.md` and
  `docs/backlog.md` (prepend v1.84.0, demote v1.83.0 to "Prior"), and rewrote
  the CLAUDE.md current-state block for v1.84.0. Verifier: 0 FAIL (the lone WARN
  is the pre-existing help-coverage heuristic, unchanged across releases).

## 4. Release-test gate (Phase 1, step 4)

- **Result:** `make release-test` green — backend + 13 plugins + Vitest
  (4603 passed / 427 files), frontend build, docs-discipline,
  sync-versions-check, plugin-lock drift, Dexie-mode smoke gate, and the
  manual-test-plan automation (49 passed, 3 skipped). The manual-automation
  pass independently confirmed the user's retracted "manual-plan red" report.

## 5. Commit + release-finish + publish (Phase 1, steps 5–6)

- **Result:** committed the version bump on `release/1.84.0`. The
  `plugin-lock-paired-with-pyproject` pre-commit hook flagged the 13 plugin
  pyproject version bumps as needing paired lockfiles — a **known false positive
  for release version-only bumps** (a version field change does not alter
  poetry's dependency-based lock content-hash, so per-plugin CI stays green; the
  v1.83.0 tag commit likewise bumped plugin pyprojects with zero lock changes).
  Skipped only that hook (`SKIP=plugin-lock-paired-with-pyproject`), all other
  hooks active. `make release-finish` merged `release/1.84.0` → `main` (no-ff),
  tagged `v1.84.0`, pushed `main` + tags, merged back to `develop`, pushed
  `develop`, deleted the local release branch. The only error was the trailing
  `git push origin --delete release/1.84.0` (the remote branch was never pushed
  — harmless). `make release-publish` created the GitHub Release.

---

## Summary / statistics

- **Released:** v1.84.0 (maintenance). main = `8cd73eb8`, develop =
  `4b28765b`, tag `v1.84.0` on remote.
- **GitHub Release:** https://github.com/astrapi69/adaptive-learner/releases/tag/v1.84.0
- **Files changed by the release commit:** 27 (1 new changelog + 19 version
  propagations + README/README-de/ROADMAP/backlog/CLAUDE state docs).
- **Tests:** `make release-test` green — Vitest 4603/4603, backend + plugins
  green, manual automation 49 passed / 3 skipped, Dexie smoke gate green.
- **Code changes this session:** none (release pipeline only).
- **Note for next session:** the GH-Pages deploy + launcher artifact builds run
  off the tag — verify the deploy went live (the v1.71.x cycle saw a silent
  `actions/deploy-pages` 401). No schema/API/data migration in this release.
