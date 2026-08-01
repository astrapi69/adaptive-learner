"""The prod compose binds to loopback unless told otherwise (security).

Launcher engine 0.26.0 fixed its half: it published the container on
every interface (IPv4 and IPv6) in all three modes, so the app - with no
authentication and the user's AI provider keys in it - was reachable
from any network the machine sits in. This is the app's half: the
documented power-user path, ``docker-compose.prod.yml``, must not
publish on all interfaces either.

Loopback is the DEFAULT, network exposure an explicit opt-in via
``ADAPTIVE_LEARNER_BIND_ADDRESS``. Structure is pinned by text so the
check means the same thing in every environment (the release-gate
container has no docker CLI, #2241); the resolved-config proof runs
wherever a docker CLI exists and skips loudly otherwise.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
COMPOSE = REPO_ROOT / "docker-compose.prod.yml"


def test_the_published_port_binds_to_loopback_by_default() -> None:
    text = COMPOSE.read_text(encoding="utf-8")
    assert re.search(
        r'-\s*"\$\{ADAPTIVE_LEARNER_BIND_ADDRESS:-127\.0\.0\.1\}:'
        r'\$\{ADAPTIVE_LEARNER_PUBLIC_PORT:-8501\}:',
        text,
    ), (
        "the port mapping must bind 127.0.0.1 by default - an unqualified "
        "host port publishes on every interface, which is what the launcher "
        "engine 0.26.0 had to fix on its side"
    )


def test_no_port_mapping_publishes_unqualified() -> None:
    """Any future service must not reintroduce an all-interfaces mapping."""
    text = COMPOSE.read_text(encoding="utf-8")
    mappings = re.findall(r'^\s*-\s*"([^"]+:[^"]+)"\s*$', text, flags=re.M)
    port_maps = [m for m in mappings if re.search(r":\d|:\$\{", m)]
    assert port_maps, "found no port mappings - the scan is broken, not the file"
    unqualified = [
        m for m in port_maps if not m.startswith("${ADAPTIVE_LEARNER_BIND_ADDRESS")
    ]
    assert not unqualified, (
        f"port mapping(s) {unqualified} publish on every interface; bind them "
        "through ADAPTIVE_LEARNER_BIND_ADDRESS like the app service does"
    )


@pytest.mark.skipif(shutil.which("docker") is None, reason="docker CLI unavailable")
def test_resolved_config_binds_loopback_and_honours_the_opt_in() -> None:
    plain = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE), "config"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        env={"PATH": "/usr/bin:/bin", "HOME": str(Path.home())},
    )
    assert plain.returncode == 0, plain.stderr
    assert "127.0.0.1" in plain.stdout, "default config does not bind loopback"

    opened = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE), "config"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        env={
            "PATH": "/usr/bin:/bin",
            "HOME": str(Path.home()),
            "ADAPTIVE_LEARNER_BIND_ADDRESS": "0.0.0.0",
        },
    )
    assert opened.returncode == 0, opened.stderr
    assert "0.0.0.0" in opened.stdout, "the deliberate opt-in does not take effect"
