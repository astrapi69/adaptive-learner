# PluginForge v0.9.0 Adoption Signal Report

**Date:** 2026-05-21
**Adaptive Learner version at audit:** v1.11.0 (`backend/pyproject.toml`)
**PluginForge version pinned and installed:** 0.9.0
**Audit trigger:** Maintainer-side request to verify v0.9.0 adoption
shape and report consumer feedback.

## TL;DR

Adoption already shipped — likely in adaptive-learner v1.7.0 per
[CLAUDE.md](../../CLAUDE.md) prose (line 110:
"Bundled: PluginForge ^0.7.0→^0.8.0 in `c4670c0`" and similar
historical-bump notes; the ^0.8.0→^0.9.0 transition is recorded
in the v1.9.0 / Phase 22 release notes). All 7 shipped plugins
declare `target_application = "adaptive_learner"`. The host
manager constructs with `app_id="adaptive_learner"`. No
filter-cascade events, no RecursionError cascade, no load
errors. The original "atomic-commit adoption" the maintainer's
plan presumed was not needed; what remained at audit time was a
single cosmetic cleanup (stale `[fastapi]` extra in the pin),
landed in this session as commit `8a43b36`.

## State at v1.11.0 (post-cleanup)

| Field | Value |
|---|---|
| First v0.9.0 consumer commit SHA | Not from this session — adoption shipped in adaptive-learner v1.7.0+ per CLAUDE.md / release notes. Verifiable with `git log --all -S "pluginforge" -- backend/pyproject.toml` |
| `[fastapi]` extra cleanup commit (this session) | `8a43b36` (chore: drop stale `[fastapi]` extra from pluginforge pin) |
| Plugins declaring `target_application` | **7 of 7 (100%)** |
| Pin shape | `pluginforge = "^0.9.0"` (no extras) in backend + 7 plugin pyprojects; all lockfiles resolved to `0.9.0` (`sha256:5c755e60…`) |
| Host construction site | One site, `backend/app/main.py:262`, params used: `config_path`, `api_version="1"`, `app_id="adaptive_learner"` |
| Unused v0.9.0 PluginManager params | `app_version`, `api_version_severity`, `app_version_severity`, `pre_activate` |
| Hard-filter cascade | **None observed.** Boot logs `Plugin discovery: 7 entry points` → `Plugins loaded (N/N enabled)` with zero filter warnings, zero load errors |
| RecursionError cascade | Not applicable. Single `manager.mount_routes(app)` call site, no double-mount path |
| Single-router convention | 4 plugins return routes (assessment, session, tracking, tools); each `get_routes()` returns `[router]`. 3 plugins are hook-only (ai-anthropic, ai-openai, ai-gemini) |
| Test baseline against v0.9.0 | **670 passed, 1 skipped** (backend, post-cleanup). Per-plugin counts: assessment 112, session 199, tracking 64, tools 58, ai-anthropic 34, ai-gemini 33, ai-openai 31 |

## Plugin inventory

All 7 plugins declare `target_application = "adaptive_learner"`.
None declare `min_app_version`, `depends_on`, `api_version`, or
`config_schema`.

| Class | name | version | Routes |
|---|---|---|---|
| `AssessmentPlugin` | `assessment` | `0.1.0` | 1 router |
| `SessionPlugin` | `session` | `0.1.0` | 1 router |
| `ToolsPlugin` | `tools` | `0.1.0` | 1 router |
| `TrackingPlugin` | `tracking` | `0.1.0` | 1 router |
| `AiAnthropicPlugin` | `ai-anthropic` | `0.1.0` | hook-only |
| `AiOpenAiPlugin` | `ai-openai` | `0.1.0` | hook-only |
| `AiGeminiPlugin` | `ai-gemini` | `0.1.0` | hook-only |

## API surface consumed

**Adopted:**

- `PluginManager(config_path, api_version, app_id)` construction
- `register_hookspecs(...)`
- `discover_plugins()`
- `mount_routes(app)`
- `get_active_plugins()`
- `get_load_errors()`
- `health_check()`
- `deactivate_all()`
- `BasePlugin.name`, `version`, `target_application`,
  `description`, `author`, `get_routes()`,
  `get_frontend_manifest()`

**Not yet adopted (filed as `PLUGINFORGE-LIFECYCLE-UI-01`):**

- `inspect_plugin(name)` → `PluginInspection`
  (`activated_at`, `last_config_change`, `source`)
- `on_plugin_activated` / `on_plugin_deactivated` /
  `on_config_refreshed` event hooks
- `get_last_discovery_result()` (`DiscoveryResult.filtered`,
  `.errors`, `.diff` introspection)
- `pluginforge.testing.IsolatedPluginManager` /
  `MockPlugin` (test suite isolates via `TestClient(app)` +
  per-test patches; v0.8.0 testing submodule deliberately
  deferred per [.claude/rules/architecture.md](../../.claude/rules/architecture.md))

## API pain points / feedback for the PluginForge maintainer

1. **`manager._pm.hook` access is load-bearing.** ~30 call sites
   in production + tests use the private `_pm.hook` attribute to
   invoke hooks directly — pluggy-idiomatic, but documented as a
   private internal. The public alternatives `manager.call_hook`
   and `manager.call_hook_safe` exist; both could be migrated to,
   but they don't surface pluggy's per-hook dispatch fidelity
   (`firstresult` semantics, hookimpl iteration order) the same
   way. **Suggestion:** consider promoting a `hooks` proxy on
   `PluginManager` that mirrors `_pm.hook`'s call shape, so
   consumers can drop the `_pm.` private access without losing
   pluggy fidelity.

2. **`manager._app_config` assignment is the user-overlay
   layering hack.** [backend/app/main.py:285](../../backend/app/main.py#L285)
   writes `manager._app_config = merged_overlay_view` so that
   Settings-UI plugin enable/disable changes take effect on the
   next discovery pass. There's no public "swap the active app
   config" API. **Suggestion:** consider a public
   `manager.update_app_config(new_dict)` (or accept a
   `config_loader: Callable[[], dict]` in `__init__` that the
   manager re-invokes on `rediscover()`).

3. **The `[fastapi]` extra removed in v0.6.0 still appears in
   the package METADATA's long-description prose**
   (`pip install pluginforge[fastapi]`). The `Provides-Extra`
   header is correctly absent, but the README example tells
   users to install with an extra that no longer exists. Pip
   emits a `does not provide the extra 'fastapi'` warning on
   every install when consumers carry the old pin (we just
   removed ours; the warning is harmless but misleading).
   **Suggestion:** scrub the install snippet in the package's
   README / long_description before the next release.

4. **`inspect_plugin` + event-hook ergonomics look right.** Not
   yet adopted in our UI (filed as `PLUGINFORGE-LIFECYCLE-UI-01`)
   but the API surface as read at v0.9.0 looks adequate. The
   `PluginInspection` dataclass + the explicit `activated_at`
   / `last_config_change` / `source` fields are exactly the
   shape a Settings panel would want. No friction surfaced
   from reading the source.

## Migration cost retrospective

Zero new code shipped in this session for the adoption itself —
the residual cleanup was a single one-line pyproject edit
(`extras = ["fastapi"]` removed) and a lock regen. Test baseline
unchanged: 670 passed, 1 skipped.

The reason the cost was zero: every prior PluginForge bump
(^0.7.0 → ^0.8.0 → ^0.9.0) shipped as a "bundled bonus" alongside
unrelated feature work (sync gaps, taxonomy, swipe gestures). The
target_application declarations + app_id parameter landed in v1.7.0
proactively, ahead of the v0.9.0 hard-filter transition. The
ecosystem chose smooth upgrades over a single big adoption push,
which is also why the maintainer's "atomic adoption commit" plan
was the right shape for the original transition but not for a
post-hoc audit.

## Related artefacts

- Pin-cleanup commit: `8a43b36`
- Docs commit (this audit + lessons-learned + backlog):
  the commit that introduces this file
- Lessons-learned addition:
  [.claude/rules/lessons-learned.md](../../.claude/rules/lessons-learned.md)
  § "PluginForge v0.9.0: filtered plugins are NOT load errors"
- Backlog entry: `PLUGINFORGE-LIFECYCLE-UI-01` (P3) in
  [docs/backlog.md](../backlog.md)
- Repository: <https://github.com/astrapi69/pluginforge>
