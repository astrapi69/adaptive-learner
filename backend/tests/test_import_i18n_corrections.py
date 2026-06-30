"""Unit tests for ``scripts/import_i18n_corrections.py`` (the i18n write-back
tool, #1296). Loaded via importlib; pure helpers tested without touching the
real catalogs. The diacritics guard is the safety-critical piece.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
_SCRIPT = REPO / "scripts" / "import_i18n_corrections.py"
_spec = importlib.util.spec_from_file_location("import_i18n_corrections", _SCRIPT)
assert _spec and _spec.loader
imp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(imp)


def test_strip_accents():
    assert imp.strip_accents("État") == "Etat"
    assert imp.strip_accents("modèles") == "modeles"
    assert imp.strip_accents("añadir") == "anadir"
    assert imp.strip_accents("página") == "pagina"


def test_is_diacritics_only_true_for_accent_restoration():
    assert imp.is_diacritics_only("Etat squelette", "État squelette")
    assert imp.is_diacritics_only("modeles", "modèles")
    assert imp.is_diacritics_only("anadir", "añadir")


def test_is_diacritics_only_false_for_content_change():
    # added opening ¿ is punctuation, not a diacritic -> must NOT auto-apply
    assert not imp.is_diacritics_only("Como estas?", "¿Cómo estás?")
    # reworded / added word
    assert not imp.is_diacritics_only("Export", "Exportation")
    # identical -> nothing to do
    assert not imp.is_diacritics_only("café", "café")
    # NFD (not NFKD): an ellipsis swap is typography, NOT a diacritic, and
    # must NOT auto-apply (NFKD would wrongly fold … -> ...).
    assert not imp.is_diacritics_only("Analyse en cours...", "Analyse en cours…")
    # case change is not a diacritic -> must NOT auto-apply
    assert not imp.is_diacritics_only("errores", "Errores")
    assert not imp.is_diacritics_only("Práctica de Pronunciación", "Práctica de pronunciación")
    # Latin-only guard: Devanagari matra/anusvara changes the vowel/word, NOT a
    # cosmetic accent -> must NOT auto-apply (route to native review).
    assert not imp.is_diacritics_only("स्पेनिश", "स्पैनिश")  # spenish -> spainish (े->ै)
    assert not imp.is_diacritics_only("बनाएं", "बनाएँ")  # anusvara -> chandrabindu


def test_get_set_by_path():
    data = {"a": {"b": {"c": "old"}}}
    assert imp.get_by_path(data, "a.b.c") == "old"
    assert imp.get_by_path(data, "a.b.missing") is None
    assert imp.set_by_path(data, "a.b.c", "new") is True
    assert data["a"]["b"]["c"] == "new"
    # absent path is not created
    assert imp.set_by_path(data, "a.x.y", "z") is False
    # indexed paths unsupported (skipped, not crashed)
    assert imp.get_by_path(data, "a.b[0]") is None
    assert imp.set_by_path(data, "a.b[0]", "z") is False


def test_apply_lang_only_changes_diacritics(tmp_path, monkeypatch):
    # a tiny catalog with one accent-fixable value and one content-change value
    cat = tmp_path / "fr.yaml"
    cat.write_text(
        'common:\n  done: "Termine"\napp:\n  skeleton: "Etat squelette"\n  export: "Export"\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(imp, "I18N_DIR", tmp_path)
    corrections = {
        "app.skeleton": "État squelette",  # diacritics-only -> apply
        "app.export": "Exportation",  # content change -> skip under guard
        "common.done": "Terminé",  # diacritics-only (e->é) -> apply
    }
    result = imp.apply_lang("fr", corrections, diacritics_only=True)
    assert set(result["applied"]) == {"app.skeleton", "common.done"}
    assert ("app.export", "not-diacritics-only") in result["skipped"]
    text = cat.read_text(encoding="utf-8")
    assert "État squelette" in text
    assert "Terminé" in text
    assert "Export" in text and "Exportation" not in text  # guard held


def test_prune_cache_removes_applied_keys(tmp_path, monkeypatch):
    import json as _json

    status = tmp_path
    (status / "fr.json").write_text(
        _json.dumps(
            {
                "app.skeleton": {"verdict": "missing_diacritics"},
                "app.export": {"verdict": "wrong"},
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(imp, "STATUS_DIR", status)
    removed = imp.prune_cache("fr", ["app.skeleton", "app.absent"])
    assert removed == 1
    remaining = _json.loads((status / "fr.json").read_text(encoding="utf-8"))
    assert "app.skeleton" not in remaining  # re-verified next run
    assert "app.export" in remaining  # untouched
    # absent cache is a no-op, not a crash
    assert imp.prune_cache("xx", ["whatever"]) == 0
