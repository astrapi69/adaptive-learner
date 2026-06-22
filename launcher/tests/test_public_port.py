"""Tests for the public-port config helpers (#942 Bug 3)."""

from __future__ import annotations

from pathlib import Path

from adaptive_learner_launcher import config


class TestDefaultPort:

    def test_default_is_8501_not_bibliogon(self) -> None:
        # 8501 is Adaptive Learner's own port; 7880 is Bibliogon's.
        # Defaulting to 7880 guaranteed a sibling-app conflict (#956 / §5).
        assert config.DEFAULT_PORT == 8501


class TestReadPublicPort:

    def test_returns_default_when_no_env_file(self, tmp_path: Path) -> None:
        assert config.read_public_port(tmp_path) == config.DEFAULT_PORT

    def test_reads_public_port_line(self, tmp_path: Path) -> None:
        (tmp_path / ".env").write_text(
            "ADAPTIVE_LEARNER_PORT=8000\nADAPTIVE_LEARNER_PUBLIC_PORT=7890\n",
            encoding="utf-8",
        )
        assert config.read_public_port(tmp_path) == 7890

    def test_ignores_internal_port_line(self, tmp_path: Path) -> None:
        # Only the *internal* port is set; public falls back to default.
        (tmp_path / ".env").write_text("ADAPTIVE_LEARNER_PORT=8000\n", encoding="utf-8")
        assert config.read_public_port(tmp_path) == config.DEFAULT_PORT

    def test_falls_back_on_out_of_range(self, tmp_path: Path) -> None:
        (tmp_path / ".env").write_text("ADAPTIVE_LEARNER_PUBLIC_PORT=99999\n", encoding="utf-8")
        assert config.read_public_port(tmp_path) == config.DEFAULT_PORT


class TestResolveLaunchPort:

    def test_cli_port_wins(self, tmp_path: Path) -> None:
        env = {"APPDATA": str(tmp_path), "USERPROFILE": str(tmp_path)}
        config.save_launcher_config({"port": 8501}, env)
        (tmp_path / ".env").write_text("ADAPTIVE_LEARNER_PUBLIC_PORT=7000\n", encoding="utf-8")
        assert config.resolve_launch_port(tmp_path, cli_port=9001, env=env) == 9001

    def test_config_port_over_env(self, tmp_path: Path) -> None:
        env = {"APPDATA": str(tmp_path)}
        config.save_launcher_config({"port": 8501}, env)
        (tmp_path / ".env").write_text("ADAPTIVE_LEARNER_PUBLIC_PORT=7000\n", encoding="utf-8")
        assert config.resolve_launch_port(tmp_path, env=env) == 8501

    def test_env_over_default(self, tmp_path: Path) -> None:
        env = {"APPDATA": str(tmp_path)}
        (tmp_path / ".env").write_text("ADAPTIVE_LEARNER_PUBLIC_PORT=7321\n", encoding="utf-8")
        assert config.resolve_launch_port(tmp_path, env=env) == 7321

    def test_default_when_nothing_configured(self, tmp_path: Path) -> None:
        env = {"APPDATA": str(tmp_path)}
        assert config.resolve_launch_port(tmp_path, env=env) == config.DEFAULT_PORT

    def test_invalid_cli_port_ignored(self, tmp_path: Path) -> None:
        env = {"APPDATA": str(tmp_path)}
        (tmp_path / ".env").write_text("ADAPTIVE_LEARNER_PUBLIC_PORT=7321\n", encoding="utf-8")
        assert config.resolve_launch_port(tmp_path, cli_port=0, env=env) == 7321

    def test_invalid_config_port_ignored(self, tmp_path: Path) -> None:
        env = {"APPDATA": str(tmp_path)}
        config.save_launcher_config({"port": "not-a-port"}, env)
        assert config.resolve_launch_port(tmp_path, env=env) == config.DEFAULT_PORT


class TestWritePublicPort:

    def test_creates_env_file_with_line(self, tmp_path: Path) -> None:
        config.write_public_port(tmp_path, 8501)
        text = (tmp_path / ".env").read_text(encoding="utf-8")
        assert "ADAPTIVE_LEARNER_PUBLIC_PORT=8501" in text
        assert config.read_public_port(tmp_path) == 8501

    def test_upserts_existing_line(self, tmp_path: Path) -> None:
        (tmp_path / ".env").write_text(
            "OTHER=1\nADAPTIVE_LEARNER_PUBLIC_PORT=7880\nLAST=2\n",
            encoding="utf-8",
        )
        config.write_public_port(tmp_path, 8765)
        text = (tmp_path / ".env").read_text(encoding="utf-8")
        assert text.count("ADAPTIVE_LEARNER_PUBLIC_PORT=") == 1
        assert "ADAPTIVE_LEARNER_PUBLIC_PORT=8765" in text
        assert "OTHER=1" in text and "LAST=2" in text

    def test_appends_with_newline_when_file_lacks_trailing_newline(self, tmp_path: Path) -> None:
        (tmp_path / ".env").write_text("OTHER=1", encoding="utf-8")
        config.write_public_port(tmp_path, 8501)
        text = (tmp_path / ".env").read_text(encoding="utf-8")
        assert "OTHER=1\nADAPTIVE_LEARNER_PUBLIC_PORT=8501\n" == text
