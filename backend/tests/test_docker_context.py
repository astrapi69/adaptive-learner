"""Pins the Docker-context guard (#2112).

`bun run build` died in the frontend stage on a symlink under
`frontend/public/content/.../node_modules/.bin/` that points ABSOLUTELY
into a sibling repo: it resolves on the machine and dangles in the
container, where the target lies outside the build context. The single
`frontend/node_modules` ignore entry missed every nested one.

Gate contract (#2083): it detects the violation, passes on a clean tree,
fails closed without its basis, and reports what it examined - a scan
that walked nothing must not read like a clean one.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "verify_docker_context.py"


def _run(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root)],
        capture_output=True,
        text=True,
    )


DOCKERFILE = (
    "FROM oven/bun AS frontend-build\n"
    "COPY schema/ /schema/\n"
    "COPY frontend/ .\n"
    "FROM python:3.12-slim\n"
    "COPY --from=frontend-build /frontend/dist /app/static\n"
    "COPY backend/ .\n"
)


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    (tmp_path / "frontend" / "public" / "content" / "linked").mkdir(parents=True)
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / "app.py").write_text("x\n", encoding="utf-8")
    (tmp_path / "backend" / "Dockerfile").write_text(DOCKERFILE, encoding="utf-8")
    return tmp_path


def _ignore(root: Path, *lines: str) -> None:
    (root / ".dockerignore").write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_detects_a_nested_node_modules(tree: Path) -> None:
    (tree / "frontend" / "public" / "content" / "linked" / "node_modules").mkdir()
    _ignore(tree, "frontend/node_modules", ".git")
    result = _run(tree)
    assert result.returncode == 1
    assert "node_modules" in result.stderr
    assert "must not be" in result.stderr


def test_passes_when_the_rules_cover_it(tree: Path) -> None:
    (tree / "frontend" / "public" / "content" / "linked" / "node_modules").mkdir()
    _ignore(tree, "**/node_modules", ".git")
    result = _run(tree)
    assert result.returncode == 0, result.stderr
    assert "clean" in result.stdout


def test_reports_what_it_examined(tree: Path) -> None:
    """Point 4: an empty scan and a clean scan must not print the same green."""
    _ignore(tree, "**/node_modules")
    result = _run(tree)
    assert result.returncode == 0
    assert "paths examined" in result.stdout
    examined = int(result.stdout.split("docker context: ")[1].split(" ")[0])
    assert examined > 0


def test_fails_closed_without_a_dockerignore(tree: Path) -> None:
    result = _run(tree)
    assert result.returncode == 1
    assert "missing" in result.stderr


def test_fails_closed_on_an_empty_dockerignore(tree: Path) -> None:
    """No patterns means the rules cannot be evaluated - not that they pass."""
    _ignore(tree, "# only a comment")
    result = _run(tree)
    assert result.returncode == 1
    assert "no patterns" in result.stderr


def test_a_rule_gap_is_detected_without_any_node_modules_on_disk(tree: Path) -> None:
    """#3253: the CI blindness. A checkout without node_modules used to pass
    whatever the rules said; the synthesized probes fail it."""
    _ignore(tree, "frontend/node_modules", ".git")
    result = _run(tree)
    assert result.returncode == 1
    assert "the rules would let this into the build context" in result.stderr
    assert "frontend/public/content/linked-repo/node_modules" in result.stderr


def test_probes_follow_the_dockerfile_copy_roots(tree: Path) -> None:
    """A root the Dockerfile copies is probed; a stage-internal COPY is not."""
    _ignore(tree, "**/node_modules")
    result = _run(tree)
    assert result.returncode == 0, result.stderr
    assert "COPY roots: schema, frontend, backend" in result.stdout
    assert "synthesized paths probed" in result.stdout
    probed = int(result.stdout.split("docker context rules: ")[1].split(" ")[0])
    assert probed == 2 + 3 * 3


def test_fails_closed_without_a_dockerfile_or_a_copy_line(tree: Path) -> None:
    _ignore(tree, "**/node_modules")
    (tree / "backend" / "Dockerfile").unlink()
    result = _run(tree)
    assert result.returncode == 1
    assert "image inputs cannot be derived" in result.stderr
    (tree / "backend" / "Dockerfile").write_text(
        "FROM python:3.12-slim\nRUN echo hi\n", encoding="utf-8"
    )
    result = _run(tree)
    assert result.returncode == 1
    assert "no COPY line" in result.stderr


def test_the_smoke_path_filter_covers_every_copy_root() -> None:
    """#3253 part 2: docker-build-smoke runs on every input the image copies.

    The trigger cannot read the Dockerfile, so this pins the two by hand:
    each COPY root of backend/Dockerfile, the ignore file and this guard
    itself must be in the workflow's pull_request path list.
    """
    import yaml

    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from verify_docker_context import copy_roots

    workflow = yaml.safe_load(
        (REPO_ROOT / ".github" / "workflows" / "docker-build-smoke.yml").read_text(encoding="utf-8")
    )
    paths = workflow[True]["pull_request"]["paths"]
    for root in copy_roots(REPO_ROOT / "backend" / "Dockerfile"):
        assert f"{root}/**" in paths, f"{root}/ is an image input but not a smoke trigger"
    assert ".dockerignore" in paths
    assert "scripts/verify_docker_context.py" in paths


def test_the_real_repo_context_is_clean(tree: Path) -> None:
    """The regression pin itself: this repo must stay clean."""
    result = _run(REPO_ROOT)
    assert result.returncode == 0, result.stdout + result.stderr
