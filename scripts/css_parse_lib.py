#!/usr/bin/env python3
"""css_parse_lib.py - minimal stdlib-only CSS parsing + property model.

Extracted from ``check-legacy-wrap-conflicts.py`` (EXP-044 / #1485) so the
audit CLI stays cohesive. Scope: flat (non-nested) CSS as written in
``global.css`` and emitted by the Tailwind build - rules with line
numbers, ``@media``/``@supports`` condition context, ``@layer`` as a
transparent group, plus a conservative shorthand -> longhand property
expansion (``margin`` collides with ``margin-top``, logical
``padding-inline`` maps onto physical ``padding-left``/``-right``, ...).

No third-party dependencies; individually importable via
``importlib.util.spec_from_file_location`` (see the audit script).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

CLASS_IN_SELECTOR_RE = re.compile(r"\.((?:[\w-]|\\.)+)")

PSEUDO_ELEMENT_RE = re.compile(
    r"::?(before|after|placeholder|marker|selection|backdrop|first-line|"
    r"first-letter|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+)"
)

CONDITIONAL_PSEUDO_RE = re.compile(
    r":(hover|focus(?:-within|-visible)?|active|checked|disabled|enabled|"
    r"target|visited|focus|empty|first-child|last-child|nth-[\w-]+|"
    r"only-child|placeholder-shown|invalid|valid|open)\b"
)


def unescape_class(token: str) -> str:
    """Undo CSS selector escaping (``md\\:flex`` -> ``md:flex``)."""
    return re.sub(r"\\(.)", r"\1", token)


def blank_css_comments(text: str) -> str:
    """Replace ``/* ... */`` comment bodies with spaces, keeping newlines.

    Offset-preserving so rule line numbers stay correct.
    """
    out = list(text)
    i = 0
    n = len(text)
    while i < n - 1:
        if text[i] == "/" and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            end = n if j == -1 else j + 2
            for k in range(i, end):
                if out[k] != "\n":
                    out[k] = " "
            i = end
        else:
            i += 1
    return "".join(out)


def split_top_level(text: str, separators: str) -> list[str]:
    """Split ``text`` on any of ``separators`` at paren/bracket depth 0."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for ch in text:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        if depth == 0 and ch in separators:
            if current:
                parts.append("".join(current))
                current = []
            continue
        current.append(ch)
    if current:
        parts.append("".join(current))
    return parts


# --------------------------------------------------------------------------
# Shorthand expansion
# --------------------------------------------------------------------------

_SIDES = ("top", "right", "bottom", "left")

# Shorthand -> longhand expansion, as a compact spec: one shorthand per
# line, ``shorthand: atom atom ...``. ``@SIDE``/``@BSC`` templates expand
# over the four physical sides / the border sub-properties below.
_EXPANSION_SPEC = """
margin: margin-@SIDE
padding: padding-@SIDE
inset: @SIDE
gap: row-gap column-gap
grid-gap: row-gap column-gap
grid-row-gap: row-gap
grid-column-gap: column-gap
overflow: overflow-x overflow-y
flex: flex-grow flex-shrink flex-basis
flex-flow: flex-direction flex-wrap
place-items: align-items justify-items
place-content: align-content justify-content
place-self: align-self justify-self
background: background-color background-image background-position-x \
  background-position-y background-size background-repeat \
  background-attachment background-origin background-clip
background-position: background-position-x background-position-y
font: font-family font-size font-weight font-style font-variant \
  font-stretch line-height
border-radius: border-top-left-radius border-top-right-radius \
  border-bottom-right-radius border-bottom-left-radius
outline: outline-width outline-style outline-color
text-decoration: text-decoration-line text-decoration-color \
  text-decoration-style text-decoration-thickness
list-style: list-style-type list-style-position list-style-image
columns: column-width column-count
animation: animation-name animation-duration animation-timing-function \
  animation-delay animation-iteration-count animation-direction \
  animation-fill-mode animation-play-state
transition: transition-property transition-duration \
  transition-timing-function transition-delay
grid-template: grid-template-rows grid-template-columns grid-template-areas
grid: grid-template-rows grid-template-columns grid-template-areas \
  grid-auto-rows grid-auto-columns grid-auto-flow
grid-area: grid-row-start grid-row-end grid-column-start grid-column-end
grid-row: grid-row-start grid-row-end
grid-column: grid-column-start grid-column-end
border: border-@SIDE-@BSC
border-width: border-@SIDE-width
border-style: border-@SIDE-style
border-color: border-@SIDE-color
border-top: border-top-@BSC
border-right: border-right-@BSC
border-bottom: border-bottom-@BSC
border-left: border-left-@BSC
"""


_PLACEHOLDERS = {"@SIDE": _SIDES, "@BSC": ("width", "style", "color")}


def _expand_atom(atom: str) -> list[str]:
    """Recursively substitute ``@SIDE``/``@BSC`` templates in one atom."""
    for placeholder, values in _PLACEHOLDERS.items():
        if placeholder in atom:
            expanded: list[str] = []
            for value in values:
                expanded.extend(_expand_atom(atom.replace(placeholder, value, 1)))
            return expanded
    return [atom]


def _parse_expansion_spec(spec: str) -> dict[str, tuple[str, ...]]:
    """Expand the compact spec above into the shorthand -> atoms table."""
    table: dict[str, tuple[str, ...]] = {}
    for line in spec.replace("\\\n", " ").splitlines():
        line = line.strip()
        if not line:
            continue
        shorthand, _, atoms_text = line.partition(":")
        atoms: list[str] = []
        for atom in atoms_text.split():
            atoms.extend(_expand_atom(atom))
        table[shorthand.strip()] = tuple(atoms)
    return table


_EXPANSIONS: dict[str, tuple[str, ...]] = _parse_expansion_spec(_EXPANSION_SPEC)

# Logical -> physical canonicalisation (LTR assumption; ``px-2`` emits
# ``padding-inline`` in Tailwind v4 while legacy rules write ``padding``).
_LOGICAL_AXES = {
    "inline": ("left", "right"),
    "block": ("top", "bottom"),
    "inline-start": ("left",),
    "inline-end": ("right",),
    "block-start": ("top",),
    "block-end": ("bottom",),
}

ALL_SENTINEL = "*ALL*"


def expand_property(prop: str) -> frozenset[str]:
    """Expand ``prop`` into its atomic (physical, longhand) property keys.

    Conservative: a shorthand collides with every sub-property; logical
    properties map onto their physical LTR equivalents; unknown or custom
    properties stay atomic; ``all`` collides with everything.
    """
    p = prop.strip().lower()
    if p.startswith("--"):
        return frozenset({p})
    for prefix in ("-webkit-", "-moz-", "-ms-", "-o-"):
        if p.startswith(prefix):
            unprefixed = p[len(prefix) :]
            return frozenset({p}) | expand_property(unprefixed)
    if p == "all":
        return frozenset({ALL_SENTINEL})
    for base in ("margin", "padding", "scroll-margin", "scroll-padding", "inset"):
        head = base if base != "inset" else "inset"
        if p == head or p.startswith(head + "-"):
            suffix = "" if p == head else p[len(head) + 1 :]
            if suffix in _LOGICAL_AXES:
                sides = _LOGICAL_AXES[suffix]
            elif suffix in _SIDES:
                sides = (suffix,)
            elif suffix == "":
                sides = _SIDES
            else:
                break
            if base == "inset":
                return frozenset(sides)
            return frozenset(f"{base}-{s}" for s in sides)
    if p.startswith("border-") and any(a in p for a in _LOGICAL_AXES):
        for axis, sides in _LOGICAL_AXES.items():
            marker = f"border-{axis}"
            if p == marker or p.startswith(marker + "-"):
                tail = p[len(marker) :].lstrip("-") or "width/style/color"
                props = ("width", "style", "color") if tail == "width/style/color" else (tail,)
                return frozenset(f"border-{s}-{q}" for s in sides for q in props)
    if p in _EXPANSIONS:
        return frozenset(_EXPANSIONS[p])
    return frozenset({p})


def props_intersect(a: frozenset[str], b: frozenset[str]) -> frozenset[str]:
    """Intersect two atomic property sets, honouring the ``all`` sentinel."""
    if ALL_SENTINEL in a:
        return b or frozenset({ALL_SENTINEL})
    if ALL_SENTINEL in b:
        return a or frozenset({ALL_SENTINEL})
    return a & b


# --------------------------------------------------------------------------
# CSS parsing (shared by the dist oracle and the global.css block scan)
# --------------------------------------------------------------------------


@dataclass
class Declaration:
    prop: str
    value: str
    important: bool
    atoms: frozenset[str] = field(default_factory=frozenset)


@dataclass
class CssRule:
    selector: str
    line: int
    conditions: tuple[str, ...]
    decls: list[Declaration]


def _split_declarations(body: str) -> list[Declaration]:
    """Split a rule body into declarations (``;`` at depth 0 only)."""
    decls: list[Declaration] = []
    for chunk in split_top_level(body, ";"):
        chunk = chunk.strip()
        if not chunk or ":" not in chunk:
            continue
        prop, value = chunk.split(":", 1)
        prop = prop.strip()
        if not prop or "(" in prop:
            continue
        value = value.strip()
        important = "!important" in value.lower()
        if important:
            value = re.sub(r"!\s*important", "", value, flags=re.I).strip()
        decls.append(
            Declaration(
                prop=prop,
                value=re.sub(r"\s+", " ", value),
                important=important,
                atoms=expand_property(prop),
            )
        )
    return decls


_SKIP_AT_RULES = {
    "keyframes",
    "-webkit-keyframes",
    "font-face",
    "property",
    "counter-style",
    "page",
    "font-feature-values",
}
_CONDITION_AT_RULES = {"media", "supports", "container"}


def parse_css(text: str) -> list[CssRule]:
    """Parse flat (non-nested) CSS into rules with line numbers.

    Handles ``@media``/``@supports``/``@container`` as condition context,
    ``@layer name { ... }`` as a transparent group, ``@keyframes`` etc.
    as skipped blocks, and at-statements (``@import ...;``). CSS nesting
    is not supported (neither global.css nor the Tailwind output use it).
    """
    text = blank_css_comments(text)
    rules: list[CssRule] = []
    conditions: list[str] = []
    stack: list[str] = []  # 'cond' | 'layer'
    i = 0
    n = len(text)
    line = 1

    def advance(upto: int) -> None:
        nonlocal line, i
        line += text.count("\n", i, upto)
        i = upto

    def skip_block(start: int) -> int:
        depth = 0
        j = start
        while j < n:
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    return j + 1
            j += 1
        return n

    while i < n:
        ch = text[i]
        if ch in " \t\r\n":
            if ch == "\n":
                line += 1
            i += 1
            continue
        if ch == "}":
            if stack:
                kind = stack.pop()
                if kind == "cond":
                    conditions.pop()
            i += 1
            continue
        if ch == "@":
            brace = text.find("{", i)
            semi = text.find(";", i)
            if semi != -1 and (brace == -1 or semi < brace):
                advance(semi + 1)
                continue
            if brace == -1:
                break
            prelude = text[i + 1 : brace].strip()
            name = prelude.split(None, 1)[0].split("(")[0] if prelude else ""
            if name in _CONDITION_AT_RULES:
                conditions.append(re.sub(r"\s+", " ", prelude))
                stack.append("cond")
                advance(brace + 1)
                continue
            if name == "layer":
                stack.append("layer")
                advance(brace + 1)
                continue
            advance(skip_block(brace))
            continue
        brace = text.find("{", i)
        if brace == -1:
            break
        close = text.find("}", brace)
        if close == -1:
            break
        selector = re.sub(r"\s+", " ", text[i:brace]).strip()
        rule_line = line
        body = text[brace + 1 : close]
        if selector:
            rules.append(
                CssRule(
                    selector=selector,
                    line=rule_line,
                    conditions=tuple(conditions),
                    decls=_split_declarations(body),
                )
            )
        advance(close + 1)
    return rules
