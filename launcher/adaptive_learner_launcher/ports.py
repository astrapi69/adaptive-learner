"""Host TCP port availability checks.

Used by the launcher to detect a port conflict (for example with another
application such as Bibliogon that already published the same host port)
*before* invoking ``docker compose up``. Docker publishes a port by
binding it on all interfaces, so we probe the same way: an attempt to
bind ``("", port)`` fails with ``OSError`` (EADDRINUSE) when the port is
already taken.

Kept dependency-free (stdlib ``socket`` only) so it works inside the
PyInstaller bundle without bundling ``lsof``/``netstat`` or shelling out.
"""

from __future__ import annotations

from adaptive_learner_launcher import actions


def is_available(port: int, *, host: str = "") -> bool:
    """Return True if a TCP server could bind ``port`` on ``host``.

    Thin wrapper over :func:`actions.check_port` (the single source of
    truth, which probes by BIND the same way Docker publishes a port).
    """
    free, _ = actions.check_port(port, host=host)
    return free


def find_available(start: int, *, host: str = "", max_tries: int = 100) -> int | None:
    """Return the first available port at or above ``start``, or ``None``.

    Thin wrapper over :func:`actions.find_free_port`.
    """
    found, port, _ = actions.find_free_port(start, max_tries=max_tries)
    return port if found else None
