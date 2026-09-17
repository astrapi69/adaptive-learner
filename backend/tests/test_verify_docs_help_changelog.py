"""Tests for the help-changelog currency gate in scripts/verify_docs.py (#3161).

The per-locale "What's new" page (docs/help/<locale>/changelog.md) stopped
at v1.91 while the app shipped 29 more releases up to v2.15.0, and no gate
noticed: the prose-version check exempts changelog.md by design, and the
version check only covers badges and dated headers. This gate FAILs when a
locale's newest ``## vX.Y.Z`` heading is older than the canonical minor
version (a missing patch release is fine).
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs import CHECKS, FAIL, Report, check_help_changelog  # noqa: E402


def _write_changelog(help_dir: Path, locale: str, body: str) -> None:
    locale_dir = help_dir / locale
    locale_dir.mkdir(parents=True, exist_ok=True)
    (locale_dir / "changelog.md").write_text(body, encoding="utf-8")


def _failures(report: Report) -> list[str]:
    return [f.message for f in report.findings if f.severity == FAIL]


class TestHelpChangelogCurrency:
    def test_page_behind_the_canonical_minor_fails(self, tmp_path: Path) -> None:
        _write_changelog(
            tmp_path, "en", "# What's new\n\n## v1.91.0 - Navigation\n\n## v1.90.0 - AI\n"
        )
        report = Report()
        check_help_changelog(report, help_dir=tmp_path, canonical="2.15.0")
        failures = _failures(report)
        assert len(failures) == 1
        assert "en/changelog.md" in failures[0]
        assert "v1.91.0" in failures[0]
        assert "v2.15" in failures[0]

    def test_page_at_the_canonical_version_passes(self, tmp_path: Path) -> None:
        _write_changelog(
            tmp_path, "de", "# Was ist neu\n\n## v2.15.0 - Übungen\n\n## v2.14.0 - Spielmodus\n"
        )
        report = Report()
        check_help_changelog(report, help_dir=tmp_path, canonical="2.15.0")
        assert _failures(report) == []

    def test_a_missing_patch_release_is_not_drift(self, tmp_path: Path) -> None:
        _write_changelog(tmp_path, "en", "# What's new\n\n## v2.15.0 - Exercises\n")
        report = Report()
        check_help_changelog(report, help_dir=tmp_path, canonical="2.15.1")
        assert _failures(report) == []

    def test_range_headings_count_with_their_highest_version(self, tmp_path: Path) -> None:
        _write_changelog(tmp_path, "en", "# What's new\n\n## v2.12.0–v2.15.0 - Recent releases\n")
        report = Report()
        check_help_changelog(report, help_dir=tmp_path, canonical="2.15.0")
        assert _failures(report) == []

    def test_newest_heading_is_found_regardless_of_order(self, tmp_path: Path) -> None:
        _write_changelog(tmp_path, "fr", "# Nouveautés\n\n## v1.61.0 - Old\n\n## v2.15.0 - New\n")
        report = Report()
        check_help_changelog(report, help_dir=tmp_path, canonical="2.15.0")
        assert _failures(report) == []

    def test_each_locale_is_judged_on_its_own(self, tmp_path: Path) -> None:
        _write_changelog(tmp_path, "de", "# Was ist neu\n\n## v2.15.0 - Neu\n")
        _write_changelog(tmp_path, "ja", "# 新機能\n\n## v2.13.0 - 古い\n")
        report = Report()
        check_help_changelog(report, help_dir=tmp_path, canonical="2.15.0")
        failures = _failures(report)
        assert len(failures) == 1
        assert "ja/changelog.md" in failures[0]

    def test_a_page_without_version_headings_fails_closed(self, tmp_path: Path) -> None:
        _write_changelog(tmp_path, "en", "# What's new\n\nSee GitHub Releases.\n")
        report = Report()
        check_help_changelog(report, help_dir=tmp_path, canonical="2.15.0")
        failures = _failures(report)
        assert len(failures) == 1
        assert "no" in failures[0] and "heading" in failures[0]

    def test_no_changelog_pages_at_all_fails_closed(self, tmp_path: Path) -> None:
        (tmp_path / "en").mkdir()
        report = Report()
        check_help_changelog(report, help_dir=tmp_path, canonical="2.15.0")
        assert len(_failures(report)) == 1

    def test_the_check_is_registered(self) -> None:
        assert "help-changelog" in CHECKS
