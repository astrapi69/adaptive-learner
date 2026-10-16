"""``make release-outdated`` reports every dependency surface (#3778).

Release Step 4b used to list three surfaces by hand (backend, launcher,
frontend) while the repository had twenty, so the 14 plugins, ``docs/``,
``e2e/``, the pre-commit revs, the GitHub Actions and the base images were
reported by nothing before a release. ``scripts/release_outdated.py`` finds the
package surfaces itself, so a new one cannot be left out; these tests hold its
pure parts.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "release_outdated.py"
_spec = importlib.util.spec_from_file_location("release_outdated", SCRIPT)
assert _spec and _spec.loader
release_outdated = importlib.util.module_from_spec(_spec)
sys.modules["release_outdated"] = release_outdated
_spec.loader.exec_module(release_outdated)


def test_every_package_surface_of_the_repository_is_found() -> None:
    surfaces = release_outdated.package_surfaces(REPO_ROOT)
    poetry = {s.relative_to(REPO_ROOT).as_posix() for s in surfaces["poetry"]}
    bun = {s.relative_to(REPO_ROOT).as_posix() for s in surfaces["bun"]}
    assert {"backend", "launcher", "docs"} <= poetry
    assert {"frontend", "e2e"} <= bun
    plugins = [p for p in poetry if p.startswith("plugins/")]
    # Never pass on a blind scan (#2083 point 4).
    assert len(plugins) > 10, f"only {len(plugins)} plugin surfaces found"


def test_surfaces_skip_dependency_and_fixture_trees(tmp_path: Path) -> None:
    for rel in (
        "app/package.json",
        "app/node_modules/x/package.json",
        "lib/pyproject.toml",
        "lib/tests/fixtures/pyproject.toml",
    ):
        path = tmp_path / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("{}" if rel.endswith(".json") else "[tool.poetry]\n", encoding="utf-8")
    surfaces = release_outdated.package_surfaces(tmp_path)
    assert [s.name for s in surfaces["bun"]] == ["app"]
    assert [s.name for s in surfaces["poetry"]] == ["lib"]


def test_precommit_hook_revs_are_read() -> None:
    text = """repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v6.0.0
    hooks:
      - id: trailing-whitespace
  - repo: local
    hooks:
      - id: x
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.17.0
"""
    assert release_outdated.precommit_revs(text) == [
        ("https://github.com/pre-commit/pre-commit-hooks", "v6.0.0"),
        ("https://github.com/astral-sh/ruff-pre-commit", "v0.17.0"),
    ]


def test_action_refs_are_collected_once_each() -> None:
    texts = [
        "      - uses: actions/checkout@v5\n      - uses: oven-sh/setup-bun@v2\n",
        "      - uses: actions/checkout@v5\n      - uses: ./.github/actions/local\n      - uses: github/codeql-action/init@v4\n",
    ]
    assert release_outdated.action_refs(texts) == [
        ("actions/checkout", "v5"),
        ("github/codeql-action", "v4"),
        ("oven-sh/setup-bun", "v2"),
    ]


def test_newest_tag_ignores_prereleases_and_sorts_numerically() -> None:
    tags = ["v0.9.0", "v0.17.0", "v0.16.10", "v0.18.0-rc.1", "latest", "v0.17.0^{}"]
    assert release_outdated.newest_tag(tags) == "v0.17.0"


def test_from_lines_are_listed() -> None:
    text = "FROM node:24-slim AS frontend-build\nRUN x\nFROM python:3.12-slim\n"
    assert release_outdated.from_lines(text) == [
        "node:24-slim AS frontend-build",
        "python:3.12-slim",
    ]


def test_a_major_ref_is_behind_only_on_a_newer_major() -> None:
    # Actions pin the major (``@v5``); a v5.x patch is not news, a v6 is.
    assert release_outdated.is_behind("v5", "v5.0.1") is False
    assert release_outdated.is_behind("v5", "v6.0.0") is True


def test_an_exact_rev_is_behind_on_any_newer_version() -> None:
    assert release_outdated.is_behind("v0.17.0", "v0.17.1") is True
    assert release_outdated.is_behind("v0.17.0", "v0.17.0") is False
    assert release_outdated.is_behind("v0.17.0", None) is False
