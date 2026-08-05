#!/usr/bin/env python3
"""Generate or check the committed OpenAPI snapshot (``schema/openapi.json``).

Single writer for ``schema/openapi.json`` (#2265): only this script writes
it. The snapshot pins the API surface in the repo so an interface change -
intended or accidental - shows up in review as a diff instead of existing
only at runtime (#2281).

Gate contract (#2083, quality-checks.md "Gate test contract"):

* fails CLOSED - a missing or unreadable snapshot, or an app that cannot
  boot, is RED, never "nothing to compare, so green";
* asserts the plugin set is COMPLETE (every plugin package on disk is
  active) BEFORE comparing, so a truncated environment (the
  ``app.yaml.example`` drift class, lessons/backend.md) cannot pass
  against a truncated spec;
* prints what it measured (plugins, paths, operations, schemas), so
  "0 differences" and "0 operations inspected" never look alike;
* ``info.version`` is normalised out of the snapshot - it changes every
  release and is pinned separately by ``test_openapi_version_matches``.

Run from the repo root or ``backend/`` with the backend venv::

    cd backend && poetry run python ../scripts/sync_openapi.py            # write
    cd backend && poetry run python ../scripts/sync_openapi.py --check    # gate

Isolation: the app lifespan runs migrations and touches the data dir, so
BEFORE any ``app.*`` import this script points the app at a throwaway
directory (lessons/core.md "Never run an ad-hoc script against the real
SessionLocal").
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

EXIT_DRIFT = 1
EXIT_FAIL_CLOSED = 2

VERSION_SENTINEL = "0.0.0-snapshot"
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}


def _fail_closed(message: str) -> None:
    """Print the failure and exit RED - the gate must never pass by silence."""
    print(f"openapi-snapshot: FAIL-CLOSED: {message}")
    sys.exit(EXIT_FAIL_CLOSED)


def _repo_root() -> Path:
    """Repo root from the working directory, never from ``__file__``.

    ``__file__`` arithmetic reads the checkout the script LIVES in, which
    under ``git worktree`` is the wrong repo (lessons/core.md "Test a tool
    through the interface it actually uses").
    """
    try:
        top = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        _fail_closed(f"cannot resolve repo root from cwd: {exc}")
    return Path(top)


def _isolate_data_dir() -> None:
    """Point the app at a throwaway data dir BEFORE any ``app.*`` import."""
    os.environ.setdefault("ADAPTIVE_LEARNER_TEST", "1")
    os.environ.setdefault("ADAPTIVE_LEARNER_DATA_DIR", tempfile.mkdtemp(prefix="openapi-snapshot-"))


def _generate_spec(repo_root: Path) -> tuple[dict, int, int]:
    """Boot the app with its lifespan and return (spec, active, on_disk).

    The lifespan mounts the plugin routers, so the spec is only complete
    after startup; the cached ``app.openapi_schema`` is cleared first in
    case something generated it pre-mount.
    """
    backend_dir = repo_root / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    try:
        from fastapi.testclient import TestClient

        from app.main import app, manager
    except Exception as exc:  # noqa: BLE001 - any import failure must be RED
        _fail_closed(f"app import failed: {exc.__class__.__name__}: {exc}")

    plugin_dirs = sorted(
        p.name for p in (repo_root / "plugins").glob("adaptive-learner-plugin-*") if p.is_dir()
    )

    try:
        with TestClient(app):
            active = sorted(p.name for p in manager.get_active_plugins())
            app.openapi_schema = None
            spec = app.openapi()
    except Exception as exc:  # noqa: BLE001 - a failed boot must be RED
        _fail_closed(f"app startup / spec generation failed: {exc.__class__.__name__}: {exc}")

    if len(active) != len(plugin_dirs):
        missing = [d for d in plugin_dirs if not any(d.endswith(a) or a in d for a in active)]
        _fail_closed(
            f"plugin set incomplete: {len(active)} active vs {len(plugin_dirs)} on disk. "
            f"Active: {active}. On disk: {plugin_dirs}. Candidates missing: {missing}. "
            "A snapshot compared against a truncated plugin set proves nothing "
            "(the app.yaml.example drift class) - fix the environment first."
        )

    spec.setdefault("info", {})["version"] = VERSION_SENTINEL
    return spec, len(active), len(plugin_dirs)


def _canonical(spec: dict) -> str:
    return json.dumps(spec, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def _measure(spec: dict) -> tuple[int, int, int]:
    paths = spec.get("paths", {})
    operations = sum(1 for methods in paths.values() for m in methods if m.lower() in HTTP_METHODS)
    schemas = len(spec.get("components", {}).get("schemas", {}))
    return len(paths), operations, schemas


def _diff_summary(committed: dict, generated: dict) -> str:
    old_paths = set(committed.get("paths", {}))
    new_paths = set(generated.get("paths", {}))
    old_schemas = set(committed.get("components", {}).get("schemas", {}))
    new_schemas = set(generated.get("components", {}).get("schemas", {}))
    lines = []
    for label, added, removed in (
        ("paths", new_paths - old_paths, old_paths - new_paths),
        ("schemas", new_schemas - old_schemas, old_schemas - new_schemas),
    ):
        for name in sorted(added):
            lines.append(f"  + {label[:-1]} {name}")
        for name in sorted(removed):
            lines.append(f"  - {label[:-1]} {name}")
    if not lines:
        lines.append("  (no path/schema set change - a field-level or metadata diff)")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="compare against the committed snapshot instead of writing; no writes",
    )
    parser.add_argument(
        "--snapshot",
        type=Path,
        default=None,
        help="snapshot path override (default: <repo>/schema/openapi.json)",
    )
    args = parser.parse_args()

    _isolate_data_dir()
    repo_root = _repo_root()
    snapshot_path = args.snapshot or (repo_root / "schema" / "openapi.json")

    committed_text = ""
    committed: dict = {}
    if args.check:
        # Read the snapshot BEFORE the expensive app boot: a missing or
        # unreadable snapshot fails closed immediately.
        if not snapshot_path.is_file():
            _fail_closed(
                f"snapshot missing at {snapshot_path} - generate it with "
                "`make sync-openapi` and commit it"
            )
        try:
            committed_text = snapshot_path.read_text(encoding="utf-8")
            committed = json.loads(committed_text)
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            _fail_closed(f"snapshot unreadable at {snapshot_path}: {exc}")

    spec, n_active, n_disk = _generate_spec(repo_root)
    n_paths, n_ops, n_schemas = _measure(spec)
    print(
        f"openapi-snapshot: plugins {n_active}/{n_disk}, paths {n_paths}, "
        f"operations {n_ops}, schemas {n_schemas}"
    )
    generated_text = _canonical(spec)

    if not args.check:
        snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        snapshot_path.write_text(generated_text, encoding="utf-8")
        print(f"openapi-snapshot: wrote {snapshot_path}")
        return

    if committed_text == generated_text:
        print("openapi-snapshot: check OK - committed snapshot matches the generated spec")
        return

    print("openapi-snapshot: DRIFT - the generated spec differs from the committed snapshot:")
    print(_diff_summary(committed, spec))
    print("Intended change: run `make sync-openapi` and commit the diff.")
    sys.exit(EXIT_DRIFT)


if __name__ == "__main__":
    main()
