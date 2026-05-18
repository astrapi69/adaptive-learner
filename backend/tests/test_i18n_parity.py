"""i18n parity test.

Every translation catalog must mirror EN's key structure, carry
non-empty values, and use the same ``{placeholder}`` set per key.

Failure messages are actionable: they name the key, the language, and
what to fix. The Bibliogon-era review-status _meta marker is gone; the
skeleton catalogs are short enough that "review status" doesn't yet
need a machine-checked marker. Re-introduce one when DE/EN grow past
maintainer-validated size again.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

I18N_DIR = Path(__file__).resolve().parent.parent / "config" / "i18n"
REFERENCE_LANG = "en"
TARGET_LANGS = ["de", "es", "fr", "el", "pt", "tr", "ja"]
PLACEHOLDER_RE = re.compile(r"\{[a-z_][a-z0-9_]*\}")


def _flatten(value: object, prefix: str = "") -> dict[str, object]:
    out: dict[str, object] = {}
    if isinstance(value, dict):
        for k, v in value.items():
            key = f"{prefix}{k}"
            if isinstance(v, dict):
                out.update(_flatten(v, key + "."))
            else:
                out[key] = v
    return out


def _load(lang: str) -> dict[str, object]:
    path = I18N_DIR / f"{lang}.yaml"
    assert path.exists(), f"Missing i18n file: {path}"
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return raw if isinstance(raw, dict) else {}


@pytest.fixture(scope="module")
def reference() -> dict[str, object]:
    return _flatten(_load(REFERENCE_LANG))


@pytest.fixture(scope="module")
def reference_raw() -> dict[str, object]:
    return _load(REFERENCE_LANG)


@pytest.mark.parametrize("target_lang", TARGET_LANGS)
def test_no_missing_keys(target_lang: str, reference: dict[str, object]) -> None:
    """Every key in EN must exist in the target language."""
    target = _flatten(_load(target_lang))
    missing = sorted(set(reference) - set(target))
    assert not missing, (
        f"{target_lang}: {len(missing)} key(s) present in {REFERENCE_LANG} but missing in "
        f"{target_lang}. Fix: add the following keys to backend/config/i18n/{target_lang}.yaml:\n"
        + "\n".join(f"  - {k}" for k in missing[:20])
    )


@pytest.mark.parametrize("target_lang", TARGET_LANGS)
def test_no_extra_keys(target_lang: str, reference: dict[str, object]) -> None:
    """Target language must not carry keys that are absent from EN."""
    target = _flatten(_load(target_lang))
    extra = sorted(set(target) - set(reference))
    assert not extra, (
        f"{target_lang}: {len(extra)} key(s) exist in {target_lang} but not in "
        f"{REFERENCE_LANG}. Likely a typo or leftover. Fix: remove from "
        f"backend/config/i18n/{target_lang}.yaml OR add to {REFERENCE_LANG}.yaml:\n"
        + "\n".join(f"  - {k}" for k in extra[:20])
    )


@pytest.mark.parametrize("lang", [REFERENCE_LANG, *TARGET_LANGS])
def test_no_empty_values(lang: str) -> None:
    """No translation value may be empty, None, or whitespace-only."""
    flat = _flatten(_load(lang))
    empties = [k for k, v in flat.items() if v is None or (isinstance(v, str) and not v.strip())]
    assert not empties, (
        f"{lang}: {len(empties)} empty value(s) in backend/config/i18n/{lang}.yaml:\n"
        + "\n".join(f"  - {k}" for k in empties[:20])
    )


@pytest.mark.parametrize("target_lang", TARGET_LANGS)
def test_structural_parity(target_lang: str, reference_raw: dict[str, object]) -> None:
    """If EN has a nested dict at a path, the target must also have a nested dict there."""
    target_raw = _load(target_lang)

    def walk(ref: object, tgt: object, path: str = "") -> list[str]:
        errors: list[str] = []
        if isinstance(ref, dict):
            if not isinstance(tgt, dict):
                errors.append(
                    f"{path or '<root>'}: EN is an object, {target_lang} is {type(tgt).__name__}"
                )
                return errors
            for k, v in ref.items():
                child_path = f"{path}.{k}" if path else k
                if k in tgt:
                    errors.extend(walk(v, tgt[k], child_path))
        else:
            if isinstance(tgt, dict):
                errors.append(f"{path}: EN is a scalar, {target_lang} is an object")
        return errors

    errors = walk(reference_raw, target_raw)
    assert not errors, f"{target_lang}: structural divergence from {REFERENCE_LANG}:\n" + "\n".join(
        f"  - {e}" for e in errors[:20]
    )


@pytest.mark.parametrize("target_lang", TARGET_LANGS)
def test_placeholder_parity(target_lang: str, reference: dict[str, object]) -> None:
    """{var} placeholders present in EN must appear in every translation."""
    target = _flatten(_load(target_lang))
    mismatches: list[tuple[str, set[str], set[str]]] = []
    for key, ref_val in reference.items():
        if not isinstance(ref_val, str) or key not in target:
            continue
        tgt_val = target[key]
        if not isinstance(tgt_val, str):
            continue
        ref_ph = set(PLACEHOLDER_RE.findall(ref_val))
        tgt_ph = set(PLACEHOLDER_RE.findall(tgt_val))
        if ref_ph != tgt_ph:
            mismatches.append((key, ref_ph, tgt_ph))

    assert not mismatches, (
        f"{target_lang}: {len(mismatches)} placeholder mismatch(es):\n"
        + "\n".join(
            f"  - {k}: EN {sorted(ref_ph)} vs {target_lang} {sorted(tgt_ph)}"
            for k, ref_ph, tgt_ph in mismatches[:10]
        )
    )
