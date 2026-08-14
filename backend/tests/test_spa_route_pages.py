"""Tests for ``scripts/emit_spa_route_pages.py`` (#2543).

GitHub Pages has no server-side rewrite: it answers an unmatched path
with ``404.html`` and a 404 STATUS, so every deep link into the SPA
logged a console error and handed crawlers a 404 for a page that
renders fine. The deploy workflow already copied the built shell to
one route directory by hand (``/content``); this script generalises
that to every STATIC route the router declares.

The tests build a real dist + router shape in ``tmp_path`` and drive
the CLI, per the lesson "test a tool through the interface it actually
uses": the script resolves paths itself, and a mocked filesystem would
hide exactly that.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent
_SCRIPT = REPO / "scripts" / "emit_spa_route_pages.py"

_spec = importlib.util.spec_from_file_location("emit_spa_route_pages", _SCRIPT)
emit_spa_route_pages = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(emit_spa_route_pages)


APP_TSX = """
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/content" element={<Content />} />
      <Route path="/content/set/:setId" element={<SetDetail />} />
      <Route path="/review/:setId" element={<Review />} />
      <Route path="/lesson/:setSlug/:setId/:filename" element={<Lesson />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
"""

INDEX_HTML = "<!DOCTYPE html><html><body><div id=root></div></body></html>"


@pytest.fixture()
def fake_build(tmp_path: Path) -> Path:
    """A repo shape with a built dist and a router to read routes from."""
    app = tmp_path / "frontend" / "src"
    app.mkdir(parents=True)
    (app / "App.tsx").write_text(APP_TSX, encoding="utf-8")
    dist = tmp_path / "frontend" / "dist"
    dist.mkdir(parents=True)
    (dist / "index.html").write_text(INDEX_HTML, encoding="utf-8")
    return tmp_path


def test_static_routes_are_parsed_and_parameterised_ones_skipped(
    fake_build: Path,
) -> None:
    routes = emit_spa_route_pages.static_routes(
        fake_build / "frontend" / "src" / "App.tsx"
    )
    assert routes == ["/content", "/dashboard", "/settings"]


def test_emits_one_index_html_per_static_route(fake_build: Path) -> None:
    exit_code = emit_spa_route_pages.main(["--repo-root", str(fake_build)])
    assert exit_code == 0

    dist = fake_build / "frontend" / "dist"
    for route in ("dashboard", "settings", "content"):
        emitted = dist / route / "index.html"
        assert emitted.is_file(), f"{route}/index.html missing"
        # A byte copy: a hand-edited or truncated shell would boot differently
        # from the real entry point.
        assert emitted.read_text(encoding="utf-8") == INDEX_HTML


def test_writes_the_404_fallback_for_the_parameterised_remainder(
    fake_build: Path,
) -> None:
    emit_spa_route_pages.main(["--repo-root", str(fake_build)])
    fallback = fake_build / "frontend" / "dist" / "404.html"
    assert fallback.read_text(encoding="utf-8") == INDEX_HTML


def test_does_not_emit_directories_for_parameterised_routes(
    fake_build: Path,
) -> None:
    emit_spa_route_pages.main(["--repo-root", str(fake_build)])
    dist = fake_build / "frontend" / "dist"
    # ":setId" can take any value, so no finite set of files covers it -
    # those keep the 404.html fallback and that limit stays visible.
    assert not (dist / "review").exists()
    assert not (dist / "lesson").exists()


def test_reports_what_it_emitted(fake_build: Path, capsys: pytest.CaptureFixture) -> None:
    emit_spa_route_pages.main(["--repo-root", str(fake_build)])
    out = capsys.readouterr().out
    # A gate that prints nothing lets "0 routes emitted" read like success.
    assert "3" in out
    assert "dashboard" in out


def test_fails_closed_when_the_build_is_missing(fake_build: Path) -> None:
    (fake_build / "frontend" / "dist" / "index.html").unlink()
    assert emit_spa_route_pages.main(["--repo-root", str(fake_build)]) == 1


def test_fails_closed_when_the_router_is_missing(fake_build: Path) -> None:
    (fake_build / "frontend" / "src" / "App.tsx").unlink()
    assert emit_spa_route_pages.main(["--repo-root", str(fake_build)]) == 1


def test_the_real_router_still_exposes_static_routes() -> None:
    """Guard the parser against a router refactor that changes the shape.

    If ``path="..."`` ever stops being how routes are declared, the parser
    would silently return an empty list and every deep link would go back
    to 404 - with the emit step still reporting success.
    """
    routes = emit_spa_route_pages.static_routes(REPO / "frontend" / "src" / "App.tsx")
    assert len(routes) >= 10
    assert "/dashboard" in routes
    assert "/settings" in routes
    assert not [route for route in routes if ":" in route]
