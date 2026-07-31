"""Single source for the human-readable version-display sites (#2179).

Consumed by BOTH halves of the version machinery:

- the WRITE path - ``scripts/sync_versions.py`` rewrites these sites on
  every version bump (``make sync-versions``), so a release can no longer
  leave the README badges and "current release" lines stale;
- the CHECK paths - ``scripts/verify_docs.py`` builds its version gate
  entries from this list, and ``sync_versions.py --check`` (which
  ``verify_version_pins.sh`` delegates to) reports drift against it.

One list, two consumers: the writer can never miss a site the checker
knows about, and vice versa. This closed the README-de "current release"
line gap, which the checker alone had missed.

Each entry: (repo-relative path, regex with ONE version capture group,
human label). Every site listed here is mechanically rewritable by
construction - a version embedded in dated/phase prose that must not be
rewritten belongs in ``verify_docs.VERSION_TARGETS``'s non-fixable extra
entries, not here.
"""

VERSION_DISPLAY_SITES = [
    (
        "README.md",
        r"badge/version-v(\d+\.\d+\.\d+)-blue",
        "README version badge",
    ),
    (
        "README.md",
        r"current release is \*\*v(\d+\.\d+\.\d+)\*\*",
        "README status release line",
    ),
    (
        "README-de.md",
        r"badge/version-v(\d+\.\d+\.\d+)-blue",
        "README-de version badge",
    ),
    (
        "README-de.md",
        r"aktuelle Release ist \*\*v(\d+\.\d+\.\d+)\*\*",
        "README-de status release line",
    ),
]
