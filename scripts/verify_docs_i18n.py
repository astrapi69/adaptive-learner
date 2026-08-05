#!/usr/bin/env python3
"""i18n-coverage check for the docs verifier (extracted #2287/#2362).

Split out of ``scripts/verify_docs.py`` so the verifier stays under the
cohesion file-size gate: a mixed-concern verifier belongs in smaller modules,
not on the .filesize-whitelist (which is for single-concern data/config
files). This module owns exactly one check - the frontend i18n catalog
coverage - and is self-contained: it takes a report object (anything with
``.fail`` / ``.warn`` / ``.note``) and needs no ``verify_docs`` internals, so
importing it back into ``verify_docs`` is import-cycle-free.

Stdlib only, like its parent (bare ``python3`` in CI before any venv exists).
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from verify_docs import Report

REPO = Path(__file__).resolve().parent.parent


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _flatten_keys(obj, prefix: str = "") -> set[str]:
    keys: set[str] = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            path = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                keys |= _flatten_keys(value, path)
            else:
                keys.add(path)
    return keys


def check_i18n(report: Report, fix: bool, i18n_dir: Path | None = None) -> None:
    i18n_dir = i18n_dir if i18n_dir is not None else REPO / "frontend" / "src" / "data" / "i18n"
    en_path = i18n_dir / "en.json"
    if not en_path.exists():
        # Fail closed (#2287): the baseline catalog is committed, so its
        # absence means the check could not run, not that catalogs are clean.
        report.fail("i18n", f"baseline catalog {en_path} not found - cannot verify (basis missing)")
        return

    if fix:
        _run_sync_i18n(report)

    en_keys = _flatten_keys(json.loads(_read(en_path)))
    if not en_keys:
        report.fail("i18n", "en.json has no keys - cannot verify (empty baseline; #2287)")
        return

    compared = 0
    for path in sorted(i18n_dir.glob("*.json")):
        if path.name == "en.json":
            continue
        try:
            keys = _flatten_keys(json.loads(_read(path)))
        except (ValueError, OSError) as exc:
            # An unparseable catalog is a hard failure, not an advisory skip:
            # the check could not examine it (#2287).
            report.fail(
                "i18n", f"{path.name}: could not parse ({exc}) - cannot verify this catalog"
            )
            continue
        compared += 1
        missing = en_keys - keys
        if missing and len(missing) / len(en_keys) > 0.05:
            shown = sorted(missing)[:6]
            report.warn(
                "i18n",
                f"{path.name}: {len(missing)}/{len(en_keys)} keys missing vs en "
                f"({len(missing) / len(en_keys):.0%}): {', '.join(shown)} ...",
            )
    report.note(
        f"i18n: compared {compared} catalog(s) against en ({len(en_keys)} keys); "
        "backend-YAML <-> frontend-JSON sync drift is gated separately by "
        "frontend i18n-sync.test.ts (make test)"
    )


def _run_sync_i18n(report: Report) -> None:
    script = REPO / "scripts" / "sync_i18n_to_frontend.py"
    if not script.exists():
        # Fail closed (#2287): --fix asked to refresh i18n but the sync script
        # is gone; a fix that could not run must not look like success.
        report.fail("i18n", f"{script} not found - cannot run --fix i18n sync (basis missing)")
        return
    try:
        result = subprocess.run(
            ["python3", str(script)],
            cwd=REPO,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            report.warn(
                "i18n",
                "ran sync_i18n_to_frontend.py to refresh frontend JSON from backend YAML (auto-fixed)",
                fixed=True,
            )
        else:
            # The fix ran but failed - not a clean pass (#2287).
            report.fail(
                "i18n",
                f"sync_i18n_to_frontend.py exited {result.returncode}: {result.stderr.strip()[:200]}",
            )
    except (OSError, subprocess.SubprocessError) as exc:
        # Could not run the fix at all - fail closed (#2287).
        report.fail("i18n", f"could not run sync_i18n_to_frontend.py: {exc}")
