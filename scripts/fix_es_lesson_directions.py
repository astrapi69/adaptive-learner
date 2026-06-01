#!/usr/bin/env python3
"""
One-time fix: correct direction distribution in en/es-a1 and de/es-a1 lesson sets.

Background
----------
The EXP-018 direction feature requires a progressive direction pattern across
lessons so learners go from receptive → mixed → productive:

  Lessons 01-05 (receptive):  100% target_to_source
  Lessons 06-10 (mixed):      ~60% target_to_source, ~40% source_to_target
  Lessons 11-15 (productive): ~30% target_to_source, ~70% source_to_target

The French sets (en/fr-a1, de/fr-a1) already have the correct pattern.
The Spanish sets (en/es-a1, de/es-a1) have:
  - Lessons 06-10: 100% target_to_source  ← needs ~40% flipped
  - Lessons 11-15: ~56% source_to_target  ← needs ~70% (2 more per 9-exercise lesson)

Cloze exercises intentionally omit the direction field (they're in-context by
nature) and are left untouched.

Usage
-----
Run from the adaptive-learner-content repo root:

    python3 /path/to/this/script.py

Or with an explicit repo root:

    python3 /path/to/this/script.py --root /home/astrapi69/dev/git/hub/astrapi69/adaptive-learner-content

After running, commit:

    git add sets/en/es-a1 sets/de/es-a1
    git commit -m "feat(content): fix progressive direction in es-a1 sets (EXP-018)"
    git push
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


# Sets that need fixing (French sets are already correct)
SETS_TO_FIX = ["en/es-a1", "de/es-a1"]

# Target source_to_target ratio by lesson-number range
TARGET_S2T_RATIO: dict[tuple[int, int], float] = {
    (6, 10): 0.40,   # mixed zone: ~40% productive
    (11, 15): 0.70,  # productive zone: ~70% productive
}


def _in_range(num: int, bounds: tuple[int, int]) -> bool:
    lo, hi = bounds
    return lo <= num <= hi


def _lesson_number(filename: str) -> int:
    try:
        return int(filename.split("-")[0])
    except (ValueError, IndexError):
        return -1


def _non_cloze_exercise_steps(lesson: dict) -> list[tuple[int, dict]]:
    """Return (step_index, step) pairs for non-cloze exercise steps."""
    return [
        (i, step)
        for i, step in enumerate(lesson["steps"])
        if step.get("type") == "exercise"
        and step.get("exercise", {}).get("type") != "cloze"
    ]


def fix_lesson(path: Path, target_s2t_ratio: float, dry_run: bool) -> int:
    """
    Adjust direction distribution to reach target source_to_target ratio.

    Strategy: flip the LAST N exercises that are currently target_to_source
    (exercises at the end of a lesson = most production-focused).

    Returns number of exercises changed (or would change in dry-run mode).
    """
    with open(path, encoding="utf-8") as f:
        lesson = json.load(f)

    non_cloze = _non_cloze_exercise_steps(lesson)
    total = len(non_cloze)
    if total == 0:
        return 0

    current_s2t = sum(
        1 for _, s in non_cloze
        if s["exercise"].get("direction") == "source_to_target"
    )
    target_s2t = round(total * target_s2t_ratio)

    if current_s2t >= target_s2t:
        return 0

    need_to_flip = target_s2t - current_s2t

    # Take the last N non-cloze exercises that are still target_to_source.
    # Reversed so we flip from the end of the lesson inward.
    candidates = [
        (i, s) for i, s in reversed(non_cloze)
        if s["exercise"].get("direction") == "target_to_source"
    ]
    to_flip = candidates[:need_to_flip]

    if not to_flip:
        return 0

    changed = len(to_flip)

    if dry_run:
        for step_idx, step in to_flip:
            eid = step["exercise"].get("id", f"step[{step_idx}]")
            print(f"      would flip: {eid}")
        return changed

    for step_idx, _ in to_flip:
        lesson["steps"][step_idx]["exercise"]["direction"] = "source_to_target"

    with open(path, "w", encoding="utf-8") as f:
        json.dump(lesson, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        default=".",
        help="Path to the adaptive-learner-content repo root (default: cwd)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without writing files",
    )
    args = parser.parse_args()

    content_root = Path(args.root).resolve()
    dry_run: bool = args.dry_run

    if dry_run:
        print("[DRY RUN — no files will be written]\n")

    grand_total = 0

    for set_rel in SETS_TO_FIX:
        lessons_dir = content_root / "sets" / set_rel / "lessons"
        if not lessons_dir.exists():
            print(f"WARNING: {lessons_dir} not found — skipping")
            continue

        print(f"\n{'=' * 56}")
        print(f"  {set_rel}")
        print(f"{'=' * 56}")
        set_total = 0

        for json_file in sorted(lessons_dir.glob("*.json")):
            num = _lesson_number(json_file.name)
            target_ratio: float | None = None
            for bounds, ratio in TARGET_S2T_RATIO.items():
                if _in_range(num, bounds):
                    target_ratio = ratio
                    break

            if target_ratio is None:
                continue  # lessons 01-05 are 100% receptive — leave unchanged

            changed = fix_lesson(json_file, target_ratio, dry_run)
            if changed:
                verb = "would change" if dry_run else "changed"
                print(f"  lesson {num:02d}  {json_file.name:45s}  {verb} {changed} exercise(s)")
                set_total += changed
            else:
                print(f"  lesson {num:02d}  {json_file.name:45s}  already correct")

        action = "would update" if dry_run else "updated"
        print(f"\n  → {set_total} exercise(s) {action} in {set_rel}")
        grand_total += set_total

    print(f"\n{'=' * 56}")
    action = "would be updated" if dry_run else "updated"
    print(f"Total: {grand_total} exercise direction(s) {action}")

    if not dry_run and grand_total > 0:
        print(
            "\nNext steps:"
            "\n  git -C <content-repo> add sets/en/es-a1 sets/de/es-a1"
            '\n  git -C <content-repo> commit -m '
            '"feat(content): fix progressive direction in es-a1 sets (EXP-018)"'
            "\n  git -C <content-repo> push"
        )


if __name__ == "__main__":
    main()
