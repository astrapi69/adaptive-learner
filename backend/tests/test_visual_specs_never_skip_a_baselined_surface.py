"""A baselined visual surface fails instead of skipping when unreachable (#3427).

``critical-surfaces`` and ``theme-regression`` used ``test.skip(!ready, ...)``:
a regression that broke the path to a surface removed its screenshot from
the gate instead of failing it (the rule #2704 proposed and never landed).
Both now go through ``skipUnlessBaselined`` in ``e2e/visual/helpers.ts``,
which only skips while the shot has no committed baseline. This pins that
no visual spec falls back to a bare readiness skip.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
VISUAL_SPECS = sorted((REPO / "e2e" / "visual").glob("*.spec.ts"))
BARE_READINESS_SKIP = re.compile(r"\btest\s*\.\s*skip\s*\(\s*!\s*\w+")


def test_there_are_visual_specs_to_check() -> None:
    assert len(VISUAL_SPECS) >= 2, "no e2e/visual/*.spec.ts found - fail closed"


@pytest.mark.parametrize("spec", VISUAL_SPECS, ids=[path.name for path in VISUAL_SPECS])
def test_no_visual_spec_skips_on_readiness_alone(spec: Path) -> None:
    hits = [
        f"{spec.name}:{number}: {line.strip()}"
        for number, line in enumerate(spec.read_text(encoding="utf-8").splitlines(), start=1)
        if BARE_READINESS_SKIP.search(line)
    ]
    assert hits == [], "use skipUnlessBaselined instead:\n" + "\n".join(hits)


@pytest.mark.parametrize(
    ("source", "bare"),
    [
        ("test.skip(!ready, `Could not reach`);", True),
        ("test.skip( !reached, 'x')", True),
        ("skipUnlessBaselined(ready, `${surface}-${viewport}.png`, surface);", False),
        ("test.skip(true, `no baseline yet`);", False),
    ],
    ids=["bare-ready", "spaced", "guarded-helper", "unconditional-skip"],
)
def test_the_pattern_tells_a_bare_readiness_skip_apart(source: str, bare: bool) -> None:
    assert bool(BARE_READINESS_SKIP.search(source)) is bare
