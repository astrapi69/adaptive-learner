"""Users router (Phase 1C-B).

POST   /api/users          -> 201 UserOut
GET    /api/users/{id}     -> UserOut (404 on miss)
PATCH  /api/users/{id}     -> UserOut (404 on miss, 409 on email collision)

Thin: every handler is one line of routing + one call into
:mod:`app.services.users`. The service raises
:class:`AdaptiveLearnerError` subclasses; the global handler in
:mod:`app.main` maps each subclass to its HTTP status code.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.deps import get_users_repo
from app.repositories.users_repo import UsersRepository
from app.schemas import UserCreate, UserOut, UserUpdate
from app.services import users as users_service

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate, repo: UsersRepository = Depends(get_users_repo)
) -> UserOut:
    return UserOut.model_validate(users_service.create_user(repo, payload))


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, repo: UsersRepository = Depends(get_users_repo)) -> UserOut:
    return UserOut.model_validate(users_service.get_user(repo, user_id))


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str, payload: UserUpdate, repo: UsersRepository = Depends(get_users_repo)
) -> UserOut:
    return UserOut.model_validate(users_service.update_user(repo, user_id, payload))
