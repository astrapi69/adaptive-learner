"""Identity recovery router (Phase 41A).

Two endpoints serve the post-browser-wipe recovery flow + the
Settings Reset action:

  GET    /api/identity   -> IdentityOut (200) or 404 when no file
  DELETE /api/identity   -> 204

The router is thin: every handler is a one-liner that delegates
to :mod:`app.services.identity_service`. The file lives at
``~/.config/adaptive_learner/identity.yaml`` per the platformdirs
config resolver; full schema + write semantics in the service
docstring.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status

from app.schemas import IdentityOut, IdentityStatusOut
from app.services import identity_service

router = APIRouter(prefix="/identity", tags=["identity"])


@router.get("", response_model=IdentityOut)
def get_identity() -> IdentityOut:
    """Return the persisted identity, or 404 if no file exists.

    The frontend calls this when localStorage is empty and the
    storage mode is API: a hit means "browser was wiped, recover
    from disk"; a 404 means "genuine first visit, show onboarding".
    """
    data = identity_service.load_identity()
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No persisted identity found.",
        )
    return IdentityOut.model_validate(data)


@router.get("/status", response_model=IdentityStatusOut)
def get_identity_status() -> IdentityStatusOut:
    """Return identity-file diagnostics; always 200 (Phase 41D).

    Powers the Settings > About > Identity status panel. Different
    from :func:`get_identity` which 404s when the file is missing -
    this endpoint always returns 200 with ``exists=False`` so the
    UI can show a "Not found" badge alongside the path the file
    would live at, without catching an ApiError.
    """
    data = identity_service.load_identity()
    return IdentityStatusOut(
        exists=data is not None,
        path=str(identity_service.get_identity_path()),
        last_seen=(data or {}).get("last_seen"),
    )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_identity() -> Response:
    """Remove ``identity.yaml``; no-op if already absent.

    Powers the Settings Reset action (Phase 41D / 41F). The
    frontend is responsible for clearing localStorage + reloading
    after this call returns.
    """
    identity_service.clear_identity()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
