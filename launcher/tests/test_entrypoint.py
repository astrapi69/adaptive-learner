"""#1045 - the persistent window is the SOLE GUI entry point.

Frozen-binary detection (``config.source_checkout_repo()`` returning None)
must have NO effect on which GUI is launched: ``main()`` always runs the
persistent window, for source checkouts AND frozen binaries. There is no
dialog-chain fallback. These tests stub ``launcher_app.run_app`` so they run
headless (importing the module is fine; only ``tk.Tk()`` needs a display,
which the CI build's manual/window checks cover separately).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from adaptive_learner_launcher import __main__ as m
from adaptive_learner_launcher import launcher_app


@pytest.fixture
def fake_window(monkeypatch):
    calls: list[int] = []
    # main() does a lazy ``from adaptive_learner_launcher import launcher_app``
    # which resolves to THIS real module object, so stubbing run_app here is
    # what main() actually calls (a sys.modules swap would be bypassed).
    monkeypatch.setattr(launcher_app, "run_app", lambda **kwargs: (calls.append(1) or 0))
    # Neutralize everything around the GUI launch so main() is deterministic.
    monkeypatch.setattr(sys, "argv", ["adaptive_learner_launcher"])
    monkeypatch.setattr(m, "_maybe_show_help", lambda argv: False)
    monkeypatch.setattr(m, "_maybe_show_version", lambda argv: False)
    monkeypatch.setattr(m, "_parse_cli_debug", lambda argv: False)
    monkeypatch.setattr(m, "_setup_logging", lambda **kwargs: None)
    monkeypatch.setattr(m, "_maybe_run_cli_action", lambda argv: None)
    monkeypatch.setattr(m, "_parse_cli_port", lambda argv: None)
    monkeypatch.setattr(m.i18n, "init", lambda lang: None)
    monkeypatch.setattr(m.settings, "get", lambda key: None)
    return calls


def test_frozen_binary_uses_persistent_window(monkeypatch, fake_window) -> None:
    # Frozen binary: no source checkout.
    monkeypatch.setattr(m.config, "source_checkout_repo", lambda: None)
    assert m.main() == 0
    assert fake_window == [1]  # the persistent window was launched


def test_source_checkout_uses_persistent_window(monkeypatch, fake_window) -> None:
    # Source checkout: a valid repo path.
    monkeypatch.setattr(m.config, "source_checkout_repo", lambda: Path("/repo"))
    assert m.main() == 0
    assert fake_window == [1]


def test_no_dialog_chain_symbols_remain() -> None:
    # The old dialog chain is deleted: these must no longer exist on __main__.
    for gone in ("_run_launcher", "_ensure_docker_ready", "_install_or_welcome",
                 "_manage_running", "_handle_already_running"):
        assert not hasattr(m, gone), f"{gone} should have been removed (#1045)"
