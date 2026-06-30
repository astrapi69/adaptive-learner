#!/usr/bin/env python3
"""Surgically write reviewed i18n corrections back into the YAML catalogs.

The deferred write-back half of the i18n quality-check flow (#1296). Reads
corrections from either:

  - the LLM status cache (``docs/review/i18n-status/<lang>.json``), filtered by
    verdict, using each entry's ``suggestion`` (``--source cache``), or
  - a reviewed CSV (``docs/review/i18n-csv/<lang>.csv``) ``correction`` column
    (``--source csv``).

Writes are surgical: the catalog is loaded with ruamel round-trip
(quote/comment/format preserving — a no-op load+dump is byte-identical), so
only the changed scalar values differ. NEVER a ``yaml.safe_dump`` reformat.

SAFETY — the diacritics guard (``--diacritics-only``, default on for
``--source cache``): a correction is applied only when it differs from the
current value by **accents/diacritics alone** (NFD-accent-stripped equality,
case-preserving). This makes the missing_diacritics class auto-applicable
without risking a content change; anything else (added words, a capitalization
change, punctuation like the Spanish ``¿``, an ``…`` ellipsis swap, or a
reworded translation) is skipped and reported for human review.

Pure helpers (``strip_accents``, ``is_diacritics_only``, ``get_by_path``,
``set_by_path``, ``load_cache_corrections``) are unit-tested in
``backend/tests/test_import_i18n_corrections.py``.

Usage:
    python3 scripts/import_i18n_corrections.py --langs fr es \
        --source cache --verdict missing_diacritics
"""

from __future__ import annotations

import argparse
import csv
import json
import unicodedata
from pathlib import Path

from ruamel.yaml import YAML

REPO = Path(__file__).resolve().parents[1]
I18N_DIR = REPO / "backend" / "config" / "i18n"
STATUS_DIR = REPO / "docs" / "review" / "i18n-status"
CSV_DIR = REPO / "docs" / "review" / "i18n-csv"


def strip_accents(value: str) -> str:
    """Drop combining diacritical marks, leaving the base letters.

    Uses NFD (canonical) decomposition, NOT NFKD: NFKD would also fold
    compatibility characters (… -> ..., ﬁ -> fi, non-breaking space ->
    space), which would let punctuation/typography changes pass the
    diacritics-only guard. NFD touches accents only.
    """
    decomposed = unicodedata.normalize("NFD", value)
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def is_diacritics_only(old: str, new: str) -> bool:
    """True iff ``new`` differs from ``old`` by diacritics/case only.

    Guards the auto-apply path: accent restoration (Etat->État, modeles->
    modèles, anadir->añadir) passes; added words, punctuation (e.g. the
    Spanish opening ``¿``), or reworded content do not.
    """
    if old == new:
        return False
    # Case-preserving on purpose: a capitalization change (errores->Errores,
    # Pronunciación->pronunciación) is NOT a diacritic and must be routed to
    # review, not auto-applied. Only the accent layer may differ.
    return strip_accents(old) == strip_accents(new)


def get_by_path(data, dotted: str):
    """Return the scalar at a dotted dict path, or None if absent.

    List-index segments (``a[0].b``) are not supported and return None
    (i18n leaf keys are dict paths; indexed keys are skipped + reported).
    """
    if "[" in dotted:
        return None
    node = data
    for seg in dotted.split("."):
        if not isinstance(node, dict) or seg not in node:
            return None
        node = node[seg]
    return node


def set_by_path(data, dotted: str, value: str) -> bool:
    """Set the scalar at a dotted dict path. Returns False if the path is
    absent or indexed."""
    if "[" in dotted:
        return False
    node = data
    segs = dotted.split(".")
    for seg in segs[:-1]:
        if not isinstance(node, dict) or seg not in node:
            return False
        node = node[seg]
    if not isinstance(node, dict) or segs[-1] not in node:
        return False
    node[segs[-1]] = value
    return True


def load_cache_corrections(lang: str, verdict: str | None) -> dict:
    """Return ``{key: suggestion}`` from the status cache, optionally filtered
    to a single verdict, skipping empty suggestions."""
    path = STATUS_DIR / f"{lang}.json"
    cache = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for key, entry in cache.items():
        if verdict and entry.get("verdict") != verdict:
            continue
        suggestion = (entry.get("suggestion") or "").strip()
        if suggestion:
            out[key] = suggestion
    return out


def load_csv_corrections(lang: str) -> dict:
    """Return ``{key: correction}`` from the reviewed CSV correction column."""
    path = CSV_DIR / f"{lang}.csv"
    out = {}
    with path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            correction = (row.get("correction") or "").strip()
            if correction:
                out[row["key"]] = correction
    return out


def prune_cache(lang: str, keys: list) -> int:
    """Drop ``keys`` from the status cache so the next quality-check re-verifies
    them (the cache keys on the DE-source hash, which an applied target fix does
    not change — without this they'd stay flagged after being fixed). Returns
    the number of entries removed. No-op if the cache is absent."""
    path = STATUS_DIR / f"{lang}.json"
    if not path.exists():
        return 0
    cache = json.loads(path.read_text(encoding="utf-8"))
    removed = sum(1 for k in keys if cache.pop(k, None) is not None)
    if removed:
        path.write_text(
            json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
            encoding="utf-8",
        )
    return removed


def apply_lang(lang: str, corrections: dict, diacritics_only: bool) -> dict:
    """Apply ``corrections`` to one catalog. Returns a result summary."""
    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.width = 4096
    path = I18N_DIR / f"{lang}.yaml"
    data = yaml.load(path.read_text(encoding="utf-8"))

    applied, skipped = [], []
    for key, new in corrections.items():
        current = get_by_path(data, key)
        if not isinstance(current, str):
            skipped.append((key, "absent-or-non-string"))
            continue
        if diacritics_only and not is_diacritics_only(current, new):
            skipped.append((key, "not-diacritics-only"))
            continue
        if current == new:
            skipped.append((key, "no-change"))
            continue
        set_by_path(data, key, new)
        applied.append(key)

    if applied:
        yaml.dump(data, path)
    return {"applied": applied, "skipped": skipped}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--langs", nargs="+", required=True)
    parser.add_argument("--source", choices=["cache", "csv"], default="csv")
    parser.add_argument(
        "--verdict",
        default="missing_diacritics",
        help="cache source: only apply this verdict class",
    )
    parser.add_argument(
        "--diacritics-only",
        dest="diacritics_only",
        action="store_true",
        default=None,
        help="apply only accent-only changes (default on for cache)",
    )
    parser.add_argument("--no-diacritics-only", dest="diacritics_only", action="store_false")
    args = parser.parse_args()

    diacritics_only = (
        args.diacritics_only if args.diacritics_only is not None else (args.source == "cache")
    )

    for lang in args.langs:
        if args.source == "cache":
            corrections = load_cache_corrections(lang, args.verdict)
        else:
            corrections = load_csv_corrections(lang)
        result = apply_lang(lang, corrections, diacritics_only)
        pruned = 0
        if args.source == "cache" and result["applied"]:
            pruned = prune_cache(lang, result["applied"])
        print(
            f"{lang}: applied {len(result['applied'])}, "
            f"skipped {len(result['skipped'])} "
            f"(of {len(corrections)} candidate corrections)"
            + (f"; pruned {pruned} cache entries (will re-verify)" if pruned else "")
        )
        for key, reason in result["skipped"][:20]:
            print(f"    skip [{reason}] {key}")


if __name__ == "__main__":
    main()
