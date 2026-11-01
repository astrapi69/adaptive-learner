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
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent
_SCRIPT = REPO / "scripts" / "emit_spa_route_pages.py"

_spec = importlib.util.spec_from_file_location("emit_spa_route_pages", _SCRIPT)
emit_spa_route_pages = importlib.util.module_from_spec(_spec)
# ``@dataclass`` resolves its module through sys.modules.
sys.modules[_spec.name] = emit_spa_route_pages
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


# --- #3819: one page per known set, so a short set link answers 200 -------

RAW = "https://raw.githubusercontent.com"
OFFICIAL = "astrapi69/adaptive-learner-content"
PIN = "a" * 40

#: Registry and indices in the shapes the content repos publish them.
REGISTRY = {
    "repos": [
        {"url": f"https://github.com/{OFFICIAL}", "branch": "main", "self": True},
        {
            "url": "https://github.com/astrapi69/alc-ai",
            "branch": "main",
            "commit": PIN,
            "validation": {"status": "validated", "validated_at": "2026-10-01T00:00:00Z"},
        },
        {
            "url": "https://github.com/jane/pending",
            "branch": "main",
            "commit": "b" * 40,
            "validation": {"status": "pending", "validated_at": "2026-10-01T00:00:00Z"},
        },
        {
            "url": "https://github.com/jane/unpinned",
            "branch": "main",
            "validation": {"status": "validated", "validated_at": "2026-10-01T00:00:00Z"},
        },
    ]
}


def _index(*ids: str, hidden: tuple[str, ...] = ()) -> dict:
    sets = [{"id": set_id, "name": set_id} for set_id in ids]
    sets += [{"id": set_id, "visibility": "hidden"} for set_id in hidden]
    return {"schema_version": "1.9", "sets": sets}


def _fetcher(documents: dict[str, dict]):
    """A fetch_json stand-in serving ``documents`` by URL; others fail."""
    requested: list[str] = []

    def fetch_json(url: str) -> object:
        requested.append(url)
        if url not in documents:
            raise OSError(f"404 {url}")
        return documents[url]

    fetch_json.requested = requested  # type: ignore[attr-defined]
    return fetch_json


def _documents() -> dict[str, dict]:
    return {
        f"{RAW}/{OFFICIAL}/main/recommended-repos.json": REGISTRY,
        f"{RAW}/{OFFICIAL}/main/search-index.json": _index(
            "fr-a1", "es-a1", hidden=("graded-quiz-demo",)
        ),
        f"{RAW}/astrapi69/alc-ai/{PIN}/search-index.json": _index("ki-einsteiger-from-de"),
        f"{RAW}/jane/pending/{'b' * 40}/search-index.json": _index("pending-set"),
        f"{RAW}/jane/unpinned/main/search-index.json": _index("unpinned-set"),
    }


def test_set_ids_follow_the_registry_contract_of_the_app() -> None:
    fetch = _fetcher(_documents())
    report = emit_spa_route_pages.registry_set_ids(fetch)
    # The official repo is branch-tracked, an external one is read at its
    # pinned commit; pending and unpinned entries are not searched by the
    # app, so a page for their sets would promise a set it cannot find.
    assert report.set_ids == ["es-a1", "fr-a1", "ki-einsteiger-from-de"]
    assert report.repos_read == 2
    assert report.repos_failed == []
    assert f"{RAW}/jane/pending/{'b' * 40}/search-index.json" not in fetch.requested


@pytest.mark.parametrize(
    "bad_id",
    ["../escape", "with space", "", "-leading-dash", "a/b", "x" * 129],
    ids=["dot-dot", "space", "empty", "leading-dash", "slash", "too-long"],
)
def test_an_id_that_is_no_safe_path_segment_gets_no_page(bad_id: str) -> None:
    documents = _documents()
    documents[f"{RAW}/astrapi69/alc-ai/{PIN}/search-index.json"] = _index(
        "ki-einsteiger-from-de", bad_id
    )
    report = emit_spa_route_pages.registry_set_ids(_fetcher(documents))
    assert bad_id not in report.set_ids
    assert report.skipped_ids == [bad_id]


def test_a_failing_repo_is_reported_and_the_others_still_count() -> None:
    documents = _documents()
    del documents[f"{RAW}/astrapi69/alc-ai/{PIN}/search-index.json"]
    report = emit_spa_route_pages.registry_set_ids(_fetcher(documents))
    assert report.set_ids == ["es-a1", "fr-a1"]
    assert report.repos_failed == ["astrapi69/alc-ai"]


def test_an_unreachable_registry_still_reads_the_official_repo() -> None:
    documents = _documents()
    del documents[f"{RAW}/{OFFICIAL}/main/recommended-repos.json"]
    report = emit_spa_route_pages.registry_set_ids(_fetcher(documents))
    assert report.set_ids == ["es-a1", "fr-a1"]
    assert report.registry_read is False


def test_set_pages_are_written_only_when_asked_for(
    fake_build: Path, capsys: pytest.CaptureFixture
) -> None:
    dist = fake_build / "frontend" / "dist"
    assert emit_spa_route_pages.main(["--repo-root", str(fake_build)]) == 0
    # The default run stays offline, as the local make target expects.
    assert not (dist / "content" / "set").exists()

    exit_code = emit_spa_route_pages.main(
        ["--repo-root", str(fake_build), "--set-pages"], fetch_json=_fetcher(_documents())
    )
    assert exit_code == 0
    for set_id in ("es-a1", "fr-a1", "ki-einsteiger-from-de"):
        page = dist / "content" / "set" / set_id / "index.html"
        assert page.read_text(encoding="utf-8") == INDEX_HTML
    out = capsys.readouterr().out
    assert "3 set page(s)" in out
    assert "2 repo(s) read" in out


def test_an_unreadable_registry_does_not_fail_the_deploy_but_says_so(
    fake_build: Path, capsys: pytest.CaptureFixture
) -> None:
    exit_code = emit_spa_route_pages.main(
        ["--repo-root", str(fake_build), "--set-pages"], fetch_json=_fetcher({})
    )
    # Without the pages a short link still opens the set, through the
    # 404.html fallback; failing the deploy over a network error would be
    # the worse outcome. The log names the gap instead.
    assert exit_code == 0
    out = capsys.readouterr().out
    assert "0 set page(s)" in out
    assert "WARNING" in out
    assert (fake_build / "frontend" / "dist" / "dashboard" / "index.html").is_file()
