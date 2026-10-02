"""Pins the scripts/ and plugins/ test selection outside testmon (#3250).

testmon tracks backend/app and backend/tests only, so a change under
scripts/ or plugins/ selected nothing on a PR. The selector names the
tests by their source; the CI step runs them on such PRs.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "select_impacted_tests.py"
TESTS_DIR = REPO_ROOT / "backend" / "tests"


def _run(*areas: str, tests_dir: Path = TESTS_DIR) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *areas, "--tests-dir", str(tests_dir)],
        capture_output=True,
        text=True,
    )


def test_scripts_selection_names_the_script_gate_tests() -> None:
    result = _run("scripts")
    assert result.returncode == 0, result.stderr
    files = result.stdout.split()
    assert str(TESTS_DIR / "test_docker_context.py") in files
    assert str(TESTS_DIR / "test_verify_docs_feature_shots.py") in files
    assert str(TESTS_DIR / "test_select_impacted_tests.py") in files
    assert "files name scripts/" in result.stderr


def test_plugins_selection_names_a_plugin_loading_test() -> None:
    result = _run("plugins")
    assert result.returncode == 0, result.stderr
    files = result.stdout.split()
    assert files
    assert any("adaptive_learner_" in Path(f).read_text(encoding="utf-8") for f in files)


def test_two_areas_list_each_file_once() -> None:
    result = _run("scripts", "plugins", "scripts")
    assert result.returncode == 0, result.stderr
    files = result.stdout.split()
    assert len(files) == len(set(files))
    assert set(_run("scripts").stdout.split()) <= set(files)


def test_a_test_naming_neither_area_is_not_selected(tmp_path: Path) -> None:
    (tmp_path / "test_plain.py").write_text("def test_x():\n    assert True\n", encoding="utf-8")
    (tmp_path / "test_script_user.py").write_text(
        'SCRIPT = REPO / "scripts" / "x.py"\n', encoding="utf-8"
    )
    result = _run("scripts", tests_dir=tmp_path)
    assert result.returncode == 0, result.stderr
    assert result.stdout.split() == [(tmp_path / "test_script_user.py").as_posix()]


def test_fails_closed_when_an_area_selects_nothing(tmp_path: Path) -> None:
    (tmp_path / "test_plain.py").write_text("def test_x():\n    assert True\n", encoding="utf-8")
    result = _run("plugins", tests_dir=tmp_path)
    assert result.returncode == 1
    assert "refusing to run nothing" in result.stderr
    assert result.stdout == ""
    missing = _run("scripts", tests_dir=tmp_path / "absent")
    assert missing.returncode == 1
