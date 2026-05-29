"""FastAPI routes for the missions plugin (EXP-010 / Phase 56).

  GET /api/plugins/missions/templates

The assignment + progress endpoints (POST /assign, GET
/today/{user_id}) land in 56C alongside the generator service.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from .catalog import load_templates

router = APIRouter(prefix="/plugins/missions", tags=["missions"])


@router.get("/templates")
def get_templates() -> list[dict[str, Any]]:
    """Return the full static mission catalog."""
    return [template.model_dump(mode="json") for template in load_templates()]
