"""Tests for the pull-request trigger of the Dexie-mode smoke (#3748).

The smoke used to run only nightly, on release branches and by hand, so a
lesson-flow change reached develop without it. ``dexie_smoke_affected``
decides per pull request whether the smoke runs: yes when a changed file is
something the Dexie build or its specs read, no for anything else. These
tests pin both directions, the exceptions, the fail-closed paths and that it
reports what it looked at.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from dexie_smoke_affected import decide, is_relevant, main  # noqa: E402


@pytest.mark.parametrize(
    "path",
    [
        "frontend/src/pages/lesson/Lesson.tsx",
        "frontend/src/storage/lessons/lesson-progress-dexie.ts",
        "frontend/src/components/exercises/renderers/cloze/cloze-editor.tsx",
        "frontend/src/data/i18n/de.json",
        "frontend/src/styles/global.css",
        "frontend/package.json",
        "frontend/bun.lock",
        "frontend/vite.config.ts",
        "frontend/index.html",
        "frontend/public/manifest.webmanifest",
        "frontend/scripts/copy-bundled-content.mjs",
        "schema/content-manifest.schema.json",
        "e2e/dexie/lesson-resume-mode.spec.ts",
        "e2e/dexie-setup/content-probe.setup.ts",
        "e2e/helpers/onboarding.ts",
        "e2e/fixtures/mixed-set.zip",
        "e2e/visual/helpers.ts",
        # Imported by e2e/visual/helpers.ts, so a Dexie spec input.
        "frontend/src/test-utils/visual-pins.ts",
        "e2e/package.json",
        "e2e/bun.lock",
        "e2e/playwright.dexie.config.ts",
        "e2e/.runtime-skip-budget.json",
        "scripts/check_e2e_skip_budget.py",
        "scripts/dexie_smoke_affected.py",
        ".github/workflows/dexie-smoke.yml",
    ],
    ids=lambda path: path,
)
def test_a_path_the_smoke_reads_is_relevant(path: str) -> None:
    assert is_relevant(path)


@pytest.mark.parametrize(
    "path",
    [
        "docs/help/de/lessons.md",
        ".claude/rules/quality-checks.md",
        "backend/app/main.py",
        "plugins/adaptive-learner-plugin-anki/adaptive_learner_anki/plugin.py",
        "e2e/smoke/backup-restore.spec.ts",
        "e2e/webkit/select-cloze-tap.spec.ts",
        "e2e/visual/screenshots/dashboard-desktop.png",
        "e2e/playwright.webkit.config.ts",
        "frontend/src/pages/lesson/Lesson.test.tsx",
        "frontend/src/lib/lesson/progress/resume-mode.test.ts",
        "frontend/src/test/setup.ts",
        "frontend/stryker.config.json",
        "README.md",
    ],
    ids=lambda path: path,
)
def test_a_path_the_smoke_never_reads_is_not_relevant(path: str) -> None:
    assert not is_relevant(path)


def test_decide_runs_when_any_file_is_relevant() -> None:
    decision = decide(["docs/x.md", "frontend/src/App.tsx", "backend/app/main.py"])
    assert decision.affected
    assert decision.relevant == ["frontend/src/App.tsx"]
    assert decision.checked == 3


def test_decide_skips_when_no_file_is_relevant() -> None:
    decision = decide(["docs/x.md", "frontend/src/App.test.tsx"])
    assert not decision.affected
    assert decision.relevant == []
    assert decision.checked == 2


def test_an_empty_change_list_fails_closed() -> None:
    # "No files" is never read as "nothing relevant": an empty diff means the
    # comparison went wrong, so the smoke runs.
    decision = decide([])
    assert decision.affected
    assert decision.checked == 0


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True
    ).stdout.strip()


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    _git(tmp_path, "init", "-q", "-b", "develop")
    _git(tmp_path, "config", "user.email", "t@example.org")
    _git(tmp_path, "config", "user.name", "t")
    (tmp_path / "README.md").write_text("x\n", encoding="utf-8")
    _git(tmp_path, "add", "-A")
    _git(tmp_path, "commit", "-q", "-m", "base")
    _git(tmp_path, "checkout", "-q", "-b", "feature")
    return tmp_path


def _commit(repo: Path, path: str) -> None:
    target = repo / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("y\n", encoding="utf-8")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", path)


def _run(
    repo: Path, base: str, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> tuple[int, str, str]:
    output = tmp_path / "github_output"
    code = main(["--base", base, "--repo", str(repo), "--github-output", str(output)])
    written = output.read_text(encoding="utf-8") if output.exists() else ""
    return code, written, capsys.readouterr().out


def test_main_against_a_real_diff_reports_affected(
    repo: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _commit(repo, "frontend/src/App.tsx")
    code, written, out = _run(repo, "develop", tmp_path, capsys)
    assert code == 0
    assert "affected=true" in written
    assert "1 of 1 changed files" in out
    assert "frontend/src/App.tsx" in out


def test_main_against_a_real_diff_reports_not_affected(
    repo: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _commit(repo, "docs/help/de/x.md")
    code, written, out = _run(repo, "develop", tmp_path, capsys)
    assert code == 0
    assert "affected=false" in written
    assert "0 of 1 changed files" in out


def test_main_fails_closed_on_an_unknown_base(
    repo: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _commit(repo, "docs/help/de/x.md")
    code, written, out = _run(repo, "no-such-branch", tmp_path, capsys)
    assert code == 0
    assert "affected=true" in written
    assert "::warning::" in out
