#!/usr/bin/env python3
"""Ratchet the published image's compressed size (#2132).

While the image was built on the user's machine, its size was an internal
number nobody paid. From the moment it is pulled (#2110 Option A) every
learner downloads it on first install, and every learner downloads the
growth. So it gets the same treatment as the rule corpus (#2091): it may
shrink, and it may not grow without a visible decision.

The measure is the COMPRESSED size - what actually crosses the wire -
taken by streaming ``docker save`` through gzip, the same way a registry
transfers layers. The uncompressed size is reported alongside for
orientation but is not the gate: it is not what anyone waits for.

Usage::

    python3 scripts/verify_image_size.py                       # measure + check
    python3 scripts/verify_image_size.py --update-baseline     # lower the ceiling
    python3 scripts/verify_image_size.py --update-baseline --allow-raise
    python3 scripts/verify_image_size.py --size-bytes 12345    # for tests

Exit codes: 0 within the ceiling, 1 over it - or the image or baseline
could not be read (fail closed, #2083). A size that could not be measured
is never a small size.
"""

from __future__ import annotations

import argparse
import gzip
import io
import json
import subprocess
import sys
from pathlib import Path

DEFAULT_IMAGE = "adaptive-learner:latest"
BASELINE_PATH = Path(".image-size-baseline.json")

# Two rebuilds of identical content do not produce byte-identical archives:
# tar ordering and gzip framing jitter. Measured across two builds of the
# same tree: 47 651 bytes apart, 0.04 %. A byte-exact ceiling would flap on
# that and teach everyone to ignore the gate. The tolerance is ~4.2x the
# MEASURED jitter (200 000 / 47 651) - wide enough to never flap on noise,
# narrow enough that real growth surfaces early. The previous 2 MB was 42x
# the jitter: it stopped catching noise and started absorbing real growth
# (the v2.8.0 amd64 image sat 66 106 bytes over the ceiling and the gate
# said nothing worth acting on). A number without a stated relation to the
# measured noise is arbitrary (#2135 point 5).
JITTER_TOLERANCE = 200_000


def measure(image: str) -> int | None:
    """Return the gzipped transfer size in bytes, or ``None`` if unmeasurable.

    Deliberately NOT ``docker image inspect .Size``: with the containerd
    image store that field reports the CONTENT size (113 MB here) while
    the classic graphdriver reports the unpacked one (491 MB). A gate whose
    number depends on the reader's storage driver is not a gate. Streaming
    ``docker save`` through gzip gives the same answer everywhere, and it
    is the number the user actually waits for.
    """
    try:
        exists = subprocess.run(
            ["docker", "image", "inspect", image, "--format", "{{.Id}}"],
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        # No docker binary at all (#2241: the release-prepare Playwright
        # container). Same fail-closed path as a missing image - a raw
        # traceback would make the gate behave differently per environment.
        return None
    if exists.returncode != 0:
        return None

    # Stream through gzip without holding the archive in memory: count what
    # the compressor emits, dropping the bytes as they are counted.
    save = subprocess.Popen(["docker", "save", image], stdout=subprocess.PIPE)
    assert save.stdout is not None
    compressed = 0
    sink = io.BytesIO()
    with gzip.GzipFile(fileobj=sink, mode="wb", compresslevel=1) as gz:
        while chunk := save.stdout.read(1024 * 1024):
            gz.write(chunk)
            compressed += sink.tell()
            sink.seek(0)
            sink.truncate(0)
    compressed += sink.tell()
    save.wait()
    if save.returncode != 0:
        return None
    return compressed


def load_baseline(path: Path, arch: str | None = None) -> tuple[int | None, str | None]:
    """The ceiling for ``arch``, or the single legacy one when arch is None.

    A missing per-architecture ceiling fails CLOSED rather than falling
    back to another architecture's number: two published architectures are
    two environments (#2136 point 5), and borrowing one's measurement for
    the other is precisely the mistake that rule exists to prevent.
    """
    if not path.is_file():
        return None, f"missing baseline {path} - cannot ratchet against nothing"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return None, f"unreadable baseline {path}: {exc}"

    if arch:
        per_arch = data.get("per_arch")
        if not isinstance(per_arch, dict):
            return None, f"baseline {path} carries no per_arch ceilings"
        value = per_arch.get(arch)
        if not isinstance(value, int) or value <= 0:
            return None, (
                f"no ceiling recorded for {arch} - an unmeasured architecture may not "
                f"borrow another one's number.\nSeed it from a CI run on a native "
                f"{arch} runner:\n  python3 scripts/verify_image_size.py --image <ref> "
                f"--arch {arch} --update-baseline"
            )
        return value, None

    value = data.get("compressed_bytes")
    if not isinstance(value, int) or value <= 0:
        return None, f"baseline {path} has no usable compressed_bytes"
    return value, None


def write_baseline(path: Path, compressed: int, arch: str | None = None) -> None:
    existing = {}
    if path.is_file():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = {}
    if arch:
        # Touch only this architecture - overwriting the sibling would erase a
        # measurement taken in a different environment.
        per_arch = dict(existing.get("per_arch") or {})
        per_arch[arch] = compressed
        existing["per_arch"] = per_arch
        path.write_text(json.dumps(existing, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return
    payload = {
        **{k: v for k, v in existing.items() if k in ("per_arch", "_tightening")},
        "note": (
            "Ceiling for the published image (#2132). Compressed bytes - what "
            "crosses the wire on a pull. Lower it with --update-baseline; "
            "raising it needs --allow-raise and belongs in a commit that says why."
        ),
        "compressed_bytes": compressed,
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", default=DEFAULT_IMAGE)
    parser.add_argument("--baseline", default=None)
    parser.add_argument("--size-bytes", type=int, default=None, help="skip docker, use this size")
    parser.add_argument("--update-baseline", action="store_true")
    parser.add_argument("--allow-raise", action="store_true", help="permit a HIGHER ceiling")
    parser.add_argument("--arch", default=None, help="which architecture this reading belongs to")
    args = parser.parse_args()

    baseline_path = Path(args.baseline) if args.baseline else Path.cwd() / BASELINE_PATH

    if args.size_bytes is not None:
        compressed = args.size_bytes
    else:
        compressed = measure(args.image)
        if compressed is None:
            print(
                f"could not measure {args.image} - build it first "
                "(a size that cannot be read is not a small size)",
                file=sys.stderr,
            )
            return 1

    # The proof of what was measured: without it, an unmeasured run and a
    # clean one print the same green (#2083 point 4).
    where = f" [{args.arch}]" if args.arch else ""
    print(
        f"image {args.image}{where}: measured {compressed} bytes gzipped "
        f"({compressed / 1024 / 1024:.0f} MB - what a pull transfers)"
    )
    if args.size_bytes is None:
        # The ceiling is a CI measurement. A local build legitimately differs
        # (base-image digests and apt package versions drift), so say which
        # environment this reading came from before anyone "fixes" a local
        # red by lowering the ceiling.
        print("  reading from this machine; the ceiling is measured in CI")

    ceiling, error = load_baseline(baseline_path, args.arch)
    if error and not args.update_baseline:
        print(error, file=sys.stderr)
        return 1

    if args.update_baseline:
        if ceiling is not None and compressed > ceiling and not args.allow_raise:
            print(
                f"refusing to raise the ceiling {ceiling} -> {compressed} without --allow-raise.\n"
                "Every byte here is downloaded by every user on first install. "
                "Growth is allowed, but as a deliberate act.",
                file=sys.stderr,
            )
            return 1
        write_baseline(baseline_path, compressed, args.arch)
        print(f"baseline set: {ceiling} -> {compressed}")
        return 0

    assert ceiling is not None
    if compressed > ceiling + JITTER_TOLERANCE:
        sys.stdout.flush()
        print(
            f"\nimage is {compressed - ceiling} bytes over the ceiling "
            f"({compressed} > {ceiling}, tolerance {JITTER_TOLERANCE}).\n"
            "Options: find what grew (docker history --no-trunc), or raise the\n"
            "ceiling deliberately with --update-baseline --allow-raise and say\n"
            "in the commit what the users are downloading it for.",
            file=sys.stderr,
        )
        return 1
    if compressed > ceiling:
        print(
            f"  {compressed - ceiling} bytes above the ceiling but inside the "
            f"{JITTER_TOLERANCE} byte rebuild-jitter tolerance"
        )
    else:
        headroom = ceiling - compressed
        print(f"  within the ceiling ({ceiling}, headroom {headroom} bytes)")
        if headroom > JITTER_TOLERANCE:
            # An unexpected shrink is a FINDING, not a bonus (#2135: the
            # tolerance is named in BOTH directions). A ceiling far above
            # the artifact reports nothing when the artifact loses content
            # it should carry - red until a human verifies nothing was
            # lost and takes the ratchet down (still never automatic).
            sys.stdout.flush()
            print(
                f"\nimage is {headroom} bytes BELOW the ceiling - more than the "
                f"{JITTER_TOLERANCE} byte noise tolerance. An unexpected shrink "
                "is a finding: verify nothing was lost, then lower the ceiling:\n"
                "    python3 scripts/verify_image_size.py --update-baseline",
                file=sys.stderr,
            )
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
