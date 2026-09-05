#!/usr/bin/env python3
"""Test-count drift check for the docs verifier (extracted #2946).

Split out of ``scripts/verify_docs.py`` so the verifier stays under the
cohesion file-size gate: a mixed-concern verifier belongs in smaller modules,
not on the .filesize-whitelist (which is for single-concern data/config
files). This module owns exactly one check - the CLAUDE.md/README test-count
consistency + drift check, including the real pytest-collection helpers - and
needs no ``verify_docs`` internals besides the ``Report`` type, so importing
it back into ``verify_docs`` is import-cycle-free.

Stdlib only, like its parent (bare ``python3`` in CI before any venv exists).
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from verify_docs import Report

REPO = Path(__file__).resolve().parent.parent

# Matches the CLAUDE.md baseline line, e.g.
#   backend 1025 (+1 skipped) + plugins 950 + Vitest 2503 = **4478 tests**
# Bold around the total is optional since the #2071 reflow.
TEST_COUNT_RE = r"backend (\d+).*?\+ plugins\s+(\d+) \+ Vitest (\d+) = \*{0,2}(\d+) tests\*{0,2}"
# README/README-de test badge, e.g. badge/tests-2634%20green  /  ...-2634%20grün
TEST_BADGE_RE = r"badge/tests-(\d+)%20"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _replace_group(text: str, pattern: str, value: str) -> tuple[str, int]:
    """Replace capture group 1 of the first match with ``value``.

    Returns ``(new_text, n_replacements)``. Used by --fix to swap a
    stale token in place without disturbing the surrounding text.
    """
    flags = re.DOTALL if "(?s)" not in pattern else 0

    def repl(match: re.Match) -> str:
        whole = match.group(0)
        start = match.start(1) - match.start(0)
        end = match.end(1) - match.start(0)
        return whole[:start] + value + whole[end:]

    return re.subn(pattern, repl, text, count=1, flags=flags)


def check_test_counts(report: Report, fix: bool, run_collection: bool) -> None:
    claude = REPO / "CLAUDE.md"
    text = _read(claude)
    match = re.search(TEST_COUNT_RE, text, re.DOTALL)
    if not match:
        report.warn(
            "test-counts",
            "CLAUDE.md: could not parse the 'backend N + plugins N + Vitest N = N tests' line",
        )
        return
    backend, plugins, vitest, total = (int(g) for g in match.groups())
    summed = backend + plugins + vitest

    # Cheap internal-consistency check: the parts must add up to the total.
    if summed != total:
        if fix:
            # Rewrite only the total token; the parts are the source of truth.
            new_text, n = re.subn(
                TEST_COUNT_RE,
                lambda m: m.group(0).replace(f"**{total} tests**", f"**{summed} tests**"),
                text,
                count=1,
                flags=re.DOTALL,
            )
            if n:
                claude.write_text(new_text, encoding="utf-8")
                report.warn(
                    "test-counts",
                    f"CLAUDE.md test total {total} -> {summed} (arithmetic auto-fixed)",
                    fixed=True,
                )
        else:
            report.warn(
                "test-counts",
                f"CLAUDE.md test total is {total} but {backend}+{plugins}+{vitest}={summed}",
            )

    consistent_total = summed  # the value the badge should mirror

    # README / README-de test badges should mirror the CLAUDE total.
    for rel in ("README.md", "README-de.md"):
        path = REPO / rel
        if not path.exists():
            continue
        rtext = _read(path)
        bmatch = re.search(TEST_BADGE_RE, rtext)
        if not bmatch:
            continue
        badge = int(bmatch.group(1))
        if badge == consistent_total:
            continue
        if fix:
            new_text, n = _replace_group(rtext, TEST_BADGE_RE, str(consistent_total))
            if n:
                path.write_text(new_text, encoding="utf-8")
                report.warn(
                    "test-counts",
                    f"{rel} test badge {badge} -> {consistent_total} (auto-fixed)",
                    fixed=True,
                )
                continue
        report.warn(
            "test-counts", f"{rel} test badge says {badge}, CLAUDE total is {consistent_total}"
        )

    if not run_collection:
        report.note(
            "test-counts: actual pytest/vitest collection skipped (pass --test-counts to enable the 5% drift check)"
        )
        return

    actual = _collect_actual_test_counts(report)
    if actual is None:
        return
    a_backend, a_plugins, a_vitest = actual
    for label, stated, real in (
        ("backend", backend, a_backend),
        ("plugins", plugins, a_plugins),
        ("Vitest", vitest, a_vitest),
    ):
        if real == 0:
            continue
        drift = abs(stated - real) / real
        if drift > 0.05:
            report.warn(
                "test-counts",
                f"CLAUDE.md {label} count {stated} drifts {drift:.0%} from actual {real} (>5%)",
            )


def collect_pytest_count(report: Report, cwd: Path, cmd: list[str]) -> int:
    """Run a pytest collection command in ``cwd`` and return the count.

    A collection error (wrong interpreter, missing dependency, ...) never
    silently reads as 0 - it is reported as a WARN with the exit code, so
    "could not collect" can never look identical to "collected zero"
    (gate contract point 3, #2946).
    """
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=600,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        report.warn("test-counts", f"pytest collection in {cwd} failed to run: {exc}")
        return 0
    m = re.search(r"(\d+) tests? collected", result.stdout) or re.search(
        r"(\d+)/\d+ tests collected", result.stdout
    )
    if m:
        return int(m.group(1))
    report.warn(
        "test-counts",
        f"pytest collection in {cwd} produced no parseable count "
        f"(exit {result.returncode}) - counted as 0, likely undercounted",
    )
    return 0


def resolve_plugin_python(
    report: Report, backend_dir: Path, env: dict[str, str] | None = None
) -> str | None:
    """The backend's own poetry venv python, shared by every plugin's tests.

    Plugin dirs are tested against the BACKEND's shared venv - `make
    test-plugins` resolves ``PLUGIN_PYTHON`` the same way - not each
    plugin's own poetry environment: most plugin dirs have never had
    `poetry install` run in their own venv, so `poetry run pytest` there
    fails closed with ModuleNotFoundError instead of collecting anything
    (#2946). ``env`` is exposed only so tests can point ``poetry`` at a
    fake shim; production calls leave it as the inherited environment.
    """
    try:
        venv_path = subprocess.run(
            ["poetry", "env", "info", "-p"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=30,
            env=env if env is not None else os.environ,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError) as exc:
        report.warn("test-counts", f"could not resolve the shared backend venv: {exc}")
        return None
    if not venv_path:
        report.warn(
            "test-counts",
            "no backend venv resolved - plugin test count is 0/unreliable",
        )
        return None
    return str(Path(venv_path) / "bin" / "python")


def _collect_actual_test_counts(report: Report):
    """Collect real test counts via pytest/vitest. Slow; opt-in only."""
    backend = collect_pytest_count(
        report, REPO / "backend", ["poetry", "run", "pytest", "--collect-only", "-q"]
    )

    plugin_python = resolve_plugin_python(report, REPO / "backend")
    plugins = 0
    for d in sorted((REPO / "plugins").glob("adaptive-learner-plugin-*")):
        cmd = (
            [plugin_python, "-m", "pytest", "--collect-only", "-q"]
            if plugin_python
            else ["poetry", "run", "pytest", "--collect-only", "-q"]
        )
        plugins += collect_pytest_count(report, d, cmd)

    vitest = 0
    try:
        out = subprocess.run(
            ["npx", "vitest", "list"],
            cwd=REPO / "frontend",
            capture_output=True,
            text=True,
            timeout=600,
        ).stdout
        vitest = len([ln for ln in out.splitlines() if " > " in ln])
    except (OSError, subprocess.SubprocessError) as exc:
        report.note(f"test-counts: vitest list failed: {exc}")

    return backend, plugins, vitest
