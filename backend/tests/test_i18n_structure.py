"""Structural consistency tests for the i18n YAMLs.

Skeleton state (Phase 1A): the catalogs carry only ``app`` and
``common`` sections; the Bibliogon-era ``ui.*`` section tree is gone.
What we still enforce:

1. Every language file loads as valid YAML with a dict at the root.
2. No PyYAML 1.1 bool key (``on:`` / ``off:`` would silently become
   ``True`` / ``False``).
3. EN carries both required root sections (``app``, ``common``).
4. The other languages mirror EN's root sections.

Leaf-key parity lives in ``test_i18n_parity.py``.
"""

from pathlib import Path

import pytest
import yaml

I18N_DIR = Path(__file__).resolve().parent.parent / "config" / "i18n"
REFERENCE = "en"
TRANSLATIONS = ["de", "es", "fr", "el", "pt", "tr", "ja", "hi", "ko", "id"]


def _load(lang: str) -> dict:
    path = I18N_DIR / f"{lang}.yaml"
    assert path.exists(), f"missing i18n file: {path}"
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def test_reference_loads_cleanly():
    doc = _load(REFERENCE)
    assert isinstance(doc, dict) and doc, "en.yaml root must be a non-empty dict"
    assert isinstance(doc.get("app"), dict), "en.yaml must carry an 'app' section"
    assert isinstance(doc.get("common"), dict), "en.yaml must carry a 'common' section"


@pytest.mark.parametrize("lang", TRANSLATIONS)
def test_no_bool_keys_anywhere(lang: str):
    """YAML 1.1 ``on: value`` becomes ``True: value``. Catch this in
    any section so we never lose a string-key again.
    """
    doc = _load(lang)

    def walk(node, path=""):
        if isinstance(node, dict):
            for k, v in node.items():
                assert not isinstance(k, bool), (
                    f"{lang}.yaml has a bool YAML key at {path or '<root>'}: "
                    f'{k!r} -> {v!r}. Quote the key as "{str(k).lower()}" '
                    f"to keep PyYAML from interpreting it as a YAML 1.1 bool."
                )
                walk(v, f"{path}.{k}" if path else str(k))

    walk(doc)


@pytest.mark.parametrize("lang", TRANSLATIONS)
def test_top_level_sections_match_reference(lang: str):
    """Every top-level section in EN must exist in every translation."""
    ref_sections = set(_load(REFERENCE).keys())
    lang_sections = set(_load(lang).keys())
    missing = ref_sections - lang_sections
    assert not missing, f"{lang}.yaml is missing top-level sections: {sorted(missing)}"
