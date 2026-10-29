#!/usr/bin/env python3
"""Pre-commit hook: each touched plugin's poetry.lock matches its pyproject.toml.

Guards the failure shape of the v0.30.0 release: a plugin's dependencies
changed in ``plugins/adaptive-learner-plugin-<name>/pyproject.toml`` without
``poetry lock`` in that directory, so the plugin's own lock went stale while
``make test`` stayed green through the backend's combined lock
(lessons/backend.md "Two installation paths diverge").

#3657 - the hook used to check the STAGING: a staged pyproject had to come
with a staged lock (``git diff --cached``). In CI the pre-commit job runs
``--all-files`` with nothing staged, so it examined nothing and reported
success, and a lock that went stale in an earlier commit passed every later
one. It now checks the STATE: ``poetry check --lock`` per plugin, which fails
exactly when the pyproject changed significantly since the lock was written.
That works the same locally and in CI, needs no carve-out for the version-only
bumps of ``make sync-versions`` (poetry keeps ``version`` out of the lock's
content-hash, #1903), and catches a stale lock however it got there.

Pre-commit passes every matching ``pyproject.toml`` / ``poetry.lock`` path;
each plugin directory is checked once.

Exits:
  0 - every plugin passed (or no plugin path was given)
  1 - at least one plugin's lock is missing or stale
  2 - poetry is not available, so nothing could be checked (fails closed)
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

PLUGIN_FILE_RE = re.compile(
    r"^(plugins/adaptive-learner-plugin-[^/]+)/(pyproject\.toml|poetry\.lock)$"
)


def plugin_dirs(paths: list[str]) -> list[str]:
    """The distinct plugin directories named by the given file paths."""
    dirs = {m.group(1) for p in paths if (m := PLUGIN_FILE_RE.match(p.replace("\\", "/")))}
    return sorted(dirs)


def lock_problem(plugin_dir: Path) -> str | None:
    """Why ``plugin_dir``'s lock does not match its pyproject, or ``None``."""
    if not (plugin_dir / "poetry.lock").is_file():
        return "no poetry.lock"
    result = subprocess.run(
        ["poetry", "check", "--lock", "--no-interaction"],
        cwd=plugin_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0:
        return None
    errors = [
        line for line in (result.stdout + result.stderr).splitlines() if line.startswith("Error")
    ]
    return errors[0] if errors else f"poetry check --lock exited {result.returncode}"


def main(argv: list[str]) -> int:
    dirs = plugin_dirs(argv)
    if not dirs:
        return 0
    if shutil.which("poetry") is None:
        print("plugin-lock: FAIL-CLOSED: poetry is not available, no plugin lock was checked")
        return 2
    failures = [(d, problem) for d in dirs if (problem := lock_problem(Path(d))) is not None]
    for plugin, problem in failures:
        name = plugin.rsplit("/", 1)[-1]
        print(f"plugin-lock: {plugin}: {problem}")
        print(
            f"  fix: cd {plugin} && poetry lock  (or: make lock-all-plugins); commit the lock ({name})"
        )
    print(
        f"plugin-lock: checked {len(dirs)} plugin(s), {len(failures)} with a stale or missing lock"
    )
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
