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

The route list is PARSED from the router rather than hand-maintained.
The deploy workflow previously copied one route (``/content``) by hand,
and the other seventeen were simply never added; a derived list cannot
drift from the router that way.

Run it after the frontend build (the emitted copies must not enter the
service worker's precache manifest, which is computed during the build):

    python3 scripts/emit_spa_route_pages.py

stdlib only (argparse + pathlib + re).
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

#: ``<Route path="/dashboard" ...>`` in the router.
ROUTE_PATTERN = re.compile(r'path="(/[^"]*)"')


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


def main(argv: list[str] | None = None) -> int:
    """CLI entry point; returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path.cwd(),
        help="repository root (default: cwd)",
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
