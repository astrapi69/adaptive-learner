"""Budget ratchet on silenced Playwright smoke specs (#2170).

The v2.7.0 release declared seven stale smoke specs as skipped instead
of blocking on them - a reasonable ONE-TIME call that becomes corrosive
as a habit, because silencing is the cheapest answer to every red spec.
This gate turns the count into a budget: growth fails until the baseline
is raised in the same, visible commit; shrink is offered, never applied
(#2140 - a ratchet offers its headroom, a human takes it).

Five-point contract notes (quality-checks.md):
- fails CLOSED when the smoke dir or the baseline is missing (points 3);
- reports the scanned set and refuses a zero-spec scan (point 4);
- counts EVERY known silencing spelling, not just the one used today
  (test/it/describe x fixme/skip, the x-prefixed aliases, and the
  argless in-body ``test.fixme()`` form), so switching spelling does
  not dodge the counter.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SMOKE_DIR = REPO / "e2e" / "smoke"
BASELINE = REPO / "e2e" / ".smoke-skip-baseline.json"

# Every silencing spelling Playwright understands. A counter that knows
# only one spelling is circumventable by using another.
SILENCED = re.compile(
    r"""
    \b(?:test|it|describe)\s*\.\s*(?:fixme|skip)\s*\(   # test.fixme( / describe.skip( / spaced forms
    | \bx(?:it|test|describe)\s*\(                      # xit( / xtest( / xdescribe(
    """,
    re.VERBOSE,
)


def _scan() -> tuple[int, dict[str, int], int]:
    """(total silenced, per-file counts, files scanned)."""
    if not SMOKE_DIR.is_dir():
        pytest.fail(f"{SMOKE_DIR} is missing - cannot count what cannot be read (fail closed)")
    spec_files = sorted(SMOKE_DIR.glob("*.spec.ts"))
    per_file: dict[str, int] = {}
    total = 0
    for spec in spec_files:
        hits = len(SILENCED.findall(spec.read_text(encoding="utf-8")))
        if hits:
            per_file[spec.name] = hits
        total += hits
    return total, per_file, len(spec_files)


def _budget() -> int:
    if not BASELINE.is_file():
        pytest.fail(f"{BASELINE} is missing - a gate without its baseline must not pass (fail closed)")
    data = json.loads(BASELINE.read_text(encoding="utf-8"))
    budget = data.get("max_silenced_specs")
    if not isinstance(budget, int) or budget < 0:
        pytest.fail(f"{BASELINE} carries no integer max_silenced_specs - fail closed")
    return budget


def test_scan_actually_scanned_something() -> None:
    """Point 4: '0 findings' and '0 files looked at' must not both read green."""
    _total, _per_file, scanned = _scan()
    assert scanned > 0, "no smoke spec files found - an empty scan is not a clean one"
    print(f"scanned {scanned} smoke spec file(s)")


def test_silenced_specs_stay_within_budget() -> None:
    total, per_file, scanned = _scan()
    budget = _budget()
    detail = ", ".join(f"{name}: {count}" for name, count in per_file.items()) or "none"
    print(f"silenced specs: {total}/{budget} across {scanned} files ({detail})")
    assert total <= budget, (
        f"{total} silenced smoke specs exceed the declared budget of {budget} "
        f"({detail}). Silencing a spec is a DECLARED decision: raise "
        f"max_silenced_specs in {BASELINE.relative_to(REPO)} in the same commit "
        f"and say why - or fix the spec (#2170)."
    )
    if total < budget:
        # Offer, never apply (#2140): tightening stays a human act.
        print(
            f"headroom: budget {budget} could ratchet down to {total} "
            f"(edit {BASELINE.relative_to(REPO)})"
        )
