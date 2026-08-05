"""Pins for the per-language docs sitemap split (#2417).

Material's language selector requests ``<lang>/sitemap.xml`` per
alternate; the split hook derives those from the root sitemap. Gate
contract (#2083): detects the split, reports what it measured, and
fails closed on a sitemap without entries or without hreflang
alternates (the one place the language set is declared).
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(
    subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
)

_spec = importlib.util.spec_from_file_location(
    "mkdocs_split_sitemap", REPO_ROOT / "scripts" / "mkdocs_split_sitemap.py"
)
assert _spec is not None and _spec.loader is not None
split_module = importlib.util.module_from_spec(_spec)
sys.modules["mkdocs_split_sitemap"] = split_module
_spec.loader.exec_module(split_module)

BASE = "https://example.org/docs/"


def _entry(loc: str) -> str:
    alternates = (
        f'<xhtml:link rel="alternate" hreflang="de" href="{BASE}"/>'
        f'<xhtml:link rel="alternate" hreflang="en" href="{BASE}en/"/>'
        f'<xhtml:link rel="alternate" hreflang="ja" href="{BASE}ja/"/>'
    )
    return f"<url><loc>{loc}</loc><lastmod>2026-08-05</lastmod>{alternates}</url>"


def _sitemap(*locs: str) -> str:
    header = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n    '
    )
    return header + "\n    ".join(_entry(loc) for loc in locs) + "\n</urlset>\n"


def test_splits_non_default_languages_and_keeps_default_at_the_root() -> None:
    sitemap = _sitemap(
        BASE,
        f"{BASE}changelog/",
        f"{BASE}en/",
        f"{BASE}en/changelog/",
        f"{BASE}ja/",
    )
    split = split_module.split_sitemap(sitemap)
    assert sorted(split) == ["en", "ja"], "default (de) must stay root-only"
    assert split["en"].count("<url>") == 2
    assert split["ja"].count("<url>") == 1
    assert f"<loc>{BASE}changelog/</loc>" not in split["en"]


def test_split_documents_are_complete_urlsets_with_alternates() -> None:
    split = split_module.split_sitemap(_sitemap(BASE, f"{BASE}en/"))
    doc = split["en"]
    assert doc.startswith('<?xml version="1.0"')
    assert 'xmlns:xhtml="http://www.w3.org/1999/xhtml"' in doc
    assert doc.rstrip().endswith("</urlset>")
    assert 'hreflang="ja"' in doc, "alternate links must ride along untouched"


def test_fails_closed_on_a_sitemap_without_entries() -> None:
    with pytest.raises(ValueError, match="no <url> entries"):
        split_module.split_sitemap(
            '<?xml version="1.0"?><urlset xmlns="x"></urlset>'
        )


def test_fails_closed_without_hreflang_alternates() -> None:
    bare = (
        '<?xml version="1.0"?><urlset xmlns="x">'
        f"<url><loc>{BASE}en/</loc></url></urlset>"
    )
    with pytest.raises(ValueError, match="no hreflang alternates"):
        split_module.split_sitemap(bare)


def test_hook_writes_files_and_reports_the_measured_set(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    site = tmp_path / "site"
    site.mkdir()
    (site / "sitemap.xml").write_text(
        _sitemap(BASE, f"{BASE}en/", f"{BASE}ja/"), encoding="utf-8"
    )
    split_module.on_post_build({"site_dir": str(site)})
    assert (site / "en" / "sitemap.xml").is_file()
    assert (site / "ja" / "sitemap.xml").is_file()
    assert not (site / "de" / "sitemap.xml").exists()
    report = capsys.readouterr().out
    assert "3 root entries" in report and "2 per-language sitemaps" in report


def test_hook_fails_closed_when_the_root_sitemap_is_missing(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="fail closed"):
        split_module.on_post_build({"site_dir": str(tmp_path)})
