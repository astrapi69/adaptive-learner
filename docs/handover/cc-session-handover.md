# CC Session Handover — docker-app-launcher + Adaptive Learner launcher

**Date:** 2026-06-24
**TL;DR:** Everything in the "offene Punkte 1–11" list is **already done and
published as `docker-app-launcher` 0.8.0 on PyPI**. The *only* open item is
merging the Adaptive Learner bump PR **#1103** (launcher dep → `^0.8.0`), which
was at **11/12 CI checks green (1 pending)** when this session ended.

---

## Repos + branches + status

| Repo | Path | Branch | Last commit | Status |
|------|------|--------|-------------|--------|
| docker-app-launcher | `~/dev/git/hub/astrapi69/docker-app-launcher` | `main` | `4410748 chore(release): v0.8.0` | **Clean. v0.8.0 tagged + on PyPI. Nothing open.** |
| adaptive-learner | `~/dev/git/hub/astrapi69/adaptive-learner` | `develop` | `0af7ba02 fix(github)...` | **PR #1103 open** (branch `chore/launcher-0.8.0`), bumps launcher dep `^0.7.0 → ^0.8.0`. |

- docker-app-launcher releases: tag push `v*` → `.github/workflows/publish.yml` → PyPI. Gate: `make ci` / `make release-check`. Branch model = `main` (no develop).
- PyPI latest confirmed: **0.8.0**.

---

## 1. WAS FERTIG IST (do NOT redo)

The whole `docker-app-launcher` 0.3.0 → 0.8.0 arc is shipped. The 11 "offene
Punkte" map to released versions:

| # | Item | Where it shipped |
|---|------|------------------|
| 1 | Volume-filter fix (active `<compose_project>_*` volume excluded **unconditionally**, never offered/deleted; legacy volumes still offered) | **0.8.0** (re-fix of 0.6.0) |
| 2 | Progress messages — every cleanup step logged incl. skipped volumes (`skipped (not selected)` / `skipped (active project)`); no silent gap | **0.8.0** |
| 3 | Progress bar (`ttk.Progressbar`, determinate + indeterminate health) + **Docker build-step parser** (`DockerBuildProgress`, parses `#<n> [stage x/y]`) | **0.8.0** |
| 4 | Platform-specific Docker check (`check_docker_detailed`) + guided start (`start_docker_daemon` linux systemctl/pkexec, `start_docker_desktop` win/mac) + GUI buttons on the no-Docker screen | **0.8.0** |
| 5 | READMEs (EN + DE) updated for ALL new features + Features list; `README-de.md` fully real-umlaut | **0.6.0 / 0.7.0 / 0.8.0** |
| 6 | `estimated_build_steps` config (0 = auto-detect) | **0.8.0** |
| 7 | `docker_desktop_path` / `docker_install_url` config | **0.8.0** |
| 8 | i18n new keys in all **11 languages** (de/en + el/es/fr/hi/ja/ko/pt/tr/id). Catalog now 102 keys/lang. New: `step_skip_volume`, `step_skip_volume_active`, `docker_not_running`, `docker_no_permission`, `docker_no_path`, `start_docker`, `open_install_guide` | **0.6.0 / 0.8.0** |
| 9 | Tests for everything new (296→307 tests). `make ci` green. | **0.8.0** |
| 10 | Version bump → tag → PyPI publish | **0.8.0 on PyPI** |
| 11 | AL bump | **PR #1103 (open, awaiting merge)** |

Earlier in the same arc (also DONE, published):
- **0.3.0** — port-change `.env` fix + no-rebuild `change_port`.
- **0.4.0** — expert internal ports (rebuild `change_internal_port`).
- **0.5.0** — tray fix: Run-in-background button + iconify fallback, forced AppIndicator backend, `tray_icon_path` + generated default icon, `--debug` tray diagnostics.
- **0.6.0** — active-volume cleanup guard (v1), German real-umlaut strings, two-row buttons, i18n → flat-key YAML catalogs in 11 languages, `cleanup_search_paths`.
- **0.7.0** — in-window language picker + `locale:"auto"` (`detect_system_locale`), configurable `single_instance`/`log_level`/`log_max_size`/`log_backup_count`, complete `launcher.example.json`.

AL side already merged on `develop`:
- `#1083` wrapper `chdir`s to the resolved Compose dir; `#1086` compose+nginx env-templated for all 3 ports; `#1090` `launcher.json` brand-mark icon + bump 0.3.0; `#1091` `make launcher-*` targets; `#1096` bump 0.6.0; `#1098` bump 0.7.0 (`locale:auto` + single_instance + cleanup_search_paths); `#1092` Makefile targets.
- AL `launcher.json` already has: `locale:"auto"`, `single_instance:true`, `log_level:"INFO"`, `cleanup_search_paths`, internal ports, brand-mark icon.

Closed issues: docker-app-launcher #3,#5,#6,#9,#11,#13,#16; adaptive-learner #1082,#1084,#1089,#1091,#1095,#1097.

---

## 2. WAS DER AKTUELLE PR ENTHÄLT (PR #1103, AL)

Branch `chore/launcher-0.8.0` (already pushed). Contains ONLY:
- `launcher/pyproject.toml`: `docker-app-launcher = {version = "^0.8.0", extras = ["tray"]}`
- `launcher/poetry.lock`: relocked to 0.8.0.

Launcher unit suite green locally: **17 passed**.

---

## 3. WAS NOCH IN DEN PR/RELEASE MUSS (open items)

- **docker-app-launcher: NOTHING.** 0.8.0 is final + published.
- **adaptive-learner: merge PR #1103** (was 11/12 green, 1 pending when the
  session ended) and close issue **#1102**. No `launcher.json` change needed
  (the new 0.8.0 fields — `estimated_build_steps`, `docker_desktop_path`,
  `docker_install_url` — are optional; AL relies on auto-detect defaults).
  Optional later: set `estimated_build_steps` in AL `launcher.json` (count the
  steps of `frontend/Dockerfile` + `backend/Dockerfile`, ~38) for a smooth
  build bar; set `docker_install_url` to the Ubuntu docs page if desired.

---

## 4. EXAKTE BEFEHLE zum Weitermachen

```bash
# 1) Finish the AL bump (merge PR #1103 once CI is green)
cd ~/dev/git/hub/astrapi69/adaptive-learner
gh pr checks 1103                       # confirm all green
gh pr merge 1103 --squash --delete-branch
git checkout develop && git pull
gh issue close 1102 -c "Merged via #1103."

# 2) Try the launcher on Aster's machine (manual)
make launcher-test                      # GUI in --debug, logs to launcher/logs/
make launcher-tray-check                # pystray / Pillow / gi present?
make launcher-version                   # should print 1.95.0
# headless verbs: make launcher-status / launcher-check

# 3) (Optional) verify the published package
pip install -U "docker-app-launcher[tray]"   # Linux needs: sudo apt install libgirepository1.0-dev libcairo2-dev pkg-config gir1.2-ayatanaappindicator3-0.1
python -c "import docker_app_launcher; print(docker_app_launcher.__version__)"  # 0.8.0
```

If a future `poetry lock` in `launcher/` fails with "doesn't match any
versions" right after a publish, it's PyPI **simple-index lag** — retry:
`poetry cache clear PyPI --all -n && poetry lock` (usually works on the 2nd try).

---

## 5. Manual checks worth doing on Aster's machine (the reason for the bugs)

The volume-filter + progress bugs were reported from a **running launcher** —
verify the fixes live:
1. Open the launcher; trigger the startup cleanup offer. The active volume
   `adaptive-learner_adaptive-learner-data` must **NOT** appear; legacy
   `bibliogon_*` volumes may. Each skipped volume logs a line (no silent gap).
2. Install/start: a progress bar fills, parsing Docker build steps, and animates
   during the health check.
3. Stop Docker → the no-Docker screen shows a platform-specific reason + a
   **Start Docker** button + **Open installation guide**.
4. The language dropdown switches the UI live and persists.

---

## Gotchas / notes for next session

- **`[tray]` extra pulls PyGObject on Linux** (sdist build) → needs
  `libgirepository1.0-dev libcairo2-dev pkg-config`. CI apt-installs them
  (docker-app-launcher `ci.yml` + AL `launcher-linux.yml`). The frozen launcher
  binary excludes pystray by design → always uses the taskbar fallback; the
  tray/AppIndicator path is for source runs.
- **9 of 11 i18n languages are AI-translated** (el/es/fr/hi/ja/ko/pt/tr/id) and
  would benefit from native review. Parity + placeholder-integrity tests guard
  key/`{placeholder}` drift across all locales.
- **Release only for runtime changes** (a docstring-only 0.4.1 was deliberately
  NOT published; docs-only README changes ride the next release).
- Memory file `reference_ecosystem_repo_paths.md` lists repo paths + the current
  package version (keep it current on the next bump).
