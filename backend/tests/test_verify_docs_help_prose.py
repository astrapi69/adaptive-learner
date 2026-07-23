"""Tests for the help-prose version gate in scripts/verify_docs.py (#1767).

End-user help under ``docs/help/**`` had drifted into ~1000
``since vX.Y`` feature-provenance markers across 8 locales. The policy
fix makes user help versionless (present-tense description of the
CURRENT behaviour); this check FAILs on ANY ``vX.Y[.Z]`` literal in the
user-facing help prose, while deliberately skipping the developer/ + api/
reference trees, the per-locale changelog.md, index.md (its own #1766
gate), and lines carrying a ``<!-- version-exempt: reason -->`` marker.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs import FAIL, Report, check_help_prose_versions  # noqa: E402


def _write(help_dir: Path, rel: str, body: str) -> None:
    page = help_dir / rel
    page.parent.mkdir(parents=True, exist_ok=True)
    page.write_text(body, encoding="utf-8")


class TestHelpProseVersions:
    def test_provenance_marker_in_user_guide_fails(self, tmp_path: Path) -> None:
        _write(tmp_path, "en/user-guide/settings.md", "The picker (since v1.11.0) is searchable.\n")
        report = Report()
        check_help_prose_versions(report, help_dir=tmp_path)
        failures = [f for f in report.findings if f.severity == FAIL]
        assert len(failures) == 1
        assert "en/user-guide/settings.md" in failures[0].message
        assert "v1.11.0" in failures[0].message

    def test_present_tense_prose_passes(self, tmp_path: Path) -> None:
        _write(tmp_path, "de/concept/tools.md", "Drei Werkzeuge sind eingebaut.\n")
        report = Report()
        check_help_prose_versions(report, help_dir=tmp_path)
        assert report.fail_count == 0

    def test_developer_and_api_trees_are_skipped(self, tmp_path: Path) -> None:
        _write(tmp_path, "en/developer/architecture.md", "## Dual storage (v0.7.0)\n")
        _write(tmp_path, "en/api/hooks.md", "ai_complete_async (v1.5.0+).\n")
        report = Report()
        check_help_prose_versions(report, help_dir=tmp_path)
        assert report.fail_count == 0

    def test_changelog_and_index_are_skipped(self, tmp_path: Path) -> None:
        _write(tmp_path, "en/changelog.md", "## v1.91.0 - Navigation\n")
        _write(tmp_path, "en/index.md", "Adaptive Learner v2.5.0.\n")
        report = Report()
        check_help_prose_versions(report, help_dir=tmp_path)
        assert report.fail_count == 0

    def test_version_exempt_marker_is_honoured(self, tmp_path: Path) -> None:
        _write(
            tmp_path,
            "en/content-creation/content-repos.md",
            "Lessons in schema v1.4. <!-- version-exempt: format contract -->\n",
        )
        report = Report()
        check_help_prose_versions(report, help_dir=tmp_path)
        assert report.fail_count == 0

    def test_every_locale_and_nested_page_is_scanned(self, tmp_path: Path) -> None:
        _write(tmp_path, "tr/user-guide/lessons.md", "v1.35.0'dan beri karma strateji.\n")
        _write(tmp_path, "el/concept/tracking.md", "Gamification (v1.16.0).\n")
        report = Report()
        check_help_prose_versions(report, help_dir=tmp_path)
        assert report.fail_count == 2

    def test_shipped_help_prose_is_clean(self) -> None:
        """The hard gate holds on the real repo (post-#1767 state)."""
        report = Report()
        check_help_prose_versions(report)
        assert report.fail_count == 0, [f.message for f in report.findings]
