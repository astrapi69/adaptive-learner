"""#2946 - plugin test-count collection must use the shared backend venv.

`_collect_actual_test_counts` (behind `verify_docs.py --test-counts`)
summed each plugin's collected test count by running `poetry run pytest`
with the plugin directory as CWD - which resolves to that PLUGIN's own,
never-installed poetry venv, not the backend's shared one `make
test-plugins` actually uses. Most plugin venvs lack `pluginforge`
entirely, so collection failed with ModuleNotFoundError and the count
silently read as 0 - undercounting the real total (942 reported vs 1130
actual) with no warning that anything had gone wrong.

Each test below reproduces one half of the bug with a real subprocess
against a fake `poetry`/python shim (matching the docker-shim pattern in
test_image_size_gate.py) rather than mocking, so the fix is proven
against the actual interface these helpers call through.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs import (  # noqa: E402
    Report,
    collect_pytest_count,
    resolve_plugin_python,
)


def _warns(report: Report) -> list[str]:
    return [f.message for f in report.findings if f.severity == "WARN"]


def _make_fake_venv_python(tmp_path: Path, collected: int) -> Path:
    """A fake `python -m pytest --collect-only -q` that reports `collected`."""
    venv_bin = tmp_path / "fake-venv" / "bin"
    venv_bin.mkdir(parents=True)
    python = venv_bin / "python"
    python.write_text(
        f'#!/bin/sh\necho "{collected} tests collected"\n',
        encoding="utf-8",
    )
    python.chmod(0o755)
    return python


def _make_fake_poetry(tmp_path: Path, *, venv_path: str | None, log: Path) -> Path:
    """A fake `poetry` that answers `env info -p` and logs every call."""
    shim = tmp_path / "shim"
    shim.mkdir(exist_ok=True)
    poetry = shim / "poetry"
    env_line = f'echo "{venv_path}"' if venv_path else "echo -n ''"
    poetry.write_text(
        "#!/bin/sh\n"
        f'echo "$@" >> {log}\n'
        'if [ "$1" = "env" ] && [ "$2" = "info" ]; then\n'
        f"  {env_line}\n"
        "  exit 0\n"
        "fi\n"
        # A plain `poetry run pytest` (the pre-fix fallback path) simulates
        # the real broken-plugin-venv failure: no parseable output.
        'echo "ModuleNotFoundError: No module named .pluginforge." 1>&2\n'
        "exit 1\n",
        encoding="utf-8",
    )
    poetry.chmod(0o755)
    return shim


def test_resolve_plugin_python_points_at_the_shared_backend_venv(tmp_path: Path) -> None:
    """The resolved interpreter must be the backend's OWN venv, not poetry
    re-resolved per plugin - this is what makes every plugin share one
    installed environment instead of each needing its own."""
    log = tmp_path / "argv.log"
    fake_venv = tmp_path / "fake-venv"
    fake_venv.mkdir()
    shim = _make_fake_poetry(tmp_path, venv_path=str(fake_venv), log=log)
    report = Report()

    import os

    python = resolve_plugin_python(
        report, tmp_path, env={**os.environ, "PATH": f"{shim}:{os.environ['PATH']}"}
    )

    assert python == str(fake_venv / "bin" / "python")
    assert not _warns(report)
    assert "env info -p" in log.read_text(encoding="utf-8")


def test_resolve_plugin_python_warns_when_backend_venv_unresolvable(tmp_path: Path) -> None:
    """A missing/broken backend venv must be a WARN, not a silent None that
    later reads as '0 plugin tests, nothing wrong' (gate contract point 3)."""
    log = tmp_path / "argv.log"
    shim = _make_fake_poetry(tmp_path, venv_path=None, log=log)
    report = Report()

    import os

    python = resolve_plugin_python(
        report, tmp_path, env={**os.environ, "PATH": f"{shim}:{os.environ['PATH']}"}
    )

    assert python is None
    assert any("backend venv" in w for w in _warns(report))


def test_collect_pytest_count_uses_the_resolved_venv_python(tmp_path: Path) -> None:
    """The end-to-end path: resolve the shared venv, then actually collect
    a plugin's tests through IT - the exact fix for #2946's undercounting."""
    fake_python = _make_fake_venv_python(tmp_path, collected=42)
    report = Report()

    count = collect_pytest_count(
        report, tmp_path, [str(fake_python), "-m", "pytest", "--collect-only", "-q"]
    )

    assert count == 42
    assert not _warns(report)


def test_collect_pytest_count_warns_instead_of_silently_returning_zero(
    tmp_path: Path,
) -> None:
    """A collection error (broken venv, missing dependency, ...) must WARN
    with the failing directory named - not disappear into a bare 0 that
    looks identical to 'this plugin genuinely has zero tests' (#2946)."""
    broken_python = tmp_path / "broken-python"
    broken_python.write_text(
        "#!/bin/sh\necho 'ModuleNotFoundError: No module named pluginforge' 1>&2\nexit 1\n",
        encoding="utf-8",
    )
    broken_python.chmod(0o755)
    report = Report()

    count = collect_pytest_count(
        report, tmp_path, [str(broken_python), "-m", "pytest", "--collect-only", "-q"]
    )

    assert count == 0
    warns = _warns(report)
    assert warns, "a collection failure that returns 0 must be reported, not silent"
    assert str(tmp_path) in warns[0]
