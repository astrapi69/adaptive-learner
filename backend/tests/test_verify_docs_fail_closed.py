"""#2287 - verify_docs.py fails CLOSED on a missing basis.

`make verify-docs-discipline` is a MANDATORY release gate. It used to fail
OPEN in ten places: a missing directory, an empty glob, an unparseable
catalog or a crashed helper was reported as a WARN, after which the summary
stayed green. "I could not check" printed as "nothing is wrong"
(quality-checks.md "Gate test contract", point 3).

Each test below removes ONE check's basis and asserts the check now FAILs
(RED), and that on a valid minimal tree it passes AND reports the size of the
set it examined (point 4: "0 findings" and "0 inputs" must not print the same
green). The gate staying green on the real repo is pinned by the existing
per-check tests + the shipped-clean assertions here.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs import (  # noqa: E402
    FAIL,
    Report,
    check_help_coverage,
    check_help_index_versions,
    check_help_prose_versions,
    check_i18n,
    check_mkdocs,
    check_themes,
)


def _fails(report: Report) -> list[str]:
    return [f.message for f in report.findings if f.severity == FAIL]


def _write(path: Path, body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


class TestThemesFailClosed:
    def test_no_theme_files_fails(self, tmp_path: Path) -> None:
        report = Report()
        check_themes(report, theme_dir=tmp_path)  # empty dir = no basis
        assert report.fail_count == 1
        assert "no theme-*.css" in _fails(report)[0]

    def test_valid_themes_pass_and_report_the_set(self, tmp_path: Path) -> None:
        (tmp_path / "theme-a.css").write_text(":root{--x:1;--y:2;}", encoding="utf-8")
        (tmp_path / "theme-b.css").write_text(":root{--x:1;--y:2;}", encoding="utf-8")
        report = Report()
        check_themes(report, theme_dir=tmp_path)
        assert report.fail_count == 0
        assert any("2 theme files" in n for n in report.notes)


class TestHelpIndexFailClosed:
    def test_no_index_pages_fails(self, tmp_path: Path) -> None:
        report = Report()
        check_help_index_versions(report, help_dir=tmp_path)
        assert report.fail_count == 1
        assert "no index pages" in _fails(report)[0]

    def test_valid_index_passes_and_reports_the_set(self, tmp_path: Path) -> None:
        _write(tmp_path / "en" / "index.md", "See the GitHub Releases page.\n")
        report = Report()
        check_help_index_versions(report, help_dir=tmp_path)
        assert report.fail_count == 0
        assert any("scanned 1 index pages" in n for n in report.notes)


class TestHelpProseFailClosed:
    def test_no_help_pages_fails(self, tmp_path: Path) -> None:
        report = Report()
        check_help_prose_versions(report, help_dir=tmp_path)
        assert report.fail_count == 1
        assert "no help pages" in _fails(report)[0]

    def test_valid_prose_passes_and_reports_the_set(self, tmp_path: Path) -> None:
        _write(tmp_path / "en" / "guide.md", "The editor is TipTap.\n")
        report = Report()
        check_help_prose_versions(report, help_dir=tmp_path)
        assert report.fail_count == 0
        assert any("scanned 1 prose pages" in n for n in report.notes)


class TestMkdocsFailClosed:
    def test_missing_mkdocs_yml_fails(self, tmp_path: Path) -> None:
        report = Report()
        check_mkdocs(report, mkdocs_path=tmp_path / "nope.yml", help_dir=tmp_path / "help")
        assert report.fail_count == 1
        assert "not found" in _fails(report)[0]

    def test_missing_de_tree_fails(self, tmp_path: Path) -> None:
        mkdocs = tmp_path / "mkdocs.yml"
        mkdocs.write_text("nav: []\n", encoding="utf-8")
        report = Report()
        check_mkdocs(report, mkdocs_path=mkdocs, help_dir=tmp_path / "help")  # no de/
        assert report.fail_count == 1
        assert "de not found" in _fails(report)[0] or "/de " in _fails(report)[0]

    def test_valid_nav_passes_and_reports_the_set(self, tmp_path: Path) -> None:
        help_dir = tmp_path / "help"
        _write(help_dir / "de" / "guide.md", "Hallo\n")
        (tmp_path / "mkdocs.yml").write_text("nav:\n  - de/guide.md\n", encoding="utf-8")
        report = Report()
        check_mkdocs(report, mkdocs_path=tmp_path / "mkdocs.yml", help_dir=help_dir)
        assert report.fail_count == 0
        assert any("nav references" in n for n in report.notes)


class TestHelpCoverageFailClosed:
    def test_no_help_pages_fails(self, tmp_path: Path) -> None:
        report = Report()
        check_help_coverage(report, help_root=tmp_path)  # no en/ or de/
        assert report.fail_count == 1
        assert "no help pages" in _fails(report)[0]

    def test_missing_app_tsx_fails(self, tmp_path: Path) -> None:
        _write(tmp_path / "en" / "guide.md", "x\n")
        _write(tmp_path / "de" / "guide.md", "x\n")
        report = Report()
        check_help_coverage(report, help_root=tmp_path, app_path=tmp_path / "nope.tsx")
        assert report.fail_count == 1
        assert "not found" in _fails(report)[0]

    def test_valid_tree_passes_and_reports_the_set(self, tmp_path: Path) -> None:
        _write(tmp_path / "en" / "guide.md", "x\n")
        _write(tmp_path / "de" / "guide.md", "x\n")
        app = tmp_path / "App.tsx"
        app.write_text('<Route path="/" />\n', encoding="utf-8")
        report = Report()
        check_help_coverage(report, help_root=tmp_path, app_path=app)
        assert report.fail_count == 0
        assert any("help pages" in n for n in report.notes)


class TestI18nFailClosed:
    def test_missing_en_json_fails(self, tmp_path: Path) -> None:
        report = Report()
        check_i18n(report, fix=False, i18n_dir=tmp_path)
        assert report.fail_count == 1
        assert "not found" in _fails(report)[0]

    def test_empty_en_json_fails(self, tmp_path: Path) -> None:
        (tmp_path / "en.json").write_text("{}", encoding="utf-8")
        report = Report()
        check_i18n(report, fix=False, i18n_dir=tmp_path)
        assert report.fail_count == 1
        assert "no keys" in _fails(report)[0]

    def test_unparseable_catalog_fails(self, tmp_path: Path) -> None:
        (tmp_path / "en.json").write_text('{"a": {"b": "1"}}', encoding="utf-8")
        (tmp_path / "de.json").write_text("{ not json", encoding="utf-8")
        report = Report()
        check_i18n(report, fix=False, i18n_dir=tmp_path)
        assert any("could not parse" in m for m in _fails(report))

    def test_valid_catalogs_pass_and_report_the_set(self, tmp_path: Path) -> None:
        (tmp_path / "en.json").write_text('{"a": {"b": "1"}}', encoding="utf-8")
        (tmp_path / "de.json").write_text('{"a": {"b": "1"}}', encoding="utf-8")
        report = Report()
        check_i18n(report, fix=False, i18n_dir=tmp_path)
        assert report.fail_count == 0
        assert any("compared 1 catalog" in n for n in report.notes)


class TestShippedRepoStaysGreen:
    """The fail-closed conversion must NOT false-fire on the real tree."""

    def test_all_converted_checks_pass_on_the_repo(self) -> None:
        report = Report()
        check_themes(report)
        check_help_index_versions(report)
        check_help_prose_versions(report)
        check_mkdocs(report)
        check_help_coverage(report)
        check_i18n(report, fix=False)
        assert report.fail_count == 0, _fails(report)
