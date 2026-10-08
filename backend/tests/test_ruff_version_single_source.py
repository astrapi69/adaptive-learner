"""ruff has one version: the pre-commit hook pins what the backend lock pins (#3656).

``.pre-commit-config.yaml`` installs ruff from ``astral-sh/ruff-pre-commit`` at
its ``rev``; CI and ``make test-fast`` run the ruff that ``backend/poetry.lock``
resolves. Two version sources drift: v0.15.11 and 0.16.x judged BLE001
differently in #3625, which then needed a ``noqa`` only one of them wanted.
This test fails when the two disagree, so bumping one without the other
turns red instead of making pre-commit and CI disagree on the same code.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def _precommit_rev() -> str:
    text = (REPO / ".pre-commit-config.yaml").read_text(encoding="utf-8")
    match = re.search(
        r"repo:\s*https://github\.com/astral-sh/ruff-pre-commit\s+rev:\s*v?(\S+)", text
    )
    assert match, "no astral-sh/ruff-pre-commit entry in .pre-commit-config.yaml"
    return match.group(1)


def _locked_version() -> str:
    lock = tomllib.loads((REPO / "backend" / "poetry.lock").read_text(encoding="utf-8"))
    versions = [pkg["version"] for pkg in lock["package"] if pkg["name"] == "ruff"]
    assert versions, "ruff is not in backend/poetry.lock"
    return versions[0]


def test_precommit_ruff_matches_the_backend_lock() -> None:
    assert _precommit_rev() == _locked_version(), (
        "the pre-commit ruff rev and the backend poetry.lock ruff differ; bump both together"
    )
