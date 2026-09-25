#!/usr/bin/env python3
"""Permanent checkpoint IDs for the manual test plans (#3274).

Every ``- [ ]`` checkbox in a manual test plan carries an ID directly after
the box, e.g. ``- [ ] TC-0042 Matching: pairs have the SAME height``. The ID
names one test case for good: issues, PR comments and device protocols cite
it, so it must never move to a different case.

Plans and prefixes:

  TC   docs/manual-tests/testplan-adaptive-learner.md (DE) and its -en
       sibling. DE and EN carry the SAME ID for the same case.
  RTC  docs/reference/MANUAL-TESTPLAN.md
  LTC  launcher/TESTPLAN.md

Assignment rule, append-only:

- a new checkbox takes the next free number (register ``highest`` + 1), even
  when it is inserted in the middle of the document - numbers do not follow
  document order, and that is intended;
- a deleted checkbox never returns its number; ``--assign`` records it under
  ``retired`` in the register, so the gap is declared, not silent;
- a reworded checkbox keeps its number.

The register ``docs/manual-tests/testplan-ids.json`` holds ``highest`` and
``retired`` per prefix. It is the source for "next free number" and the proof
that a deleted number does not come back.

DE/EN pairing never uses document position: the two plans order their
sections differently on purpose. A section is paired by the IDs it already
carries, otherwise by its signature (heading level, issue references in the
heading, checkbox count, issue references per checkbox); checkboxes inside a
paired section pair by position. Where that is not unambiguous the pairing is
reported and left alone - a wrongly linked ID is worse than none.

Stdlib only: ``verify_docs.py`` imports this module and runs with a bare
``python3``.

Usage:
  python3 scripts/testplan_ids.py --check    # gate mode, exit 1 on a finding
  python3 scripts/testplan_ids.py --assign   # give unnumbered checkboxes IDs
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

REGISTER_REL = Path("docs") / "manual-tests" / "testplan-ids.json"
DE_REL = Path("docs") / "manual-tests" / "testplan-adaptive-learner.md"
EN_REL = Path("docs") / "manual-tests" / "testplan-adaptive-learner-en.md"
REFERENCE_REL = Path("docs") / "reference" / "MANUAL-TESTPLAN.md"
LAUNCHER_REL = Path("launcher") / "TESTPLAN.md"


@dataclass(frozen=True)
class PlanSpec:
    """One ID space: a prefix and the file(s) that share it."""

    prefix: str
    files: tuple[Path, ...]


PLANS: tuple[PlanSpec, ...] = (
    PlanSpec("TC", (DE_REL, EN_REL)),
    PlanSpec("RTC", (REFERENCE_REL,)),
    PlanSpec("LTC", (LAUNCHER_REL,)),
)

ID_WIDTH = 4

_BOX_RE = re.compile(r"^(?P<lead>\s*- \[ \] )(?:(?P<prefix>[A-Z]+)-(?P<num>\d+)(?:\s+|$))?")
_HEADING_RE = re.compile(r"^(#{1,6}) ")
_FENCE_RE = re.compile(r"^\s*```")
_ISSUE_REF_RE = re.compile(r"#(\d{3,5})")


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


@dataclass
class Box:
    """One ``- [ ]`` checkbox, including its indented continuation lines."""

    line_no: int  # 1-based
    prefix: str | None
    number: int | None
    refs: tuple[str, ...] = ()

    @property
    def label(self) -> str | None:
        if self.prefix is None or self.number is None:
            return None
        return format_id(self.prefix, self.number)


@dataclass
class Section:
    """A heading and the checkboxes directly under it (up to the next heading)."""

    heading: str
    line_no: int
    level: int
    heading_refs: tuple[str, ...]
    boxes: list[Box] = field(default_factory=list)

    def signature(self) -> tuple[object, ...]:
        return (
            self.level,
            self.heading_refs,
            len(self.boxes),
            tuple(box.refs for box in self.boxes),
        )


@dataclass
class ParsedPlan:
    path: Path
    lines: list[str]
    sections: list[Section]

    @property
    def boxes(self) -> list[Box]:
        return [box for section in self.sections for box in section.boxes]


def format_id(prefix: str, number: int) -> str:
    return f"{prefix}-{number:0{ID_WIDTH}d}"


def _refs(text: str) -> tuple[str, ...]:
    return tuple(sorted(set(_ISSUE_REF_RE.findall(text))))


def parse_plan(path: Path, text: str) -> ParsedPlan:
    """Split a plan into sections and checkboxes; fenced code is skipped."""
    lines = text.splitlines(keepends=True)
    sections = [Section("(before first heading)", 0, 0, ())]
    in_fence = False
    current: Box | None = None
    current_text: list[str] = []

    def close_box() -> None:
        nonlocal current, current_text
        if current is not None:
            current.refs = _refs(" ".join(current_text))
        current, current_text = None, []

    for index, raw in enumerate(lines):
        line = raw.rstrip("\r\n")
        if _FENCE_RE.match(line):
            close_box()
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        heading = _HEADING_RE.match(line)
        if heading:
            close_box()
            sections.append(Section(line.strip(), index + 1, len(heading.group(1)), _refs(line)))
            continue
        box = _BOX_RE.match(line)
        if box:
            close_box()
            number = int(box.group("num")) if box.group("num") else None
            current = Box(index + 1, box.group("prefix"), number)
            current_text = [line]
            sections[-1].boxes.append(current)
            continue
        if current is not None and line.strip() and line[:1].isspace():
            current_text.append(line)
        else:
            close_box()
    close_box()
    return ParsedPlan(path, lines, [s for s in sections if s.boxes or s.line_no])


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


class RegisterError(Exception):
    """The register is missing or unreadable - the check cannot run."""


def load_register(path: Path) -> dict[str, dict[str, object]]:
    if not path.exists():
        raise RegisterError(f"{path} not found - no ID register, cannot check (basis missing)")
    try:
        data: dict[str, dict[str, object]] = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RegisterError(f"{path} unreadable: {exc}") from exc
    if not isinstance(data, dict):
        raise RegisterError(f"{path}: expected a JSON object keyed by prefix")
    for spec in PLANS:
        entry = data.get(spec.prefix)
        if (
            not isinstance(entry, dict)
            or not isinstance(entry.get("highest"), int)
            or not isinstance(entry.get("retired"), list)
        ):
            raise RegisterError(
                f"{path}: entry '{spec.prefix}' needs an int 'highest' and a list 'retired'"
            )
    return data


def _highest(register: dict[str, dict[str, object]], prefix: str) -> int:
    value = register[prefix]["highest"]
    assert isinstance(value, int)
    return value


def _retired(register: dict[str, dict[str, object]], prefix: str) -> set[int]:
    values = register[prefix]["retired"]
    assert isinstance(values, list)
    return {int(v) for v in values}


# ---------------------------------------------------------------------------
# DE/EN section pairing
# ---------------------------------------------------------------------------


@dataclass
class Pairing:
    pairs: list[tuple[Section, Section]]
    unresolved_de: list[Section]
    unresolved_en: list[Section]
    by_order: int = 0  # pairs whose signature was not unique in the plan


def pair_sections(de: ParsedPlan, en: ParsedPlan) -> Pairing:
    """Pair DE and EN sections that hold checkboxes, without using position."""
    de_secs = [s for s in de.sections if s.boxes]
    en_secs = [s for s in en.sections if s.boxes]
    pairs: list[tuple[Section, Section]] = []
    used_de: set[int] = set()
    used_en: set[int] = set()

    # 1. Sections that already carry IDs pair through them.
    en_by_id = {box.label: i for i, s in enumerate(en_secs) for box in s.boxes if box.label}
    for i, section in enumerate(de_secs):
        targets = {en_by_id.get(box.label) for box in section.boxes if box.label}
        targets.discard(None)
        if len(targets) == 1:
            j = targets.pop()
            assert j is not None
            if j not in used_en:
                pairs.append((section, en_secs[j]))
                used_de.add(i)
                used_en.add(j)

    # 2. The rest pair by signature: order-preserving runs first, then any
    #    signature that occurs exactly once on each side.
    rest_de = [i for i in range(len(de_secs)) if i not in used_de]
    rest_en = [j for j in range(len(en_secs)) if j not in used_en]
    de_sigs = [de_secs[i].signature() for i in rest_de]
    en_sigs = [en_secs[j].signature() for j in rest_en]
    all_de_sigs = [s.signature() for s in de_secs]
    by_order = 0
    matcher = difflib.SequenceMatcher(None, de_sigs, en_sigs, autojunk=False)
    for block in matcher.get_matching_blocks():
        for k in range(block.size):
            i, j = rest_de[block.a + k], rest_en[block.b + k]
            pairs.append((de_secs[i], en_secs[j]))
            used_de.add(i)
            used_en.add(j)
            if all_de_sigs.count(de_secs[i].signature()) > 1:
                by_order += 1
    left_de = [i for i in rest_de if i not in used_de]
    left_en = [j for j in rest_en if j not in used_en]
    for i in list(left_de):
        sig = de_secs[i].signature()
        de_hits = [x for x in left_de if de_secs[x].signature() == sig]
        en_hits = [y for y in left_en if en_secs[y].signature() == sig]
        if len(de_hits) == 1 and len(en_hits) == 1:
            pairs.append((de_secs[i], en_secs[en_hits[0]]))
            left_de.remove(i)
            left_en.remove(en_hits[0])

    return Pairing(
        pairs,
        [de_secs[i] for i in left_de],
        [en_secs[j] for j in left_en],
        by_order,
    )


# ---------------------------------------------------------------------------
# Check
# ---------------------------------------------------------------------------


@dataclass
class Result:
    findings: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _where(plan: ParsedPlan, line_no: int) -> str:
    return f"{plan.path}:{line_no}"


def _check_ids_in_file(plan: ParsedPlan, prefix: str, result: Result) -> dict[int, Box]:
    """Every checkbox has exactly one well-formed ID of this plan's prefix."""
    seen: dict[int, Box] = {}
    for box in plan.boxes:
        if box.number is None:
            result.findings.append(
                f"{_where(plan, box.line_no)}: checkbox without an ID "
                f"(expected '- [ ] {prefix}-NNNN ...'; run scripts/testplan_ids.py --assign)"
            )
            continue
        if box.prefix != prefix:
            result.findings.append(
                f"{_where(plan, box.line_no)}: ID {box.prefix}-{box.number} has the wrong "
                f"prefix for this plan (expected {prefix}-)"
            )
            continue
        if box.number in seen:
            result.findings.append(
                f"{_where(plan, box.line_no)}: {box.label} used twice "
                f"(first at line {seen[box.number].line_no})"
            )
            continue
        seen[box.number] = box
    return seen


def _check_register_bounds(
    prefix: str, present: set[int], register: dict[str, dict[str, object]], result: Result
) -> None:
    highest, retired = _highest(register, prefix), _retired(register, prefix)
    for number in sorted(n for n in present if n > highest):
        result.findings.append(
            f"{format_id(prefix, number)} is above the register limit "
            f"({format_id(prefix, highest)}) - IDs come from the register, run --assign"
        )
    for number in sorted(present & retired):
        result.findings.append(
            f"{format_id(prefix, number)} is retired in the register and must not be reused"
        )
    missing = sorted(set(range(1, highest + 1)) - present - retired)
    for number in missing[:20]:
        result.findings.append(
            f"{format_id(prefix, number)} is in the register range but in no plan and not "
            "retired - a deleted case must be recorded as retired (run --assign)"
        )
    if len(missing) > 20:
        result.findings.append(f"... and {len(missing) - 20} more unretired gaps for {prefix}")


def _check_pair_mapping(de: ParsedPlan, en: ParsedPlan, result: Result) -> None:
    """The same ID names the same case: same section, same slot, same references."""
    en_boxes = {box.label: box for box in en.boxes if box.label}
    en_section_of = {box.label: s for s in en.sections for box in s.boxes if box.label}
    for section in de.sections:
        labels = [box.label for box in section.boxes if box.label]
        targets = {id(en_section_of[lab]) for lab in labels if lab in en_section_of}
        if len(targets) > 1:
            result.findings.append(
                f"{_where(de, section.line_no)}: the IDs of '{section.heading}' are spread "
                "over several EN sections - DE and EN disagree on which case an ID names"
            )
            continue
        if not targets:
            continue
        counterpart = en_section_of[next(lab for lab in labels if lab in en_section_of)]
        if len(section.boxes) != len(counterpart.boxes):
            result.findings.append(
                f"section '{section.heading}' ({_where(de, section.line_no)}) has "
                f"{len(section.boxes)} checkpoint(s), its EN counterpart "
                f"'{counterpart.heading}' ({_where(en, counterpart.line_no)}) has "
                f"{len(counterpart.boxes)}"
            )
        for box in section.boxes:
            other = en_boxes.get(box.label) if box.label else None
            if other is not None and other.refs != box.refs:
                result.findings.append(
                    f"{box.label}: DE cites {list(box.refs) or 'no issue'}, EN cites "
                    f"{list(other.refs) or 'no issue'} - the ID may name two different cases"
                )


def check_plan(
    spec: PlanSpec,
    plans: list[ParsedPlan],
    register: dict[str, dict[str, object]],
) -> Result:
    """Check one ID space (one file, or the DE/EN pair)."""
    result = Result()
    per_file: list[dict[int, Box]] = []
    for plan in plans:
        if not plan.boxes:
            result.findings.append(
                f"{plan.path} contains no '- [ ]' checkpoint - an empty plan would pass "
                "vacuously (basis missing)"
            )
            return result
        per_file.append(_check_ids_in_file(plan, spec.prefix, result))

    present = set().union(*(set(ids) for ids in per_file))
    if len(plans) == 2:
        de_ids, en_ids = set(per_file[0]), set(per_file[1])
        for number in sorted(de_ids - en_ids):
            result.findings.append(
                f"{format_id(spec.prefix, number)} exists only in {plans[0].path} "
                f"(line {per_file[0][number].line_no})"
            )
        for number in sorted(en_ids - de_ids):
            result.findings.append(
                f"{format_id(spec.prefix, number)} exists only in {plans[1].path} "
                f"(line {per_file[1][number].line_no})"
            )
        _check_pair_mapping(plans[0], plans[1], result)
    _check_register_bounds(spec.prefix, present, register, result)

    counts = " / ".join(f"{p.path.name} {len(p.boxes)}" for p in plans)
    result.notes.append(
        f"testplan-ids {spec.prefix}: {counts} checkpoints, {len(present)} distinct IDs, "
        f"register highest {format_id(spec.prefix, _highest(register, spec.prefix))}, "
        f"{len(_retired(register, spec.prefix))} retired"
    )
    return result


def _read_plans(root: Path, spec: PlanSpec) -> list[ParsedPlan] | str:
    plans = []
    for rel in spec.files:
        path = root / rel
        if not path.exists():
            return f"{path} not found - cannot check {spec.prefix} IDs (basis missing)"
        plans.append(parse_plan(rel, path.read_text(encoding="utf-8")))
    return plans


def check(root: Path = REPO, prefixes: tuple[str, ...] | None = None) -> Result:
    """Gate entry point: check every (or the named) ID space under ``root``."""
    result = Result()
    try:
        register = load_register(root / REGISTER_REL)
    except RegisterError as exc:
        result.findings.append(str(exc))
        return result
    for spec in PLANS:
        if prefixes is not None and spec.prefix not in prefixes:
            continue
        plans = _read_plans(root, spec)
        if isinstance(plans, str):
            result.findings.append(plans)
            continue
        sub = check_plan(spec, plans, register)
        result.findings.extend(sub.findings)
        result.notes.extend(sub.notes)
    return result


# ---------------------------------------------------------------------------
# Assign
# ---------------------------------------------------------------------------


@dataclass
class AssignOutcome:
    assigned: int = 0
    by_hand: int = 0
    retired_now: list[str] = field(default_factory=list)
    unresolved: list[str] = field(default_factory=list)
    by_order: int = 0


def _set_id(plan: ParsedPlan, box: Box, prefix: str, number: int) -> None:
    index = box.line_no - 1
    line = plan.lines[index]
    match = _BOX_RE.match(line)
    assert match is not None
    rest = line[match.end() :]
    plan.lines[index] = f"{match.group('lead')}{format_id(prefix, number)} {rest}"
    box.prefix, box.number = prefix, number


def _pair_slots(
    de_sec: Section, en_sec: Section, manual: dict[int, int]
) -> list[tuple[Box, Box]] | str:
    """Pair the checkboxes of two paired sections, never by guesswork.

    Numbered boxes pair through their ID; hand-decided pairs (``manual``, DE
    line -> EN line) come next; the remaining unnumbered boxes pair in order.
    Any pair whose issue references differ is refused.
    """
    if len(de_sec.boxes) != len(en_sec.boxes):
        return (
            f"'{de_sec.heading}' has {len(de_sec.boxes)} checkpoint(s), its counterpart "
            f"'{en_sec.heading}' has {len(en_sec.boxes)}"
        )
    en_by_label = {box.label: box for box in en_sec.boxes if box.label}
    en_by_line = {box.line_no: box for box in en_sec.boxes}
    slots: list[tuple[Box, Box]] = []
    taken: set[int] = set()
    open_de: list[Box] = []
    for d in de_sec.boxes:
        if d.label is not None:
            e = en_by_label.get(d.label)
            if e is None:
                return f"{d.label} (line {d.line_no}) has no counterpart in '{en_sec.heading}'"
        elif d.line_no in manual:
            e = en_by_line.get(manual[d.line_no])
            if e is None or e.label is not None:
                return f"hand pair for line {d.line_no} does not point at an open EN checkbox"
        else:
            open_de.append(d)
            continue
        slots.append((d, e))
        taken.add(e.line_no)
    open_en = [e for e in en_sec.boxes if e.line_no not in taken and e.label is None]
    if len(open_de) != len(open_en) or any(
        e.label is not None for e in en_sec.boxes if e.line_no not in taken
    ):
        return f"'{de_sec.heading}': numbered and unnumbered checkpoints do not line up"
    slots.extend(zip(open_de, open_en, strict=True))
    for d, e in slots:
        if d.refs != e.refs:
            return (
                f"line {d.line_no} / {e.line_no}: issue references differ "
                f"({list(d.refs)} vs {list(e.refs)}) - pair these by hand"
            )
    return sorted(slots, key=lambda slot: slot[0].line_no)


def _section_of(plan: ParsedPlan, line_no: int) -> Section | None:
    return next((s for s in plan.sections for box in s.boxes if box.line_no == line_no), None)


def _assign_pair(
    spec: PlanSpec,
    de: ParsedPlan,
    en: ParsedPlan,
    counter: list[int],
    out: AssignOutcome,
    manual: dict[int, int],
) -> None:
    pairing = pair_sections(de, en)
    out.by_order += pairing.by_order
    pairs = list(pairing.pairs)
    unresolved_de = list(pairing.unresolved_de)
    unresolved_en = list(pairing.unresolved_en)
    for de_line, en_line in manual.items():
        de_sec, en_sec = _section_of(de, de_line), _section_of(en, en_line)
        if de_sec in unresolved_de and en_sec in unresolved_en:
            assert de_sec is not None and en_sec is not None
            pairs.append((de_sec, en_sec))
            unresolved_de.remove(de_sec)
            unresolved_en.remove(en_sec)
    for section in unresolved_de:
        out.unresolved.append(
            f"{de.path}:{section.line_no} '{section.heading}': no unambiguous EN counterpart"
        )
    for section in unresolved_en:
        out.unresolved.append(
            f"{en.path}:{section.line_no} '{section.heading}': no unambiguous DE counterpart"
        )
    for de_sec, en_sec in sorted(pairs, key=lambda p: p[0].line_no):
        slots = _pair_slots(de_sec, en_sec, manual)
        if isinstance(slots, str):
            out.unresolved.append(f"{de.path}:{de_sec.line_no}: {slots}")
            continue
        for d, e in slots:
            if d.number is None:
                counter[0] += 1
                _set_id(de, d, spec.prefix, counter[0])
                _set_id(en, e, spec.prefix, counter[0])
                out.assigned += 1
                if d.line_no in manual:
                    out.by_hand += 1


def assign(root: Path = REPO, manual: dict[int, int] | None = None) -> AssignOutcome:
    """Give every unnumbered checkbox an ID and update the register.

    ``manual`` maps a DE checkbox line to its EN checkbox line for the cases
    the automatic pairing refuses (a section whose checkboxes are ordered
    differently in DE and EN). Those decisions are made by a human.
    """
    register_path = root / REGISTER_REL
    register = load_register(register_path)
    out = AssignOutcome()
    for spec in PLANS:
        plans = _read_plans(root, spec)
        if isinstance(plans, str):
            raise RegisterError(plans)
        counter = [_highest(register, spec.prefix)]
        if len(plans) == 2:
            _assign_pair(spec, plans[0], plans[1], counter, out, manual or {})
        else:
            for box in plans[0].boxes:
                if box.number is None:
                    counter[0] += 1
                    _set_id(plans[0], box, spec.prefix, counter[0])
                    out.assigned += 1
        present = {box.number for plan in plans for box in plan.boxes if box.number}
        retired = _retired(register, spec.prefix)
        gaps = set(range(1, counter[0] + 1)) - present - retired
        out.retired_now.extend(format_id(spec.prefix, n) for n in sorted(gaps))
        register[spec.prefix]["highest"] = counter[0]
        register[spec.prefix]["retired"] = sorted(retired | gaps)
        for plan in plans:
            (root / plan.path).write_text("".join(plan.lines), encoding="utf-8", newline="")
    register_path.write_text(
        json.dumps(register, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return out


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="gate mode: exit 1 on any finding")
    mode.add_argument("--assign", action="store_true", help="give unnumbered checkboxes IDs")
    parser.add_argument(
        "--pairs",
        type=Path,
        help="JSON list of [de_line, en_line] checkbox pairs decided by hand (with --assign)",
    )
    parser.add_argument("--root", type=Path, default=REPO, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)

    if args.assign:
        try:
            manual = (
                {int(d): int(e) for d, e in json.loads(args.pairs.read_text(encoding="utf-8"))}
                if args.pairs
                else None
            )
            out = assign(args.root, manual)
        except RegisterError as exc:
            print(f"testplan-ids: {exc}", file=sys.stderr)
            return 2
        print(
            f"testplan-ids: {out.assigned} new ID(s) ({out.by_hand} paired by hand), "
            f"{len(out.retired_now)} newly retired, "
            f"{out.by_order} section pair(s) matched by order among identical signatures"
        )
        for number in out.retired_now:
            print(f"  retired: {number}")
        for item in out.unresolved:
            print(f"  UNRESOLVED (decide by hand, nothing assigned): {item}")
        return 1 if out.unresolved else 0

    result = check(args.root)
    for note in result.notes:
        print(note)
    for finding in result.findings:
        print(f"FAIL {finding}")
    print(f"testplan-ids: {len(result.findings)} finding(s)")
    return 1 if result.findings else 0


if __name__ == "__main__":
    sys.exit(main())
