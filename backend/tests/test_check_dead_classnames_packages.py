"""The package layer of the dead-classname tool fails closed (#3422).

``--consumers`` answers "may this selector be deleted?". Its verdict named
"src + package dist", but a missing package dist (no ``bun install``, or a
package that renamed its entry file) was skipped in silence. That rebuilt
the #2477 blind spot inside its own mitigation: Settings > AI shipped
unstyled after a src-only "0 consumers" grep.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "check-dead-classnames.py"
_spec = importlib.util.spec_from_file_location("check_dead_classnames_packages", _SCRIPT)
assert _spec and _spec.loader
cdc = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = cdc
_spec.loader.exec_module(cdc)


@pytest.fixture
def fake_tree(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A src with one consumer of ``row-a`` and two package dists, one of
    which consumes ``pkg-only``."""
    src = tmp_path / "frontend" / "src"
    src.mkdir(parents=True)
    (src / "A.tsx").write_text('export const A = () => <div className="row-a" />;\n')
    present = tmp_path / "pkg-one.js"
    present.write_text('createElement("div", {className: "pkg-only"});\n')
    second = tmp_path / "pkg-two.js"
    second.write_text("export {};\n")
    monkeypatch.setattr(cdc, "SRC_DIR", src)
    monkeypatch.setattr(cdc, "PACKAGE_CONSUMER_FILES", [present, second])
    return tmp_path


def _consumers(monkeypatch: pytest.MonkeyPatch, name: str) -> int:
    monkeypatch.setattr(sys, "argv", ["check-dead-classnames.py", "--consumers", name])
    return cdc.main()


def test_consumers_finds_a_class_only_a_package_renders(
    fake_tree: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    assert _consumers(monkeypatch, "pkg-only") == 0
    out = capsys.readouterr().out
    assert "1 Konsument(en)" in out
    assert "pkg-one.js" in out


def test_consumers_names_what_it_scanned_on_a_zero_verdict(
    fake_tree: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    assert _consumers(monkeypatch, "nowhere") == 0
    out = capsys.readouterr().out
    assert "0 Konsumenten" in out
    assert "1 src-Datei(en) + 2 Paket-Datei(en)" in out
    assert "Nicht pruefbar (dynamische className-Ausdruecke): 0" in out


def test_consumers_refuses_a_verdict_when_a_package_dist_is_missing(
    fake_tree: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    (fake_tree / "pkg-two.js").unlink()
    assert _consumers(monkeypatch, "nowhere") == 1
    captured = capsys.readouterr()
    assert "0 Konsumenten" not in captured.out
    assert "pkg-two.js" in captured.err
    assert "bun install" in captured.err


def test_the_list_mode_refuses_when_a_package_dist_is_missing(
    fake_tree: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    (fake_tree / "pkg-one.js").unlink()
    monkeypatch.setattr(sys, "argv", ["check-dead-classnames.py", "--list"])
    assert cdc.main() == 1
    assert "pkg-one.js" in capsys.readouterr().err
