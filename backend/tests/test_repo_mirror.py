"""#3036 - the repo mirror the gate tests write into must stay small.

Three gate tests (corpus ratchet, fail-closed, check inventory) mirror the
repo into ``tmp_path``: symlinks for everything they only read, real copies
for the surfaces they mutate. They copied ``.claude/`` wholesale, and Claude
Code parks agent worktrees under ``.claude/worktrees/<agent>/`` - full
checkouts with their own ``frontend/node_modules``. Eleven of those turned
one ``make test`` into a million-file copy that exhausted the tmpfs inodes.

The gates read exactly ``.claude/rules/**``; the shared ``mirror_repo`` helper
copies that subtree and nothing else of ``.claude``, and reports how many
files it copied so the size is a measured number, not an assumption (gate
contract point 4).
"""

from __future__ import annotations

from pathlib import Path

from tests.repo_mirror import MIRROR_FILE_CEILING, REPO_ROOT, mirror_repo


def test_mirror_copies_the_mutable_surfaces_and_links_the_rest(tmp_path: Path) -> None:
    result = mirror_repo(tmp_path)

    assert result.root == tmp_path
    for copied in (
        ".claude/rules/checks.yaml",
        ".claude/rules/gates.yaml",
        "scripts/verify_check_inventory.py",
        "CLAUDE.md",
        "Makefile",
    ):
        path = tmp_path / copied
        assert path.is_file(), copied
        assert not path.is_symlink(), f"{copied} must be a real copy, tests write into it"
    # A read-only surface is a symlink to the real tree, never a copy.
    assert (tmp_path / "docs").is_symlink()
    assert (tmp_path / "backend").is_symlink()
    assert not (tmp_path / ".git").exists()


def test_mirror_leaves_agent_worktrees_and_settings_behind(tmp_path: Path) -> None:
    fake_repo = tmp_path / "repo"
    (fake_repo / ".claude" / "rules").mkdir(parents=True)
    (fake_repo / ".claude" / "rules" / "checks.yaml").write_text("checks: []\n", encoding="utf-8")
    (fake_repo / ".claude" / "settings.json").write_text("{}\n", encoding="utf-8")
    leaf = fake_repo / ".claude" / "worktrees" / "agent-x" / "frontend" / "node_modules" / "leaf.js"
    leaf.parent.mkdir(parents=True)
    leaf.write_text("// never copied\n", encoding="utf-8")
    (fake_repo / "scripts").mkdir()
    (fake_repo / "scripts" / "gate.py").write_text("print('gate')\n", encoding="utf-8")
    (fake_repo / "CLAUDE.md").write_text("# fake\n", encoding="utf-8")
    (fake_repo / "docs").mkdir()

    target = tmp_path / "mirror"
    target.mkdir()
    result = mirror_repo(target, repo_root=fake_repo)

    assert (target / ".claude" / "rules" / "checks.yaml").is_file()
    assert not (target / ".claude" / "worktrees").exists()
    assert not (target / ".claude" / "settings.json").exists()
    assert (target / "docs").is_symlink()
    assert result.copied_files == 3  # checks.yaml, gate.py, CLAUDE.md


def test_mirror_of_the_real_repo_stays_under_the_ceiling(tmp_path: Path) -> None:
    """A worktree or a node_modules slipping back in adds tens of thousands
    of files; the ceiling turns that into a red test instead of a full disk."""
    result = mirror_repo(tmp_path)
    assert 50 < result.copied_files < MIRROR_FILE_CEILING, result.copied_files
    assert result.copied_files == sum(
        1 for p in tmp_path.rglob("*") if p.is_file() and not p.is_symlink()
    )


def test_mirror_refuses_a_target_that_is_not_empty(tmp_path: Path) -> None:
    (tmp_path / "leftover").write_text("x\n", encoding="utf-8")
    try:
        mirror_repo(tmp_path)
    except FileExistsError:
        return
    raise AssertionError("a non-empty target must be refused, not merged into")


def test_real_repo_has_no_worktrees_checked_in() -> None:
    """The directory Claude Code uses for agent worktrees is not content."""
    ignored = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert "/.claude/worktrees/" in ignored
