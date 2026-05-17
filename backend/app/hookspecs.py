"""Adaptive Learner hook specifications.

Skeleton state (Phase 1A): empty class. The new hooks
(``get_assessment_questions``, ``calculate_profile``,
``create_session_prompt``, ``ai_complete``,
``recommend_method_switch``, ``on_session_complete``,
``get_progress_summary``, ``get_tool_recommendations``) land in
Phase 2 once the domain models they reference are defined.

The class is registered with the :class:`pluginforge.PluginManager`
at startup; an empty hookspec set is valid — pluggy simply has no
hooks to dispatch.
"""

import pluggy

hookspec = pluggy.HookspecMarker("adaptive_learner.plugins")


class AdaptiveLearnerHookSpec:
    """Hook specifications for Adaptive Learner plugins.

    Empty in Phase 1A. Hooks are added in Phase 2.
    """
