"""Regression tests for scripts/validate_bundled_content.py (issue #47).

Drives the real CLI via subprocess against a throwaway fake content
repo + a temp README, so the exit-code contract is pinned end-to-end:

- ``--check-readme`` exits 0 when the README matches the content repo;
- ``--check-readme`` exits 1 when a count in the README is manipulated;
- both modes SKIP (exit 0) when the content repo is not present.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import yaml

SCRIPT = (
    Path(__file__).resolve().parents[2] / "scripts" / "validate_bundled_content.py"
)


def _make_content_repo(
    root: Path,
    review_status: dict[str, str] | None = None,
) -> None:
    """Two sets, 2 + 3 lesson files, a root manifest that matches.

    ``review_status`` maps a set path to its ``review_status`` value
    (#2273), stamped where the REAL content repos stamp it: on the ROOT
    manifest's set entry AND nested in the per-set manifest's own
    ``sets[0]`` entry. Unmapped sets carry no field (normalizes to
    authored = advertisable).
    """
    # (path, n_lessons, source, target, level, domain, title)
    specs: list[tuple[str, int, str, str, str, str, str]] = [
        ("sets/en/fr-a1", 2, "en", "fr", "A1", "language", "French A1"),
        ("sets/de/py", 3, "de", "de", "A1", "programming", "Python"),
    ]
    manifest_sets: list[dict[str, object]] = []
    for path, n_lessons, src, tgt, level, domain, title in specs:
        set_dir = root / path
        (set_dir / "lessons").mkdir(parents=True)
        status = (review_status or {}).get(path)
        # Per-set manifest mirrors the real nested shape: its own
        # ``sets`` list carries the entry with review_status (#2273).
        nested_entry: dict[str, object] = {"id": path.replace("/", "-")}
        if status is not None:
            nested_entry["review_status"] = status
        (set_dir / "manifest.yaml").write_text(
            yaml.safe_dump(
                {"metadata": {"lessons": []}, "sets": [nested_entry]}
            ),
            "utf-8",
        )
        for i in range(n_lessons):
            (set_dir / "lessons" / f"{i:02d}-x.json").write_text("{}", "utf-8")
        root_entry: dict[str, object] = {
            "id": path.replace("/", "-"),
            "title": title,
            "source_language": src,
            "target_language": tgt,
            "level": level,
            "path": path,
            "lesson_count": n_lessons,
            "domain": domain,
        }
        if status is not None:
            root_entry["review_status"] = status
        manifest_sets.append(root_entry)
    (root / "manifest.yaml").write_text(
        yaml.safe_dump({"schema_version": "1.2", "sets": manifest_sets}), "utf-8"
    )


def _run(mode: str, *, content_dir: Path | None, readme: Path) -> int:
    # Inherit the real environment and override only the two vars the script's
    # resolution depends on. Building a minimal env from scratch dropped the
    # interpreter's loader vars (e.g. LD_LIBRARY_PATH), which a relocatable
    # setup-python CPython needs to exec — it 127s without them inside the
    # Playwright CI container (#1250).
    env = os.environ.copy()
    env["VALIDATE_BUNDLED_CONTENT_README"] = str(readme)
    if content_dir is not None:
        env["ADAPTIVE_LEARNER_CONTENT_DIR"] = str(content_dir)
    else:
        env.pop("ADAPTIVE_LEARNER_CONTENT_DIR", None)
    return subprocess.run(
        [sys.executable, str(SCRIPT), mode],
        env=env,
        capture_output=True,
        text=True,
    ).returncode


def test_check_passes_when_readme_matches(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    _make_content_repo(content)
    readme = tmp_path / "README.md"
    readme.write_text("# App\n\n## Install\n", "utf-8")
    # Populate the block, then it must verify clean (5 lessons / 2 sets).
    assert _run("--write-readme", content_dir=content, readme=readme) == 0
    assert "5 lessons" in readme.read_text("utf-8")
    assert _run("--check-readme", content_dir=content, readme=readme) == 0


def test_check_fails_when_number_manipulated(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    _make_content_repo(content)
    readme = tmp_path / "README.md"
    readme.write_text("# App\n\n## Install\n", "utf-8")
    _run("--write-readme", content_dir=content, readme=readme)
    text = readme.read_text("utf-8").replace("5 lessons", "999 lessons")
    readme.write_text(text, "utf-8")
    assert _run("--check-readme", content_dir=content, readme=readme) == 1


def test_check_fails_on_manifest_count_drift(tmp_path: Path) -> None:
    """Manifest lesson_count not matching the files on disk is a drift."""
    content = tmp_path / "content"
    content.mkdir()
    _make_content_repo(content)
    # Add an extra lesson file without bumping the manifest count.
    (content / "sets/en/fr-a1/lessons" / "99-extra.json").write_text("{}", "utf-8")
    readme = tmp_path / "README.md"
    readme.write_text("# App\n\n## Install\n", "utf-8")
    assert _run("--check-readme", content_dir=content, readme=readme) == 1


# #2273 - the content badge counts ONLY advertisable sets
# (review_status != "generated"); AI-generated sets stay listed but are
# excluded from the badge and named in the exclusion note.


def test_badge_counts_only_reviewed_sets(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    _make_content_repo(content, review_status={"sets/en/fr-a1": "generated"})
    readme = tmp_path / "README.md"
    readme.write_text("# App\n\n## Install\n", "utf-8")
    assert _run("--write-readme", content_dir=content, readme=readme) == 0
    text = readme.read_text("utf-8")
    # Badge: 1 reviewed set, 1 language pair (de-de); the generated
    # fr set does not count.
    assert "img.shields.io/badge/content-1%20set" in text
    assert "1%20language%20pair" in text
    # Exclusion note names the count of generated sets.
    assert "1 AI-generated set" in text
    # The generated set stays visible in the table with its raw status.
    assert "generated" in text
    assert _run("--check-readme", content_dir=content, readme=readme) == 0


def test_badge_counts_all_when_everything_is_advertisable(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    _make_content_repo(content)
    readme = tmp_path / "README.md"
    readme.write_text("# App\n\n## Install\n", "utf-8")
    assert _run("--write-readme", content_dir=content, readme=readme) == 0
    text = readme.read_text("utf-8")
    assert "img.shields.io/badge/content-2%20sets" in text
    assert "2%20language%20pairs" in text
    assert "AI-generated" not in text


def test_nested_per_set_status_is_the_fallback(tmp_path: Path) -> None:
    """A root entry without the field still excludes the set when the
    per-set manifest's nested ``sets[0]`` carries ``generated``."""
    content = tmp_path / "content"
    content.mkdir()
    _make_content_repo(content, review_status={"sets/en/fr-a1": "generated"})
    root_manifest = yaml.safe_load((content / "manifest.yaml").read_text("utf-8"))
    for entry in root_manifest["sets"]:
        entry.pop("review_status", None)
    (content / "manifest.yaml").write_text(
        yaml.safe_dump(root_manifest), "utf-8"
    )
    readme = tmp_path / "README.md"
    readme.write_text("# App\n\n## Install\n", "utf-8")
    assert _run("--write-readme", content_dir=content, readme=readme) == 0
    text = readme.read_text("utf-8")
    assert "img.shields.io/badge/content-1%20set" in text
    assert "1 AI-generated set" in text


def test_check_fails_when_badge_count_manipulated(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    _make_content_repo(content, review_status={"sets/en/fr-a1": "generated"})
    readme = tmp_path / "README.md"
    readme.write_text("# App\n\n## Install\n", "utf-8")
    _run("--write-readme", content_dir=content, readme=readme)
    text = readme.read_text("utf-8").replace(
        "content-1%20set", "content-2%20sets"
    )
    readme.write_text(text, "utf-8")
    assert _run("--check-readme", content_dir=content, readme=readme) == 1


def test_skips_when_content_repo_absent(tmp_path: Path) -> None:
    readme = tmp_path / "README.md"
    readme.write_text("# App\n\n## Install\n", "utf-8")
    missing = tmp_path / "does-not-exist"
    assert _run("--check-readme", content_dir=missing, readme=readme) == 0
    assert _run("--write-readme", content_dir=missing, readme=readme) == 0
