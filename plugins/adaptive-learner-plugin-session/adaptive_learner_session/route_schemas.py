"""Plugin-local request/response schemas for the session routes (#411).

Extracted from ``routes.py`` so the route module stays thin (routing +
delegation). These are the Pydantic bodies/outputs specific to the session
plugin's endpoints; the shared domain schemas (``LearningSessionOut`` etc.)
still live in ``app.schemas``.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import LearningMethod, LearningSessionOut

from .prompts import MAX_STEP, MIN_STEP


class _StartBody(BaseModel):
    project_id: str = Field(min_length=1)
    method: LearningMethod | None = None
    cycle_step: int = Field(default=1, ge=MIN_STEP, le=MAX_STEP)
    lang: str = "de"
    # Phase 36 Bug 4 — children-side FK back to the imported
    # conversation this session was started from. The router uses
    # it to resume an existing active session for the same
    # conversation instead of always creating a new one.
    imported_conversation_id: str | None = None


class _SessionStartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session: LearningSessionOut
    system_prompt: str


class _SwitchRecommendationOut(BaseModel):
    """Shape of GET /switch-recommendation/{id}.

    ``recommended=False`` means the recommend_method_switch hook
    returned nothing (no recommendation); ``to_method`` and
    ``reason`` are only populated when ``recommended=True``.
    """

    recommended: bool
    to_method: LearningMethod | None = None
    reason: str | None = None


class _SwitchAcceptBody(BaseModel):
    """POST /{id}/switch body. The frontend submits the suggested
    method + reason verbatim from the GET /switch-recommendation
    response; the route records a MethodSwitch audit row and
    updates the live session's method in place.
    """

    to_method: LearningMethod
    reason: str = Field(min_length=1)


class _RatingBody(BaseModel):
    understanding: int = Field(ge=1, le=5)
    stress: int = Field(ge=1, le=5)
    method_fit: int = Field(ge=1, le=5)
    notes: str | None = None


class _EndBody(BaseModel):
    pass


class _SessionEndOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session: LearningSessionOut


class _PronunciationPhraseBody(BaseModel):
    project_id: str
    language: str = "en"
    level: str = "beginner"
    focus: str = "common sounds"
    previous: list[str] = Field(default_factory=list)


class _PronunciationPhraseOut(BaseModel):
    phrase: str
    language: str


class _PronunciationJudgeBody(BaseModel):
    project_id: str
    target: str
    actual: str
    language: str = "en"


class _PronunciationJudgeOut(BaseModel):
    matches: bool
    score: float
    feedback: str
    missed_sounds: list[str]
