"""Pure-unit tests for the card extraction parser + vocabulary
transform (Phase 30B + 30D)."""

from __future__ import annotations

import json

from adaptive_learner_anki.card_extraction import (
    ExtractedCard,
    _cards_from_vocabulary,
    build_prompt,
    parse_response,
)


# --- build_prompt --------------------------------------------------------


def test_build_prompt_includes_content() -> None:
    p = build_prompt("USER: Hello\nASSISTANT: Hi", limit=4)
    assert "Hello" in p
    assert "Hi" in p


def test_build_prompt_clips_long_content() -> None:
    long = "x" * 12000
    p = build_prompt(long)
    # Material section clipped to 8000 chars (per the helper).
    assert "x" * 8001 not in p


# --- parse_response: happy path -----------------------------------------


def test_parse_valid_json_array() -> None:
    raw = """[
        {"type": "basic", "front": "Q1", "back": "A1", "tags": ["t1"]},
        {"type": "cloze", "front": "{{c1::word}}", "back": "", "tags": []}
    ]"""
    cards = parse_response(raw)
    assert len(cards) == 2
    assert cards[0].card_type == "basic"
    assert cards[0].front == "Q1"
    assert cards[0].back == "A1"
    assert cards[0].tags == ["t1"]
    assert cards[1].card_type == "cloze"


def test_parse_strips_markdown_fence() -> None:
    # Models occasionally wrap JSON in ```json ... ``` despite
    # the prompt asking them not to. The parser tolerates it.
    raw = "```json\n[{\"type\":\"basic\",\"front\":\"Q\",\"back\":\"A\"}]\n```"
    cards = parse_response(raw)
    assert len(cards) == 1
    assert cards[0].front == "Q"


# --- parse_response: defensive paths ------------------------------------


def test_parse_empty_string_returns_empty_list() -> None:
    assert parse_response("") == []


def test_parse_non_json_returns_empty_list() -> None:
    # AI hiccup that produces prose. Must not crash the
    # session-end flow.
    assert parse_response("Sorry, I cannot do that.") == []


def test_parse_non_list_returns_empty_list() -> None:
    # If the model returns a single object instead of an array,
    # treat as empty rather than guessing.
    assert parse_response('{"type":"basic","front":"X","back":"Y"}') == []


def test_parse_skips_invalid_card_types() -> None:
    raw = json.dumps(
        [
            {"type": "basic", "front": "OK", "back": "A"},
            {"type": "weird", "front": "skip me", "back": "B"},
            {"type": "BASIC", "front": "still ok", "back": "C"},  # case-insensitive
        ]
    )
    cards = parse_response(raw)
    assert [c.card_type for c in cards] == ["basic", "basic"]
    assert [c.front for c in cards] == ["OK", "still ok"]


def test_parse_skips_empty_front() -> None:
    raw = json.dumps(
        [
            {"type": "basic", "front": "", "back": "A"},
            {"type": "basic", "front": "   ", "back": "B"},
            {"type": "basic", "front": "good", "back": "C"},
        ]
    )
    cards = parse_response(raw)
    assert len(cards) == 1
    assert cards[0].front == "good"


def test_parse_defaults_missing_back_to_empty() -> None:
    raw = json.dumps([{"type": "cloze", "front": "{{c1::x}}"}])
    cards = parse_response(raw)
    assert cards[0].back == ""


def test_parse_normalises_tags_to_lowercase_strings() -> None:
    raw = json.dumps(
        [
            {
                "type": "basic",
                "front": "x",
                "back": "y",
                "tags": ["VERB", " Present ", 42, "", None],
            }
        ]
    )
    cards = parse_response(raw)
    # 42 becomes "42"; None is dropped; empty/whitespace dropped.
    assert cards[0].tags == ["verb", "present", "42"]


# --- _cards_from_vocabulary (Phase 30D) ---------------------------------


def test_vocabulary_with_example_produces_cloze() -> None:
    # Example must contain the EXACT word (not a conjugated
    # form). If the AI returns an example with only a conjugated
    # form, we fall back to a basic card — that's intentional
    # since blanking the wrong word would produce a misleading
    # cloze.
    entries = [
        {
            "word": "comer",
            "translation": "to eat",
            "example": "Me gusta comer pan por la mañana.",
            "tags": ["verb", "infinitive"],
        }
    ]
    cards = _cards_from_vocabulary(entries)
    assert len(cards) == 1
    card = cards[0]
    assert card.card_type == "cloze"
    assert "{{c1::" in card.front
    assert card.back == "to eat"
    # 'vocabulary' tag auto-added.
    assert "vocabulary" in card.tags
    assert "verb" in card.tags


def test_vocabulary_falls_back_to_basic_when_example_lacks_word() -> None:
    # Conjugated form in the example — we can't safely identify
    # the right span to cloze, so we fall back to a plain
    # front/back card.
    entries = [
        {
            "word": "hablar",
            "translation": "to speak",
            "example": "Yo hablo espanol todos los dias.",
            "tags": ["verb"],
        }
    ]
    cards = _cards_from_vocabulary(entries)
    assert len(cards) == 1
    assert cards[0].card_type == "basic"
    assert cards[0].front == "hablar"
    assert cards[0].back == "to speak"


def test_vocabulary_without_example_produces_basic() -> None:
    entries = [{"word": "hello", "translation": "hola"}]
    cards = _cards_from_vocabulary(entries)
    assert len(cards) == 1
    assert cards[0].card_type == "basic"
    assert cards[0].front == "hello"
    assert cards[0].back == "hola"


def test_vocabulary_phonetic_appears_in_back() -> None:
    entries = [
        {
            "word": "rendezvous",
            "translation": "appointment",
            "phonetic": "ʁɑ̃devu",
        }
    ]
    cards = _cards_from_vocabulary(entries)
    assert "ʁɑ̃devu" in cards[0].back
    assert "appointment" in cards[0].back


def test_vocabulary_skips_malformed_entries() -> None:
    entries = [
        {"word": "ok", "translation": "fine"},
        {"word": "", "translation": "no front"},
        {"word": "no translation", "translation": ""},
        "not a dict",  # type: ignore[list-item]
        {"missing": "word"},
    ]
    cards = _cards_from_vocabulary(entries)  # type: ignore[arg-type]
    assert len(cards) == 1
    assert cards[0].front == "ok"


def test_vocabulary_cloze_is_case_insensitive() -> None:
    # The example uses a different case than the word; the
    # regex should still match.
    entries = [
        {
            "word": "Word",
            "translation": "x",
            "example": "this word is important",
        }
    ]
    cards = _cards_from_vocabulary(entries)
    assert cards[0].card_type == "cloze"
    assert "{{c1::Word}}" in cards[0].front


def test_extracted_card_dataclass_roundtrip() -> None:
    c = ExtractedCard(
        card_type="basic", front="a", back="b", tags=["t"]
    )
    assert c.card_type == "basic"
    assert c.front == "a"
    assert c.back == "b"
    assert c.tags == ["t"]
