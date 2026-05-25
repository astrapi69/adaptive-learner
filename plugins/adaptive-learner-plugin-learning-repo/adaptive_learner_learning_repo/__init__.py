"""Adaptive Learner Learning Repository plugin (Phase 42 / BL-30).

Auto-emits per-project Markdown artefacts (``README.md``,
``LEARNING_STATS.md``, ``CHEATSHEET.md``, ``ROADMAP.md`` +
numbered phase folders per topic) from existing DB state, with
an optional ``git init`` + commit-on-render + tag-on-phase-exit
flow under ``~/.local/share/adaptive_learner/repos/{project_id}/``.

Implements the Article-3 "learning repository" pattern from the
*Von Theorie zur Praxis* Medium series (Asterios Raptis):
the in-app learning surface stays the primary tool while the
generated repo becomes the durable, versionable record.

Renderer runs sync-read against the existing models — no AI
calls in the render path.
"""

try:
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("adaptive-learner-plugin-learning-repo")
except PackageNotFoundError:  # pragma: no cover - dist not installed
    __version__ = "0.0.0+unknown"
