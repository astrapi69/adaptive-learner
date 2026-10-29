"""``GET /api/i18n/{lang}`` parses a catalog once per file version (#3716).

The endpoint called ``pluginforge.config.load_i18n`` on every request, which
parses the whole YAML catalog again (about 0.14 s of CPU on the owner's
desktop, 0.36 s in the ccw container). The cache is keyed by language and
the file's ``st_mtime_ns``, so an edited catalog is read again without a
restart. The language code is still validated before any path is built.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pluginforge.config
import pytest
from pluginforge.config import load_i18n

from app.services import i18n_catalog

CONFIG = Path(__file__).resolve().parents[1] / "config"


@pytest.fixture(autouse=True)
def _clear_catalog_cache() -> Iterator[None]:
    i18n_catalog.clear_cache()
    yield
    i18n_catalog.clear_cache()


@pytest.fixture
def config_dir(tmp_path: Path) -> Path:
    (tmp_path / "i18n").mkdir()
    (tmp_path / "i18n" / "en.yaml").write_text("nav:\n  home: Home\n", encoding="utf-8")
    return tmp_path


@pytest.fixture
def parses(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Every ``load_yaml`` call, by file name."""
    calls: list[str] = []
    real = pluginforge.config.load_yaml

    def counting(path: str | Path) -> dict:
        calls.append(Path(path).name)
        return real(path)

    monkeypatch.setattr(pluginforge.config, "load_yaml", counting)
    return calls


def test_a_second_request_does_not_parse_again(config_dir: Path, parses: list[str]) -> None:
    first = i18n_catalog.load_catalog(config_dir, "en")
    second = i18n_catalog.load_catalog(config_dir, "en")
    assert first == second == {"nav": {"home": "Home"}}
    assert parses == ["en.yaml"]


def test_an_mtime_change_parses_again(config_dir: Path, parses: list[str]) -> None:
    path = config_dir / "i18n" / "en.yaml"
    i18n_catalog.load_catalog(config_dir, "en")
    path.write_text("nav:\n  home: Start page\n", encoding="utf-8")
    stat = path.stat()
    os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000_000))
    assert i18n_catalog.load_catalog(config_dir, "en") == {"nav": {"home": "Start page"}}
    assert parses == ["en.yaml", "en.yaml"]


@pytest.mark.parametrize("lang", ["../x", "en/../../x", ""], ids=["parent", "nested", "empty"])
def test_an_invalid_code_is_rejected_before_any_stat(
    config_dir: Path, lang: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    stats: list[str] = []
    monkeypatch.setattr(i18n_catalog, "_mtime_ns", lambda folder, code: stats.append(code))
    with pytest.raises(Exception, match="Invalid") as rejected:
        i18n_catalog.load_catalog(config_dir, lang)
    with pytest.raises(type(rejected.value)):
        load_i18n(config_dir, lang)
    assert stats == []


def test_a_missing_catalog_reads_as_before(config_dir: Path) -> None:
    assert i18n_catalog.load_catalog(config_dir, "de") == load_i18n(config_dir, "de") == {}


def test_a_catalog_that_appears_later_is_read(config_dir: Path) -> None:
    assert i18n_catalog.load_catalog(config_dir, "de") == {}
    (config_dir / "i18n" / "de.yaml").write_text("nav:\n  home: Start\n", encoding="utf-8")
    assert i18n_catalog.load_catalog(config_dir, "de") == {"nav": {"home": "Start"}}


def test_a_caller_cannot_change_the_cached_catalog(config_dir: Path) -> None:
    i18n_catalog.load_catalog(config_dir, "en")["nav"] = "changed"
    assert i18n_catalog.load_catalog(config_dir, "en") == {"nav": {"home": "Home"}}


def test_every_shipped_catalog_answers_as_before() -> None:
    langs = sorted(path.stem for path in (CONFIG / "i18n").glob("*.yaml"))
    assert len(langs) >= 2, "no catalogs found: the comparison would check nothing"
    for lang in langs:
        assert i18n_catalog.load_catalog(CONFIG, lang) == load_i18n(CONFIG, lang), lang
