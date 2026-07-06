"""Offline tests for the app-vs-engine schema-parity gate (#1393).

The mirror-decoupling stage moved the content repos' schema mirror off this
app repo and onto the ``learn-content-engine`` npm release (pinned there).
The chain-closing check on the APP side is
``scripts/check_engine_schema_parity.py``: the app-generated, committed
schema artefacts must be byte-identical to the artifacts BUNDLED by the
engine release pinned in ``schema/engine-pin.json`` — a red gate is the
defined, visible signal that an app schema bump still needs its engine
follow-up release + pin bump.

These tests exercise the gate's mechanics fully OFFLINE: a fake npm tarball
is built locally and injected via the ``ENGINE_TARBALL`` override (the same
pattern the content repos' drift-gate tests use). The real network fetch
happens only in the CI workflow.
"""

from __future__ import annotations

import importlib.util
import io
import json
import sys
import tarfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "check_engine_schema_parity.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("check_engine_schema_parity", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _build_tarball(path: Path, members: dict[str, bytes]) -> Path:
    """Write a gzipped npm-style tarball (``package/...`` members)."""
    with tarfile.open(path, "w:gz") as tar:
        for name, payload in members.items():
            info = tarfile.TarInfo(name=name)
            info.size = len(payload)
            tar.addfile(info, io.BytesIO(payload))
    return path


def _fake_repo(tmp_path: Path, lesson: bytes, manifest: bytes) -> Path:
    repo = tmp_path / "repo"
    (repo / "schema").mkdir(parents=True)
    (repo / "schema" / "lesson.schema.json").write_bytes(lesson)
    (repo / "schema" / "content-manifest.schema.json").write_bytes(manifest)
    (repo / "schema" / "engine-pin.json").write_text(
        json.dumps({"package": "learn-content-engine", "version": "0.3.1"}),
        encoding="utf-8",
    )
    return repo


def _run(
    module,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    repo: Path,
    engine_members: dict[str, bytes],
) -> int:
    tgz = _build_tarball(tmp_path / "engine.tgz", engine_members)
    monkeypatch.setenv("ENGINE_TARBALL", str(tgz))
    monkeypatch.setattr(module, "REPO_ROOT", repo)
    monkeypatch.setattr(sys, "argv", ["check_engine_schema_parity.py"])
    return module.main()


def test_pin_file_is_valid_and_pins_the_engine() -> None:
    """The committed pin names the engine package with a concrete version."""
    pin = json.loads((REPO_ROOT / "schema" / "engine-pin.json").read_text("utf-8"))
    assert pin["package"] == "learn-content-engine"
    assert pin["version"].count(".") == 2


def test_mapping_covers_the_engine_bundled_artifacts() -> None:
    module = _load_module()
    assert module.MIRRORED == {
        "schema/lesson.schema.json": "package/schema/lesson.schema.json",
        "schema/content-manifest.schema.json": ("package/schema/content-manifest.schema.json"),
    }


def test_parity_green(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load_module()
    lesson, manifest = b'{"a": 1}\n', b'{"b": 2}\n'
    repo = _fake_repo(tmp_path, lesson, manifest)
    rc = _run(
        module,
        monkeypatch,
        tmp_path,
        repo,
        {
            "package/schema/lesson.schema.json": lesson,
            "package/schema/content-manifest.schema.json": manifest,
        },
    )
    assert rc == 0


def test_mismatch_red(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """An app schema that moved ahead of the pinned engine release fails (1)."""
    module = _load_module()
    repo = _fake_repo(tmp_path, b'{"x-schema-version": "1.6"}\n', b'{"b": 2}\n')
    rc = _run(
        module,
        monkeypatch,
        tmp_path,
        repo,
        {
            "package/schema/lesson.schema.json": b'{"x-schema-version": "1.5"}\n',
            "package/schema/content-manifest.schema.json": b'{"b": 2}\n',
        },
    )
    assert rc == 1


def test_missing_engine_artifact_is_fetch_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A tarball without the expected members is a packaging error (2), not drift."""
    module = _load_module()
    repo = _fake_repo(tmp_path, b"{}", b"{}")
    rc = _run(module, monkeypatch, tmp_path, repo, {"package/README.md": b"hi"})
    assert rc == 2


def test_committed_schemas_match_pinned_engine_bundle() -> None:
    """The REAL committed app schemas equal the REAL pinned engine artifacts.

    Runs offline against the engine tarball vendored into the test run via
    ``ENGINE_TARBALL`` if set; otherwise SKIPS (the CI workflow does the
    networked run)."""
    import os

    if not os.environ.get("ENGINE_TARBALL"):
        pytest.skip("no local engine tarball; the CI workflow runs the networked gate")
    module = _load_module()
    assert module.main() == 0
