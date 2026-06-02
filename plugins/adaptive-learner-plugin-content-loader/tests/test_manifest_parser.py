"""Tests for the manifest + lesson parsers
(Phase 43 / EXP-002 / 2C-cache — P-104 + Q-101).
"""

from __future__ import annotations

import json
import textwrap

import pytest
from adaptive_learner_content_loader.exceptions import ContentSchemaError
from adaptive_learner_content_loader.manifest_parser import (
    parse_lesson_json,
    parse_manifest_yaml,
)
from adaptive_learner_content_loader.models import (
    CURRENT_SCHEMA_VERSION,
    is_supported_schema_version,
)


class TestSchemaVersion:
    def test_current_is_1_3(self) -> None:
        # C5: schema bumped 1.2 -> 1.3 for technical/programming content.
        assert CURRENT_SCHEMA_VERSION == "1.3"

    def test_every_1x_minor_is_supported(self) -> None:
        for v in ["1.0", "1.1", "1.2", "1.3", "1.4", "1.0.0", "1.3.2"]:
            assert is_supported_schema_version(v), v

    def test_other_majors_rejected(self) -> None:
        assert not is_supported_schema_version("2.0")
        assert not is_supported_schema_version("0.9")
        assert not is_supported_schema_version("not-a-version")


VALID_MANIFEST = textwrap.dedent(
    """
    schema_version: '1.0'
    name: Adaptive Learner Content Pilot
    description: French A1 plus future sets.
    sets:
      - id: language-fr-a1
        title: French A1
        language: fr
        level: A1
        version: '1.0.0'
        lesson_count: 12
        domain: language
        tags: [beginner, travel]
      - id: language-fr-a2
        title: French A2
        language: fr
        level: A2
        version: '1.0.0'
        lesson_count: 14
    metadata:
      license: CC-BY-SA-4.0
      author: Asterios Raptis
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


# --- Manifest parser ---------------------------------------------------


class TestParseManifestYaml:
    def test_valid_manifest_round_trips(self) -> None:
        manifest = parse_manifest_yaml(VALID_MANIFEST)
        assert manifest.name == "Adaptive Learner Content Pilot"
        assert len(manifest.sets) == 2
        assert manifest.sets[0].id == "language-fr-a1"
        assert manifest.metadata["license"] == "CC-BY-SA-4.0"

    def test_missing_schema_version_defaults_to_current(self) -> None:
        # When the author omits schema_version, the model
        # default of '1.0' applies.
        yaml_no_version = "name: Pilot\nsets: []\n"
        manifest = parse_manifest_yaml(yaml_no_version)
        assert manifest.schema_version == CURRENT_SCHEMA_VERSION

    def test_unsupported_schema_version_rejected_with_friendly_hint(
        self,
    ) -> None:
        future = "schema_version: '2.0'\nname: Future\nsets: []\n"
        with pytest.raises(ContentSchemaError) as exc:
            parse_manifest_yaml(future)
        # The error message names the version + asks the
        # user to upgrade — not a wall of validation errors.
        assert "2.0" in str(exc.value)
        assert "upgrade" in str(exc.value).lower()

    def test_malformed_yaml_caught(self) -> None:
        broken = "name: 'unclosed\nsets: []\n"
        with pytest.raises(ContentSchemaError):
            parse_manifest_yaml(broken)

    def test_non_mapping_rejected(self) -> None:
        # YAML parses fine; the top level is a list, which we
        # reject explicitly.
        with pytest.raises(ContentSchemaError) as exc:
            parse_manifest_yaml("- item1\n- item2\n")
        assert "mapping" in str(exc.value).lower()

    def test_schema_version_must_be_string(self) -> None:
        # YAML 1.0 (no quotes) parses as float, not str.
        # We reject this with a clear message.
        with pytest.raises(ContentSchemaError) as exc:
            parse_manifest_yaml("schema_version: 1.0\nname: x\nsets: []\n")
        assert "string" in str(exc.value).lower()

    def test_pydantic_failures_wrapped(self) -> None:
        # An invalid language code gets caught by the
        # ContentSet validator; the parser wraps the
        # Pydantic error.
        bad = textwrap.dedent(
            """
            schema_version: '1.0'
            name: Bad
            sets:
              - id: x
                title: x
                language: francais
                level: A1
                version: '1.0'
                lesson_count: 1
            """
        ).strip()
        with pytest.raises(ContentSchemaError) as exc:
            parse_manifest_yaml(bad)
        # ``message`` stays short for the toast; the wrapped
        # Pydantic error lands in ``detail`` so the Settings
        # UI can show the author what to fix.
        assert "schema validation" in str(exc.value).lower()
        assert "language" in exc.value.detail.lower()


# --- Lesson parser -----------------------------------------------------


class TestParseLessonJson:
    def test_valid_lesson_round_trips(self) -> None:
        lesson = parse_lesson_json(VALID_LESSON)
        assert lesson.id == "01-greetings"
        assert lesson.title == "Greetings"
        assert len(lesson.cards) == 2
        assert lesson.steps[1].exercise is not None

    def test_malformed_json_caught(self) -> None:
        with pytest.raises(ContentSchemaError) as exc:
            parse_lesson_json("{not valid json")
        assert "json" in str(exc.value).lower()

    def test_non_object_rejected(self) -> None:
        with pytest.raises(ContentSchemaError) as exc:
            parse_lesson_json('["just", "a", "list"]')
        assert "object" in str(exc.value).lower()

    def test_referential_integrity_caught(self) -> None:
        # An exercise references a card that the lesson does
        # not define. The Lesson model_validator catches
        # this; the parser wraps the ValidationError.
        bad = json.loads(VALID_LESSON)
        bad["steps"][1]["exercise"]["card_ids"] = [
            "bonjour",
            "missing-card",
        ]
        with pytest.raises(ContentSchemaError) as exc:
            parse_lesson_json(json.dumps(bad))
        # Wrapped Pydantic ValidationError lands in detail.
        assert "missing-card" in exc.value.detail

    def test_unknown_field_rejected(self) -> None:
        bad = json.loads(VALID_LESSON)
        bad["unknown_field"] = "surprise"
        with pytest.raises(ContentSchemaError):
            parse_lesson_json(json.dumps(bad))
