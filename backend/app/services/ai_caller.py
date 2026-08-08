"""Shared AI-caller factory for plugin routes.

Resolves a user's active provider, decrypts the API key (env >
secrets.yaml > DB), picks the model (the per-provider override when
set, else the provider default), and returns a
``messages -> str | None`` callable that fires the ``ai_complete``
hook. Consolidates three near-identical copies that previously lived
in the anki / notebooklm / session route modules.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING

from app.exceptions import ValidationError
from app.repositories.settings_repo import SqlAlchemySettingsRepository
from app.schemas import AIProvider
from app.services import settings as settings_service

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

# Provider-key -> cheap-and-fast default model. Kept in sync with
# ``adaptive_learner_session.ai_orchestration.DEFAULT_MODELS``.
DEFAULT_MODELS: dict[str, str] = {
    "anthropic": "claude-haiku-4-5-20251001",
    "openai": "gpt-4o-mini",
    "gemini": "gemini-2.0-flash",
    "perplexity": "sonar-pro",
}

AiCaller = Callable[[list[dict[str, str]]], "str | None"]


def build_ai_caller(db: Session, user_id: str, *, max_tokens: int = 512) -> AiCaller:
    """Build a ``messages -> str | None`` AI caller for a user.

    Resolves the user's active provider, decrypts the API key via the
    env > secrets.yaml > DB chain, and picks the model (the
    per-provider override when set, else the provider default).

    Args:
        db: Request-scoped SQLAlchemy session.
        user_id: Owner of the AI call; the active provider, stored
            key, and per-provider model override are read from this
            user's settings.
        max_tokens: Token cap passed to the ``ai_complete`` hook.

    Returns:
        A callable that takes a chat ``messages`` list and returns the
        assistant text, or ``None`` when the hook yields no string.

    Raises:
        ValidationError: When the user has no valid active provider,
            no stored API key, or the provider has no default model
            registered. The global handler maps this to HTTP 400.
    """
    from app.main import manager  # lazy: cycle-avoidance + test isolation

    repo = SqlAlchemySettingsRepository(db)
    settings = settings_service.get_or_create_settings(repo, user_id)
    provider_key = settings.active_provider
    try:
        provider_enum = AIProvider(provider_key)
    except ValueError as exc:
        raise ValidationError(
            f"User {user_id!r} has no valid active AI provider configured."
        ) from exc

    api_key, _source = settings_service.resolve_api_key(repo, user_id, provider_enum)
    if not api_key:
        raise ValidationError(
            f"User {user_id!r} has no stored API key for provider {provider_key!r}."
        )

    override = getattr(settings, f"model_override_{provider_key}", None)
    if isinstance(override, str) and override.strip():
        model = override.strip()
    else:
        model = DEFAULT_MODELS.get(provider_key) or ""
    if not model:
        raise ValidationError(f"Provider {provider_key!r} has no default model registered.")

    def _call(messages: list[dict[str, str]]) -> str | None:
        result = manager._pm.hook.ai_complete(
            messages=messages, model=model, api_key=api_key, max_tokens=max_tokens
        )
        return result if isinstance(result, str) else None

    return _call
