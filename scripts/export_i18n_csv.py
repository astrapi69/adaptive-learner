#!/usr/bin/env python3
"""Per-language CSV review export for native i18n reviewers (issue #1296).

Generates one CSV per target language with the German source beside the
target translation, the LLM quality verdict (from the provenance cache that
``i18n_quality_check.py`` writes, when present), and an empty ``correction``
column for the reviewer to fill. A native reviewer opens the file in Excel /
Google Sheets / LibreOffice -- no YAML knowledge needed -- and the filled-in
corrections can later be re-imported (follow-up PR).

The catalogs stay the single source of truth; this is a generated artifact.

Pure helpers (``csv_header``, ``csv_rows``) are unit-tested in
``backend/tests/test_export_i18n_csv.py``; a writer/reader round-trip there
proves values with commas / newlines / quotes survive.

Usage:
    python3 scripts/export_i18n_csv.py                 # all 8 target langs
    python3 scripts/export_i18n_csv.py --langs ja --flagged-only
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
REPO = SCRIPTS_DIR.parent

sys.path.insert(0, str(SCRIPTS_DIR))
from export_i18n_review import I18N_DIR, flatten, load_catalog  # noqa: E402
from i18n_quality_check import (  # noqa: E402
    DEFAULT_TARGET_LANGS,
    FLAGGED,
    SRC,
)

_META_COLS = ["llm_verdict", "llm_severity", "llm_note", "llm_suggestion"]


def csv_header(lang: str) -> list[str]:
    """Column header for a language's review CSV."""
    return ["key", "de", lang, *_META_COLS, "correction"]


def _cell(value) -> str:
    """Render a catalog value as a CSV cell (``None`` -> empty string)."""
    return "" if value is None else str(value)


def csv_rows(de_flat: dict, tgt_flat: dict, status: dict, *, lang: str, flagged_only: bool) -> list[list[str]]:
    """Build CSV rows (one per shared key, in DE key order).

    Merges the catalog values with the LLM status cache. With
    ``flagged_only`` only keys whose cached verdict is a flagged problem are
    emitted (focuses the reviewer on the suspects).
    """
    rows: list[list[str]] = []
    for key, de_value in de_flat.items():
        if key not in tgt_flat:
            continue
        entry = status.get(key) if isinstance(status.get(key), dict) else {}
        verdict = entry.get("verdict", "")
        if flagged_only and verdict not in FLAGGED:
            continue
        rows.append(
            [
                key,
                _cell(de_value),
                _cell(tgt_flat[key]),
                verdict,
                entry.get("severity", ""),
                entry.get("note", ""),
                entry.get("suggestion", ""),
                "",
            ]
        )
    return rows


def _load_status(status_dir: Path, lang: str) -> dict:
    path = status_dir / f"{lang}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def run(args: argparse.Namespace) -> int:
    de_flat = flatten(load_catalog(I18N_DIR / f"{SRC}.yaml"))
    langs = args.langs or DEFAULT_TARGET_LANGS
    status_dir = (REPO / args.status_dir).resolve()
    out_dir = (REPO / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    encoding = "utf-8-sig" if args.excel_bom else "utf-8"

    for lang in langs:
        tgt_flat = flatten(load_catalog(I18N_DIR / f"{lang}.yaml"))
        status = _load_status(status_dir, lang)
        rows = csv_rows(de_flat, tgt_flat, status, lang=lang, flagged_only=args.flagged_only)
        path = out_dir / f"{lang}.csv"
        with path.open("w", encoding=encoding, newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(csv_header(lang))
            writer.writerows(rows)
        print(f"  {lang}: {len(rows)} rows -> {path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--langs", nargs="*", default=None,
        help=f"target languages (default: {' '.join(DEFAULT_TARGET_LANGS)})",
    )
    parser.add_argument("--flagged-only", action="store_true",
                        help="only export keys the LLM flagged as a problem")
    parser.add_argument("--excel-bom", action="store_true",
                        help="write a UTF-8 BOM so Excel detects the encoding")
    parser.add_argument("--status-dir", default="docs/review/i18n-status")
    parser.add_argument("--out-dir", default="docs/review/i18n-csv")
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
