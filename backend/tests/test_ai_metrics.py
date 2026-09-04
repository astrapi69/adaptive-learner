"""Tests for scripts/ai_metrics.py (#2743).

Parser table + the report contract: absence is visible coverage, an
empty scan fails (a report that scanned nothing must not read clean),
aggregation sums per month. Through the real interface (subprocess on a
tmp journal dir) for the CLI half; the parser directly for the table.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(
    subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
)
SCRIPT = REPO_ROOT / "scripts" / "ai_metrics.py"

_spec = importlib.util.spec_from_file_location("ai_metrics", SCRIPT)
assert _spec and _spec.loader
ai_metrics = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ai_metrics)

BLOCK = (
    "## AI-Metriken (#2743)\n"
    "- aufgaben: 4\n"
    "- direkt-gruen: 3\n"
    "- korrektur-runden: 2\n"
    "- praemissen-korrekturen: 1\n"
)


@pytest.mark.parametrize(
    ("case", "text", "expected"),
    [
        pytest.param(
            "full-block",
            f"# Journal\n\n{BLOCK}",
            {
                "aufgaben": 4,
                "direkt-gruen": 3,
                "korrektur-runden": 2,
                "praemissen-korrekturen": 1,
            },
            id="full-block",
        ),
        pytest.param("no-block", "# Journal\nnur Prosa\n", None, id="no-block"),
        pytest.param(
            "partial-block-keeps-the-parsed-subset",
            "## AI-Metriken (#2743)\n- aufgaben: 2\n\nweiter im Text",
            {"aufgaben": 2},
            id="partial-block",
        ),
        pytest.param(
            "unknown-field-stops-nothing-but-is-ignored",
            "## AI-Metriken (#2743)\n- aufgaben: 2\n- unbekannt: 9\n",
            {"aufgaben": 2},
            id="unknown-field-ignored",
        ),
        pytest.param(
            "prose-line-ends-the-block",
            "## AI-Metriken (#2743)\n- aufgaben: 2\nProsa\n- direkt-gruen: 1\n",
            {"aufgaben": 2},
            id="prose-terminates",
        ),
    ],
)
def test_parse_block(case: str, text: str, expected: dict[str, int] | None) -> None:
    assert ai_metrics.parse_block(text) == expected, case


def run_cli(journal_dir: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--journal-dir", str(journal_dir)],
        capture_output=True,
        text=True,
        timeout=60,
    )


def test_empty_scan_fails_instead_of_reading_clean(tmp_path: Path) -> None:
    proc = run_cli(tmp_path)
    assert proc.returncode == 1
    assert "empty scan is a finding" in proc.stderr


def test_absence_is_reported_as_coverage_not_error(tmp_path: Path) -> None:
    (tmp_path / "chat-journal-session-2026-08-01.md").write_text("nur Prosa\n")
    (tmp_path / "chat-journal-session-2026-08-02.md").write_text(f"x\n{BLOCK}")
    proc = run_cli(tmp_path)
    assert proc.returncode == 0
    assert "1/2 session journal(s)" in proc.stdout


def test_aggregates_per_month_and_totals(tmp_path: Path) -> None:
    (tmp_path / "chat-journal-session-2026-07-01.md").write_text(BLOCK)
    (tmp_path / "chat-journal-session-2026-08-02.md").write_text(BLOCK)
    proc = run_cli(tmp_path)
    assert proc.returncode == 0
    assert "2026-07" in proc.stdout and "2026-08" in proc.stdout
    assert "TOTAL" in proc.stdout
    assert "first-push-green rate: 75% of 8 tasks" in proc.stdout
