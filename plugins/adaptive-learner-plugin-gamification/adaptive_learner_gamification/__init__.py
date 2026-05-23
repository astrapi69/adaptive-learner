"""Adaptive Learner Gamification plugin (Phase 29).

Adds XP (29A), badges (29B), and enhanced streaks (29C) without
touching the core. Subscribes to ``on_session_complete`` plus
direct earn calls from the assessment + import flows, persists
state to ``user_xp`` (29A), ``user_badges`` (29B), and
``user_streaks`` (29C), and exposes read endpoints under
``/api/plugins/gamification/*``.
"""

try:
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("adaptive-learner-plugin-gamification")
except PackageNotFoundError:  # pragma: no cover - dist not installed
    __version__ = "0.0.0+unknown"
