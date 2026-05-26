"""Tests for ContentSet / ContentManifest models
(Phase 43 / EXP-002 / 2B — P-101).

These pins cover the validators (slug, BCP-47, semver,
unique set ids), the cross-cutting ``is_supported_schema_version``
helper, and the JSON Schema export.

Real network / cache / route tests come in later commits;
this file is pure-Pydantic.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from adaptive_learner_content_loader.models import (
    CURRENT_SCHEMA_VERSION,
    ContentManifest,
    ContentSet,
    is_supported_schema_version,
)
from adaptive_learner_content_loader.schema_export import (
    manifest_schema,
    set_schema,
    write_schemas,
)


# --- ContentSet ---------------------------------------------------------


def _valid_set(**overrides: object) -> ContentSet:
    defaults: dict[str, object] = {
        "id": "language-fr-a1",
        "title": "French A1",
        "language": "fr",
        "level": "A1",
        "version": "1.0.0",
        "lesson_count": 12,
    }
    defaults.update(overrides)
    return ContentSet(**defaults)


class TestContentSetValidators:
    def test_minimal_valid_set(self) -> None:
        s = _valid_set()
        assert s.id == "language-fr-a1"
        assert s.domain == "language"  # default
        assert s.tags == []

    def test_id_must_be_slug(self) -> None:
        with pytest.raises(ValidationError):
            _valid_set(id="French A1")
        with pytest.raises(ValidationError):
            _valid_set(id="UPPERCASE")
        with pytest.raises(ValidationError):
            _valid_set(id="-leading-hyphen")
        with pytest.raises(ValidationError):
            _valid_set(id="trailing-hyphen-")

    def test_language_must_be_bcp47(self) -> None:
        # Valid shapes
        _valid_set(language="fr")
        _valid_set(language="de-AT")
        _valid_set(language="zh-Hans")
        # Invalid shapes
        with pytest.raises(ValidationError):
            _valid_set(language="francais")
        with pytest.raises(ValidationError):
            _valid_set(language="en_US")  # underscore, not hyphen
        with pytest.raises(ValidationError):
            _valid_set(language="F")

    def test_version_must_be_semver(self) -> None:
        # Permissive — these all pass
        _valid_set(version="1.0")
        _valid_set(version="1.0.0")
        _valid_set(version="2.5.1-rc1")
        _valid_set(version="1.0.0+meta")
        # These fail
        with pytest.raises(ValidationError):
            _valid_set(version="latest")
        with pytest.raises(ValidationError):
            _valid_set(version="v1.0.0")  # leading 'v' is rejected

    def test_lesson_count_must_be_nonneg(self) -> None:
        with pytest.raises(ValidationError):
            _valid_set(lesson_count=-1)
        # Zero is allowed (empty set placeholder)
        s = _valid_set(lesson_count=0)
        assert s.lesson_count == 0

    def test_tags_must_be_slugs(self) -> None:
        s = _valid_set(tags=["beginner", "travel"])
        assert s.tags == ["beginner", "travel"]
        with pytest.raises(ValidationError):
            _valid_set(tags=["Mixed Case"])
        with pytest.raises(ValidationError):
            _valid_set(tags=["space tag"])

    def test_extra_fields_forbidden(self) -> None:
        with pytest.raises(ValidationError):
            ContentSet(
                id="x",
                title="x",
                language="fr",
                level="A1",
                version="1.0",
                lesson_count=1,
                unknown_field="surprise",
            )

    def test_frozen(self) -> None:
        s = _valid_set()
        with pytest.raises(ValidationError):
            s.title = "Tampered"  # type: ignore[misc]


# --- ContentManifest ----------------------------------------------------


class TestContentManifest:
    def test_minimal_manifest(self) -> None:
        m = ContentManifest(name="Adaptive Learner Content Pilot")
        assert m.schema_version == CURRENT_SCHEMA_VERSION
        assert m.sets == []
        assert m.metadata == {}

    def test_with_sets(self) -> None:
        m = ContentManifest(
            name="Pilot",
            sets=[
                _valid_set(id="language-fr-a1"),
                _valid_set(id="language-fr-a2", title="French A2"),
            ],
        )
        assert len(m.sets) == 2

    def test_duplicate_set_id_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ContentManifest(
                name="Bad",
                sets=[
                    _valid_set(id="language-fr-a1"),
                    _valid_set(id="language-fr-a1"),
                ],
            )

    def test_schema_version_must_be_semver(self) -> None:
        with pytest.raises(ValidationError):
            ContentManifest(name="x", schema_version="latest")
        # Numeric semver is fine
        ContentManifest(name="x", schema_version="1.0")
        ContentManifest(name="x", schema_version="2.0.0")

    def test_extra_fields_forbidden(self) -> None:
        with pytest.raises(ValidationError):
            ContentManifest(name="x", unknown_field=42)


# --- Schema-version compatibility helper -------------------------------


class TestIsSupportedSchemaVersion:
    def test_current_version_is_supported(self) -> None:
        assert is_supported_schema_version(CURRENT_SCHEMA_VERSION) is True

    def test_same_major_is_supported(self) -> None:
        # 1.x.y -- all forward-compatible
        assert is_supported_schema_version("1.0") is True
        assert is_supported_schema_version("1.5.3") is True
        assert is_supported_schema_version("1.99.0") is True

    def test_next_major_is_unsupported(self) -> None:
        assert is_supported_schema_version("2.0") is False
        assert is_supported_schema_version("2.0.0") is False

    def test_malformed_version_is_unsupported(self) -> None:
        assert is_supported_schema_version("latest") is False
        assert is_supported_schema_version("v1.0") is False
        assert is_supported_schema_version("") is False


# --- Serialisation round-trip ------------------------------------------


class TestSerialisationRoundTrip:
    def test_set_json_round_trip(self) -> None:
        original = _valid_set(
            tags=["beginner", "travel"],
            description="French A1 pilot",
        )
        revived = ContentSet.model_validate_json(original.model_dump_json())
        assert revived == original

    def test_manifest_json_round_trip(self) -> None:
        original = ContentManifest(
            name="Pilot",
            description="Adaptive Learner pilot content",
            sets=[_valid_set(), _valid_set(id="language-fr-a2", title="A2")],
            metadata={"author": "Asterios Raptis", "license": "CC-BY-SA-4.0"},
        )
        as_dict = original.model_dump()
        revived = ContentManifest.model_validate(as_dict)
        assert revived == original

    def test_partial_unknown_metadata_preserved(self) -> None:
        # Metadata is a free dict, so unknown keys round-trip.
        m = ContentManifest(
            name="x",
            metadata={"homepage": "https://example.com", "stars": 42},
        )
        revived = ContentManifest.model_validate_json(m.model_dump_json())
        assert revived.metadata["homepage"] == "https://example.com"
        assert revived.metadata["stars"] == 42


# --- JSON Schema export ------------------------------------------------


class TestSchemaExport:
    def test_manifest_schema_emits_object(self) -> None:
        schema = manifest_schema()
        assert schema["type"] == "object"
        # Required fields land at the right level
        assert "name" in schema["required"]
        # ``sets`` is an array of ContentSet
        assert schema["properties"]["sets"]["type"] == "array"

    def test_set_schema_emits_required_fields(self) -> None:
        schema = set_schema()
        required = set(schema["required"])
        assert {
            "id",
            "title",
            "language",
            "level",
            "version",
            "lesson_count",
        } <= required

    def test_write_schemas_creates_files(self, tmp_path: Path) -> None:
        out = tmp_path / "schemas"
        written = write_schemas(out)
        assert (out / "content-manifest.schema.json").exists()
        assert (out / "content-set.schema.json").exists()
        # The mapping reflects exactly the files written
        assert set(written.keys()) == {
            "content-manifest.schema.json",
            "content-set.schema.json",
        }
        # Each file is valid JSON
        for path in written.values():
            json.loads(path.read_text(encoding="utf-8"))

    def test_written_schema_matches_in_memory(self, tmp_path: Path) -> None:
        out = tmp_path / "schemas"
        write_schemas(out)
        on_disk = json.loads(
            (out / "content-manifest.schema.json").read_text(encoding="utf-8"),
        )
        assert on_disk == manifest_schema()
