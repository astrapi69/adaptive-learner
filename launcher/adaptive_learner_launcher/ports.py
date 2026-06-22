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

import socket


def is_available(port: int, *, host: str = "") -> bool:
    """Return True if a TCP server could bind ``port`` on ``host``.

    ``host=""`` binds all interfaces, mirroring how Docker publishes a
    port. ``SO_REUSEADDR`` is intentionally NOT set: we want the bind to
    fail when another process already holds the port so a live conflict
    is detected rather than masked.
    """
    if not 1 <= port <= 65535:
        return False
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
    except OSError:
        return False
    finally:
        sock.close()
    return True


def find_available(start: int, *, host: str = "", max_tries: int = 100) -> int | None:
    """Return the first available port at or above ``start``.

    Scans ``start, start+1, ...`` up to ``max_tries`` candidates, never
    past 65535. Returns ``None`` when no free port is found in range.
    """
    port = start
    for _ in range(max_tries):
        if port > 65535:
            return None
        if is_available(port, host=host):
            return port
        port += 1
    return None
