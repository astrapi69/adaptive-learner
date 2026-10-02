#!/usr/bin/env python3
"""Name the backend tests that exercise scripts/ or plugins/ (#3250).

``pytest --testmon`` builds its dependency graph from Python coverage of
``backend/app`` and ``backend/tests`` only, so a PR that changes a file
under ``scripts/`` or ``plugins/`` selects no test on a selective run,
although backend tests drive those scripts as subprocesses and load the
plugins through PluginForge. CI ran such pushes with "no tests ran" (run
36006903648). This selects those tests by what their source names, the
way testmon never can: a test that reaches into ``scripts/`` spells the
directory (``REPO / "scripts"``, ``../scripts/x.py``), a test that loads
a plugin imports ``adaptive_learner_<name>`` or spells ``plugins/``.
Over-selection costs a few seconds; under-selection is the bug.

Prints one test path per line on stdout; the count goes to stderr. Exits 1
when an area selects nothing (fail closed, #2083): a change to an area no
test names is a finding, not a pass.

Usage::

    python3 scripts/select_impacted_tests.py scripts
    python3 scripts/select_impacted_tests.py scripts plugins --tests-dir backend/tests
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

AREA_PATTERNS: dict[str, re.Pattern[str]] = {
    "scripts": re.compile(r"(?<![A-Za-z0-9_])scripts(?![A-Za-z0-9_])"),
    "plugins": re.compile(r"adaptive_learner_[a-z0-9_]+|(?<![A-Za-z0-9_])plugins(?![A-Za-z0-9_])"),
}


def select(tests_dir: Path, area: str) -> list[str]:
    """Test files under ``tests_dir`` whose source names the area."""
    pattern = AREA_PATTERNS[area]
    return sorted(
        path.as_posix()
        for path in tests_dir.glob("test_*.py")
        if pattern.search(path.read_text(encoding="utf-8"))
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("areas", nargs="+", choices=sorted(AREA_PATTERNS))
    parser.add_argument("--tests-dir", default="tests", help="the backend tests directory")
    args = parser.parse_args()
    tests_dir = Path(args.tests_dir)
    if not tests_dir.is_dir():
        print(f"{tests_dir} is not a directory - nothing to select from", file=sys.stderr)
        return 1
    selected: list[str] = []
    for area in dict.fromkeys(args.areas):
        files = select(tests_dir, area)
        print(f"impacted tests: {len(files)} files name {area}/", file=sys.stderr)
        if not files:
            print(
                f"no test under {tests_dir} names {area}/ - refusing to run nothing",
                file=sys.stderr,
            )
            return 1
        selected.extend(f for f in files if f not in selected)
    print("\n".join(selected))
    return 0


if __name__ == "__main__":
    sys.exit(main())
