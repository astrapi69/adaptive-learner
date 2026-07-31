"""Gate-contract tests for scripts/verify_docs_hygiene.py (#2208).

Runs the script as a subprocess against throwaway docs trees - the interface
pre-commit and the Makefile actually use - never a mock. The trees are real
git repositories (#2217: the gate enumerates via the git index, so the tests
must control that context, lessons/core.md "Test a tool through the interface
it actually uses"). Covers the five-point gate contract (quality-checks.md
"Gate test contract"): detects the violation, passes on a clean tree, fails
CLOSED when its basis is missing, reports what it measured, and its number
means the same thing every run.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "verify_docs_hygiene.py"


def _run(root: Path, *extra: str, baseline: Path | None = None) -> subprocess.CompletedProcess:
    args = [sys.executable, str(SCRIPT), "--root", str(root)]
    if baseline is not None:
        args += ["--baseline", str(baseline)]
    args += list(extra)
    return subprocess.run(args, capture_output=True, text=True)


def _git(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)


def _docs(root: Path) -> Path:
    d = root / "docs"
    d.mkdir(parents=True, exist_ok=True)
    if not (root / ".git").exists():
        _git(root, "init", "-q")
    return d


def _track(root: Path) -> None:
    """Stage everything under docs/ - the gate counts the git index (#2217)."""
    _git(root, "add", "-A", "docs")


def _write_baseline(path: Path, count: int) -> None:
    path.write_text(json.dumps({"umlaut_count": count}), encoding="utf-8")


# --- 1. detects the violation (RED) ------------------------------------------


def test_umlaut_ratchet_detects_new_substitute(tmp_path: Path) -> None:
    docs = _docs(tmp_path)
    (docs / "note.md").write_text("Die Loesung ist fuer alle da.", encoding="utf-8")
    _track(tmp_path)
    baseline = tmp_path / "baseline.json"
    _write_baseline(baseline, 0)
    r = _run(tmp_path, "--only", "umlaut", baseline=baseline)
    assert r.returncode != 0, r.stdout
    assert "count rose" in r.stdout
    assert "fuer" in r.stdout


# --- 2. passes on a clean tree -----------------------------------------------


def test_umlaut_ratchet_passes_when_count_matches_baseline(tmp_path: Path) -> None:
    docs = _docs(tmp_path)
    (docs / "note.md").write_text("Alles korrekt mit echten Umlauten: fuer.", encoding="utf-8")
    _track(tmp_path)
    baseline = tmp_path / "baseline.json"
    _write_baseline(baseline, 1)  # exactly one "fuer"
    r = _run(tmp_path, "--only", "umlaut", baseline=baseline)
    assert r.returncode == 0, r.stdout


# --- 3. fails CLOSED when its basis is missing/empty -------------------------


def test_umlaut_ratchet_fails_closed_on_missing_baseline(tmp_path: Path) -> None:
    docs = _docs(tmp_path)
    (docs / "note.md").write_text("harmless prose", encoding="utf-8")
    _track(tmp_path)
    r = _run(tmp_path, "--only", "umlaut", baseline=tmp_path / "does-not-exist.json")
    assert r.returncode != 0
    assert "fail-closed" in r.stdout


def test_umlaut_ratchet_fails_closed_on_zero_files(tmp_path: Path) -> None:
    _docs(tmp_path)  # empty docs dir, no *.md
    baseline = tmp_path / "baseline.json"
    _write_baseline(baseline, 0)
    r = _run(tmp_path, "--only", "umlaut", baseline=baseline)
    assert r.returncode != 0
    assert "0 tracked files" in r.stdout


# --- 4. reports WHAT it measured ---------------------------------------------


def test_umlaut_ratchet_reports_scope(tmp_path: Path) -> None:
    docs = _docs(tmp_path)
    (docs / "a.md").write_text("clean", encoding="utf-8")
    (docs / "b.md").write_text("clean", encoding="utf-8")
    _track(tmp_path)
    baseline = tmp_path / "baseline.json"
    _write_baseline(baseline, 0)
    r = _run(tmp_path, "--only", "umlaut", baseline=baseline)
    assert "scanned 2 tracked files (git index)" in r.stdout, r.stdout


# --- 5. the number is a ratchet in BOTH directions ---------------------------


def test_umlaut_ratchet_fails_on_reduction_to_force_lock_in(tmp_path: Path) -> None:
    docs = _docs(tmp_path)
    (docs / "note.md").write_text("now clean, no substitutes", encoding="utf-8")
    _track(tmp_path)
    baseline = tmp_path / "baseline.json"
    _write_baseline(baseline, 5)  # tree improved below the frozen ceiling
    r = _run(tmp_path, "--only", "umlaut", baseline=baseline)
    assert r.returncode != 0
    assert "count fell" in r.stdout


def test_umlaut_ratchet_update_baseline_freezes_current(tmp_path: Path) -> None:
    docs = _docs(tmp_path)
    (docs / "note.md").write_text("fuer waehrend", encoding="utf-8")
    _track(tmp_path)
    baseline = tmp_path / "baseline.json"
    r = _run(tmp_path, "--update-baseline", baseline=baseline)
    assert r.returncode == 0
    assert json.loads(baseline.read_text())["umlaut_count"] == 2
    # re-run is now green against the frozen number
    assert _run(tmp_path, "--only", "umlaut", baseline=baseline).returncode == 0


# --- exploration-index orphan check ------------------------------------------


def _explorations(root: Path) -> Path:
    d = _docs(root) / "explorations"
    d.mkdir(parents=True, exist_ok=True)
    return d


def test_exploration_index_detects_orphan(tmp_path: Path) -> None:
    exp = _explorations(tmp_path)
    (exp / "EXP-046-foo.md").write_text("body", encoding="utf-8")
    (exp / "EXP-INDEX.md").write_text("| 045 | something |\n", encoding="utf-8")
    _track(tmp_path)
    r = _run(tmp_path, "--only", "index")
    assert r.returncode != 0
    assert "EXP-046" in r.stdout


def test_exploration_index_passes_when_row_present(tmp_path: Path) -> None:
    exp = _explorations(tmp_path)
    (exp / "EXP-046-foo.md").write_text("body", encoding="utf-8")
    (exp / "EXP-INDEX.md").write_text("| 046 | foo |\n", encoding="utf-8")
    _track(tmp_path)
    r = _run(tmp_path, "--only", "index")
    assert r.returncode == 0, r.stdout
    assert "checked 1 EXP file" in r.stdout


def test_exploration_index_fails_closed_on_no_files(tmp_path: Path) -> None:
    exp = _explorations(tmp_path)
    (exp / "EXP-INDEX.md").write_text("| 001 | x |\n", encoding="utf-8")
    _track(tmp_path)
    r = _run(tmp_path, "--only", "index")
    assert r.returncode != 0
    assert "fail-closed" in r.stdout


# --- #2217: the number means the same thing everywhere -----------------------


def test_umlaut_ratchet_ignores_untracked_and_gitignored_files(tmp_path: Path) -> None:
    """Gitignored local artifacts must not move the count (#2217).

    The incident: 10 gitignored ``docs/review/i18n-quality/*.md`` reports
    pushed a git-clean tree over the baseline on any machine that ever
    generated them, while CI (which never has them) stayed green.
    """
    docs = _docs(tmp_path)
    (docs / "tracked.md").write_text("fuer", encoding="utf-8")
    _track(tmp_path)
    review = docs / "review" / "i18n-quality"
    review.mkdir(parents=True)
    (review / "report.md").write_text("fuer fuer fuer", encoding="utf-8")
    (docs / ".gitignore").write_text("review/\n", encoding="utf-8")
    (docs / "untracked-draft.md").write_text("fuer waehrend", encoding="utf-8")
    baseline = tmp_path / "baseline.json"
    _write_baseline(baseline, 1)  # exactly the tracked file's one "fuer"
    r = _run(tmp_path, "--only", "umlaut", baseline=baseline)
    assert r.returncode == 0, r.stdout
    assert "scanned 1 tracked file" in r.stdout, r.stdout


def test_umlaut_ratchet_fails_closed_outside_a_git_repo(tmp_path: Path) -> None:
    """No git index to enumerate from = no basis = never a green pass."""
    d = tmp_path / "docs"
    d.mkdir()
    (d / "note.md").write_text("clean", encoding="utf-8")
    baseline = tmp_path / "baseline.json"
    _write_baseline(baseline, 0)
    r = _run(tmp_path, "--only", "umlaut", baseline=baseline)
    assert r.returncode != 0
    assert "fail-closed" in r.stdout
