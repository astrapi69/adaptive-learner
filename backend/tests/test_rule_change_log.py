"""Pins the rule change log aggregator (#2087, rewritten for #3252 / #3268).

Per the #2083 gate contract: it detects the violation (a declaration
missing from the log), it passes on a clean state, it fails closed when
its input cannot be read, and a written row is recognised again instead
of being reported as missing forever. The #3252 / #3268 cases: rows are
keyed by PR number (a squash commit's ``(#N)``, or the ``Merge pull
request #N`` commit that brought a branch commit in), every documented
declaration block yields a row, a marker quoted mid-sentence does not, a
legacy row is keyed by its sha with prefix matching, nothing is
truncated, and ``--check`` sees a missing second declaration.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "append_rule_change_log.py"
LOG = Path("docs") / "rule-change-log.md"


def _git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=root, check=True, capture_output=True, text=True
    ).stdout.strip()


def _commit(root: Path, message: str, path: str = "a.txt") -> str:
    (root / path).write_text(message, encoding="utf-8")
    _git(root, "add", "-A")
    _git(root, "commit", "-qm", message)
    return _git(root, "rev-parse", "HEAD")


def _run(root: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), *extra],
        capture_output=True,
        text=True,
        cwd=root,
    )


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A repo with one plain commit and one declaring squash-style commit."""
    _git(tmp_path, "init", "-q", "-b", "develop")
    _git(tmp_path, "config", "user.email", "t@example.com")
    _git(tmp_path, "config", "user.name", "test")
    _commit(tmp_path, "chore: base")
    _commit(
        tmp_path,
        "docs(rules): tighten the backup gate (#4242)\n\n"
        "RULE-CHANGE DECLARED: the backup round-trip is mandatory again\n",
    )
    return tmp_path


def test_red_when_a_declaration_is_missing_from_the_log(repo: Path) -> None:
    result = _run(repo, "--range", "HEAD~1..HEAD", "--check")
    assert result.returncode == 1
    assert "MISSING" in result.stderr
    assert "#4242" in result.stderr
    assert "not in docs/rule-change-log.md" in result.stderr


def test_appending_then_checking_is_green(repo: Path) -> None:
    """A written row must be recognised, not re-reported (idempotence)."""
    assert _run(repo, "--range", "HEAD~1..HEAD").returncode == 0
    log = (repo / LOG).read_text(encoding="utf-8")
    assert "mandatory again" in log
    assert "| #4242 |" in log

    second = _run(repo, "--range", "HEAD~1..HEAD", "--check")
    assert second.returncode == 0, second.stderr
    assert "up to date" in second.stdout
    assert _run(repo, "--range", "HEAD~1..HEAD").returncode == 0
    assert (repo / LOG).read_text(encoding="utf-8").count("mandatory again") == 1


def test_green_when_nothing_was_declared(repo: Path) -> None:
    result = _run(repo, "--range", "HEAD~1..HEAD~1", "--check")
    assert result.returncode == 0


def test_fails_closed_on_an_unreadable_range(repo: Path) -> None:
    """A tool that cannot read its input may not report success (#2083)."""
    result = _run(repo, "--range", "no-such-ref..HEAD", "--check")
    assert result.returncode == 1
    assert "failed" in result.stderr


def test_a_pr_can_carry_its_own_row(repo: Path) -> None:
    """#3252 fault 3: keyed by PR number, the declaring commit itself can
    hold the row, so a push-range check on it is satisfiable."""
    _commit(
        repo,
        "docs(rules): widen the gate (#4300)\n\nRULE-CHANGE DECLARED: the gate now covers plugins\n",
    )
    (repo / LOG).parent.mkdir(parents=True, exist_ok=True)
    (repo / LOG).write_text(
        "| Date | Commit | PR | Declared change |\n|---|---|---|---|\n"
        "| 2026-09-29 | `0000000` | #4242 | the backup round-trip is mandatory again |\n"
        "| 2026-09-29 | `0000000` | #4300 | the gate now covers plugins |\n",
        encoding="utf-8",
    )
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "--amend", "--no-edit")
    result = _run(repo, "--range", "HEAD~2..HEAD", "--check")
    assert result.returncode == 0, result.stderr


def test_every_declaration_block_yields_a_row(repo: Path) -> None:
    """#3268 fault 1: two blocks in one squash message, two rows; and
    ``--check`` sees a missing second row."""
    _commit(
        repo,
        "docs(rules): two rules in one PR (#4301)\n\n"
        "* first commit\n\n"
        "RULE-CHANGE DECLARED: rule A is\n  now binding\n\n"
        "* second commit\n\n"
        "RULE-CHANGE DECLARED: rule B is retired\n",
    )
    assert _run(repo, "--range", "HEAD~1..HEAD").returncode == 0
    log = (repo / LOG).read_text(encoding="utf-8")
    assert "| #4301 | rule A is now binding |" in log
    assert "| #4301 | rule B is retired |" in log

    (repo / LOG).write_text(log.replace("| #4301 | rule B is retired |", "| #4301 | other |"))
    result = _run(repo, "--range", "HEAD~1..HEAD", "--check")
    assert result.returncode == 1
    assert "rule B is retired" in result.stderr


def test_a_marker_quoted_mid_sentence_is_not_a_declaration(repo: Path) -> None:
    """#3252 fault 4: only the documented form at line start counts, so a
    commit that talks ABOUT the marker declares nothing."""
    _commit(
        repo,
        "docs(rules): backfill the log (#4302)\n\n"
        "The log held 18 rows for 44 RULE-CHANGE DECLARED commits.\n"
        "- the script extracts RULE-CHANGE DECLARED: blocks\n",
    )
    result = _run(repo, "--range", "HEAD~1..HEAD", "--check")
    assert result.returncode == 0, result.stderr
    assert "0 declaration(s)" in result.stdout


def test_a_bullet_before_the_marker_still_counts(repo: Path) -> None:
    _commit(
        repo,
        "docs(rules): bullet form (#4303)\n\n* RULE-CHANGE DECLARED: bulleted rule\n",
    )
    assert _run(repo, "--range", "HEAD~1..HEAD").returncode == 0
    assert "| #4303 | bulleted rule |" in (repo / LOG).read_text(encoding="utf-8")


def test_a_long_declaration_is_logged_in_full(repo: Path) -> None:
    """#3268 fault 2: no silent cut at 300 characters."""
    text = " ".join(f"word{i}" for i in range(80))
    assert len(text) > 400
    _commit(repo, f"docs(rules): long (#4304)\n\nRULE-CHANGE DECLARED: {text}\n")
    assert _run(repo, "--range", "HEAD~1..HEAD").returncode == 0
    assert f"| #4304 | {text} |" in (repo / LOG).read_text(encoding="utf-8")


def test_a_merge_commit_names_the_pr_of_a_branch_commit(repo: Path) -> None:
    """The 12 rows merged with a merge commit (#3252): the branch commit
    has no ``(#N)``; the ``Merge pull request #N`` commit that brought it
    onto develop names the PR."""
    _git(repo, "checkout", "-q", "-b", "feat/x")
    _commit(repo, "docs(rules): branch work\n\nRULE-CHANGE DECLARED: merged via merge commit\n")
    _git(repo, "checkout", "-q", "develop")
    _commit(repo, "chore: develop moved on", path="b.txt")
    _git(repo, "merge", "-q", "--no-ff", "-m", "Merge pull request #4305 from t/feat/x", "feat/x")
    assert _run(repo, "--range", "HEAD~2..HEAD").returncode == 0
    assert "| #4305 | merged via merge commit |" in (repo / LOG).read_text(encoding="utf-8")


def test_pr_override_names_the_pr_on_a_pull_request_run(repo: Path) -> None:
    """On a pull_request event neither the squash subject nor the merge
    commit exists yet; ``--pr`` supplies the number the event knows."""
    _git(repo, "checkout", "-q", "-b", "feat/y")
    _commit(repo, "docs(rules): branch work\n\nRULE-CHANGE DECLARED: declared on a branch\n")
    result = _run(repo, "--range", "develop..HEAD", "--pr", "4306", "--check")
    assert result.returncode == 1
    assert "#4306" in result.stderr
    assert _run(repo, "--range", "develop..HEAD", "--pr", "4306").returncode == 0
    assert "| #4306 | declared on a branch |" in (repo / LOG).read_text(encoding="utf-8")


def test_a_legacy_row_matches_its_sha_by_prefix(repo: Path) -> None:
    """A commit without any PR (pre-2026-08-06 direct push) is keyed by
    sha; the row's abbreviation may be shorter than git's current one
    (#3252 fault 2)."""
    sha = _commit(
        repo, "docs(rules): direct push\n\nRULE-CHANGE DECLARED: pushed straight to develop\n"
    )
    (repo / LOG).parent.mkdir(parents=True, exist_ok=True)
    (repo / LOG).write_text(
        "| Date | Commit | PR | Declared change |\n|---|---|---|---|\n"
        "| 2026-09-29 | `0000000` | #4242 | the backup round-trip is mandatory again |\n"
        f"| 2026-09-29 | `{sha[:7]}` | legacy | pushed straight to develop |\n",
        encoding="utf-8",
    )
    result = _run(repo, "--range", "HEAD~2..HEAD", "--check")
    assert result.returncode == 0, result.stderr


def test_duplicate_rows_are_reported(repo: Path) -> None:
    (repo / LOG).parent.mkdir(parents=True, exist_ok=True)
    (repo / LOG).write_text(
        "| Date | Commit | PR | Declared change |\n|---|---|---|---|\n"
        "| 2026-09-29 | `0000000` | #4242 | the backup round-trip is mandatory again |\n"
        "| 2026-09-29 | `1111111` | #4242 | the backup round-trip is mandatory again |\n",
        encoding="utf-8",
    )
    result = _run(repo, "--range", "HEAD~1..HEAD", "--check")
    assert result.returncode == 1
    assert "DUPLICATE" in result.stderr


def test_the_real_log_is_complete_over_the_full_history() -> None:
    """The proof #3252 asks for: on develop, 0 missing and 0 duplicates."""
    head = subprocess.run(
        ["git", "rev-parse", "--verify", "-q", "origin/develop"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if head.returncode != 0:
        pytest.skip("origin/develop is not available in this checkout")
    result = _run(REPO_ROOT, "--range", "origin/develop", "--check")
    assert result.returncode == 0, result.stderr


def test_the_ci_step_fails_instead_of_warning() -> None:
    """#3252 fault 1: the step turned its failure into a ::warning::, so
    nothing below it was ever noticed. It now fails, and it runs on
    pull requests too, passing the PR number the event knows."""
    import yaml

    workflow = yaml.safe_load(
        (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    )
    steps = [
        step
        for job in workflow["jobs"].values()
        for step in job.get("steps", [])
        if step.get("name") == "Check the rule change log is current"
    ]
    assert len(steps) == 1, "the rule-change-log step is missing or duplicated"
    step = steps[0]
    assert "::warning::" not in step["run"]
    script_lines = [line for line in step["run"].splitlines() if "append_rule_change_log" in line]
    assert script_lines and all("||" not in line for line in script_lines)
    assert "pull_request" in step["if"]
    assert "--pr" in step["run"]
    assert "--check" in step["run"]


def test_pull_request_check_walks_the_pr_head_not_the_shallow_merge_commit() -> None:
    """#3506: on a pull_request run the checkout is the depth-1 synthetic merge
    commit, so a "base..HEAD" range held only that merge commit and the check
    never saw a declaring commit (#3480 and #3333 merged without a row). The
    step must fetch the PR head and walk base..head, and fail closed on an
    empty range."""
    ci = (Path(__file__).resolve().parents[2] / ".github" / "workflows" / "ci.yml").read_text(
        encoding="utf-8"
    )
    step = ci[ci.index("- name: Check the rule change log is current") :]
    step = step[: step.index("      - name:", 10)]
    pr_branch = "\n".join(
        line for line in step[: step.index("else")].splitlines() if not line.strip().startswith("#")
    )
    assert "github.event.pull_request.head.sha" in pr_branch
    assert "..HEAD" not in pr_branch
    assert "rev-list --count" in pr_branch
    assert '--pr-body "${PR_BODY:-}"' in pr_branch


def test_a_declaration_only_in_the_pr_body_is_checked(repo: Path) -> None:
    """#3506: a squash merge copies the PR body into the commit, so a
    declaration written only in the body reaches develop too. The PR-time
    check must read it (keyed by the PR number) and miss it in the log."""
    _commit(repo, "docs(rules): reword a rule")
    body = "Summary\n\nRULE-CHANGE DECLARED: the body-only declaration\n"
    result = _run(repo, "--range", "HEAD~1..HEAD", "--pr", "4400", "--pr-body", body, "--check")
    assert result.returncode == 1
    assert "#4400" in result.stderr
    assert "body-only declaration" in result.stderr


def test_a_declaration_in_body_and_commit_counts_once(repo: Path) -> None:
    """The same text in a commit and the PR body is one declaration."""
    body = "RULE-CHANGE DECLARED: the backup round-trip is mandatory again\n"
    assert _run(repo, "--range", "HEAD~1..HEAD", "--pr", "4242", "--pr-body", body).returncode == 0
    log = (repo / LOG).read_text(encoding="utf-8")
    assert log.count("mandatory again") == 1
