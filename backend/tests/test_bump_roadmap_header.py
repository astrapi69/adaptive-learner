"""Unit tests for ``scripts/bump_roadmap_header.py`` (#2505).

The helper prepends the released version as the new "Current state"
entry in ``docs/ROADMAP.md`` and the new "State:" entry in
``docs/backlog.md``, demoting the previous entry to the prior chain.
Fixtures build a throwaway repo layout in ``tmp_path`` so the script
is exercised against the real file shapes, per the lesson "Test a
tool through the interface it actually uses".
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent
_SCRIPT = REPO / "scripts" / "bump_roadmap_header.py"

_spec = importlib.util.spec_from_file_location("bump_roadmap_header", _SCRIPT)
bump_roadmap_header = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bump_roadmap_header)


ROADMAP_TEMPLATE = (
    "# Adaptive Learner Roadmap\n"
    "\n"
    "Current state: **v2.6.1 (released 2026-07-24 - patch release on top of "
    "v2.6.0: launcher fixes; see changelog/releases/v2.6.1.md).** "
    "Recent prior: **v2.6.0 (released 2026-07-24 - feature release; see "
    "changelog/releases/v2.6.0.md).**\n"
    "\n"
    "## P0\n"
)

BACKLOG_TEMPLATE = (
    "# Adaptive Learner Backlog\n"
    "\n"
    "State: **post v2.6.1 (patch release: launcher fixes; see "
    "changelog/releases/v2.6.1.md); prior post v2.6.0 (feature release; see "
    "changelog/releases/v2.6.0.md).**\n"
)

CHANGELOG_BODY = (
    "# Adaptive Learner v2.7.0\n"
    "\n"
    "Your learning progress is now anchored to **stable identities** instead\n"
    "of the exercise content itself.\n"
    "\n"
    "## Before you install\n"
    "\n"
    "AdaptiveLearner runs in Docker.\n"
)


@pytest.fixture()
def fake_repo(tmp_path: Path) -> Path:
    """Build a minimal repo layout the script operates on."""
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / "pyproject.toml").write_text(
        '[tool.poetry]\nname = "adaptive_learner"\nversion = "2.7.0"\n',
        encoding="utf-8",
    )
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "ROADMAP.md").write_text(ROADMAP_TEMPLATE, encoding="utf-8")
    (docs / "backlog.md").write_text(BACKLOG_TEMPLATE, encoding="utf-8")
    releases = tmp_path / "changelog" / "releases"
    releases.mkdir(parents=True)
    (releases / "v2.7.0.md").write_text(CHANGELOG_BODY, encoding="utf-8")
    return tmp_path


def test_bump_prepends_current_state_and_demotes_prior_when_stale(
    fake_repo: Path,
) -> None:
    exit_code = bump_roadmap_header.main(["--repo-root", str(fake_repo), "--date", "2026-07-30"])
    assert exit_code == 0

    roadmap = (fake_repo / "docs" / "ROADMAP.md").read_text(encoding="utf-8")
    assert roadmap.count("Current state:") == 1
    assert "Current state: **v2.7.0 (released 2026-07-30 - " in roadmap
    assert (
        "see changelog/releases/v2.7.0.md).** Recent prior: **v2.6.1 (released 2026-07-24"
        in roadmap
    )
    assert "Recent prior: **v2.6.0" in roadmap

    backlog = (fake_repo / "docs" / "backlog.md").read_text(encoding="utf-8")
    assert backlog.count("State: **post") == 1
    assert "State: **post v2.7.0 (" in backlog
    assert "see changelog/releases/v2.7.0.md); prior post v2.6.1 (patch release:" in backlog


def test_bump_is_noop_when_already_at_canonical(fake_repo: Path) -> None:
    first = bump_roadmap_header.main(["--repo-root", str(fake_repo), "--date", "2026-07-30"])
    roadmap_after_first = (fake_repo / "docs" / "ROADMAP.md").read_text(encoding="utf-8")
    second = bump_roadmap_header.main(["--repo-root", str(fake_repo), "--date", "2026-07-31"])
    assert first == 0 and second == 0
    assert (fake_repo / "docs" / "ROADMAP.md").read_text(encoding="utf-8") == roadmap_after_first


def test_bump_fails_when_changelog_missing(fake_repo: Path) -> None:
    (fake_repo / "changelog" / "releases" / "v2.7.0.md").unlink()
    exit_code = bump_roadmap_header.main(["--repo-root", str(fake_repo), "--date", "2026-07-30"])
    assert exit_code == 1


def test_bump_fails_when_roadmap_anchor_missing(fake_repo: Path) -> None:
    (fake_repo / "docs" / "ROADMAP.md").write_text(
        "# Roadmap without the dated-prose header\n", encoding="utf-8"
    )
    exit_code = bump_roadmap_header.main(["--repo-root", str(fake_repo), "--date", "2026-07-30"])
    assert exit_code == 1


def test_seed_summary_takes_first_prose_paragraph_and_strips_bold(
    fake_repo: Path,
) -> None:
    summary = bump_roadmap_header.extract_seed_summary(
        fake_repo / "changelog" / "releases" / "v2.7.0.md"
    )
    assert summary == (
        "Your learning progress is now anchored to stable identities "
        "instead of the exercise content itself."
    )


def test_dry_run_writes_nothing(fake_repo: Path) -> None:
    exit_code = bump_roadmap_header.main(
        ["--repo-root", str(fake_repo), "--date", "2026-07-30", "--dry-run"]
    )
    assert exit_code == 0
    roadmap = (fake_repo / "docs" / "ROADMAP.md").read_text(encoding="utf-8")
    assert "v2.7.0" not in roadmap.split("\n")[2].split("(released")[0]
    assert roadmap == ROADMAP_TEMPLATE
