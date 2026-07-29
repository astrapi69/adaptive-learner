"""A Docker client config without credential resolution (#2126).

Before a build, docker-py enumerates EVERY registry in the user's
``~/.docker/config.json`` and executes ``docker-credential-<name>`` for
each (``docker/auth.py:285``, reached from ``api/build.py:261``). A
leftover ``credsStore: gcloud`` with no binary on PATH therefore aborts
the build with ``StoreError`` - on a machine where nothing about Docker
is actually wrong. The CLI is lenient here; the SDK is not.

The application asks for none of this. Every ``FROM`` in
``backend/Dockerfile`` is a public Docker Hub library image; nothing is
pushed, and nothing private is pulled. The resolution happens only
because the library reads the user's config on its own initiative.

So the credentials are removed rather than tolerated - no try/except, no
fallback, no "continue on error". What is NOT removed matters just as
much:

``currentContext``
    ``docker/context/config.py:54`` resolves the contexts directory
    RELATIVE to the config file, and the current context names the
    daemon to talk to. Pointing ``DOCKER_CONFIG`` at an empty directory
    would silently switch a Docker-Desktop or rootless user to the
    default socket - trading a loud failure for a quiet one.

``proxies``
    Carried over deliberately. docker-py never reads them (``grep
    proxies`` finds nothing in its ``build.py`` / ``config.py`` /
    ``auth.py``); only the CLI does, injecting them as build args. So in
    dockerfile mode the user's proxy is already not applied - keeping the
    key means the compose path behaves exactly as before, and
    :func:`describe` states the difference instead of leaving it to be
    discovered.

Example::

    clean = sanitised_config_dir(config_dir / "docker")
    if clean is not None:
        os.environ["DOCKER_CONFIG"] = str(clean)
"""

from __future__ import annotations

import json
import os
from pathlib import Path

CREDENTIAL_KEYS = ("credsStore", "credHelpers", "auths")
CONFIG_NAME = "config.json"
CONTEXTS_DIR = "contexts"


def user_config_dir() -> Path:
    """The directory docker-py itself would read (``DOCKER_CONFIG`` wins)."""
    override = os.environ.get("DOCKER_CONFIG")
    if override:
        return Path(override)
    return Path.home() / ".docker"


def _load(source: Path) -> dict | None:
    config_file = source / CONFIG_NAME
    if not config_file.is_file():
        return None
    try:
        data = json.loads(config_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read {config_file}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"{config_file} is not a JSON object")
    return data


def describe(*, source: Path | None = None) -> str:
    """One line naming what would be removed - for the log, before acting.

    A silent sanitiser is indistinguishable from one that did nothing.
    """
    source = source or user_config_dir()
    try:
        data = _load(source)
    except ValueError as exc:
        return f"docker config unreadable: {exc}"
    if data is None:
        return f"no docker client config at {source} - nothing to sanitise"

    present = [key for key in CREDENTIAL_KEYS if key in data]
    if not present:
        return f"docker config at {source} carries no credential settings"
    details = []
    for key in present:
        value = data[key]
        if key == "credsStore":
            details.append(f"credsStore={value}")
        elif key == "credHelpers":
            details.append(f"credHelpers={','.join(sorted(value))}")
        else:
            details.append(f"auths for {len(value)} registry/registries")
    proxy = " (proxies kept; docker-py does not apply them, the CLI does)" if "proxies" in data else ""
    return f"removing from the build's docker config: {'; '.join(details)}{proxy}"


def sanitised_config_dir(target: Path, *, source: Path | None = None) -> Path | None:
    """Write a credential-free copy of the user's config into ``target``.

    Args:
        target: directory to create; ``DOCKER_CONFIG`` should point here.
        source: the user's config directory (defaults to the one docker-py
            would read).

    Returns:
        The prepared directory, or ``None`` when the user has no config
        at all - in that case docker-py resolves nothing and there is
        nothing to work around.

    Raises:
        ValueError: the config exists but cannot be parsed. Fail closed:
            "I could not read it" is not "there is nothing in it".
    """
    source = source or user_config_dir()
    data = _load(source)
    if data is None:
        return None

    for key in CREDENTIAL_KEYS:
        data.pop(key, None)

    target.mkdir(parents=True, exist_ok=True)
    (target / CONFIG_NAME).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    # contexts/ is resolved relative to the config file, so it has to be
    # reachable from the new directory or currentContext points at nothing.
    contexts = source / CONTEXTS_DIR
    link = target / CONTEXTS_DIR
    if contexts.is_dir() and not link.exists():
        try:
            link.symlink_to(contexts, target_is_directory=True)
        except OSError:
            # Windows without developer mode: fall back to leaving the
            # context name in place; docker-py then falls back to the
            # default endpoint, which is what it would have used anyway
            # without a readable contexts dir.
            pass
    return target
