"""Source-text purity gate for the Python tree (#2464).

A raw control byte in a source file makes the file binary for every
text-oriented tool: grep goes silent on it, edit tools stop matching,
``file(1)`` says data. That silence is indistinguishable from an empty
result, so every search-based inventory runs fail-open on such a file
(learn-content-engine#135 lost a finding to exactly this). Separators
like NUL are often the right runtime value; only the spelling is wrong:
write the escape, never the raw byte.

Gate contract (quality-checks.md): detects the violation (seeded
negative control), asserts the scanned set is non-trivial, fails closed
when the git index cannot be read.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ALLOWED_CONTROL = {0x09, 0x0A, 0x0D}


def find_raw_control_bytes(data: bytes) -> list[int]:
    """Byte offsets of raw control bytes (< 0x20, not tab/LF/CR)."""
    return [i for i, byte in enumerate(data) if byte < 0x20 and byte not in ALLOWED_CONTROL]


def tracked_python_sources() -> list[Path]:
    """Git-tracked ``backend/**/*.py`` + ``plugins/**/*.py`` + ``scripts/*.py``."""
    proc = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "ls-files", "-z"],
        capture_output=True,
        text=True,
        check=True,
    )
    prefixes = ("backend/", "plugins/", "scripts/")
    return [
        REPO_ROOT / rel
        for rel in proc.stdout.split("\0")
        if rel.endswith(".py") and rel.startswith(prefixes) and (REPO_ROOT / rel).exists()
    ]


def test_scans_a_non_trivial_set() -> None:
    """An empty set must not read as a clean one (fail-closed)."""
    assert len(tracked_python_sources()) > 300


def test_no_tracked_python_source_carries_raw_control_bytes() -> None:
    files = tracked_python_sources()
    offenders = []
    for path in files:
        hits = find_raw_control_bytes(path.read_bytes())
        if hits:
            offenders.append(f"{path.relative_to(REPO_ROOT)}: {len(hits)} raw byte(s)")
    assert offenders == [], f"scanned {len(files)} files; offenders: {offenders}"


def test_detects_seeded_raw_bytes_negative_control() -> None:
    assert find_raw_control_bytes(b"a\x00b") == [1]
    assert find_raw_control_bytes(b"a\x1fb") == [1]
    assert find_raw_control_bytes(b"a\tb\nc\r\n") == []
