"""Pins the image-size ratchet (#2132).

While the image was built on the user's machine its size was an internal
number. From the moment it is pulled (#2110 Option A) every learner pays
it on first install, so it gets the same treatment as the rule corpus:
it may shrink, and it may not grow without a visible decision.

Gate contract (#2083), all four: it detects growth past the ceiling, it
passes at or below it, it fails CLOSED when the image or the baseline is
missing - "I could not measure" is never "nothing to report" - and it
states WHAT it measured, so an unmeasured run cannot read like a clean one.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "verify_image_size.py"
BASELINE = REPO_ROOT / ".image-size-baseline.json"


def _run(*extra: str, baseline: Path | None = None) -> subprocess.CompletedProcess[str]:
    args = [sys.executable, str(SCRIPT), *extra]
    if baseline is not None:
        args += ["--baseline", str(baseline)]
    return subprocess.run(args, capture_output=True, text=True, cwd=REPO_ROOT)


def test_reports_what_it_measured(tmp_path: Path) -> None:
    """Point 4: a run that measured nothing must not print the same green."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 999_000_000}), encoding="utf-8")
    result = _run("--size-bytes", "1000", baseline=baseline)
    assert result.returncode == 0, result.stderr
    assert "measured" in result.stdout
    assert "1000" in result.stdout or "0 MB" in result.stdout


def test_red_when_the_image_grows_past_the_ceiling(tmp_path: Path) -> None:
    """Past the ceiling AND past the rebuild-jitter tolerance."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 100_000_000}), encoding="utf-8")
    result = _run("--size-bytes", str(150_000_000), baseline=baseline)
    assert result.returncode == 1
    assert "over the ceiling" in result.stderr


def test_green_at_or_below_the_ceiling(tmp_path: Path) -> None:
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 200}), encoding="utf-8")
    assert _run("--size-bytes", "200", baseline=baseline).returncode == 0
    assert _run("--size-bytes", "150", baseline=baseline).returncode == 0


def test_fails_closed_without_a_baseline(tmp_path: Path) -> None:
    result = _run("--size-bytes", "100", baseline=tmp_path / "absent.json")
    assert result.returncode == 1
    assert "missing baseline" in result.stderr


def test_fails_closed_when_the_image_cannot_be_measured(tmp_path: Path) -> None:
    """No such image is not a small image."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 100}), encoding="utf-8")
    result = _run("--image", "adaptive-learner:definitely-not-built", baseline=baseline)
    assert result.returncode == 1
    assert "could not measure" in result.stderr


def test_shrinking_lowers_the_ceiling_only_on_request(tmp_path: Path) -> None:
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 500}), encoding="utf-8")
    assert _run("--size-bytes", "300", baseline=baseline).returncode == 0
    assert json.loads(baseline.read_text())["compressed_bytes"] == 500
    assert _run("--size-bytes", "300", "--update-baseline", baseline=baseline).returncode == 0
    assert json.loads(baseline.read_text())["compressed_bytes"] == 300


def test_raising_the_ceiling_needs_an_explicit_flag(tmp_path: Path) -> None:
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 100}), encoding="utf-8")
    refused = _run("--size-bytes", "900", "--update-baseline", baseline=baseline)
    assert refused.returncode == 1
    assert "--allow-raise" in refused.stderr
    assert (
        _run(
            "--size-bytes", "900", "--update-baseline", "--allow-raise", baseline=baseline
        ).returncode
        == 0
    )


def test_the_committed_baseline_is_present_and_sane() -> None:
    """The ratchet is only real if the repo carries its ceiling."""
    assert BASELINE.is_file(), "no committed ceiling - the gate would fail closed forever"
    data = json.loads(BASELINE.read_text(encoding="utf-8"))
    assert data["compressed_bytes"] > 0


def test_rebuild_jitter_does_not_flap_the_gate(tmp_path: Path) -> None:
    """Two builds of identical content differ by tens of KB (measured: 47651).

    A byte-exact ceiling would fail on that and train everyone to ignore it.
    """
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 100_000_000}), encoding="utf-8")
    result = _run("--size-bytes", str(100_047_651), baseline=baseline)
    assert result.returncode == 0, result.stderr
    assert "jitter tolerance" in result.stdout


def test_a_real_regression_still_fails(tmp_path: Path) -> None:
    """The tolerance must not swallow anything that matters."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 100_000_000}), encoding="utf-8")
    result = _run("--size-bytes", str(110_000_000), baseline=baseline)
    assert result.returncode == 1
    assert "over the ceiling" in result.stderr


def test_headroom_beyond_the_tolerance_is_offered(tmp_path: Path) -> None:
    """#2140: a real shrink must be offered, or the space is silently reusable."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 120_000_000}), encoding="utf-8")
    result = _run("--size-bytes", str(100_000_000), baseline=baseline)
    assert result.returncode == 0, result.stderr
    assert "ratchet opportunity" in result.stdout.lower()
    assert "--update-baseline" in result.stdout


def test_headroom_inside_the_jitter_tolerance_is_not_offered(tmp_path: Path) -> None:
    """Rebuild noise is not an improvement - offering it would train noise-chasing."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 120_000_000}), encoding="utf-8")
    result = _run("--size-bytes", str(119_950_000), baseline=baseline)
    assert result.returncode == 0
    assert "ratchet opportunity" not in result.stdout.lower()


def test_arch_selects_its_own_ceiling(tmp_path: Path) -> None:
    """#2147: two published architectures are two environments (#2136 point 5)."""
    baseline = tmp_path / "b.json"
    baseline.write_text(
        json.dumps({"per_arch": {"amd64": 100_000_000, "arm64": 130_000_000}}), encoding="utf-8"
    )
    over = _run("--size-bytes", str(125_000_000), "--arch", "amd64", baseline=baseline)
    assert over.returncode == 1, "amd64 ceiling was not applied"
    under = _run("--size-bytes", str(125_000_000), "--arch", "arm64", baseline=baseline)
    assert under.returncode == 0, under.stderr


def test_a_missing_arch_ceiling_fails_closed(tmp_path: Path) -> None:
    """An unmeasured architecture must not borrow the other one's number."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"per_arch": {"amd64": 100_000_000}}), encoding="utf-8")
    result = _run("--size-bytes", "1000", "--arch", "arm64", baseline=baseline)
    assert result.returncode == 1
    assert "no ceiling recorded for arm64" in result.stderr
    assert "--update-baseline" in result.stderr


def test_the_arch_is_named_in_the_output(tmp_path: Path) -> None:
    """Point 4 + point 5: say WHICH environment this reading belongs to."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"per_arch": {"arm64": 130_000_000}}), encoding="utf-8")
    result = _run("--size-bytes", "1000", "--arch", "arm64", baseline=baseline)
    assert result.returncode == 0, result.stderr
    assert "arm64" in result.stdout


def test_updating_writes_only_that_arch(tmp_path: Path) -> None:
    baseline = tmp_path / "b.json"
    baseline.write_text(
        json.dumps({"per_arch": {"amd64": 100_000_000, "arm64": 130_000_000}}), encoding="utf-8"
    )
    assert (
        _run(
            "--size-bytes", "90000000", "--arch", "amd64", "--update-baseline", baseline=baseline
        ).returncode
        == 0
    )
    written = json.loads(baseline.read_text(encoding="utf-8"))["per_arch"]
    assert written["amd64"] == 90_000_000
    assert written["arm64"] == 130_000_000, "the other architecture was overwritten"


def test_the_committed_baseline_carries_per_arch_ceilings() -> None:
    """The repo must actually ship what the workflow relies on."""
    data = json.loads(BASELINE.read_text(encoding="utf-8"))
    assert "per_arch" in data, "no per-architecture ceilings committed"
    assert set(data["per_arch"]) >= {"amd64"}, data["per_arch"]
