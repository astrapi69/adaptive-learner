"""The prod compose image carries the app version, not implicit :latest (#2034).

docker-compose.prod.yml tags its locally built image with the canonical
app version (env-overridable, ``ADAPTIVE_LEARNER_APP_VERSION``) and stamps
``org.opencontainers.image.version`` as a build label. The version DEFAULT
baked into the file is maintained by ``make sync-versions`` - same class
as every other derived version pin, so it can never drift from
backend/pyproject.toml.
"""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = REPO_ROOT / "scripts"


def _load_sync():
    spec = importlib.util.spec_from_file_location("sync_versions", SCRIPTS / "sync_versions.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["sync_versions"] = module
    sys.path.insert(0, str(SCRIPTS))
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.remove(str(SCRIPTS))
    return module


def _seed_compose(path: Path, version: str) -> None:
    path.write_text(
        "services:\n"
        "  app:\n"
        f"    image: adaptive-learner:${{ADAPTIVE_LEARNER_APP_VERSION:-{version}}}\n"
        "    build:\n"
        "      context: .\n"
        "      args:\n"
        f"        APP_VERSION: ${{ADAPTIVE_LEARNER_APP_VERSION:-{version}}}\n",
        encoding="utf-8",
    )


def test_stale_compose_default_is_rewritten(tmp_path: Path) -> None:
    compose = tmp_path / "docker-compose.prod.yml"
    _seed_compose(compose, "0.0.0")
    sync = _load_sync()
    assert sync.update_compose_version_default(compose, "9.9.9", dry_run=False) is True
    text = compose.read_text(encoding="utf-8")
    assert text.count("ADAPTIVE_LEARNER_APP_VERSION:-9.9.9}") == 2
    assert "0.0.0" not in text


def test_clean_compose_is_a_no_op(tmp_path: Path) -> None:
    compose = tmp_path / "docker-compose.prod.yml"
    _seed_compose(compose, "9.9.9")
    sync = _load_sync()
    assert sync.update_compose_version_default(compose, "9.9.9", dry_run=True) is False


def test_fails_closed_when_the_version_default_pattern_is_gone(tmp_path: Path) -> None:
    compose = tmp_path / "docker-compose.prod.yml"
    compose.write_text("services:\n  app:\n    image: adaptive-learner\n", encoding="utf-8")
    sync = _load_sync()
    try:
        sync.update_compose_version_default(compose, "9.9.9", dry_run=True)
    except SystemExit as exc:
        assert exc.code != 0
    else:
        raise AssertionError("a vanished version-default pattern must fail, not pass silently")


def test_real_compose_default_matches_canonical_and_is_wired() -> None:
    """Pins BOTH halves: the file carries the stamp, and sync-versions owns it."""
    sync = _load_sync()
    compose = REPO_ROOT / "docker-compose.prod.yml"
    text = compose.read_text(encoding="utf-8")
    defaults = set(re.findall(r"ADAPTIVE_LEARNER_APP_VERSION:-(\d+\.\d+\.\d+)\}", text))
    assert defaults == {sync.read_canonical_version()}, (
        "docker-compose.prod.yml version default drifted from backend/pyproject.toml"
    )
    assert "org.opencontainers.image.version" in text
    kinds = {kind for _path, kind in sync.collect_targets()}
    assert "compose_version_default" in kinds, "sync-versions does not own the compose stamp"
