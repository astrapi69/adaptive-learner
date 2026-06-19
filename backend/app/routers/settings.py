"""Settings router (Phase 1C-D, extended in v1.11.0 / Phase 24A).

  GET    /api/settings/{user_id}                          -> UserSettingsOut
  PATCH  /api/settings/{user_id}                          -> UserSettingsOut
  POST   /api/settings/{user_id}/api-key                  -> UserSettingsOut
  DELETE /api/settings/{user_id}/api-key/{provider}       -> UserSettingsOut
  GET    /api/settings/{user_id}/available-models         -> list[AvailableModelOut]

GET auto-creates an empty settings row on first access (the user
must already exist; missing user returns 404). PATCH spans
UserSettings + User (active_provider + language). The two api-key
endpoints encrypt / clear; the bare PATCH cannot touch api keys.

``available-models`` decrypts the stored api key for the requested
provider and forwards it to the provider's models endpoint;
results are cached for one hour to avoid hammering upstream on
every Settings focus event.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.deps import get_settings_repo
from app.repositories.settings_repo import SettingsRepository
from app.schemas import (
    AIProvider,
    ApiKeyBackupBody,
    ApiKeyBackupInfoOut,
    ApiKeySetBody,
    ApiKeySource,
    ApiKeyTestBody,
    ApiKeyTestOut,
    AvailableModelOut,
    SettingsPatchBody,
    UserSettingsOut,
)
from app.services import api_key_test, model_discovery
from app.services import settings as settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


def _build_settings_out(repo: SettingsRepository, settings) -> UserSettingsOut:
    """Wrap the ORM row + per-provider key-source attribution into
    a ``UserSettingsOut``.

    Phase 34 (v1.20.0) — every response path that returns
    ``UserSettingsOut`` goes through here so the UI sees consistent
    ``key_source_*`` values whether the caller hit GET, PATCH,
    POST /api-key, or DELETE /api-key/{provider}.
    """
    out = UserSettingsOut.model_validate(settings)
    # The key now lives in secrets.yaml (env > yaml > DB), so the
    # has_<provider>_key flags + source must come from the resolver,
    # not just the DB column (which model_validate read).
    for provider, source_attr, has_attr, preview_attr in (
        (AIProvider.ANTHROPIC, "key_source_anthropic", "has_anthropic_key", "key_preview_anthropic"),
        (AIProvider.OPENAI, "key_source_openai", "has_openai_key", "key_preview_openai"),
        (AIProvider.GEMINI, "key_source_gemini", "has_gemini_key", "key_preview_gemini"),
    ):
        source = settings_service.detect_api_key_source(repo, settings.user_id, provider)
        setattr(out, source_attr, source)
        setattr(out, has_attr, source != ApiKeySource.NONE)
        # #810 — masked preview so the Settings provider overview can show
        # WHICH key is stored. Never exposes the decrypted value.
        setattr(out, preview_attr, settings_service.resolve_key_preview(repo, settings.user_id, provider))
    return out


@router.get("/{user_id}", response_model=UserSettingsOut)
def get_settings(
    user_id: str, repo: SettingsRepository = Depends(get_settings_repo)
) -> UserSettingsOut:
    return _build_settings_out(repo, settings_service.get_or_create_settings(repo, user_id))


@router.patch("/{user_id}", response_model=UserSettingsOut)
def patch_settings(
    user_id: str,
    payload: SettingsPatchBody,
    repo: SettingsRepository = Depends(get_settings_repo),
) -> UserSettingsOut:
    return _build_settings_out(repo, settings_service.update_settings(repo, user_id, payload))


@router.post(
    "/{user_id}/api-key",
    response_model=UserSettingsOut,
    summary="Save an AI provider API key",
    description=(
        "Stores an API key for the given provider (anthropic / openai / "
        "gemini). The key is Fernet-encrypted at rest; AI calls then resolve "
        "it through the three-layer chain (env > secrets.yaml > DB). Returns "
        "the updated settings with the per-provider `key_source` so the UI "
        "can show where the active key comes from."
    ),
    response_description="The updated user settings (with key source flags).",
    responses={
        404: {"description": "User not found"},
        422: {"description": "Invalid provider or malformed key"},
        429: {"description": "Rate limit exceeded"},
    },
)
def set_api_key(
    user_id: str,
    payload: ApiKeySetBody,
    repo: SettingsRepository = Depends(get_settings_repo),
) -> UserSettingsOut:
    return _build_settings_out(repo, settings_service.set_api_key(repo, user_id, payload))


@router.delete("/{user_id}/api-key/{provider}", response_model=UserSettingsOut)
def delete_api_key(
    user_id: str,
    provider: AIProvider,
    repo: SettingsRepository = Depends(get_settings_repo),
) -> UserSettingsOut:
    return _build_settings_out(repo, settings_service.delete_api_key(repo, user_id, provider))


@router.post("/{user_id}/test-api-key", response_model=ApiKeyTestOut)
def test_api_key(
    user_id: str,
    payload: ApiKeyTestBody,
    repo: SettingsRepository = Depends(get_settings_repo),
) -> ApiKeyTestOut:
    # Test the caller-supplied key when given (the pre-save check),
    # otherwise resolve the user's configured key (env > secrets.yaml
    # > DB) and test that. Never saves anything.
    key = payload.key
    if not key:
        key, _source = settings_service.resolve_api_key(repo, user_id, payload.provider)
    result = api_key_test.test_api_key(payload.provider, key)
    return ApiKeyTestOut(success=result.success, kind=result.kind)


@router.post("/{user_id}/api-key-backup", response_model=UserSettingsOut)
def backup_api_key(
    user_id: str,
    payload: ApiKeyBackupBody,
    repo: SettingsRepository = Depends(get_settings_repo),
) -> UserSettingsOut:
    # Cache a tested-good key as the last-known-good backup. The
    # caller (save flow) invokes this only after a successful test.
    settings_service.backup_api_key(repo, user_id, payload.provider, payload.key)
    return _build_settings_out(repo, settings_service.get_or_create_settings(repo, user_id))


@router.get(
    "/{user_id}/api-key-backup/{provider}",
    response_model=ApiKeyBackupInfoOut,
)
def get_api_key_backup_info(
    user_id: str,
    provider: AIProvider,
    repo: SettingsRepository = Depends(get_settings_repo),
) -> ApiKeyBackupInfoOut:
    backup = settings_service.get_api_key_backup(repo, user_id, provider)
    if backup is None:
        return ApiKeyBackupInfoOut(has=False, tested_at=None)
    return ApiKeyBackupInfoOut(has=True, tested_at=backup.tested_at)


@router.post(
    "/{user_id}/api-key-backup/{provider}/restore",
    response_model=UserSettingsOut,
)
def restore_api_key_backup(
    user_id: str,
    provider: AIProvider,
    repo: SettingsRepository = Depends(get_settings_repo),
) -> UserSettingsOut:
    # NotFoundError (no backup) maps to 404 via the global handler.
    return _build_settings_out(
        repo, settings_service.restore_api_key_backup(repo, user_id, provider)
    )


@router.get(
    "/{user_id}/available-models",
    response_model=list[AvailableModelOut],
)
def list_available_models(
    user_id: str,
    provider: AIProvider = Query(..., description="Provider to query for available models."),
    repo: SettingsRepository = Depends(get_settings_repo),
) -> list[AvailableModelOut]:
    # Phase 34 — resolve via env > secrets.yaml > DB so the
    # model picker works for desktop users whose key lives in
    # ``~/.config/adaptive_learner/secrets.yaml``.
    api_key, _source = settings_service.resolve_api_key(repo, user_id, provider)
    if not api_key:
        return []
    models = model_discovery.fetch_models(provider, api_key)
    return [
        AvailableModelOut(
            id=model.id,
            name=model.name,
            context_window=model.context_window,
            description=model.description,
        )
        for model in models
    ]
