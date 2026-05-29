"""Mission catalog loader (EXP-010 / Phase 56).

Loads + validates ``templates.yaml`` into ``MissionTemplate``
objects once, caching the result. The YAML lives inside the
plugin package (the same convention as the gamification
``badges.yaml`` catalog) and is the canonical authoring surface;
``make sync-missions`` mirrors it to the frontend bundle.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from .schema import MissionTemplate


def _templates_path() -> Path:
    return Path(__file__).resolve().parent / "templates.yaml"


@lru_cache(maxsize=1)
def load_templates() -> tuple[MissionTemplate, ...]:
    """Return the immutable, validated mission catalog."""
    raw = yaml.safe_load(_templates_path().read_text(encoding="utf-8"))
    entries = raw.get("templates", []) if isinstance(raw, dict) else []
    templates = tuple(MissionTemplate.model_validate(entry) for entry in entries)
    _assert_unique_ids(templates)
    return templates


def _assert_unique_ids(templates: tuple[MissionTemplate, ...]) -> None:
    seen: set[str] = set()
    for template in templates:
        if template.id in seen:
            raise ValueError(f"duplicate mission template id: {template.id}")
        seen.add(template.id)


def get_template(template_id: str) -> MissionTemplate | None:
    """Look up a single template by id, or None when unknown."""
    for template in load_templates():
        if template.id == template_id:
            return template
    return None
