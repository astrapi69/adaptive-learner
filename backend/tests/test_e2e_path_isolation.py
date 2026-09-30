"""Every path resolver is pinned in the e2e config (#2263).

The e2e backend must never reach the developer's real machine. #2248
closed the config-dir channel after the suite read the real
``secrets.yaml``; the inventory that followed found ``get_cache_dir``
still unpinned, so ``content_backup`` wrote into the developer's real
``~/.cache/adaptive_learner``.

This pins the CLASS, not the instance: every ``ADAPTIVE_LEARNER_*_DIR``
resolver that exists in ``app/paths.py`` must be set in the e2e
config's backend environment. A fourth resolver added later cannot
quietly stay unpinned - this test turns red the moment it is added.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PATHS_MODULE = REPO_ROOT / "backend" / "app" / "paths.py"
E2E_CONFIG = REPO_ROOT / "e2e" / "playwright.config.ts"

# Env vars read by the resolvers in app/paths.py.
RESOLVER_ENV_RE = re.compile(r'os\.environ\.get\("(ADAPTIVE_LEARNER_[A-Z_]*DIR)"\)')


def _declared_resolvers() -> set[str]:
    return set(RESOLVER_ENV_RE.findall(PATHS_MODULE.read_text(encoding="utf-8")))


def test_paths_module_declares_the_expected_resolver_set() -> None:
    """Point 4: name what was measured - an empty set must not read clean."""
    resolvers = _declared_resolvers()
    assert resolvers, "found no ADAPTIVE_LEARNER_*_DIR resolvers in paths.py - scan is broken"
    print(f"resolvers found in paths.py: {sorted(resolvers)}")
    assert "ADAPTIVE_LEARNER_DATA_DIR" in resolvers


def test_every_path_resolver_is_pinned_in_the_e2e_backend_env() -> None:
    config = E2E_CONFIG.read_text(encoding="utf-8")
    unpinned = sorted(env for env in _declared_resolvers() if f"{env}=" not in config)
    assert not unpinned, (
        f"{unpinned} not pinned in {E2E_CONFIG.relative_to(REPO_ROOT)} - the e2e backend "
        "would resolve them against the developer's real machine (#2248/#2263). Add each "
        "to the BACKEND_ENV block, pointing inside the throwaway e2e data dir."
    )


def test_pinned_values_stay_inside_the_throwaway_dir() -> None:
    """A pin that points at a real user directory is not isolation."""
    config = E2E_CONFIG.read_text(encoding="utf-8")
    for env in sorted(_declared_resolvers()):
        for match in re.finditer(rf"{env}=(\S+?)`", config):
            value = match.group(1)
            assert "E2E_DATA_DIR" in value or value.startswith("/tmp/"), (
                f"{env} is pinned to {value!r}, which is not inside the throwaway e2e dir"
            )


# #3316: a smoke run while ``make dev`` is up must never reach the developer's
# backend. Two properties per config that starts a uvicorn backend: its
# default ports differ from the ``make dev`` pair, and the backend entry
# never reuses a server Playwright did not start (the reset specs call
# ``POST /api/reset``, which wipes whatever database answers).
MAKEFILE = REPO_ROOT / "Makefile"
E2E_DIR = REPO_ROOT / "e2e"


def _make_dev_ports() -> tuple[str, str]:
    makefile = MAKEFILE.read_text(encoding="utf-8")
    backend = re.search(r"BACKEND_PORT\s*\?=.*?,(\d+)\)", makefile)
    frontend = re.search(r"FRONTEND_PORT\s*\?=.*?,(\d+)\)", makefile)
    assert backend and frontend, "Makefile dev ports not found"
    return backend.group(1), frontend.group(1)


def _backend_starting_configs() -> list[Path]:
    configs = [
        path
        for path in sorted(E2E_DIR.glob("playwright*.config.ts"))
        if "uvicorn app.main:app" in path.read_text(encoding="utf-8")
    ]
    assert configs, "no e2e config starts a backend - the probe set is empty"
    return configs


def test_backend_starting_configs_default_to_ports_other_than_make_dev() -> None:
    dev_backend, dev_frontend = _make_dev_ports()
    for config in _backend_starting_configs():
        text = config.read_text(encoding="utf-8")
        defaults = re.findall(r"PORT\)\s*\|\|\s*(\d+)", text)
        assert defaults, f"{config.name}: no port default found"
        for port in defaults:
            assert port not in (dev_backend, dev_frontend), (
                f"{config.name} defaults to port {port}, the make dev port - a local run "
                "would reuse the developer's backend and reset its database (#3316)"
            )


def test_backend_starting_configs_never_reuse_a_backend_they_did_not_start() -> None:
    for config in _backend_starting_configs():
        text = config.read_text(encoding="utf-8")
        start = text.index("uvicorn app.main:app")
        reuse = re.search(r"reuseExistingServer:\s*([^,\n]+)", text[start:])
        assert reuse and reuse.group(1).strip() == "false", (
            f"{config.name}: the backend webServer entry must set reuseExistingServer: false "
            "(#3316) - a reused backend is one whose data dir this run did not choose"
        )


def test_smoke_frontend_proxies_api_to_the_backend_this_run_started() -> None:
    """The smoke vite server must proxy ``/api`` to its own backend.

    ``frontend/vite.config.ts`` takes ``VITE_API_PROXY_TARGET`` before
    ``ADAPTIVE_LEARNER_PORT``. Without a pin in the smoke command, a value
    exported in the developer's shell (Docker Compose uses it) would send the
    reset specs' ``POST /api/reset`` to that other backend (#3316).
    """
    text = (E2E_DIR / "playwright.config.ts").read_text(encoding="utf-8")
    command = re.search(r"cd \.\./frontend.*?npm run dev", text, re.DOTALL)
    assert command, "playwright.config.ts: no frontend webServer command found"
    assert "VITE_API_PROXY_TARGET=http://localhost:${BACKEND_PORT}" in command.group(0), (
        "the smoke frontend command must pin VITE_API_PROXY_TARGET to this run's "
        f"backend (#3316); found: {command.group(0)!r}"
    )
