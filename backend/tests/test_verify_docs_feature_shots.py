"""Tests for the FeatureShot catalogue gate in scripts/verify_docs.py (#3182).

The catalogue table in e2e/visual/features/README.md names PNGs that a
maintainer machine renders and commits; three times (#3080, #3088, #3182)
the row merged and the files never did. The gate compares the rows with
the files on disk in both directions and accepts a debt only when the row
declares it with a ``shot-pending`` marker.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs import FAIL, Report, check_feature_shots  # noqa: E402

HEADER = "# Feature-Screenshots\n\n## Katalog\n\n| Feature | Desktop | Mobile | Stand |\n|---|---|---|---|\n"
PENDING = "<!-- shot-pending: render on the maintainer machine, #3182 -->"


def _row(text: str, desktop: str, mobile: str = "—", stand: str = "#1") -> str:
    return f"| {text} | `{desktop}` | {mobile if mobile == '—' else f'`{mobile}`'} | {stand} |\n"


def _catalogue(root: Path, rows: str, files: list[str]) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    (root / "README.md").write_text(HEADER + rows, encoding="utf-8")
    for name in files:
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"png")
    return root


def _failures(report: Report) -> list[str]:
    return [f.message for f in report.findings if f.severity == FAIL]


class TestFeatureShotsCatalogue:
    def test_a_referenced_png_missing_on_disk_fails(self, tmp_path: Path) -> None:
        root = _catalogue(
            tmp_path,
            _row("Daten-Tab", "data-subnav/settings.png", "data-subnav/settings.mobile.png"),
            ["data-subnav/settings.png"],
        )
        report = Report()
        check_feature_shots(report, features_dir=root)
        failures = _failures(report)
        assert len(failures) == 1
        assert "data-subnav/settings.mobile.png" in failures[0]
        assert "row 1" in failures[0]

    def test_a_complete_catalogue_passes_and_reports_what_it_measured(self, tmp_path: Path) -> None:
        root = _catalogue(
            tmp_path,
            _row("Daten-Tab", "data-subnav/settings.png", "data-subnav/settings.mobile.png")
            + _row("Dialog", "github-export/share-dialog.png"),
            [
                "data-subnav/settings.png",
                "data-subnav/settings.mobile.png",
                "github-export/share-dialog.png",
            ],
        )
        report = Report()
        check_feature_shots(report, features_dir=root)
        assert _failures(report) == []
        assert any(
            "2 catalogue rows, 3 referenced files, 3 on disk, 0 rows pending" in note
            for note in report.notes
        )

    def test_a_png_on_disk_without_a_row_fails(self, tmp_path: Path) -> None:
        root = _catalogue(
            tmp_path,
            _row("Dialog", "github-export/share-dialog.png"),
            ["github-export/share-dialog.png", "github-export/forgotten.png"],
        )
        report = Report()
        check_feature_shots(report, features_dir=root)
        failures = _failures(report)
        assert len(failures) == 1
        assert "github-export/forgotten.png" in failures[0]

    def test_a_pending_marker_accepts_the_missing_file_and_is_reported(
        self, tmp_path: Path
    ) -> None:
        root = _catalogue(
            tmp_path,
            _row("Daten-Tab", "data-subnav/settings.png", "data-subnav/settings.mobile.png")[:-3]
            + f" {PENDING} |\n",
            [],
        )
        report = Report()
        check_feature_shots(report, features_dir=root)
        assert _failures(report) == []
        assert any(
            "row 1 pending" in note and "data-subnav/settings.png" in note for note in report.notes
        )
        assert any("1 rows pending" in note for note in report.notes)

    def test_a_pending_marker_on_a_complete_row_is_stale_and_fails(self, tmp_path: Path) -> None:
        root = _catalogue(
            tmp_path,
            _row("Dialog", "github-export/share-dialog.png")[:-3] + f" {PENDING} |\n",
            ["github-export/share-dialog.png"],
        )
        report = Report()
        check_feature_shots(report, features_dir=root)
        failures = _failures(report)
        assert len(failures) == 1
        assert "stale shot-pending marker" in failures[0]

    def test_a_bare_name_resolves_to_the_folder_of_the_row(self, tmp_path: Path) -> None:
        root = _catalogue(
            tmp_path,
            _row(
                "Matching (+ Landscape `matching-pairing.landscape.png`)",
                "matching-animation/matching-pairing.png",
                "matching-animation/matching-pairing.mobile.png",
            ),
            [
                "matching-animation/matching-pairing.png",
                "matching-animation/matching-pairing.mobile.png",
                "matching-animation/matching-pairing.landscape.png",
            ],
        )
        report = Report()
        check_feature_shots(report, features_dir=root)
        assert _failures(report) == []

    def test_a_bare_name_without_a_folder_in_the_row_fails(self, tmp_path: Path) -> None:
        root = _catalogue(tmp_path, "| Nur Name | `lonely.png` | — | #1 |\n", [])
        report = Report()
        check_feature_shots(report, features_dir=root)
        failures = _failures(report)
        assert len(failures) == 1
        assert "lonely.png" in failures[0]
        assert "names no folder" in failures[0]

    def test_fails_closed_without_a_readme_or_without_rows(self, tmp_path: Path) -> None:
        report = Report()
        check_feature_shots(report, features_dir=tmp_path / "absent")
        assert len(_failures(report)) == 1
        assert "cannot verify" in _failures(report)[0]
        root = tmp_path / "empty"
        root.mkdir()
        (root / "README.md").write_text("# Nichts\n", encoding="utf-8")
        report = Report()
        check_feature_shots(report, features_dir=root)
        assert len(_failures(report)) == 1
        assert "no catalogue rows" in _failures(report)[0]

    def test_the_committed_catalogue_is_green(self) -> None:
        """The real README and files agree (pending rows declared), so develop stays green."""
        report = Report()
        check_feature_shots(report)
        assert _failures(report) == []
        assert any("catalogue rows" in note for note in report.notes)
