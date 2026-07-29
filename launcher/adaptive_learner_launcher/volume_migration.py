"""Guard the data volume across the compose -> docker-py rename (#2154).

Compose prefixes volume names with the project name, so the compose path
created ``adaptive-learner_adaptive-learner-data``. ``launcher.json``
since #2100 declares the plain ``adaptive-learner-data``, which docker-py
takes literally - and Docker creates silently if absent. A user who
installed while the launcher used compose, then updated, got a container
with an empty database while their projects, sessions and the Fernet
``secret.key`` sat in the other volume, invisible and unmentioned.

The config now names the prefixed volume, so existing data is found
without the user doing anything. That is safe in every case but one: if
BOTH volumes exist and BOTH hold data, either choice strands something -
the old data under the plain name, or the data written since #2100 under
the prefixed one. There the launcher stops and says so, because deciding
silently between two sets of somebody's learning history is not a
decision a program gets to make.

Example::

    problem = describe_conflict(docker.from_env(), "adaptive-learner")
    if problem:
        print(problem, file=sys.stderr)
        return 6
"""

from __future__ import annotations

from typing import Any

LEGACY_VOLUME = "adaptive-learner-data"
COMPOSE_VOLUME = "adaptive-learner_adaptive-learner-data"
# Files Docker or the app create on their own; their presence alone does
# not make a volume "in use" by a human.
INCIDENTAL = {"lost+found"}


def volume_entries(client: Any, name: str) -> list[str] | None:
    """Top-level entries of ``name``, or ``None`` when it does not exist."""
    try:
        client.volumes.get(name)
    except Exception:  # noqa: BLE001 - not found, or an API hiccup: treat as absent
        return None
    try:
        raw = client.containers.run(
            "alpine",
            ["sh", "-c", "ls -A /probe 2>/dev/null || true"],
            volumes={name: {"bind": "/probe", "mode": "ro"}},
            remove=True,
        )
    except Exception:  # noqa: BLE001 - cannot inspect: say so, do not guess
        return []
    text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
    return [line.strip() for line in text.splitlines() if line.strip()]


def has_data(entries: list[str] | None) -> bool:
    """True when a human's data plausibly lives here."""
    if not entries:
        return False
    return bool(set(entries) - INCIDENTAL)


def describe_conflict(client: Any) -> str | None:
    """The refusal message when both volumes hold data, else ``None``.

    Returns ``None`` in every safe case: only one volume exists, only one
    has data, or neither does. Those need no decision - the config points
    at the compose volume and the data is simply found.
    """
    legacy = volume_entries(client, LEGACY_VOLUME)
    compose = volume_entries(client, COMPOSE_VOLUME)
    if not (has_data(legacy) and has_data(compose)):
        return None

    return "\n".join(
        [
            "Two data volumes hold data, and the launcher will not choose between them:",
            f"  {COMPOSE_VOLUME}",
            f"    created by the Compose path - {len(compose or [])} entries",
            f"  {LEGACY_VOLUME}",
            f"    created by the launcher since #2100 - {len(legacy or [])} entries",
            "",
            "The launcher now uses the first one, so data from the Compose era is",
            "found again. Anything written into the second one since then would be",
            "left behind - which is why this is your call, not the program's.",
            "",
            "Inspect either without changing it:",
            f"  docker run --rm -v {COMPOSE_VOLUME}:/d:ro alpine ls -la /d",
            f"  docker run --rm -v {LEGACY_VOLUME}:/d:ro alpine ls -la /d",
            "",
            "Then keep the one you want and rename or remove the other. Only the",
            "database, the uploads and .config/adaptive_learner (which holds the",
            "encryption key for stored provider keys) matter; .cache is derived.",
            "Browser-storage mode is unaffected - that data never lived here.",
        ]
    )
