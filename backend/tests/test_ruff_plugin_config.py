"""Pre-commit and CI judge plugin code with the same ruff settings (#3658).

CI runs ruff from ``backend/``, so plugin files fall back to the backend's
``pyproject.toml``. Pre-commit runs from the repo root, where the plugins have
no ruff config and ruff would use its defaults (line length 88), so the plugin
hooks pass ``--config=backend/pyproject.toml``. That alone sorted ``app``
imports differently (first-party only from ``backend/``); the backend config
names it in ``known-first-party``. These tests run ruff both ways on the same
source and require the same result.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
PLUGIN_FILE = "plugins/adaptive-learner-plugin-missions/adaptive_learner_missions/example.py"

SOURCE = """from typing import Any

from app.database import get_db
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from . import service


def handler(db: Session = Depends(get_db)) -> Any:
    return service, APIRouter, db, "a fairly long string literal that only fits within one hundred"
"""


def _ruff(cwd: Path, *args: str) -> str:
    result = subprocess.run(
        [sys.executable, "-m", "ruff", *args],
        cwd=cwd,
        input=SOURCE,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.stdout, result.stderr
    return result.stdout


@pytest.mark.parametrize(
    "command",
    [["check", "--fix", "--no-cache"], ["format"]],
    ids=["check-fix", "format"],
)
def test_root_with_backend_config_equals_backend_cwd(command: list[str]) -> None:
    from_backend = _ruff(REPO / "backend", *command, "--stdin-filename", f"../{PLUGIN_FILE}", "-")
    from_root = _ruff(
        REPO,
        *command,
        "--config=backend/pyproject.toml",
        "--stdin-filename",
        PLUGIN_FILE,
        "-",
    )
    assert from_root == from_backend


def test_backend_config_keeps_the_app_import_first_party() -> None:
    fixed = _ruff(
        REPO / "backend",
        "check",
        "--fix",
        "--no-cache",
        "--stdin-filename",
        f"../{PLUGIN_FILE}",
        "-",
    )
    assert "from sqlalchemy.orm import Session\n\nfrom app.database import get_db\n" in fixed
