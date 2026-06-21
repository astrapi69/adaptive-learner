"""Tests for launcher.ports: host TCP port availability checks."""

from __future__ import annotations

import socket

from adaptive_learner_launcher import ports


class TestIsAvailable:

    def test_free_port_is_available(self) -> None:
        # Find a free port via the OS, release it, then assert our check
        # agrees it is free.
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        probe.bind(("", 0))
        free_port = probe.getsockname()[1]
        probe.close()
        assert ports.is_available(free_port) is True

    def test_occupied_port_is_not_available(self) -> None:
        held = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        held.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        held.bind(("", 0))
        held.listen(1)
        busy_port = held.getsockname()[1]
        try:
            assert ports.is_available(busy_port) is False
        finally:
            held.close()

    def test_out_of_range_is_not_available(self) -> None:
        assert ports.is_available(0) is False
        assert ports.is_available(70000) is False


class TestFindAvailable:

    def test_returns_start_when_free(self) -> None:
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        probe.bind(("", 0))
        free_port = probe.getsockname()[1]
        probe.close()
        assert ports.find_available(free_port) == free_port

    def test_skips_busy_port(self) -> None:
        held = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        held.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        held.bind(("", 0))
        held.listen(1)
        busy_port = held.getsockname()[1]
        try:
            found = ports.find_available(busy_port)
            assert found is not None
            assert found != busy_port
            assert found > busy_port
        finally:
            held.close()

    def test_returns_none_when_range_exhausted(self) -> None:
        # Starting at the very top with a tiny budget leaves nowhere to go.
        assert ports.find_available(65535, max_tries=1) in (65535, None)
        assert ports.find_available(65536, max_tries=5) is None
