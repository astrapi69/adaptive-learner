"""Adaptive Learner Gamification plugin (Phase 29).

Adds XP (29A), badges (29B), and enhanced streaks (29C) without
touching the core. Subscribes to ``on_session_complete`` plus
direct earn calls from the assessment + import flows, persists
state to ``user_xp`` (29A), ``user_badges`` (29B), and
``user_streaks`` (29C), and exposes read endpoints under
``/api/plugins/gamification/*``.
"""

__version__ = "1.19.1"
