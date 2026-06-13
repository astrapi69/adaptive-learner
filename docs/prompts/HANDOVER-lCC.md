# Handover — lCC (backend) session

You are **lCC**, the **backend** worker on `adaptive-learner`. **CCW** owns
**frontend** (god-file splits under #354: Lesson.tsx, Content.tsx,
dexie-storage.ts, types.ts, hooks). Stay in backend / shared-infra lanes to
avoid colliding with CCW's open work.

Repo: `/home/astrapi69/dev/git/hub/astrapi69/adaptive-learner`. Gitflow:
`develop` is the active branch; PRs target `develop`; never commit to `main`.

## Hard-won rules (do NOT relearn the hard way)
- **Stacked PRs: merge-commit, NOT squash.** The maintainer squash-merges;
  squash rewrites SHAs and breaks any stacked branch (happened twice — the
  #341 chain and #361). If a PR must build on an unmerged one, branch from it
  and **rebase `--onto develop <parent-tip> <branch>`** to recover when the
  parent is squash-merged; then `--force-with-lease`.
- **GITHUB-ISSUE-PFLICHT:** every bug/fix needs a GitHub issue first (search,
  reopen if recurred, else `gh issue create`); commit cites it; `Closes #NN`
  on the final PR. Verify the premise before filing — don't file a false bug.
- **i18n = 8 langs** (de/en/es/fr/el/pt/tr/ja). Edit `backend/config/i18n/*.yaml`
  then `make sync-i18n` to regenerate `frontend/src/data/i18n/*.json`.
- **Plugins are NOT ruff/mypy-gated** (pre-commit `files: ^backend/`); backend
  IS. Don't fix pre-existing plugin lint in an unrelated PR (one-concern).
- **BACKUP-AKZEPTANZTEST:** any backup-touching PR needs a real `make dev`
  Export→Import round-trip on real data (Aster runs it) before merge — unit
  tests are necessary but not sufficient.
- Run `make test-plugin-session` etc. via the backend venv (PLUGIN_PYTHON);
  the plugins' own venvs have no pytest. Run vitest from `frontend/`.
- Per extraction PR: `ruff check --select F` (undefined/unused) + `mypy` +
  the affected test suite. Behaviour-preserving moves only.

## Done this session (all merged unless noted)
- Block 7 #338 (plugin silent-except logging), Block 6 #340 (build_ai_caller
  consolidation → `app/services/ai_caller.py`).
- Block 3 #341: decomposed `session/routes.py` `append_message` god-handler →
  `session_runner.py` (#342–#344 + recovery #352). routes.py 2031→1156.
- Non-functional UI audit #350/#351 (`docs/NON-FUNCTIONAL-AUDIT.md`; app was
  already clean; SPA-404 already implemented).
- **Backend god-file splits (#353), all merged:** content-loader
  `service.py`→`sources.py` (#355); `main.py`→`config.py` (#359);
  `main.py`→`startup.py` (#361, main.py now 377); `sync_service.py`→
  `sync_push.py` (#363); `backup_service.py`→`backup_export.py` +
  `backup_restore.py` + facade (#367, round-trip confirmed by Aster).

## OPEN PRs (both MERGEABLE, base develop) — check CI, then they can merge
- **#369** — fix(dashboard): friendly label for legacy `analysis-<uuid>` set
  titles (Closes #368). Frontend+i18n (outside CCW's files). `setTitleOf` in
  `ContinueLearning.tsx` now returns localized `content.continue_learning.imported_analysis`
  for the legacy-id shape; regression test added.
- **#370** — chore(ci): warn-only file-size watcher
  (`scripts/check_file_sizes.py` + `.github/workflows/file-size-check.yml` +
  `make check-file-sizes`). Warns >500 lines (whitelist: models/__init__.py,
  schemas/__init__.py, questions.py, prompts.py); never fails. Currently
  flags 40 files (mostly CCW's frontend track). Tiny nit: `check-file-sizes`
  not added to Makefile `.PHONY` (harmless).

## Candidate next work (confirm with Aster first)
- Backend files still >500 the watcher flags and that are SPLIT-worthy (not
  whitelisted): `content-loader/service.py` (603, could shed dedup/version
  helpers), `content-loader/models.py` (600), `gamification/xp_service.py`
  (573), `gamification/badge_service.py` (555), `backup_restore.py` (688, the
  cohesive restore pipeline — leave unless asked). Treat as warn-only; only
  split on request.
- Frontend >500 files belong to **CCW** (#354) — do not touch.
- If Aster has no new direction: nothing is blocking; wait, or ask.

## Quick state check to run first
```
git checkout develop && git pull --ff-only
gh pr list --state open --json number,title,baseRefName,mergeable
git log --oneline -8
```
