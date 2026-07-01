"""Tests for the Content-Engine boundary (EXP-042).

The engine names the source→canonical seam (``single_json_lesson_adapter`` +
``parse_lesson`` / ``parse_manifest``) on top of the low-level parsers in
``manifest_parser``. These tests pin the boundary + the adapter seam; the
underlying parse behaviour is covered by ``test_manifest_parser``.
"""

from __future__ import annotations

import json
import textwrap

import pytest
from adaptive_learner_content_loader.content_engine import (
    parse_lesson,
    parse_manifest,
    single_json_lesson_adapter,
)
from adaptive_learner_content_loader.exceptions import ContentSchemaError
from adaptive_learner_content_loader.schema import Lesson

VALID_MANIFEST = textwrap.dedent(
    """
    schema_version: '1.0'
    name: Adaptive Learner Content Pilot
    sets:
      - id: language-fr-a1
        title: French A1
        language: fr
        level: A1
        version: '1.0.0'
        lesson_count: 12
    """
).strip()

VALID_LESSON = json.dumps(
    {
        "id": "01-greetings",
        "title": "Greetings",
        "estimated_minutes": 12,
        "cards": [
            {"id": "bonjour", "front": "Bonjour", "back": "Hello"},
            {"id": "merci", "front": "Merci", "back": "Thank you"},
        ],
        "steps": [
            {
                "id": "intro",
                "type": "theory",
                "body": "# Greetings\n\nA few common phrases.",
            },
            {
                "id": "ex-1",
                "type": "exercise",
                "exercise": {
                    "id": "ex-1",
                    "type": "matching",
                    "prompt": "Match the French words.",
                    "card_ids": ["bonjour", "merci"],
                    "pairs": [
                        {"left": "Bonjour", "right": "Hello"},
                        {"left": "Merci", "right": "Thank you"},
                    ],
                },
            },
        ],
    },
)


class TestSingleJsonLessonAdapter:
    def test_parses_raw_json_into_canonical_lesson(self) -> None:
        lesson = single_json_lesson_adapter(VALID_LESSON)
        assert isinstance(lesson, Lesson)
        assert lesson.id == "01-greetings"
        assert len(lesson.cards) == 2

    def test_malformed_json_raises_schema_error(self) -> None:
        with pytest.raises(ContentSchemaError):
            single_json_lesson_adapter("{not valid json")


class TestParseLesson:
    def test_default_adapter_is_single_json(self) -> None:
        lesson = parse_lesson(VALID_LESSON)
        assert isinstance(lesson, Lesson)
        assert lesson.title == "Greetings"

    def test_routes_through_a_custom_adapter(self) -> None:
        sentinel = single_json_lesson_adapter(VALID_LESSON)

        def fake_multi_file_adapter(_raw: str) -> Lesson:
            """A stand-in for the future multi-file adapter (EXP-042 §6)."""
            return sentinel

        result = parse_lesson("ignored raw source", adapter=fake_multi_file_adapter)
        assert result is sentinel


class TestParseManifest:
    def test_parses_manifest_yaml(self) -> None:
        manifest = parse_manifest(VALID_MANIFEST)
        assert manifest.name == "Adaptive Learner Content Pilot"
        assert manifest.sets[0].id == "language-fr-a1"

    def test_propagates_schema_error(self) -> None:
        with pytest.raises(ContentSchemaError):
            parse_manifest("- not\n- a\n- mapping\n")
