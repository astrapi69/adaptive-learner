"""MkDocs hook: per-language sitemaps for the Material language selector (#2417).

Material's language selector (with instant navigation) requests
``<lang>/sitemap.xml`` for every language alternate to map the current
page onto its sister page when the user switches language. The
mkdocs-static-i18n build produces ONE root sitemap covering all
languages, so every non-default language request 404ed - seven red
requests per docs page view, and the language switch fell back to the
target language's start page instead of the sister page.

This hook runs after the build and splits the root ``sitemap.xml`` into
one ``<lang>/sitemap.xml`` per non-default language, each carrying
exactly the ``<url>`` entries whose ``<loc>`` lives under that language
prefix (alternate ``xhtml:link`` blocks preserved). The default
language stays served by the root sitemap, which is what Material
requests for it.

Wired via ``hooks:`` in ``mkdocs.yml`` - it runs on every build (local
``make docs-build`` and CI alike). A missing or unparseable root
sitemap raises, failing the build closed. Pinned by
``backend/tests/test_mkdocs_split_sitemap.py``.
"""

from __future__ import annotations

import re
from pathlib import Path

SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
XHTML_NS = "http://www.w3.org/1999/xhtml"

_URL_BLOCK_RE = re.compile(r"<url>.*?</url>", re.DOTALL)
_LOC_RE = re.compile(r"<loc>([^<]+)</loc>")
_HREFLANG_RE = re.compile(r'hreflang="([^"]+)"\s+href="([^"]+)"')


def _language_prefixes(sitemap_xml: str) -> dict[str, str]:
    """Map each NON-default language code to its URL prefix.

    Derived from the first entry's ``xhtml:link`` alternates - the
    single place the sitemap itself declares the language set. The
    default language is recognised as the alternate whose href carries
    no extra path segment versus the shortest alternate href, and is
    deliberately excluded: the root sitemap keeps serving it.
    """
    first_block = _URL_BLOCK_RE.search(sitemap_xml)
    if first_block is None:
        raise ValueError("sitemap has no <url> entries - nothing to split (fail closed)")
    alternates = _HREFLANG_RE.findall(first_block.group(0))
    if not alternates:
        raise ValueError(
            "sitemap entries carry no hreflang alternates - the i18n plugin "
            "output changed shape; refusing to guess the language set"
        )
    shortest = min(href for _lang, href in alternates)
    prefixes: dict[str, str] = {}
    for lang, href in alternates:
        if href == shortest:
            continue
        prefixes[lang] = href
    return prefixes


def split_sitemap(sitemap_xml: str) -> dict[str, str]:
    """Return ``{language: sitemap_xml}`` for every non-default language.

    Each produced document is a complete ``urlset`` holding exactly the
    ``<url>`` blocks whose ``<loc>`` starts with that language's URL
    prefix, byte-preserving the blocks (lastmod, changefreq and the
    hreflang alternates ride along untouched).
    """
    prefixes = _language_prefixes(sitemap_xml)
    header_end = sitemap_xml.index("<url>")
    header = sitemap_xml[:header_end]
    per_language: dict[str, list[str]] = {lang: [] for lang in prefixes}
    for block in _URL_BLOCK_RE.findall(sitemap_xml):
        loc_match = _LOC_RE.search(block)
        if loc_match is None:
            continue
        loc = loc_match.group(1)
        for lang, prefix in prefixes.items():
            if loc.startswith(prefix):
                per_language[lang].append(block)
                break
    joiner = "\n    "
    result: dict[str, str] = {}
    for lang, blocks in per_language.items():
        if not blocks:
            continue
        result[lang] = header + joiner.join(blocks) + "\n</urlset>\n"
    return result


def on_post_build(config, **_kwargs) -> None:
    """MkDocs hook entry point: write ``<lang>/sitemap.xml`` files."""
    site_dir = Path(config["site_dir"])
    sitemap_path = site_dir / "sitemap.xml"
    if not sitemap_path.is_file():
        raise FileNotFoundError(
            f"{sitemap_path} missing after the build - cannot split per-language "
            "sitemaps (fail closed, #2417)"
        )
    sitemap_xml = sitemap_path.read_text(encoding="utf-8")
    split = split_sitemap(sitemap_xml)
    for lang, xml in split.items():
        target = site_dir / lang / "sitemap.xml"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(xml, encoding="utf-8")
    total = len(_URL_BLOCK_RE.findall(sitemap_xml))
    print(
        f"mkdocs_split_sitemap: {total} root entries split into "
        f"{len(split)} per-language sitemaps ({', '.join(sorted(split))})"
    )
