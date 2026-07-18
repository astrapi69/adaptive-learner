"""Regression pins for #1814 - snap-sandbox-rewritten XDG dirs.

A snap-packaged terminal (e.g. VSCode installed as a snap) rewrites
``XDG_DATA_HOME`` to ``<home>/snap/<name>/<revision>/.local/share`` - a
PER-REVISION directory. Trusting it verbatim strands the whole data dir
on every snap refresh (the maintainer machine carried two stranded DBs,
``snap/code/251`` and ``snap/code/252``, while the canonical
``~/.local/share/adaptive_learner`` never existed).

The resolvers must strip the snap sandbox prefix and land in the stable
real home. Explicit ``ADAPTIVE_LEARNER_*_DIR`` overrides keep winning
verbatim - an admin pointing INTO a snap dir is intent, not an accident.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app import paths


@pytest.fixture()
def fake_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    home = tmp_path / "home" / "learner"
    home.mkdir(parents=True)
    monkeypatch.setenv("HOME", str(home))
    for override in (
        "ADAPTIVE_LEARNER_DATA_DIR",
        "ADAPTIVE_LEARNER_CONFIG_DIR",
        "ADAPTIVE_LEARNER_CACHE_DIR",
    ):
        monkeypatch.delenv(override, raising=False)
    return home


class TestSnapSandboxGuard:
    def test_snap_rewritten_xdg_data_home_resolves_to_real_home(
        self, fake_home: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        snap_share = fake_home / "snap" / "code" / "252" / ".local" / "share"
        snap_share.mkdir(parents=True)
        monkeypatch.setenv("XDG_DATA_HOME", str(snap_share))
        assert (
            paths.get_data_dir() == (fake_home / ".local" / "share" / "adaptive_learner").resolve()
        )

    def test_snap_rewritten_xdg_config_home_resolves_to_real_home(
        self, fake_home: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        snap_config = fake_home / "snap" / "code" / "252" / ".config"
        snap_config.mkdir(parents=True)
        monkeypatch.setenv("XDG_CONFIG_HOME", str(snap_config))
        assert paths.get_config_dir() == (fake_home / ".config" / "adaptive_learner").resolve()

    def test_snap_rewritten_xdg_cache_home_resolves_to_real_home(
        self, fake_home: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        snap_cache = fake_home / "snap" / "code" / "252" / ".cache"
        snap_cache.mkdir(parents=True)
        monkeypatch.setenv("XDG_CACHE_HOME", str(snap_cache))
        assert paths.get_cache_dir() == (fake_home / ".cache" / "adaptive_learner").resolve()

    def test_normal_xdg_data_home_stays_untouched(
        self, fake_home: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("XDG_DATA_HOME", str(fake_home / ".local" / "share"))
        assert (
            paths.get_data_dir() == (fake_home / ".local" / "share" / "adaptive_learner").resolve()
        )

    def test_explicit_override_into_a_snap_dir_is_honoured(
        self, fake_home: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        snap_dir = fake_home / "snap" / "code" / "252" / "custom-data"
        monkeypatch.setenv("ADAPTIVE_LEARNER_DATA_DIR", str(snap_dir))
        assert paths.get_data_dir() == snap_dir.resolve()

    def test_snap_segment_outside_home_is_not_rewritten(
        self, fake_home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        elsewhere = tmp_path / "srv" / "snap" / "code" / "252" / "share"
        elsewhere.mkdir(parents=True)
        monkeypatch.setenv("XDG_DATA_HOME", str(elsewhere))
        assert paths.get_data_dir() == (elsewhere / "adaptive_learner").resolve()

    def test_short_home_snap_path_passes_through(
        self, fake_home: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        too_short = fake_home / "snap"
        too_short.mkdir()
        monkeypatch.setenv("XDG_DATA_HOME", str(too_short))
        assert paths.get_data_dir() == (too_short / "adaptive_learner").resolve()
