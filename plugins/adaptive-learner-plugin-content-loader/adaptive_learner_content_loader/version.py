"""Semver-aware version comparison
(Phase 43 / EXP-002 / 2C-cache — P-105 helper).

A standalone helper so the cache layer can decide whether to
re-download a set without depending on the ``packaging`` PyPI
package (one fewer transitive dep) and without writing its own
ad-hoc tuple comparison every time.

The comparator follows semver 2.0 ordering with two practical
relaxations the project's version regex (see ``models.py``)
already accepts:

- Two-component versions ``X.Y`` are allowed (zero-padded to
  ``X.Y.0`` for comparison).
- Build metadata (``+meta``) is dropped per the spec — it
  has no ordering effect.

Pre-release identifiers (``-rc1``, ``-alpha.2``) compare
lower than the same numeric core, matching how content
authors will read the strings ("1.0.0 is later than
1.0.0-rc1").
"""

from __future__ import annotations

import re
from functools import total_ordering


_CORE_RE = re.compile(r"^(\d+)(?:\.(\d+))?(?:\.(\d+))?$")


@total_ordering
class _Version:
    """Parsed semver-ish version for ordering."""

    __slots__ = ("raw", "core", "pre")

    def __init__(self, raw: str) -> None:
        # Strip build metadata — it has no ordering effect.
        head, _, _build = raw.partition("+")
        # Split pre-release from core. Empty pre = release.
        core, _, pre = head.partition("-")
        match = _CORE_RE.fullmatch(core)
        if not match:
            raise ValueError(f"version {raw!r} has no parseable X.Y[.Z] core")
        major = int(match.group(1))
        minor = int(match.group(2) or 0)
        patch = int(match.group(3) or 0)
        self.raw = raw
        self.core: tuple[int, int, int] = (major, minor, patch)
        # Pre-release identifiers as a tuple. A release (no
        # pre-release) ranks ABOVE any pre-release, so we
        # represent it as a sentinel that sorts after every
        # tuple of strings.
        self.pre = tuple(pre.split(".")) if pre else None

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, _Version):
            return NotImplemented
        return (self.core, self.pre) == (other.core, other.pre)

    def __lt__(self, other: "_Version") -> bool:
        if self.core != other.core:
            return self.core < other.core
        # Same core: release > any pre-release.
        if self.pre is None and other.pre is None:
            return False
        if self.pre is None:
            return False  # we are the release; we are higher
        if other.pre is None:
            return True  # we are the pre-release; we are lower
        # Both pre-releases: compare per-identifier, numeric
        # identifiers ranking below alphabetic per semver.
        for left, right in zip(self.pre, other.pre):
            ln, rn = left.isdigit(), right.isdigit()
            if ln and rn:
                if int(left) != int(right):
                    return int(left) < int(right)
            elif ln:
                return True  # numeric < alpha
            elif rn:
                return False
            else:
                if left != right:
                    return left < right
        return len(self.pre) < len(other.pre)


def compare_versions(a: str, b: str) -> int:
    """Return -1 if a<b, 0 if a==b, +1 if a>b.

    Raises ``ValueError`` if either string fails to parse —
    callers should validate via the model regex first.
    """
    va, vb = _Version(a), _Version(b)
    if va < vb:
        return -1
    if vb < va:
        return 1
    return 0


def needs_update(cached: str, upstream: str) -> bool:
    """True iff the upstream is strictly newer than the cached.

    A cache hit (``cached == upstream``) returns False —
    keep the existing files, no network round-trip needed.
    A future cache (``cached > upstream``) ALSO returns False:
    the user may have a newer set than the source publishes
    right now, no point downgrading.
    """
    return compare_versions(upstream, cached) > 0
