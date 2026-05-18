"""Adaptive Learner tools plugin (Phase 3-E).

Implements ``get_tool_recommendations(profile, lang) -> list[dict]``
(list-mode dispatch — multiple plugins can stack their own static
catalogues) and exposes one read route::

    GET /api/plugins/tools/recommendations/{project_id}?lang=…

The recommendation algorithm is intentionally simple in v0.1.0:
each catalog entry carries a ``weight_keys`` list (the method
keys it best serves); the score for a user is the sum of their
profile weights across those keys. Higher score = more relevant.
A future v0.2.0 plugin can stack a paid-course catalogue on the
same hook without touching this one — the dashboard aggregates
across plugins.
"""

__version__ = "0.3.0"
