"""Phase 2 tests for app.hookspecs + main.py hookspec registration.

Pins three contracts:

1. The spec class exposes all 8 hooks from the project plan.
2. The two ``firstresult=True`` hooks (``create_session_prompt`` +
   ``ai_complete``) carry that flag.
3. The PluginManager in :mod:`app.main` has registered every hook
   so plugins can implement them without an "unknown hook"
   surprise at activate time.
"""

from __future__ import annotations

import inspect

import pytest

from app.hookspecs import HOOK_NAMES, AdaptiveLearnerHookSpec

EXPECTED_HOOKS: frozenset[str] = frozenset(
    {
        "get_assessment_questions",
        "calculate_profile",
        "create_session_prompt",
        "ai_complete",
        "recommend_method_switch",
        "on_session_complete",
        "get_progress_summary",
        "get_tool_recommendations",
    }
)

FIRSTRESULT_HOOKS: frozenset[str] = frozenset({"create_session_prompt", "ai_complete"})


# --- Spec-class shape -------------------------------------------------------


def test_hookspec_class_carries_all_8_hooks():
    declared = {
        name
        for name, attr in vars(AdaptiveLearnerHookSpec).items()
        if not name.startswith("_") and callable(attr)
    }
    assert declared == EXPECTED_HOOKS, (
        f"Missing: {sorted(EXPECTED_HOOKS - declared)}; "
        f"unexpected: {sorted(declared - EXPECTED_HOOKS)}"
    )


def test_hook_names_export_matches():
    """The exported HOOK_NAMES constant is the canonical name list
    other modules / tests can introspect against."""
    assert HOOK_NAMES == EXPECTED_HOOKS


@pytest.mark.parametrize("hook_name", sorted(EXPECTED_HOOKS))
def test_every_hook_is_decorated_as_hookspec(hook_name: str):
    """pluggy's ``HookspecMarker`` attaches an ``adaptive_learner_spec``
    attribute (named after the project group) carrying the opts
    dict. Catches a future copy-paste where someone adds a method
    but forgets the ``@hookspec`` decorator."""
    fn = getattr(AdaptiveLearnerHookSpec, hook_name)
    # pluggy stores its spec opts on the function attribute
    # ``adaptive_learner.plugins_spec`` (project name + "_spec").
    spec_attr = "adaptive_learner.plugins_spec"
    assert hasattr(fn, spec_attr), (
        f"{hook_name!r} is not decorated with @hookspec — pluggy "
        f"will not dispatch to plugin implementations."
    )


@pytest.mark.parametrize("hook_name", sorted(FIRSTRESULT_HOOKS))
def test_firstresult_hooks_have_the_flag(hook_name: str):
    fn = getattr(AdaptiveLearnerHookSpec, hook_name)
    spec_opts = getattr(fn, "adaptive_learner.plugins_spec")
    assert spec_opts.get("firstresult") is True, (
        f"{hook_name!r} must declare firstresult=True so pluggy "
        f"stops at the first non-None plugin response."
    )


@pytest.mark.parametrize("hook_name", sorted(EXPECTED_HOOKS - FIRSTRESULT_HOOKS))
def test_non_firstresult_hooks_default_to_list_dispatch(hook_name: str):
    fn = getattr(AdaptiveLearnerHookSpec, hook_name)
    spec_opts = getattr(fn, "adaptive_learner.plugins_spec")
    # Either the flag is absent OR explicitly False; both mean
    # pluggy returns the list of every plugin's non-None result.
    assert not spec_opts.get("firstresult"), (
        f"{hook_name!r} must NOT declare firstresult=True; the "
        f"project plan expects list-mode dispatch so multiple "
        f"plugins can contribute."
    )


# --- Signatures match the project plan -------------------------------------

EXPECTED_SIGNATURES: dict[str, list[str]] = {
    "get_assessment_questions": ["self", "lang"],
    "calculate_profile": ["self", "answers"],
    "create_session_prompt": ["self", "project", "profile", "method", "step", "lang"],
    # v0.5.0 (Phase 8B): ``max_tokens`` is an optional kwarg with
    # a sensible default at the provider layer. Required for the
    # dual-prompt step-evaluator's 256-token cap.
    "ai_complete": ["self", "messages", "model", "api_key", "max_tokens"],
    "recommend_method_switch": ["self", "project_id", "current_method", "recent_ratings"],
    "on_session_complete": ["self", "session", "rating"],
    "get_progress_summary": ["self", "project_id"],
    "get_tool_recommendations": ["self", "profile", "lang"],
}


@pytest.mark.parametrize("hook_name", sorted(EXPECTED_HOOKS))
def test_hook_signature_matches_project_plan(hook_name: str):
    fn = getattr(AdaptiveLearnerHookSpec, hook_name)
    params = list(inspect.signature(fn).parameters)
    assert params == EXPECTED_SIGNATURES[hook_name], (
        f"{hook_name!r} signature drift vs project plan §6.3.\n"
        f"  Expected: {EXPECTED_SIGNATURES[hook_name]}\n"
        f"  Actual:   {params}"
    )


# --- Registration in the production PluginManager --------------------------


def test_app_main_pluginmanager_has_all_hooks_registered():
    """``app.main`` calls ``manager.register_hookspecs(
    AdaptiveLearnerHookSpec)`` at module import time. After that,
    every hook must be reachable via the pluggy hook namespace.
    """
    # Late import: registration happens at module load, this just
    # observes the side-effect.
    from app.main import manager

    pm_hook = manager._pm.hook  # pluginforge wraps pluggy as _pm
    for name in EXPECTED_HOOKS:
        assert hasattr(pm_hook, name), (
            f"Hook {name!r} not registered on the production "
            f"PluginManager — app.main.register_hookspecs is broken."
        )


def test_app_main_pluginmanager_does_not_carry_legacy_hooks():
    """Negative pin: the Phase-1A scaffold's empty class no longer
    leaks hooks from earlier prototypes (export_formats,
    chapter_pre_save, etc., which used to live here)."""
    from app.main import manager

    legacy = {
        "export_formats",
        "export_execute",
        "chapter_pre_save",
        "content_pre_import",
    }
    pm_hook = manager._pm.hook
    for name in legacy:
        assert not hasattr(pm_hook, name), (
            f"Legacy Bibliogon hook {name!r} resurfaced; check for "
            f"a stray scaffold in app.hookspecs."
        )
