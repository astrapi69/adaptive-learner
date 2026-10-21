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
  none, so the bundle never loads the polyfill.

Stdlib only, like verify_docs: mkdocs.yml is read line by line (its
``!!python/name`` tags stop PyYAML's safe loader anyway). A missing
mkdocs.yml or theme block is a FAIL (#2287).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Protocol

CHECK = "docs-third-party"
OVERRIDES = "docs/help-overrides"
SOURCE_PARTIAL = "partials/source.html"
MAIN = "main.html"

_THEME_KEY = re.compile(r"theme:\s*(?:#.*)?")
_SETTING = re.compile(r"([A-Za-z_][\w-]*):\s*(.*?)\s*(?:#.*)?")
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


def theme_settings(mkdocs_text: str) -> dict[str, str] | None:
    """The keys directly under the top-level ``theme:`` mapping of mkdocs.yml.

    Values are kept as written, comments removed, so a quoted ``"false"``
    stays distinguishable from the boolean. A key whose value is a nested
    mapping or list (``palette``, ``features``) maps to ``""``.

    Returns:
        The settings, or None when mkdocs.yml has no block-style ``theme:``
        mapping.
    """
    lines = mkdocs_text.splitlines()
    start = next((i for i, line in enumerate(lines) if _THEME_KEY.fullmatch(line)), None)
    if start is None:
        return None
    settings: dict[str, str] = {}
    indent: int | None = None
    for line in lines[start + 1 :]:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        depth = len(line) - len(line.lstrip(" "))
        if depth == 0:
            break
        indent = depth if indent is None else indent
        match = _SETTING.fullmatch(stripped) if depth == indent else None
        if match:
            settings[match.group(1)] = match.group(2)
    return settings


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
    theme = theme_settings(mkdocs.read_text(encoding="utf-8"))
    if theme is None:
        report.fail(
            CHECK,
            "mkdocs.yml has no block-style theme: mapping - cannot verify theme.font and "
            "theme.custom_dir (#2287)",
        )
        return
    _check_font(report, theme.get("font"))
    _check_custom_dir(report, theme.get("custom_dir"))
    overrides = repo / OVERRIDES
    read = [
        name
        for name, was_read in (
            (SOURCE_PARTIAL, _check_source_partial(report, overrides / SOURCE_PARTIAL)),
            (MAIN, _check_main(report, overrides / MAIN)),
        )
        if was_read
    ]
    report.note(
        f"{CHECK}: mkdocs.yml theme.font={theme.get('font')}, "
        f"theme.custom_dir={theme.get('custom_dir')}; "
        f"read {len(read)} of 2 overrides ({', '.join(read) or 'none'})"
    )
