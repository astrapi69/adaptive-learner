"""Tests for the docs site's third-party pins in verify_docs (#3802).

Every docs page contacted Google Fonts and api.github.com on load, and in
a browser without ResizeObserver Material's bundle also loaded a polyfill
from unpkg.com. The static scan of the built site sees the font links and
the widget markup; it cannot see the polyfill loader, which is JavaScript
inside the bundle. The ``docs-third-party`` check pins the configuration
that keeps all three quiet: ``theme.font: false``, ``theme.custom_dir``,
and the two overrides with their key lines.

Gate test contract (quality-checks.md): each violation is detected, a
valid tree and the real repository pass, a missing basis fails closed, and
the note says what was read.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import verify_docs  # noqa: E402
from verify_docs_third_party import (  # noqa: E402
    OVERRIDES,
    check_docs_third_party,
    theme_settings,
)

VALID_MKDOCS = """\
site_name: Adaptive Learner
repo_url: https://github.com/astrapi69/adaptive-learner
docs_dir: docs/help
theme:
  name: material
  # system fonts, no Google Fonts
  font: false
  custom_dir: docs/help-overrides
  palette:
    - media: '(prefers-color-scheme: light)'
      scheme: default
  features:
    - navigation.tabs
edit_uri: edit/main/docs/help/
"""

VALID_SOURCE = """\
<a href="{{ config.repo_url }}" title="{{ lang.t('source') }}" class="md-source">
  <div class="md-source__repository">
    {{ config.repo_name }}
  </div>
</a>
"""

VALID_MAIN = """\
{% extends "base.html" %}
{% block libs %}
  {{ super() }}
  <script>
    if (typeof window.ResizeObserver === "undefined") {
      var StandIn = function () {};
      StandIn.prototype.observe = function () {};
      StandIn.prototype.unobserve = function () {};
      StandIn.prototype.disconnect = function () {};
      window.ResizeObserver = StandIn;
    }
  </script>
{% endblock %}
"""


class _Report:
    def __init__(self) -> None:
        self.fails: list[str] = []
        self.notes: list[str] = []

    def fail(self, check: str, message: str, fixed: bool = False) -> None:
        self.fails.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)


def _tree(
    root: Path,
    mkdocs: str | None = VALID_MKDOCS,
    source: str | None = VALID_SOURCE,
    main: str | None = VALID_MAIN,
) -> Path:
    files = {
        "mkdocs.yml": mkdocs,
        f"{OVERRIDES}/partials/source.html": source,
        f"{OVERRIDES}/main.html": main,
    }
    for rel, body in files.items():
        if body is None:
            continue
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")
    return root


def _run(root: Path) -> _Report:
    report = _Report()
    check_docs_third_party(report, root)
    return report


def test_a_valid_tree_passes_and_the_note_says_what_was_read(tmp_path: Path) -> None:
    report = _run(_tree(tmp_path))
    assert report.fails == []
    assert report.notes == [
        "docs-third-party: mkdocs.yml theme.font=false, theme.custom_dir=docs/help-overrides; "
        "read 2 of 2 overrides (partials/source.html, main.html)"
    ]


def test_the_repository_passes() -> None:
    """The shipped configuration: no Google Fonts, no widget fetch, no polyfill."""
    report = _run(REPO)
    assert report.fails == []


def test_the_check_is_registered_in_verify_docs() -> None:
    assert "docs-third-party" in verify_docs.CHECKS


@pytest.mark.parametrize(
    ("theme_change", "expected"),
    [
        (("  font: false\n", ""), "fonts.googleapis.com"),
        (("  font: false\n", "  font: true\n"), "fonts.googleapis.com"),
        (("  font: false\n", '  font: "false"\n'), "fonts.googleapis.com"),
        (("  font: false\n", "  font: fAlSe\n"), "fonts.googleapis.com"),
        (("  font: false\n", "  font: nO\n"), "fonts.googleapis.com"),
        (("  font: false\n", "  font:\n    text: Inter\n"), "fonts.googleapis.com"),
        (("  custom_dir: docs/help-overrides\n", ""), "custom_dir"),
        (("  custom_dir: docs/help-overrides\n", "  custom_dir: overrides\n"), "custom_dir"),
    ],
    ids=[
        "font-unset",
        "font-true",
        "font-quoted-string",
        "font-mixed-case-false-is-a-string",
        "font-mixed-case-no-is-a-string",
        "font-mapping",
        "custom-dir-unset",
        "custom-dir-elsewhere",
    ],
)
def test_a_theme_setting_that_lets_a_third_party_in_fails(
    tmp_path: Path, theme_change: tuple[str, str], expected: str
) -> None:
    old, new = theme_change
    report = _run(_tree(tmp_path, mkdocs=VALID_MKDOCS.replace(old, new)))
    assert len(report.fails) == 1 and expected in report.fails[0]


@pytest.mark.parametrize(
    "spelling",
    ["false", "False", "FALSE", "no", "off", "false  # system fonts"],
    ids=["false", "False", "FALSE", "no", "off", "with-comment"],
)
def test_every_yaml_false_passes(tmp_path: Path, spelling: str) -> None:
    """MkDocs reads mkdocs.yml with PyYAML (YAML 1.1): each of these is False."""
    mkdocs = VALID_MKDOCS.replace("  font: false\n", f"  font: {spelling}\n")
    assert _run(_tree(tmp_path, mkdocs=mkdocs)).fails == []


def test_a_font_setting_outside_the_theme_does_not_count(tmp_path: Path) -> None:
    mkdocs = VALID_MKDOCS.replace("  font: false\n", "") + "extra:\n  font: false\n"
    report = _run(_tree(tmp_path, mkdocs=mkdocs))
    assert len(report.fails) == 1 and "theme.font is unset" in report.fails[0]


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        (None, "api.github.com"),
        (
            VALID_SOURCE.replace(
                'class="md-source"', 'class="md-source" data-md-component="source"'
            ),
            "api.github.com",
        ),
        (
            VALID_SOURCE.replace(
                'class="md-source"', "class='md-source' data-md-component='source'"
            ),
            "api.github.com",
        ),
        (VALID_SOURCE.replace('href="{{ config.repo_url }}" ', ""), "repo_url"),
    ],
    ids=["missing", "widget-component", "widget-component-single-quotes", "link-dropped"],
)
def test_a_source_override_that_mounts_the_widget_or_drops_the_link_fails(
    tmp_path: Path, source: str | None, expected: str
) -> None:
    report = _run(_tree(tmp_path, source=source))
    assert len(report.fails) == 1 and expected in report.fails[0]


@pytest.mark.parametrize(
    ("main", "expected"),
    [
        (None, "unpkg.com"),
        (VALID_MAIN.replace('{% extends "base.html" %}\n', ""), "base.html"),
        (
            VALID_MAIN.replace("{% block libs %}", "{% block scripts %}"),
            "libs",
        ),
        (
            VALID_MAIN.replace("      StandIn.prototype.disconnect = function () {};\n", ""),
            "disconnect",
        ),
        (VALID_MAIN.replace('typeof window.ResizeObserver === "undefined"', "true"), "typeof"),
        (VALID_MAIN.replace("window.ResizeObserver = StandIn;", ""), "assignment"),
    ],
    ids=[
        "missing",
        "not-extending-base",
        "stand-in-after-the-bundle",
        "stand-in-without-disconnect",
        "stand-in-without-guard",
        "stand-in-never-assigned",
    ],
)
def test_a_main_override_without_a_complete_stand_in_fails(
    tmp_path: Path, main: str | None, expected: str
) -> None:
    report = _run(_tree(tmp_path, main=main))
    assert len(report.fails) == 1 and expected in report.fails[0]


def test_comments_in_the_overrides_are_not_code(tmp_path: Path) -> None:
    """An override may explain itself: a Jinja or HTML comment naming the
    widget attribute is not the attribute. And a stand-in that exists only
    in a comment is no stand-in."""
    source = '{# without data-md-component="source" #}\n<!-- data-md-component="source" -->\n'
    assert _run(_tree(tmp_path / "ok", source=source + VALID_SOURCE)).fails == []
    commented_out = VALID_MAIN.replace(
        "      window.ResizeObserver = StandIn;\n",
        "      /* window.ResizeObserver = StandIn; */\n",
    )
    report = _run(_tree(tmp_path / "commented", main=commented_out))
    assert len(report.fails) == 1 and "assignment" in report.fails[0]


def test_a_missing_mkdocs_yml_fails_closed(tmp_path: Path) -> None:
    report = _run(_tree(tmp_path, mkdocs=None))
    assert len(report.fails) == 1 and "mkdocs.yml" in report.fails[0]


def test_an_mkdocs_yml_without_a_theme_block_fails_closed(tmp_path: Path) -> None:
    report = _run(_tree(tmp_path, mkdocs="site_name: Adaptive Learner\ntheme: material\n"))
    assert len(report.fails) == 1 and "theme" in report.fails[0]


def test_theme_settings_reads_only_the_direct_scalar_children() -> None:
    assert theme_settings(VALID_MKDOCS) == {
        "name": "material",
        "font": "false",
        "custom_dir": "docs/help-overrides",
        "palette": "",
        "features": "",
    }
    assert theme_settings("site_name: x\n") is None
