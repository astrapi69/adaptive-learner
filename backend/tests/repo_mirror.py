"""Repo mirror for gate tests that must write into the tree (#3036).

A gate script reads the repository; a test that wants to break exactly one
thing needs a copy it may mutate. The mirror symlinks every top-level entry
of the repo (read-only, nothing in the real tree is touched) and copies only
the surfaces a test writes into.

``.claude`` is special: the gates read ``.claude/rules/**`` and nothing else
under it, while Claude Code parks agent worktrees under
``.claude/worktrees/<agent>/`` - full checkouts with their own
``frontend/node_modules``. Copying ``.claude`` wholesale once turned a
``make test`` into a million-file copy that filled the tmpfs inode table, so
the mirror copies ``.claude/rules`` only and counts what it copied.
"""

from __future__ import annotations

import shutil
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

DEFAULT_MUTABLE: tuple[str, ...] = ("scripts", "Makefile", "CLAUDE.md", ".complexity-baseline")

# The honest mirror is scripts (~100 files) + .claude/rules (~30) + a few
# root files. One leaked worktree adds tens of thousands; one node_modules
# adds a hundred thousand. Anything above this is a leak, not growth.
MIRROR_FILE_CEILING = 1000

_CLAUDE_COPIED_SUBTREES: tuple[str, ...] = ("rules",)


@dataclass(frozen=True)
class MirrorResult:
    """Where the mirror lives and how many regular files were copied."""

    root: Path
    copied_files: int


def _copy_tree_counting(source: Path, target: Path) -> int:
    shutil.copytree(source, target, symlinks=True)
    return sum(1 for p in target.rglob("*") if p.is_file() and not p.is_symlink())


def _mirror_claude(source: Path, target: Path) -> int:
    """Copy only the subtrees the gates read; skip worktrees, settings, prompts."""
    target.mkdir()
    copied = 0
    for name in _CLAUDE_COPIED_SUBTREES:
        subtree = source / name
        if subtree.is_dir():
            copied += _copy_tree_counting(subtree, target / name)
    return copied


def mirror_repo(
    target: Path,
    *,
    repo_root: Path = REPO_ROOT,
    mutable: Iterable[str] = DEFAULT_MUTABLE,
) -> MirrorResult:
    """Mirror ``repo_root`` into the empty directory ``target``.

    Every top-level entry becomes a symlink except ``.git`` (skipped), the
    ``mutable`` entries (real copies) and ``.claude`` (only ``.claude/rules``
    is copied). Raises ``FileExistsError`` when ``target`` already holds
    anything, so two fixtures can never merge into one tree by accident.

    Returns:
        ``MirrorResult`` with the mirror root and the number of regular
        files copied (symlink targets are not counted).
    """
    if any(target.iterdir()):
        raise FileExistsError(f"mirror target is not empty: {target}")
    wanted = set(mutable)
    copied = 0
    for entry in sorted(repo_root.iterdir()):
        destination = target / entry.name
        if entry.name == ".git":
            continue
        if entry.name == ".claude":
            copied += _mirror_claude(entry, destination)
        elif entry.name in wanted:
            if entry.is_dir():
                copied += _copy_tree_counting(entry, destination)
            else:
                shutil.copy2(entry, destination)
                copied += 1
        else:
            destination.symlink_to(entry)
    return MirrorResult(root=target, copied_files=copied)
