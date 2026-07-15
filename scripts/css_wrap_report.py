#!/usr/bin/env python3
"""css_wrap_report.py - report rendering for the EXP-044 wrap-conflict audit.

Extracted from ``check-legacy-wrap-conflicts.py`` (#1655 concern split /
file-size gate) so the audit CLI stays under the god-file threshold: this
module renders a ``BlockReport`` (verdict + human-readable findings) and
knows nothing about how the report was computed. Locations print
file-qualified via :func:`css_parse_lib.fmt_loc` because the audit reads
the virtual multi-file stylesheet (global.css + styles/legacy/*.css).

No third-party dependencies; individually importable via
``importlib.util.spec_from_file_location`` (see the audit script).
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Protocol

REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_sibling(filename: str):
    """Import a sibling scripts/ module by file path (hyphen-safe)."""
    path = Path(__file__).resolve().parent / filename
    module_name = filename.removesuffix(".py").replace("-", "_")
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


cpl = sys.modules.get("css_parse_lib") or _load_sibling("css_parse_lib.py")
fmt_loc = cpl.fmt_loc


class WrapReport(Protocol):
    """Structural view of the audit CLI's ``BlockReport``.

    Duck-typed on purpose: the CLI module carries a hyphenated filename and
    loads THIS module, so a real import would be circular. The renderer
    only reads these attributes.
    """

    label: str
    start: int
    end: int
    rule_count: int
    conflicts: list
    accepted_notes: list
    same_value_notes: list
    legacy_deps: list
    unmatchable: list


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def report_verdict(report: WrapReport) -> tuple[int, int, str]:
    """(n_utility_conflicts, n_legacy_deps, verdict_string) for a block.

    A block is CLEAN only with zero of both. Utility conflicts and
    unlayered-legacy dependencies are distinct categories - a block can be
    CLEAN against utilities yet still ABHAENGIG on an unlayered legacy rule
    (the #1592 case), and MUST NOT be wrapped in that state.
    """
    n_conf = len(
        {
            (f.rule.line, f.rule_prop, f.utility, str(f.element.file), f.element.line)
            for f in report.conflicts
        }
    )
    n_dep = len(
        {
            (d.block_rule.line, d.block_prop, d.other_rule.line)
            for d in report.legacy_deps
        }
    )
    if n_conf == 0 and n_dep == 0:
        verdict = "CLEAN"
    else:
        bits = []
        if n_conf:
            bits.append(f"KONFLIKTE({n_conf})")
        if n_dep:
            bits.append(f"ABHAENGIG({n_dep})")
        verdict = " ".join(bits)
    return n_conf, n_dep, verdict


def print_report(report: WrapReport, segments: list | None = None) -> None:
    segs = segments or []
    print(
        f"\n=== Block '{report.label}' "
        f"({fmt_loc(report.start, segs)} - {fmt_loc(report.end, segs)}) ==="
    )
    print(f"    Regeln im Bereich: {report.rule_count}")

    grouped: dict[tuple[int, str], list] = {}
    for finding in report.conflicts:
        grouped.setdefault(
            (finding.rule.line, finding.subject.selector_part), []
        ).append(finding)
    for (line, selector), findings in sorted(grouped.items()):
        print(f"\n  KONFLIKT  {selector}  ({fmt_loc(line, segs)})")
        seen: set[tuple[str, str, str, int]] = set()
        for f in sorted(
            findings, key=lambda x: (str(x.element.file), x.element.line, x.utility)
        ):
            key = (f.rule_prop, f.utility, _rel(f.element.file), f.element.line)
            if key in seen:
                continue
            seen.add(key)
            cond = f"  [bedingt: {'; '.join(f.conditions)}]" if f.conditions else ""
            tag_note = "  (Typ-Subjekt-Heuristik)" if f.via_tag_heuristic else ""
            print(
                f"      {f.rule_prop}  vs  Utility '{f.utility}'"
                f"  @ {_rel(f.element.file)}:{f.element.line}{cond}{tag_note}"
            )

    if report.accepted_notes:
        pairs = sorted(
            {
                (
                    f.rule.line,
                    f.subject.selector_part,
                    f.rule_prop,
                    f.utility,
                    _rel(f.element.file),
                    f.element.line,
                    reason,
                )
                for f, reason in report.accepted_notes
            }
        )
        print(f"\n  akzeptiert (allowlisted #1623, {len(pairs)}):")
        for line, selector, prop, utility, file, el_line, reason in pairs:
            print(
                f"      {selector} ({fmt_loc(line, segs)}) {prop} vs '{utility}' @ {file}:{el_line}"
            )
            print(f"        -> {reason}")

    if report.same_value_notes:
        pairs = sorted(
            {
                (
                    f.rule.line,
                    f.subject.selector_part,
                    f.rule_prop,
                    f.utility,
                    _rel(f.element.file),
                    f.element.line,
                )
                for f in report.same_value_notes
            }
        )
        print(f"\n  wertgleich (harmlos, {len(pairs)}):")
        for line, selector, prop, utility, file, el_line in pairs:
            print(
                f"      {selector} ({fmt_loc(line, segs)}) {prop} == '{utility}' @ {file}:{el_line}"
            )

    if report.legacy_deps:
        grouped_deps: dict[tuple[int, str], list] = {}
        for dep in report.legacy_deps:
            grouped_deps.setdefault((dep.block_rule.line, dep.block_part), []).append(
                dep
            )
        for (line, selector), deps in sorted(grouped_deps.items()):
            print(f"\n  ABHAENGIG  {selector}  ({fmt_loc(line, segs)})")
            for dep in sorted(deps, key=lambda d: (d.block_prop, d.other_rule.line)):
                print(
                    f"      {dep.block_prop}  verliert gegen unlayered"
                    f"  '{dep.other_part}'  ({fmt_loc(dep.other_rule.line, segs)})"
                    f"  [Spezifitaet {dep.block_spec} >= {dep.other_spec}]"
                )

    if report.unmatchable:
        print(f"\n  unpruefbar ({len(report.unmatchable)}):")
        for rule, reason in report.unmatchable:
            print(f"      {rule.selector} ({fmt_loc(rule.line, segs)}) - {reason}")

    n_conf, n_dep, verdict = report_verdict(report)
    print(f"\n  URTEIL {report.label}: {verdict}")
