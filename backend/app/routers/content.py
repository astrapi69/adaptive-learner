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
from app.repositories.settings_repo import SettingsRepository
from app.services import content_validation
from app.services.ai_caller import caller_for, resolve_ai_target

router = APIRouter(prefix="/content", tags=["content"])


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


@router.post("/validate-lesson", response_model=ValidationResultResponse)
def validate_lesson(
    body: ValidateLessonRequest,
    repo: SettingsRepository = Depends(get_settings_repo),
) -> ValidationResultResponse:
    """Run the opt-in AI content review for a lesson and return the structured validation result."""
    target = resolve_ai_target(repo, body.user_id)
    review = content_validation.review_lesson(
        caller_for(target, max_tokens=1500),
        target.provider_key,
        target_language=body.target_language,
        source_language=body.source_language,
        level=body.level,
        lessons=body.lessons,
    )
    return ValidationResultResponse(**review)
