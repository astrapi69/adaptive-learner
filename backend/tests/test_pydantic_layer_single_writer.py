"""The generated Pydantic layer has exactly one writer (#3650).

``scripts/generate_pydantic_models.py`` writes ``schema_generated.py`` and
``manifest_generated.py`` in the content-loader plugin. Once ruff checked the
plugins (#3625), ``ruff check --fix`` re-sorted their imports, so the
committed files no longer matched the generator and ``make sync-schema-check``
went red, unseen, because that check ran only at release time. These tests
run on every PR: the generator output must equal the committed file, and must
already be clean under the ruff configuration CI applies, so a linter never
becomes a second writer of a generated path (#2265).
"""

from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATOR = REPO_ROOT / "scripts" / "generate_pydantic_models.py"

pytestmark = pytest.mark.skipif(
    shutil.which("datamodel-codegen") is None or shutil.which("ruff") is None,
    reason="datamodel-codegen and ruff come with the backend dev environment",
)


def _load_generator():
    spec = importlib.util.spec_from_file_location("generate_pydantic_models", GENERATOR)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _targets() -> list[tuple[Path, str, str]]:
    return list(_load_generator().TARGETS)


def test_targets_found() -> None:
    """Guard the guard: no targets would make every check below vacuous."""
    assert len(_targets()) >= 2


@pytest.mark.parametrize("target", _targets(), ids=lambda t: t[1])
def test_generator_output_matches_committed_module(target: tuple[Path, str, str]) -> None:
    generator = _load_generator()
    schema_path, module_name, class_name = target
    committed = (generator.PACKAGE_DIR / module_name).read_text(encoding="utf-8")
    assert generator.generate(schema_path, class_name, module_name) == committed, (
        f"{module_name} differs from the generator output. Run `make sync-schema`; "
        "never edit or auto-fix a generated module."
    )


@pytest.mark.parametrize("command", [["check", "--fix"], ["format"]], ids=["check-fix", "format"])
@pytest.mark.parametrize("target", _targets(), ids=lambda t: t[1])
def test_generator_output_is_already_lint_clean(
    target: tuple[Path, str, str], command: list[str]
) -> None:
    """Neither ruff --fix nor ruff format has anything to change (#3650, #3658)."""
    generator = _load_generator()
    schema_path, module_name, class_name = target
    source = generator.generate(schema_path, class_name, module_name)
    result = subprocess.run(
        [
            "ruff",
            *command,
            "--stdin-filename",
            os.path.relpath(generator.PACKAGE_DIR / module_name, REPO_ROOT / "backend"),
            "-",
        ],
        input=source,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT / "backend",
        check=False,
    )
    assert result.stdout == source, f"ruff {command[0]} would rewrite {module_name}"


def test_generator_fails_closed_without_ruff_output(monkeypatch: pytest.MonkeyPatch) -> None:
    """No lint pass means no module: the generator never writes unchecked output."""
    generator = _load_generator()

    def silent_ruff(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(args=[], returncode=2, stdout="", stderr="ruff crashed")

    monkeypatch.setattr(generator.subprocess, "run", silent_ruff)
    with pytest.raises(RuntimeError, match="ruff produced no output"):
        generator._lint_clean("x = 1\n", generator.PACKAGE_DIR / "schema_generated.py")
