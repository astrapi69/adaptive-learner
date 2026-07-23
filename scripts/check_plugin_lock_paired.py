#!/usr/bin/env python3
"""Pre-commit hook: a staged plugin pyproject.toml must be paired with its poetry.lock.

Sub-task 2 of PLUGIN-LOCKFILE-DRIFT-01. Catches the operational
mistake that produced the v0.30.0 release CI red-on-main: editing
``plugins/adaptive-learner-plugin-<name>/pyproject.toml`` without running
``poetry lock`` in the same plugin directory before committing.

The shape — `make test` green but per-plugin CI red — is documented
in `.claude/rules/lessons-learned.md` "Two installation paths
diverge: `make test` vs per-plugin CI". The backend's combined
``poetry.lock`` can satisfy a path-dep install while each plugin's
own ``poetry.lock`` lags. CI runs `poetry install --no-interaction`
per plugin and aborts when the lockfile is stale.

Pre-commit framework invokes this hook with each staged
``plugins/adaptive-learner-plugin-<name>/pyproject.toml`` path as a
positional argument (scoped via ``files:`` regex in
``.pre-commit-config.yaml``). For each such path, the hook checks
whether the corresponding ``poetry.lock`` in the same plugin
directory is also staged in the current commit (consulting
``git diff --cached --name-only``). If pyproject is staged without
its lock, the hook fails with a remediation hint pointing at
``make lock-plugin-<name>`` (deferred per Q1) or
``make lock-all-plugins``.

Per the pre-inspection Q2 conservative scope: the hook only checks
the pyproject-staging direction. Lockfile-only changes (e.g. as a
follow-up commit after `poetry lock`) are valid and do not trigger.

#1903 — version-only carve-out. ``make sync-versions`` rewrites the
``version`` field of all 13 plugin pyprojects on every release, but
poetry does not fold that field into the lock's ``content-hash``:
``make lock-all-plugins`` right after a bump produces an empty diff,
so there is no lockfile to pair and the requirement is vacuous. Such
a diff is allowed through. The carve-out is deliberately narrow — it
is computed per staged diff, so a version bump that also touches a
dependency still demands the lock, and an ADDED pyproject never
qualifies. The v0.30.0 guard keeps its teeth; only the false alarm
goes away.

Exits:
  0 — every staged plugin pyproject is paired with its lockfile,
      is a version-only release bump, OR no plugin pyproject is staged
  1 — at least one plugin pyproject is staged without its lock
  2 — git command failed (defensive; hook can't operate)
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

PLUGIN_PYPROJECT_RE = re.compile(r"^plugins/adaptive-learner-plugin-[^/]+/pyproject\.toml$")
# 1903 — a diff that only moves the ``version`` field needs no paired lock:
# poetry keeps that field out of the lock's content-hash, so ``poetry lock``
# produces an empty diff and there is nothing to stage alongside.
VERSION_LINE_RE = re.compile(r'^[+-]\s*version\s*=\s*"[^"]*"\s*$')


def _repo_root() -> Path:
    """Resolve the git repo root from the CURRENT directory.

    Deriving it from ``__file__`` would pin the hook to the checkout it
    happens to live in, which breaks under ``git worktree`` and makes the
    hook untestable against a throwaway repo. Pre-commit always invokes
    hooks from the repo root, so cwd is the authoritative answer.
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return Path(__file__).resolve().parent.parent
    return Path(result.stdout.strip())


REPO_ROOT = _repo_root()


def _staged_files() -> set[str]:
    """Return paths staged for the current commit (`git diff --cached --name-only`)."""
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            check=True,
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        print(
            f"ERROR: could not enumerate staged files via git: {exc}",
            file=sys.stderr,
        )
        sys.exit(2)
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


def _is_version_only_change(path: str) -> bool:
    """Whether the staged diff for ``path`` moves nothing but the version field.

    ``make sync-versions`` rewrites ``version = "X.Y.Z"`` in all 13 plugin
    pyprojects on every release. Poetry does not fold that field into the
    lock's ``content-hash``, so ``make lock-all-plugins`` yields an empty diff
    and the pairing requirement is vacuous (verified during the v2.5.0 release;
    the v2.4.0 bump 5e63588 carried no lockfiles for the same reason).

    Conservative by construction: an added file, an unreadable diff, or ANY
    changed line that is not a version assignment returns ``False``, so the
    dependency guard keeps its teeth.

    Args:
        path: Repo-relative path of a staged plugin ``pyproject.toml``.

    Returns:
        ``True`` only when every added/removed line is a ``version = "..."``
        assignment and the file already existed in HEAD.
    """
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "-U0", "--", path],
            check=True,
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

    changed: list[str] = []
    for line in result.stdout.splitlines():
        if line.startswith(("+++", "---")):
            continue
        if line.startswith("new file mode"):
            # An added pyproject has no prior version to compare against.
            return False
        if line.startswith(("+", "-")):
            changed.append(line)

    return bool(changed) and all(VERSION_LINE_RE.match(line) for line in changed)


def _normalize(arg: str) -> str:
    """Normalize a hook-supplied path to a repo-relative POSIX string.

    Pre-commit passes paths relative to repo root, but defensively
    handle absolute paths or paths with leading "./".
    """
    p = Path(arg)
    if p.is_absolute():
        try:
            p = p.relative_to(REPO_ROOT)
        except ValueError:
            return arg
    return p.as_posix().lstrip("./") or arg


def main(argv: list[str]) -> int:
    if not argv:
        # The `files:` regex in .pre-commit-config.yaml matched
        # nothing; nothing to check.
        return 0

    staged = _staged_files()
    if not staged:
        # No commit is happening — argv was supplied by something
        # other than a real `git commit` (e.g. `pre-commit run
        # --all-files` running in CI's "Run hooks on all files"
        # step, which passes every matching file as argv but does
        # NOT stage anything). The hook's contract — "a staged
        # plugin pyproject must be paired with its staged lock" —
        # is vacuous when nothing is staged. Skip silently.
        return 0

    missing: list[tuple[str, str]] = []  # (pyproject_path, expected_lock_path)

    for arg in argv:
        path = _normalize(arg)
        if not PLUGIN_PYPROJECT_RE.match(path):
            # Not a plugin pyproject (defensive — the files: regex
            # should already exclude these).
            continue
        plugin_dir = path.rsplit("/", 1)[0]
        lock_path = f"{plugin_dir}/poetry.lock"
        if lock_path in staged:
            continue
        if _is_version_only_change(path):
            # Release bump (#1903) — nothing for poetry to re-lock.
            continue
        missing.append((path, lock_path))

    if not missing:
        return 0

    print(
        "ERROR: plugin pyproject.toml staged without its paired poetry.lock:",
        file=sys.stderr,
    )
    for pyproject, lock in missing:
        print(f"  - {pyproject}", file=sys.stderr)
        print(f"    expected to be staged alongside: {lock}", file=sys.stderr)

    print(
        "\nThis pattern produced the v0.30.0 release CI red-on-main: a "
        "shared-dep pin (fastapi 0.135 -> 0.136) bumped in every plugin's "
        "pyproject.toml but only the backend lock was regenerated. CI runs "
        "`poetry install --no-interaction` per plugin against THAT plugin's "
        "own poetry.lock and fails the moment pyproject drifts from lock.",
        file=sys.stderr,
    )
    print(
        "\nFix:\n"
        "  1. Run `make lock-all-plugins` (re-locks every plugin), OR\n"
        "     `cd <plugin-dir> && poetry lock` for a single plugin.\n"
        "  2. `git add <plugin-dir>/poetry.lock` to stage the regenerated\n"
        "     lockfile alongside the pyproject change.\n"
        "  3. Re-run the commit; this hook will pass.\n"
        "\nSee .claude/rules/lessons-learned.md "
        '"Two installation paths diverge: `make test` vs per-plugin CI".',
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
