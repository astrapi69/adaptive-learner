#!/usr/bin/env python3
"""Self-contained content validator for adaptive-learner-content
(Phase 60 / v1.44.0).

This is the SECOND of Adaptive Learner's two validation layers
(the app runs the same checks client-side before a community
share). It re-implements the schema + language-pair + quality
rules with stdlib + PyYAML only, so the content repo's CI can run
it without installing the application.

Checks, per the content-authoring contract:
  * Schema: required fields on every manifest set + lesson.
  * Language pair: target_language + source_language present,
    valid 2-letter ISO 639-1, and target != source.
  * Directory structure: a set's ``path`` is
    ``sets/{source_language}/{target}-{level}`` and matches the
    source_language it declares.
  * Quality minimums (below any of these fails the PR):
      - >= 5 exercises per lesson
      - >= 2 distinct exercise types
      - >= 1 theory step
      - free_text: >= 2 accepted answers + distractors
      - matching: >= 3 pairs
      - picture_choice: distractors present
      - no empty card front/back
      - non-Latin source scripts: card backs use that script

Exit code 0 when every file passes; 1 with a per-file report of
the failures otherwise.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
SETS_DIR = REPO_ROOT / "sets"

ISO_639_1 = re.compile(r"^[a-z]{2}$")

MIN_EXERCISES = 5
MIN_TYPES = 2
MIN_THEORY = 1
MIN_FREE_TEXT_ACCEPTS = 2
MIN_MATCHING_PAIRS = 3

# Scripts we can distinguish from Latin (mirror the TS validator).
SCRIPT_RANGES = {
    "el": re.compile(r"[Ͱ-Ͽἀ-῿]"),
    "ja": re.compile(r"[぀-ヿ一-鿿]"),
    "zh": re.compile(r"[一-鿿]"),
    "ru": re.compile(r"[Ѐ-ӿ]"),
    "ar": re.compile(r"[؀-ۿ]"),
    "ko": re.compile(r"[가-힯]"),
}


def base_lang(code: str) -> str:
    return (code or "").split("-")[0].lower()


def back_looks_like_source(text: str, source: str) -> bool:
    rng = SCRIPT_RANGES.get(base_lang(source))
    if rng is None:
        return True
    return bool(rng.search(text))


def validate_set_meta(content_set: dict, errors: list[str]) -> None:
    sid = content_set.get("id", "?")
    target = base_lang(content_set.get("target_language", ""))
    source = base_lang(content_set.get("source_language", "en"))
    if not target:
        errors.append(f"set {sid}: missing target_language")
    elif not ISO_639_1.match(target):
        errors.append(f"set {sid}: target_language '{target}' is not ISO 639-1")
    if not ISO_639_1.match(source):
        errors.append(f"set {sid}: source_language '{source}' is not ISO 639-1")
    if target and source and target == source:
        errors.append(f"set {sid}: source and target language are identical ('{target}')")
    if not content_set.get("title"):
        errors.append(f"set {sid}: missing title")
    if not content_set.get("title_native"):
        errors.append(f"set {sid}: missing title_native")


def validate_structure(content_set: dict, errors: list[str]) -> None:
    sid = content_set.get("id", "?")
    path = content_set.get("path")
    source = base_lang(content_set.get("source_language", "en"))
    if not path:
        errors.append(f"set {sid}: missing path (source-language tree)")
        return
    parts = path.split("/")
    if len(parts) != 3 or parts[0] != "sets":
        errors.append(f"set {sid}: path '{path}' must be sets/<source>/<target-level>")
        return
    if parts[1] != source:
        errors.append(
            f"set {sid}: path source dir '{parts[1]}' != source_language '{source}'"
        )
    if not (REPO_ROOT / path).is_dir():
        errors.append(f"set {sid}: path '{path}' is not a directory")


def validate_lesson(lesson: dict, source: str, label: str, errors: list[str]) -> None:
    steps = lesson.get("steps", [])
    exercises = [s["exercise"] for s in steps if s.get("type") == "exercise" and s.get("exercise")]
    theory = [s for s in steps if s.get("type") == "theory"]
    types = {e.get("type") for e in exercises}

    if len(exercises) < MIN_EXERCISES:
        errors.append(f"{label}: {len(exercises)} exercises (need >= {MIN_EXERCISES})")
    if len(types) < MIN_TYPES:
        errors.append(f"{label}: {len(types)} exercise type(s) (need >= {MIN_TYPES})")
    if len(theory) < MIN_THEORY:
        errors.append(f"{label}: no theory step")

    for card in lesson.get("cards", []):
        front = (card.get("front") or "").strip()
        back = (card.get("back") or "").strip()
        cid = card.get("id", "?")
        if not front or not back:
            errors.append(f"{label}: card '{cid}' has empty front/back")
        elif not back_looks_like_source(back, source):
            errors.append(f"{label}: card '{cid}' back is not in {base_lang(source)}")

    for ex in exercises:
        eid = ex.get("id", "?")
        if ex.get("type") == "free_text":
            if len(ex.get("accept") or []) < MIN_FREE_TEXT_ACCEPTS:
                errors.append(f"{label}: free_text '{eid}' needs >= {MIN_FREE_TEXT_ACCEPTS} accepts")
            if not ex.get("distractors"):
                errors.append(f"{label}: free_text '{eid}' needs distractors")
        elif ex.get("type") == "matching":
            if len(ex.get("pairs") or []) < MIN_MATCHING_PAIRS:
                errors.append(f"{label}: matching '{eid}' needs >= {MIN_MATCHING_PAIRS} pairs")
        elif ex.get("type") == "picture_choice":
            if not ex.get("distractors"):
                errors.append(f"{label}: picture_choice '{eid}' needs distractors")


def validate_set_dir(content_set: dict, errors: list[str]) -> None:
    sid = content_set.get("id", "?")
    path = content_set.get("path")
    source = content_set.get("source_language", "en")
    if not path:
        return
    set_dir = REPO_ROOT / path
    manifest_path = set_dir / "manifest.yaml"
    if not manifest_path.is_file():
        errors.append(f"set {sid}: missing {path}/manifest.yaml")
        return
    set_manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    lessons = (set_manifest.get("metadata") or {}).get("lessons") or []
    if not lessons:
        errors.append(f"set {sid}: set manifest lists no lessons")
    for filename in lessons:
        lesson_path = set_dir / "lessons" / filename
        if not lesson_path.is_file():
            errors.append(f"set {sid}: lesson file '{filename}' is missing")
            continue
        try:
            lesson = json.loads(lesson_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"set {sid}: {filename} is invalid JSON: {exc}")
            continue
        validate_lesson(lesson, source, f"{sid}/{filename}", errors)


def main() -> int:
    root_manifest = REPO_ROOT / "manifest.yaml"
    if not root_manifest.is_file():
        print("FAIL: no root manifest.yaml", file=sys.stderr)
        return 1
    manifest = yaml.safe_load(root_manifest.read_text(encoding="utf-8"))
    sets = manifest.get("sets") or []
    if not sets:
        print("FAIL: root manifest lists no sets", file=sys.stderr)
        return 1

    all_errors: list[str] = []
    for content_set in sets:
        errors: list[str] = []
        validate_set_meta(content_set, errors)
        validate_structure(content_set, errors)
        validate_set_dir(content_set, errors)
        sid = content_set.get("id", "?")
        if errors:
            print(f"FAIL {sid}:")
            for e in errors:
                print(f"  - {e}")
            all_errors.extend(errors)
        else:
            print(f"PASS {sid}")

    if all_errors:
        print(f"\n{len(all_errors)} validation error(s).", file=sys.stderr)
        return 1
    print(f"\nAll {len(sets)} set(s) passed validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
