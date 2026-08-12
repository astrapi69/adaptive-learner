#!/usr/bin/env python3
"""AUTH-05 - measure how often an exercise_id change is position-certain.

Walks a content repo's first-parent git history and classifies every
exercise_id removal between consecutive commits the SAME way
``frontend/src/lib/content/update/exercise-remap-plan.ts``'s ``classify()``
does: same position in the ordered per-lesson exercise-id list AND
unambiguous (the candidate does not already exist elsewhere in the old
list) is "certain"; a reorder or a length change is "uncertain" (never
guessed); a removed id absent from the OLD version too is
"not_in_cached" (nothing to compare against - typically an earlier event
already accounted for it).

Mirrors the one-off measurement #2301 ran for element_key (9 repos, 312
commits, 186:4 certain:uncertain) one layer up, onto the exercise's own
id. Unlike that measurement, this script is checked in so a future
content-history audit does not have to be re-invented from scratch.

Usage:
    python3 scripts/measure_exercise_id_stability.py <repo-path> [--max-commits N]

stdlib only (Library-First, reusability.md) - no PyYAML/jsonschema
dependency, since only ``steps[].exercise.id``/``stable_id`` is read.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path


def _git(*args: str, cwd: Path) -> str:
    return subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, check=True
    ).stdout


def _changed_lesson_files(old_commit: str, new_commit: str, repo: Path) -> set[str]:
    """Lesson files that differ between the two commits - avoids re-reading
    every unchanged lesson on every step (most commits touch only a few)."""
    out = _git(
        "diff", "--name-only", "--diff-filter=M", old_commit, new_commit, cwd=repo
    )
    return {
        line
        for line in out.splitlines()
        if line.endswith(".json") and "/lessons/" in line
    }


def _read_file_at(commit: str, path: str, repo: Path) -> str | None:
    try:
        return _git("show", f"{commit}:{path}", cwd=repo)
    except subprocess.CalledProcessError:
        return None


def _exercises_of(lesson_json_text: str) -> list[tuple[str, str | None]] | None:
    """Ordered ``(id, stable_id)`` pairs of one lesson's exercise steps -
    BOTH fields, not the resolved ``stable_id ?? id`` value, so a #2130
    stable_id-minting event (id unchanged, stable_id newly added) can be
    told apart from a genuine id rename (see ``_still_resolves``)."""
    try:
        data = json.loads(lesson_json_text)
    except (json.JSONDecodeError, TypeError):
        return None
    exercises: list[tuple[str, str | None]] = []
    for step in data.get("steps") or []:
        exercise = step.get("exercise")
        if exercise and exercise.get("id"):
            exercises.append((exercise["id"], exercise.get("stable_id")))
    return exercises


def _identity_lists(
    exercises: list[tuple[str, str | None]],
) -> list[str]:
    return [stable_id or raw_id for raw_id, stable_id in exercises]


def _still_resolves(
    old_id: str, old_stable_id: str | None, new_exercises: list[tuple[str, str | None]]
) -> bool:
    """Mirror ``matchesExerciseIdentity`` (#2130): a row keyed by EITHER the
    authored id or the stable_id still finds its exercise if either field of
    the new version matches. Minting a stable_id onto an unchanged id is
    therefore never a removal - the row still resolves via the id field,
    exactly as it did before minting."""
    for new_raw_id, new_stable_id in new_exercises:
        if old_id in (new_raw_id, new_stable_id):
            return True
        if old_stable_id is not None and old_stable_id in (new_raw_id, new_stable_id):
            return True
    return False


def _classify(old_ids: list[str], new_ids: list[str], removed_id: str) -> str:
    """Mirror ``classify()`` in exercise-remap-plan.ts, one language over."""
    if removed_id not in old_ids:
        return "not_in_cached"
    index = old_ids.index(removed_id)
    candidate = new_ids[index] if index < len(new_ids) else None
    if candidate is not None and candidate in old_ids:
        return "reordered"
    if len(new_ids) != len(old_ids):
        return "shifted"
    if candidate is None:
        return "shifted"
    return "certain"


def measure(
    repo: Path, max_commits: int | None
) -> tuple[Counter[str], list[tuple[str, str, str, str]]]:
    commits = _git("log", "--first-parent", "--format=%H", cwd=repo).splitlines()
    if max_commits:
        commits = commits[:max_commits]
    # Oldest -> newest, so each pair is compared parent -> child chronologically.
    commits = list(reversed(commits))

    counts: Counter[str] = Counter()
    examples: list[tuple[str, str, str, str]] = []

    minted = 0
    for old_commit, new_commit in zip(commits, commits[1:]):
        for path in _changed_lesson_files(old_commit, new_commit, repo):
            old_text = _read_file_at(old_commit, path, repo)
            new_text = _read_file_at(new_commit, path, repo)
            if old_text is None or new_text is None:
                continue
            old_exercises = _exercises_of(old_text)
            new_exercises = _exercises_of(new_text)
            if old_exercises is None or new_exercises is None:
                continue
            old_ids = _identity_lists(old_exercises)
            new_ids = _identity_lists(new_exercises)
            if old_ids == new_ids:
                continue
            for raw_id, stable_id in old_exercises:
                identity = stable_id or raw_id
                if identity in new_ids:
                    continue  # still resolves via the identity list itself
                if _still_resolves(raw_id, stable_id, new_exercises):
                    # #2130 minting: the id is unchanged, only stable_id was
                    # newly added - a row keyed by the id still resolves,
                    # nothing was orphaned. Counted separately, not as an
                    # AUTH-05 case.
                    minted += 1
                    continue
                verdict = _classify(old_ids, new_ids, identity)
                counts[verdict] += 1
                if len(examples) < 20:
                    examples.append((new_commit[:8], path, identity, verdict))
    counts["minted_no_orphan"] = minted

    return counts, examples


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", type=Path, help="Path to a content-repo checkout")
    parser.add_argument(
        "--max-commits",
        type=int,
        default=None,
        help="Limit to the N most recent first-parent commits (default: all)",
    )
    args = parser.parse_args()

    if not (args.repo / ".git").exists():
        print(f"error: {args.repo} is not a git checkout", file=sys.stderr)
        return 2

    counts, examples = measure(args.repo, args.max_commits)

    minted = counts.pop("minted_no_orphan", 0)
    total = sum(counts.values())
    print(
        f"Measured {total} genuine exercise-identity-vanished event(s) "
        f"(AUTH-05's target case) across the walked history."
    )
    print(
        f"  ({minted} additional event(s) were a #2130 stable_id-minting "
        "no-op - id unchanged, still resolves via matchesExerciseIdentity, "
        "not counted above)"
    )
    for verdict, n in counts.most_common():
        print(f"  {verdict}: {n}")
    if total:
        certain = counts.get("certain", 0)
        uncertain = total - certain
        print(f"\ncertain : uncertain-or-unresolved  =  {certain} : {uncertain}")

    if examples:
        print("\nExample events (up to 20):")
        for commit, path, removed_id, verdict in examples:
            print(f"  {commit} {path} removed={removed_id!r} -> {verdict}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
