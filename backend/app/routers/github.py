"""GitHub integration router (community PR automation).

  GET    /api/github/token          -> GitHubTokenStatusOut
  POST   /api/github/token          -> GitHubTokenStatusOut   (store)
  DELETE /api/github/token          -> GitHubTokenStatusOut   (clear)
  POST   /api/github/verify-token   -> GitHubVerifyOut
  POST   /api/github/create-pr      -> GitHubCreatePrOut

The token (a GitHub Personal Access Token, ``repo`` scope) is stored
Fernet-encrypted in secrets.yaml and never returned to the browser.
``create-pr`` is the API-mode proxy: it reads the stored token and runs
the fork -> branch -> commit -> PR flow server-side, so the token stays
on the backend. The Dexie-mode (GitHub Pages) build runs the equivalent
flow browser-direct with the token held in the browser.

Thin handlers — all logic lives in
:mod:`app.services.github_service`. ``ValidationError`` /
``ExternalServiceError`` raised there map to 400 / 502 via the global
exception handler.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas import (
    GitHubCreatePrBody,
    GitHubCreatePrOut,
    GitHubTokenSetBody,
    GitHubTokenStatusOut,
    GitHubVerifyBody,
    GitHubVerifyOut,
)
from app.services import github_service, secrets_service

router = APIRouter(prefix="/github", tags=["github"])


def _status() -> GitHubTokenStatusOut:
    source = github_service.token_source()
    return GitHubTokenStatusOut(configured=source != "none", source=source)


@router.get("/token", response_model=GitHubTokenStatusOut)
def get_token_status() -> GitHubTokenStatusOut:
    return _status()


@router.post("/token", response_model=GitHubTokenStatusOut)
def set_token(payload: GitHubTokenSetBody) -> GitHubTokenStatusOut:
    secrets_service.write_github_token(payload.token)
    return _status()


@router.delete("/token", response_model=GitHubTokenStatusOut)
def clear_token() -> GitHubTokenStatusOut:
    secrets_service.clear_github_token()
    return _status()


@router.post("/verify-token", response_model=GitHubVerifyOut)
def verify_token(payload: GitHubVerifyBody) -> GitHubVerifyOut:
    token = payload.token or github_service.resolve_token()
    result = github_service.verify_token(token)
    return GitHubVerifyOut(valid=result.valid, username=result.username, kind=result.kind)


@router.post("/create-pr", response_model=GitHubCreatePrOut)
def create_pr(payload: GitHubCreatePrBody) -> GitHubCreatePrOut:
    token = github_service.resolve_token()
    manifest_update = None
    if payload.manifest_update is not None:
        manifest_update = github_service.ManifestUpdate(
            set_path=payload.manifest_update.set_path,
            lesson_filename=payload.manifest_update.lesson_filename,
        )
    result = github_service.create_lesson_pr(
        token or "",
        github_service.LessonPrRequest(
            upstream=payload.upstream,
            base_branch=payload.base_branch,
            branch_name=payload.branch_name,
            file_path=payload.file_path,
            file_content=payload.file_content,
            commit_message=payload.commit_message,
            pr_title=payload.pr_title,
            pr_body=payload.pr_body,
            manifest_update=manifest_update,
        ),
    )
    return GitHubCreatePrOut(
        url=result.url,
        number=result.number,
        manifest_updated=result.manifest_updated,
    )
