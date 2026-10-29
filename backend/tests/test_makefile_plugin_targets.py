"""``make test-plugins`` runs every plugin directory (#3447).

The target lists its per-plugin targets by hand. Nothing compared that
list with ``plugins/``, so a new plugin's tests would run nowhere: not in
``make test`` and not in CI, which calls the same target.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PREFIX = "adaptive-learner-plugin-"


def _makefile() -> str:
    return (REPO_ROOT / "Makefile").read_text(encoding="utf-8")


def _listed_plugins(makefile: str) -> list[str]:
    match = re.search(r"^test-plugins:([^#\n]*)", makefile, re.MULTILINE)
    assert match, "no test-plugins target in the Makefile"
    return sorted(t.removeprefix("test-plugin-") for t in match.group(1).split())


def _plugin_dirs() -> list[str]:
    return sorted(
        path.name.removeprefix(PREFIX)
        for path in (REPO_ROOT / "plugins").glob(f"{PREFIX}*")
        if (path / "tests").is_dir()
    )


def test_test_plugins_lists_every_plugin_with_tests() -> None:
    plugins = _plugin_dirs()
    # #2083 point 4: never pass on an empty set.
    assert len(plugins) > 10, f"only {len(plugins)} plugin directories found"
    assert _listed_plugins(_makefile()) == plugins


def test_every_listed_target_is_defined() -> None:
    makefile = _makefile()
    missing = [
        name
        for name in _listed_plugins(makefile)
        if not re.search(rf"^test-plugin-{re.escape(name)}:", makefile, re.MULTILINE)
    ]
    assert missing == []


def test_the_parser_reads_the_prerequisites() -> None:
    sample = "test-plugins: test-plugin-a test-plugin-b ## run all\n"
    assert _listed_plugins(sample) == ["a", "b"]
