"""App-vs-engine schema parity gate (mirror decoupling).

The content repos no longer mirror ``schema/`` from this app — they
mirror the ``learn-content-engine`` npm release, pinned to
``schema/engine-version.txt``. This app therefore syncs its generated
schema ONLY to the engine (the engine's documented schema-sync
procedure), and this test closes the chain: the app-generated
``schema/lesson.schema.json`` + ``schema/content-manifest.schema.json``
must equal the schema bundled in the PINNED engine release, or the gate
goes red — the visible signal that an app schema bump needs its engine
follow-up (engine sync + release + pin bump here).

Like the content repos' drift gate, the comparison target is the npm
tarball of the pinned version (immutable, exactly what consumers
install). These tests exercise the mechanics OFFLINE against a locally
built fake tarball; the real-network comparison runs in the dedicated
workflow (and here only when ``ENGINE_TARBALL`` provides a cached
tarball).
"""

from __future__ import annotations

import io
import json
import os
import sys
import tarfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import check_engine_schema_parity as parity  # noqa: E402

LESSON_BYTES = json.dumps({"title": "Lesson", "x-schema-version": "9.9"}).encode()
MANIFEST_BYTES = json.dumps({"title": "ContentManifest"}).encode()


def make_tarball(path: Path, lesson: bytes = LESSON_BYTES, manifest: bytes = MANIFEST_BYTES) -> Path:
    """Write an npm-layout engine tarball (package/schema/*.json)."""
    with tarfile.open(path, "w:gz") as tar:
        for member, payload in (
            ("package/schema/lesson.schema.json", lesson),
            ("package/schema/content-manifest.schema.json", manifest),
        ):
            info = tarfile.TarInfo(member)
            info.size = len(payload)
            tar.addfile(info, io.BytesIO(payload))
    return path


def write_app_schema(root: Path, lesson: bytes = LESSON_BYTES, manifest: bytes = MANIFEST_BYTES) -> None:
    (root / "schema").mkdir(parents=True)
    (root / "schema" / "lesson.schema.json").write_bytes(lesson)
    (root / "schema" / "content-manifest.schema.json").write_bytes(manifest)


def test_pin_file_exists_and_is_semver() -> None:
    pin = parity.read_pin()
    parts = pin.split(".")
    assert len(parts) == 3 and all(p.isdigit() for p in parts), pin


def test_pin_resolves_to_registry_tarball_url() -> None:
    assert parity.tarball_url("0.3.1") == (
        "https://registry.npmjs.org/learn-content-engine/-/"
        "learn-content-engine-0.3.1.tgz"
    )


def test_parity_passes_on_identical_schemas(tmp_path: Path) -> None:
    tarball = make_tarball(tmp_path / "engine.tgz")
    app_root = tmp_path / "app"
    write_app_schema(app_root)
    assert parity.run_check(tarball_source=str(tarball), repo_root=app_root) == 0


def test_app_schema_bump_without_engine_followup_is_red(tmp_path: Path) -> None:
    tarball = make_tarball(tmp_path / "engine.tgz")
    app_root = tmp_path / "app"
    write_app_schema(
        app_root,
        lesson=json.dumps({"title": "Lesson", "x-schema-version": "10.0"}).encode(),
    )
    assert parity.run_check(tarball_source=str(tarball), repo_root=app_root) == 1


def test_manifest_schema_is_also_gated(tmp_path: Path) -> None:
    tarball = make_tarball(tmp_path / "engine.tgz")
    app_root = tmp_path / "app"
    write_app_schema(app_root, manifest=b'{"title": "Changed"}')
    assert parity.run_check(tarball_source=str(tarball), repo_root=app_root) == 1


def test_real_parity_against_pinned_engine_when_cached() -> None:
    """Full parity of the committed app schema against the real pinned
    tarball — only when a cached tarball is provided (the dedicated
    workflow downloads it; offline runs skip)."""
    cached = os.environ.get("ENGINE_TARBALL")
    if not cached or not Path(cached).is_file():
        pytest.skip("no cached engine tarball (offline run)")
    assert parity.run_check(tarball_source=cached, repo_root=REPO_ROOT) == 0
