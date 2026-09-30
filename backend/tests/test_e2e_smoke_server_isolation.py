"""The e2e smoke run never reaches a server it did not start (#3316).

The smoke specs call ``POST /api/reset`` (``e2e/smoke/landing.spec.ts``,
``e2e/smoke/mobile-viewports.spec.ts``), the Settings Danger Zone endpoint
that wipes every learner row. Before #3316 ``e2e/playwright.config.ts``
defaulted to the ``make dev`` ports and set
``reuseExistingServer: !process.env.CI``, so a local smoke run while
``make dev`` was up started no backend of its own: it reused the
developer's running one and reset the real database. The ``db_guard``
tripwire cannot stop that, because the running app has marked itself as
the app runtime.

Two properties close it, each pinned here:

- no smoke web server is ever reused. Whatever already answers on a smoke
  port makes Playwright refuse to start the run; it is never talked to.
  The frontend counts as much as the backend: a reused dev frontend
  proxies ``/api`` to the dev backend.
- the smoke ports (defaults AND override env names) differ from the
  ``make dev`` pair and from every other e2e config, so a running
  ``make dev`` does not turn the release-mandatory smoke into a refusal.

The throwaway data dir itself is pinned by ``test_e2e_path_isolation.py``.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
MAKEFILE = REPO_ROOT / "Makefile"
E2E_DIR = REPO_ROOT / "e2e"
SMOKE_CONFIG = E2E_DIR / "playwright.config.ts"

ROLES = ("BACKEND_PORT", "FRONTEND_PORT")
ROLE_IDS = ["backend", "frontend"]

# ``BACKEND_PORT  ?= $(or $(ADAPTIVE_LEARNER_PORT),18001)``
MAKE_PORT_RE = re.compile(
    r"^(BACKEND_PORT|FRONTEND_PORT)\s*\?=\s*\$\(or \$\((\w+)\),(\d+)\)", re.MULTILINE
)
# ``const BACKEND_PORT = Number(process.env.X) || 18021;`` (may wrap)
CONFIG_PORT_RE = re.compile(
    r"^const (BACKEND_PORT|FRONTEND_PORT)\s*=\s*Number\(process\.env\.(\w+)\)\s*\|\|\s*(\d+);",
    re.MULTILINE,
)
# Any ``Number(process.env.X) || 4173`` default in another e2e config.
DEFAULT_PORT_RE = re.compile(r"Number\(process\.env\.(\w+)\)\s*\|\|\s*(\d+)")
WEB_SERVER_COMMAND_RE = re.compile(r"^\s*command:", re.MULTILINE)
# Anchored to a code line, so the header comment that names the key is no match.
REUSE_RE = re.compile(r"^\s*reuseExistingServer:\s*([^,\n]+),", re.MULTILINE)


def _ports(pattern: re.Pattern[str], path: Path) -> dict[str, tuple[str, int]]:
    """Map each port role to its (override env name, default port) in ``path``.

    Fails closed: a role the scan cannot find is a broken scan, never a
    clean result (gate contract point 3).
    """
    found = {role: (env, int(port)) for role, env, port in pattern.findall(path.read_text("utf-8"))}
    missing = [role for role in ROLES if role not in found]
    assert not missing, (
        f"no {missing} declaration found in {path.name} - the scan is broken, not clean"
    )
    return found


def _make_dev_ports() -> dict[str, tuple[str, int]]:
    return _ports(MAKE_PORT_RE, MAKEFILE)


def _smoke_ports() -> dict[str, tuple[str, int]]:
    return _ports(CONFIG_PORT_RE, SMOKE_CONFIG)


def test_the_scan_reads_both_port_pairs() -> None:
    """Point 4: name what was measured, so an empty scan cannot read clean."""
    make_dev = _make_dev_ports()
    smoke = _smoke_ports()
    print(f"make dev ports: {make_dev}")
    print(f"smoke ports:    {smoke}")


@pytest.mark.parametrize(
    ("pattern", "declaration"),
    [
        (MAKE_PORT_RE, "BACKEND_PORT  ?= $(or $(ADAPTIVE_LEARNER_PORT),18001)\n"),
        (CONFIG_PORT_RE, "const BACKEND_PORT = Number(process.env.X_PORT) || 18021;\n"),
    ],
    ids=["makefile", "smoke-config"],
)
def test_the_scan_fails_closed_when_a_port_declaration_is_missing(
    tmp_path: Path, pattern: re.Pattern[str], declaration: str
) -> None:
    """Point 3: a reshaped declaration the regex no longer reads is red, never clean."""
    source = tmp_path / "ports.txt"
    source.write_text(declaration, encoding="utf-8")
    with pytest.raises(AssertionError, match="scan is broken"):
        _ports(pattern, source)


@pytest.mark.parametrize("role", ROLES, ids=ROLE_IDS)
def test_smoke_default_port_differs_from_the_make_dev_port(role: str) -> None:
    _make_env, make_port = _make_dev_ports()[role]
    _smoke_env, smoke_port = _smoke_ports()[role]
    assert smoke_port != make_port, (
        f"smoke {role} defaults to {smoke_port}, the make dev port - a running "
        "make dev either gets reset by the smoke run or blocks it (#3316)"
    )


@pytest.mark.parametrize("role", ROLES, ids=ROLE_IDS)
def test_smoke_port_override_does_not_read_the_make_dev_env_var(role: str) -> None:
    """A shell that exported the make dev env var must not steer the smoke run."""
    make_env, _make_port = _make_dev_ports()[role]
    smoke_env, _smoke_port = _smoke_ports()[role]
    assert smoke_env != make_env, (
        f"smoke {role} is overridden by {make_env}, the variable make dev reads - "
        "a shell that set it for make dev points the smoke run at the dev server (#3316)"
    )


def test_no_smoke_web_server_is_ever_reused() -> None:
    config = SMOKE_CONFIG.read_text("utf-8")
    servers = len(WEB_SERVER_COMMAND_RE.findall(config))
    reuse_values = [value.strip() for value in REUSE_RE.findall(config)]
    print(f"web servers: {servers}, reuseExistingServer values: {reuse_values}")
    assert servers >= 2, "found fewer than the backend + frontend web servers - scan is broken"
    assert reuse_values == ["false"] * servers, (
        f"every smoke web server must declare reuseExistingServer: false, found {reuse_values} - "
        "a reused backend (or a reused frontend proxying to one) is a server the run did not "
        "start with a throwaway data dir, and the smoke specs call POST /api/reset (#3316)"
    )


def test_smoke_frontend_proxies_to_the_smoke_backend_only() -> None:
    """``VITE_API_PROXY_TARGET`` outranks the port in vite.config.ts.

    Left to the shell, an exported value would route ``/api`` - and with it
    ``/api/reset`` - to whatever backend it names.
    """
    config = SMOKE_CONFIG.read_text("utf-8")
    assert "VITE_API_PROXY_TARGET=http://localhost:${BACKEND_PORT}" in config, (
        "the smoke frontend command must pin VITE_API_PROXY_TARGET to the smoke backend"
    )


def test_smoke_ports_collide_with_no_other_e2e_config() -> None:
    others: dict[int, list[str]] = {}
    for other in sorted(E2E_DIR.glob("playwright.*.config.ts")):
        for _env, port in DEFAULT_PORT_RE.findall(other.read_text("utf-8")):
            others.setdefault(int(port), []).append(other.name)
    print(f"default ports of the other e2e configs: {others}")
    assert others, "found no default port in any other e2e config - scan is broken"
    for role, (_env, port) in _smoke_ports().items():
        assert port not in others, (
            f"smoke {role} {port} is also the default of {others[port]} - the two runs "
            "would meet on one port"
        )
