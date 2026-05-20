"""Adaptive Learner hook specifications (Phase 2).

The 8 hooks below match
``docs/adaptive-learner-project-reference.md`` §6.3 and are the
extension surface every Phase-3+ plugin (assessment, ai-anthropic,
session, tracking, tools, ai-openai, ai-gemini, ...) implements.

Hook-call semantics (per :mod:`pluggy`):

- ``firstresult=False`` (default): all matching plugin implementations
  run; the dispatcher returns the list of non-None results in
  registration order. Used for the "many plugins can contribute"
  hooks — assessment questions, progress summary, tool
  recommendations — and for the side-effect-only on_session_complete.

- ``firstresult=True``: pluggy stops at the first non-None result.
  Used for hooks where exactly one plugin owns the work:
  ``create_session_prompt`` (one prompt per session) and
  ``ai_complete`` (one provider per call).

Payload shape is intentionally ``dict`` / ``list[dict]`` rather than
the Pydantic schemas from :mod:`app.schemas`. Hooks are an
inter-process boundary in spirit (third-party plugins can ship
independently of the core), and a plain-dict contract keeps the
plugin author from importing the full app to satisfy a type hint.
The core router-side caller converts the ORM row to a dict via
``schema.model_dump()`` before invoking the hook.
"""

from __future__ import annotations

import pluggy

hookspec = pluggy.HookspecMarker("adaptive_learner.plugins")


class AdaptiveLearnerHookSpec:
    """The Adaptive Learner extension surface.

    Every method here describes what plugins MAY implement, not
    what they MUST. The core handles its own defaults (empty list,
    no recommendation, etc.) when no plugin claims a hook.
    """

    # --- Assessment ---------------------------------------------------------

    @hookspec
    def get_assessment_questions(self, lang: str) -> list[dict]:
        """Return the questionnaire used to estimate a learner's
        method-weight profile.

        Each question dict carries at minimum::

            {
                "id": "q01",
                "text": "Wenn ich etwas Neues lerne, …",
                "answers": [
                    {"id": "a", "text": "Ich lese erst die Regel.",
                     "weights": {"deductive": 0.6, ...}},
                    ...
                ],
            }

        The ``assessment`` plugin owns this hook in v0.1.0;
        future plugins may stack additional question packs.
        Aggregator merges every plugin's list in registration
        order.
        """
        ...

    @hookspec
    def calculate_profile(self, answers: list[dict]) -> dict:
        """Convert raw answers into a 6-method-weight profile.

        Each answer dict carries ``{"question_id": str,
        "answer_id": str}``. Return shape::

            {
                "deductive":   float in [0.0, 1.0],
                "inductive":   ...,
                "error_based": ...,
                "dialogic":    ...,
                "contextual":  ...,
                "ai_adaptive": ...,
            }

        The session plugin reads the dominant weight to seed the
        first method recommendation; the assessment plugin owns
        the calculation. List-mode dispatch is intentional — a
        future calibration plugin can post-process by reading the
        previous plugin's result via a downstream hook.
        """
        ...

    @hookspec(firstresult=True)
    def create_session_prompt(
        self,
        project: dict,
        profile: dict,
        method: str,
        step: int,
        lang: str,
    ) -> str:
        """Build the system prompt for one learning-cycle step.

        ``project`` is the :class:`LearningProject` row as a dict;
        ``profile`` is the latest :class:`LearningProfile` row;
        ``method`` is one of the six method keys; ``step`` is the
        position in the 7-step cycle (1-based); ``lang`` is the
        user's UI language so the prompt is bilingual without the
        plugin having to call back into i18n.

        ``firstresult=True``: the first plugin to return a non-
        None string wins. The session plugin owns the default
        templates per method+step; a future per-domain plugin can
        intercept and tailor the prompt for, e.g., medicine
        students.
        """
        ...

    # --- AI provider --------------------------------------------------------

    @hookspec(firstresult=True)
    def ai_complete(
        self,
        messages: list[dict],
        model: str,
        api_key: str,
        max_tokens: int | None = None,
    ) -> str:
        """Call the configured AI provider, return the assistant text.

        ``messages`` is an OpenAI-style chat history
        ``[{"role": "user"|"assistant"|"system", "content": str}, …]``;
        ``model`` is the provider-specific model id; ``api_key`` is
        the plaintext key the settings service decrypted from
        ciphertext storage just before this call.

        ``max_tokens`` (v0.5.0 — optional) caps the provider's
        completion length. ``None`` means "use the provider's
        default" (~2048). The Phase 8 step-evaluator uses 256 so
        the JSON-only evaluation call stays cheap.

        ``firstresult=True``: exactly one provider plugin
        (ai-anthropic, ai-openai, ai-gemini, ...) answers per
        call. The settings service routes by
        :attr:`UserSettings.active_provider`; the matching plugin
        recognises its provider tag and returns the completion,
        every other plugin returns ``None`` and pluggy skips
        them.
        """
        ...

    @hookspec(firstresult=True)
    def ai_complete_async(
        self,
        messages: list[dict],
        model: str,
        api_key: str,
        max_tokens: int | None = None,
    ) -> object:
        """Async variant of :meth:`ai_complete` — v1.5.0 / Phase 18B.

        Returns an *awaitable* yielding the same string. Provider
        plugins can implement THIS hook to use async HTTP clients
        (``AsyncAnthropic``, ``AsyncOpenAI``, etc.) so the session
        plugin's parallel-evaluation path (18C) can fan out two
        calls concurrently without a thread pool.

        Backward compatible: providers that DO NOT implement
        ``ai_complete_async`` simply return ``None`` and the
        caller falls back to ``ai_complete`` wrapped in
        ``asyncio.to_thread``. Callers should use the
        :func:`app.services.ai.call_ai_async` helper rather than
        invoking pluggy directly.
        """
        ...

    @hookspec(firstresult=True)
    def ai_complete_stream(
        self,
        messages: list[dict],
        model: str,
        api_key: str,
        max_tokens: int | None = None,
    ) -> object:
        """Streaming variant of :meth:`ai_complete` — v1.6.0 / Phase 19.

        Returns an *async iterator* (or an awaitable resolving to
        one) that yields text deltas as the provider streams them.
        Concatenating every yielded chunk reproduces the complete
        assistant message ``ai_complete`` would have returned.

        ``firstresult=True``: exactly one provider plugin answers
        per call. Providers that DO NOT support streaming simply
        skip this hook; the orchestrator falls back to the
        non-streaming :meth:`ai_complete_async` (and emits the full
        string as one final chunk on the SSE channel) so the route
        contract stays unchanged from the caller's perspective.

        Callers must use the
        :func:`adaptive_learner_session.ai_orchestration.call_ai_complete_stream`
        helper rather than invoking pluggy directly — the helper
        normalises the ``awaitable | iterator`` shape, attaches an
        end-of-stream sentinel, and handles cleanup on the caller's
        early disconnect.
        """
        ...

    # --- Adaptive switching -------------------------------------------------

    @hookspec
    def recommend_method_switch(
        self,
        project_id: str,
        current_method: str,
        recent_ratings: list[dict],
    ) -> dict | None:
        """Decide whether the active method should change.

        ``recent_ratings`` is the last N :class:`SessionRating`
        rows for the project, each
        ``{"understanding": int, "stress": int, "method_fit": int,
        "created_at": str}``. Return shape on a recommendation::

            {
                "to_method":  "<one of the six keys>",
                "reason":     "<human-readable, sent into MethodSwitch.reason>",
                "confidence": float in [0.0, 1.0],
            }

        Return ``None`` when no switch is warranted. List-mode
        dispatch on purpose — multiple plugins (a stagnation
        detector, a fatigue detector, a user-preference layer)
        can vote and a future arbiter plugin can take the
        max-confidence non-None result.
        """
        ...

    # --- Lifecycle ----------------------------------------------------------

    @hookspec
    def on_session_complete(self, session: dict, rating: dict) -> None:
        """Fire after a session lands its end-of-cycle rating.

        Side-effect-only: the tracking plugin writes the
        ProgressCommit row, an analytics plugin pushes telemetry,
        a notification plugin sends a Slack ping, etc. The return
        value is ignored (pluggy still runs every implementation
        even when one returns).

        Errors raised here MUST NOT roll back the session — the
        manager catches per-plugin exceptions and logs them as
        warnings. See ``.claude/rules/code-hygiene.md`` "Error
        handling architecture".
        """
        ...

    # --- Read-side --------------------------------------------------------

    @hookspec
    def get_progress_summary(self, project_id: str) -> dict:
        """Return per-plugin contributions to the dashboard summary.

        Each plugin returns its own slice (history series, stagnation
        signals, week-over-week diff, ...). The aggregator merges
        by top-level dict key; convention: prefix with the plugin
        name to avoid collisions::

            {"tracking": {"sessions_this_week": 5, ...},
             "stagnation": {"flag": false, ...}}
        """
        ...

    @hookspec
    def get_tool_recommendations(self, profile: dict, lang: str) -> list[dict]:
        """Suggested external tools tailored to the user's profile.

        Each recommendation::

            {
                "name":  "Anki",
                "url":   "https://apps.ankiweb.net/",
                "why":   "Spaced repetition for deductive learners.",
                "weight_keys": ["deductive", "error_based"],
            }

        The static ``tools`` plugin emits the v0.1.0 baseline list;
        future plugins can add domain-specific suggestions
        (textbooks, paid courses, …).
        """
        ...


HOOK_NAMES: frozenset[str] = frozenset(
    name for name in vars(AdaptiveLearnerHookSpec) if not name.startswith("_")
)


__all__ = ["AdaptiveLearnerHookSpec", "HOOK_NAMES", "hookspec"]
