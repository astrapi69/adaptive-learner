"""First-run template generation + permission audit for
``~/.config/adaptive_learner/secrets.yaml``.

Phase 34 (v1.20.0). Companion to ``backend/app/main.py``'s existing
``_get_user_override_path()`` + ``_load_override_file()`` (which
implement the Bibliogon-style overlay loader) — this module covers
the desktop-launcher first-run case:

  * On first startup, when neither the config directory nor the
    ``secrets.yaml`` file exists, write a fully-commented template
    so the user has a discoverable starting point. ``chmod 0600``
    on POSIX so the keys-when-uncommented aren't world-readable.
  * On every subsequent startup, audit the file's permissions and
    log a single ``WARNING`` line per session if they're too open
    (any bit beyond owner-read/write on POSIX). Non-fatal — we
    surface the risk and continue.

NEVER logs key values. The audit reads only ``stat()`` mode bits,
never the file body.
"""

from __future__ import annotations

import logging
import os
import stat
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


SECRETS_TEMPLATE = """\
# Adaptive Learner -- API keys + Fernet secret
#
# This file lives outside the project tree and is NEVER committed
# to git. Keys configured here are loaded at startup and take
# precedence over keys stored in the database (Settings UI).
# Environment variables ALWAYS win over this file.
#
# Resolution chain at runtime (highest priority wins):
#   1. Environment variable (e.g. ADAPTIVE_LEARNER_ANTHROPIC_API_KEY)
#   2. This file (ai.anthropic.api_key)
#   3. Database UserSettings (encrypted; set via the Settings UI)
#   4. None -- the AI call returns an error asking the user to
#      configure a key.
#
# Uncomment and fill in only the keys you want to use. Comment
# lines (``#``) and empty lines are ignored. ``yaml.safe_load``
# rules apply -- strings should be quoted when they contain
# special characters.

# secret_key: "generate with: python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"

# ai:
#   anthropic:
#     api_key: "sk-ant-..."
#     default_model: "claude-sonnet-4-20250514"  # optional override
#   openai:
#     api_key: "sk-..."
#     default_model: "gpt-4o"  # optional override
#   gemini:
#     api_key: "AIza..."
#     default_model: "gemini-2.0-flash"  # optional override
"""


def ensure_template_exists(path: Path) -> bool:
    """Create the secrets template at ``path`` when neither it nor
    its parent directory exists yet.

    Returns ``True`` when the template was written (first run),
    ``False`` when the file already existed (steady state) or the
    write failed (best-effort: the loader still works against a
    missing file).

    On POSIX, ``chmod 0600`` is applied so a real key pasted in
    later isn't readable by other users on the host.

    The function is intentionally idempotent and silent on the
    happy "file already exists" path. The first-run "we created
    the directory" event logs once at ``INFO``.
    """
    try:
        if path.exists():
            return False
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(SECRETS_TEMPLATE, encoding="utf-8")
        if sys.platform != "win32":
            # 0600 — owner read/write only. The template body has
            # no real keys, but the user may paste one in seconds
            # after this runs; ship the safe perms from the start.
            os.chmod(path, 0o600)
        logger.info(
            "Created secrets template at %s (edit to configure API keys outside the database).",
            path,
        )
        return True
    except OSError as exc:
        # Non-fatal: the override loader returns ``{}`` on missing
        # file and the app keeps running.
        logger.warning(
            "Could not create secrets template at %s: %s. "
            "API keys must be configured via the Settings UI or "
            "environment variables.",
            path,
            exc,
        )
        return False


def audit_permissions(path: Path) -> None:
    """Log a ``WARNING`` when the secrets file is more permissive
    than owner-only on POSIX (any group / world bit set).

    No-op when the file doesn't exist (the loader treats absence
    as "no overrides"). No-op on Windows — NTFS ACL semantics
    don't map cleanly onto octal mode bits and ``stat().st_mode``
    reports synthetic values; the desktop launcher's installer
    is the right place to lock the directory down on Windows.
    """
    if sys.platform == "win32":
        return
    if not path.exists():
        return
    try:
        mode = path.stat().st_mode
    except OSError as exc:
        logger.warning(
            "Could not stat secrets file %s for permission audit: %s.",
            path,
            exc,
        )
        return
    # Mask off the file-type bits; we care only about the perm bits.
    perms = stat.S_IMODE(mode)
    # Any bit beyond owner read/write/execute is "too open" — we
    # tolerate the execute bit (some setups land it from umask
    # quirks) but flag group + world bits explicitly.
    too_open = perms & 0o077
    if too_open:
        logger.warning(
            "Secrets file %s has permissions %o (group/world readable). "
            "Consider running ``chmod 0600 %s`` to restrict access.",
            path,
            perms,
            path,
        )
