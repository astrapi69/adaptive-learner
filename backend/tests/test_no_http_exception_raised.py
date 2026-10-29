"""Routers and services raise domain errors, never HTTPException (#3423).

code-hygiene.md: services throw ``AdaptiveLearnerError`` subclasses and
routers catch nothing; the global handler maps a domain error to its status.
Two routers still raised ``HTTPException`` (the reset confirmation and the
missing identity). This scan keeps the class at zero across ``backend/app``
and every plugin package.
"""

from __future__ import annotations

import ast
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def _production_files() -> list[Path]:
    files = list((REPO_ROOT / "backend" / "app").rglob("*.py"))
    for package in (REPO_ROOT / "plugins").glob("adaptive-learner-plugin-*/adaptive_learner_*"):
        files.extend(package.rglob("*.py"))
    return files


def http_exception_raises(source: str, label: str) -> list[str]:
    """``label:line`` of every ``raise ...HTTPException(...)``."""
    found = []
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Raise) or not isinstance(node.exc, ast.Call):
            continue
        func = node.exc.func
        name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", "")
        if name.endswith("HTTPException"):
            found.append(f"{label}:{node.lineno}")
    return found


def test_no_http_exception_is_raised() -> None:
    files = _production_files()
    # #2083 point 4: report the set size, never pass on an empty scan.
    assert len(files) > 150, f"only {len(files)} production files scanned"
    raises = [
        hit
        for path in files
        for hit in http_exception_raises(
            path.read_text(encoding="utf-8"), str(path.relative_to(REPO_ROOT))
        )
    ]
    assert raises == [], f"{len(files)} files scanned"


def test_the_scan_finds_both_spellings() -> None:
    source = """
raise HTTPException(status_code=400, detail="x")
raise fastapi.HTTPException(404)
raise ValidationError("fine")
"""
    assert http_exception_raises(source, "x.py") == ["x.py:2", "x.py:3"]
