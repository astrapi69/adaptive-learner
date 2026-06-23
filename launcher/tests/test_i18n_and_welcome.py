# TEMPLATE: This test is included as adaptable example.
# Replace with your domain logic when project domain is finalized.

"""Tests for the JSON-backed i18n catalog, welcome-flag handling, and
the welcomed/language settings flags (the old _run_launcher dialog
chain was removed in #1045).

UI primitives (``ui.welcome_dialog``, ``ui.three_button_dialog``,
``ui.error_dialog``) are not exercised end-to-end - they require a
display. Instead we patch them at the module level and assert on
arguments / dispatch.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch


from adaptive_learner_launcher import i18n, settings


# --- i18n -----------------------------------------------------------


class TestI18n:
    """The catalog ships ``en`` and ``de``. Other resolvers fall back."""

    def setup_method(self) -> None:
        i18n._CATALOG = {}  # force reload
        i18n.init(None)

    def test_returns_english_when_active_lang_is_en(self) -> None:
        i18n.set_language("en")
        assert i18n.t("welcome.title") == "Welcome to AdaptiveLearner"

    def test_returns_german_when_active_lang_is_de(self) -> None:
        i18n.set_language("de")
        assert i18n.t("welcome.title") == "Willkommen bei AdaptiveLearner"

    def test_falls_back_to_english_when_key_missing_from_de(self) -> None:
        i18n.set_language("de")
        i18n._CATALOG["de"].pop("welcome.title", None)
        assert i18n.t("welcome.title") == "Welcome to AdaptiveLearner"

    def test_returns_key_itself_when_missing_from_both(self) -> None:
        i18n.set_language("en")
        assert i18n.t("definitely.unknown.key") == "definitely.unknown.key"

    def test_set_language_ignores_unknown_codes(self) -> None:
        i18n.set_language("en")
        i18n.set_language("klingon")
        assert i18n.active_language() == "en"

    def test_locale_de_resolves_to_de_catalog(self) -> None:
        with patch("adaptive_learner_launcher.ui._current_lang", return_value="de"):
            assert i18n._resolve_language(None) == "de"

    def test_locale_en_resolves_to_en_catalog(self) -> None:
        with patch("adaptive_learner_launcher.ui._current_lang", return_value="en"):
            assert i18n._resolve_language(None) == "en"

    def test_unknown_locale_falls_back_to_en(self) -> None:
        # Use "zh" (Chinese) as a placeholder for an unsupported
        # language. JA used to play this role before the JA catalog
        # shipped in v0.30.0.
        with patch("adaptive_learner_launcher.ui._current_lang", return_value="zh"):
            assert i18n._resolve_language(None) == "en"

    def test_settings_language_overrides_locale(self) -> None:
        with patch("adaptive_learner_launcher.ui._current_lang", return_value="en"):
            assert i18n._resolve_language("de") == "de"

    def test_german_catalog_uses_real_umlauts(self) -> None:
        """Per project rule lessons-learned 'German content uses real
        umlauts' the de catalog must NOT use ASCII transliterations
        (ae/oe/ue/ss) for any string that should carry an umlaut."""
        de = i18n._CATALOG["de"]
        # Spot-check a few strings with known umlauts/sharp-s.
        # First batch covers the v0.27.0 first-run flow (welcome +
        # Docker-missing); the second batch covers
        # LAUNCHER-I18N-EXTRACT-01 strings extracted in v0.28.x.
        assert "läuft" in de["welcome.docker_required"]
        assert "lädt" in de["welcome.first_run_size"]
        assert "benötigt" in de["docker.missing.heading"]
        assert "heißt" in de["docker.missing.explanation"]
        # New (extraction-pass) strings:
        assert "läuft" in de["docker.daemon.title"]
        assert "Schließen" in de["common.close"]
        assert "öffnen" in de["common.open_browser"]
        assert "verfügbar" in de["update.message"]
        assert "Bücher" in de["uninstall.message"]
        assert "fortfahren" in de["stale.continue_old"]
        assert "möglicherweise" in de["cleanup.message"]
        assert "Wiederholen" in de["common.retry"]


# --- welcome flag ---------------------------------------------------


class TestWelcomedFlag:
    """settings.welcomed defaults False and flips True after first
    welcome dialog. The flag itself just lives in settings; the
    write happens in ``__main__._run_launcher``. Cover both."""

    def _patch_path(self, tmp_path: Path):
        return patch.object(
            settings, "settings_path", return_value=tmp_path / "settings.json"
        )

    def test_default_welcomed_is_false(self, tmp_path: Path) -> None:
        with self._patch_path(tmp_path):
            assert settings.read_settings()["welcomed"] is False

    def test_update_persists_welcomed_true(self, tmp_path: Path) -> None:
        with self._patch_path(tmp_path):
            settings.update("welcomed", True)
            assert settings.read_settings()["welcomed"] is True

    def test_default_language_is_none(self, tmp_path: Path) -> None:
        with self._patch_path(tmp_path):
            assert settings.read_settings()["language"] is None


# --- Docker-missing dialog dispatch --------------------------------
