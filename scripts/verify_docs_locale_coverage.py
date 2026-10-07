"""Per-locale help coverage ratchet for scripts/verify_docs.py (#3453).

``help-coverage`` compares the EN and DE help trees, the two the MkDocs
build and the in-app help are authored in. The other locales (es, fr, el,
pt, tr, ja) were never compared, and fifteen pages went missing in all six:
a reader there who opens such an entry gets the German default page
instead. This check holds every locale to the list of gaps it has today
(``docs/help/.locale-gaps.json``):

- a page missing from a locale that the list does not name FAILs - a new
  EN page needs its translations, or a declared gap in the same commit;
- a listed gap whose page now exists FAILs too, so a translation removes
  its entry and the list only ever shrinks by a visible edit (#2140).

A missing EN tree, no locale directories, or an unreadable list is a FAIL
(#2287): "could not check" never prints as a green pass.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

CHECK = "locale-coverage"
AUTHORED = ("en", "de")
GAPS_FILE = ".locale-gaps.json"


class _Report(Protocol):
    def fail(self, check: str, message: str, fixed: bool = False) -> None: ...

    def note(self, message: str) -> None: ...


def _slugs(tree: Path) -> set[str]:
    return {p.relative_to(tree).with_suffix("").as_posix() for p in tree.rglob("*.md")}


def locales(help_root: Path) -> list[str]:
    """The translated help trees: every language directory except EN and DE."""
    return sorted(
        p.name
        for p in help_root.iterdir()
        if p.is_dir() and not p.name.startswith(("_", ".")) and p.name not in AUTHORED
    )


def check_locale_coverage(report: _Report, help_root: Path) -> None:
    """Compare every locale tree with EN against the declared gap list.

    Args:
        report: The verify_docs report collecting FAILs and notes.
        help_root: ``docs/help``.
    """
    en_tree = help_root / "en"
    if not en_tree.is_dir() or not _slugs(en_tree):
        report.fail(CHECK, f"{en_tree} has no help pages - cannot compare locales (#2287)")
        return
    langs = locales(help_root)
    if not langs:
        report.fail(CHECK, f"no locale directories under {help_root} (#2287)")
        return
    try:
        gaps = json.loads((help_root / GAPS_FILE).read_text(encoding="utf-8"))["gaps"]
    except (OSError, ValueError, KeyError) as exc:
        report.fail(CHECK, f"cannot read {help_root / GAPS_FILE}: {exc} (#2287)")
        return

    en = _slugs(en_tree)
    total = 0
    for lang in langs:
        missing = en - _slugs(help_root / lang)
        declared = set(gaps.get(lang, []))
        total += len(missing)
        new = sorted(missing - declared)
        closed = sorted(declared - missing)
        if new:
            report.fail(
                CHECK,
                f"{lang}: {len(new)} help page(s) missing and not declared in {GAPS_FILE}: "
                + ", ".join(new[:8]),
            )
        if closed:
            report.fail(
                CHECK,
                f"{lang}: {GAPS_FILE} still lists {len(closed)} page(s) that now exist - "
                "remove them: " + ", ".join(closed[:8]),
            )
    report.note(
        f"{CHECK}: {len(en)} EN pages against {len(langs)} locales "
        f"({', '.join(langs)}); {total} missing page(s) in total"
    )
