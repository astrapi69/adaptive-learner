"""``make install`` sets up every environment ``make release-test`` needs (#3903).

``verify-mkdocs-nav`` runs in the docs venv and is part of the release gate
(``release-test`` -> ``verify-docs-discipline``), but ``make install`` did not
install ``docs/``. In a fresh worktree the gate stopped there with
``ModuleNotFoundError: No module named 'yaml'`` (the v2.17.1 hotfix,
2026-10-29). Pins both halves, so neither can change alone.
"""

from __future__ import annotations

import re
from pathlib import Path

MAKEFILE = Path(__file__).resolve().parents[2] / "Makefile"


def _target(name: str) -> tuple[list[str], str]:
    """Return the prerequisites and the recipe of one Makefile target."""
    lines = MAKEFILE.read_text(encoding="utf-8").splitlines()
    for index, line in enumerate(lines):
        match = re.match(rf"^{re.escape(name)}:(?P<deps>[^#=]*)", line)
        if not match:
            continue
        recipe = []
        for body in lines[index + 1 :]:
            if not body.startswith("\t"):
                break
            recipe.append(body.strip())
        return match.group("deps").split(), "\n".join(recipe)
    raise AssertionError(f"Makefile has no target {name!r}")


def test_the_release_gate_checks_the_docs_nav_in_the_docs_venv() -> None:
    deps, recipe = _target("verify-docs-discipline")
    assert "verify-mkdocs-nav" in recipe or "verify-mkdocs-nav" in deps
    _, nav = _target("verify-mkdocs-nav")
    assert "cd docs && poetry run" in nav


def test_make_install_installs_the_docs_venv() -> None:
    deps, _ = _target("install")
    assert "docs-install" in deps, "make install leaves the release gate's docs venv missing"
    _, recipe = _target("docs-install")
    assert "cd docs && poetry install" in recipe
