"""Unit tests for ``scripts/i18n_quality_check.py``.

Repo-level tooling (stdlib + PyYAML; the Anthropic client is imported
lazily only when the API is actually called, so this module loads without
the ``anthropic`` package). The durable i18n correctness gate stays in
``test_i18n_*.py``; these tests pin the quality-check generator's own pure
logic (TDD). The LLM call itself is never exercised here.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
_SCRIPT = REPO / "scripts" / "i18n_quality_check.py"

_spec = importlib.util.spec_from_file_location("i18n_quality_check", _SCRIPT)
assert _spec and _spec.loader
qc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(qc)


def test_de_hash_is_deterministic_and_value_sensitive():
    assert qc.de_hash("Hallo Welt") == qc.de_hash("Hallo Welt")
    assert qc.de_hash("Hallo Welt") != qc.de_hash("Hallo  Welt")
    # stable hex string, short
    h = qc.de_hash("x")
    assert isinstance(h, str) and len(h) == 12 and all(c in "0123456789abcdef" for c in h)


def test_review_items_skips_trivial_and_missing_target():
    de = {"a": "Willkommen", "b": "OK", "c": "Fortschritt", "d": "Nur DE"}
    tgt = {"a": "Welcome", "b": "OK", "c": "Progress"}  # no "d"
    items = qc.review_items(de, tgt)
    keys = {it["key"] for it in items}
    assert keys == {"a", "c"}  # b trivial (too short), d missing in target
    by_key = {it["key"]: it for it in items}
    assert by_key["a"]["de"] == "Willkommen"
    assert by_key["a"]["target"] == "Welcome"


def test_partition_keys_skips_matching_hash_and_rechecks_changed():
    items = [
        {"key": "a", "de": "Willkommen", "target": "Welcome"},
        {"key": "b", "de": "Fortschritt", "target": "Progress"},
        {"key": "c", "de": "Neu", "target": "Nuevo"},
    ]
    cache = {
        "a": {"de_hash": qc.de_hash("Willkommen"), "verdict": "ok"},
        "b": {"de_hash": qc.de_hash("ALT"), "verdict": "ok"},  # DE changed -> recheck
        # c absent -> recheck
    }
    to_check, skipped = qc.partition_keys(items, cache, force=False)
    assert {it["key"] for it in to_check} == {"b", "c"}
    assert {it["key"] for it in skipped} == {"a"}
    # force re-checks everything
    to_check_f, skipped_f = qc.partition_keys(items, cache, force=True)
    assert len(to_check_f) == 3 and skipped_f == []


def test_chunk_splits_evenly():
    assert qc.chunk([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]
    assert qc.chunk([], 2) == []


def test_build_prompt_contains_lang_keys_and_source():
    items = [{"key": "a.b", "de": "Hallo {name}", "target": "Bonjour {name}"}]
    messages = qc.build_prompt("fr", items)
    assert isinstance(messages, list) and messages[0]["role"] == "system"
    blob = "\n".join(m["content"] for m in messages)
    assert "fr" in blob and "a.b" in blob and "Hallo {name}" in blob


def test_parse_verdicts_happy_path_with_code_fence():
    payload = {
        "a": {"verdict": "ok", "severity": "low", "note": "", "suggestion": ""},
        "b": {"verdict": "missing_diacritics", "severity": "medium",
              "note": "à fehlt", "suggestion": "à toi"},
    }
    text = "Here you go:\n```json\n" + json.dumps(payload) + "\n```\n"
    out = qc.parse_verdicts(text, ["a", "b"])
    assert out["a"]["verdict"] == "ok"
    assert out["b"]["verdict"] == "missing_diacritics"
    assert out["b"]["suggestion"] == "à toi"


def test_parse_verdicts_malformed_marks_all_needs_recheck():
    out = qc.parse_verdicts("not json at all", ["a", "b"])
    assert out["a"]["verdict"] == "needs_recheck"
    assert out["b"]["verdict"] == "needs_recheck"


def test_parse_verdicts_missing_or_unknown_key_falls_back():
    text = json.dumps({"a": {"verdict": "wrong"}, "b": {"verdict": "banana"}})
    out = qc.parse_verdicts(text, ["a", "b", "c"])
    assert out["a"]["verdict"] == "wrong"
    assert out["b"]["verdict"] == "needs_recheck"  # unknown verdict coerced
    assert out["c"]["verdict"] == "needs_recheck"  # key absent in response


def test_needs_escalation():
    assert qc.needs_escalation({"verdict": "wrong", "severity": "low"}) is True
    assert qc.needs_escalation({"verdict": "untranslated", "severity": "low"}) is True
    assert qc.needs_escalation({"verdict": "placeholder_mismatch", "severity": "low"}) is True
    assert qc.needs_escalation({"verdict": "needs_recheck", "severity": "low"}) is True
    assert qc.needs_escalation({"verdict": "minor", "severity": "high"}) is True
    assert qc.needs_escalation({"verdict": "ok", "severity": "low"}) is False
    assert qc.needs_escalation({"verdict": "minor", "severity": "low"}) is False


def test_merge_verdict_opus_overrides_and_records_both():
    tier1 = {"verdict": "wrong", "severity": "high", "note": "s1", "suggestion": ""}
    tier2 = {"verdict": "minor", "severity": "low", "note": "actually fine", "suggestion": ""}
    merged = qc.merge_verdict(tier1, tier2, tier1_model="sonnet", tier2_model="opus")
    assert merged["verdict"] == "minor"  # opus wins
    assert merged["tier1_verdict"] == "wrong"
    assert merged["tier2_verdict"] == "minor"
    assert merged["tier1_model"] == "sonnet"
    assert merged["tier2_model"] == "opus"


def test_status_entry_carries_hash_and_stamp():
    item = {"key": "a", "de": "Willkommen", "target": "Welcome"}
    verdict = {"verdict": "ok", "severity": "low", "note": "", "suggestion": "",
               "tier1_model": "sonnet", "tier1_verdict": "ok"}
    entry = qc.status_entry(item, verdict, checked_at="2026-06-30T00:00:00Z")
    assert entry["de_hash"] == qc.de_hash("Willkommen")
    assert entry["verdict"] == "ok"
    assert entry["checked_at"] == "2026-06-30T00:00:00Z"


def test_summarize_counts_verdicts_and_flagged():
    verdicts = {
        "a": {"verdict": "ok"},
        "b": {"verdict": "ok"},
        "c": {"verdict": "wrong"},
        "d": {"verdict": "missing_diacritics"},
        "e": {"verdict": "minor"},
    }
    stats = qc.summarize(verdicts)
    assert stats["counts"]["ok"] == 2
    assert stats["counts"]["wrong"] == 1
    assert stats["flagged"] == 2  # wrong + missing_diacritics (minor/ok are not flagged)
    assert stats["total"] == 5
