"""Imports router (Phase 12C).

Two prefixes match the project-wide convention:

  POST   /api/users/{user_id}/imports            -> 201 ImportedConversationOut
  GET    /api/users/{user_id}/imports            -> list[ImportedConversationOut]
  GET    /api/imports/{conversation_id}          -> ImportedConversationDetail
  PATCH  /api/imports/{conversation_id}          -> ImportedConversationOut
  DELETE /api/imports/{conversation_id}          -> 204
  POST   /api/imports/{conversation_id}/analysis -> ImportedConversationDetail

The analysis is computed client-side (browser-direct AI provider
call), then POSTed back here for persistence. The server validates
the envelope but does not prescribe the inner schema.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    ImportedConversationAnalysis,
    ImportedConversationCreate,
    ImportedConversationDetail,
    ImportedConversationOut,
    ImportedConversationUpdate,
)
from app.services import imports as imports_service

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
    db: Session = Depends(get_db),
) -> ImportedConversationOut:
    conv = imports_service.create_conversation(db, user_id, payload)
    return ImportedConversationOut.model_validate(imports_service.to_out_dict(conv))


@users_imports_router.get(
    "/{user_id}/imports",
    response_model=list[ImportedConversationOut],
)
def list_imports(
    user_id: str, db: Session = Depends(get_db)
) -> list[ImportedConversationOut]:
    return [
        ImportedConversationOut.model_validate(imports_service.to_out_dict(c))
        for c in imports_service.list_conversations(db, user_id)
    ]


# --- /imports/{conversation_id} --------------------------------------------

imports_router = APIRouter(prefix="/imports", tags=["imports"])


@imports_router.get(
    "/{conversation_id}",
    response_model=ImportedConversationDetail,
)
def get_import(
    conversation_id: str, db: Session = Depends(get_db)
) -> ImportedConversationDetail:
    conv = imports_service.get_conversation(db, conversation_id, with_messages=True)
    return ImportedConversationDetail.model_validate(
        imports_service.to_detail_dict(conv)
    )


@imports_router.patch(
    "/{conversation_id}",
    response_model=ImportedConversationOut,
)
def update_import(
    conversation_id: str,
    payload: ImportedConversationUpdate,
    db: Session = Depends(get_db),
) -> ImportedConversationOut:
    conv = imports_service.update_conversation(db, conversation_id, payload)
    return ImportedConversationOut.model_validate(imports_service.to_out_dict(conv))


@imports_router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_import(
    conversation_id: str, db: Session = Depends(get_db)
) -> Response:
    imports_service.delete_conversation(db, conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@imports_router.post(
    "/{conversation_id}/analysis",
    response_model=ImportedConversationDetail,
)
def save_analysis(
    conversation_id: str,
    payload: ImportedConversationAnalysis,
    db: Session = Depends(get_db),
) -> ImportedConversationDetail:
    imports_service.save_analysis(db, conversation_id, payload)
    conv = imports_service.get_conversation(db, conversation_id, with_messages=True)
    return ImportedConversationDetail.model_validate(
        imports_service.to_detail_dict(conv)
    )
