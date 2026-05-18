"""Adaptive Learner tracking plugin (Phase 3-D).

Two responsibilities:

1. **Persist ProgressCommits.** Subscribes to the
   ``on_session_complete`` hook the session plugin fires from
   POST ``/end``; converts the session + rating dicts into a
   :class:`ProgressCommit` row. Per-session timing comes from the
   session's started_at / ended_at; method/topic from the
   session; understanding / stress from the rating (rescaled from
   the 1-5 user scale to a 0.0-1.0 float).

2. **Dashboard summary aggregator.** Implements
   ``get_progress_summary`` (list-mode dispatch) and a
   GET ``/api/plugins/tracking/progress/{project_id}`` route that
   returns per-plugin slices namespaced under the plugin's name —
   a future analytics plugin can stack on the same response shape
   without colliding with this one.

The plugin also exposes GET ``/api/plugins/tracking/commits/{project_id}``
for the "git-style log" the project plan calls out (§3.3) — the
dashboard can show the raw commit history alongside the
aggregated view.
"""

try:
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("adaptive-learner-plugin-tracking")
except PackageNotFoundError:  # pragma: no cover - dist not installed
    __version__ = "0.0.0+unknown"
# Rescale 1-5 user-rating ints to 0.0-1.0 floats so the
# ProgressCommit columns (Float) stay in the unit interval like
# the other 6-method-weight floats elsewhere in the schema.
RATING_SCALE = 5.0
