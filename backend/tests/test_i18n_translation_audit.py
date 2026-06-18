"""Translation quality audit (v1.13.0 / Phase 26D).

Pins the Phase 26 PT/TR/JA translation pass against drift:

1. No EN-passthrough strings sneak back into pt/tr/ja catalogs.
   A heuristic looks for common English markers ("the", "of",
   "with", "from", etc.) appearing as whole words in values
   that should be in the target language. A small allowlist
   covers brand names + technical tokens (Adaptive Learner,
   ChatGPT, JSON, ...) that don't translate.

2. Assessment questions carry a full ``text_<lang>`` for every
   one of the 12 question texts AND every one of the 48 answer
   texts in each of pt/tr/ja.

3. Every newly-supported language (pt, tr, ja) is registered
   in the assessment plugin's ``_LANG_TO_KEY`` map.

The catalog-shape parity is already covered by
``test_i18n_parity.py``; this file only adds the new
"is it actually translated?" checks.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

I18N_DIR = Path(__file__).resolve().parent.parent / "config" / "i18n"
PHASE26_LANGS = ["pt", "tr", "ja"]

# Whole-word EN markers that should NOT appear in pt/tr/ja
# values. Each word is a strong signal that an EN string was
# left behind by accident. The check is whole-word + case
# sensitive (lowercased input vs lowercased marker).
EN_MARKERS = {
    "the",
    " of ",
    " from ",
    " with ",
    " your ",
    " could ",
    " would ",
    " please ",
    " loading ",
    " saved ",
    " error ",
    " back ",  # common preposition
    " next ",
    " start ",
    " continue ",
    " done ",
    " confirm ",
    " cancel ",
    " unknown ",
    " click ",
    " open ",
    " close ",
    " show ",
    " hide ",
    " choose ",
    " select ",
}

# Tokens that are EN-by-design (brand names, technical
# identifiers, file extensions, URL fragments, units). These
# may appear verbatim in any catalog and don't count as
# EN-passthrough.
EN_ALLOWED_TOKENS = {
    "adaptive learner",
    "continue",  # valid word in PT/ES/FR — not an EN passthrough
    "anthropic claude",
    "openai gpt",
    "google gemini",
    "chatgpt",
    "claude",
    "gemini",
    "fastapi",
    "sqlite",
    "indexeddb",
    "openai",
    "json",
    "github",
    "liberapay",
    "ko-fi",
    "kofi",
    # i18n interpolation placeholders — never English content.
    "{theory}",
    "{exercises}",
    "{minutes}",
    "{steps}",
    "{theory_steps}",
    # Short technical abbreviations (md, ai, qr, ip, url, api,
    # pwa, txt, pdf, yz) are intentionally NOT in this set — they
    # are too short to substring-replace safely and the EN_MARKERS
    # set never contains them.
}


_PLACEHOLDER_RE = re.compile(r"\{[^}]*\}")


def _strip_allowed_tokens(value: str) -> str:
    """Remove placeholders and brand / technical tokens before
    scanning for EN markers.

    ``{...}`` placeholders are stripped wholesale first: their names
    are not translatable text, and a marker can otherwise match a
    substring inside one (e.g. the ``"the"`` marker inside
    ``{other}``). This is the generic fix for the per-placeholder
    allowlist entries that a new placeholder would otherwise have to
    be added to one-by-one (#745).

    Then brand / technical tokens are removed so "OpenAI GPT" doesn't
    trip the "open" false positive. Longest tokens replaced first so
    'openai gpt' wins over 'openai' when both would match.
    """
    lowered = _PLACEHOLDER_RE.sub(" ", value.lower())
    for token in sorted(EN_ALLOWED_TOKENS, key=len, reverse=True):
        lowered = lowered.replace(token, " ")
    return lowered


def _load(lang: str) -> dict:
    path = I18N_DIR / f"{lang}.yaml"
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _flatten(value, prefix: str = "") -> dict[str, object]:
    out: dict[str, object] = {}
    if isinstance(value, dict):
        for k, v in value.items():
            key = f"{prefix}{k}"
            if isinstance(v, dict):
                out.update(_flatten(v, key + "."))
            else:
                out[key] = v
    return out


# --- 1. No EN passthrough ----------------------------------------------


@pytest.mark.parametrize("lang", PHASE26_LANGS)
def test_no_en_passthrough_markers(lang: str):
    """Spot-check: no obvious EN words appear as standalone tokens
    in the translated values. The check is heuristic + has a
    small allowlist for brand names; false positives are fixed
    by adding the token to ``EN_ALLOWED_TOKENS``."""
    flat = _flatten(_load(lang))
    hits: list[tuple[str, str, str]] = []
    for key, raw in flat.items():
        if not isinstance(raw, str):
            continue
        cleaned = " " + _strip_allowed_tokens(raw) + " "
        for marker in EN_MARKERS:
            # Whole-word containment after token stripping.
            if marker in cleaned:
                hits.append((key, marker.strip(), raw))
                break  # one marker per key is enough
    assert not hits, (
        f"{lang}: {len(hits)} value(s) contain EN-passthrough markers. "
        "Translate or add the token to EN_ALLOWED_TOKENS if it's a brand "
        "name.\n"
        + "\n".join(f"  - {k}  (marker={m!r}): {v!r}" for k, m, v in hits[:20])
    )


def test_placeholders_do_not_trip_en_markers():
    """Regression (#745): a marker substring inside a ``{...}``
    placeholder must NOT count as an EN passthrough. The ``"the"``
    marker lived inside ``{other}`` (``content.quality.duplicate.
    problem``), which failed ja/pt/tr until placeholders were
    stripped before the scan."""
    cleaned = " " + _strip_allowed_tokens("次の重複: {other}") + " "
    assert "{other}" not in cleaned
    assert "the" not in cleaned.replace(" ", "")


@pytest.mark.parametrize("lang", PHASE26_LANGS)
def test_values_are_not_identical_to_en(lang: str):
    """Verify the catalog actually diverges from EN. We tolerate
    a small overlap for proper nouns + technical identifiers
    (Anthropic Claude, OpenAI GPT, the app name itself, etc.),
    capped at 10% of values."""
    target = _flatten(_load(lang))
    reference = _flatten(_load("en"))
    identical = 0
    total = 0
    for key, en_value in reference.items():
        if not isinstance(en_value, str):
            continue
        tgt_value = target.get(key)
        if not isinstance(tgt_value, str):
            continue
        total += 1
        if tgt_value == en_value:
            identical += 1
    pct = identical / total if total else 0
    assert pct < 0.10, (
        f"{lang}: {identical}/{total} ({pct:.0%}) values are byte-identical "
        f"to EN. Expected <10% (proper nouns + technical tokens only)."
    )


# --- 2. Assessment translation completeness ---------------------------


@pytest.mark.parametrize("lang", PHASE26_LANGS)
def test_assessment_questions_carry_text_lang_field(lang: str):
    """Every one of the 12 question texts AND each of the 48
    answer texts must carry a ``text_<lang>`` field, non-empty
    and not equal to its EN counterpart."""
    from adaptive_learner_assessment.questions import QUESTIONS

    key = f"text_{lang}"
    missing: list[str] = []
    identical: list[str] = []
    for q in QUESTIONS:
        qid = q["id"]
        if key not in q or not str(q.get(key, "")).strip():
            missing.append(f"question {qid}")
        elif q[key] == q["text_en"]:
            identical.append(f"question {qid}")
        for ans in q["answers"]:
            aid = ans["id"]
            if key not in ans or not str(ans.get(key, "")).strip():
                missing.append(f"answer {qid}/{aid}")
            elif ans[key] == ans["text_en"]:
                identical.append(f"answer {qid}/{aid}")
    assert not missing, (
        f"{lang}: missing {key} on {len(missing)} entries:\n"
        + "\n".join(f"  - {m}" for m in missing[:10])
    )
    assert not identical, (
        f"{lang}: {key} is byte-identical to text_en on "
        f"{len(identical)} entries — that means the translation "
        f"is missing or a stray copy.\n"
        + "\n".join(f"  - {e}" for e in identical[:10])
    )


# --- 3. _LANG_TO_KEY registration -------------------------------------


@pytest.mark.parametrize("lang", PHASE26_LANGS)
def test_lang_registered_in_assessment_lang_to_key(lang: str):
    """The assessment plugin's ``_LANG_TO_KEY`` map must include
    each newly-supported language; otherwise the resolver
    silently falls back to EN even when the field exists."""
    from adaptive_learner_assessment.questions import _LANG_TO_KEY

    assert lang in _LANG_TO_KEY, (
        f"{lang} is missing from _LANG_TO_KEY. Add a row mapping "
        f"{lang!r} -> 'text_{lang}'."
    )
    assert _LANG_TO_KEY[lang] == f"text_{lang}", (
        f"{lang} maps to {_LANG_TO_KEY[lang]!r} but should map to "
        f"'text_{lang}'."
    )
