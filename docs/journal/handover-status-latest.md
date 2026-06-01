# Adaptive Learner — Latest Status Handover

**Generated:** 2026-06-01
**Purpose:** single-glance project status for resuming work. Overwritten
each session; dated journals keep point-in-time detail.

> ⚠️ **READ §10 FIRST.** This working tree is being shared by two
> agents concurrently (CC + CCW) — that caused two branch mix-ups this
> session. Know the landmines before touching git.

---

## 1. HEAD + version

| | |
|---|---|
| **origin/main** | `ecace25` (`fix(crypto): always create secret.key …`) |
| **App version** | `v1.48.0` (canonical: `backend/pyproject.toml`) |
| **Last tag / release** | `v1.48.0` (tagged @ `f5b72f0`, GitHub release live) |
| **Unreleased on main** | 3 feature commits since the v1.48.0 tag → candidates for **v1.48.1** |

Unreleased-since-v1.48.0 (all on origin/main):
- `ecace25` fix(crypto): always create secret.key (the persistent key source)
- `b63ead5` docs(exploration): EXP-022 visual learning path
- `7e2b2a3` fix(settings): stable Fernet key + encrypted secrets.yaml

Repos:
- App: `astrapi69/adaptive-learner` @ `ecace25`
- Content: `astrapi69/adaptive-learner-content` @ `6b4fc63`

---

## 2. Test counts (verified this session)

| Suite | Count |
|---|---|
| Backend (pytest) | **1083** passed (+1 skipped) |
| Plugins (13 suites) | **997** passed |
| Frontend Vitest | **2816** passed |
| Dexie-mode E2E gate (`make test-dexie-smoke`) | **49** passed (~3.1 min) |

`make test` = backend + plugins + Vitest. E2E smoke (`e2e/smoke/`) runs
separately. All green as of `ecace25`.

---

## 3. THE secret.key BUG — FIXED (pending Aster's acceptance)

**Symptom:** API keys "lost on restart". **Root cause:** the Fernet
encryption key came only from `ADAPTIVE_LEARNER_SECRET_KEY`; if that
value changed between boots, every stored ciphertext became
undecryptable.

**Two-commit fix (both on main):**
- `7e2b2a3` — stable key + encrypted `secrets.yaml`: API keys stored
  Fernet-encrypted under `ai.<provider>.api_key_encrypted`; new
  `secrets_service.py`; `set_api_key`→yaml (not DB); startup migration
  DB→yaml; path unified on `get_config_dir` (deleted the XDG duplicate).
- `ecace25` — **the real fix**: the first version kept the env var as
  *highest* priority, so on a box where `make dev` sets it (via
  `.adaptive-learner/dev-secret.env`) `secret.key` was **never written**
  and persistence still hinged on the env value. Now the **file is the
  source of truth**: `get_fernet()` creates `secret.key` on first use —
  seeded from the env value if set (so existing ciphertext stays
  decryptable), else generated — and reads it thereafter independent of
  the env var.

**Tests:** 19 in `test_api_key_secrets_persistence.py` (incl.
`survives_restart`, `survives_10_restarts`, `created_even_when_env_set`,
`key_survives_env_var_disappearing`). Real `~/.config` verified
untouched by the suite (tests use `ADAPTIVE_LEARNER_CONFIG_DIR`→tmp).

**REMAINS:** Aster's manual acceptance (§7). v1.48.1 is **blocked** on
it. Do NOT tag until Aster says "secret.key exists + key survives
restart".

---

## 4. Open / unreleased work

| Item | Status |
|---|---|
| **CCW PR #1** (Smart Next-Step Suggestions) | **MERGED** into main (`0bf0689`), shipped in v1.48.0. Branch auto-deleted. |
| **Phase 64** (Community Sharing UX, 64A–64F) | **COMPLETE**, shipped in v1.48.0 (placement engine, duplicate/variation/supplement, share wizard, author credit, contribution history, gap suggestions, 8-lang i18n). |
| **secret.key fix** | Fixed on main (§3); **blocks v1.48.1**. |
| **CCW `feature/analysis-loading-indicator`** | **ACTIVE** — on origin + currently checked out in this tree, with 4 **uncommitted** WIP files (see §5/§10). CCW owns it. |
| **CCW `feature/help-translations`** | **NOT on origin** — likely CCW-local WIP; status unknown from here. |
| **v1.48.1 release** | **BLOCKED** on Aster's secret.key acceptance, then: bump 1.48.0→1.48.1, sync-versions, changelog, CLAUDE/ROADMAP, `make release-test`, `release-tag v1.48.1`, `gh release create`. |

---

## 5. Branches (local + remote)

**Remote (`origin`):**
- `main` — `ecace25` (current)
- `feature/analysis-loading-indicator` — CCW active
- `claude/probe-push-permission` — stale (old probe branch; safe to delete)
- `claude/setup-backend-foundation-6E1lr` — stale (old setup branch; safe to delete)

**Local:**
- `main` — ref may lag origin (stale; refspec pushes were used). Update with `git fetch && git branch -f main origin/main` when safe.
- `feature/analysis-loading-indicator` — **currently checked out** (CCW's branch). Carries `ecace25`/`b63ead5` as common-with-main history (harmless; dedupes on merge) + CCW's 4 uncommitted files.

---

## 6. Content repo (`astrapi69/adaptive-learner-content`)

- HEAD `6b4fc63` — `feat(content): fix progressive direction in es-a1 sets (EXP-018)` (CCW).
- `843a963` — **FR A1 expanded to 15 lessons in both sources** (de + en), full parity with ES A1 (this session). Validator green on all 4 sets.
- Pilot sets: `en/fr-a1`, `de/fr-a1`, `en/es-a1`, `de/es-a1` — all **15 lessons**.
- CI runs `scripts/validate_content.py` on PRs.

---

## 7. Manual acceptance for the secret.key fix (DO THIS FIRST next session)

On the real machine (after pulling `ecace25`):
1. Run the app (`make dev`), save an API key in **Settings > AI**.
2. `ls -la ~/.config/adaptive_learner/secret.key` → **must exist**, mode `600`.
3. `cat ~/.config/adaptive_learner/secrets.yaml` → shows
   `ai.<provider>.api_key_encrypted` (Fernet ciphertext, not plaintext).
4. Settings shows **"Key from: secrets.yaml"**.
5. `make dev-down && make dev` → key still present + works.
6. Stress test: `unset ADAPTIVE_LEARNER_SECRET_KEY` before a start → key
   STILL works (proves file-independence).

If all pass → **cut v1.48.1** (§4). If `secret.key` is still missing,
check that the running process actually used the patched `crypto.py`
and that `~/.config/adaptive_learner/` is writable.

---

## 8. Next steps (priority order)

1. **Aster: secret.key manual acceptance** (§7) — unblocks v1.48.1.
2. **Cut v1.48.1** once accepted (secrets fix + EXP-022 are the payload).
3. **Coordinate with CCW** on `feature/analysis-loading-indicator`
   (uncommitted WIP in the shared tree — see §10).
4. Optional housekeeping: delete stale remote branches
   `claude/probe-push-permission`, `claude/setup-backend-foundation-6E1lr`.
5. Resync local `main` ref to origin when the tree is quiet.

---

## 9. EXP documents

`docs/explorations/` + `EXP-INDEX.md` (21 EXPs):
- **EXP-018** Exercise Direction (Receptive vs Productive) — shipped (Phase 62 / v1.46.0).
- **EXP-019** — not present as a file (historical gap in the index).
- **EXP-020** Lesson Flow Control (Prüfen/Weiter) — shipped (Phase 63 / v1.47.0).
- **EXP-021** Lesson-Creator (standalone) — planned (future phase, e.g. 65).
- **EXP-022** Visual learning path (xyflow/React Flow) — planned (CCW doc, on main).

---

## 10. Landmines the next session MUST know

1. **SHARED WORKING TREE — two agents, one checkout (biggest).** CC and
   CCW operate on the SAME working dir + git repo. This session, the
   tree was silently switched to CCW branches (`docs/exp-022-…`,
   `feature/analysis-loading-indicator`) and CC's commits landed on the
   wrong branch **twice**. CCW's uncommitted files appear/disappear in
   `git status` unexpectedly. **Before committing: `git branch
   --show-current`.** To push your own commit to main without disturbing
   CCW, use a **refspec push** (`git push origin <sha>:main`) instead of
   `git checkout main` — no branch switch, no race with CCW's concurrent
   git ops, CCW's WIP untouched. Ideal fix: give each agent its own
   checkout / worktree.
2. **secrets.yaml path = `get_config_dir()` ONLY.** The old
   `_get_user_override_path` XDG/APPDATA duplicate was deleted; all
   secrets access (layered config, resolver, `secrets_service`,
   `reset_service`) now resolves via `app.paths.get_config_dir`. Tests
   isolate via `ADAPTIVE_LEARNER_CONFIG_DIR`→tmp; an autouse conftest
   fixture clears `secret.key` + `secrets.yaml` between tests. **Never
   write the real `~/.config` in a test.**
3. **secret.key must ALWAYS be created.** The file is the key source;
   the env var only *seeds* it once. If a future change reintroduces
   env-priority, the original bug returns. `test_secret_key_created_
   even_when_env_set` pins this.
4. **Background-task exit codes lie.** A backgrounded `make … ; echo
   EXIT=$?` reports the *echo's* 0 even when the gate failed. Always
   grep the log for the real result, not the task-notification's "exit
   code 0".
5. **cwd drift in Bash.** A failed `cd` leaves the shell in an
   unexpected dir; later relative paths fail. Use absolute paths or
   `git rev-parse --show-toplevel`. `npx tsc`/`vitest` must run from
   `frontend/`.
6. **Version bumps + `--no-verify`.** The `plugin-lock-paired-with-
   pyproject` pre-commit hook false-positives on version-only plugin
   pyproject bumps (`sync-versions`); release commits use `--no-verify`.
   Plugin poetry.lock content-hashes cover deps, not the package
   version, so a version-only bump is a lock no-op.
7. **Dexie-mode is part of the contract.** Every frontend feature must
   work (or degrade gracefully) in the no-backend GH-Pages build;
   `make test-dexie-smoke` gates it.
