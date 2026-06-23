"""Shared fixtures for the thin Adaptive Learner launcher wrapper.

The launcher now delegates to ``docker_app_launcher``; these fixtures keep
``main()`` calls hermetic (no real HOME writes, no leaked root-log handlers).
"""

from __future__ import annotations

import contextlib
import logging

import pytest


@pytest.fixture(autouse=True)
def isolate_home(tmp_path, monkeypatch):
    """Point HOME at a tmp dir so launcher.log / install.log stay isolated."""
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("USERPROFILE", str(home))
    monkeypatch.delenv("APPDATA", raising=False)
    return home


@pytest.fixture(autouse=True)
def reset_root_logging():
    """Restore root-logger handlers after each test (setup_logging adds them)."""
    root = logging.getLogger()
    saved = root.handlers[:]
    level = root.level
    yield
    for handler in root.handlers[:]:
        if handler not in saved:
            root.removeHandler(handler)
            with contextlib.suppress(Exception):
                handler.close()
    root.setLevel(level)
