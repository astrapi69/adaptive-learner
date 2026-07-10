#!/usr/bin/env python3
"""Refresh the repo schema mirror from the installed engine package (D3b, #1528).

Source-of-truth chain: the ``learn-content-engine`` npm package is the
CANONICAL home of the lesson format. This script copies the engine-shipped
schema artefacts out of the INSTALLED package
(``frontend/node_modules/learn-content-engine/schema/``, pinned in
``frontend/package.json`` == ``schema/engine-version.txt``) into the repo
mirror under ``schema/``. It is the first step of ``make sync-schema``:
after it refreshes the mirror, ``generate_lesson_schema.py`` emits the
derived artefacts and ``generate_pydantic_models.py`` regenerates the
structural Pydantic layer from the same mirror.

Mirrored files (exactly the artefacts the engine bundles):

* ``lesson.schema.json``
* ``content-manifest.schema.json``
* ``quality-rules.json``

Usage::

    python3 scripts/sync_schema_mirror_from_engine.py           # copy into schema/
    python3 scripts/sync_schema_mirror_from_engine.py --check    # exit 1 on drift

Configurable via env:

    ENGINE_SCHEMA_DIR   overrides the source dir (the installed package's
                        ``schema/``); used by tests / offline runs.

The byte comparison mirrors ``check_engine_schema_parity.py`` (which
gates ``schema/*.json`` against the immutable npm tarball); this script is
the WRITE side of the same contract, sourced from the locally installed
package so ``make sync-schema`` needs no network. Stdlib only.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO_ROOT / "frontend" / "node_modules" / "learn-content-engine" / "schema"
DEST_DIR = REPO_ROOT / "schema"

# Engine-shipped artefacts mirrored into this repo (see check_engine_schema_parity.py
# for the byte-parity gate against the immutable npm tarball).
MIRRORED = (
    "lesson.schema.json",
    "content-manifest.schema.json",
    "quality-rules.json",
)


def source_dir() -> Path:
    """Return the engine schema source dir (env override or the installed package)."""
    return Path(os.environ.get("ENGINE_SCHEMA_DIR") or DEFAULT_SOURCE)


def run(check: bool = False, src: Path | None = None) -> int:
    """Copy (or, with ``check``, compare) the engine schema files.

    Returns 0 on success / parity, 1 on drift (check mode), 2 on a missing
    source dir or file.
    """
    src = src if src is not None else source_dir()
    if not src.is_dir():
        print(
            f"ERROR: engine schema dir not found: {src}\n"
            "Install the frontend deps (bun install / npm install) so "
            "learn-content-engine is present, or set ENGINE_SCHEMA_DIR.",
            file=sys.stderr,
        )
        return 2

    drift: list[str] = []
    for name in MIRRORED:
        engine_file = src / name
        if not engine_file.is_file():
            print(
                f"ERROR: {name} missing from the engine package ({engine_file})",
                file=sys.stderr,
            )
            return 2
        engine_bytes = engine_file.read_bytes()
        local_file = DEST_DIR / name

        if check:
            current = local_file.read_bytes() if local_file.is_file() else b""
            if current == engine_bytes:
                print(f"OK       schema/{name}")
            else:
                drift.append(name)
                print(f"DRIFT    schema/{name}", file=sys.stderr)
        else:
            local_file.write_bytes(engine_bytes)
            print(f"UPDATED  schema/{name}  ({len(engine_bytes)} bytes)")

    if check and drift:
        print(
            "\nSchema mirror out of sync with the installed engine package. "
            "Run `make sync-schema`.",
            file=sys.stderr,
        )
        return 1
    if check:
        print("\nSchema mirror matches the installed engine package.")
    else:
        print("\nMirror refreshed from the installed engine package.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero if the mirror differs from the installed engine package",
    )
    args = parser.parse_args()
    return run(check=args.check)


if __name__ == "__main__":
    raise SystemExit(main())
