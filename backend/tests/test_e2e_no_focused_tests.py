"""No committed ``.only`` reduces an e2e gate to one test (#3439).

A focused test (``test.only``, ``test.describe.only``, ...) makes Playwright
run only that test and report green. The tests it did not select are not
reported as skipped, so the skip budget (#2170) does not move either.

Two layers:
- every Playwright config sets ``forbidOnly: !!process.env.CI``, so a CI run
  fails on a focused test;
- this scan fails ``make test`` on any focused test under ``e2e/``, which
  also covers the release gate run locally, where ``CI`` is unset.

Gate contract notes (quality-checks.md): the scan refuses an empty file set
(point 4), and the pattern is tested against every spelling it must and must
not catch (point 1).
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
E2E_DIR = REPO / "e2e"
CONFIGS = sorted(E2E_DIR.glob("playwright*.config.ts"))

FOCUSED = re.compile(r"\b(?:test|it|describe)(?:\s*\.\s*[A-Za-z]+)*\s*\.\s*only\s*\(")
FORBID_ONLY = re.compile(r"\bforbidOnly\s*:\s*!!process\.env\.CI\b")


def _spec_sources() -> list[Path]:
    """Every TypeScript file under ``e2e/``, without ``node_modules``."""
    found: list[Path] = []
    for directory, subdirs, files in os.walk(E2E_DIR):
        subdirs[:] = [name for name in subdirs if name != "node_modules"]
        found.extend(Path(directory) / name for name in files if name.endswith(".ts"))
    return found


@pytest.mark.parametrize(
    ("source", "focused"),
    [
        ("test.only('a', async () => {})", True),
        ("test.describe.only('a', () => {})", True),
        ("test.describe.serial.only('a', () => {})", True),
        ("it.only('a', () => {})", True),
        ("describe . only ('a', () => {})", True),
        ("test.skip('a', async () => {})", False),
        ("test('only the first row', async () => {})", False),
        ("commonly(value)", False),
        ("const onlyVisible = rows.only;", False),
    ],
    ids=[
        "test-only",
        "describe-only",
        "describe-serial-only",
        "it-only",
        "spaced",
        "skip-is-not-focus",
        "only-in-a-title",
        "word-ending-in-only",
        "property-named-only",
    ],
)
def test_the_pattern_tells_a_focused_test_apart(source: str, focused: bool) -> None:
    assert bool(FOCUSED.search(source)) is focused


def test_no_focused_test_is_committed_under_e2e() -> None:
    sources = _spec_sources()
    assert len(sources) > 50, f"scanned only {len(sources)} e2e files - refusing to call that clean"
    hits = [
        f"{path.relative_to(REPO)}:{number}: {line.strip()}"
        for path in sources
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1)
        if FOCUSED.search(line)
    ]
    assert hits == [], "focused tests would hide every other test:\n" + "\n".join(hits)


def test_there_are_playwright_configs_to_check() -> None:
    assert len(CONFIGS) >= 1, "no e2e/playwright*.config.ts found - fail closed"


@pytest.mark.parametrize("config", CONFIGS, ids=[path.name for path in CONFIGS])
def test_every_playwright_config_forbids_focused_tests_in_ci(config: Path) -> None:
    assert FORBID_ONLY.search(config.read_text(encoding="utf-8")), (
        f"{config.name} must set forbidOnly: !!process.env.CI"
    )
