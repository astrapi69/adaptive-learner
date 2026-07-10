#!/usr/bin/env python3
"""App-vs-engine schema parity gate (engine = reference, #1517).

The `learn-content-engine <https://github.com/astrapi69/learn-content-engine>`_
npm package is the CANONICAL home of the lesson schema (immutable per
published release). This app generates conforming artefacts from its
Pydantic models (``make sync-schema``, Pydantic as the app's editorial +
runtime tool); the content repos mirror THE ENGINE RELEASE (pinned
there), NOT this app. A format change starts in the engine (or is
ratified there): engine PR + release first, then pin bump +
``make sync-schema`` here, then the content repos re-pin.

This gate proves the app conforms: the committed, generated
``schema/lesson.schema.json`` + ``schema/content-manifest.schema.json``
must be byte-identical to the schema bundled in the PINNED engine
release (``schema/engine-version.txt``). Red means: the app's Pydantic
models moved without the engine-first procedure, or the pin bump after
an engine release is still missing — a visible, defined step instead of
silent drift.

The comparison target is the npm tarball of the pinned engine version —
immutable (published npm versions cannot be replaced), exactly the
artifact consumers install, and a single unauthenticated HTTPS GET.

Usage::

    python3 scripts/check_engine_schema_parity.py    # exit 1 on mismatch

Configurable via env:

    ENGINE_VERSION   overrides the pin from schema/engine-version.txt
    ENGINE_TARBALL   path or URL of a tarball to compare against
                     (used by the offline tests; bypasses the registry)

Stdlib only (urllib + tarfile) — runs with a bare ``python3`` in CI.
"""

from __future__ import annotations

import io
import os
import sys
import tarfile
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PIN_FILE = REPO_ROOT / "schema" / "engine-version.txt"

REGISTRY_BASE = "https://registry.npmjs.org/learn-content-engine/-"

# App-generated artefact (relative to the repo root) -> member path inside
# the engine npm tarball. Exactly the artifacts the engine bundles.
COMPARED = {
    "schema/lesson.schema.json": "package/schema/lesson.schema.json",
    "schema/content-manifest.schema.json": ("package/schema/content-manifest.schema.json"),
}


def read_pin(pin_file: Path = PIN_FILE) -> str:
    """Return the pinned engine version from the version file."""
    return pin_file.read_text(encoding="utf-8").strip()


def tarball_url(version: str) -> str:
    """Registry URL of the engine tarball for ``version`` (immutable)."""
    return f"{REGISTRY_BASE}/learn-content-engine-{version}.tgz"


def load_tarball(source: str) -> bytes:
    """Fetch the tarball bytes from a URL or a local path."""
    if source.startswith(("http://", "https://")):
        req = urllib.request.Request(source, headers={"User-Agent": "engine-schema-parity-check"})
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
            if resp.status != 200:
                raise RuntimeError(f"GET {source} -> HTTP {resp.status}")
            return resp.read()
    return Path(source).read_bytes()


def extract_member(tar_bytes: bytes, member: str) -> bytes:
    """Return one file's bytes out of the (gzipped) tarball."""
    with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:gz") as tar:
        fileobj = tar.extractfile(member)
        if fileobj is None:
            raise RuntimeError(f"{member}: not found in engine tarball")
        return fileobj.read()


def run_check(tarball_source: str | None = None, repo_root: Path = REPO_ROOT) -> int:
    """Compare the app schema against the pinned engine schema.

    Returns 0 on parity, 1 on mismatch, 2 on fetch/extract errors.
    """
    if tarball_source is None:
        version = os.environ.get("ENGINE_VERSION") or read_pin()
        tarball_source = os.environ.get("ENGINE_TARBALL") or tarball_url(version)
        print(f"Comparing app schema against learn-content-engine {version}")
    print(f"Tarball: {tarball_source}\n")

    try:
        tar_bytes = load_tarball(tarball_source)
    except Exception as exc:  # network / 404 / bad path
        print(f"ERROR: could not fetch engine tarball: {exc}", file=sys.stderr)
        return 2

    mismatches: list[str] = []
    for local_name, member in COMPARED.items():
        local_file = repo_root / local_name
        try:
            engine_bytes = extract_member(tar_bytes, member)
        except Exception as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 2
        if not local_file.is_file():
            mismatches.append(f"{local_name}: missing in the app repo")
            continue
        app_bytes = local_file.read_bytes()
        if app_bytes == engine_bytes:
            print(f"OK       {local_name}")
        else:
            mismatches.append(
                f"{local_name}: app ({len(app_bytes)} bytes) != pinned engine "
                f"{member} ({len(engine_bytes)} bytes)"
            )

    if mismatches:
        print(
            "\nAPP/ENGINE SCHEMA MISMATCH — the chain is open:",
            file=sys.stderr,
        )
        for m in mismatches:
            print(f"  - {m}", file=sys.stderr)
        print(
            "\nThe app schema moved (or the pin is stale). Follow-up:\n"
            "  1. run the engine's schema-sync procedure "
            "(learn-content-engine README) and release the engine\n"
            "  2. bump schema/engine-version.txt here to that release\n"
            "  3. content repos bump their own pin in a deliberate PR",
            file=sys.stderr,
        )
        return 1

    print("\nApp schema is in parity with the pinned engine release.")
    return 0


if __name__ == "__main__":
    sys.exit(run_check())
