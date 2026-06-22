"""Health-check polling for the AdaptiveLearner backend.

Thin wrappers over the actions layer (#970), which owns the HTTP probe
logic (HTTP 200 + JSON ``status == "ok"``). ``wait_for_healthy`` keeps its
injectable ``clock``/``sleep`` so callers/tests can drive time
deterministically.
"""

from __future__ import annotations

import time

from adaptive_learner_launcher import actions

HEALTH_PATH = actions.HEALTH_PATH


def is_healthy(port: int, *, timeout: float = 2.0) -> bool:
    """One shot: True if the backend answers healthy. Wrapper over actions."""
    return actions.is_healthy(port)


def wait_for_healthy(
    port: int,
    *,
    timeout_seconds: float = 60.0,
    interval_seconds: float = 0.5,
    clock: callable = time.monotonic,
    sleep: callable = time.sleep,
) -> bool:
    """Poll ``is_healthy`` until True or ``timeout_seconds`` elapses.

    ``clock`` and ``sleep`` are injectable for deterministic unit tests.
    """
    deadline = clock() + timeout_seconds
    while clock() < deadline:
        if is_healthy(port):
            return True
        sleep(interval_seconds)
    return False
