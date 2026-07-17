"""Tests for the help-index version gate in scripts/verify_docs.py (#1766).

The deployed MkDocs front pages carried three DIFFERENT stale version
claims (de/en v1.91.0, es/ja v1.47.0, tr/el v1.20.0) because nothing
gated them. The policy fix makes the index pages versionless; this
check FAILs on ANY ``vX.Y[.Z]`` literal in ``docs/help/*/index.md`` so
a hardcoded number can never drift there again.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs import FAIL, Report, check_help_index_versions  # noqa: E402


def _write_index(help_dir: Path, locale: str, body: str) -> None:
    locale_dir = help_dir / locale
    locale_dir.mkdir(parents=True)
    (locale_dir / "index.md").write_text(body, encoding="utf-8")


class TestHelpIndexVersions:
    def test_stale_version_claim_fails(self, tmp_path: Path) -> None:
        _write_index(tmp_path, "de", "Adaptive Learner. **v1.91.0**, viele Releases.\n")
        report = Report()
        check_help_index_versions(report, help_dir=tmp_path)
        failures = [f for f in report.findings if f.severity == FAIL]
        assert len(failures) == 1
        assert "de/index.md" in failures[0].message
        assert "v1.91.0" in failures[0].message

    def test_versionless_index_passes(self, tmp_path: Path) -> None:
        _write_index(
            tmp_path,
            "en",
            "In active development - see the GitHub Releases page.\n"
            "WCAG 2.1 AA and Nielsen-Norman 5-7 stay untouched.\n",
        )
        report = Report()
        check_help_index_versions(report, help_dir=tmp_path)
        assert report.fail_count == 0

    def test_every_locale_is_scanned(self, tmp_path: Path) -> None:
        _write_index(tmp_path, "tr", "Uygulama **v1.20.0** olarak yayimlandi.\n")
        _write_index(tmp_path, "el", "Ekdosi v1.20.0 kai v1.47.0.\n")
        report = Report()
        check_help_index_versions(report, help_dir=tmp_path)
        assert report.fail_count == 3

    def test_shipped_index_pages_are_clean(self) -> None:
        """The hard gate holds on the real repo (post-#1766 state)."""
        report = Report()
        check_help_index_versions(report)
        assert report.fail_count == 0, [f.message for f in report.findings]
