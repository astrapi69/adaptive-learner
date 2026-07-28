---
description: Release, packaging and dependency pitfalls - version pins, frozen binaries, poetry semantics, install.sh, hotfix tags
globs:
  - launcher/**/*
  - install.sh*
  - install.ps1*
  - backend/pyproject.toml
  - plugins/**/pyproject.toml
  - .github/workflows/release*.yml
  - .github/workflows/launcher-*.yml
alwaysApply: false
---

# Release + packaging pitfalls
## Commit ordering for breaking-change dependency upgrades

Pin the version bump BEFORE migrating call sites when the new code uses imports that only exist in the new release. Backward-compatible re-exports during a transition cycle keep the intermediate state green. Doing it the other way - migrate first, bump pin last - leaves the migration commit red against the still-installed old version and breaks the "each commit green individually" rule.

Path-installed plugins do not auto-refresh when their `pyproject.toml` changes. After bumping a transitive dependency in a plugin (e.g. `httpx` in `plugins/adaptive-learner-plugin-ai-anthropic/pyproject.toml`), run `poetry lock` AND `poetry install` in the BACKEND directory too - the backend's `poetry.lock` caches the resolved deps of the plugin's old pin until you regenerate.

## Dependency currency in active development

In active development projects, dependency versions should be kept current from day one. Shipping with end-of-life or deprecation-imminent versions creates technical debt immediately.

### Rules

- Only stable releases, no beta/RC/alpha versions ever in production code
- "Latest stable" means most recent version that has proven stable (minimum 2 weeks since release)
- For LTS products (Node.js), prefer Active LTS over Current
- Review dependencies at each release cycle: run `poetry show --outdated` and `bun outdated` before cutting any release
- Major version bumps get their own commit with migration notes
- Routine minor/patch bumps can be batched by category

### Red flags for outdated dependencies

- Deprecation warnings in build output
- End-of-life announcements in package READMEs
- Security advisories against installed versions
- Upstream pins blocking other upgrades (e.g. PluginForge restricting a transitive bump)

Upstream blockers: when an external dependency (e.g. PluginForge) pins a transitive dep with an upper bound we cannot move past, the bump is deferred until the upstream releases a compatible version. Document the blocker in the commit that updates what it can, so the next sweep picks it up.

### Release-cycle dependency review

Before cutting any release, run dependency currency check:
- `poetry show --outdated` in backend and each plugin
- `poetry show --outdated` in launcher
- `bun outdated` in frontend

Apply routine bumps (patch + minor + low-risk minor) as part of release prep. Defer major bumps to dedicated sessions with their own testing cycle.

Never ship with:
- End-of-life versions
- Deprecation-imminent versions (forced migration within 6 months)
- Versions with known unpatched P0 bugs

Stability filter:
- Latest stable only, never beta/RC/alpha
- Minimum 2 weeks since release for new major versions
- For LTS products (Node.js), prefer Active LTS over Current

## install.sh VERSION drift

`install.sh` pinned `VERSION="v0.7.0"` as the default, but Dockerfile and docker-compose.prod.yml evolved significantly after that tag. The v0.7.0 compose used `build: ./backend` (backend-only context), while current uses `context: .` (repo root). Plugins live at `<repo>/plugins/` which is entirely outside the v0.7.0 build context, so `poetry install` inside the container could never find them.

The fix for the original Docker bug (commit 59cf3d6) was verified by building from the local working tree, not by running install.sh end-to-end. The local build used the current compose/Dockerfile; install.sh used the ancient tagged version. The verification test was wrong because it didn't test the actual user flow.

Rule: when fixing an install/deployment script, always test THE SCRIPT, not just the artifacts it references. `docker build -f Dockerfile .` is not the same test as `./install.sh` because the script may select a different version of the files.

install.sh now pins to the latest release tag (updated as part of the release workflow, Step 4). Users can override with `ADAPTIVE_LEARNER_VERSION=vX.Y.Z` for older versions.

Corollary: install scripts are a special class of code where the test must simulate the actual distribution path. CI that tests scripts should run them the way users run them, not the way developers run them. `docker build -f Dockerfile .` from a working tree is not the same test as `curl ... | bash` which downloads, checks out a tag, and then builds.

2026-05-04 SSoT refactor: install.sh became a generated artifact built from `install.sh.template` + `backend/pyproject.toml` via `scripts/generate_install_sh.sh`. The committed install.sh stays in git because users curl-pipe it directly from the raw GitHub URL; it cannot be a build-time artifact hidden behind .gitignore. Treat it like generated docs: edit the template, regenerate at release time, commit both. `verify_version_pins.sh` runs `--check` to catch drift between template and committed output.

## Single source of truth for version pins

Every duplicated version constant is a stale-pin bug waiting to happen. The 2026-05-04 audit chain found seven such pins across launcher, frontend, install.sh, and one plugin - three were already stale (8 versions, 13 versions, and 3 versions behind the canonical pyproject.toml / package.json). Each had drifted because the release workflow listed them as bullets to manually update, with no enforcement.

Architecture goal (Java/Maven precedent): ONE version per subsystem in a canonical packaging file; everything else derives.

### Canonical sources (hand-edited at release)

- `backend/pyproject.toml` for the Python subsystem
- `frontend/package.json` for the JS subsystem
- Each `plugins/<name>/pyproject.toml` for its own plugin (plugins have independent versions)

### Derivation patterns by language and runtime

| Subsystem | Pattern | Why |
|---|---|---|
| Python (publishable distribution) | `importlib.metadata.version("<dist-name>")` with `PackageNotFoundError` fallback | Standard. Reads packaging metadata; cannot drift. |
| Python (`package-mode = false`, e.g. backend app) | `tomllib.load(open("pyproject.toml", "rb"))["tool"]["poetry"]["version"]` | importlib.metadata is unavailable when Poetry doesn't register a distribution. tomllib is stdlib in 3.11+. |
| Bash installer (chicken-and-egg before clone) | Generate the script at release time from a template; substitute placeholder from canonical pyproject. Commit the generated artifact. | Runtime parse impossible because pyproject doesn't exist when curl-pipe runs. GitHub-API-at-runtime is non-deterministic and brittle. |
| Frozen binary (PyInstaller) | Build-time injection: spec script writes a generated `_build_info.py`, gitignored, that the binary embeds. Dev fallback reads pyproject directly. | importlib.metadata is unreliable inside PyInstaller's frozen tree. |
| Frontend (Vite) | `define` block reads package.json at build, exposes `__APP_VERSION__` literal. TypeScript declares `declare const __APP_VERSION__: string;` in `vite-env.d.ts`. | Build-time literal substitution. Zero runtime cost, zero bundle overhead. |

Always include a fallback sentinel (e.g. `"0.0.0+unknown"` with a `logger.warning`) when the derivation can fail at runtime (file missing, distribution not registered). Silent fall-through to a hardcoded number masks environmental problems.

Always include regression detectors in `verify_version_pins.sh`: grep patterns that fail the check if a hardcoded literal reappears in the "DO NOT EDIT" tier. Workflow checklists alone are not enforcement; a script that exits non-zero on regression is.

Never add a hardcoded version constant "for convenience" (e.g. for use in a GitHub-Issue body template, a footer string, or an OpenAPI metadata field). Always reference the derived single source.

## Hotfix cluster tag policy

When a release tag fails CI for a mechanical reason (chmod bit missing, formatter nit, type-check escape, build-time spec error) and a fix lands quickly via point-release bumps, the failed tag stays in the repository as historical record - it does not get deleted. Reasons:

- The v0.26.0 release-gate run, even though it failed, is part of the release audit trail (run ID `25328065614`).
- Deleting a published tag is a force-push class operation per CLAUDE.md security rules; allowed only when nobody pulled the tag and no GitHub Release was published. The latter is satisfied for failed-gate tags but the former requires asserting nobody fetched in the meantime.
- Each tag's commit reflects the state at the moment of the bump. Future bisects can use them.
- The shipped tag's `changelog/releases/v0.X.Y.md` file documents the hotfix history (see v0.26.3.md "Hotfix history" section as the template).

Current cluster preserved as-is: `v0.26.0` (release-gate failed on chmod), `v0.26.1` (launcher builds failed on PyInstaller spec `__file__`, CI failed on mypy), `v0.26.2` (CI failed on ruff-format), `v0.26.3` (all green; the shippable tag).

Do delete a tag only when it was pushed in the last few minutes and the user explicitly confirms no one could have pulled. The default is keep + document.

## Subsystem lock-step + tooling, not checklists

Per-subsystem SSoT (one canonical pyproject per Python subsystem, one canonical package.json for the JS subsystem) was the first half of the fix. The second half is lock-step propagation by tooling, not by human attention. A 7-row checklist that says "edit every file" fails every time someone forgets a row; the 2026-05-04 audit chain found three pins that had drifted by 8, 13, and 3 versions respectively across multiple releases.

### Architecture, post-2026-05-04 lock-step

1. One canonical version per language subsystem (backend/pyproject.toml, frontend/package.json). Hand-edited at release time.
2. `make sync-versions` (`scripts/sync_versions.py`) propagates the canonical to every other version-bearing field: launcher pyproject + spec plist + `__init__.py` literal, all plugin pyprojects, frontend package.json (when needed), `install.sh` regen via the existing template helper. The tool is the only thing that touches those files.
3. `make sync-versions-check` + `verify_version_pins.sh` enforce lock-step in a tight loop. The verify script also runs the subsystem-lock-step check inline.
4. CI gate (`.github/workflows/release-gate.yml` on tag-push, plus the same checks inlined as the first step of every launcher build job's `release: created` path). Artifact attachment is blocked on drift. Tag pushes cannot be retroactively undone, but the gate failure surfaces the drift loudly and prevents downstream artifact publication.

### Rules for working in this codebase

- **Do not hand-edit any version field except `backend/pyproject.toml`.** Even the assistant doing the work follows this rule. If the assistant bypasses the tool and edits a downstream pyproject directly, the tool's value is zero from day one. Run `make sync-versions` and let the diff speak.
- **Each release commit's diff for non-canonical version fields must be reproducible by re-running `make sync-versions` from a clean checkout.** That's the bisect contract: any historical commit can be re-derived from `backend/pyproject.toml` + the tool.
- **A new subsystem with its own version field**: add it to `scripts/sync_versions.py`'s `collect_targets()` AND the regression detector in `verify_version_pins.sh` AND the CI gate. Three artifacts per new pin; never one or two.
- **The `--check` mode of every sync/verify script must be idempotent**: running it twice in a row produces the same answer, never writes, never depends on environment state beyond the repo. CI relies on that property.

## Diagnostic features must fail open

Diagnostic and convenience features should fail open. A feature that prevents bad behavior (double-launch, stale cache, etc.) must not block the application's primary function when it fails. Crashing the app because a convenience check crashed is always worse than silently skipping the convenience check.

Concrete example: the launcher's lockfile check (`another_instance_alive`) crashed with `TypeError: argument of type 'NoneType' is not iterable` because `tasklist` returned `stdout=None` on a Windows locale edge case. This prevented every user from starting the launcher at all. The fix: wrap in try/except that fails open (log warning, proceed).

This applies beyond lockfiles. Any startup check, guard, or health probe that gates the main application flow should be wrapped so that a failure in the check degrades gracefully rather than killing the app.

## Shallow clone update trap

`git clone --depth 1 --branch v0.7.0` creates a repo where `origin/main` does not exist as a remote ref. A later `git fetch origin` does not fix this because the fetch refspec was configured for the tag, not for branch tracking. `git checkout -B main origin/main` then fails with "pathspec 'main' did not match". The fix is to not try to update shallow clones in place at all. Delete and re-clone (backing up .env first) is the only reliable cross-platform approach. Surgical git state repair across shallow clone versions, platforms, and git implementations is a losing battle.

## `poetry update` vs `poetry lock` semantics

Surfaced during the 2026-05-12 dep-update audit Phase 3. The `make lock-all-plugins` target runs `poetry lock` per plugin. `poetry lock` validates that existing resolutions still satisfy current pyproject constraints — it does NOT refresh transitives to their latest within the allowed range. `poetry update` does that.

So:

- `poetry lock` = "re-resolve from pyproject specs." Only meaningful after a pyproject pin changed. No-op when nothing in pyproject changed (the existing lock is still a valid resolution).
- `poetry update <pkg>` = "move this package (and its transitives) to the latest within range." Touches the lock; pyproject is unchanged unless the new version exceeds the caret.
- `poetry update` (bare) = "move EVERY package within every range." Maximally aggressive; pulls every patch + every minor + every transitive-of-transitive. Risky: one low-risk direct bump can pull a high-risk transitive via the upstream's relaxed bounds (see next rule below).

The `make lock-all-plugins` target serves the "pyproject changed" case (e.g. after a shared-dep pin bump propagated to every plugin via `sync-versions`). It is NOT a "pull patch transitives" tool. Use `poetry update <allowlist>` per plugin for that purpose.

Concrete rule: when "the lockfile didn't change after `make lock-all-plugins`", check whether any pyproject changed. If none, the no-op is correct. If patch transitives are still wanted, switch to a per-plugin `poetry update` with an explicit allowlist.

## Transitive deps can surface high-risk packages from low-risk direct bumps

Surfaced during the 2026-05-12 dep-update audit Phase 3, on a single test plugin run before going wider.

Bare `poetry update` on `adaptive-learner-plugin-help` (one of 11 plugins, used as a pre-flight test) pulled:

- ✅ `pydantic 2.12.5 -> 2.13.4` (low-risk patch)
- ✅ `idna`, `packaging`, `coverage`, `pygments` (audit-low-risk batch)
- ⚠️ `fastapi 0.135.3 -> 0.136.1` (the plugin pins `^0.136.0`, so 0.136.1 is in-range; backend is at 0.136.0)
- 🚨 `starlette 0.46.2 -> 1.0.0` — explicitly audit-deferred as high-risk

Cause: FastAPI 0.136.1 relaxed its upper bound on starlette. A transitive walk through this relaxed bound pulled starlette 1.0, the package the audit had specifically deferred. The plugin's lock was reverted immediately (`git checkout` + `poetry install` downgraded back to 0.46.2).

The general shape: low-risk direct bumps can pull high-risk packages transitively when the upstream relaxes a bound. Even an audit that correctly categorised packages by direct risk can miss this if the audit didn't model transitive cascades.

### Concrete rule for any bulk-bump pass

- Pre-flight a single instance before bulk-applying. One test plugin / one test environment, never blind bulk. The 2026-05-12 audit caught the starlette surfacing on plugin #1 of 11; revert was cheap.
- Prefer `poetry update <allowlist>` over bare `poetry update`. The allowlist constrains which packages can move; transitives only move if their own version constraint demands it. Example for the plugin-Pydantic alignment use case: `poetry update pydantic pydantic-core` (NOT `poetry update`).
- If the audit deferred a package as high-risk, add a regression check. Grep for the package name in the resulting lock-diff before committing; if it appears in the diff despite not being in your allowlist, surface and revert.
- The "two installation paths" rule still applies. A backend-only lock-resolution test is not enough; a transitive surfacing in a plugin lock would only appear when you actually run that plugin's `poetry install`. Per-plugin CI catches this; a one-time pre-flight runs faster.

## Frozen-only behaviour is proven on the real artifact, not the source-tree run

Surfaced 2026-07-24 via #2027: the launcher's frozen one-file binary showed the package-default "My App" window title for multiple releases. Root cause: in a PyInstaller one-file build the entry module's `__file__` is `_MEIPASS/__main__.py` (NO package subdirectory), so the source-checkout arithmetic `parent.parent / "launcher.json"` escaped the bundle (`/tmp/launcher.json`, ENOENT) and the fail-open upstream config loader silently produced an all-defaults config. All 17 wrapper tests and every `--check` / `--version` source-run probe were green the whole time; the defect existed ONLY in the frozen binary, and only strace (path probes) + xdotool (real window title) against the actual built artifact exposed it (fix: PR #2028; upstream fail-open warning filed as docker-app-launcher#32).

### Rules

- **Path resolution in wrapper/packaging code never trusts `__file__` arithmetic alone.** In the frozen branch prefer `sys._MEIPASS` explicitly (see `_bundle_root()` / `_config_path()` in `launcher/adaptive_learner_launcher/__main__.py`), and pin the frozen layout with tests that monkeypatch `sys.frozen` + `sys._MEIPASS` (the four #2028 regression tests are the template).
- **For any change to launcher/packaging/spec code: the source-tree run is a PRE-CHECK, the built-artifact test is the PROOF.** Build the real binary (`poetry run pyinstaller ... --clean`) or download the CI artifact, run it standalone (outside the repo checkout), and verify the user-visible claim on the artifact itself - window title via xdotool, file access via strace, CLI via the binary. A green test suite plus a green source run proves nothing about the frozen path.
- **A fail-open fallback in a dependency masks this class.** When a wrapper passes an explicit resource path into a dependency that silently falls back on a miss, the miss is invisible; prefer dependencies that warn (upstream ask: docker-app-launcher#32), and in the meantime make the wrapper's resolution testable so the miss cannot happen silently.

Pairs with "Test a tool through the interface it actually uses, not a mock of it" - the same family: the interface users actually run is the frozen binary. "Operational gaps masquerade as wired infrastructure" - bundled data (the spec's `launcher.json` + icon datas) that nothing at runtime actually reads is wired, not working. "install.sh VERSION drift" - the older sibling: test THE SCRIPT / THE ARTIFACT, not the files it was built from.
