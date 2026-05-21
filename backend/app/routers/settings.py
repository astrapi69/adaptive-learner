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
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    AIProvider,
    ApiKeySetBody,
    AvailableModelOut,
    SettingsPatchBody,
    UserSettingsOut,
)
from app.services import model_discovery
from app.services import settings as settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/{user_id}", response_model=UserSettingsOut)
def get_settings(user_id: str, db: Session = Depends(get_db)) -> UserSettingsOut:
    return UserSettingsOut.model_validate(settings_service.get_or_create_settings(db, user_id))


@router.patch("/{user_id}", response_model=UserSettingsOut)
def patch_settings(
    user_id: str,
    payload: SettingsPatchBody,
    db: Session = Depends(get_db),
) -> UserSettingsOut:
    return UserSettingsOut.model_validate(settings_service.update_settings(db, user_id, payload))


@router.post("/{user_id}/api-key", response_model=UserSettingsOut)
def set_api_key(
    user_id: str,
    payload: ApiKeySetBody,
    db: Session = Depends(get_db),
) -> UserSettingsOut:
    return UserSettingsOut.model_validate(settings_service.set_api_key(db, user_id, payload))


@router.delete("/{user_id}/api-key/{provider}", response_model=UserSettingsOut)
def delete_api_key(
    user_id: str,
    provider: AIProvider,
    db: Session = Depends(get_db),
) -> UserSettingsOut:
    return UserSettingsOut.model_validate(settings_service.delete_api_key(db, user_id, provider))


@router.get(
    "/{user_id}/available-models",
    response_model=list[AvailableModelOut],
)
def list_available_models(
    user_id: str,
    provider: AIProvider = Query(..., description="Provider to query for available models."),
    db: Session = Depends(get_db),
) -> list[AvailableModelOut]:
    api_key = settings_service.get_decrypted_api_key(db, user_id, provider)
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
