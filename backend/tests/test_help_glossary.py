"""Tests for the help-glossary service + router (Phase 38).

Pins:
- ``list_entries`` returns a stable shape per language /
  category (key, title, short, long, category).
- The ``GET /api/help/glossary`` endpoint resolves lang
  fallbacks (unsupported lang -> en; ``de-DE`` -> ``de``).
- ``GET /api/help/glossary/{key}`` returns 404 (typed
  ``NotFoundError``) for missing keys.
- The ``concepts`` category contains exactly 4 entries (the
  Phase 38A.1 canonical set: curriculum, learning_project,
  learning_profile, learning_session). Future commits in 38A
  extend this without changing the existing key set; the test
  pins the existing keys but not the total count, so adding
  new categories does not break.
- Glossary YAML files have parity between DE and EN: every key
  in EN must exist in DE and vice versa.

Module-level cache: each test calls ``clear_cache`` in setup
+ teardown (autouse fixture) per the
``lessons-learned.md`` § "Module-level caches survive test
boundaries" rule.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.help_glossary import (
    CATEGORIES,
    SUPPORTED_LANGS,
    clear_cache,
    get_entry,
    list_entries,
)


@pytest.fixture(autouse=True)
def _reset_help_cache():
    clear_cache()
    yield
    clear_cache()


# --- Service-level pins -------------------------------------------------


def test_concepts_de_has_four_entries():
    entries = list_entries("de", category="concepts")
    keys = {e["key"] for e in entries}
    expected = {
        "curriculum",
        "learning_project",
        "learning_profile",
        "learning_session",
    }
    assert expected <= keys, f"missing expected concepts in DE: {expected - keys}"


def test_concepts_en_has_four_entries():
    entries = list_entries("en", category="concepts")
    keys = {e["key"] for e in entries}
    expected = {
        "curriculum",
        "learning_project",
        "learning_profile",
        "learning_session",
    }
    assert expected <= keys, f"missing expected concepts in EN: {expected - keys}"


def test_entry_shape_is_stable():
    entry = get_entry("curriculum", "en")
    assert entry is not None
    assert set(entry.keys()) == {"key", "title", "short", "long", "category"}
    assert entry["category"] == "concepts"
    assert isinstance(entry["title"], str) and entry["title"]
    assert isinstance(entry["short"], str) and entry["short"]
    assert isinstance(entry["long"], str) and entry["long"]


def test_get_entry_missing_returns_none():
    assert get_entry("does-not-exist", "en") is None


def test_long_text_is_markdown():
    """Spot-check: the long text contains Markdown structure
    (a heading). Pins that we don't accidentally flatten it
    to a single paragraph somewhere in the YAML walker."""
    entry = get_entry("curriculum", "de")
    assert entry is not None
    assert "## " in str(entry["long"])


def test_de_en_parity_concepts():
    de_keys = {e["key"] for e in list_entries("de", category="concepts")}
    en_keys = {e["key"] for e in list_entries("en", category="concepts")}
    assert de_keys == en_keys, (
        f"DE/EN drift in concepts:\n"
        f"  only in DE: {de_keys - en_keys}\n"
        f"  only in EN: {en_keys - de_keys}"
    )


def test_methods_has_six_entries():
    expected = {
        "method_deductive",
        "method_inductive",
        "method_error_based",
        "method_dialogic",
        "method_contextual",
        "method_ai_adaptive",
    }
    for lang in ("de", "en"):
        keys = {e["key"] for e in list_entries(lang, category="methods")}
        assert expected <= keys, (
            f"{lang}: missing methods entries: {expected - keys}"
        )


def test_de_en_parity_methods():
    de_keys = {e["key"] for e in list_entries("de", category="methods")}
    en_keys = {e["key"] for e in list_entries("en", category="methods")}
    assert de_keys == en_keys, (
        f"DE/EN drift in methods:\n"
        f"  only in DE: {de_keys - en_keys}\n"
        f"  only in EN: {en_keys - de_keys}"
    )


def test_steps_has_seven_entries():
    expected = {
        "step_input",
        "step_attempt",
        "step_error",
        "step_feedback",
        "step_adapt",
        "step_repeat",
        "step_integrate",
    }
    for lang in ("de", "en"):
        keys = {e["key"] for e in list_entries(lang, category="steps")}
        assert expected <= keys, (
            f"{lang}: missing steps entries: {expected - keys}"
        )


def test_de_en_parity_steps():
    de_keys = {e["key"] for e in list_entries("de", category="steps")}
    en_keys = {e["key"] for e in list_entries("en", category="steps")}
    assert de_keys == en_keys, (
        f"DE/EN drift in steps:\n"
        f"  only in DE: {de_keys - en_keys}\n"
        f"  only in EN: {en_keys - de_keys}"
    )


def test_features_has_five_entries():
    expected = {
        "feature_method_switch",
        "feature_auto_loop",
        "feature_spaced_repetition",
        "feature_conversation_analysis",
        "feature_gamification",
    }
    for lang in ("de", "en"):
        keys = {e["key"] for e in list_entries(lang, category="features")}
        assert expected <= keys, (
            f"{lang}: missing features entries: {expected - keys}"
        )


def test_de_en_parity_features():
    de_keys = {e["key"] for e in list_entries("de", category="features")}
    en_keys = {e["key"] for e in list_entries("en", category="features")}
    assert de_keys == en_keys, (
        f"DE/EN drift in features:\n"
        f"  only in DE: {de_keys - en_keys}\n"
        f"  only in EN: {en_keys - de_keys}"
    )


def test_list_entries_no_category_returns_all_22():
    """Pin: with no category filter, we get every entry across
    all four categories. The 22-count is the Phase 38A canonical
    total (4 concepts + 6 methods + 7 steps + 5 features)."""
    for lang in ("de", "en"):
        entries = list_entries(lang)
        assert len(entries) == 22, (
            f"{lang}: expected 22 entries (4+6+7+5), got {len(entries)}"
        )


# --- Phase 38F: passthrough parity for the 6 deferred languages --------


@pytest.mark.parametrize(
    "lang", ["es", "fr", "el", "pt", "tr", "ja"],
)
def test_passthrough_language_has_all_22_entries(lang: str):
    """Phase 38F — every secondary language has all four
    category bundles + the same 22 canonical keys as EN, even
    when the content is an EN passthrough. The actual
    translation lives in the ``HELP-CONTENT-TRANSLATIONS-01``
    backlog item; this pin protects against accidentally
    shipping a language with missing bundles."""
    entries = list_entries(lang)
    assert len(entries) == 22, (
        f"{lang}: expected 22 entries, got {len(entries)}"
    )

    en_keys = {e["key"] for e in list_entries("en")}
    lang_keys = {e["key"] for e in entries}
    assert lang_keys == en_keys, (
        f"{lang}: drift from EN. Missing: {en_keys - lang_keys}, "
        f"extra: {lang_keys - en_keys}"
    )


@pytest.mark.parametrize(
    "lang", ["es", "fr", "el", "pt", "tr", "ja"],
)
def test_passthrough_language_bundle_records_correct_language(lang: str):
    """The bundle's ``language`` field must reflect the file's
    suffix even on passthrough — otherwise the frontend
    loader thinks it's reading EN content and falls back
    silently. Catches "I forgot to stamp the language" mistakes."""
    from pathlib import Path

    import yaml

    help_dir = (
        Path(__file__).resolve().parent.parent / "config" / "help"
    )
    for category in ("concepts", "methods", "steps", "features"):
        path = help_dir / f"{category}.{lang}.yaml"
        assert path.exists(), f"{path} missing"
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        assert data["language"] == lang, (
            f"{path}: language stamped as {data['language']!r}, "
            f"expected {lang!r}"
        )


def test_categories_constant_covers_filesystem():
    """If a new YAML category lands on disk, CATEGORIES must
    grow to match. Pin so future glossary additions do not
    silently bypass the service walker."""
    from app.services.help_glossary import _help_dir

    on_disk = {p.stem.split(".")[0] for p in _help_dir().glob("*.yaml")}
    assert on_disk <= set(CATEGORIES), (
        f"YAML category on disk not in CATEGORIES: {on_disk - set(CATEGORIES)}"
    )


def test_supported_langs_is_eight():
    assert len(SUPPORTED_LANGS) == 8
    assert {"en", "de"} <= SUPPORTED_LANGS


# --- Router-level pins --------------------------------------------------


@pytest.fixture(name="client")
def _client():
    with TestClient(app) as c:
        yield c


def test_glossary_endpoint_returns_entries(client: TestClient):
    resp = client.get("/api/help/glossary?lang=en")
    assert resp.status_code == 200
    body = resp.json()
    assert body["lang"] == "en"
    assert isinstance(body["entries"], list)
    keys = {e["key"] for e in body["entries"]}
    assert "curriculum" in keys


def test_glossary_endpoint_category_filter(client: TestClient):
    resp = client.get("/api/help/glossary?lang=de&category=concepts")
    assert resp.status_code == 200
    body = resp.json()
    assert all(e["category"] == "concepts" for e in body["entries"])


def test_glossary_endpoint_unknown_lang_falls_back_to_en(client: TestClient):
    resp = client.get("/api/help/glossary?lang=xx")
    assert resp.status_code == 200
    assert resp.json()["lang"] == "en"


def test_glossary_endpoint_region_lang_falls_back(client: TestClient):
    """A request for ``de-DE`` should resolve to ``de``, not
    fall through to the EN default."""
    resp = client.get("/api/help/glossary?lang=de-DE")
    assert resp.status_code == 200
    assert resp.json()["lang"] == "de"


def test_glossary_entry_endpoint(client: TestClient):
    resp = client.get("/api/help/glossary/curriculum?lang=de")
    assert resp.status_code == 200
    body = resp.json()
    assert body["key"] == "curriculum"
    assert body["title"]


def test_glossary_entry_404(client: TestClient):
    resp = client.get("/api/help/glossary/missing?lang=en")
    assert resp.status_code == 404
    assert "missing" in resp.json()["detail"]
