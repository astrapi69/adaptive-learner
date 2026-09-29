"""FeatureShot catalogue gate for scripts/verify_docs.py (#3182).

The catalogue table in ``e2e/visual/features/README.md`` names PNGs that
a maintainer machine renders and commits (CI cannot render them). Three
times (#3080, #3088, #3182) the ``FEATURES`` entry and the README row
merged while the files never did, so the catalogue promised images the
gallery did not have. This check FAILs on a referenced PNG that is not
on disk and on a PNG on disk no row names; a row whose render is still
owed carries an inline ``<!-- shot-pending: <reason> -->`` marker, which
is accepted only while at least one of its files is missing (a marker on
a complete row is stale and FAILs too), so the debt stays visible in the
README and leaves with the files.

A missing README or a catalogue without rows is a FAIL: a missing basis
never reads as clean (#2287).
"""

from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path
from typing import Protocol

CHECK = "feature-shots"
FEATURE_SHOTS_DIR = Path(__file__).resolve().parent.parent / "e2e" / "visual" / "features"


def _read_utf8(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class _Report(Protocol):
    def fail(self, check: str, message: str, fixed: bool = False) -> None: ...

    def note(self, message: str) -> None: ...


FEATURE_SHOT_REF_RE = re.compile(r"`((?:[a-z0-9-]+/)?[a-z0-9.-]+\.png)`")
SHOT_PENDING_RE = re.compile(r"<!--\s*shot-pending:\s*(.*?)\s*-->")


def _catalogue_rows(readme: str) -> list[str]:
    """The data rows of the catalogue table (header and separator dropped)."""
    rows = []
    for line in readme.splitlines():
        if not line.startswith("| "):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if cells and (cells[0] == "Feature" or set(cells[0]) <= {"-"}):
            continue
        rows.append(line)
    return rows


def _row_shot_refs(row: str) -> tuple[list[str], list[str]]:
    """Resolve a row's PNG references to folder-qualified paths.

    A bare name (``matching-pairing.landscape.png`` in the Feature cell)
    belongs to the folder the row's qualified references name; returns
    ``(resolved, unresolvable)``.
    """
    raw = FEATURE_SHOT_REF_RE.findall(row)
    folders = {ref.rsplit("/", 1)[0] for ref in raw if "/" in ref}
    resolved, unresolvable = [], []
    for ref in raw:
        if "/" in ref:
            resolved.append(ref)
        elif len(folders) == 1:
            resolved.append(f"{next(iter(folders))}/{ref}")
        else:
            unresolvable.append(ref)
    return resolved, unresolvable


def check_feature_shots(
    report: _Report,
    features_dir: Path | None = None,
    read: Callable[[Path], str] = _read_utf8,
) -> None:
    """FAIL when the FeatureShot catalogue and the PNGs on disk disagree (#3182)."""
    root = features_dir if features_dir is not None else FEATURE_SHOTS_DIR
    readme = root / "README.md"
    if not root.is_dir() or not readme.is_file():
        report.fail(
            CHECK,
            f"{readme} not found - cannot verify the catalogue (basis missing; #2287)",
        )
        return
    rows = _catalogue_rows(read(readme))
    if not rows:
        report.fail(CHECK, f"{readme} has no catalogue rows - cannot verify")
        return
    on_disk = {p.relative_to(root).as_posix() for p in root.rglob("*.png")}
    referenced: set[str] = set()
    pending_rows = 0
    for index, row in enumerate(rows, start=1):
        refs, unresolvable = _row_shot_refs(row)
        for ref in unresolvable:
            report.fail(
                CHECK,
                f"catalogue row {index}: `{ref}` names no folder and the row names none either",
            )
        referenced.update(refs)
        missing = [ref for ref in refs if ref not in on_disk]
        pending = SHOT_PENDING_RE.search(row)
        if pending and not missing:
            report.fail(
                CHECK,
                f"catalogue row {index}: stale shot-pending marker ({pending.group(1)}) - "
                "every file of the row exists, remove the marker",
            )
        elif pending:
            pending_rows += 1
            report.note(
                f"feature-shots: row {index} pending ({pending.group(1)}): {', '.join(missing)}"
            )
        else:
            for ref in missing:
                report.fail(
                    CHECK,
                    f"catalogue row {index} names `{ref}` but the file is not on disk - "
                    "render and commit it, or mark the row <!-- shot-pending: <reason> --> (#3182)",
                )
    for orphan in sorted(on_disk - referenced):
        report.fail(
            CHECK,
            f"`{orphan}` is on disk but no catalogue row names it - add the row (#3182)",
        )
    report.note(
        f"feature-shots: {len(rows)} catalogue rows, {len(referenced)} referenced files, "
        f"{len(on_disk)} on disk, {pending_rows} rows pending"
    )
