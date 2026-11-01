#!/usr/bin/env python3
"""emit_spa_route_pages.py - give every static SPA route a real file (#2543).

GitHub Pages serves static files and nothing else: there is no rewrite
rule, so a request for ``/adaptive-learner/dashboard`` finds no file and
Pages answers with ``404.html`` and an HTTP **404 status**. The app
renders fine (404.html is a copy of the built shell), but every deep
link logs a console error, and a crawler or link-preview fetcher
following a shared URL is told the page does not exist.

The fix is to make the file exist. For each STATIC route the router
declares, this writes ``dist/<route>/index.html`` as a byte copy of the
built ``dist/index.html``; Pages then answers 200 and serves the same
shell, which boots into the same route.

Parameterised routes (``/review/:setId``,
``/lesson/:setSlug/:setId/:filename``) cannot be covered this way - no
finite set of files spans them - so they keep the ``404.html`` fallback.
That is a real remaining limit, not an oversight: it is why 404.html is
still written here.

One parameterised route gets its known values (#3819): with
``--set-pages`` the script reads the set ids the app can resolve - the
official repo's search index and those of the validated registry repos -
and writes ``dist/content/set/<id>/index.html`` for each, so a short set
link answers 200. It reads the network, so only the deploy passes the
flag. A set added after the deploy, or one of a repo outside the
registry, keeps the 404.html fallback; it still opens.

The route list is PARSED from the router rather than hand-maintained.
The deploy workflow previously copied one route (``/content``) by hand,
and the other seventeen were simply never added; a derived list cannot
drift from the router that way.

Run it after the frontend build (the emitted copies must not enter the
service worker's precache manifest, which is computed during the build):

    python3 scripts/emit_spa_route_pages.py [--set-pages]

stdlib only (argparse + json + pathlib + re + urllib).
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

#: ``<Route path="/dashboard" ...>`` in the router.
ROUTE_PATTERN = re.compile(r'path="(/[^"]*)"')

#: Where the app reads the registry and the search indices
#: (``recommended-repos.ts``, ``search-index-loader.ts``).
RAW_BASE = "https://raw.githubusercontent.com"
OFFICIAL_SOURCE = "astrapi69/adaptive-learner-content"
REGISTRY_FILE = "recommended-repos.json"
SEARCH_INDEX_FILE = "search-index.json"

#: A set id usable as one path segment: no separator, no ``..``.
SET_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")

#: ``owner/repo`` out of a GitHub URL or the shorthand itself.
REPO_SOURCE_PATTERN = re.compile(
    r"^(?:https?://github\.com/)?([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+?)(?:\.git)?/?$"
)

FetchJson = Callable[[str], object]


def static_routes(router_path: Path) -> list[str]:
    """Return the router's static route paths, sorted, without the root.

    A route containing ``:`` takes a parameter and cannot be pre-rendered;
    ``/`` is already served by ``index.html`` itself.

    Args:
        router_path: the module declaring the routes (``App.tsx``).

    Returns:
        Sorted, de-duplicated route paths such as ``["/dashboard", ...]``.

    Raises:
        FileNotFoundError: when the router module does not exist.
    """
    text = router_path.read_text(encoding="utf-8")
    found = {
        route
        for route in ROUTE_PATTERN.findall(text)
        if ":" not in route and route != "/"
    }
    return sorted(found)


def emit(dist: Path, routes: list[str]) -> list[str]:
    """Write one ``<route>/index.html`` copy per route; return what was written."""
    shell = dist / "index.html"
    written: list[str] = []
    for route in routes:
        target = dist / route.lstrip("/") / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(shell, target)
        written.append(route)
    return written


@dataclass
class SetIdReport:
    """What :func:`registry_set_ids` read, for the deploy log."""

    set_ids: list[str] = field(default_factory=list)
    repos_read: int = 0
    repos_failed: list[str] = field(default_factory=list)
    skipped_ids: list[str] = field(default_factory=list)
    registry_read: bool = True


def _repo_source(url: object) -> str | None:
    """``owner/repo`` for a registry ``url``, or None when it names no repo."""
    match = REPO_SOURCE_PATTERN.match(url) if isinstance(url, str) else None
    return f"{match.group(1)}/{match.group(2)}" if match else None


def searched_repos(registry: object) -> list[tuple[str, str]]:
    """The external repos the app searches, as ``(owner/repo, ref)``.

    Mirrors ``collectDiscoveryRepos``: only a validated entry counts, and an
    external one only with a pinned ``commit``, which is the ref read. The
    official ``self`` entry is not returned; the caller reads it at ``main``.

    Args:
        registry: the parsed ``recommended-repos.json``.

    Returns:
        The repos in registry order, without duplicates.
    """
    entries = registry.get("repos") if isinstance(registry, dict) else None
    repos: list[tuple[str, str]] = []
    seen = {OFFICIAL_SOURCE}
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict) or entry.get("self") is True:
            continue
        validation = entry.get("validation")
        if not isinstance(validation, dict) or validation.get("status") != "validated":
            continue
        source = _repo_source(entry.get("url"))
        commit = entry.get("commit")
        if not source or source in seen or not isinstance(commit, str) or not commit:
            continue
        seen.add(source)
        repos.append((source, commit))
    return repos


def _index_ids(index: object) -> list[str]:
    """The ids of the visible sets of a parsed ``search-index.json``."""
    sets = index.get("sets") if isinstance(index, dict) else None
    return [
        entry.get("id") if isinstance(entry.get("id"), str) else ""
        for entry in (sets if isinstance(sets, list) else [])
        if isinstance(entry, dict) and entry.get("visibility") != "hidden"
    ]


def registry_set_ids(fetch_json: FetchJson) -> SetIdReport:
    """Collect the set ids a short set link can resolve.

    Reads the official repo's index at ``main`` and the index of every repo
    :func:`searched_repos` names. A repo that cannot be read is reported and
    skipped; an id that is not a safe path segment is reported and gets no
    page.

    Args:
        fetch_json: fetches a URL and returns the parsed JSON; raises on
            any failure.

    Returns:
        The sorted, unique ids and what was read.
    """
    report = SetIdReport()
    try:
        registry = fetch_json(f"{RAW_BASE}/{OFFICIAL_SOURCE}/main/{REGISTRY_FILE}")
    except (OSError, ValueError):
        registry, report.registry_read = None, False
    ids: set[str] = set()
    for source, ref in [(OFFICIAL_SOURCE, "main"), *searched_repos(registry)]:
        try:
            index = fetch_json(f"{RAW_BASE}/{source}/{ref}/{SEARCH_INDEX_FILE}")
        except (OSError, ValueError):
            report.repos_failed.append(source)
            continue
        report.repos_read += 1
        for set_id in _index_ids(index):
            if SET_ID_PATTERN.fullmatch(set_id):
                ids.add(set_id)
            else:
                report.skipped_ids.append(set_id)
    report.set_ids = sorted(ids)
    return report


def fetch_json_over_network(url: str) -> object:
    """GET ``url`` and parse it as JSON (20 s timeout)."""
    with urllib.request.urlopen(url, timeout=20) as response:
        return json.load(response)


def emit_set_pages(dist: Path, set_ids: list[str]) -> list[str]:
    """Write ``content/set/<id>/index.html`` per id; return the routes written."""
    return emit(dist, [f"/content/set/{set_id}" for set_id in set_ids])


def _print_set_report(report: SetIdReport, written: list[str]) -> None:
    """Log what the set-page step read, so an empty run cannot pass as done."""
    print(f"spa-route-pages: {len(written)} set page(s) from {report.repos_read} repo(s) read")
    if not report.registry_read:
        print("  WARNING: the registry could not be read; only the official repo counts")
    if report.repos_failed:
        print(f"  WARNING: repos not read: {', '.join(report.repos_failed)}")
    if report.skipped_ids:
        print(f"  WARNING: ids that are no safe path segment: {report.skipped_ids!r}")
    if not written:
        print("  WARNING: no set pages; short set links fall back to 404.html")


def main(argv: list[str] | None = None, fetch_json: FetchJson | None = None) -> int:
    """CLI entry point; returns the process exit code.

    Args:
        argv: the command line, without the program name.
        fetch_json: replaces the network read of ``--set-pages`` in tests.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path.cwd(),
        help="repository root (default: cwd)",
    )
    parser.add_argument(
        "--set-pages",
        action="store_true",
        help="also write content/set/<id>/index.html per registry set (reads the network)",
    )
    args = parser.parse_args(argv)

    router = args.repo_root / "frontend" / "src" / "App.tsx"
    dist = args.repo_root / "frontend" / "dist"
    shell = dist / "index.html"

    # Fail closed: "I could not look" must never report as "nothing to do",
    # or a broken build ships with every deep link back on 404.
    if not shell.is_file():
        print(f"ERROR: {shell} not found - build the frontend first")
        return 1
    if not router.is_file():
        print(f"ERROR: {router} not found - cannot derive the route list")
        return 1

    routes = static_routes(router)
    if not routes:
        print(f"ERROR: no static routes parsed from {router} (router shape changed?)")
        return 1

    # The parameterised routes have no finite file set; they keep this.
    shutil.copyfile(shell, dist / "404.html")

    written = emit(dist, routes)
    print(f"spa-route-pages: emitted {len(written)} route page(s) + 404.html")
    print(f"  {', '.join(written)}")

    if args.set_pages:
        report = registry_set_ids(fetch_json or fetch_json_over_network)
        _print_set_report(report, emit_set_pages(dist, report.set_ids))
    return 0


if __name__ == "__main__":
    sys.exit(main())
