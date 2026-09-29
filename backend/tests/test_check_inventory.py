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

import subprocess
import sys
from pathlib import Path

import pytest

from tests.repo_mirror import mirror_repo

REPO_ROOT = Path(__file__).resolve().parents[2]
CHECKER = REPO_ROOT / "scripts" / "verify_check_inventory.py"


@pytest.fixture
def mirror(tmp_path: Path) -> Path:
    """A repo mirror: symlinks everywhere, real copies where a test writes
    (#3036: ``.claude/rules`` only, never the agent worktrees beside it)."""
    return mirror_repo(
        tmp_path, mutable=("scripts", "Makefile", ".github", ".pre-commit-config.yaml")
    ).root


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
    docs = mirror / "scripts" / "verify_docs_test_counts.py"
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


# ---------------------------------------------------------------------------
# #3241 step 2: existence is not execution. Every active entry carries a run
# proof - a workflow step that invokes the check, or a pre-commit hook the CI
# job does not skip - and the probe fails when that step disappears, stops
# running the check, or is skipped.
# ---------------------------------------------------------------------------

CI = ".github/workflows/ci.yml"


def _swap(root: Path, relative: str, old: str, new: str) -> None:
    path = root / relative
    text = path.read_text(encoding="utf-8")
    assert old in text, f"{relative} no longer contains {old!r} - update this test with it"
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def test_red_when_the_executing_step_is_renamed(mirror: Path) -> None:
    """The step that runs the theme gate goes away (renamed, deleted) while
    the inventory still names it: the check would silently stop running."""
    _swap(mirror, CI, "- name: Theme token gate (#3251)", "- name: Theme token gate, retired")
    result = _run(mirror)
    assert result.returncode == 1
    assert "theme-token-matrix" in result.stderr
    assert "has no step named 'Theme token gate (#3251)'" in result.stderr


def test_red_when_the_step_stops_running_the_check(mirror: Path) -> None:
    """The step keeps its name but its command no longer invokes the tool:
    the #3241 shape (a guard file exists, nothing executes it)."""
    _swap(
        mirror,
        CI,
        "run: python3 scripts/verify_theme.py --enforce",
        'run: echo "theme gate skipped"',
    )
    result = _run(mirror)
    assert result.returncode == 1
    assert "theme-token-matrix" in result.stderr
    assert "does not run 'verify_theme.py'" in result.stderr


def test_red_when_the_ci_job_skips_the_hook(mirror: Path) -> None:
    """A hook the CI pre-commit job lists in SKIP runs for local commits only."""
    _swap(mirror, CI, "SKIP: eslint", "SKIP: eslint,doc-refs")
    result = _run(mirror)
    assert result.returncode == 1
    assert "doc-ref-existence" in result.stderr
    assert "SKIPs hook 'doc-refs'" in result.stderr


def test_red_when_an_active_check_has_only_existence_probes(mirror: Path) -> None:
    """A file that exists is not a check that runs: an active entry without a
    run proof is the silent gate this probe kind was built for."""
    _swap(
        mirror,
        ".claude/rules/checks.yaml",
        "probe: make_target=verify-theme | ci_step=",
        "probe: make_target=verify-theme | old_ci_step=",
    )
    result = _run(mirror)
    assert result.returncode == 1
    assert "theme-token-matrix: active check without a run proof" in result.stderr


def test_red_when_a_make_target_is_a_stub(mirror: Path) -> None:
    """The docstring always claimed a stub check; now the code performs it."""
    makefile = mirror / "Makefile"
    text = makefile.read_text(encoding="utf-8")
    start = text.index("verify-theme:")
    end = text.index("\n\n", start)
    makefile.write_text(
        text[:start] + 'verify-theme:\n\t@echo "theme gate"' + text[end:], encoding="utf-8"
    )
    result = _run(mirror)
    assert result.returncode == 1
    assert "Makefile target 'verify-theme' is a stub" in result.stderr


def _inventory_entries() -> list[dict[str, object]]:
    """The entries of the committed checks.yaml, as the checker reads them."""
    import yaml

    inventory = yaml.safe_load(
        (REPO_ROOT / ".claude" / "rules" / "checks.yaml").read_text(encoding="utf-8")
    )
    return list(inventory["checks"])


def test_the_report_names_every_run_proof_with_its_conditions() -> None:
    """Contract point 4: the report says which step runs each check, on which
    triggers, and under which skip condition - an empty proof set cannot
    print the same green as a full one."""
    result = subprocess.run([sys.executable, str(CHECKER)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert (
        "runs: theme-token-matrix: .github/workflows/ci.yml [frontend-tests] 'Theme token gate (#3251)' on push,pull_request"
        in result.stdout
    )
    assert (
        "step if: (github.event_name != 'pull_request' || needs.changes.outputs.frontend == 'true')"
        in result.stdout
    )
    assert "runs: doc-ref-existence: .pre-commit-config.yaml hook 'doc-refs'" in result.stdout
    # The counts are derived from the inventory itself, so a new entry moves
    # the test with it, and a summary that counts fewer than the inventory
    # declares still fails (#3182: a hard-coded 28 broke on the 29th entry).
    active = [entry for entry in _inventory_entries() if entry.get("status") == "active"]
    probes = " | ".join(str(entry.get("probe", "")) for entry in active)
    steps = probes.count("ci_step=")
    hooks = probes.count("precommit_hook=")
    assert f"{len(active)} active checks proven wired" in result.stdout
    assert (
        f"{steps + hooks} run proofs ({steps} workflow steps, {hooks} pre-commit hooks)"
        in result.stdout
    )
