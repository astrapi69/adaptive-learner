"""Pins the check-inventory gate against silent disabling (#2077).

Precedent: the test-count arithmetic in ``verify_docs.py`` degraded into a
no-op when a reflow dropped the bold from the count line - it still ran,
warned, and returned. These tests reproduce exactly that state and prove
the inventory catches it, plus the unwiring and undeclared-disable cases.

Everything runs as a SUBPROCESS against a MIRROR of the real repo: the
top-level entries are symlinked (read-only, nothing in the real tree is
touched), while ``scripts/`` and ``.claude/rules/`` are real copies so a
test can break exactly one thing. A partial tree would make
``verify_docs.py`` crash on missing files, and a crashed probe must never
be mistaken for a passing one - that false negative was found while
building this gate and is pinned below.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
CHECKER = REPO_ROOT / "scripts" / "verify_check_inventory.py"
MUTABLE = {"scripts", ".claude", "Makefile"}


@pytest.fixture
def mirror(tmp_path: Path) -> Path:
    """A repo mirror: symlinks everywhere, real copies where a test writes."""
    for entry in REPO_ROOT.iterdir():
        if entry.name == ".git":
            continue
        if entry.name in MUTABLE:
            if entry.is_dir():
                shutil.copytree(entry, tmp_path / entry.name, symlinks=True)
            else:
                shutil.copy2(entry, tmp_path / entry.name)
        else:
            (tmp_path / entry.name).symlink_to(entry)
    return tmp_path


def _run(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(root / "scripts" / "verify_check_inventory.py"),
            "--repo-root",
            str(root),
        ],
        capture_output=True,
        text=True,
    )


def test_green_on_the_real_repo() -> None:
    result = subprocess.run([sys.executable, str(CHECKER)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert "check inventory OK" in result.stdout


def test_mirror_is_green(mirror: Path) -> None:
    assert _run(mirror).returncode == 0, _run(mirror).stderr


def test_red_when_an_active_check_loses_its_make_target(mirror: Path) -> None:
    """The plain unwiring case: target gone, inventory still says active."""
    makefile = mirror / "Makefile"
    makefile.write_text(
        makefile.read_text(encoding="utf-8").replace("verify-gate-rule-links:", "renamed-away:", 1),
        encoding="utf-8",
    )
    result = _run(mirror)
    assert result.returncode == 1
    assert "gate-rule-links" in result.stderr
    assert "does not exist" in result.stderr


def test_red_when_a_check_degrades_into_a_no_op(mirror: Path) -> None:
    """The real incident: the count regex stops matching, the check warns and returns."""
    docs = mirror / "scripts" / "verify_docs.py"
    text = docs.read_text(encoding="utf-8")
    broken = text.replace(r"= \*{0,2}(\d+) tests\*{0,2}", r"= \*\*(\d+) tests\*\*")
    assert broken != text, "the TEST_COUNT_RE line moved - update this test with it"
    docs.write_text(broken, encoding="utf-8")

    result = _run(mirror)
    assert result.returncode == 1
    assert "docs-test-count-arithmetic" in result.stderr
    assert "degraded into a no-op" in result.stderr


def test_red_when_the_no_warn_probe_cannot_run(mirror: Path) -> None:
    """A crashed probe is not a passing probe (false negative found while building this)."""
    (mirror / "scripts" / "verify_docs.py").write_text(
        "import sys\nsys.exit(3)\n", encoding="utf-8"
    )
    result = _run(mirror)
    assert result.returncode == 1
    assert "probe could not be evaluated" in result.stderr


def test_red_when_a_check_is_disabled_without_a_reason(mirror: Path) -> None:
    """Turning a check off is allowed - silently is not."""
    inventory = mirror / ".claude" / "rules" / "checks.yaml"
    text = inventory.read_text(encoding="utf-8")
    marker = """  - id: gate-rule-links
    verifies: no gate without its rule section, no rule citing a dead gate, no unclassified workflow
    rule: quality-checks.md#gate-and-rule-stay-coupled-2075
    status: active"""
    assert marker in text
    inventory.write_text(
        text.replace(marker, marker.replace("status: active", "status: disabled")), encoding="utf-8"
    )
    result = _run(mirror)
    assert result.returncode == 1
    assert "gate-rule-links" in result.stderr
    assert "without a reason" in result.stderr


def test_green_again_after_restoring(mirror: Path) -> None:
    """Guards against a checker that fails unconditionally."""
    makefile = mirror / "Makefile"
    original = makefile.read_text(encoding="utf-8")
    makefile.write_text(original.replace("verify-check-inventory:", "gone:", 1), encoding="utf-8")
    assert _run(mirror).returncode == 1
    makefile.write_text(original, encoding="utf-8")
    assert _run(mirror).returncode == 0
