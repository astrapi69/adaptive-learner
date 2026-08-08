"""Content validation router (Phase 60 / v1.44.0, C5b).

``POST /api/content/validate-lesson`` runs the OPT-IN AI content
review in API mode: it resolves the user's AI key server-side
(env > secrets.yaml > DB), fires the ``ai_complete`` hook against
the active provider, and returns the structured review the
frontend renders. Dexie mode does the same browser-direct; this
endpoint exists because cleartext keys never reach the browser in
API mode.

The rule-based validator is the gate (client-side). This layer is
supplementary, so a provider failure surfaces as a normal error
the caller treats as non-fatal.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.deps import get_settings_repo
from app.exceptions import ExternalServiceError, ValidationError
from app.repositories.settings_repo import SettingsRepository
from app.schemas import AIProvider
from app.services import content_validation
from app.services import settings as settings_service

router = APIRouter(prefix="/content", tags=["content"])

# Duplicated from the session plugin's DEFAULT_MODELS to avoid
# importing a plugin from the backend core. Keep in sync when
# bumping provider defaults (same note as routers/imports.py).
_DEFAULT_MODELS = {
    "anthropic": "claude-haiku-4-5-20251001",
    "openai": "gpt-4o-mini",
    "gemini": "gemini-2.0-flash",
    "perplexity": "sonar-pro",
}


class ValidateLessonRequest(BaseModel):
    user_id: str
    title: str
    title_native: str | None = None
    target_language: str
    source_language: str
    level: str
    lessons: list[dict[str, Any]]


class ValidationResultResponse(BaseModel):
    overall: str
    translation_issues: list[dict[str, str]]
    distractor_issues: list[dict[str, str]]
    grammar_issues: list[dict[str, str]]
    level_issues: list[dict[str, str]]
    cultural_flags: list[str]
    quality_score: float


def _resolve_model(provider_key: str, settings: Any) -> str:
    override = getattr(settings, f"model_override_{provider_key}", None)
    if isinstance(override, str) and override.strip():
        return override.strip()
    model = _DEFAULT_MODELS.get(provider_key)
    if not model:
        raise ValidationError(f"Provider {provider_key!r} has no default model.")
    return model


@router.post("/validate-lesson", response_model=ValidationResultResponse)
def validate_lesson(
    body: ValidateLessonRequest,
    repo: SettingsRepository = Depends(get_settings_repo),
) -> ValidationResultResponse:
    """Run the opt-in AI content review for a lesson and return the structured validation result."""
    settings = settings_service.get_or_create_settings(repo, body.user_id)
    provider_key = settings.active_provider
    try:
        provider_enum = AIProvider(provider_key)
    except ValueError as exc:
        raise ValidationError(f"User {body.user_id!r} has no valid active AI provider.") from exc

    api_key, _source = settings_service.resolve_api_key(repo, body.user_id, provider_enum)
    if not api_key:
        raise ValidationError(
            f"User {body.user_id!r} has no API key for provider {provider_key!r}."
        )

    model = _resolve_model(provider_key, settings)
    messages = content_validation.build_validation_messages(
        target_language=body.target_language,
        source_language=body.source_language,
        level=body.level,
        lessons=body.lessons,
    )

    from app.main import manager  # lazy: cycle-avoidance + test isolation

    raw = manager._pm.hook.ai_complete(
        messages=messages,
        model=model,
        api_key=api_key,
        max_tokens=1500,
    )
    if not isinstance(raw, str) or not raw.strip():
        raise ExternalServiceError(provider_key, "no response from AI provider")

    parsed = content_validation.parse_validation_result(raw)
    if parsed is None:
        raise ExternalServiceError(provider_key, "AI response was not valid JSON")
    return ValidationResultResponse(**parsed)
