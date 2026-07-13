#!/usr/bin/env python3
r"""check-legacy-wrap-conflicts.py - EXP-044 pre-wrap conflict audit (#1485).

Analysis tool, NOT a CI gate. Before a global.css block is wrapped into
``@layer legacy`` (Tranche 2+), this audit answers the question that sank
Tranche 2b (PR #1571, 44 visual diffs): does the block contain rules that
DEPEND on unlayered precedence to beat a Tailwind utility on the same
element? Proven case: ``.app-nav .nav-group-label { display: none }`` vs
the ``block`` utility in ``frontend/src/components/nav/NavGroup.tsx``.

Method (exact instead of heuristic - reuses the extraction machinery of
``scripts/check-dead-classnames.py``):

1. Utility -> properties: the BUILT CSS (``frontend/dist/assets/*.css``
   after ``VITE_STORAGE_MODE=dexie bun run build``) is the Tailwind
   oracle. Every rule inside ``@layer utilities`` / ``@layer components``
   (the layers ordered AFTER ``legacy`` in ``styles/tailwind.css``) maps
   its class to the declared properties; ``@media`` wrappers and variant
   pseudo-classes are carried as conditions.
2. Block rules: global.css is parsed in the requested line range. Per
   rule: selector, declared properties, and the SUBJECT classes = the
   classes of the RIGHTMOST compound (for ``:is()``/``:where()`` all
   contained classes; ``:not(...)`` contents are excluded). Declarations
   with ``!important`` are skipped - important declarations in an earlier
   layer still beat later-layer normal declarations, so wrapping does not
   flip them.
3. Coexistence: every ``className`` occurrence in ``frontend/src`` (via
   the check-dead-classnames extractor: static strings, ``cn()``/template
   literals; test files excluded) that carries BOTH a subject class and
   at least one oracle utility is a candidate. Conflict = the property
   sets intersect after shorthand expansion (``margin`` collides with
   ``margin-top``, ``background`` with ``background-color``, logical
   ``padding-inline`` with physical ``padding-left`` ...).
4. Rules whose rightmost compound has NO class (type subjects like
   ``.app-nav a``) cannot be matched by className. They are matched
   heuristically: files whose classNames use one of the selector's
   context classes are scanned for JSX elements of that tag (aliases:
   ``a`` also matches ``Link``/``NavLink``). Findings are tagged; rules
   without any context class are listed as unpruefbar.

Bias: rather a false positive (manual review) than a false negative.
Same-property matches whose declared values are literally identical are
downgraded to "wertgleich" notes (harmless overlap, not a flip risk) and
do not count toward the verdict.

Usage:
  python3 scripts/check-legacy-wrap-conflicts.py --block 2424-3445:Navigation
  python3 scripts/check-legacy-wrap-conflicts.py --wrapped   # audit existing
                                                             # @layer legacy blocks
  make audit-legacy-conflicts                                # builds dist first

Exit codes:
  0 = audit ran (conflicts are FINDINGS, not failures - read the report)
  1 = operational error (missing build CSS, bad --block spec, ...)
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GLOBAL_CSS = REPO_ROOT / "frontend" / "src" / "styles" / "global.css"
SRC_DIR = REPO_ROOT / "frontend" / "src"
DIST_DIR = REPO_ROOT / "frontend" / "dist"

# Layers that are ordered AFTER ``legacy`` in styles/tailwind.css
# (``@layer theme, base, legacy, components, utilities;``) - only their
# classes gain precedence over a block once it is wrapped.
ORACLE_LAYERS = {"utilities", "components"}


def _load_sibling(filename: str):
    """Import a sibling scripts/ module by file path (hyphen-safe)."""
    path = Path(__file__).resolve().parent / filename
    module_name = filename.removesuffix(".py").replace("-", "_")
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


# className extraction (TSX side) + CSS parsing/property model (reused).
dcn = _load_sibling("check-dead-classnames.py")
cpl = _load_sibling("css_parse_lib.py")


def blank_ts_comments(text: str) -> str:
    """Offset-preserving variant of ``dcn.strip_comments`` for TSX files.

    Comments are blanked to spaces (newlines kept) so occurrence line
    numbers remain exact; string/template literals are preserved verbatim.
    """
    out = list(text)
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c in "\"'`":
            j = i + 1
            while j < n:
                cj = text[j]
                if cj == "\\" and j + 1 < n:
                    j += 2
                    continue
                if cj == c:
                    j += 1
                    break
                j += 1
            i = j
            continue
        if text[i : i + 2] == "//":
            j = i
            while j < n and text[j] != "\n":
                out[j] = " "
                j += 1
            i = j
            continue
        if text[i : i + 2] == "/*":
            j = text.find("*/", i + 2)
            end = n if j == -1 else j + 2
            for k in range(i, end):
                if out[k] != "\n":
                    out[k] = " "
            i = end
            continue
        i += 1
    return "".join(out)


# --------------------------------------------------------------------------
# Oracle: utility class -> declared properties (from the built CSS)
# --------------------------------------------------------------------------


@dataclass
class UtilityDecl:
    prop: str
    value: str
    atoms: frozenset[str]
    condition: str | None
    pseudo_element: str | None
    on_descendant: bool


def _oracle_regions(text: str) -> list[str]:
    """Extract the raw contents of every oracle ``@layer`` block."""
    regions: list[str] = []
    for m in re.finditer(r"@layer\s+([\w-]+)\s*\{", text):
        if m.group(1) not in ORACLE_LAYERS:
            continue
        depth = 1
        j = m.end()
        n = len(text)
        while j < n and depth:
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
            j += 1
        regions.append(text[m.end() : j - 1])
    return regions


def build_utility_oracle(dist_dir: Path) -> dict[str, list[UtilityDecl]]:
    """Map every emitted utility/components-layer class to its properties."""
    css_files = sorted(dist_dir.glob("assets/*.css"))
    if not css_files:
        raise FileNotFoundError("frontend/dist/assets/*.css")
    oracle: dict[str, list[UtilityDecl]] = {}
    for path in css_files:
        text = cpl.blank_css_comments(path.read_text(encoding="utf-8", errors="replace"))
        for region in _oracle_regions(text):
            for rule in cpl.parse_css(region):
                for part in cpl.split_top_level(rule.selector, ","):
                    part = part.strip()
                    m = cpl.CLASS_IN_SELECTOR_RE.search(part)
                    if not m:
                        continue
                    token = cpl.unescape_class(m.group(1))
                    tail = part[m.end() :]
                    pseudo = cpl.PSEUDO_ELEMENT_RE.search(tail)
                    cond_bits = list(rule.conditions)
                    cond_pseudo = cpl.CONDITIONAL_PSEUDO_RE.search(tail)
                    if cond_pseudo:
                        cond_bits.append(f":{cond_pseudo.group(1)}")
                    on_descendant = bool(re.search(r"[>~+ ]\s*\S", tail.split("::")[0]))
                    condition = " AND ".join(cond_bits) if cond_bits else None
                    for decl in rule.decls:
                        if decl.prop.startswith("--tw-"):
                            continue
                        oracle.setdefault(token, []).append(
                            UtilityDecl(
                                prop=decl.prop,
                                value=decl.value,
                                atoms=decl.atoms,
                                condition=condition,
                                pseudo_element=pseudo.group(1) if pseudo else None,
                                on_descendant=on_descendant,
                            )
                        )
    return oracle


# --------------------------------------------------------------------------
# Block rules: subject extraction from global.css selectors
# --------------------------------------------------------------------------


@dataclass
class SubjectInfo:
    selector_part: str
    required_classes: set[str]
    alternative_classes: set[str]
    tag: str | None
    context_classes: set[str]
    pseudo_element: str | None
    conditional: str | None

    @property
    def classes(self) -> set[str]:
        """All subject classes (required AND alternatives), for display."""
        return self.required_classes | self.alternative_classes

    def matches(self, tokens: set[str]) -> bool:
        """True when an element's class tokens satisfy this subject.

        A compound like ``.answer-option.is-selected`` requires ALL its
        classes on the element; classes inside ``:is()``/``:where()`` are
        alternatives - at least one must be present.
        """
        if not self.required_classes <= tokens:
            return False
        if self.alternative_classes and not (self.alternative_classes & tokens):
            return False
        return True


def _strip_not(compound: str) -> str:
    """Remove ``:not(...)`` spans - their classes are anti-subjects."""
    out: list[str] = []
    i = 0
    n = len(compound)
    while i < n:
        if compound[i] == ":" and compound[i : i + 5].lower() == ":not(":
            depth = 1
            j = i + 5
            while j < n and depth:
                if compound[j] == "(":
                    depth += 1
                elif compound[j] == ")":
                    depth -= 1
                j += 1
            i = j
            continue
        out.append(compound[i])
        i += 1
    return "".join(out)


_IS_WHERE_RE = re.compile(r":(?:is|where)\(", re.I)


def _split_is_where(compound: str) -> tuple[str, str]:
    """Split a compound into (outside, inside) of ``:is()``/``:where()``."""
    outside: list[str] = []
    inside: list[str] = []
    i = 0
    n = len(compound)
    while i < n:
        m = _IS_WHERE_RE.match(compound, i)
        if m:
            depth = 1
            j = m.end()
            while j < n and depth:
                if compound[j] == "(":
                    depth += 1
                elif compound[j] == ")":
                    depth -= 1
                j += 1
            inside.append(compound[m.end() : j - 1])
            i = j
            continue
        outside.append(compound[i])
        i += 1
    return "".join(outside), " ".join(inside)


def analyze_selector_part(part: str) -> SubjectInfo:
    """Derive subject classes / tag / conditions for one selector part."""
    part = part.strip()
    compounds = [c for c in cpl.split_top_level(part, " >+~\t") if c.strip()]
    if not compounds:
        return SubjectInfo(part, set(), set(), None, set(), None, None)
    rightmost = compounds[-1]
    pseudo = cpl.PSEUDO_ELEMENT_RE.search(rightmost)
    outside, inside = _split_is_where(_strip_not(rightmost))
    required = {cpl.unescape_class(m.group(1)) for m in cpl.CLASS_IN_SELECTOR_RE.finditer(outside)}
    alternatives = {
        cpl.unescape_class(m.group(1)) for m in cpl.CLASS_IN_SELECTOR_RE.finditer(inside)
    }
    context_classes: set[str] = set()
    for compound in compounds[:-1]:
        context_classes |= {
            cpl.unescape_class(m.group(1)) for m in cpl.CLASS_IN_SELECTOR_RE.finditer(compound)
        }
    tag = None
    if not required and not alternatives:
        tag_match = re.match(r"([a-zA-Z][\w-]*|\*)", outside.strip())
        tag = tag_match.group(1).lower() if tag_match else "*"
    cond = cpl.CONDITIONAL_PSEUDO_RE.search(part)
    return SubjectInfo(
        selector_part=part,
        required_classes=required,
        alternative_classes=alternatives,
        tag=tag,
        context_classes=context_classes,
        pseudo_element=pseudo.group(1) if pseudo else None,
        conditional=f":{cond.group(1)}" if cond else None,
    )


# --------------------------------------------------------------------------
# TSX element scan (per className occurrence, with line numbers)
# --------------------------------------------------------------------------


@dataclass
class ElementUse:
    file: Path
    line: int
    tag: str
    tokens: set[str]


TAG_ALIASES = {"a": {"a", "link", "navlink"}}


def _jsx_tag_before(text: str, pos: int) -> str:
    """Best-effort: the JSX tag of the element whose attribute sits at pos."""
    lt = text.rfind("<", 0, pos)
    while lt > 0 and lt + 1 < len(text) and not text[lt + 1].isalpha():
        lt = text.rfind("<", 0, lt)
    if lt == -1:
        return ""
    m = re.match(r"<([A-Za-z][\w.]*)", text[lt : lt + 80])
    return m.group(1).lower() if m else ""


def _tokens_for_occurrence(text: str, match_end: int) -> set[str] | None:
    """Extract the static class tokens of one ``className=`` occurrence.

    Mirrors ``dcn.extract_used_classes`` but for a single attribute.
    Returns ``None`` for non-literal expressions (unpruefbar).
    """
    j = match_end
    n = len(text)
    while j < n and text[j] in " \t\n\r":
        j += 1
    if j >= n or text[j] != "=":
        return None
    j += 1
    while j < n and text[j] in " \t\n\r":
        j += 1
    if j >= n:
        return None
    ch = text[j]
    tokens: set[str] = set()
    if ch in "\"'":
        content, _ = dcn._read_quoted(text, j)
        tokens = dcn._tokens_from_static(content)
    elif ch == "`":
        content, _ = dcn._read_backtick(text, j)
        tokens, _u = dcn._tokens_from_template(content)
    elif ch == "{":
        expr, _ = dcn._read_braced(text, j)
        head = dcn.CALL_HEAD_RE.match(expr)
        if head and head.group(1) not in dcn.MERGER_FUNCS:
            return None
        tokens, _u = dcn._tokens_from_expr(expr)
    else:
        return None
    return {t for t in tokens if dcn.CLASS_TOKEN_RE.match(t)}


def scan_elements() -> list[ElementUse]:
    """Collect every statically readable className occurrence in src."""
    elements: list[ElementUse] = []
    for path in dcn.source_files():
        name = path.name
        if ".test." in name or ".spec." in name or "__tests__" in path.parts:
            continue
        raw = path.read_text(encoding="utf-8", errors="replace")
        text = blank_ts_comments(raw)
        for m in dcn.CLASSNAME_RE.finditer(text):
            tokens = _tokens_for_occurrence(text, m.end())
            if not tokens:
                continue
            elements.append(
                ElementUse(
                    file=path,
                    line=text.count("\n", 0, m.start()) + 1,
                    tag=_jsx_tag_before(text, m.start()),
                    tokens=tokens,
                )
            )
    return elements


# --------------------------------------------------------------------------
# Conflict detection
# --------------------------------------------------------------------------


@dataclass
class Finding:
    rule: cpl.CssRule
    subject: SubjectInfo
    element: ElementUse
    utility: str
    rule_prop: str
    utility_prop: str
    shared_atoms: frozenset[str]
    same_value: bool
    conditions: list[str]
    via_tag_heuristic: bool


@dataclass
class BlockReport:
    label: str
    start: int
    end: int
    rule_count: int = 0
    conflicts: list[Finding] = field(default_factory=list)
    same_value_notes: list[Finding] = field(default_factory=list)
    unmatchable: list[tuple[cpl.CssRule, str]] = field(default_factory=list)


def _pseudo_matches(rule_pe: str | None, util_pe: str | None) -> bool:
    """A ::before rule can only collide with a before: utility, etc."""
    return (rule_pe or None) == (util_pe or None)


def _match_element(
    rule: cpl.CssRule,
    subject: SubjectInfo,
    element: ElementUse,
    oracle: dict[str, list[UtilityDecl]],
    via_tag: bool,
) -> tuple[list[Finding], list[Finding]]:
    conflicts: list[Finding] = []
    notes: list[Finding] = []
    for token in sorted(element.tokens):
        if token in subject.classes:
            continue
        for udecl in oracle.get(token, ()):
            if not _pseudo_matches(subject.pseudo_element, udecl.pseudo_element):
                continue
            for decl in rule.decls:
                if decl.important:
                    continue
                shared = cpl.props_intersect(decl.atoms, udecl.atoms)
                if not shared:
                    continue
                conditions = [c for c in rule.conditions]
                if subject.conditional:
                    conditions.append(f"Regel {subject.conditional}")
                if udecl.condition:
                    conditions.append(f"Utility {udecl.condition}")
                if udecl.on_descendant:
                    conditions.append("Utility wirkt auf Nachfahren/Geschwister")
                same = (
                    decl.prop.strip().lower() == udecl.prop.strip().lower()
                    and decl.value == udecl.value
                )
                finding = Finding(
                    rule=rule,
                    subject=subject,
                    element=element,
                    utility=token,
                    rule_prop=decl.prop,
                    utility_prop=udecl.prop,
                    shared_atoms=shared,
                    same_value=same,
                    conditions=conditions,
                    via_tag_heuristic=via_tag,
                )
                (notes if same else conflicts).append(finding)
    return conflicts, notes


def audit_block(
    label: str,
    start: int,
    end: int,
    rules: list[cpl.CssRule],
    elements: list[ElementUse],
    class_index: dict[str, list[ElementUse]],
    file_classes: dict[Path, set[str]],
    oracle: dict[str, list[UtilityDecl]],
) -> BlockReport:
    """Audit one global.css block (line range) against the oracle."""
    report = BlockReport(label=label, start=start, end=end)
    block_rules = [r for r in rules if start <= r.line <= end]
    report.rule_count = len(block_rules)
    for rule in block_rules:
        if not any(not d.important for d in rule.decls):
            continue
        for part in cpl.split_top_level(rule.selector, ","):
            subject = analyze_selector_part(part)
            if subject.classes:
                candidates: set[int] = set()
                seen: list[ElementUse] = []
                for cls in subject.classes:
                    for element in class_index.get(cls, ()):
                        if id(element) not in candidates:
                            candidates.add(id(element))
                            seen.append(element)
                for element in seen:
                    if not subject.matches(element.tokens):
                        continue
                    c, s = _match_element(rule, subject, element, oracle, False)
                    report.conflicts.extend(c)
                    report.same_value_notes.extend(s)
            elif subject.tag:
                if not subject.context_classes:
                    report.unmatchable.append(
                        (rule, f"Typ-Subjekt '{subject.tag}' ohne Kontextklasse")
                    )
                    continue
                context_files = {
                    f for f, classes in file_classes.items() if classes & subject.context_classes
                }
                aliases = TAG_ALIASES.get(subject.tag, {subject.tag})
                matched_any = False
                for element in elements:
                    if element.file not in context_files:
                        continue
                    if subject.tag != "*" and element.tag not in aliases:
                        continue
                    c, s = _match_element(rule, subject, element, oracle, True)
                    if c or s:
                        matched_any = True
                    report.conflicts.extend(c)
                    report.same_value_notes.extend(s)
                if not matched_any and subject.tag == "*":
                    report.unmatchable.append((rule, "Universal-Subjekt '*' - manuell pruefen"))
    return report


# --------------------------------------------------------------------------
# Block specification / wrapped-block discovery
# --------------------------------------------------------------------------

BLOCK_SPEC_RE = re.compile(r"^(\d+)-(\d+)(?::(.+))?$")
WRAP_OPEN_RE = re.compile(r"^@layer legacy \{")
WRAP_CLOSE_RE = re.compile(r"^\} /\* @layer legacy \*/")
HEADER_RE = re.compile(r"^/\* [-=]{2,}|^/\* --- (.+?) -+ \*/")


def parse_block_specs(specs: list[str]) -> list[tuple[str, int, int]]:
    blocks: list[tuple[str, int, int]] = []
    for spec in specs:
        m = BLOCK_SPEC_RE.match(spec.strip())
        if not m:
            raise ValueError(f"ungueltige --block Angabe: {spec!r} (START-END[:LABEL])")
        start, end = int(m.group(1)), int(m.group(2))
        if end < start:
            raise ValueError(f"ungueltiger Bereich: {spec!r}")
        blocks.append((m.group(3) or f"{start}-{end}", start, end))
    return blocks


def discover_wrapped_blocks(css_text: str) -> list[tuple[str, int, int]]:
    """Find existing ``@layer legacy { ... }`` wrappers with their labels."""
    lines = css_text.splitlines()
    blocks: list[tuple[str, int, int]] = []
    open_line: int | None = None
    for idx, line_text in enumerate(lines, start=1):
        if WRAP_OPEN_RE.match(line_text):
            open_line = idx
        elif WRAP_CLOSE_RE.match(line_text) and open_line is not None:
            label = f"@{open_line}"
            for back in range(open_line - 1, max(0, open_line - 4), -1):
                m = re.match(r"^/\* -+ (.+?) -+ \*/", lines[back - 1]) or re.match(
                    r"^/\* --- (.+?) -+.*", lines[back - 1]
                )
                if m:
                    label = m.group(1).strip()
                    break
            blocks.append((label, open_line, idx))
            open_line = None
    return blocks


# --------------------------------------------------------------------------
# Reporting
# --------------------------------------------------------------------------


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def print_report(report: BlockReport) -> None:
    print(f"\n=== Block '{report.label}' (global.css {report.start}-{report.end}) ===")
    print(f"    Regeln im Bereich: {report.rule_count}")

    grouped: dict[tuple[int, str], list[Finding]] = {}
    for finding in report.conflicts:
        grouped.setdefault((finding.rule.line, finding.subject.selector_part), []).append(finding)
    for (line, selector), findings in sorted(grouped.items()):
        print(f"\n  KONFLIKT  {selector}  (global.css:{line})")
        seen: set[tuple[str, str, str, int]] = set()
        for f in sorted(findings, key=lambda x: (str(x.element.file), x.element.line, x.utility)):
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
            print(f"      {selector} (:{line}) {prop} == '{utility}' @ {file}:{el_line}")

    if report.unmatchable:
        print(f"\n  unpruefbar ({len(report.unmatchable)}):")
        for rule, reason in report.unmatchable:
            print(f"      {rule.selector} (global.css:{rule.line}) - {reason}")

    n_conf = len(
        {
            (f.rule.line, f.rule_prop, f.utility, str(f.element.file), f.element.line)
            for f in report.conflicts
        }
    )
    verdict = "CLEAN" if n_conf == 0 else f"KONFLIKTE({n_conf})"
    print(f"\n  URTEIL {report.label}: {verdict}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="EXP-044 pre-wrap conflict audit (Refs #1485). Analysis tool, no gate."
    )
    parser.add_argument(
        "--block",
        action="append",
        default=[],
        metavar="START-END[:LABEL]",
        help="global.css Zeilenbereich eines Kandidaten-Blocks (wiederholbar)",
    )
    parser.add_argument(
        "--wrapped",
        action="store_true",
        help="stattdessen die bereits gewrappten '@layer legacy'-Bloecke auditieren",
    )
    args = parser.parse_args()

    if not args.block and not args.wrapped:
        parser.print_help()
        return 1

    if not GLOBAL_CSS.is_file():
        print(f"FEHLER: {GLOBAL_CSS} nicht gefunden.", file=sys.stderr)
        return 1
    css_text = GLOBAL_CSS.read_text(encoding="utf-8", errors="replace")

    try:
        blocks = parse_block_specs(args.block)
    except ValueError as exc:
        print(f"FEHLER: {exc}", file=sys.stderr)
        return 1
    if args.wrapped:
        wrapped = discover_wrapped_blocks(css_text)
        if not wrapped:
            print("FEHLER: keine '@layer legacy'-Wrapper gefunden.", file=sys.stderr)
            return 1
        blocks.extend(wrapped)

    try:
        oracle = build_utility_oracle(DIST_DIR)
    except FileNotFoundError:
        print(
            "FEHLER: keine Build-CSS unter frontend/dist/assets/*.css.\n"
            "Erst bauen: (cd frontend && VITE_STORAGE_MODE=dexie bun run build)\n"
            "oder `make audit-legacy-conflicts` benutzen (baut vorher).",
            file=sys.stderr,
        )
        return 1

    rules = cpl.parse_css(css_text)
    elements = scan_elements()
    class_index: dict[str, list[ElementUse]] = {}
    file_classes: dict[Path, set[str]] = {}
    for element in elements:
        file_classes.setdefault(element.file, set()).update(element.tokens)
        for token in element.tokens:
            class_index.setdefault(token, []).append(element)

    print("=== EXP-044 Konflikt-Audit: @layer-legacy-Wrap-Kandidaten (#1485) ===")
    print(
        f"Oracle: {len(oracle)} Utility-Klassen aus @layer "
        f"{'/'.join(sorted(ORACLE_LAYERS))} | global.css-Regeln: {len(rules)} | "
        f"statisch lesbare className-Elemente: {len(elements)}"
    )

    verdicts: list[tuple[str, int]] = []
    for label, start, end in blocks:
        report = audit_block(label, start, end, rules, elements, class_index, file_classes, oracle)
        print_report(report)
        n_conf = len(
            {
                (f.rule.line, f.rule_prop, f.utility, str(f.element.file), f.element.line)
                for f in report.conflicts
            }
        )
        verdicts.append((label, n_conf))

    print("\n=== Zusammenfassung ===")
    for label, n_conf in verdicts:
        verdict = "CLEAN" if n_conf == 0 else f"KONFLIKTE({n_conf})"
        print(f"  {verdict:>14}  {label}")
    print(
        "\nHinweis: Analyse-Tool, kein Gate. Bias: lieber False Positive als"
        " False Negative -\nKONFLIKTE-Bloecke vor einem Wrap manuell pruefen"
        " (Refs #1485, PR #1571)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
