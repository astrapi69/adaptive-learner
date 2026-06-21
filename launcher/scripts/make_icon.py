"""Generate the launcher icon from the Adaptive Learner brand mark.

Writes ``launcher/adaptive-learner.ico`` (multi-size Windows icon) and
``launcher/adaptive-learner.png`` (512px, for Linux .desktop entries)
from the canonical brand art. Run via ``python scripts/make_icon.py``
from the launcher dir; the launcher CI workflows call it before
PyInstaller so the frozen binaries embed the real Adaptive Learner mark.

Source priority (first that exists wins):
    frontend/branding/adaptive-learner-mark.png   (1024px master)
    frontend/public/icon-512.png
    frontend/public/maskable-icon-512x512.png

If no source is found (e.g. a sparse checkout without ``frontend/``),
the already-committed ``adaptive-learner.ico`` is left untouched so the
build still embeds the correct icon rather than failing.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image


SIZES = (16, 32, 48, 64, 128, 256)

_LAUNCHER_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _LAUNCHER_DIR.parent
_ICO_OUT = _LAUNCHER_DIR / "adaptive-learner.ico"
_PNG_OUT = _LAUNCHER_DIR / "adaptive-learner.png"

_SOURCE_CANDIDATES = (
    _REPO_ROOT / "frontend" / "branding" / "adaptive-learner-mark.png",
    _REPO_ROOT / "frontend" / "public" / "icon-512.png",
    _REPO_ROOT / "frontend" / "public" / "maskable-icon-512x512.png",
)


def _find_source() -> Path | None:
    for candidate in _SOURCE_CANDIDATES:
        if candidate.is_file():
            return candidate
    return None


def main() -> None:
    source = _find_source()
    if source is None:
        print(
            "make_icon: no brand source found under frontend/; leaving "
            f"{_ICO_OUT.name} unchanged."
        )
        return

    master = Image.open(source).convert("RGBA")

    # PIL's ICO writer reads sizes= off the source image and downscales
    # itself, so feed it a clean 256px square and let it generate the rest.
    largest = master.resize((max(SIZES), max(SIZES)), Image.LANCZOS)
    largest.save(_ICO_OUT, format="ICO", sizes=[(s, s) for s in SIZES])

    # 512px PNG for Linux .desktop launchers.
    master.resize((512, 512), Image.LANCZOS).save(_PNG_OUT, format="PNG")

    print(f"Wrote {_ICO_OUT} (sizes {SIZES}) and {_PNG_OUT} from {source}")


if __name__ == "__main__":
    main()
