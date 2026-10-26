"""Docs site third-party pins for scripts/verify_docs.py (#3802).

Every page of the docs site contacted third parties on load. Material for
MkDocs links its default font from Google Fonts (a stylesheet from
fonts.googleapis.com, a preconnect to fonts.gstatic.com) unless
``theme.font`` is false, and the repository widget ``repo_url`` turns on
fetches the latest release, stars and forks from api.github.com. In a
browser without ``ResizeObserver`` (Safari before 13.1, Chrome before 64,
Firefox before 69) Material's bundle also loads a polyfill from unpkg.com.

The scan of the built site (``scripts/check_external_hosts.py``) sees the
font links and the widget markup. It cannot see the polyfill loader, which
is JavaScript inside Material's bundle. This check pins, without a build,
the configuration that keeps all three quiet:

- ``theme.font`` is false, so the pages use the system font stack;
- ``theme.custom_dir`` is ``docs/help-overrides``;
- ``partials/source.html`` there renders the repository link without
  ``data-md-component="source"``, so the widget script never mounts and
  never calls the API, while the link stays;
- ``main.html`` there extends ``base.html`` and defines, in the ``libs``
  block that runs before the bundle, a stand-in ``ResizeObserver`` with
  ``observe``, ``unobserve`` and ``disconnect`` for browsers that have
  none, so the bundle never loads the polyfill;
- ``theme.features`` does not hold ``search.highlight`` (#3843). With it,
  Material adds the search terms to every search result link as
  ``?h=<terms>``, so a click sends them to GitHub Pages in the request URL,
  while the privacy policy says the search runs in the browser without the
  search terms leaving it. Not a third party, the site's own host, but the
  same promise. ``search.share`` may stay: it copies a link with the query
  only when the reader clicks the share button.

Stdlib only, like verify_docs: mkdocs.yml is read line by line (its
``!!python/name`` tags stop PyYAML's safe loader anyway). A missing
mkdocs.yml or theme block is a FAIL (#2287), and so is a ``theme.features``
value this reader cannot read.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Protocol

CHECK = "docs-third-party"
OVERRIDES = "docs/help-overrides"
SOURCE_PARTIAL = "partials/source.html"
MAIN = "main.html"
HIGHLIGHT = "search.highlight"
# The sentence of docs/help/en/legal/privacy.md (and its seven translations)
# that search.highlight makes false.
POLICY_SENTENCE = "the search runs in your browser without your search terms leaving it"

_THEME_KEY = re.compile(r"theme:\s*(?:#.*)?")
_SETTING = re.compile(r"([A-Za-z_][\w-]*):\s*(.*?)\s*(?:#.*)?")
_LIST_ITEM = re.compile(r"-\s+(.*?)\s*(?:#.*)?")
_FLOW_LIST = re.compile(r"\[(.*)\]")
# PyYAML, which MkDocs uses, reads YAML 1.1: each of these is False, and no
# other spelling is. Its resolver lists them case by case, so a mixed-case
# "fAlSe" stays a string, and with a string Material loads Google Fonts.
_YAML_FALSE = re.compile(r"false|False|FALSE|no|No|NO|off|Off|OFF")
_WIDGET = re.compile(r"""data-md-component\s*=\s*["']?source\b""")
_REPO_LINK = re.compile(r"""href=["']\{\{\s*config\.repo_url\s*\}\}["']""")
_EXTENDS_BASE = re.compile(r"""\{%-?\s*extends\s+["']base\.html["']\s*-?%\}""")
_LIBS_BLOCK = re.compile(r"\{%-?\s*block\s+libs\s*-?%\}(.*?)\{%-?\s*endblock", re.DOTALL)
_GUARD = re.compile(r"""typeof\s+(?:window\.)?ResizeObserver\s*===?\s*["']undefined["']""")
_ASSIGNMENT = re.compile(r"window\.ResizeObserver\s*=[^=]")
_METHODS = ("observe", "unobserve", "disconnect")
# Jinja, HTML and /* */ comments: an override may name what it leaves out.
_COMMENTS = re.compile(r"\{#.*?#\}|<!--.*?-->|/\*.*?\*/", re.DOTALL)


class _Report(Protocol):
    def fail(self, check: str, message: str, fixed: bool = False) -> None: ...

    def note(self, message: str) -> None: ...


def _depth(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _theme_block(mkdocs_text: str) -> list[str] | None:
    """The lines of the top-level ``theme:`` mapping, blank and comment lines
    left out, or None when mkdocs.yml has no block-style ``theme:``."""
    lines = mkdocs_text.splitlines()
    start = next((i for i, line in enumerate(lines) if _THEME_KEY.fullmatch(line)), None)
    if start is None:
        return None
    block: list[str] = []
    for line in lines[start + 1 :]:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if _depth(line) == 0:
            break
        block.append(line)
    return block


def _direct_settings(block: list[str]) -> list[tuple[int, str, str]]:
    """Index, key and value of each setting directly under ``theme:``."""
    indent = _depth(block[0]) if block else 0
    settings = []
    for index, line in enumerate(block):
        match = _SETTING.fullmatch(line.strip()) if _depth(line) == indent else None
        if match:
            settings.append((index, match.group(1), match.group(2)))
    return settings


def theme_settings(mkdocs_text: str) -> dict[str, str] | None:
    """The keys directly under the top-level ``theme:`` mapping of mkdocs.yml.

    Values are kept as written, comments removed, so a quoted ``"false"``
    stays distinguishable from the boolean. A key whose value is a nested
    mapping or list (``palette``, ``features``) maps to ``""``.

    Returns:
        The settings, or None when mkdocs.yml has no block-style ``theme:``
        mapping.
    """
    block = _theme_block(mkdocs_text)
    if block is None:
        return None
    return {key: value for _, key, value in _direct_settings(block)}


def _unquote(value: str) -> str:
    return value.strip().strip("'\"")


def _list_items(block: list[str], key_index: int) -> list[str] | None:
    """The scalar items of the block list under ``block[key_index]``, also
    when they sit at the key's own indentation; None for an item that is not
    a ``- scalar`` on one line."""
    key_depth = _depth(block[key_index])
    items = []
    for line in block[key_index + 1 :]:
        stripped = line.strip()
        depth = _depth(line)
        if depth < key_depth or (depth == key_depth and not stripped.startswith("-")):
            break
        item = _LIST_ITEM.fullmatch(stripped)
        if item is None:
            return None
        items.append(_unquote(item.group(1)))
    return items


def theme_features(mkdocs_text: str) -> list[str] | None:
    """The entries of ``theme.features`` in mkdocs.yml.

    Reads a block list (indented or not) and a flow list on one line, items
    unquoted and comments removed.

    Returns:
        The entries, an empty list when mkdocs.yml has no ``theme:`` block or
        no ``features`` in it, or None when the value takes another form (a
        flow list over several lines, a scalar, an item on its own line),
        which this reader cannot verify.
    """
    block = _theme_block(mkdocs_text) or []
    found = next(
        ((index, value) for index, key, value in _direct_settings(block) if key == "features"),
        None,
    )
    if found is None:
        return []
    index, value = found
    if not value:
        return _list_items(block, index)
    flow = _FLOW_LIST.fullmatch(value)
    if flow is None:
        return None
    return [_unquote(part) for part in flow.group(1).split(",") if part.strip()]


def _check_font(report: _Report, value: str | None) -> None:
    if value is not None and _YAML_FALSE.fullmatch(value):
        return
    shown = "unset" if value is None else (value or "a mapping")
    report.fail(
        CHECK,
        f"mkdocs.yml theme.font is {shown}, must be false: otherwise Material links Roboto "
        "from fonts.googleapis.com and preconnects to fonts.gstatic.com on every page (#3802)",
    )


def _check_custom_dir(report: _Report, value: str | None) -> None:
    if value is not None and value.strip("'\"").rstrip("/") == OVERRIDES:
        return
    report.fail(
        CHECK,
        f"mkdocs.yml theme.custom_dir is {value or 'unset'}, must be {OVERRIDES}: the overrides "
        "there keep the repository widget and the ResizeObserver polyfill from contacting "
        "api.github.com and unpkg.com (#3802)",
    )


def _check_features(report: _Report, features: list[str] | None) -> None:
    if features is None:
        report.fail(
            CHECK,
            "mkdocs.yml theme.features is neither a block list nor a flow list on one line - "
            f"cannot verify that {HIGHLIGHT} is off (#3843)",
        )
        return
    if HIGHLIGHT in features:
        report.fail(
            CHECK,
            f"mkdocs.yml theme.features holds {HIGHLIGHT}: Material then adds the search terms "
            "to every search result link as ?h=, and a click sends them to GitHub Pages in the "
            f'request URL, while the privacy policy says "{POLICY_SENTENCE}" '
            "(docs/help/<lang>/legal/privacy.md, #3843)",
        )


def _code(path: Path) -> str:
    """The template without its comments."""
    return _COMMENTS.sub("", path.read_text(encoding="utf-8"))


def _check_source_partial(report: _Report, path: Path) -> bool:
    name = f"{OVERRIDES}/{SOURCE_PARTIAL}"
    if not path.is_file():
        report.fail(
            CHECK,
            f"{name} is missing: Material's own partial mounts the repository widget, whose "
            "script fetches the latest release, stars and forks from api.github.com (#3802)",
        )
        return False
    text = _code(path)
    if _WIDGET.search(text):
        report.fail(
            CHECK,
            f'{name} carries data-md-component="source": that mounts Material\'s repository '
            "widget, whose script calls api.github.com on page load (#3802)",
        )
    if not _REPO_LINK.search(text):
        report.fail(
            CHECK,
            f"{name} no longer links config.repo_url: the override exists to keep the "
            "repository link while dropping the widget (#3802)",
        )
    return True


def _stand_in_gaps(libs_block: str) -> list[str]:
    gaps = []
    if not _GUARD.search(libs_block):
        gaps.append('the typeof ResizeObserver === "undefined" guard')
    if not _ASSIGNMENT.search(libs_block):
        gaps.append("the window.ResizeObserver assignment")
    gaps += [
        f"prototype.{method}"
        for method in _METHODS
        if not re.search(rf"\.prototype\.{method}\s*=\s*function", libs_block)
    ]
    return gaps


def _check_main(report: _Report, path: Path) -> bool:
    name = f"{OVERRIDES}/{MAIN}"
    if not path.is_file():
        report.fail(
            CHECK,
            f"{name} is missing: without its ResizeObserver stand-in, Material's bundle loads "
            "https://unpkg.com/resize-observer-polyfill in browsers without ResizeObserver (#3802)",
        )
        return False
    text = _code(path)
    if not _EXTENDS_BASE.search(text):
        report.fail(
            CHECK, f"{name} does not extend base.html, so it would replace every page (#3802)"
        )
    libs = _LIBS_BLOCK.search(text)
    if libs is None:
        report.fail(
            CHECK,
            f"{name} has no libs block: the ResizeObserver stand-in must run there, in the head, "
            "before Material's bundle decides to load the unpkg.com polyfill (#3802)",
        )
        return True
    gaps = _stand_in_gaps(libs.group(1))
    if gaps:
        report.fail(
            CHECK,
            f"{name}'s libs block lacks {', '.join(gaps)}: without a complete stand-in, "
            "Material's bundle loads https://unpkg.com/resize-observer-polyfill or fails in "
            "browsers without ResizeObserver (#3802)",
        )
    return True


def check_docs_third_party(report: _Report, repo: Path) -> None:
    """Pin the settings and overrides that keep the docs site free of third parties.

    Args:
        report: The verify_docs report collecting FAILs and notes.
        repo: The repository root holding mkdocs.yml and ``docs/help-overrides``.
    """
    mkdocs = repo / "mkdocs.yml"
    if not mkdocs.is_file():
        report.fail(CHECK, f"{mkdocs} not found - cannot verify the docs theme settings (#2287)")
        return
    mkdocs_text = mkdocs.read_text(encoding="utf-8")
    theme = theme_settings(mkdocs_text)
    if theme is None:
        report.fail(
            CHECK,
            "mkdocs.yml has no block-style theme: mapping - cannot verify theme.font, "
            "theme.custom_dir and theme.features (#2287)",
        )
        return
    features = theme_features(mkdocs_text)
    _check_font(report, theme.get("font"))
    _check_custom_dir(report, theme.get("custom_dir"))
    _check_features(report, features)
    overrides = repo / OVERRIDES
    read = [
        name
        for name, was_read in (
            (SOURCE_PARTIAL, _check_source_partial(report, overrides / SOURCE_PARTIAL)),
            (MAIN, _check_main(report, overrides / MAIN)),
        )
        if was_read
    ]
    shown_features = "unreadable" if features is None else f"count={len(features)}"
    report.note(
        f"{CHECK}: mkdocs.yml theme.font={theme.get('font')}, "
        f"theme.custom_dir={theme.get('custom_dir')}, theme.features {shown_features}; "
        f"read {len(read)} of 2 overrides ({', '.join(read) or 'none'})"
    )
