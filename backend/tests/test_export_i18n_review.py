"""Unit tests for ``scripts/export_i18n_review.py``.

The script is repo-level tooling (stdlib + PyYAML, no ``app.*`` imports);
it is loaded via importlib so its pure helpers can be unit-tested without a
package install. The durable i18n correctness gate is ``test_i18n_*.py``;
these tests pin the export generator's own logic (TDD).
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
_SCRIPT = REPO / "scripts" / "export_i18n_review.py"

_spec = importlib.util.spec_from_file_location("export_i18n_review", _SCRIPT)
assert _spec and _spec.loader
exp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(exp)


def test_flatten_nested_dict_and_list():
    flat = exp.flatten({"a": {"b": "x"}, "c": ["p", "q"]})
    assert flat == {"a.b": "x", "c[0]": "p", "c[1]": "q"}


def test_flatten_scalar_root():
    assert exp.flatten("solo") == {"": "solo"}


def test_extract_placeholders():
    assert exp.extract_placeholders("Hi {name}, {n} left") == frozenset({"{name}", "{n}"})
    assert exp.extract_placeholders("no placeholders") == frozenset()
    assert exp.extract_placeholders(42) == frozenset()


def test_namespace():
    assert exp.namespace("content.header.title") == "content"
    assert exp.namespace("steps[0].body") == "steps"
    assert exp.namespace("flat") == "flat"


def test_list_cell_escapes_newline_and_marks_empty_null():
    assert exp.list_cell("de", "line1\nline2") == "- **de**: line1<br>line2"
    assert exp.list_cell("en", "") == "- **en**: _(empty)_"
    assert exp.list_cell("fr", None) == "- **fr**: _(null)_"
    # a literal pipe is fine in list form (no escaping needed)
    assert exp.list_cell("es", "a | b") == "- **es**: a | b"


def test_is_trivial():
    assert exp._is_trivial("OK") is True  # too short
    assert exp._is_trivial("{n}") is True  # pure placeholder
    assert exp._is_trivial("123 %") is True  # no letters
    assert exp._is_trivial("Willkommen") is False  # real word


def _catalogs():
    # de = source of truth; one missing key in fr, one placeholder swallowed in
    # es, one empty in tr, one untranslated (== de) in pt, mojibake in id.
    return {
        "de": {"a.hi": "Hallo {name}", "a.bye": "Tschüss", "b.x": "Wort"},
        "en": {"a.hi": "Hello {name}", "a.bye": "Bye", "b.x": "Word"},
        "fr": {"a.hi": "Bonjour {name}", "b.x": "Mot"},  # missing a.bye
        "es": {"a.hi": "Hola", "a.bye": "Adios", "b.x": "Palabra"},  # lost {name}
        "el": {"a.hi": "Γεια {name}", "a.bye": "Αντίο", "b.x": "Λέξη"},
        "hi": {"a.hi": "नमस्ते {name}", "a.bye": "अलविदा", "b.x": "शब्द"},
        "id": {"a.hi": "Halo {name}", "a.bye": "D�a", "b.x": "Kata"},  # mojibake
        "ja": {"a.hi": "こんにちは {name}", "a.bye": "さようなら", "b.x": "言葉"},
        "ko": {"a.hi": "안녕 {name}", "a.bye": "안녕히", "b.x": "단어"},
        "pt": {"a.hi": "Olá {name}", "a.bye": "Tschüss", "b.x": "Palavra"},  # == de
        "tr": {"a.hi": "Merhaba {name}", "a.bye": "  ", "b.x": "Kelime"},  # empty
    }


def test_analyze_parity_detects_missing_key():
    findings = exp.analyze(_catalogs(), exp.LANGS, "en", "de")
    assert findings["parity"]["fr"]["missing"] == ["a.bye"]
    assert findings["parity"]["fr"]["extra"] == []
    assert findings["parity"]["de"]["missing"] == []


def test_analyze_placeholder_mismatch():
    findings = exp.analyze(_catalogs(), exp.LANGS, "en", "de")
    swallowed = [(k, lang) for k, lang, _s, _l in findings["placeholder_mismatches"]]
    # es dropped {name} from a.hi (vs the DE source) -> the one real mismatch
    assert ("a.hi", "es") in swallowed
    # a.bye has NO placeholders in DE, so fr missing it is a parity finding,
    # not a placeholder mismatch (both placeholder sets are empty).
    assert ("a.bye", "fr") not in swallowed


def test_analyze_empty_and_mojibake_and_untranslated():
    findings = exp.analyze(_catalogs(), exp.LANGS, "en", "de")
    assert ("tr", "a.bye") in findings["empties"]
    assert any(lang == "id" for lang, _k, _s in findings["mojibake"])
    # pt a.bye == de "Tschüss" (non-trivial) -> untranslated suspect
    assert "a.bye" in findings["untranslated"]["pt"]


def test_split_namespaces_keeps_namespaces_whole():
    ns_order = ["a", "b", "c"]
    ns_keys = {"a": ["a.1", "a.2"], "b": ["b.1", "b.2", "b.3"], "c": ["c.1"]}
    parts = exp.split_namespaces(ns_order, ns_keys, target=3)
    # a (2) then b would exceed 3 -> b starts a new part; c packs after b (4>3? no,
    # c added to b's part only if <= target; b=3 already so c starts/packs per greedy)
    flat = [ns for part_ns, _keys in parts for ns in part_ns]
    assert flat == ns_order  # every namespace present, order preserved
    # no namespace split across parts: each part's keys are a concatenation of
    # whole namespaces
    for part_ns, keys in parts:
        expected = [k for ns in part_ns for k in ns_keys[ns]]
        assert keys == expected


def test_render_key_block_lists_all_langs_de_first():
    block = exp.render_key_block("a.hi", _catalogs(), exp.LANGS)
    lines = block.splitlines()
    assert lines[0] == "### `a.hi`"
    assert lines[1] == "- **de**: Hallo {name}"
    assert lines[2] == "- **en**: Hello {name}"
    assert lines[3].startswith("- **el**")  # then the rest


def test_build_writes_files(tmp_path):
    out = tmp_path / "review"
    result = exp.build(out, stamp="test @ abc123")
    assert (out / "00-analysis.md").exists()
    # tiny synthetic-free real run: uses the real catalogs, so it should split
    # or single — either way at least one body file + analysis exists.
    assert result["keys"] > 0
    assert any((out / name).exists() for name in result["files"])
