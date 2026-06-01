#!/usr/bin/env python3
"""Generate the mkdocs.yml nav + nav_translations blocks from _meta.yaml.

``docs/help/_meta.yaml`` is the single source of truth for help-page
navigation. The in-app help panel reads it directly, and the public
docs site nav is derived from it via this script. Eliminates the
hand-maintained-twice drift surfaced by the v0.30.0 docs+i18n drift
audit (two pages — articles/bulk-export.md and install/docker-desktop.md
— sat orphan in the public site for two release cycles before the
audit caught them).

The script edits ``mkdocs.yml`` in-place by replacing two
marker-bounded blocks:

- ``# AUTO-GENERATED-NAV-START`` ... ``# AUTO-GENERATED-NAV-END``
  inside the ``nav:`` block, AFTER the hand-managed
  ``- Home: de/index.md`` line. The Home entry stays hand-managed
  because ``index.md`` is not in ``_meta.yaml`` (landing page
  contract differs from help-page contract).

- ``# AUTO-GENERATED-LANGUAGES-START`` ...
  ``# AUTO-GENERATED-LANGUAGES-END`` inside the i18n plugin's
  ``languages:`` list. The whole locale list is generated from
  ``_meta.yaml``'s ``languages:`` entries: one ``- locale:`` block
  per language (``name`` + ``build: true``, ``default: true`` for
  the default locale), and a ``nav_translations:`` map per
  non-default locale carrying the DE-label -> target-label pairs.
  Identity mappings (DE label == target label) are omitted because
  mkdocs-static-i18n leaves untranslated keys as the source (DE)
  label, which is correct when the two languages share the term.

Modes:
  generate (default): regenerate the marker blocks in-place.
  --check: dry-run; exits non-zero if the regenerated content
    differs from the current mkdocs.yml. Suitable for CI.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
META_PATH = REPO_ROOT / "docs" / "help" / "_meta.yaml"
MKDOCS_PATH = REPO_ROOT / "mkdocs.yml"

NAV_START = (
    "# AUTO-GENERATED-NAV-START "
    "(do not edit; regenerate via make sync-mkdocs-nav)"
)
NAV_END = "# AUTO-GENERATED-NAV-END"
LANG_START = (
    "# AUTO-GENERATED-LANGUAGES-START "
    "(do not edit; regenerate via make sync-mkdocs-nav)"
)
LANG_END = "# AUTO-GENERATED-LANGUAGES-END"


def _load_meta() -> dict:
    return yaml.safe_load(META_PATH.read_text(encoding="utf-8"))


def _generate_nav_lines(meta: dict) -> list[str]:
    """Render the nav: items into mkdocs.yml format.

    Each top-level item without children becomes a single nav line:
        - <DE title>: de/<slug>.md
    Each item with children becomes a nav-section:
        - <DE title>:
          - <child DE title>: de/<child slug>.md
    The parent's own slug field (when present alongside children) is
    informational metadata used by the in-app help panel; mkdocs only
    consumes the child paths.
    """
    lines: list[str] = []
    for item in meta["navigation"]:
        title_de = item["title"]["de"]
        children = item.get("children")
        if children:
            lines.append(f"- {title_de}:")
            for child in children:
                child_title = child["title"]["de"]
                child_path = f"de/{child['slug']}.md"
                lines.append(f"  - {child_title}: {child_path}")
        else:
            path = f"de/{item['slug']}.md"
            lines.append(f"- {title_de}: {path}")
    return lines


def _generate_translation_lines(
    meta: dict, lang_code: str, indent: str
) -> list[str]:
    """Render the nav_translations: map for one target locale.

    Walks every nav item (top-level + recursive children), collects
    DE -> ``lang_code`` pairs, deduplicates by DE label, and emits
    only entries where the two labels differ. Identity mappings are
    dropped because mkdocs-static-i18n leaves untranslated keys as the
    source (DE) label.

    ``indent`` controls the leading whitespace of each emitted line —
    matches the YAML depth of the per-locale ``nav_translations:``
    entries (12 spaces).
    """
    seen: dict[str, str] = {}

    def walk(items: list[dict]) -> None:
        for item in items:
            de = item["title"]["de"]
            target = item["title"].get(lang_code, de)
            if de != target and de not in seen:
                seen[de] = target
            walk(item.get("children") or [])

    walk(meta["navigation"])
    return [f"{indent}{de}: {target}" for de, target in seen.items()]


def _generate_languages_block(meta: dict, indent: str = "        ") -> list[str]:
    """Render the full i18n ``languages:`` list from _meta.yaml.

    One ``- locale:`` block per language. The default locale gets
    ``default: true`` and no nav_translations (its labels are the
    source); every other locale gets a ``nav_translations:`` map (when
    it has any non-identity entries). ``indent`` is the column of the
    ``- locale`` items (8 spaces under ``languages:``).
    """
    prop = indent + "  "  # locale properties (10 spaces)
    entry = indent + "    "  # nav_translations entries (12 spaces)
    lines: list[str] = []
    for lang in meta["languages"]:
        code = lang["code"]
        lines.append(f"{indent}- locale: {code}")
        lines.append(f"{prop}name: {lang['name']}")
        if lang.get("default"):
            lines.append(f"{prop}default: true")
        lines.append(f"{prop}build: true")
        if not lang.get("default"):
            pairs = _generate_translation_lines(meta, code, entry)
            if pairs:
                lines.append(f"{prop}nav_translations:")
                lines.extend(pairs)
    return lines


def _replace_block(
    text: str, start: str, end: str, new_body: str, indent: str
) -> str:
    """Replace the content between two marker comments.

    ``start`` and ``end`` are matched as full lines (with leading
    indentation ``indent``). The replacement preserves the marker
    lines themselves and substitutes only the content in between.
    Raises ``ValueError`` if either marker is missing or out of order.
    """
    lines = text.splitlines(keepends=True)
    start_line = f"{indent}{start}"
    end_line = f"{indent}{end}"
    start_idx = end_idx = None
    for i, line in enumerate(lines):
        stripped = line.rstrip("\n")
        if stripped == start_line:
            start_idx = i
        elif stripped == end_line:
            end_idx = i
            break
    if start_idx is None:
        raise ValueError(f"marker not found: {start_line!r}")
    if end_idx is None:
        raise ValueError(f"marker not found after start: {end_line!r}")
    if start_idx >= end_idx:
        raise ValueError(f"end marker before start: {start_line!r}")

    before = "".join(lines[: start_idx + 1])
    after = "".join(lines[end_idx:])
    body_with_newline = new_body.rstrip("\n") + "\n" if new_body else ""
    return before + body_with_newline + after


def _build_new_mkdocs_yml() -> str:
    meta = _load_meta()
    current = MKDOCS_PATH.read_text(encoding="utf-8")

    nav_body = "\n".join(_generate_nav_lines(meta))
    lang_body = "\n".join(_generate_languages_block(meta))

    # The nav: block is at column 0 (top-level YAML key, items start
    # with "- "). The languages: list lives inside the i18n plugin;
    # its locale items are at 8 spaces.
    new_text = _replace_block(current, NAV_START, NAV_END, nav_body, indent="")
    new_text = _replace_block(
        new_text, LANG_START, LANG_END, lang_body, indent="        "
    )
    return new_text


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Dry-run: exit non-zero if mkdocs.yml drifts from _meta.yaml.",
    )
    args = parser.parse_args()

    if not META_PATH.exists():
        print(f"ERROR: {META_PATH} not found", file=sys.stderr)
        return 1
    if not MKDOCS_PATH.exists():
        print(f"ERROR: {MKDOCS_PATH} not found", file=sys.stderr)
        return 1

    new_text = _build_new_mkdocs_yml()
    current = MKDOCS_PATH.read_text(encoding="utf-8")

    if new_text == current:
        if not args.check:
            print(
                f"OK: {MKDOCS_PATH.relative_to(REPO_ROOT)} already in sync "
                f"with {META_PATH.relative_to(REPO_ROOT)}."
            )
        return 0

    if args.check:
        print(
            f"DRIFT: {MKDOCS_PATH.relative_to(REPO_ROOT)} is out of sync "
            f"with {META_PATH.relative_to(REPO_ROOT)}. "
            f"Run `make sync-mkdocs-nav`.",
            file=sys.stderr,
        )
        import difflib

        diff = difflib.unified_diff(
            current.splitlines(keepends=True),
            new_text.splitlines(keepends=True),
            fromfile=str(MKDOCS_PATH.relative_to(REPO_ROOT)) + " (current)",
            tofile=str(MKDOCS_PATH.relative_to(REPO_ROOT)) + " (would-be)",
            n=3,
        )
        sys.stderr.write("".join(diff))
        return 1

    MKDOCS_PATH.write_text(new_text, encoding="utf-8")
    print(
        f"WROTE: {MKDOCS_PATH.relative_to(REPO_ROOT)} regenerated "
        f"from {META_PATH.relative_to(REPO_ROOT)}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
