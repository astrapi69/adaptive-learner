"""Unit tests for ``scripts/export_i18n_csv.py``.

Repo-level tooling (stdlib ``csv`` + PyYAML). Pins the per-language CSV
review export's pure logic: header shape, row building from catalogs +
status cache, the ``--flagged-only`` filter, and a writer/reader round-trip
that proves values with commas / newlines / quotes survive (TDD).
"""

from __future__ import annotations

import csv
import importlib.util
import io
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
_SCRIPT = REPO / "scripts" / "export_i18n_csv.py"

_spec = importlib.util.spec_from_file_location("export_i18n_csv", _SCRIPT)
assert _spec and _spec.loader
csvmod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(csvmod)


def test_header_includes_lang_and_correction():
    header = csvmod.csv_header("ja")
    assert header[0] == "key"
    assert header[1] == "de"
    assert "ja" in header
    assert header[-1] == "correction"
    assert "llm_verdict" in header and "llm_suggestion" in header


def test_rows_merge_catalog_and_status():
    de = {"a": "Willkommen", "b": "Fortschritt"}
    tgt = {"a": "ようこそ", "b": "進捗"}
    status = {
        "a": {"verdict": "ok", "severity": "low", "note": "", "suggestion": ""},
        "b": {"verdict": "wrong", "severity": "high", "note": "falsch",
              "suggestion": "別の語"},
    }
    rows = csvmod.csv_rows(de, tgt, status, lang="ja", flagged_only=False)
    by_key = {r[0]: r for r in rows}
    assert by_key["a"][1] == "Willkommen"
    assert by_key["a"][2] == "ようこそ"
    # the llm_verdict column reflects status
    header = csvmod.csv_header("ja")
    vi = header.index("llm_verdict")
    assert by_key["b"][vi] == "wrong"
    # correction column is always empty (reviewer fills it)
    assert by_key["a"][-1] == ""


def test_flagged_only_filters_ok_and_minor():
    de = {"a": "Willkommen", "b": "Fortschritt", "c": "Neu"}
    tgt = {"a": "Welcome", "b": "Progress", "c": "New"}
    status = {
        "a": {"verdict": "ok"},
        "b": {"verdict": "wrong"},
        "c": {"verdict": "minor"},
    }
    rows = csvmod.csv_rows(de, tgt, status, lang="en", flagged_only=True)
    assert {r[0] for r in rows} == {"b"}


def test_rows_handle_missing_status_entry():
    de = {"a": "Willkommen"}
    tgt = {"a": "Welcome"}
    rows = csvmod.csv_rows(de, tgt, {}, lang="en", flagged_only=False)
    header = csvmod.csv_header("en")
    vi = header.index("llm_verdict")
    assert rows[0][vi] == ""  # no status -> empty verdict, not a crash


def test_csv_roundtrip_survives_comma_newline_quote():
    header = csvmod.csv_header("es")
    de = {"a": 'Sag "Hallo", bitte', "b": "Zeile1\nZeile2"}
    tgt = {"a": 'Di "Hola", por favor', "b": "Linea1\nLinea2"}
    rows = csvmod.csv_rows(de, tgt, {}, lang="es", flagged_only=False)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)

    buf.seek(0)
    read = list(csv.reader(buf))
    assert read[0] == header
    read_by_key = {r[0]: r for r in read[1:]}
    assert read_by_key["a"][1] == 'Sag "Hallo", bitte'
    assert read_by_key["b"][1] == "Zeile1\nZeile2"
    assert read_by_key["a"][2] == 'Di "Hola", por favor'
