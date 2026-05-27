"""Cross-renderer parity (Phase 49F / v1.32.0 /
PHASE-42-STORAGE-ABSTRACTION-01).

The Python renderer and the TypeScript renderer (at
``frontend/src/lib/learning-repo/``) MUST produce
byte-identical Markdown when given the same RenderContext.
This test pins the Python side; the matching TS test at
``frontend/src/lib/learning-repo/parity.test.ts`` pins the TS
side. Both compare against the SAME golden files at
``tests/fixtures/learning-repo-parity/expected/``, so a
contributor who changes either renderer must update the
goldens AND see the other side break until it converges.

Regen goldens with ``LEARNING_REPO_PARITY_REGEN=1 pytest
tests/test_parity.py``. Without the env var, this test
asserts.
"""

from __future__ import annotations

import os
from pathlib import Path

from adaptive_learner_learning_repo.renderer import render_from_context

from .parity_helpers import load_parity_context

# Walk up: __file__ -> tests/ -> plugin pkg dir ->
# plugins/ -> repo root.
REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "learning-repo-parity"
INPUT_PATH = FIXTURE_DIR / "input.json"
EXPECTED_DIR = FIXTURE_DIR / "expected"


def test_python_renderer_matches_golden_files():
    ctx = load_parity_context(INPUT_PATH)
    tree = render_from_context(ctx, "en")
    regen = os.environ.get("LEARNING_REPO_PARITY_REGEN") == "1"
    EXPECTED_DIR.mkdir(parents=True, exist_ok=True)
    for path, content in tree.items():
        golden = EXPECTED_DIR / path
        if regen:
            golden.parent.mkdir(parents=True, exist_ok=True)
            golden.write_text(content, encoding="utf-8")
            continue
        assert golden.exists(), (
            f"Golden missing: {golden.relative_to(REPO_ROOT)}. "
            f"Set LEARNING_REPO_PARITY_REGEN=1 to (re)generate."
        )
        actual = golden.read_text(encoding="utf-8")
        assert content == actual, (
            f"Drift in {path}.\n"
            f"Expected (golden):\n{actual!r}\n"
            f"Got (Python render):\n{content!r}"
        )
    if not regen:
        rendered_paths = set(tree.keys())
        golden_paths = {
            str(p.relative_to(EXPECTED_DIR))
            for p in EXPECTED_DIR.rglob("*.md")
        }
        assert golden_paths == rendered_paths, (
            f"Golden file set mismatch:\n"
            f"  only in goldens: {sorted(golden_paths - rendered_paths)}\n"
            f"  only in render:  {sorted(rendered_paths - golden_paths)}"
        )
