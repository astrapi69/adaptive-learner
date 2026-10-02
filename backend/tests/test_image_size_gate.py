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
import os
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
    result = _run("--size-bytes", "999000000", baseline=baseline)
    assert result.returncode == 0, result.stderr
    assert "measured" in result.stdout
    assert "999000000" in result.stdout


def test_red_when_the_image_grows_past_the_ceiling(tmp_path: Path) -> None:
    """Past the ceiling AND past the rebuild-jitter tolerance."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 100_000_000}), encoding="utf-8")
    result = _run("--size-bytes", str(150_000_000), baseline=baseline)
    assert result.returncode == 1
    assert "over the ceiling" in result.stderr


def test_green_at_or_below_the_ceiling(tmp_path: Path) -> None:
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 100_000_000}), encoding="utf-8")
    assert _run("--size-bytes", "100000000", baseline=baseline).returncode == 0
    assert _run("--size-bytes", "99900000", baseline=baseline).returncode == 0


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


def test_save_is_scoped_to_the_measured_architecture(tmp_path: Path) -> None:
    """#2268: `docker save` without --platform exports EVERY architecture of a
    pulled multi-arch image (223 MB vs 108 MB for the published 2.8.2 under the
    containerd image store) - a doubled reading that looks like catastrophic
    growth. When --arch is given, the export must be scoped to it."""
    shim = tmp_path / "shim"
    shim.mkdir()
    log = tmp_path / "argv.log"
    (shim / "docker").write_text(
        "#!/bin/sh\n"
        f'echo "$@" >> {log}\n'
        'case "$1" in\n'
        '  image) echo sha256:deadbeef ;;\n'
        '  save) printf "payload" ;;\n'
        'esac\n',
        encoding="utf-8",
    )
    (shim / "docker").chmod(0o755)
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"per_arch": {"amd64": 100}}), encoding="utf-8")
    subprocess.run(
        [
            sys.executable, str(SCRIPT),
            "--image", "ghcr.io/x/y:1", "--arch", "amd64", "--baseline", str(baseline),
        ],
        capture_output=True, text=True, cwd=REPO_ROOT,
        env={**os.environ, "PATH": str(shim)},
    )
    calls = log.read_text(encoding="utf-8")
    save_line = [ln for ln in calls.splitlines() if ln.startswith("save")]
    assert save_line, f"no docker save call recorded: {calls!r}"
    assert "--platform linux/amd64" in save_line[0], (
        f"save was not scoped to the measured arch: {save_line[0]!r}"
    )


def test_fails_closed_when_docker_is_absent_entirely(tmp_path: Path) -> None:
    """No docker binary at all (#2241: the release-prepare Playwright
    container) must produce the SAME named fail-closed message, not a raw
    FileNotFoundError traceback - the gate's behaviour has to mean the same
    thing in every environment (gate contract point 5)."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 100}), encoding="utf-8")
    args = [sys.executable, str(SCRIPT), "--image", "adaptive-learner:x", "--baseline", str(baseline)]
    # Only PATH shrinks (docker becomes unfindable); everything else is
    # preserved - a wholesale env={} replacement killed the interpreter
    # itself in the release-gate container (no LD_LIBRARY_PATH, rc 127).
    result = subprocess.run(
        args,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        env={**os.environ, "PATH": str(tmp_path)},
    )
    assert result.returncode == 1
    assert "could not measure" in result.stderr
    assert "Traceback" not in result.stderr


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


def test_shrink_beyond_the_tolerance_is_a_finding(tmp_path: Path) -> None:
    """#2135 both directions: a ceiling far above the artifact reports
    nothing when the artifact loses content it should carry - red until a
    human verifies the loss and lowers the ceiling (never automatic)."""
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 120_000_000}), encoding="utf-8")
    result = _run("--size-bytes", str(100_000_000), baseline=baseline)
    assert result.returncode == 1
    assert "unexpected shrink" in result.stderr
    assert "--update-baseline" in result.stderr


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
    under = _run("--size-bytes", str(129_950_000), "--arch", "arm64", baseline=baseline)
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
    result = _run("--size-bytes", "129900000", "--arch", "arm64", baseline=baseline)
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


def test_the_measurement_paths_are_documented_as_equivalent() -> None:
    """The ceiling is seeded from one path and enforced against another.

    Measured 2026-07-29: the same image locally and after a registry
    round-trip differed by 14 bytes of 112325662. The finding lives next to
    the baseline so nobody has to re-derive it - and so a future packaging
    change (different registry, image store, zstd layers) has something to
    invalidate rather than an unstated assumption.
    """
    data = json.loads(BASELINE.read_text(encoding="utf-8"))
    note = data.get("_measurement_paths", "")
    assert note, "no record of whether seeding and enforcement measure the same thing"
    assert "14 bytes" in note, "the note carries no measured evidence"


# ---------------------------------------------------------------------------
# #3189: --update-baseline used to rewrite the file down to two keys, erasing
# measured_in, the per_arch block and every _raise_/_lower_ history entry
# (a tool that silently deletes its own record is fail-open in its own
# right, #2083). It now edits the numbers in place and can append a dated
# history entry itself.
# ---------------------------------------------------------------------------

HISTORY = {
    "note": "the ceiling",
    "compressed_bytes": 100_000_000,
    "measured_in": "ci/ubuntu-latest",
    "_tightening": "manual",
    "_raise_2575": "raised for eruda",
    "per_arch": {"amd64": 100_000_000, "arm64": 98_000_000},
    "_per_arch_note": "two environments",
    "_arm64_lower_2748": "first publish measurement",
}


def _history_baseline(tmp_path: Path) -> Path:
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps(HISTORY, indent=2), encoding="utf-8")
    return baseline


def test_update_baseline_keeps_the_history_and_the_other_architecture(tmp_path: Path) -> None:
    baseline = _history_baseline(tmp_path)
    result = _run("--size-bytes", "95000000", "--update-baseline", baseline=baseline)
    assert result.returncode == 0, result.stderr
    written = json.loads(baseline.read_text(encoding="utf-8"))
    assert written["compressed_bytes"] == 95_000_000
    assert written["per_arch"] == {"amd64": 95_000_000, "arm64": 98_000_000}
    for key in ("note", "measured_in", "_tightening", "_raise_2575", "_per_arch_note", "_arm64_lower_2748"):
        assert written[key] == HISTORY[key], key
    assert list(written) == list(HISTORY), "key order is part of the record"


def test_update_baseline_for_an_architecture_touches_only_its_number(tmp_path: Path) -> None:
    baseline = _history_baseline(tmp_path)
    result = _run(
        "--size-bytes", "97000000", "--update-baseline", "--arch", "arm64", baseline=baseline
    )
    assert result.returncode == 0, result.stderr
    written = json.loads(baseline.read_text(encoding="utf-8"))
    assert written["per_arch"] == {"amd64": 100_000_000, "arm64": 97_000_000}
    assert written["compressed_bytes"] == 100_000_000
    assert written["_raise_2575"] == "raised for eruda"


def test_update_baseline_appends_a_dated_history_entry_on_request(tmp_path: Path) -> None:
    baseline = _history_baseline(tmp_path)
    result = _run(
        "--size-bytes", "95000000", "--update-baseline",
        "--issue", "3189", "--note", "build-environment drift, no image input changed",
        baseline=baseline,
    )
    assert result.returncode == 0, result.stderr
    written = json.loads(baseline.read_text(encoding="utf-8"))
    entry = written["_lower_3189"]
    assert entry.startswith("Lowered amd64 100000000 -> 95000000 (#3189, 20")
    assert entry.endswith("): build-environment drift, no image input changed")
    assert "_raise_3189" not in written
    assert list(written)[-1] == "_lower_3189"


def test_a_raise_with_a_note_is_recorded_as_a_raise_per_architecture(tmp_path: Path) -> None:
    baseline = _history_baseline(tmp_path)
    result = _run(
        "--size-bytes", "99000000", "--update-baseline", "--allow-raise", "--arch", "arm64",
        "--issue", "3190", "--note", "the dep sweep", baseline=baseline,
    )
    assert result.returncode == 0, result.stderr
    written = json.loads(baseline.read_text(encoding="utf-8"))
    assert written["_arm64_raise_3190"].startswith("Raised arm64 98000000 -> 99000000 (#3190, 20")
    assert written["per_arch"]["arm64"] == 99_000_000


def test_a_note_without_an_issue_is_refused(tmp_path: Path) -> None:
    baseline = _history_baseline(tmp_path)
    result = _run(
        "--size-bytes", "95000000", "--update-baseline", "--note", "why", baseline=baseline
    )
    assert result.returncode == 2
    assert "--issue" in result.stderr
    assert json.loads(baseline.read_text(encoding="utf-8")) == HISTORY


def test_reports_the_uncompressed_size_and_the_base_image_digests(tmp_path: Path) -> None:
    """The #3187 shrink could not be attributed with only the gzip total in
    the log (gate contract point 4: say what was measured)."""
    shim = tmp_path / "shim"
    shim.mkdir()
    (shim / "docker").write_text(
        "#!/bin/sh\n"
        'case "$1 $2" in\n'
        '  "image inspect")\n'
        '    case "$5" in\n'
        '      "{{.Id}}") echo sha256:deadbeef ;;\n'
        '      "{{.Size}}") echo 491000000 ;;\n'
        '      *) echo "$3@sha256:0123456789abcdef" ;;\n'
        "    esac ;;\n"
        '  "save "*) printf "payload" ;;\n'
        "esac\n",
        encoding="utf-8",
    )
    (shim / "docker").chmod(0o755)
    baseline = tmp_path / "b.json"
    baseline.write_text(json.dumps({"compressed_bytes": 100}), encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--image", "ghcr.io/x/y:1", "--baseline", str(baseline)],
        capture_output=True, text=True, cwd=REPO_ROOT,
        env={**os.environ, "PATH": str(shim)},
    )
    assert "uncompressed 491000000 bytes" in result.stdout, result.stdout + result.stderr
    assert "base image python:3.12-slim: python:3.12-slim@sha256:0123456789abcdef" in result.stdout
    assert "base image node:24-slim: node:24-slim@sha256:0123456789abcdef" in result.stdout


def test_reports_when_the_base_image_digests_are_unavailable(tmp_path: Path) -> None:
    result = _run("--size-bytes", "100", baseline=tmp_path / "absent.json")
    assert result.returncode == 1
    result = _run("--size-bytes", "100000000", baseline=_history_baseline(tmp_path))
    assert result.returncode == 0, result.stderr
    assert "uncompressed size and base-image digests: not read (size given)" in result.stdout
