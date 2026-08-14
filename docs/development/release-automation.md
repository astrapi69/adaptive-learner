# Release automation

How Adaptive Learner's release-cycle mechanics work: version propagation, pre-tag verification, aggregate Makefile targets, and the CI gate. The companion human-side flow lives at [.claude/rules/release-workflow.md](../../.claude/rules/release-workflow.md); this document is the architecture + tooling reference.

**TL;DR:** `backend/pyproject.toml` is the canonical single-source-of-truth. `make sync-versions` propagates to every derived version-bearing file (the authoritative set is `collect_targets()` in `scripts/sync_versions.py`). `scripts/verify_version_pins.sh` is the pre-tag validation chain. Seven aggregate `make release-*` targets cover the Step 1 / 4b / 5 / 6 / 7 / 8 mechanics. The `release-gate.yml` CI workflow re-runs the same checks on every tag push.

---

## Architecture

Adaptive Learner implements the Maven-property pattern in a multi-language repo: one canonical version source, automated propagation to every reference. Established in Phase 40 (2026-05-23) by aligning with Bibliogon's battle-tested model.

### Tier 1 — Canonical source (hand-edit only)

| File | Field | Mechanism |
|---|---|---|
| `backend/pyproject.toml` | `version = "..."` | Hand-edited at line 3, ONCE per release |

### Tier 2 — Auto-propagated by `make sync-versions`

The locations updated by `scripts/sync_versions.py` in one invocation (backend + frontend + the launcher files + every plugin pyproject + the installer artifacts; the exact list is `collect_targets()` in that script):

| File | Mechanism |
|---|---|
| `frontend/package.json` | JSON edit at top-level `version` |
| `launcher/pyproject.toml` | TOML edit at `tool.poetry.version` |
| `launcher/adaptive_learner_launcher/__init__.py` | `__version__ = "..."` literal substitution (kept for PyInstaller frozen-binary compatibility) |
| `launcher/adaptive-learner-launcher.spec` | `CFBundleVersion` + `CFBundleShortVersionString` (both same value) |
| `plugins/*/pyproject.toml` (every plugin) | Lock-step (plugin-independent versioning deferred per CLAUDE.md note) |
| `install.sh` | Regenerated from `install.sh.template` via `scripts/generate_install_sh.sh` |
| `install.ps1` | Regenerated from `install.ps1.template` (same mechanism) |

### Tier 3 — Runtime-derived (no literal to maintain)

| Site | Mechanism | Fallback |
|---|---|---|
| `backend/app/__init__.py:__version__` | `tomllib.load(backend/pyproject.toml)["tool"]["poetry"]["version"]` at import | `"0.0.0+unknown"` sentinel + WARN log |
| `frontend __APP_VERSION__` | Vite `define` build-time literal from `package.json` | n/a (build-time fail) |
| `launcher/adaptive_learner_launcher/installer.py:ADAPTIVE_LEARNER_TARGET_VERSION` | PyInstaller spec writes `_build_info.py` at build time (gitignored); dev fallback reads pyproject | `"0.0.0+unknown"` |
| plugin `__init__.py` (each plugin that carries a `__version__`) | `importlib.metadata.version("adaptive-learner-plugin-<name>")` | `"0.0.0+unknown"` sentinel |

### Tier 4 — Manual content (LLM/human-drafted per release)

These intentionally contain a hand-typed version literal as part of the release narrative; not in scope for `sync-versions`:

- `CLAUDE.md` "Version: X.Y.Z (...)" prose summary
- `changelog/releases/vX.Y.Z.md` per-release notes
- `docs/ROADMAP.md`, `docs/backlog.md` (may reference versions in prose)
- `docs/journal/chat-journal-session-YYYY-MM-DD.md` release session entry

---

## Tooling

### `make sync-versions` — propagation

```bash
make sync-versions            # apply
make sync-versions-dry        # show what would change
make sync-versions-check      # exit 1 on drift (CI gate)
```

Implementation: [`scripts/sync_versions.py`](../../scripts/sync_versions.py) (stdlib-only: `tomllib`, `json`, `re`, `pathlib`). Reads `backend/pyproject.toml`, writes the Tier-2 files. Idempotent. Modes: `apply` (default), `--dry-run`, `--check`.

### `scripts/verify_version_pins.sh <VERSION>` — pre-tag validation

```bash
bash scripts/verify_version_pins.sh 1.25.0
```

Validates:

1. Canonical pin matches `<VERSION>`.
2. `install.sh` is in sync with `install.sh.template`.
3. **Regression detectors** for hardcoded literals in the "DO NOT EDIT" tier (`__version__`, `APP_VERSION`, `COMPATIBLE_VERSION` reintroduction, static install-wrapper literals). Fail loudly if any closed-set drift is detected.
4. Subsystem lock-step (`sync-versions --check`).
5. **Open-set discovery** (advisory) via `scripts/discover_version_literals.sh`. Surfaces version literals in unexpected files.

### `scripts/discover_version_literals.sh` — open-set discovery

Greps for version-assignment patterns (`version = "..."`, `"version": "..."`, `__version__ = "..."`, `APP_VERSION = "..."`, `CFBundle*: "..."`) across the repo, excludes the known-target set (Tier 1/2 propagated + Tier 4 manual + per-plugin static + sentinel fallbacks + test fixtures + MkDocs site output). Anything left is a discovery candidate — either:

- A new file that should be added to `sync_versions.py`'s `collect_targets()`, OR
- A legitimate one-off literal that should be added to `KNOWN_FILES` in the discovery script

Exit code always 0 (advisory). Wired into `verify_version_pins.sh` as a non-fatal WARN.

### `make verify-plugin-locks` — plugin-lock drift gate

For each `plugins/adaptive-learner-plugin-*/`, runs `poetry install --dry-run --no-interaction --no-ansi` and greps for "changed significantly". Catches the v0.30.0-style hotfix where the backend's combined lock + per-plugin locks drift independently after a shared-dep pin bump. See [.claude/rules/lessons-learned.md "Two installation paths diverge"](../../.claude/rules/lessons-learned.md).

---

## Aggregate `make release-*` targets

Seven targets compose existing tooling for the mechanical steps of `release-workflow.md`:

| Target | release-workflow.md Step | What it does |
|---|---|---|
| `make release-state` | Step 1 | Print latest tag + commits since + diff stat + current canonical version |
| `make release-outdated` | Step 4b | `poetry show --outdated` × backend + launcher; `bun outdated` × frontend |
| `make release-test` | Step 5 | `make test` + `bun run build` + `bun run test` (vitest) + `sync-versions-check` + `verify-plugin-locks` |
| `make release-build` | Step 6 | Conditional backend `poetry build` (skipped iff `package-mode=false`) + frontend `bun run build` |
| `make release-discover` | Step 4 supplement | Run the open-set version-literal discovery script with verbose output |
| `make release-tag VERSION=X.Y.Z` | Step 7 | `verify_version_pins.sh $(VERSION)` + `git tag -a` + push main + push tag |
| `make release-publish VERSION=X.Y.Z` | Step 8 | `gh release create v$(VERSION) --notes-file changelog/releases/v$(VERSION).md` |

**Not automated (LLM/human value-add):**
- Step 2 SemVer classification
- Step 3 CHANGELOG draft + per-release notes composition
- Step 11 CLAUDE.md + journal post-release docs

**Not in scope:**
- Playwright `--project=smoke` (needs running app; runs separately as `cd e2e && npx playwright test`)
- Backend `mypy` (no top-level target yet; would belong in `release-test` once added)
- Launcher PyInstaller build smoke (already covered by `launcher-{linux,macos,windows}.yml` workflows)

---

## CI gate: `release-gate.yml`

Runs on every `v*` tag push + manual `workflow_dispatch`. One job:

### `verify-versions`

- Tag-vs-canonical match (refs/tags/vX.Y.Z must equal `backend/pyproject.toml`'s version)
- `scripts/verify_version_pins.sh <VERSION>` — full validation chain including the discover-literals WARN
- `python3 scripts/sync_versions.py --check` — subsystem lock-step (redundant with verify_version_pins.sh, kept for defense-in-depth)

**Cost:** ~1 CI min per gate run.

**Note:** The gate is advisory in the sense that tag pushes themselves cannot be blocked by CI. But the launcher build workflows (`launcher-{linux,macos,windows}.yml`) re-run the same checks before uploading binaries — failure there DOES block artifact attachment.

---

## Adding a new propagated file

When a future feature introduces a new file that needs to track the canonical version:

1. **Pick the propagation mechanism** by tier:
   - Tier 2 (auto-propagated literal): add handler + entry to `sync_versions.py`
   - Tier 3 (runtime-derived): add `tomllib.load(pyproject)` or `importlib.metadata.version()` import; document the fallback
   - Tier 4 (manual content): no automation needed; the author maintains the literal

2. **For Tier 2:**
   - Add a new handler function in `scripts/sync_versions.py` (mirror the existing `update_*` helpers)
   - Register the handler in the `HANDLERS` dict + the `collect_targets()` list
   - Add the file path to `KNOWN_FILES` in `scripts/discover_version_literals.sh` (so it doesn't show up as an unknown-literal warning)

3. **Add a regression detector** to `scripts/verify_version_pins.sh` if the new file has a "DO NOT EDIT" tier where a contributor might be tempted to hand-edit (e.g. a generated artifact that should derive from elsewhere).

4. **Update this document's Tier 2 table** with the new file + mechanism.

---

## Adding a new version-string location discovered in the wild

When `make release-discover` (or the verify-pins WARN section) surfaces an unexpected file:

1. **Decide:** is it a sync-target (should be auto-propagated) or a legitimate one-off (test fixture, sample data, separate sub-project)?

2. **If sync-target:** follow "Adding a new propagated file" above.

3. **If legitimate one-off:** add the file path to `KNOWN_FILES` in `scripts/discover_version_literals.sh` with a brief comment explaining why it's intentional. Re-run `make release-discover` to confirm it drops off the list.

---

## Phase 40 audit history

The release-automation hardening was formalised in Phase 40 (2026-05-23). Before Phase 40, the propagation pattern existed but had documented gaps:

- `frontend/package-lock.json` top-level `version` field not synced (drifted at v1.23.2 while canonical was at v1.24.0)
- No `scripts/discover_version_literals.sh` for open-set discovery — future files with version literals would slip past every gate
- `verify_version_pins.sh` did not call discover as an advisory WARN
- No aggregate `make release-*` targets — every release re-derived the command sequence from memory
- No `docs/development/release-automation.md` 4-Tier architecture doc

All five closed in Phase 40 across commits `824a5bc`..`4bebb52`. Future audits should re-run `make release-discover` against the working tree as part of release prep — anything new there is a candidate for one of the two adding-a-new-X recipes above.
