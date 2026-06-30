#!/usr/bin/env python3
"""LLM translation quality-check pass for the i18n catalogs (issue #1296).

DE is the source of truth, EN the key reference (both maintainer-verified);
EL is verified by hand. The remaining catalogs (es, fr, hi, id, ja, ko, pt,
tr) are machine-translated and partly wrong (e.g. fr/es stripped diacritics).
The existing gates (``test_i18n_parity`` / ``_structure`` /
``_translation_audit``) are purely mechanical. This tool adds a **content**
quality check: each target value is reviewed against the DE source by an LLM,
two-tier (a cheap model checks everything, a strong model re-checks only the
flagged suspects). It produces a status report and a per-key provenance cache
keyed by a hash of the DE source value -- it NEVER rewrites the catalogs.

Two-tier strategy (issue #1296): tier 1 (default Sonnet) reviews every key;
keys it flags as a hard problem (or high severity) are re-reviewed by tier 2
(default Opus), whose verdict wins. The DE-hash cache makes re-runs
incremental: a key whose DE source is unchanged and already has a verdict is
skipped; if the DE source changed, the key is re-checked (drift detection).

The Anthropic client is imported lazily (only when the API is actually
called), so the pure helpers -- ``de_hash``, ``review_items``,
``partition_keys``, ``chunk``, ``build_prompt``, ``parse_verdicts``,
``needs_escalation``, ``merge_verdict``, ``status_entry``, ``summarize`` --
are unit-tested in ``backend/tests/test_i18n_quality_check.py`` without the
``anthropic`` package or any network access.

Runs locally where the API key lives (env
``ADAPTIVE_LEARNER_ANTHROPIC_API_KEY`` or ``~/.config/adaptive_learner/
secrets.yaml``). ``--dry-run`` works anywhere (no key, no API calls).

Usage:
    python3 scripts/i18n_quality_check.py --dry-run
    python3 scripts/i18n_quality_check.py --langs ja --limit 50
    python3 scripts/i18n_quality_check.py            # all 8 target langs
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
REPO = SCRIPTS_DIR.parent

# Reuse the catalog helpers from the review exporter rather than re-deriving
# them (single source of truth for "what is a trivial value").
sys.path.insert(0, str(SCRIPTS_DIR))
from export_i18n_review import (  # noqa: E402
    I18N_DIR,
    _is_trivial,
    flatten,
    load_catalog,
)

SRC = "de"
# Target languages whose catalogs are machine-translated and unverified.
# DE = source, EN = key reference, EL = hand-verified -> all excluded.
DEFAULT_TARGET_LANGS = ["es", "fr", "hi", "id", "ja", "ko", "pt", "tr"]

DEFAULT_TIER1_MODEL = "claude-sonnet-4-6"
DEFAULT_TIER2_MODEL = "claude-opus-4-8"
DEFAULT_BATCH_SIZE = 30
DEFAULT_MAX_TOKENS = 4096

# The verdict vocabulary the LLM must use. ``needs_recheck`` is an internal
# sentinel (never requested from the LLM) for unparseable / missing answers.
VERDICTS = frozenset(
    {"ok", "minor", "wrong", "untranslated", "missing_diacritics", "placeholder_mismatch"}
)
NEEDS_RECHECK = "needs_recheck"
# Verdicts that count as a problem worth surfacing in the report / CSV.
FLAGGED = frozenset({"wrong", "untranslated", "missing_diacritics", "placeholder_mismatch",
                     NEEDS_RECHECK})
# Verdicts that warrant a tier-2 (strong model) re-check regardless of severity.
ESCALATE_VERDICTS = frozenset({"wrong", "untranslated", "placeholder_mismatch", NEEDS_RECHECK})
SEVERITIES = frozenset({"low", "medium", "high"})

_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def de_hash(value: str) -> str:
    """Stable 12-hex-char fingerprint of a DE source value (provenance key)."""
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()[:12]


def review_items(de_flat: dict, tgt_flat: dict) -> list[dict]:
    """Build ``{key, de, target}`` items worth reviewing.

    Keeps only keys present in BOTH catalogs whose DE value is a non-trivial
    string (brand names, numbers, pure placeholders are skipped -- they
    coincide across languages and waste LLM budget).
    """
    items: list[dict] = []
    for key, de_value in de_flat.items():
        if key not in tgt_flat:
            continue
        if not isinstance(de_value, str) or _is_trivial(de_value):
            continue
        items.append({"key": key, "de": de_value, "target": tgt_flat[key]})
    return items


def partition_keys(
    items: list[dict], cache: dict, force: bool = False
) -> tuple[list[dict], list[dict]]:
    """Split items into ``(to_check, skipped)`` against the provenance cache.

    An item is skipped only when ``force`` is false AND the cache holds an
    entry for it whose ``de_hash`` matches the current DE source AND that
    entry already carries a verdict. A changed DE source (hash mismatch) or a
    missing entry forces a re-check.
    """
    to_check: list[dict] = []
    skipped: list[dict] = []
    for item in items:
        entry = cache.get(item["key"])
        fresh = (
            not force
            and isinstance(entry, dict)
            and entry.get("de_hash") == de_hash(item["de"])
            and entry.get("verdict")
        )
        (skipped if fresh else to_check).append(item)
    return to_check, skipped


def chunk(seq: list, size: int) -> list[list]:
    """Split ``seq`` into consecutive sublists of at most ``size`` items."""
    return [seq[i : i + size] for i in range(0, len(seq), size)]


def build_prompt(lang: str, items: list[dict]) -> list[dict]:
    """Build the chat messages for a one-batch quality review of ``items``.

    Plain string concatenation (not an f-string) so the literal
    ``{placeholder}`` token in the instructions stays literal.
    """
    verdict_list = ", ".join(sorted(VERDICTS))
    system = (
        "You are a meticulous German->" + lang + " translation quality reviewer "
        "for a language-learning app UI. For each entry you get the German source "
        "(authoritative) and the current " + lang + " translation. JUDGE the "
        "translation; do NOT rewrite the whole catalog. Check: correct meaning, "
        "idiomatic phrasing, CORRECT diacritics/accents (a missing accent is a "
        "real defect), swallowed or renamed {placeholder} tokens (their set must "
        "match the source exactly), and consistent tone/terminology.\n\n"
        "Reply with ONLY a JSON object mapping each key to an object with fields "
        "verdict, severity, note, suggestion.\n"
        "verdict is one of: " + verdict_list + ".\n"
        "severity is one of: low, medium, high.\n"
        "note: a short reason (max 120 chars).\n"
        "suggestion: a corrected string ONLY when verdict is not ok (else empty)."
    )
    lines = [f"Language: {lang}", "Entries:"]
    for item in items:
        lines.append(
            json.dumps(
                {"key": item["key"], "de": item["de"], lang: item["target"]},
                ensure_ascii=False,
            )
        )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": "\n".join(lines)},
    ]


def _normalize_verdict(raw) -> dict:
    """Coerce one raw LLM entry into a normalized verdict dict."""
    if not isinstance(raw, dict):
        return {"verdict": NEEDS_RECHECK, "severity": "medium", "note": "", "suggestion": ""}
    verdict = raw.get("verdict")
    if verdict not in VERDICTS:
        verdict = NEEDS_RECHECK
    severity = raw.get("severity")
    if severity not in SEVERITIES:
        severity = "medium"
    note = raw.get("note") if isinstance(raw.get("note"), str) else ""
    suggestion = raw.get("suggestion") if isinstance(raw.get("suggestion"), str) else ""
    return {"verdict": verdict, "severity": severity, "note": note, "suggestion": suggestion}


def parse_verdicts(text: str, expected_keys: list[str]) -> dict:
    """Parse an LLM reply into ``{key: normalized verdict}`` for every expected key.

    Tolerates code fences and surrounding prose. A key missing from the reply,
    an unknown verdict value, or an unparseable reply all degrade to
    ``needs_recheck`` (visible, never a crash).
    """
    parsed: dict = {}
    candidate = text
    fence = _FENCE.search(text)
    if fence:
        candidate = fence.group(1)
    else:
        start, end = candidate.find("{"), candidate.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = candidate[start : end + 1]
    try:
        loaded = json.loads(candidate)
        if isinstance(loaded, dict):
            parsed = loaded
    except (json.JSONDecodeError, ValueError):
        parsed = {}
    return {key: _normalize_verdict(parsed.get(key)) for key in expected_keys}


def needs_escalation(verdict: dict) -> bool:
    """True when a tier-1 verdict should be re-checked by the strong model."""
    return verdict.get("verdict") in ESCALATE_VERDICTS or verdict.get("severity") == "high"


def merge_verdict(tier1: dict, tier2: dict, *, tier1_model: str, tier2_model: str) -> dict:
    """Combine a tier-1 and tier-2 verdict; tier-2 (strong model) wins."""
    merged = dict(tier2)
    merged["tier1_model"] = tier1_model
    merged["tier1_verdict"] = tier1.get("verdict")
    merged["tier2_model"] = tier2_model
    merged["tier2_verdict"] = tier2.get("verdict")
    return merged


def status_entry(item: dict, verdict: dict, *, checked_at: str) -> dict:
    """Build the provenance-cache entry for one checked key."""
    entry = dict(verdict)
    entry["de_hash"] = de_hash(item["de"])
    entry["target_hash"] = de_hash(item["target"]) if isinstance(item["target"], str) else ""
    entry["checked_at"] = checked_at
    return entry


def summarize(verdicts: dict) -> dict:
    """Count verdicts and flagged keys across a ``{key: verdict}`` mapping."""
    counts: dict = {}
    flagged = 0
    for verdict in verdicts.values():
        name = verdict.get("verdict", NEEDS_RECHECK)
        counts[name] = counts.get(name, 0) + 1
        if name in FLAGGED:
            flagged += 1
    return {"counts": counts, "flagged": flagged, "total": len(verdicts)}


# --------------------------------------------------------------------------
# I/O + orchestration (not unit-tested; the LLM call is the only side effect).
# --------------------------------------------------------------------------


def _resolve_api_key() -> str | None:
    import os

    env = os.environ.get("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY")
    if env and env.strip():
        return env.strip()
    sys.path.insert(0, str(REPO / "backend"))
    try:
        from app.services.secrets_service import read_api_key
    except ImportError:
        return None
    return read_api_key("anthropic")


def _get_complete():
    from adaptive_learner_ai_anthropic.client import complete

    return complete


def _load_cache(status_dir: Path, lang: str) -> dict:
    path = status_dir / f"{lang}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def _write_cache(status_dir: Path, lang: str, cache: dict) -> None:
    status_dir.mkdir(parents=True, exist_ok=True)
    ordered = {key: cache[key] for key in sorted(cache)}
    (status_dir / f"{lang}.json").write_text(
        json.dumps(ordered, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def _check_language(
    lang: str,
    de_flat: dict,
    *,
    complete,
    api_key: str,
    cache: dict,
    tier1_model: str,
    tier2_model: str,
    batch_size: int,
    limit: int | None,
    force: bool,
    checked_at: str,
) -> dict:
    """Run the two-tier check for one language; mutates+returns the verdict map."""
    tgt_flat = flatten(load_catalog(I18N_DIR / f"{lang}.yaml"))
    items = review_items(de_flat, tgt_flat)
    to_check, skipped = partition_keys(items, cache, force=force)
    if limit is not None:
        to_check = to_check[:limit]

    verdicts: dict = {}
    for item in skipped:
        verdicts[item["key"]] = cache[item["key"]]

    for batch in chunk(to_check, batch_size):
        keys = [it["key"] for it in batch]
        reply = complete(build_prompt(lang, batch), tier1_model, api_key, DEFAULT_MAX_TOKENS)
        tier1 = parse_verdicts(reply, keys)

        escalate = [it for it in batch if needs_escalation(tier1[it["key"]])]
        tier2: dict = {}
        if escalate:
            ekeys = [it["key"] for it in escalate]
            ereply = complete(
                build_prompt(lang, escalate), tier2_model, api_key, DEFAULT_MAX_TOKENS
            )
            tier2 = parse_verdicts(ereply, ekeys)

        for item in batch:
            key = item["key"]
            if key in tier2:
                final = merge_verdict(
                    tier1[key], tier2[key], tier1_model=tier1_model, tier2_model=tier2_model
                )
            else:
                final = dict(tier1[key])
                final["tier1_model"] = tier1_model
                final["tier1_verdict"] = tier1[key]["verdict"]
            entry = status_entry(item, final, checked_at=checked_at)
            cache[key] = entry
            verdicts[key] = entry

    print(
        f"  {lang}: {len(items)} reviewable, {len(to_check)} checked, "
        f"{len(skipped)} cached -> flagged {summarize(verdicts)['flagged']}"
    )
    return verdicts


def _render_summary(stats_by_lang: dict, drifted: dict, stamp: str) -> str:
    out = ["# i18n LLM quality check -- summary", ""]
    if stamp:
        out.append(f"> {stamp}")
        out.append("")
    out.append("| lang | reviewed | flagged | clean % | DE changed since last run |")
    out.append("|---|---|---|---|---|")
    for lang, stats in stats_by_lang.items():
        total = stats["total"] or 1
        clean = 100 * (total - stats["flagged"]) / total
        out.append(
            f"| {lang} | {stats['total']} | {stats['flagged']} | "
            f"{clean:.1f}% | {drifted.get(lang, 0)} |"
        )
    out.append("")
    out.append("Verdict legend: ok / minor (not flagged); "
               "wrong / untranslated / missing_diacritics / placeholder_mismatch / "
               "needs_recheck (flagged).")
    out.append("")
    return "\n".join(out)


def _render_lang_report(lang: str, verdicts: dict, de_flat: dict, tgt_flat: dict) -> str:
    out = [f"# i18n quality check -- {lang}", ""]
    flagged = {k: v for k, v in verdicts.items() if v.get("verdict") in FLAGGED}
    out.append(f"{len(flagged)} flagged of {len(verdicts)} reviewed.")
    out.append("")
    for key in sorted(flagged):
        verdict = flagged[key]
        out.append(f"### `{key}` -- {verdict.get('verdict')} ({verdict.get('severity')})")
        out.append(f"- **de**: {de_flat.get(key)}")
        out.append(f"- **{lang}**: {tgt_flat.get(key)}")
        if verdict.get("note"):
            out.append(f"- note: {verdict['note']}")
        if verdict.get("suggestion"):
            out.append(f"- suggestion: {verdict['suggestion']}")
        out.append("")
    return "\n".join(out)


def run(args: argparse.Namespace) -> int:
    de_flat = flatten(load_catalog(I18N_DIR / f"{SRC}.yaml"))
    langs = args.langs or DEFAULT_TARGET_LANGS
    status_dir = (REPO / args.status_dir).resolve()
    checked_at = args.stamp or datetime.now(UTC).isoformat()

    if args.dry_run:
        print("DRY RUN -- no API calls.")
        for lang in langs:
            tgt_flat = flatten(load_catalog(I18N_DIR / f"{lang}.yaml"))
            items = review_items(de_flat, tgt_flat)
            cache = _load_cache(status_dir, lang)
            to_check, skipped = partition_keys(items, cache, force=args.force)
            print(
                f"  {lang}: {len(items)} reviewable, "
                f"{len(to_check)} would be checked, {len(skipped)} cached"
            )
        return 0

    api_key = _resolve_api_key()
    if not api_key:
        print(
            "ERROR: no Anthropic API key. Set ADAPTIVE_LEARNER_ANTHROPIC_API_KEY or "
            "configure ~/.config/adaptive_learner/secrets.yaml. "
            "(Use --dry-run to inspect coverage without a key.)",
            file=sys.stderr,
        )
        return 2
    complete = _get_complete()

    out_dir = (REPO / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    stats_by_lang: dict = {}
    drifted: dict = {}
    for lang in langs:
        cache = _load_cache(status_dir, lang)
        tgt_flat = flatten(load_catalog(I18N_DIR / f"{lang}.yaml"))
        items = review_items(de_flat, tgt_flat)
        _, to_check = partition_keys(items, cache, force=False)  # noqa: F841
        drifted[lang] = sum(
            1
            for it in items
            if isinstance(cache.get(it["key"]), dict)
            and cache[it["key"]].get("de_hash") != de_hash(it["de"])
        )
        verdicts = _check_language(
            lang,
            de_flat,
            complete=complete,
            api_key=api_key,
            cache=cache,
            tier1_model=args.model_tier1,
            tier2_model=args.model_tier2,
            batch_size=args.batch_size,
            limit=args.limit,
            force=args.force,
            checked_at=checked_at,
        )
        _write_cache(status_dir, lang, cache)
        stats_by_lang[lang] = summarize(verdicts)
        (out_dir / f"{lang}.md").write_text(
            _render_lang_report(lang, verdicts, de_flat, tgt_flat), encoding="utf-8"
        )

    (out_dir / "00-summary.md").write_text(
        _render_summary(stats_by_lang, drifted, args.stamp), encoding="utf-8"
    )
    (out_dir / "findings.json").write_text(
        json.dumps(stats_by_lang, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Report written to {out_dir}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--langs", nargs="*", default=None,
        help=f"target languages (default: {' '.join(DEFAULT_TARGET_LANGS)})",
    )
    parser.add_argument("--limit", type=int, default=None,
                        help="max keys to check per language (cost control)")
    parser.add_argument("--force", action="store_true",
                        help="re-check even cached, unchanged keys")
    parser.add_argument("--dry-run", action="store_true",
                        help="no API calls; print coverage/cache stats only")
    parser.add_argument("--model-tier1", default=DEFAULT_TIER1_MODEL)
    parser.add_argument("--model-tier2", default=DEFAULT_TIER2_MODEL)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--out-dir", default="docs/review/i18n-quality")
    parser.add_argument("--status-dir", default="docs/review/i18n-status")
    parser.add_argument("--stamp", default="",
                        help="provenance stamp for the report + checked_at")
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
