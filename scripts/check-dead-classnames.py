#!/usr/bin/env python3
r"""check-dead-classnames.py - usage-side referential-integrity gate (#1491).

Companion to ``scripts/check-css-size.sh`` (#1467). That guard covers the
DEFINITION side (global.css may only shrink). This one covers the USAGE
side: a ``className="foo"`` where ``foo`` is neither a defined CSS class
nor a Tailwind utility renders unstyled and trips no linter - the #1465
``.settings-subsection`` bug and the dead ``.api-key-required-*`` classes
are exactly this shape.

What it does (measure + cap only - it never migrates a finding):

1. Extracts every CSS class name used in ``className`` attributes across
   ``frontend/src``. Static strings and the static parts of template
   literals and ``cn()``/``clsx()`` literals are read; the ``${...}``
   dynamic parts (and any token glued to one) are SKIPPED and counted as
   "unpruefbar" - never guessed.
2. A class name is legitimate if it is EITHER
     (a) defined in a CSS file under ``frontend/src``, OR
     (b) a Tailwind utility - verified against the GENERATED build CSS
         (``frontend/dist/assets/*.css``), not a hand-maintained list, OR
     (c) listed on the documented exception baseline
         (``.dead-classnames-baseline``).
   Everything else is a dead class name.
3. Ratchets via ``.dead-classnames-baseline`` (the starting inventory).
   A dead class NOT already on the baseline = growth = exit 1. The gate
   only ratchets down: once a baselined class is fixed, drop it from the
   file.

Why the build CSS is the Tailwind oracle: after Tailwind purges, the
build stylesheet contains exactly the utilities that are actually emitted
PLUS every bundled global.css / theme / shadcn class. A used class that is
a real utility is therefore present; a typo like ``flexx`` is not. CSS
selector escaping (``.md\:flex``, ``.bg-\[var\(--x\)\]``) is undone by
stripping backslashes before matching, so the source token matches its
selector form without re-implementing Tailwind's escaper.

The build CSS must exist first (``frontend/dist``). ``make
check-dead-classnames`` builds it, then runs this. In CI the cohesion
workflow does the same. Run standalone after a ``VITE_STORAGE_MODE=dexie
npm run build``.

THE LIMIT OF THIS METHOD (#2484, documented as decided in #2486): name
matching answers "does this name occur somewhere", NOT "does this rule
take effect". A name-occurrence check is therefore NEVER a sufficient
basis for deleting CSS rules. Four blind spots, each with its precedent:

1. Dynamically composed names: a runtime-built classname never occurs
   verbatim in the source (``nav-mode-badge-${mode}`` nearly condemned
   two LIVE rules in the #2476 tranche; caught in re-verification).
2. Rules without classnames: element/attribute/sibling/inheritance
   selectors carry no name a search can find.
3. Inherited effect: a rule removed on a parent changes children that
   carry no name themselves.
4. Names from foreign sources: packages, content, or generated markup
   emit classnames that never appear in frontend/src. THIS ONE STRUCK
   in #2484 - ``@astrapi69/ai-key-vault-react``'s dist renders the
   AI-key settings with app-styled classnames; the #2476 tranche
   deleted their rules on a src-only '0 consumers' grep and the
   Settings > KI page shipped unstyled. This gate scans frontend/src
   only, so it saw nothing in either direction.

Consequence: a CSS-removal tranche needs a rendered-application check
of the affected surfaces (and the visual suite must actually COVER
them - the settings-ai tab had no baseline motif, which is why the
dispatched 0-diff run stayed green). Extension of this gate to
package-emitted classnames: #2486.

Exit codes:
  0 = no dead class name beyond the baseline (clean; may print ratchet-down hints)
  1 = a new dead class name appeared, or the build CSS / a required path is missing
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "frontend" / "src"
DIST_DIR = REPO_ROOT / "frontend" / "dist"
BASELINE_FILE = REPO_ROOT / ".dead-classnames-baseline"
UNSTYLED_BASELINE_FILE = REPO_ROOT / ".unstyled-classnames-baseline"
AUDIT = "docs/audits/global-css-analysis-2026-07-08.md"

# A token that could be a CSS class in this codebase: lowercase-kebab plus
# Tailwind's variant/arbitrary-value punctuation (``hover:``, ``max-h-[85vh]``,
# ``w-1/2``, ``gap-2.5``). Deliberately lowercase-only so identifier and
# i18n-key literals that happen to sit inside a className expression
# (``t("Some.Key")``) are dropped as non-candidates rather than misreported.
CLASS_TOKEN_RE = re.compile(r"^[a-z0-9][a-z0-9:._/%#\[\]()!&>+~-]*$")

DYNAMIC_SPAN_RE = re.compile(r"\$\{[^{}]*\}")


def _read_quoted(text: str, i: int) -> tuple[str, int]:
    """Read a ``'``- or ``"``-delimited literal starting at ``text[i]``.

    Returns the inner content and the index just past the closing quote.
    Honours backslash escapes.
    """
    quote = text[i]
    j = i + 1
    out: list[str] = []
    n = len(text)
    while j < n:
        c = text[j]
        if c == "\\" and j + 1 < n:
            out.append(text[j + 1])
            j += 2
            continue
        if c == quote:
            return "".join(out), j + 1
        out.append(c)
        j += 1
    return "".join(out), j


def _read_backtick(text: str, i: int) -> tuple[str, int]:
    """Read a template literal starting at the backtick ``text[i]``.

    Returns the raw inner content (``${...}`` spans still present) and the
    index past the closing backtick. Best-effort: a backtick nested inside
    a ``${...}`` is not handled (rare in a className expression).
    """
    j = i + 1
    out: list[str] = []
    n = len(text)
    while j < n:
        c = text[j]
        if c == "\\" and j + 1 < n:
            out.append(c)
            out.append(text[j + 1])
            j += 2
            continue
        if c == "`":
            return "".join(out), j + 1
        out.append(c)
        j += 1
    return "".join(out), j


def _read_braced(text: str, i: int) -> tuple[str, int]:
    """Read a balanced ``{ ... }`` JSX expression starting at ``text[i]``.

    String and template literals inside are skipped so a brace within a
    string does not unbalance the scan. Returns the inner expression and
    the index past the closing brace.
    """
    depth = 0
    j = i
    n = len(text)
    start = i + 1
    while j < n:
        c = text[j]
        if c in "\"'":
            _, j = _read_quoted(text, j)
            continue
        if c == "`":
            _, j = _read_backtick(text, j)
            continue
        if c == "{":
            depth += 1
            j += 1
            continue
        if c == "}":
            depth -= 1
            if depth == 0:
                return text[start:j], j + 1
            j += 1
            continue
        j += 1
    return text[start:j], j


def _tokens_from_static(content: str) -> set[str]:
    """Whitespace-split a plain string literal into complete class tokens."""
    return {w for w in content.split() if w}


def _tokens_from_template(content: str) -> tuple[set[str], int]:
    """Extract complete static class tokens from a template literal body.

    A token glued to a ``${...}`` boundary (no whitespace between) is a
    dynamic stem/tail (``bg-${color}`` -> ``bg-``) and is skipped as
    unpruefbar rather than guessed. Returns (tokens, unchecked_count).
    """
    tokens: set[str] = set()
    unchecked = len(DYNAMIC_SPAN_RE.findall(content))
    segments = DYNAMIC_SPAN_RE.split(content)
    last = len(segments) - 1
    for idx, seg in enumerate(segments):
        if not seg:
            continue
        left_dynamic = idx > 0
        right_dynamic = idx < last
        starts_ws = seg[0].isspace()
        ends_ws = seg[-1].isspace()
        words = seg.split()
        if not words:
            continue
        for k, word in enumerate(words):
            if k == 0 and left_dynamic and not starts_ws:
                unchecked += 1
                continue
            if k == len(words) - 1 and right_dynamic and not ends_ws:
                unchecked += 1
                continue
            tokens.add(word)
    return tokens, unchecked


def _tokens_from_expr(expr: str) -> tuple[set[str], int]:
    """Pull every string/template literal out of a className ``{...}`` expr.

    Covers ``cn(...)`` / ``clsx(...)`` / ternary / ``&&`` literals
    uniformly by scanning for literals; identifiers (const references) hold
    no literal here and are conservatively ignored.
    """
    tokens: set[str] = set()
    unchecked = 0
    i = 0
    n = len(expr)
    while i < n:
        c = expr[i]
        if c in "\"'":
            content, i = _read_quoted(expr, i)
            tokens |= _tokens_from_static(content)
        elif c == "`":
            content, i = _read_backtick(expr, i)
            t, u = _tokens_from_template(content)
            tokens |= t
            unchecked += u
        else:
            i += 1
    return tokens, unchecked


def strip_comments(text: str) -> str:
    """Remove ``//`` and ``/* */`` comments, preserving string/template
    literals verbatim (so a ``//`` inside a URL string or an apostrophe in
    prose is not misread). Without this, prose in a comment sitting inside
    a ``className={...}`` expression leaks in as bogus class tokens.
    """
    out: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c in "\"'`":
            out.append(c)
            j = i + 1
            while j < n:
                cj = text[j]
                out.append(cj)
                if cj == "\\" and j + 1 < n:
                    out.append(text[j + 1])
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
                j += 1
            i = j
            continue
        if text[i : i + 2] == "/*":
            j = i + 2
            while j < n and text[j : j + 2] != "*/":
                j += 1
            i = j + 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


CLASSNAME_RE = re.compile(r"\bclassName\b")

# Known class-merging helpers whose string arguments ARE applied verbatim.
MERGER_FUNCS = {
    "cn",
    "clsx",
    "cx",
    "classnames",
    "classNames",
    "twMerge",
    "twJoin",
}
# A className expression that is a single call ``ident(...)``. If ``ident``
# is not a merger, the helper transforms its arguments (``cardClassName``,
# ``buttonVariants``, ``t``), so their string literals are NOT literal class
# names — skip them as unpruefbar rather than misreport.
CALL_HEAD_RE = re.compile(r"^\s*([A-Za-z_$][\w$]*)\s*\(")


def extract_used_classes(text: str) -> tuple[set[str], int]:
    """Return (candidate class tokens, unchecked-dynamic count) for a file."""
    tokens: set[str] = set()
    unchecked = 0
    n = len(text)
    for m in CLASSNAME_RE.finditer(text):
        j = m.end()
        while j < n and text[j] in " \t\n\r":
            j += 1
        if j >= n or text[j] != "=":
            continue
        j += 1
        while j < n and text[j] in " \t\n\r":
            j += 1
        if j >= n:
            continue
        ch = text[j]
        if ch in "\"'":
            content, _ = _read_quoted(text, j)
            tokens |= _tokens_from_static(content)
        elif ch == "`":
            content, _ = _read_backtick(text, j)
            t, u = _tokens_from_template(content)
            tokens |= t
            unchecked += u
        elif ch == "{":
            expr, _ = _read_braced(text, j)
            head = CALL_HEAD_RE.match(expr)
            if head and head.group(1) not in MERGER_FUNCS:
                skipped, u = _tokens_from_expr(expr)
                unchecked += u + len(skipped)
                continue
            t, u = _tokens_from_expr(expr)
            tokens |= t
            unchecked += u
    candidates = {t for t in tokens if CLASS_TOKEN_RE.match(t)}
    return candidates, unchecked


def _load_corpus(paths: list[Path]) -> str:
    """Concatenate the given CSS files and strip backslashes (undo escaping)."""
    parts: list[str] = []
    for path in paths:
        parts.append(path.read_text(encoding="utf-8", errors="replace"))
    return "".join(parts).replace("\\", "")


def is_defined(token: str, corpus: str) -> bool:
    """True when ``.token`` occurs in ``corpus`` as a whole class token."""
    needle = "." + token
    length = len(needle)
    start = 0
    while True:
        idx = corpus.find(needle, start)
        if idx == -1:
            return False
        after = corpus[idx + length : idx + length + 1]
        if after == "" or not (after.isalnum() or after in "-_"):
            return True
        start = idx + length


def load_baseline() -> set[str]:
    if not BASELINE_FILE.exists():
        return set()
    entries: set[str] = set()
    for line in BASELINE_FILE.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            entries.add(line)
    return entries


def source_files() -> list[Path]:
    return sorted(
        p
        for ext in ("*.tsx", "*.ts")
        for p in SRC_DIR.rglob(ext)
    )


# --------------------------------------------------------------------------
# --unstyled mode (#1892): the render-unstyled archetype.
#
# The base gate above catches new dead class NAMES. This mode catches an
# element whose className tokens are ALL dead -> it renders with zero CSS
# (the #1715 / #1732 CreateLesson shape). Its dead oracle is the committed
# .dead-classnames-baseline (kept accurate by the base gate), so this mode
# is BUILD-INDEPENDENT: it reads only committed files, no frontend/dist.
# --------------------------------------------------------------------------


def static_class_groups(text: str) -> list[list[str]]:
    """Per-``className`` class-token lists, PURELY-STATIC values only.

    Returns one token list per ``className`` attribute whose value is fully
    static and thus fully checkable: a plain string literal, a braced single
    string literal (``{"..."}``), or a template literal with NO ``${...}``
    span. Any value routed through a call (``cn(...)``), an identifier, a
    ternary, or a dynamic template is EXCLUDED entirely -- its complete class
    set is unprovable, so it can never yield a false unstyled flag. Empty
    groups (no valid class token, e.g. an i18n-key literal) are dropped.

    Consumed only by the ``--unstyled`` gate; the base #1491 gate uses
    :func:`extract_used_classes` (which unions tokens across the file and so
    cannot ask the per-attribute "are ALL tokens dead" question).
    """
    groups: list[list[str]] = []
    n = len(text)
    for m in CLASSNAME_RE.finditer(text):
        j = m.end()
        while j < n and text[j] in " \t\n\r":
            j += 1
        if j >= n or text[j] != "=":
            continue
        j += 1
        while j < n and text[j] in " \t\n\r":
            j += 1
        if j >= n:
            continue
        ch = text[j]
        content: str | None = None
        if ch in "\"'":
            content, _ = _read_quoted(text, j)
        elif ch == "`":
            body, _ = _read_backtick(text, j)
            if "${" not in body:
                content = body
        elif ch == "{":
            expr, _ = _read_braced(text, j)
            stripped = expr.strip()
            if stripped[:1] in "\"'":
                inner, end = _read_quoted(stripped, 0)
                if end == len(stripped):  # a lone string literal {"..."}
                    content = inner
            elif stripped[:1] == "`":
                body, end = _read_backtick(stripped, 0)
                if end == len(stripped) and "${" not in body:  # lone {`...`}
                    content = body
            # cn(...) / identifier / ternary / dynamic template -> excluded
        if content is None:
            continue
        toks = [t for t in content.split() if CLASS_TOKEN_RE.match(t)]
        if toks:
            groups.append(toks)
    return groups


def unstyled_class_values(text: str, dead: set[str]) -> set[str]:
    """Canonical keys of ``className`` attributes whose EVERY token is dead.

    A key is the sorted, space-joined class tokens (order-independent, so a
    two-token combo is one stable entry regardless of author order). Only the
    purely-static classNames from :func:`static_class_groups` are considered.
    """
    values: set[str] = set()
    for toks in static_class_groups(text):
        if all(t in dead for t in toks):
            values.add(" ".join(sorted(toks)))
    return values


def load_unstyled_baseline() -> set[str]:
    if not UNSTYLED_BASELINE_FILE.exists():
        return set()
    entries: set[str] = set()
    for line in UNSTYLED_BASELINE_FILE.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            entries.add(line)
    return entries


def compute_unstyled() -> set[str]:
    """Canonical unstyled className values across ``frontend/src``.

    Dead oracle = the committed ``.dead-classnames-baseline`` (no build).
    """
    dead = load_baseline()
    values: set[str] = set()
    for path in source_files():
        text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
        values |= unstyled_class_values(text, dead)
    return values


def run_unstyled(regen: bool) -> int:
    current = compute_unstyled()
    if regen:
        for value in sorted(current):
            print(value)
        return 0

    baseline = load_unstyled_baseline()
    new_unstyled = sorted(current - baseline)
    migrated = sorted(baseline - current)

    print(
        "\n=== Unstyled-Classname-Gate (#1892): className mit AUSSCHLIESSLICH "
        "toten Tokens ==="
    )
    print(
        f"aktuell: {len(current)} | auf Baseline: {len(baseline)} | "
        f"neu: {len(new_unstyled)}\n"
    )

    if migrated:
        print(
            f"  OK     {len(migrated)} Baseline-Eintrag/-Eintraege nicht mehr "
            "vorhanden (gestylt/migriert)."
        )
        print("         Aus .unstyled-classnames-baseline loeschen (Ratchet runter):")
        for value in migrated:
            print(f"           - {value}")
        print("")

    if new_unstyled:
        print(
            f"  ERROR  {len(new_unstyled)} neue vollstaendig ungestylte "
            "className-Attribut(e):\n"
        )
        for value in new_unstyled:
            print(f'           "{value}"')
        print(
            "\nEine className, deren Tokens ALLE tote Klassen sind (weder CSS-Regel\n"
            "noch emittierte Tailwind-Utility), rendert das Element komplett ohne\n"
            "Styling (#1715/#1732). Drei Wege:\n"
            "  (a) das Element mit token-basierten Tailwind-Utilities stylen (die\n"
            "      tote Klasse als Test-/Baseline-Anker behalten ist ok),\n"
            "  (b) die fehlende CSS-Regel unter frontend/src definieren, oder\n"
            "  (c) falls bewusst extern gestylt: den Wert mit begruendetem\n"
            "      Kommentar in .unstyled-classnames-baseline eintragen.\n"
            f"Hintergrund: #1728, {AUDIT}"
        )
        return 1

    print("  OK     kein neues vollstaendig ungestyltes className-Attribut.\n")
    return 0


def compute_dead() -> tuple[set[str], set[str], int]:
    """Return (used, dead, unchecked). Requires the build CSS to exist."""
    build_css_files = sorted(DIST_DIR.glob("assets/*.css"))
    if not build_css_files:
        raise FileNotFoundError("frontend/dist/assets/*.css")
    build_css = _load_corpus(build_css_files)
    source_css = _load_corpus(sorted(SRC_DIR.rglob("*.css")))

    used: set[str] = set()
    unchecked = 0
    for path in source_files():
        text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
        file_used, file_unchecked = extract_used_classes(text)
        used |= file_used
        unchecked += file_unchecked

    dead = {
        t
        for t in used
        if not is_defined(t, build_css) and not is_defined(t, source_css)
    }
    return used, dead, unchecked


def main() -> int:
    if not SRC_DIR.is_dir():
        print(f"FEHLER: {SRC_DIR} nicht gefunden.")
        return 1

    # ``--unstyled`` runs the render-unstyled archetype gate (#1892). It is
    # build-independent (dead oracle = the committed .dead-classnames-baseline),
    # so it never needs frontend/dist. ``--unstyled --list`` regenerates the
    # .unstyled-classnames-baseline reproducibly.
    if "--unstyled" in sys.argv[1:]:
        return run_unstyled(regen="--list" in sys.argv[1:])

    # ``--list`` prints the bare dead class names (one per line) so the
    # baseline can be (re)generated reproducibly. It never consults or
    # fails on the baseline.
    if "--list" in sys.argv[1:]:
        try:
            _, dead, _ = compute_dead()
        except FileNotFoundError:
            print(
                "FEHLER: keine Build-CSS unter frontend/dist/assets/*.css.",
                file=sys.stderr,
            )
            return 1
        for name in sorted(dead):
            print(name)
        return 0

    try:
        used, dead, unchecked = compute_dead()
    except FileNotFoundError:
        print(
            "FEHLER: keine Build-CSS unter frontend/dist/assets/*.css.\n"
            "Der Tailwind-Utility-Check (b) braucht den generierten Build.\n"
            "Erst bauen: (cd frontend && VITE_STORAGE_MODE=dexie npm run build)\n"
            "oder `make check-dead-classnames` benutzen (baut vorher)."
        )
        return 1

    baseline = load_baseline()
    new_dead = sorted(dead - baseline)
    fixed = sorted(baseline - dead)

    print("\n=== Dead-Classname-Detektor: frontend/src ===")
    print(
        f"verwendete Klassen: {len(used)} | dynamisch/unpruefbar uebersprungen: "
        f"{unchecked}"
    )
    print(
        f"tote Klassen gesamt: {len(dead)} | auf Baseline: {len(baseline)} | "
        f"neu: {len(new_dead)}\n"
    )

    if fixed:
        print(
            f"  OK     {len(fixed)} Baseline-Eintrag/-Eintraege sind jetzt "
            "definiert/entfernt."
        )
        print("         Aus .dead-classnames-baseline loeschen (Ratchet runter):")
        for name in fixed:
            print(f"           - {name}")
        print("")

    if new_dead:
        print(f"  ERROR  {len(new_dead)} neue tote Klasse(n) in className-Attributen:\n")
        for name in new_dead:
            print(f"           .{name}")
        print(
            "\nEine Klasse in className, die weder als CSS-Regel existiert noch\n"
            "eine emittierte Tailwind-Utility ist, rendert kommentarlos ohne\n"
            "Styling (#1465). Drei Legitimierungswege:\n"
            "  (a) die Klasse in einer CSS-Datei unter frontend/src definieren,\n"
            "  (b) die korrekte Tailwind-Utility schreiben (erscheint dann im\n"
            "      Build-CSS), oder\n"
            "  (c) falls bewusst extern gestylt/absichtlich: den Namen mit\n"
            "      begruendetem Kommentar in .dead-classnames-baseline eintragen.\n"
            f"Hintergrund: {AUDIT}"
        )
        return 1

    print("  OK     keine neue tote Klasse ueber der Baseline.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
