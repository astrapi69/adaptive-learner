"""Settings router (Phase 1C-D).

  GET    /api/settings/{user_id}                       -> UserSettingsOut
  PATCH  /api/settings/{user_id}                       -> UserSettingsOut
  POST   /api/settings/{user_id}/api-key               -> UserSettingsOut
  DELETE /api/settings/{user_id}/api-key/{provider}    -> UserSettingsOut

GET auto-creates an empty settings row on first access (the user
must already exist; missing user returns 404). PATCH spans
UserSettings + User (active_provider + language). The two api-key
endpoints encrypt / clear; the bare PATCH cannot touch api keys.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    AIProvider,
    ApiKeySetBody,
    SettingsPatchBody,
    UserSettingsOut,
)
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
