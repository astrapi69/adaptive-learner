#!/usr/bin/env python3
"""App-vs-engine schema-parity gate (#1393, mirror-decoupling stage).

Source-of-truth chain for the lesson format:

    adaptive-learner Pydantic models   (SoT — ``make sync-schema`` generates
                                        the committed ``schema/`` artefacts;
                                        drift-gated by
                                        ``backend/tests/test_lesson_schema_drift.py``)
        -> learn-content-engine        (adopts the generated schema via its
                                        documented "Schema sync from
                                        adaptive-learner" procedure and
                                        BUNDLES it in every npm release)
        -> content repos               (mirror the PINNED engine release —
                                        they no longer read this app repo)

This gate closes the chain on the app side: the committed, app-generated
``schema/lesson.schema.json`` + ``schema/content-manifest.schema.json`` must
be byte-identical to the artifacts bundled by the engine release pinned in
``schema/engine-pin.json``.

A RED run is not noise — it is the defined, visible signal that the app's
schema moved ahead of the pinned engine release (an ``x-schema-version``
bump without the engine follow-up). The remedy is the engine procedure:
release the engine with the new schema, then bump ``schema/engine-pin.json``
here in a deliberate PR. Never point this gate at a floating engine branch.

Usage::

    python scripts/check_engine_schema_parity.py     # exit 1 on mismatch

Env overrides:

    ENGINE_TARBALL   path to a local .tgz of the engine package — used by the
                     offline tests (backend/tests/test_engine_schema_parity.py)
                     and for air-gapped verification.

Exit codes: 0 parity, 1 mismatch, 2 fetch/packaging error.

Stdlib only (urllib + tarfile); the comparison target is the npm REGISTRY
TARBALL of the pinned version — immutable, and exactly the artifact the
content repos' drift gates and every ``npm install learn-content-engine``
consumer resolve.
"""

from __future__ import annotations

import io
import json
import os
import sys
import tarfile
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PIN_REL = "schema/engine-pin.json"

NPM_REGISTRY = "https://registry.npmjs.org"

# Committed app artefact (relative to the repo root) -> member path inside
# the engine's npm tarball. Exactly the artifacts the engine bundles.
MIRRORED = {
    "schema/lesson.schema.json": "package/schema/lesson.schema.json",
    "schema/content-manifest.schema.json": ("package/schema/content-manifest.schema.json"),
}


def read_pin(pin_path: Path) -> dict:
    """Read + validate the engine pin (``{"package": ..., "version": ...}``)."""
    pin = json.loads(pin_path.read_text(encoding="utf-8"))
    for field in ("package", "version"):
        if not pin.get(field):
            raise ValueError(f"{pin_path}: missing required field '{field}'")
    return pin


def tarball_url(pin: dict) -> str:
    """npm registry tarball URL for the pinned package version (immutable)."""
    name = pin["package"]
    return f"{NPM_REGISTRY}/{name}/-/{name}-{pin['version']}.tgz"


def fetch_tarball(pin: dict) -> bytes:
    """Fetch the pinned engine tarball (or read ``ENGINE_TARBALL`` locally)."""
    local = os.environ.get("ENGINE_TARBALL")
    if local:
        return Path(local).read_bytes()
    url = tarball_url(pin)
    req = urllib.request.Request(url, headers={"User-Agent": "engine-schema-parity"})
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 (registry)
        if resp.status != 200:
            raise RuntimeError(f"GET {url} -> HTTP {resp.status}")
        return resp.read()


def extract_member(tgz_bytes: bytes, member: str) -> bytes:
    """Return one member's bytes from a gzipped tarball; KeyError if absent."""
    with tarfile.open(fileobj=io.BytesIO(tgz_bytes), mode="r:gz") as tar:
        try:
            fileobj = tar.extractfile(member)
        except KeyError:
            fileobj = None
        if fileobj is None:
            raise KeyError(f"tarball has no member '{member}'")
        return fileobj.read()


def main() -> int:
    try:
        pin = read_pin(REPO_ROOT / PIN_REL)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read {PIN_REL}: {exc}", file=sys.stderr)
        return 2

    print(f"Comparing app schemas against {pin['package']}@{pin['version']}\n")

    try:
        tgz = fetch_tarball(pin)
    except Exception as exc:  # network / 404 / local-path errors
        print(f"ERROR: could not fetch the engine tarball: {exc}", file=sys.stderr)
        return 2

    mismatch: list[str] = []
    errors: list[str] = []

    for local_name, member in MIRRORED.items():
        local_file = REPO_ROOT / local_name
        try:
            engine_bytes = extract_member(tgz, member)
        except KeyError as exc:
            errors.append(f"{local_name}: {exc}")
            continue
        if not local_file.is_file():
            errors.append(f"{local_name}: missing from the app repo")
            continue
        app_bytes = local_file.read_bytes()
        if app_bytes == engine_bytes:
            print(f"OK       {local_name}")
        else:
            mismatch.append(
                f"{local_name}: app ({len(app_bytes)} bytes) != "
                f"{pin['package']}@{pin['version']}:{member} ({len(engine_bytes)} bytes)"
            )

    if errors:
        print("\nERROR: gate could not compare:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 2

    if mismatch:
        print(
            "\nAPP/ENGINE SCHEMA MISMATCH — the app schema moved ahead of the "
            "pinned engine release:",
            file=sys.stderr,
        )
        for m in mismatch:
            print(f"  - {m}", file=sys.stderr)
        print(
            "\nDo the engine follow-up (its documented 'Schema sync from "
            "adaptive-learner' procedure), release the engine, then bump\n"
            f"{PIN_REL} here in a deliberate PR.",
            file=sys.stderr,
        )
        return 1

    print(f"\nApp schemas are in parity with {pin['package']}@{pin['version']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
