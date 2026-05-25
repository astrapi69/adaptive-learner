"""ZIP bundler for the learning-repo renderer (BL-30 commit 4).

Takes the ``{path: content}`` dict the renderer produces and
returns the serialized ZIP bytes. Pure function — no I/O, no
DB. Lives in its own module so the route handler stays thin.
"""

from __future__ import annotations

import io
import zipfile


def build_zip(tree: dict[str, str]) -> bytes:
    """Serialize ``tree`` to a deterministic ZIP byte string.

    File entries are written in sorted-key order so the same
    tree always produces the same bytes (useful for byte-equality
    tests + content-hash sidecars if we ever add them). Each
    entry is text encoded as UTF-8.
    """

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(tree):
            zf.writestr(path, tree[path].encode("utf-8"))
    return buffer.getvalue()


def slugify_for_filename(text: str, fallback: str = "project") -> str:
    """Lossy filename slug for ``{project_slug}-learning-repo.zip``.

    Lowercase, alphanumerics + underscore + dash kept; everything
    else collapses to ``-``. Runs of ``-`` collapse to one. Empty
    result falls back to ``fallback``. Matches the topic-folder
    slugifier shape in spirit but uses ``-`` separators since
    they're more idiomatic in filenames.
    """

    chars = [c.lower() if c.isalnum() else "-" for c in text]
    slug = "".join(chars).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or fallback
