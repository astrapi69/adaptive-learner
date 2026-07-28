---
description: Backend + plugin pitfalls - Alembic, FastAPI lifespan, filesystem isolation, plugin config, module-level caches, PluginForge
globs:
  - backend/**/*.py
  - plugins/**/*.py
  - backend/config/**/*.yaml
alwaysApply: false
---

# Backend pitfalls
## Gitignored config + stale example = silent CI drift

Surfaced 2026-05-23 closing `COVERAGE-WORKFLOW-PLUGIN-INTEGRATION-01`. When a config file is gitignored (so contributors can keep local edits) AND the app bootstraps a missing config by copying from a committed `.example` sibling, the example MUST be updated every time the production config gains a load-bearing entry. Otherwise CI — and any other fresh-checkout environment — silently runs with the example's shape, not the production shape.

### The trap

`backend/config/app.yaml` is gitignored. `app/main.py` copies `app.yaml.example -> app.yaml` on first boot when no local file exists. Three new plugins (`gamification`, `anki`, `notebooklm`) were enabled in the developer's local `app.yaml` when Phases 29A/30B/32 landed, but the example was never updated. Every CI push for ~5 releases ran with only 7 of 10 plugins enabled. 55 plugin-integration tests failed silently in the background.

The trap was reinforced by:
- Local `make test` was green for every developer (everyone's local `app.yaml` carried the right shape; the example never got exercised on those machines).
- The investigation that filed the backlog item hypothesised about `pytest-cov` instrumentation races and entry-point registration ordering — none of which the actual CI log supported. The smoking-gun log line `Plugins enabled in config (7): ...` named the 7 enabled plugins explicitly on every run, but the investigation never read that line.

### Rule

For any gitignored config that has a committed `.example` fallback used to bootstrap fresh environments:
- Treat `.example` as part of the contract, not a "for reference" file. It IS what CI / new contributors / docker-build runs against.
- When you add or remove a load-bearing entry in the real config, update the `.example` in the same commit.
- Pre-commit hook ideas: a check that diffs the structural shape (top-level keys, list lengths under known paths) between the two files and warns on drift.
- The investigation of a CI-only failure must include the comparison `diff <real-file> <.example-file>` as step 0, before any hypothesis about flaky tests or tooling races.

### Detection grep

For self-audit on any gitignored config in the project:

```bash
# Find every gitignored config that has a committed .example.
git ls-files --others --ignored --exclude-standard \
  | while read f; do
      if [ -f "$f.example" ] || [ -f "$(dirname "$f")/$(basename "$f" .yaml).yaml.example" ]; then
        echo "$f"
      fi
    done
```

Each match is a candidate for the drift pattern. Diff them before assuming CI is correct.

### Anti-pattern: hypothesis chains that never read the log

The handover for this bug burned ~2-3 hours of investigation across multiple sessions modelling `pytest-cov` / entry-point / fixture-order interactions, then ranked four fix paths from "highest confidence" downward. The actual CI log printed the exact failure mode at INFO level on every run; the investigation simply didn't read it. When debugging a CI failure, the FIRST artifact to examine is the failing job's log — specifically the application's own startup INFO lines. Hypothesis-chain triage works for symptoms with no observable diagnostic; it actively harms when the diagnostic is sitting in plain text in the log.

Pairs with "User-perceived bug ≠ code bug: the perception-lag class" — same family. Both rules push back against hypothesis-first triage when the evidence is one log-line away.

## Alembic `fileConfig` silences every existing logger

`migrations/env.py` is generated from Alembic's template, which calls `fileConfig(config.config_file_name)` unconditionally. Two side effects burn time on the day your INFO logs stop appearing:

1. `disable_existing_loggers=True` is the default. Every `logging.Logger` created BEFORE `init_db()` (in our app: at least `app.main`'s module-level logger) is disabled. Subsequent `logger.info(...)` calls drop to the floor.
2. The root logger level is reset to whatever `[logger_root] level = ...` says in `alembic.ini` (`WARNING` in this repo). So even fresh loggers created after the call inherit the lower level.

**Symptom**: you see `Starting AdaptiveLearner` (logged before `init_db()`), then alembic's own setup messages, then your subsequent INFO lines silently disappear. Plugin loading still WORKS — routes mount, the app responds — but the audit trail is dark. Burned several debugging hours on the v0.30.0+ medium-import session by treating "no plugin loading log = plugin not loading" as a true causal link.

**Fix**: in `migrations/env.py`, gate the `fileConfig` call so it only fires when the FastAPI app has not already configured logging:

```python
import logging
from logging.config import fileConfig
...
if config.config_file_name is not None and not logging.getLogger().handlers:
    fileConfig(config.config_file_name, disable_existing_loggers=False)
```

The standalone `alembic` CLI invokes env.py before any handler is attached (`logging.getLogger().handlers` is empty), so the guard preserves the documented CLI behaviour. Embedded use through `init_db()` runs under the FastAPI/uvicorn handler stack and skips the call.

Generalises to: any library that ships an env.py-style hook calling `fileConfig`/`dictConfig` at import time. Wrap the call in a "have handlers already?" check whenever the same module is imported in two contexts (CLI vs. embedded).

## Plugin settings YAML lives in `backend/config/plugins/`, not in the plugin's own directory

PluginForge reads each plugin's settings from the backend-wide `config_dir`, configured in `app.yaml` as `plugins.config_dir: config/plugins`. So the canonical path for a plugin's settings file is:

```
backend/config/plugins/{plugin_slug}.yaml
```

NOT `plugins/adaptive-learner-plugin-{slug}/config/{slug}.yaml`. The latter is fine for shipping the file inside the plugin's distributable ZIP, but at runtime PluginForge looks ONLY in the backend's config_dir.

**Symptom**: the plugin loads and activates, but `self._settings = self.config.get("settings", {})` returns an empty dict. User-visible settings silently fall back to in-code defaults; the YAML you wrote is never read. The startup log shows it as a single DEBUG line:

```
DEBUG  pluginforge.config: Config file not found, using empty defaults:
       backend/config/plugins/{slug}.yaml
```

That line has appeared in the wild for one shipped-without-defaults plugin (`medium-import` v1) and would have for any future plugin that follows the same wrong-place template.

**Mitigation**: when scaffolding a new plugin, drop the settings YAML directly into `backend/config/plugins/`. Mirror it inside the plugin's own `config/` only if the plugin's ZIP target needs it.

## Alembic migration + fresh test DB

For every new Alembic migration that touches a core table (e.g. `learning_projects`, `learning_sessions`) via `ALTER TABLE`: the file at `~/.local/share/adaptive_learner/adaptive_learner.db` MUST be deleted before the next `make test`. Otherwise you get `sqlite3.OperationalError: duplicate column name: ...`.

Reason: `backend/tests/conftest.py` calls `Base.metadata.create_all(engine)` before every test and creates the tables with the NEW schema. At the same time the on-disk DB still has `alembic_version` pinned to the old revision. `TestClient(app)` triggers the lifespan `init_db()`, which runs `upgrade head` when tables + `alembic_version` both exist - which tries to add the new column via ALTER TABLE a second time and crashes.

Permanent fix: `rm backend/adaptive_learner.db` after `git pull` with a new migration, then `make test`. `init_db()` now sees no tables, runs `create_all` + `stamp head`, and subsequent test runs pass because `alembic_version` is already at the new head.

The clean solution would be a real in-memory test DB setup (e.g. via a `ADAPTIVE_LEARNER_TEST=1` env var) that skips `init_db()` in test mode - does not exist yet.

## Async in the FastAPI lifespan

Inside the `async def lifespan(app)` handler the uvicorn event loop is already running. `asyncio.new_event_loop()` + `loop.run_until_complete(...)` is forbidden there and crashes with "Cannot run the event loop while another loop is running".

When a helper like `sync_edge_tts_voices` needs to run a coroutine during startup: make the function `async` and `await` it in the lifespan, do NOT build your own loop.

Symptoms when done wrong: `RuntimeWarning: coroutine '...' was never awaited` plus the loop conflict ERROR in the startup log.

Other callers of the same function (CLI targets in the Makefile, sync FastAPI endpoints) have to follow along: `asyncio.run(...)` in the CLI, `async def` + `await` in endpoints.

## Deployment

- Default ports: 18001 (backend), 15174 (frontend dev). Both visible in the Makefile dev targets.
- `/api/test/reset` ONLY in debug mode (`ADAPTIVE_LEARNER_DEBUG=true`).
- CORS configurable via `ADAPTIVE_LEARNER_CORS_ORIGINS` (not hardcoded).
- SQLite path defaults to `~/.local/share/adaptive_learner/adaptive_learner.db` (XDG via platformdirs); configurable via `ADAPTIVE_LEARNER_DATA_DIR`.
- `ADAPTIVE_LEARNER_SECRET_KEY` is auto-generated by start.sh when not set.
- Non-root user in the Dockerfile.

## Licensing

### license_tier attribute

PluginForge's BasePlugin is an external PyPI package - do NOT modify. Instead set `license_tier` as a class attribute directly on the plugin classes.

`_check_license` in main.py reads `getattr(plugin, "license_tier", "core")` - the default is "core" (backward-compatible).

### Trial keys

- Trial keys use `plugin="*"` as a wildcard in the payload. `LicensePayload.matches_plugin()` must treat `"*"` explicitly as match-all.
- Trial keys are stored under the key `"*"` in `licenses.json`, not under the plugin name.
- Expiry: always use `date.today()` (UTC), not `datetime.now()`. `date.fromisoformat()` expects the "YYYY-MM-DD" format.
- `_check_license` must check both the per-plugin key and the wildcard key (fallback chain).

### Settings UI

The `discoveredPlugins` API delivers `license_tier` and `has_license` per plugin. Currently all plugins are free (`license_tier = "core"`). The Licenses tab has been removed from Settings.

## Filesystem isolation: production data lives outside the project tree

Production AdaptiveLearner data NEVER lives in the project tree. All paths resolve via `app.paths` helpers (`get_data_dir`, `get_config_dir`, `get_cache_dir`, `get_upload_dir`, `get_db_path`) which use platformdirs (XDG-conformant) by default and respect a `ADAPTIVE_LEARNER_DATA_DIR` (etc.) env-var override. Resolution is always via fresh function calls, never via frozen module-level imports.

### Default locations (Phase 2 swap, 2026-05-04)

- Linux/macOS: `~/.local/share/adaptive_learner/`
- Windows: `%LOCALAPPDATA%\adaptive_learner\`
- Tests: a `tmp_path_factory`-managed dir, set by `backend/tests/conftest.py` before any `app.*` import
- Docker: `/app/data/` via `ADAPTIVE_LEARNER_DATA_DIR=/app/data` in compose, mounted as the named `adaptive-learner-data` volume

### Three layers of protection prevent test runs from touching production data

1. **Production marker file**. Production directories contain a `.adaptive-learner-production` marker (written by the FastAPI lifespan via `app.paths.mark_data_dir_as_production`). If tests ever see one, the entire run aborts with `pytest.exit(returncode=2)`.
2. **Test conftest** sets `ADAPTIVE_LEARNER_DATA_DIR` to a tmp dir before any `app.*` import. The autouse session fixture also asserts the resolved path looks like a tmp location.
3. **All path access via helpers**, never via CWD-relative `Path("foo")` and never via frozen module-level imports.

### Forbidden patterns

- `UPLOAD_DIR = Path("uploads")` at module top level
- `from app.routers.assets import UPLOAD_DIR` (frozen import)
- `Path("data") / "X"` anywhere in production code

### Required pattern

```python
upload_dir = get_upload_dir()  # inside the function that uses it
```

If `make test` aborts with exit code 2, check what path was mounted via `ADAPTIVE_LEARNER_DATA_DIR`. NEVER delete the marker just to make the test pass; investigate why a test pointed at production. Origin: April 2026 data-loss incident — DB tripwire landed in `a4cf7cf`, filesystem tripwire + paths.py in the same period.

### Phase 2 migration

Users with v0.25.0-and-earlier data in the project tree (`backend/adaptive_learner.db`, `backend/uploads/`) get auto-migrated on first start after the platformdirs swap. Helper: `app.data_dir_migration.migrate_data_dir_if_needed`, run from the FastAPI lifespan BEFORE `init_db()`. Properties:

- Idempotent (`.migration-complete` marker short-circuits)
- Fail-loud on conflict (RuntimeError if both legacy and target hold the same item; silent merge would corrupt data)
- Breadcrumb at old paths (`.migrated-YYYY-MM-DD` file beside each moved item)
- Skipped in test mode (`ADAPTIVE_LEARNER_TEST=1`)

Rule: when adding a new persistent path under `get_data_dir()`, also add it to `_legacy_paths()` in `data_dir_migration.py` if a v0.25.0-and-earlier code path could have written to a different location. Otherwise users lose data on the next upgrade.

## Two installation paths diverge: `make test` vs per-plugin CI

AdaptiveLearner's plugins are installed two different ways depending on context:

- **`make test` path:** the backend's combined `poetry.lock` resolves every plugin as a path-dep (`adaptive-learner-plugin-{name} = {path = "../plugins/...", develop = true}`). One `poetry install` from `backend/` brings every plugin's external deps in via the backend's lock.
- **CI plugin-matrix path:** `.github/workflows/ci.yml` and `.github/workflows/coverage.yml` run `poetry install --no-interaction --no-ansi` inside each plugin directory against THAT plugin's own `poetry.lock`. The backend lock is irrelevant here.

When a shared external dep (e.g. fastapi) bumps in every pyproject (backend + 10 plugins), the backend lock and the per-plugin locks drift independently. If only the backend lock gets regenerated:

- `make test` is green (the backend lock satisfies all path-deps; the per-plugin locks are not consulted).
- CI is red (the per-plugin `poetry install --no-interaction` aborts with `pyproject.toml changed significantly since poetry.lock was last generated`).

This shape bit during the v0.30.0 release: the pre-v0.30.0 dep sweep bumped fastapi `^0.135.0 → ^0.136.0` in 11 pyproject.toml files, but `poetry lock` was only run in `backend/`. Local `make test` passed; CI was red on main from `be4b6f3` until hotfix `3232fad` re-locked all 10 plugin lockfiles.

Generalization: any time there are two installation paths for the same code, BOTH must be tested at gate time. The backend's combined lock and the per-plugin locks are different gates; verifying one does not verify the other. The pre-v0.30.0 retro called this out at the meta level ("verify the gate before trusting it"); this is the concrete recurrence.

### Mitigation pattern (now enforced)

- `make lock-all-plugins` (Makefile target shipped in PLUGIN-LOCKFILE-DRIFT-01 commit `1b43aec`): iterates `plugins/adaptive-learner-plugin-*/` and runs `poetry lock` in each. Use after any shared-dep pin bump.
- `make verify-plugin-locks` (Makefile target shipped in the same commit): runs `poetry install --dry-run --no-interaction --no-ansi` per plugin and greps for "changed significantly". Exits 1 with a remediation hint on drift; manual diagnostic, NOT in the pre-tag chain (the pre-commit hook below + the CI per-plugin matrix already cover the right times).
- Pre-commit hook `plugin-lock-paired-with-pyproject` (shipped in commit `8f6fcea`): scoped via `files: ^plugins/adaptive-learner-plugin-[^/]+/pyproject\.toml$`, fails when a staged plugin pyproject lacks a paired staged `poetry.lock`. Catches the operational mistake at commit time. Verified by 6 hook self-check tests in `backend/tests/test_plugin_lock_drift_hook.py` (commit `e31c4fd`), all green at 0.22 s.

Discovery channel without these gates: CI red on main, AFTER a release tag has already been cut. The retro's commitment to "discrete pre-release dep sweep commits" pays off (rollback granularity stays intact), but the better gate is to catch the drift before push, not from the GitHub Actions red badge.

## Module-level caches survive test boundaries (test isolation, in-memory edition)

AdaptiveLearner's filesystem and DB test isolation is well-documented in `CLAUDE.md` ("Test isolation" section) — the `ADAPTIVE_LEARNER_TEST=1` `ADAPTIVE_LEARNER_DATA_DIR` chain plus the production marker tripwire cover those layers. But in-memory caches in service modules have no equivalent guard, and they survive ALL test boundaries inside a single pytest process.

The 2026-05-14 platform_schema regression is the canonical example. `app/services/platform_schema.py` decorates `load_platform_schemas` with `@lru_cache(maxsize=1)` (intentional — production wants the YAML read once at startup). The new `tests/test_platform_schema.py` introduced fixtures that monkeypatch `_SCHEMA_PATH` to a tmp file with a fake schema and calls `load_platform_schemas.cache_clear()` once in an autouse fixture. Symptoms:

1. The autouse fixture cleared the cache before each test but not after — `return None` instead of `yield`.
2. The fake-schema dict from the last test in the file got cached; monkeypatch reverted `_SCHEMA_PATH` at teardown but the LRU cache stayed populated.
3. The NEXT test file that called `load_platform_schemas()` via the real `/api/article-platforms` endpoint hit the LRU cache, saw the stale fake dict, and 5 publications tests failed with `ResponseValidationError: 'twitter' missing display_name` (the shape `test_validate_max_chars_enforced` had written).

Caught only in CI (the local pytest invocation in the same session ran `test_platform_schema.py` in isolation, missing the cross-file poisoning). Fix: change the autouse fixture from `return None` to `yield`, and clear the cache on both sides.

### Rule

Any service module that uses module-level mutable state visible to multiple tests needs a teardown hook in the fixtures that touch it. Concretely:

- `@functools.lru_cache` decorators → tests that monkeypatch the underlying read must `cache_clear()` in BOTH the setup AND the teardown of every fixture/test that touches them. The `yield`-based autouse fixture pattern is the simplest shape:

```python
@pytest.fixture(autouse=True)
def _clear_module_cache():
    module.cached_function.cache_clear()
    yield
    module.cached_function.cache_clear()
```

- Module-level globals (singletons, registries, dicts assigned at import time) → same shape, reset state in both directions.
- Class-level state on a service singleton → same.

### Anti-pattern

Setup-only cache clears (`return None` instead of `yield`) look correct in isolation — the test file's own tests pass green — but pytest runs all collected tests in one process. The cache written by the LAST test in your file is what subsequent test files see. The bug is invisible inside the file's own boundary, which is exactly why CI catches it and local single-file runs don't.

### Detection heuristic

When adding a new test file that fakes out a service module's inputs, grep that service module for:

```bash
grep -E '@(lru_|.*_)cache|_cache *=|^[A-Z_]+ *= *' \
  backend/app/services/<module>.py
```

Any match is a candidate for state-survival-across-tests. Either add the bidirectional `cache_clear()` fixture pattern, or document why the state is OK to leak (rare, but `platform_schema`'s `lru_cache(maxsize=1)` IS production behaviour we wanted, so tests need to isolate, not remove).

Pairs with the existing `CLAUDE.md` "Test isolation" section covers filesystem + DB. This rule covers the third layer: in-process in-memory state. All three layers need explicit handling.

## PluginForge v0.9.0: filtered plugins are NOT load errors

PluginForge v0.9.0 made `target_application` enforcement a hard filter (retired the v0.7.0 deprecation warning). When the host's `PluginManager(app_id="adaptive_learner", ...)` encounters a discovered plugin whose `target_application` is missing or mismatched, the plugin is dropped at discovery time and the event is recorded in `DiscoveryResult.filtered` — NOT in `DiscoveryResult.errors` or in `manager.get_load_errors()`.

The two channels mean different things:

- **`get_load_errors()` / `DiscoveryResult.errors`**: a plugin that the manager TRIED to load and that FAILED (import error, hookspec mismatch, missing required attribute, activation exception). This is a real fault the operator should see.
- **`DiscoveryResult.filtered`** (v0.9.0+): a plugin that was intentionally not loaded because its identity gate said "not for this host." This is correct behaviour, not a failure.

### Operational consequence for the v0.9.0+ era

Our existing `get_load_errors()` consumers (`backend/app/main.py:414` diagnostics log, `backend/app/main.py:532` `/api/plugins/errors` endpoint) do NOT need severity-tagging or a "filtered vs errored" split. Filter events never appear in the error channel under v0.9.0+. Our current boot log confirms this: `Plugins loaded (N/N enabled)` reports the expected count with zero filter warnings, zero load errors, across all 7 shipped plugins (all of which declare `target_application = "adaptive_learner"` since v1.7.0).

This is why the v1.11.0 PluginForge-adoption audit closed the "severity filter" question as docs-only rather than code-only: the framework already separates filters from errors at the API layer, so the host doesn't need to.

### When this would change

If we ever add a third-party plugin path (Settings → Plugins → Install from ZIP, or any other surface that loads plugins authored against a DIFFERENT host), those plugins would be filtered by `target_application`. To surface the filter event to the user (e.g. "This plugin was built for X, not Adaptive Learner — installation refused"), call `manager.get_last_discovery_result().filtered` directly and emit a UI message. Do NOT promote filter events into the error channel; they are not the same severity class and conflating them re-creates the bug v0.9.0 fixed at the framework level.

Pairs with `architecture.md` § "Plugin installation (ZIP)" — the future third-party install path is where filter-event surfacing becomes user-visible value. `.claude/rules/code-hygiene.md` § "Error handling architecture" — filters are not errors, the same way a 401 is not a 500. Keep the channels separate.
