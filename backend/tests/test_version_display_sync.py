"""Version-display sites ride the sync-versions write path (#2179).

The class this pins: a version bump propagated every machine-readable pin
via ``make sync-versions`` but left the human-readable display sites
(README badges + "current release" lines) stale, so every release recreated
the same docs debt and the drift gate only caught it after the merge.

One single source (``scripts/version_display_sites.py``) feeds BOTH the
write path (``sync_versions.sync_version_display_sites``) and the check
path (``verify_docs.VERSION_TARGETS``), so writer and checker cannot know
different site lists. Five-point gate contract: detect, clean pass, fail
closed, report the measured set, stable meaning.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = REPO_ROOT / "scripts"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module  # dataclasses resolves annotations via sys.modules
    sys.path.insert(0, str(SCRIPTS))
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.remove(str(SCRIPTS))
    return module


def _seed_readmes(root: Path, version: str) -> None:
    (root / "README.md").write_text(
        "# App\n\n"
        f"[![Version](https://img.shields.io/badge/version-v{version}-blue)](x)\n\n"
        f"Active development. The current release is **v{version}** (notes).\n",
        encoding="utf-8",
    )
    (root / "README-de.md").write_text(
        "# App\n\n"
        f"[![Version](https://img.shields.io/badge/version-v{version}-blue)](x)\n\n"
        f"Aktive Entwicklung. Das aktuelle Release ist **v{version}** (Notizen).\n",
        encoding="utf-8",
    )


# --- 1. detects the violation ------------------------------------------------


def test_detects_stale_display_sites(tmp_path: Path) -> None:
    _seed_readmes(tmp_path, "0.0.0")
    sync = _load("sync_versions")
    changed, inspected, problems = sync.sync_version_display_sites(
        "9.9.9", dry_run=True, root=tmp_path
    )
    assert problems == []
    assert inspected == 4
    assert changed == 4


# --- 2. passes on a clean tree (and the write path converges) ----------------


def test_bump_rewrites_all_sites_then_is_idempotent(tmp_path: Path) -> None:
    _seed_readmes(tmp_path, "1.2.3")
    sync = _load("sync_versions")
    changed, inspected, problems = sync.sync_version_display_sites(
        "9.9.9", dry_run=False, root=tmp_path
    )
    assert problems == []
    assert (changed, inspected) == (4, 4)
    for rel in ("README.md", "README-de.md"):
        text = (tmp_path / rel).read_text(encoding="utf-8")
        assert "9.9.9" in text
        assert "1.2.3" not in text
    changed2, inspected2, problems2 = sync.sync_version_display_sites(
        "9.9.9", dry_run=True, root=tmp_path
    )
    assert (changed2, inspected2, problems2) == (0, 4, [])


# --- 3. fails CLOSED when a site's pattern is gone ---------------------------


def test_fails_closed_when_a_pattern_is_missing(tmp_path: Path) -> None:
    _seed_readmes(tmp_path, "1.2.3")
    (tmp_path / "README.md").write_text("# App\n\nno badge here\n", encoding="utf-8")
    sync = _load("sync_versions")
    changed, inspected, problems = sync.sync_version_display_sites(
        "9.9.9", dry_run=True, root=tmp_path
    )
    assert problems, "a vanished site pattern must surface as a problem, not silence"
    assert inspected < 4


def test_fails_closed_when_a_file_is_missing(tmp_path: Path) -> None:
    _seed_readmes(tmp_path, "1.2.3")
    (tmp_path / "README-de.md").unlink()
    sync = _load("sync_versions")
    _, _, problems = sync.sync_version_display_sites("9.9.9", dry_run=True, root=tmp_path)
    assert any("README-de.md" in p for p in problems)


# --- 4. reports WHAT it measured (through the real CLI) ----------------------


def test_check_cli_reports_the_inspected_site_count() -> None:
    r = subprocess.run(
        [sys.executable, str(SCRIPTS / "sync_versions.py"), "--check"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
    )
    assert "version-display site" in r.stdout, r.stdout + r.stderr


# --- 5. one list, two consumers ----------------------------------------------


def test_verify_docs_consumes_the_same_site_list() -> None:
    """The checker knows every site the writer writes (closes README-de:255)."""
    sites = _load("version_display_sites").VERSION_DISPLAY_SITES
    assert len(sites) >= 4
    verify_docs = _load("verify_docs")
    targets = {(rel, pattern) for rel, pattern, _label, _fixable in verify_docs.VERSION_TARGETS}
    for rel, pattern, _label in sites:
        assert (rel, pattern) in targets, f"verify_docs misses display site {rel}: {pattern}"
