"""Imports router (Phase 12C + post-v1.5.0 backend-analysis fix).

Two prefixes match the project-wide convention:

  POST   /api/users/{user_id}/imports            -> 201 ImportedConversationOut
  GET    /api/users/{user_id}/imports            -> list[ImportedConversationOut]
  GET    /api/imports/{conversation_id}          -> ImportedConversationDetail
  PATCH  /api/imports/{conversation_id}          -> ImportedConversationOut
  DELETE /api/imports/{conversation_id}          -> 204
  POST   /api/imports/{conversation_id}/analysis -> ImportedConversationDetail
  POST   /api/imports/{conversation_id}/analyze  -> ImportedConversationDetail

``/analysis`` (Phase 12C) accepts an already-computed envelope and
just persists it — used by Dexie mode where the browser ran the
AI call itself. ``/analyze`` (post-v1.5.0) is the API-mode path:
the server decrypts the user's API key, fires the ``ai_complete``
hook, parses the JSON with the same defensive extractor, persists
the result. The browser never sees the cleartext key.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.deps import get_curriculum_repo, get_imports_repo, get_settings_repo
from app.exceptions import ValidationError
from app.repositories.curriculum_repo import CurriculumRepository
from app.repositories.imports_repo import ImportsRepository
from app.repositories.settings_repo import SettingsRepository
from app.schemas import (
    AIProvider,
    CurriculumOut,
    ImportedConversationAnalysis,
    ImportedConversationCreate,
    ImportedConversationDetail,
    ImportedConversationOut,
    ImportedConversationUpdate,
    LearningSessionOut,
)
from app.services import curriculum as curriculum_service
from app.services import imports as imports_service
from app.services import settings as settings_service
from app.services.conversation_analysis import (
    Message,
    analyze_conversation_with_ai,
)

# --- /users/{user_id}/imports ----------------------------------------------

users_imports_router = APIRouter(prefix="/users", tags=["imports"])


@users_imports_router.post(
    "/{user_id}/imports",
    response_model=ImportedConversationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_import(
    user_id: str,
    payload: ImportedConversationCreate,
    repo: ImportsRepository = Depends(get_imports_repo),
) -> ImportedConversationOut:
    """Create an imported conversation for the user."""
    conv = imports_service.create_conversation(repo, user_id, payload)
    return ImportedConversationOut.model_validate(imports_service.to_out_dict(conv))


@users_imports_router.get(
    "/{user_id}/imports",
    response_model=list[ImportedConversationOut],
)
def list_imports(
    user_id: str, repo: ImportsRepository = Depends(get_imports_repo)
) -> list[ImportedConversationOut]:
    """List all imported conversations for the user."""
    return [
        ImportedConversationOut.model_validate(imports_service.to_out_dict(c))
        for c in imports_service.list_conversations(repo, user_id)
    ]


# --- /imports/{conversation_id} --------------------------------------------

imports_router = APIRouter(prefix="/imports", tags=["imports"])


@imports_router.get(
    "/{conversation_id}",
    response_model=ImportedConversationDetail,
)
def get_import(
    conversation_id: str, repo: ImportsRepository = Depends(get_imports_repo)
) -> ImportedConversationDetail:
    """Get an imported conversation with its messages."""
    conv = imports_service.get_conversation(repo, conversation_id, with_messages=True)
    return ImportedConversationDetail.model_validate(imports_service.to_detail_dict(conv))


@imports_router.patch(
    "/{conversation_id}",
    response_model=ImportedConversationOut,
)
def update_import(
    conversation_id: str,
    payload: ImportedConversationUpdate,
    repo: ImportsRepository = Depends(get_imports_repo),
) -> ImportedConversationOut:
    """Update an imported conversation's fields."""
    conv = imports_service.update_conversation(repo, conversation_id, payload)
    return ImportedConversationOut.model_validate(imports_service.to_out_dict(conv))


@imports_router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_import(
    conversation_id: str, repo: ImportsRepository = Depends(get_imports_repo)
) -> Response:
    """Delete an imported conversation."""
    imports_service.delete_conversation(repo, conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@imports_router.get(
    "/{conversation_id}/curriculum",
    response_model=CurriculumOut | None,
)
def get_curriculum_for_import(
    conversation_id: str,
    repo: ImportsRepository = Depends(get_imports_repo),
    curriculum_repo: CurriculumRepository = Depends(get_curriculum_repo),
) -> CurriculumOut | None:
    """Phase 36 Bug 3 — return the curriculum auto-generated from
    this conversation, or ``null`` if none exists. The frontend
    uses this to flip the "Create curriculum" CTA into a "Go to
    curriculum" navigation so users can no longer accidentally
    generate duplicates."""
    # Guard the conversation exists — falls through to
    # NotFoundError handled by the global exception handler.
    imports_service.get_conversation(repo, conversation_id)
    row = curriculum_service.get_curriculum_for_conversation(curriculum_repo, conversation_id)
    if row is None:
        return None
    return CurriculumOut.model_validate(row)


@imports_router.get(
    "/{conversation_id}/active-session",
    response_model=LearningSessionOut | None,
)
def get_active_session_for_import(
    conversation_id: str, repo: ImportsRepository = Depends(get_imports_repo)
) -> LearningSessionOut | None:
    """Phase 36 Bug 4 — return the most recent active session
    started from this conversation, or ``null`` if none exists.
    Lets ImportDetail flip the "Start session" CTA into a
    "Continue session" navigate when there is one already
    running."""
    row = imports_service.get_active_session_for_conversation(repo, conversation_id)
    if row is None:
        return None
    return LearningSessionOut.model_validate(row)


@imports_router.post(
    "/{conversation_id}/analysis",
    response_model=ImportedConversationDetail,
)
def save_analysis(
    conversation_id: str,
    payload: ImportedConversationAnalysis,
    repo: ImportsRepository = Depends(get_imports_repo),
) -> ImportedConversationDetail:
    """Persist a pre-computed AI analysis onto a conversation (Dexie-mode path)."""
    imports_service.save_analysis(repo, conversation_id, payload)
    conv = imports_service.get_conversation(repo, conversation_id, with_messages=True)
    return ImportedConversationDetail.model_validate(imports_service.to_detail_dict(conv))


def _build_ai_caller(
    *,
    model: str,
    api_key: str,
    max_tokens: int = 1500,
):
    """Return a ``(messages) -> str | None`` callable that fires the
    ``ai_complete`` hook against the active provider.

    Lazy ``app.main`` import keeps this router importable from
    test-client contexts that mount only this router without the
    full lifespan.
    """
    from app.main import manager  # lazy: cycle-avoidance + test isolation

    def _call(messages: list[dict[str, str]]) -> str | None:
        result = manager._pm.hook.ai_complete(
            messages=messages,
            model=model,
            api_key=api_key,
            max_tokens=max_tokens,
        )
        return result if isinstance(result, str) else None

    return _call


@imports_router.post(
    "/{conversation_id}/analyze",
    response_model=ImportedConversationDetail,
    summary="Analyze an imported conversation with AI",
    description=(
        "Server-side (API-mode) analysis: decrypts the active provider's key, "
        "runs the AI completion, and persists the extracted topic / level / "
        "vocabulary / error patterns onto the conversation. This is an "
        "AI-credit-burning call and is rate-limited."
    ),
    response_description="The conversation with its AI analysis attached.",
    responses={
        404: {"description": "Conversation not found"},
        502: {"description": "AI provider unreachable"},
        429: {"description": "Rate limit exceeded"},
    },
)
def analyze_import(
    conversation_id: str,
    repo: ImportsRepository = Depends(get_imports_repo),
    settings_repo: SettingsRepository = Depends(get_settings_repo),
) -> ImportedConversationDetail:
    """Server-side conversation analysis.

    Decrypts the user's stored API key, fires ``ai_complete``
    against the active provider, parses the JSON defensively,
    persists the result. The frontend in API mode calls this
    instead of the browser-direct path because cleartext API
    keys never leave the server.
    """
    conv = imports_service.get_conversation(repo, conversation_id, with_messages=True)

    settings = settings_service.get_or_create_settings(settings_repo, conv.user_id)
    provider_key = settings.active_provider
    try:
        provider_enum = AIProvider(provider_key)
    except ValueError as exc:
        raise ValidationError(
            f"User {conv.user_id!r} has no valid active AI provider configured."
        ) from exc

    # Phase 34 — env > secrets.yaml > DB resolution.
    api_key, _source = settings_service.resolve_api_key(settings_repo, conv.user_id, provider_enum)
    if not api_key:
        raise ValidationError(
            f"User {conv.user_id!r} has no stored API key for provider {provider_key!r}."
        )

    override_attr = f"model_override_{provider_key}"
    override = getattr(settings, override_attr, None)
    # Default-models map duplicated from
    # ``adaptive_learner_session.ai_orchestration.DEFAULT_MODELS``
    # to avoid importing a plugin from the backend core. Keep in
    # sync when bumping provider defaults.
    default_models = {
        "anthropic": "claude-haiku-4-5-20251001",
        "openai": "gpt-4o-mini",
        "gemini": "gemini-2.0-flash",
    }
    if isinstance(override, str) and override.strip():
        model: str | None = override.strip()
    else:
        model = default_models.get(provider_key)
    if not model:
        raise ValidationError(f"Provider {provider_key!r} has no default model registered.")

    # Phase 36 Bug 2 — thread the user's display language through so
    # the AI emits free-text fields in DE/ES/FR/etc. instead of always
    # English. Fallback to "de" matches the User.language column
    # default; ``build_system_prompt`` itself clamps unknown codes to
    # English so an exotic value never breaks analysis.
    user = repo.get_user(conv.user_id)
    lang = user.language if user and user.language else "de"

    messages = [Message(role=m.role, content=m.content) for m in conv.messages]
    result = analyze_conversation_with_ai(
        messages,
        ai_complete_call=_build_ai_caller(model=model, api_key=api_key),
        title=conv.title,
        lang=lang,
        # v1.54.0 — import-time language pair sharpens extraction.
        source_language=conv.source_language,
        target_language=conv.target_language,
    )

    imports_service.save_analysis(
        repo,
        conversation_id,
        ImportedConversationAnalysis(analysis_result=result),
    )
    conv = imports_service.get_conversation(repo, conversation_id, with_messages=True)
    return ImportedConversationDetail.model_validate(imports_service.to_detail_dict(conv))
