#!/usr/bin/env python3
"""AI-output metrics aggregator (#2743).

Qualitative per-incident tracking already exists (the journal's
"Original prompt / Optimized prompt" duty); what was missing is the
NUMBER side: how often does generated work land green on the first
push, how many correction rounds does a session cost, how often is the
assignment's premise itself wrong. The counterargument recorded on
#2743 stands - a mandatory measuring duty erodes in autonomous
operation - so this is deliberately built the other way around:

- The journal block is OPTIONAL. A session without one is not an
  error; it is COUNTED and reported as uncovered, so absence stays
  visible instead of silently biasing the numbers (#2083 point 4: "0
  findings" and "0 looked at" must not print the same).
- Nothing gates on these numbers. This is a report command, not a
  check - it deliberately has no checks.yaml entry and no CI wiring.

Block format, anywhere in ``docs/journal/chat-journal-session-*.md``::

    ## AI-Metriken (#2743)
    - aufgaben: 7
    - direkt-gruen: 5
    - korrektur-runden: 3
    - praemissen-korrekturen: 1

Definitions (kept HERE, not in the rules corpus):

- ``aufgaben``: user-assigned tasks worked in the session.
- ``direkt-gruen``: tasks whose first pushed solution merged without a
  correction round.
- ``korrektur-runden``: additional fix iterations after a red gate,
  review finding or wrong first attempt, summed over the session.
- ``praemissen-korrekturen``: tasks where the ASSIGNMENT's premise was
  wrong against the code (the verify-first memory class) - high values
  here indict the task queue, not the model.

Usage::

    python3 scripts/ai_metrics.py            # aggregate + coverage
    python3 scripts/ai_metrics.py --journal-dir docs/journal
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

FIELDS = ("aufgaben", "direkt-gruen", "korrektur-runden", "praemissen-korrekturen")
_HEADER = re.compile(r"^## AI-Metriken \(#2743\)\s*$", re.M)
_FIELD = re.compile(r"^- (?P<key>[a-z-]+):\s*(?P<value>\d+)\s*$")
_SESSION_GLOB = "chat-journal-session-*.md"
_MONTH = re.compile(r"chat-journal-session-(\d{4}-\d{2})")


def parse_block(text: str) -> dict[str, int] | None:
    """The metrics block of one journal, or ``None`` when absent.

    A PRESENT header with missing/garbled fields returns the parsed
    subset - the coverage report still counts the session as covered,
    and a field-level gap shows up as a lower task total, which is
    exactly the honest reading.
    """
    match = _HEADER.search(text)
    if not match:
        return None
    values: dict[str, int] = {}
    for line in text[match.end() :].splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        field = _FIELD.match(stripped)
        if not field:
            break
        if field.group("key") in FIELDS:
            values[field.group("key")] = int(field.group("value"))
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--journal-dir", default="docs/journal")
    args = parser.parse_args()

    journal_dir = Path(args.journal_dir)
    sessions = sorted(journal_dir.glob(_SESSION_GLOB))
    if not sessions:
        print(
            f"ai-metrics: no session journals under {journal_dir} - "
            "an empty scan is a finding, not a clean report",
            file=sys.stderr,
        )
        return 1

    per_month: dict[str, dict[str, int]] = {}
    covered = 0
    for path in sessions:
        block = parse_block(path.read_text(encoding="utf-8"))
        if block is None:
            continue
        covered += 1
        month_match = _MONTH.search(path.name)
        month = month_match.group(1) if month_match else "unknown"
        bucket = per_month.setdefault(month, dict.fromkeys(FIELDS, 0))
        for key, value in block.items():
            bucket[key] += value

    print(
        f"ai-metrics: {covered}/{len(sessions)} session journal(s) carry the "
        "optional block (absence is visible by design, #2743)"
    )
    if not per_month:
        print("ai-metrics: nothing to aggregate yet.")
        return 0
    header = f"{'month':<10}" + "".join(f"{f:>24}" for f in FIELDS)
    print(header)
    totals = dict.fromkeys(FIELDS, 0)
    for month in sorted(per_month):
        row = per_month[month]
        print(f"{month:<10}" + "".join(f"{row[f]:>24}" for f in FIELDS))
        for key in FIELDS:
            totals[key] += row[key]
    print(f"{'TOTAL':<10}" + "".join(f"{totals[f]:>24}" for f in FIELDS))
    if totals["aufgaben"]:
        rate = totals["direkt-gruen"] / totals["aufgaben"] * 100
        print(f"\nfirst-push-green rate: {rate:.0f}% of {totals['aufgaben']} tasks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
