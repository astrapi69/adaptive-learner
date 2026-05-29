"""Mission catalog schema (EXP-010 / Phase 56 / P-156).

``MissionTemplate`` is the typed shape of a single entry in the
static mission catalog (``templates.yaml``). It is config, NOT a
DB table - only the per-user assignment (``UserMission``) is
persisted. The frontend mirrors this shape in TypeScript and
loads the same catalog from a bundled JSON (``make sync-missions``).
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class MissionDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class MissionCategory(str, Enum):
    LEARNING = "learning"
    REVIEW = "review"
    MASTERY = "mastery"
    EXPLORATION = "exploration"
    STREAK = "streak"


class MissionTemplate(BaseModel):
    """A single daily-mission template from the catalog."""

    id: str = Field(min_length=1, max_length=100)
    title_key: str = Field(min_length=1)
    description_key: str = Field(min_length=1)
    category: MissionCategory
    target_value: int = Field(gt=0)
    difficulty: MissionDifficulty
    xp_reward: int = Field(ge=0)
    icon: str = Field(min_length=1)
    # Name of the progress predicate evaluated against existing
    # learning data (see the generator's check_progress).
    check_function: str = Field(min_length=1)
