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
    MAX_ASSET_SIZE_KB,
    SET_ASSETS_SOFT_LIMIT_KB,
    ContentManifest,
    ContentSet,
    ContentSetAsset,
    check_set_assets_size,
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
        assert s.domain_label is None  # optional, defaults to None

    def test_accepts_optional_domain_label(self) -> None:
        # The content repo ships a human-readable domain_label
        # (e.g. domain=psychology -> domain_label="Psychologie"); the
        # model must accept it. Before this field existed, extra="forbid"
        # rejected the whole manifest and the set download 400'd.
        s = _valid_set(domain="psychology", domain_label="Psychologie")
        assert s.domain == "psychology"
        assert s.domain_label == "Psychologie"

    def test_book_defaults_to_none(self) -> None:
        assert _valid_set().book is None

    def test_accepts_set_level_book(self) -> None:
        # #769 — a set declares a manifest-level book block (the lesson
        # media section auto-inserts it). Before the field existed,
        # extra="forbid" rejected the whole manifest (e.g. psych-intro).
        # ``isbn``/``year`` are tolerated (extra="ignore") but not surfaced.
        s = _valid_set(
            book={
                "title": "Psychologie",
                "author": "Philip Zimbardo",
                "isbn": "978-3868943238",
                "url": "https://www.amazon.de/dp/3868943234/",
            }
        )
        assert s.book is not None
        assert s.book.title == "Psychologie"
        assert s.book.author == "Philip Zimbardo"
        assert s.book.url == "https://www.amazon.de/dp/3868943234/"
        assert not hasattr(s.book, "isbn")

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
        # Valid shapes (legacy ``language`` alias maps to
        # ``target_language``, which carries the validator).
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

    def test_language_alias_maps_to_target_language(self) -> None:
        # Pre-v1.2 ``language`` key is accepted and mapped to
        # ``target_language`` (backward compat).
        s = _valid_set(language="fr")
        assert s.target_language == "fr"
        # The read property mirrors target_language for old
        # call sites still reading ``set.language``.
        assert s.language == "fr"

    def test_source_language_defaults_to_en(self) -> None:
        # Pre-v1.2 content omits source_language entirely; it
        # defaults to English (the pilot explanation language).
        s = _valid_set(language="fr")
        assert s.source_language == "en"

    def test_explicit_language_pair(self) -> None:
        # New v1.2 content declares both directions explicitly.
        s = _valid_set(target_language="fr", source_language="de")
        assert s.target_language == "fr"
        assert s.source_language == "de"
        assert s.language == "fr"  # property still tracks target

    def test_target_language_wins_when_both_keys_present(self) -> None:
        # Defensive: if a manifest carries both the legacy alias
        # and the explicit field, the explicit field wins.
        s = ContentSet.model_validate(
            {
                "id": "fr-a1-from-de",
                "title": "French A1",
                "language": "es",  # legacy alias, should be dropped
                "target_language": "fr",
                "source_language": "de",
                "level": "A1",
                "version": "1.0.0",
                "lesson_count": 10,
            }
        )
        assert s.target_language == "fr"

    def test_source_language_must_be_bcp47(self) -> None:
        with pytest.raises(ValidationError):
            _valid_set(target_language="fr", source_language="deutsch")

    def test_dump_emits_pair_not_legacy_language(self) -> None:
        dumped = _valid_set(target_language="fr", source_language="de").model_dump()
        assert dumped["target_language"] == "fr"
        assert dumped["source_language"] == "de"
        assert "language" not in dumped

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

    def test_assets_default_empty(self) -> None:
        """Phase 54A / v1.37.0 — ContentSet.assets defaults
        to an empty list so existing manifests (no ``assets``
        key) keep validating."""
        assert _valid_set().assets == []

    def test_accepts_valid_assets(self) -> None:
        s = _valid_set(
            assets=[
                {"path": "img/cover.png", "size_kb": 45},
                {"path": "img/scene_1.webp", "size_kb": 120},
            ],
        )
        assert len(s.assets) == 2
        assert s.assets[0].path == "img/cover.png"
        assert s.assets[1].size_kb == 120

    def test_rejects_too_large_asset(self) -> None:
        with pytest.raises(ValidationError):
            _valid_set(
                assets=[
                    {
                        "path": "img/huge.png",
                        "size_kb": MAX_ASSET_SIZE_KB + 1,
                    },
                ],
            )


class TestContentSetAsset:
    def test_minimal_valid(self) -> None:
        asset = ContentSetAsset(path="img/x.png", size_kb=10)
        assert asset.path == "img/x.png"

    def test_rejects_absolute_path(self) -> None:
        with pytest.raises(ValidationError):
            ContentSetAsset(path="/etc/passwd", size_kb=10)

    def test_rejects_parent_dir_traversal(self) -> None:
        with pytest.raises(ValidationError):
            ContentSetAsset(path="../escape.png", size_kb=10)
        with pytest.raises(ValidationError):
            ContentSetAsset(path="img/../escape.png", size_kb=10)

    def test_rejects_unsupported_extension(self) -> None:
        with pytest.raises(ValidationError):
            ContentSetAsset(path="audio/x.mp3", size_kb=10)
        with pytest.raises(ValidationError):
            ContentSetAsset(path="img/animated.gif", size_kb=10)

    def test_accepts_supported_extensions(self) -> None:
        for ext in ("png", "jpg", "jpeg", "webp", "svg"):
            asset = ContentSetAsset(
                path=f"img/x.{ext}",
                size_kb=10,
            )
            assert asset.path.endswith(ext)

    def test_rejects_size_at_zero_or_below(self) -> None:
        with pytest.raises(ValidationError):
            ContentSetAsset(path="img/x.png", size_kb=0)
        with pytest.raises(ValidationError):
            ContentSetAsset(path="img/x.png", size_kb=-1)

    def test_frozen(self) -> None:
        asset = ContentSetAsset(path="img/x.png", size_kb=10)
        with pytest.raises(ValidationError):
            asset.size_kb = 999  # type: ignore[misc]


class TestCheckSetAssetsSize:
    """Phase 54G / v1.37.0 — set-level soft-limit advisory."""

    def _set_with_assets(
        self, paths_and_sizes: list[tuple[str, int]],
    ) -> ContentSet:
        return ContentSet(
            id="language-fr-a1",
            title="French A1",
            language="fr",
            level="A1",
            version="1.0.0",
            lesson_count=10,
            assets=[
                {"path": p, "size_kb": s} for p, s in paths_and_sizes
            ],
        )

    def test_no_warning_when_under_soft_limit(self) -> None:
        s = self._set_with_assets([
            ("img/a.png", 45),
            ("img/b.png", 60),
        ])
        assert check_set_assets_size(s) == []

    def test_assets_total_kb_sums_declared_sizes(self) -> None:
        s = self._set_with_assets([
            ("img/a.png", 45),
            ("img/b.png", 60),
            ("img/c.png", 25),
        ])
        assert s.assets_total_kb() == 130

    def test_warns_above_soft_limit(self) -> None:
        # Use a TINY soft limit so we don't have to declare
        # 10 MiB of fake assets — the helper accepts a custom
        # threshold for exactly this case.
        s = self._set_with_assets([
            ("img/a.png", 100),
            ("img/b.png", 100),
        ])
        warnings = check_set_assets_size(s, soft_limit_kb=150)
        assert len(warnings) == 1
        assert "200 KiB" in warnings[0]
        assert "150 KiB" in warnings[0]

    def test_no_warning_at_exact_soft_limit(self) -> None:
        s = self._set_with_assets([("img/a.png", 100)])
        # 100 KiB == limit → not strictly above, no warning.
        assert check_set_assets_size(s, soft_limit_kb=100) == []

    def test_does_not_raise_on_oversize(self) -> None:
        """Soft limit ≠ hard limit. The validator warns, the
        set still passes."""
        s = self._set_with_assets([
            ("img/a.png", 250),
            ("img/b.png", 250),
        ])
        # No exception, even at 500 KiB declared / 100 KiB
        # soft limit.
        check_set_assets_size(s, soft_limit_kb=100)

    def test_warns_on_excessive_asset_count(self) -> None:
        # Each asset is 1 KiB → well under any size limit.
        # The asset-count check is independent.
        paths = [("img/a-{}.png".format(i), 1) for i in range(101)]
        s = self._set_with_assets(paths)
        warnings = check_set_assets_size(s)
        assert any("101 assets" in w for w in warnings)

    def test_default_soft_limit_uses_constant(self) -> None:
        # Constant lookup, not hard-coded — sanity check.
        assert SET_ASSETS_SOFT_LIMIT_KB == 10 * 1024


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
            "target_language",
            "level",
            "version",
            "lesson_count",
        } <= required
        # ``source_language`` has a default ("en") so it is NOT
        # required, and the legacy ``language`` is a read alias /
        # property, not a serialised field.
        assert "source_language" not in required
        assert "language" not in schema["properties"]

    def test_write_schemas_creates_manifest_and_set(self, tmp_path: Path) -> None:
        # Lesson / card / exercise / step schemas land in
        # commit 3's test_schema_lesson.py — this test pins
        # the manifest + set half of the export contract.
        out = tmp_path / "schemas"
        written = write_schemas(out)
        assert (out / "content-manifest.schema.json").exists()
        assert (out / "content-set.schema.json").exists()
        assert "content-manifest.schema.json" in written
        assert "content-set.schema.json" in written
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
