#!/usr/bin/env python3
"""Export all i18n catalogs as a per-key Markdown review artifact.

Produces a native-language four-eyes review export of every i18n catalog
under ``backend/config/i18n/*.yaml``. The output groups all languages
under each key (German first as the source of truth, English second as the
technical key reference), so an external reviewer sees every translation of
a string side by side.

The script also runs machine consistency checks (key parity, placeholder
sets, empty values, untranslated-vs-source suspects, cross-language
identical values, mojibake) and writes them into the export head; these
duplicate, in human-readable form, what ``backend/tests/test_i18n_*.py``
gate in CI.

Output: an index + a machine-analysis file + per-key blocks, written under
``docs/review/<out-dir>/``. A single file is written when the rendered
size stays under :data:`MAX_SINGLE_FILE_BYTES`; otherwise the export is
split into parts on whole-namespace boundaries (one file would be ~2 MB).

Pure helpers (``flatten``, ``extract_placeholders``, ``namespace``,
``list_cell``, ``analyze``, ``split_namespaces``, ``render_key_block``) are
unit-tested in ``backend/tests/test_export_i18n_review.py``.

Usage:
    python3 scripts/export_i18n_review.py [--out-dir docs/review/i18n-v1.98.0]
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
I18N_DIR = REPO / "backend" / "config" / "i18n"

# de + en first (de = translation source of truth, en = key parity reference),
# then the remaining catalogs alphabetically.
LANGS = ["de", "en", "el", "es", "fr", "hi", "id", "ja", "ko", "pt", "tr"]
KEY_REF = "en"  # technical key-parity baseline (mirrors test_i18n_parity.py)
SRC = "de"  # translation source of truth (assumed correct)

PLACEHOLDER = re.compile(r"\{[^{}]*\}")
# Replacement char + the most common Latin-1/UTF-8 mojibake bigrams.
MOJIBAKE = re.compile(r"�|Ã[\x80-\xbf]|Â[\x80-\xbf]|â€|ï¿½")

TARGET_KEYS_PER_PART = 380
MAX_SINGLE_FILE_BYTES = 800_000


def load_catalog(path: Path) -> dict:
    """Parse one YAML catalog into a nested dict."""
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def flatten(node, prefix: str = "") -> dict:
    """Flatten a nested dict/list catalog to ``{dotted.key: leaf}``.

    Dict keys join with ``.``; list items use ``[i]`` index segments.
    """
    out: dict = {}
    if isinstance(node, dict):
        for key, value in node.items():
            out.update(flatten(value, f"{prefix}.{key}" if prefix else str(key)))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            out.update(flatten(value, f"{prefix}[{index}]"))
    else:
        out[prefix] = node
    return out


def extract_placeholders(value) -> frozenset:
    """Return the set of ``{placeholder}`` tokens in a string value."""
    if not isinstance(value, str):
        return frozenset()
    return frozenset(PLACEHOLDER.findall(value))


def namespace(key: str) -> str:
    """Top-level namespace of a flattened key (before the first ``.``/``[``)."""
    return key.split(".", 1)[0].split("[", 1)[0]


def list_cell(lang: str, value) -> str:
    """Render one ``- **lang**: value`` review line.

    Newlines collapse to ``<br>`` so a multi-line value stays one list item;
    ``None``/empty render as explicit markers. A literal ``|`` needs no
    escaping in list form (the reason the export is a list, not a table).
    """
    if value is None:
        shown = "_(null)_"
    elif isinstance(value, str) and value == "":
        shown = "_(empty)_"
    else:
        shown = str(value).replace("\r", "").replace("\n", "<br>")
    return f"- **{lang}**: {shown}"


def _is_trivial(value) -> bool:
    """True for values that are uninteresting for untranslated detection.

    Pure-placeholder, very short, or letter-free values (numbers, symbols,
    bare tokens) routinely coincide across languages and are not evidence of
    a missing translation.
    """
    if not isinstance(value, str):
        return True
    stripped = PLACEHOLDER.sub("", value).strip()
    if len(stripped) <= 3:
        return True
    return not re.search(r"[A-Za-zÀ-ÿ]", stripped)


def analyze(catalogs: dict, langs: list, key_ref: str, src: str) -> dict:
    """Run the machine consistency checks across all catalogs.

    Returns a dict of findings: per-language missing/extra keys (vs
    ``key_ref``), placeholder mismatches (vs ``src``), empties, untranslated
    suspects (value identical to ``src``), cross-language identical values,
    and mojibake hits.
    """
    ref_keys = list(catalogs[key_ref].keys())
    ref_set = set(ref_keys)

    parity = {}
    for lang in langs:
        if lang == key_ref:
            continue
        keys = set(catalogs[lang])
        parity[lang] = {
            "missing": sorted(ref_set - keys),
            "extra": sorted(keys - ref_set),
        }

    placeholder_mismatches = []
    for key in ref_keys:
        src_ph = extract_placeholders(catalogs[src].get(key))
        for lang in langs:
            if lang == src:
                continue
            lang_ph = extract_placeholders(catalogs[lang].get(key))
            if lang_ph != src_ph:
                placeholder_mismatches.append((key, lang, sorted(src_ph), sorted(lang_ph)))

    empties = []
    for lang in langs:
        for key, value in catalogs[lang].items():
            if value is None or (isinstance(value, str) and value.strip() == ""):
                empties.append((lang, key))

    untranslated = {}
    for lang in langs:
        if lang == src:
            continue
        same = [
            key
            for key in ref_keys
            if isinstance(catalogs[src].get(key), str)
            and catalogs[src].get(key) == catalogs[lang].get(key)
            and not _is_trivial(catalogs[src].get(key))
        ]
        untranslated[lang] = same

    targets = [lang for lang in langs if lang != key_ref]
    cross_identical = []
    for key in ref_keys:
        buckets: dict = {}
        for lang in targets:
            value = catalogs[lang].get(key)
            if isinstance(value, str) and not _is_trivial(value):
                buckets.setdefault(value, []).append(lang)
        for _value, sharing in buckets.items():
            if len(sharing) >= 6:
                cross_identical.append((key, sorted(sharing)))

    mojibake = []
    for lang in langs:
        for key, value in catalogs[lang].items():
            if isinstance(value, str) and MOJIBAKE.search(value):
                mojibake.append((lang, key, value[:60]))

    return {
        "ref_keys": ref_keys,
        "parity": parity,
        "placeholder_mismatches": placeholder_mismatches,
        "empties": empties,
        "untranslated": untranslated,
        "cross_identical": cross_identical,
        "mojibake": mojibake,
    }


def render_key_block(key: str, catalogs: dict, langs: list) -> str:
    """Render the per-key review block (heading + one list line per language)."""
    lines = [f"### `{key}`"]
    lines.extend(list_cell(lang, catalogs[lang].get(key)) for lang in langs)
    lines.append("")
    return "\n".join(lines)


def render_body(keys: list, catalogs: dict, langs: list) -> str:
    """Render the full review body for ``keys``, with a ``## namespace`` heading
    before each namespace group (keys must already be in namespace order)."""
    lines: list = []
    last_ns = None
    for key in keys:
        ns = namespace(key)
        if ns != last_ns:
            lines.append(f"## `{ns}`\n")
            last_ns = ns
        lines.append(render_key_block(key, catalogs, langs))
    return "\n".join(lines)


def split_namespaces(ns_order: list, ns_keys: dict, target: int) -> list:
    """Greedily pack whole namespaces into parts of ~``target`` keys.

    A namespace is never split across parts (keeps thematic grouping). Returns
    a list of ``(namespaces, keys)`` tuples.
    """
    parts = []
    cur_ns: list = []
    cur_keys: list = []
    for ns in ns_order:
        keys = ns_keys[ns]
        if cur_keys and len(cur_keys) + len(keys) > target:
            parts.append((cur_ns, cur_keys))
            cur_ns, cur_keys = [], []
        cur_ns.append(ns)
        cur_keys.extend(keys)
    if cur_keys:
        parts.append((cur_ns, cur_keys))
    return parts


def _group_by_namespace(ref_keys: list) -> tuple:
    ns_order: list = []
    ns_keys: dict = {}
    for key in ref_keys:
        ns = namespace(key)
        if ns not in ns_keys:
            ns_keys[ns] = []
            ns_order.append(ns)
        ns_keys[ns].append(key)
    return ns_order, ns_keys


def _analysis_markdown(findings: dict, langs: list) -> str:
    out = ["# i18n consistency analysis (machine)", ""]
    out.append(f"- Languages ({len(langs)}): {', '.join(langs)}")
    out.append(f"- Key reference: `{KEY_REF}` — {len(findings['ref_keys'])} leaf keys")
    out.append(f"- Translation source of truth: `{SRC}` (assumed correct)")
    out.append("")

    out.append("## Key parity (vs EN)")
    clean = all(not p["missing"] and not p["extra"] for p in findings["parity"].values())
    if clean:
        out.append("- All target languages have the EXACT EN key set (0 missing, 0 extra).")
    else:
        for lang, p in findings["parity"].items():
            if p["missing"] or p["extra"]:
                out.append(f"- **{lang}**: missing {len(p['missing'])}, extra {len(p['extra'])}")
                for key in p["missing"][:50]:
                    out.append(f"    - missing: `{key}`")
                for key in p["extra"][:50]:
                    out.append(f"    - extra: `{key}`")
    out.append("")

    out.append("## Placeholder consistency (vs DE source)")
    pm = findings["placeholder_mismatches"]
    if pm:
        out.append(f"- {len(pm)} mismatch(es):")
        for key, lang, src_ph, lang_ph in pm[:200]:
            out.append(f"    - `{key}` [{lang}]: DE={src_ph} vs {lang}={lang_ph}")
    else:
        out.append("- No placeholder-set mismatches vs DE across any language.")
    out.append("")

    out.append("## Empty / null values")
    if findings["empties"]:
        out.append(f"- {len(findings['empties'])} empty/null value(s):")
        for lang, key in findings["empties"][:200]:
            out.append(f"    - [{lang}] `{key}`")
    else:
        out.append("- No empty or null values in any catalog.")
    out.append("")

    out.append("## Untranslated suspects (value identical to DE source)")
    out.append(
        "(short tokens, brand names, numbers and pure-placeholder values excluded; "
        "most remaining hits are loanwords/cognates — verify in context)\n"
    )
    for lang, keys in findings["untranslated"].items():
        out.append(f"- **{lang}**: {len(keys)} non-trivial value(s) identical to DE")
    out.append("")
    out.append("<details><summary>identical-to-DE keys per language (first 60 each)</summary>\n")
    for lang, keys in findings["untranslated"].items():
        if keys:
            out.append(f"- **{lang}** ({len(keys)}): " + ", ".join(f"`{k}`" for k in keys[:60]))
    out.append("\n</details>\n")

    out.append("## Suspiciously identical across languages (>= 6 target langs)")
    if findings["cross_identical"]:
        out.append(
            f"- {len(findings['cross_identical'])} key(s) (brand/UI tokens may legitimately coincide):"
        )
        for key, sharing in findings["cross_identical"][:200]:
            out.append(f"    - `{key}` — {len(sharing)} langs: {','.join(sharing)}")
    else:
        out.append("- None.")
    out.append("")

    out.append("## UTF-8 / mojibake scan")
    if findings["mojibake"]:
        out.append(f"- {len(findings['mojibake'])} suspected mojibake value(s):")
        for lang, key, snippet in findings["mojibake"][:200]:
            out.append(f"    - [{lang}] `{key}`: {snippet!r}")
    else:
        out.append("- No replacement chars or common mojibake sequences found.")
    out.append("")
    return "\n".join(out)


def _summary_line(findings: dict) -> str:
    clean = all(not p["missing"] and not p["extra"] for p in findings["parity"].values())
    return (
        f"parity {'clean' if clean else 'ISSUES'}, "
        f"{len(findings['placeholder_mismatches'])} placeholder mismatch(es), "
        f"{len(findings['empties'])} empty, "
        f"{len(findings['mojibake'])} mojibake, "
        f"{len(findings['cross_identical'])} cross-language-identical key(s)."
    )


def _review_note() -> str:
    return (
        "> Source of truth: **DE** (assumed correct). EN = key reference. "
        "Verify each language against DE; placeholders like `{name}` must match DE exactly. "
        "Please check: correct translation, idiomatic phrasing, swallowed/renamed placeholders, "
        "tone & terminology consistency — especially JA/KO/HI/ID/TR/PT (less verified)."
    )


def build(out_dir: Path, stamp: str = "") -> dict:
    """Generate the review export under ``out_dir``. Returns a small summary."""
    catalogs = {lang: flatten(load_catalog(I18N_DIR / f"{lang}.yaml")) for lang in LANGS}
    findings = analyze(catalogs, LANGS, KEY_REF, SRC)
    ref_keys = findings["ref_keys"]
    ns_order, ns_keys = _group_by_namespace(ref_keys)

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "00-analysis.md").write_text(_analysis_markdown(findings, LANGS), encoding="utf-8")

    full_body = "\n".join(render_key_block(k, catalogs, LANGS) for k in ref_keys)
    estimated = len(full_body.encode("utf-8"))

    head = [
        "# i18n catalog review — v1.98.0",
        "",
        f"> {stamp}" if stamp else "",
        "",
        f"- Leaf keys: {len(ref_keys)} × {len(LANGS)} languages "
        f"({', '.join(LANGS)}; DE/EN first per key).",
        f"- Machine check: {_summary_line(findings)} See [00-analysis.md](00-analysis.md).",
        "",
        _review_note(),
        "",
    ]

    written = []
    if estimated <= MAX_SINGLE_FILE_BYTES:
        single = out_dir / "i18n-review-v1.98.0.md"
        single.write_text(
            "\n".join(head + ["## Keys", "", render_body(ref_keys, catalogs, LANGS)]),
            encoding="utf-8",
        )
        written.append(single.name)
        return {
            "single": True,
            "files": written,
            "keys": len(ref_keys),
            "langs": len(LANGS),
            "findings": findings,
        }

    parts = split_namespaces(ns_order, ns_keys, TARGET_KEYS_PER_PART)
    part_names = []
    for index, (part_ns, keys) in enumerate(parts, 1):
        lines = [f"# i18n review — part {index:02d}/{len(parts):02d}", ""]
        lines.append("Namespaces: " + ", ".join(f"`{n}`" for n in part_ns))
        lines.append(f"Keys in this part: {len(keys)}")
        lines.append("")
        lines.append(_review_note())
        lines.append("")
        lines.append(render_body(keys, catalogs, LANGS))
        fname = out_dir / f"{index:02d}-{part_ns[0]}.md"
        fname.write_text("\n".join(lines), encoding="utf-8")
        part_names.append(fname.name)

    # Combined single file with everything (for feeding the whole export to one
    # tool at once), alongside the per-namespace parts.
    combined_name = "100-all.md"
    combined = head + [
        f"_Combined export: all {len(ref_keys)} keys, all {len(LANGS)} languages, "
        "one file. Per-namespace parts are also available (see 00-index.md)._",
        "",
        render_body(ref_keys, catalogs, LANGS),
    ]
    (out_dir / combined_name).write_text("\n".join(combined), encoding="utf-8")

    index_lines = head + [
        "## Parts",
        "",
        f"All-in-one: [{combined_name}]({combined_name}) ({len(ref_keys)} keys).",
        "",
        "| Part | Namespaces | Keys |",
        "|---|---|---|",
    ]
    for (part_ns, keys), name in zip(parts, part_names, strict=True):
        index_lines.append(f"| [{name}]({name}) | {', '.join(part_ns)} | {len(keys)} |")
    index_lines.append("")
    (out_dir / "00-index.md").write_text("\n".join(index_lines), encoding="utf-8")
    written = ["00-index.md", combined_name, *part_names]
    return {
        "single": False,
        "files": written,
        "keys": len(ref_keys),
        "langs": len(LANGS),
        "findings": findings,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out-dir",
        default="docs/review/i18n-v1.98.0",
        help="output directory (relative to repo root)",
    )
    parser.add_argument(
        "--stamp", default="", help="provenance line for the index head, e.g. 'develop @ <sha>'"
    )
    args = parser.parse_args()
    out_dir = (REPO / args.out_dir).resolve()
    result = build(out_dir, stamp=args.stamp)
    f = result["findings"]
    print(
        f"keys={result['keys']} langs={result['langs']} "
        f"single={result['single']} files={result['files']}"
    )
    print("analysis:", _summary_line(f))
    print("untranslated-vs-DE:", {lang: len(keys) for lang, keys in f["untranslated"].items()})


if __name__ == "__main__":
    main()
