"""Adaptive Learner session plugin (Phase 3-C).

Owns three concerns:

1. **The 7-step learning cycle.** The session router lifecycle:
   POST ``/start`` opens a LearningSession; POST ``/{id}/message``
   stores chat history; POST ``/{id}/rate`` records the
   end-of-session SessionRating; POST ``/{id}/end`` closes the
   session and fires the ``on_session_complete`` hook.

2. **Per-method × per-step system prompts.** The hookimpl
   ``create_session_prompt(project, profile, method, step, lang)``
   composes a method-core + step-modifier + project context. Six
   method cores × seven step modifiers × two languages = 84
   template fragments; bundled here so plugins / clients never
   import the prompt strings out of band.

3. **Stagnation-based method switching.** The hookimpl
   ``recommend_method_switch(project_id, current_method,
   recent_ratings)`` returns a dict when the last three
   SessionRatings show no understanding improvement AND elevated
   stress (the v0.1.0 rule from project-reference.md §12). Multiple
   plugins can vote in parallel (list-mode dispatch); a future
   arbiter takes the max-confidence non-None result.
"""

try:
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("adaptive-learner-plugin-session")
except PackageNotFoundError:  # pragma: no cover - dist not installed
    __version__ = "0.0.0+unknown"
