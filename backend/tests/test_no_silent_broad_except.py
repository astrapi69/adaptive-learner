"""No broad ``except`` swallows an exception without a trace (#3423).

#337 added logging to seven silent plugin handlers; new ones accumulated,
mostly where an AI-provider failure becomes a fallback value, so invalid
keys, rate limits and timeouts left no server trace. This scan makes the
next one fail: a handler for ``Exception`` / ``BaseException`` / a bare
``except`` in ``backend/app`` or a plugin package must log or re-raise.
"""

from __future__ import annotations

import ast
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
_LOG_METHODS = {"exception", "error", "warning", "info", "debug", "critical"}


def _production_files() -> list[Path]:
    files = list((REPO_ROOT / "backend" / "app").rglob("*.py"))
    for package in (REPO_ROOT / "plugins").glob("adaptive-learner-plugin-*/adaptive_learner_*"):
        files.extend(package.rglob("*.py"))
    return files


def _is_broad(handler: ast.ExceptHandler) -> bool:
    kind = handler.type
    if kind is None:
        return True
    names = kind.elts if isinstance(kind, ast.Tuple) else [kind]
    return any(isinstance(n, ast.Name) and n.id in {"Exception", "BaseException"} for n in names)


def _leaves_a_trace(handler: ast.ExceptHandler) -> bool:
    for node in ast.walk(handler):
        if isinstance(node, ast.Raise):
            return True
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in _LOG_METHODS
        ):
            return True
    return False


def silent_broad_handlers(source: str, label: str) -> list[str]:
    """``label:line`` of every broad handler that neither logs nor raises."""
    found = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.ExceptHandler) and _is_broad(node) and not _leaves_a_trace(node):
            found.append(f"{label}:{node.lineno}")
    return found


def test_no_broad_except_swallows_silently() -> None:
    files = _production_files()
    # #2083 point 4: report the set size, never pass on an empty scan.
    assert len(files) > 150, f"only {len(files)} production files scanned"
    silent = [
        hit
        for path in files
        for hit in silent_broad_handlers(
            path.read_text(encoding="utf-8"), str(path.relative_to(REPO_ROOT))
        )
    ]
    assert silent == [], f"{len(files)} files scanned"


def test_the_scan_classifies_handlers() -> None:
    source = """
try:
    a()
except Exception:
    pass
try:
    b()
except (ValueError, Exception):
    return_value = None
try:
    c()
except Exception:
    logger.warning("c failed", exc_info=True)
try:
    d()
except ValueError:
    pass
try:
    e()
except:
    raise
"""
    assert silent_broad_handlers(source, "x.py") == ["x.py:4", "x.py:8"]
