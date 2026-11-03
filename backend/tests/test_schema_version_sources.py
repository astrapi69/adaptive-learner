"""Each schema version number comes from the mirror that defines it (#3835).

``CURRENT_SCHEMA_VERSION = "1.9"`` stood for three different numbers and was
right for none of them: the manifest ``schema_version`` the API-mode writers
declare (the mirror's default is ``1.7``), the lesson ``x-schema-version`` the
developer page and the derived schemas name (``1.20`` since engine 0.42.2),
and the default for a manifest without a version. The browser path already
reads the manifest default from the mirror (``schema-version.test.ts``); a set
saved in browser mode declared 1.7 and the same set saved in API mode 1.9.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
import yaml
from adaptive_learner_content_loader.cache import read_manifest
from adaptive_learner_content_loader.manifest_parser import parse_manifest_yaml
from adaptive_learner_content_loader.schema import Lesson
from adaptive_learner_content_loader.service import (
    USER_GENERATED_SOURCE,
    USER_SET_VERSION,
    ContentLoaderService,
)

from app.services.content_backup import _synthesize_manifest_yaml

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "schema"
LANGS = ("de", "el", "en", "es", "fr", "ja", "pt", "tr")
LESSON_FIXTURE = ROOT / "tests" / "fixtures" / "user-set-lesson" / "lesson.json"


def _mirror(name: str) -> dict:
    return json.loads((SCHEMA / name).read_text(encoding="utf-8"))


MANIFEST_DEFAULT = _mirror("content-manifest.schema.json")["properties"]["schema_version"][
    "default"
]
LESSON_VERSION = _mirror("lesson.schema.json")["x-schema-version"]
MANIFEST_VERSION = _mirror("content-manifest.schema.json")["x-schema-version"]


def test_the_backup_writer_declares_the_mirrors_manifest_default() -> None:
    entry = {"set_id": "s1", "version": "1.0.0", "files": [], "meta": {"title": "T"}}
    text = _synthesize_manifest_yaml(entry)
    assert text is not None
    assert yaml.safe_load(text)["schema_version"] == MANIFEST_DEFAULT


def test_save_user_set_declares_the_mirrors_manifest_default(tmp_path: Path) -> None:
    lesson = json.loads(LESSON_FIXTURE.read_text(encoding="utf-8"))
    service = ContentLoaderService(cache_root=tmp_path, sources=[])
    service.save_user_set(
        set_id="conv-1",
        title="T",
        target_language="es",
        level="A1",
        origin="analysis",
        lessons=[Lesson.model_validate({**lesson, "id": "conv-1"})],
    )
    manifest = read_manifest(tmp_path, USER_GENERATED_SOURCE, "conv-1", USER_SET_VERSION)
    assert manifest.schema_version == MANIFEST_DEFAULT


def test_a_manifest_without_a_version_reads_as_the_mirrors_default() -> None:
    manifest = parse_manifest_yaml("name: Pilot\nsets: []\n")
    assert manifest.schema_version == MANIFEST_DEFAULT


@pytest.mark.parametrize("lang", LANGS)
def test_the_reference_page_names_the_lesson_mirrors_version(lang: str) -> None:
    page = ROOT / "docs" / "help" / lang / "developer" / "lesson-format-reference.md"
    head = "\n".join(page.read_text(encoding="utf-8").splitlines()[:12])
    assert f"**{LESSON_VERSION}**" in head, f"{lang}: the page names no or another version"


@pytest.mark.parametrize(
    ("derived", "version"),
    [
        ("card.schema.json", LESSON_VERSION),
        ("exercise.schema.json", LESSON_VERSION),
        ("lesson-step.schema.json", LESSON_VERSION),
        ("content-set.schema.json", MANIFEST_VERSION),
    ],
    ids=["card", "exercise", "lesson-step", "content-set"],
)
def test_a_derived_schema_carries_its_sources_version(derived: str, version: str) -> None:
    assert _mirror(derived)["x-schema-version"] == version


LITERAL_WRITER = re.compile(r"schema_version\s*=\s*['\"]\d")


def _offenders(text: str) -> list[str]:
    """Lines that name the retired constant or write a literal schema_version."""
    return [
        line
        for line in text.splitlines()
        if "CURRENT_SCHEMA_VERSION" in line or LITERAL_WRITER.search(line)
    ]


def test_the_guard_finds_a_writer_with_a_literal_or_the_old_constant() -> None:
    assert _offenders('    manifest = ContentManifest(schema_version="1.9", name=n)')
    assert _offenders("    schema_version=CURRENT_SCHEMA_VERSION,")
    assert not _offenders("    schema_version=MANIFEST_SCHEMA_VERSION,")


def test_no_production_code_names_a_schema_version_of_its_own() -> None:
    sources = [
        *(ROOT / "backend" / "app").rglob("*.py"),
        *(ROOT / "scripts").glob("*.py"),
        *(
            path
            for path in (ROOT / "plugins").rglob("*.py")
            if "tests" not in path.parts and not path.name.endswith("_generated.py")
        ),
    ]
    assert len(sources) > 50, f"the guard scanned only {len(sources)} files"
    offenders = {
        str(path.relative_to(ROOT)): found
        for path in sources
        if (found := _offenders(path.read_text(encoding="utf-8")))
    }
    assert offenders == {}
