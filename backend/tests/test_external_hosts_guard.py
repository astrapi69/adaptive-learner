"""Guard: the docs site fetches nothing from a third party (#3802).

A resource the browser loads on its own - a stylesheet, a font, a script,
an image - sends the visitor's IP address to whoever hosts it, before the
visitor has done anything. ``scripts/check_external_hosts.py`` reports
every such reference in a built site; CI runs it over the built MkDocs
site in the docs job of ``ci.yml`` and before ``deploy-gh-pages.yml``
uploads it.

The scanner is a copy of bibliogon's (astrapi69/bibliogon#1124 is why it
is a copy), and so are most tests here: the synthetic cases pin what it
must report and what it must leave alone. The two command-line tests at
the end pin what this repo's gate contract adds (quality-checks.md, gate
test contract points 3 and 4): a scan that read nothing never passes, and
a pass says how many pages it read.

Hyperlinks (``<a href>``), ``rel=canonical``, Open-Graph metadata and a
JSON-LD ``@context`` are strings, not fetches; the scanner must not report
them, or every real finding drowns in noise.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPT = _REPO_ROOT / "scripts" / "check_external_hosts.py"

# What Material for MkDocs 9.7.7 renders for its default font and for the
# repository widget repo_url turns on, copied from a build of this site.
_MATERIAL_FONT_LINKS = (
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,300i,'
    '400,400i,700,700i%7CRoboto+Mono:400,400i,700,700i&display=fallback">'
)
_REPO = "https://github.com/astrapi69/adaptive-learner"


@pytest.fixture(scope="module")
def checker():
    spec = importlib.util.spec_from_file_location("check_external_hosts", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _hosts(findings) -> set[str]:
    return {finding.host for finding in findings}


def _page(root: Path, body: str, name: str = "index.html") -> Path:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


class TestSyntheticArtifacts:
    """Red pins: each case is one way a third-party fetch sneaks into a
    build. The scanner must name the host; the clean twin must be
    silent."""

    def test_material_default_font_links_are_reported(self, checker, tmp_path):
        _page(
            tmp_path,
            "<html><head>"
            + _MATERIAL_FONT_LINKS
            + '<link rel="canonical" href="https://astrapi69.github.io/adaptive-learner/docs/">'
            + f'<a href="{_REPO}">repo</a></head></html>',
        )
        assert _hosts(checker.scan(tmp_path)) == {"fonts.gstatic.com", "fonts.googleapis.com"}

    def test_external_script_image_and_iframe_are_reported(self, checker, tmp_path):
        _page(
            tmp_path,
            '<script src="https://cdn.example.com/analytics.js"></script>'
            '<img src="//images.example.net/pixel.gif">'
            '<iframe src="https://maps.example.org/embed"></iframe>'
            '<script type="application/ld+json">{"@context": "https://schema.org"}</script>'
            '<meta property="og:image" content="https://astrapi69.github.io/adaptive-learner/og.png">',
        )
        assert _hosts(checker.scan(tmp_path)) == {
            "cdn.example.com",
            "images.example.net",
            "maps.example.org",
        }

    def test_css_url_and_import_are_reported(self, checker, tmp_path):
        (tmp_path / "assets").mkdir()
        (tmp_path / "assets" / "extra.css").write_text(
            "@import url('https://fonts.googleapis.com/css2?family=Lora');\n"
            ".hero { background: url(https://cdn.example.com/hero.jpg); }\n"
            ".local { background: url(/adaptive-learner/docs/fonts/x.woff2); }\n",
            encoding="utf-8",
        )
        assert _hosts(checker.scan(tmp_path)) == {"fonts.googleapis.com", "cdn.example.com"}

    def test_service_worker_precache_and_import_scripts_are_reported(self, checker, tmp_path):
        (tmp_path / "sw.js").write_text(
            'importScripts("https://cdn.example.com/wb.js");'
            'precacheAndRoute([{"revision":"1","url":"index.html"},'
            '{"revision":null,"url":"https://fonts.example.com/inter.woff2"}]);'
            "const t = `see https://bit.ly/wb-precache`;",
            encoding="utf-8",
        )
        assert _hosts(checker.scan(tmp_path)) == {"cdn.example.com", "fonts.example.com"}

    def test_webmanifest_icon_is_reported(self, checker, tmp_path):
        (tmp_path / "manifest.webmanifest").write_text(
            '{"icons":[{"src":"https://cdn.example.com/icon.png"},{"src":"icon-192.png"}],'
            '"start_url":"/adaptive-learner/"}',
            encoding="utf-8",
        )
        assert _hosts(checker.scan(tmp_path)) == {"cdn.example.com"}

    def test_material_repository_widget_is_reported_as_its_api_fetch(self, checker, tmp_path):
        """Material turns ``repo_url`` into a header widget whose script asks
        api.github.com for the latest release, stars and forks on page load
        (#3802). The markup is the only trace of that fetch in the built
        files."""
        _page(
            tmp_path,
            f'<a href="{_REPO}" title="Zum Repository" class="md-source" '
            'data-md-component="source">'
            '<div class="md-source__repository">astrapi69/adaptive-learner</div></a>',
        )
        findings = checker.scan(tmp_path)
        assert [finding.url for finding in findings] == [
            "https://api.github.com/repos/astrapi69/adaptive-learner"
        ]

    def test_repository_link_without_the_widget_component_is_not_a_finding(self, checker, tmp_path):
        """The override in docs/help-overrides/partials/source.html keeps the
        same link and drops only ``data-md-component="source"``, so the
        widget script never mounts. That markup is a plain link."""
        _page(
            tmp_path,
            f'<a href="{_REPO}" title="Zum Repository" class="md-source">'
            '<div class="md-source__repository">astrapi69/adaptive-learner</div></a>',
        )
        assert checker.scan(tmp_path) == []

    def test_repository_widget_of_another_forge_names_that_forge(self, checker, tmp_path):
        """Material asks a GitLab instance on its own host, so the
        repository URL itself names the host the widget contacts."""
        _page(
            tmp_path,
            '<a href="https://gitlab.example.org/group/project" class="md-source" '
            'data-md-component="source">group/project</a>',
        )
        assert _hosts(checker.scan(tmp_path)) == {"gitlab.example.org"}

    def test_own_origin_and_local_paths_are_not_findings(self, checker, tmp_path):
        _page(
            tmp_path,
            '<link rel="icon" href="/adaptive-learner/docs/assets/images/favicon.png">'
            '<link rel="stylesheet" href="https://astrapi69.github.io/adaptive-learner/a.css">'
            '<script src="assets/javascripts/bundle.d7400e89.min.js"></script>',
        )
        assert checker.scan(tmp_path, origin="https://astrapi69.github.io") == []
        assert _hosts(checker.scan(tmp_path)) == {"astrapi69.github.io"}

    def test_javascript_bundles_are_not_scanned_for_string_constants(self, checker, tmp_path):
        """A URL constant in a bundle is not a fetch. This is also why the
        scan cannot see Material's own JavaScript loaders (the widget's API
        call, the unpkg.com fallbacks); verify_docs' docs-third-party check
        pins the overrides that keep those quiet."""
        (tmp_path / "assets").mkdir()
        (tmp_path / "assets" / "bundle.js").write_text(
            '_t("https://unpkg.com/resize-observer-polyfill")', encoding="utf-8"
        )
        assert checker.scan(tmp_path) == []

    def test_allowlisted_host_needs_a_reason_and_is_reported_as_allowed(self, checker, tmp_path):
        _page(tmp_path, '<link rel="stylesheet" href="https://allowed.example.com/a.css">')
        findings = checker.scan(tmp_path)
        assert _hosts(findings) == {"allowed.example.com"}
        assert checker.unallowed(findings, {"allowed.example.com": "written reason"}) == []
        with pytest.raises(ValueError, match="reason"):
            checker.unallowed(findings, {"allowed.example.com": ""})


class TestSourceMode:
    def test_sources_mode_reads_index_public_and_the_css_under_src(self, checker, tmp_path):
        """``--sources`` scans an unbuilt frontend: its index.html, public/
        and every CSS file under src/, nothing else."""
        frontend = tmp_path / "frontend"
        _page(frontend, '<link rel="stylesheet" href="https://a.example.com/x.css">')
        _page(frontend / "public", '<img src="https://b.example.com/y.png">', "offline.html")
        (frontend / "src").mkdir()
        (frontend / "src" / "app.css").write_text(
            "body { background: url(https://c.example.com/z.png); }", encoding="utf-8"
        )
        _page(frontend / "other", '<script src="https://d.example.com/w.js"></script>')
        findings = checker.scan_sources(frontend, origin="https://astrapi69.github.io")
        assert _hosts(findings) == {"a.example.com", "b.example.com", "c.example.com"}


class TestAllowlist:
    def test_allowlist_entries_carry_a_reason(self, checker):
        for host, reason in checker.ALLOWED_HOSTS.items():
            assert reason.strip(), f"{host}: allowlist entry without a reason"


class TestCommandLine:
    def test_a_directory_without_a_page_is_not_a_pass(self, checker, tmp_path):
        """A scan that read nothing proves nothing. The docs gate scans the
        site after the build; a build that wrote elsewhere must fail the
        gate instead of passing it with zero findings."""
        site = tmp_path / "site"
        assert checker.main([str(site)]) == 2
        site.mkdir()
        (site / "style.css").write_text("body { color: black; }", encoding="utf-8")
        assert checker.main([str(site)]) == 2
        _page(site, "<html><body>Adaptive Learner</body></html>")
        assert checker.main([str(site)]) == 0

    def test_a_third_party_fetch_fails_the_scan(self, checker, tmp_path, capsys):
        _page(tmp_path, "<html><head>" + _MATERIAL_FONT_LINKS + "</head></html>")
        assert checker.main([str(tmp_path)]) == 1
        out = capsys.readouterr().out
        assert "EXTERNAL: index.html: <link rel=stylesheet> -> https://fonts.googleapis.com/" in out

    def test_a_pass_names_how_many_pages_it_read(self, checker, tmp_path, capsys):
        """Gate contract point 4: "0 findings" and "0 pages read" must not
        print the same OK."""
        _page(tmp_path, "<html><body>de</body></html>")
        _page(tmp_path, "<html><body>en</body></html>", "en/index.html")
        assert checker.main([str(tmp_path)]) == 0
        assert "2 HTML page(s) read" in capsys.readouterr().out
