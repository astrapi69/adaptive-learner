"""Deployment-mode readiness for the runtime assets (#2109).

The bundle manifest (:mod:`bundle_manifest`) answers "is everything in the
bundle that should be?". It correctly reported "Bundle complete." while
the device could not install, because the failure was not a missing file:
``~/adaptive-learner`` held a complete source tree and the launcher still
looked for ``/tmp/_MEIxxxx/backend/Dockerfile``.

The cause is the BASE, not the asset. ``docker-app-launcher`` 0.21.0 bases
app-relative paths on the config file's own directory when the config sets
no ``install_dir`` (upstream #64, ``config.py:426``) - and the frozen
config lives inside the PyInstaller bundle. No completeness check can see
that; every file exists, just not under the base the resolution uses.

So this module checks the other half: given a mode and the base that will
actually be used, do the paths that mode needs resolve to real files? And
when they do not, it looks in the places the user plausibly has them, so
the message can say WHERE the tree is instead of blaming the config.

Example::

    report = deployment_assets.check_config(cfg, base=Path("/tmp/_MEIabc"))
    if not report.ok:
        for line in report.explain():
            print(line, file=sys.stderr)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

KNOWN_MODES = ("compose", "dockerfile", "image")


@dataclass
class ReadinessReport:
    """What was checked, what is missing, and where it was found instead.

    ``checked`` is not decoration: a checker that inspected nothing must
    not be mistaken for one that found nothing wrong (gate contract
    point 4, quality-checks.md).
    """

    base: Path
    mode: str
    checked: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    found_elsewhere: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.missing

    def explain(self) -> list[str]:
        """Human-facing diagnosis - the cause, not a guess at the cause."""
        lines = [
            f"Deployment mode '{self.mode}' cannot run: "
            f"{len(self.missing)} of {len(self.checked)} required path(s) "
            f"do not exist under {self.base}.",
        ]
        lines += [f"  missing: {path}" for path in self.missing]
        if self.found_elsewhere:
            lines.append(
                "The files DO exist - the launcher is looking in the wrong place, "
                "not at a broken installation:"
            )
            lines += [f"  found: {path}" for path in self.found_elsewhere]
            lines.append(
                "This is a path-resolution bug in the launcher (#2109), not a "
                "setting you need to change."
            )
        return lines


def _required(
    mode: str, *, compose_file: str, dockerfile: str, build_context: str, image_archive: str
) -> list[str]:
    if mode == "dockerfile":
        return [dockerfile, build_context]
    if mode == "compose":
        return [compose_file]
    if mode == "image":
        # The image is pulled from the pinned reference; the only
        # filesystem prerequisite is the OPTIONAL registry-free archive,
        # which resolves against the same base as every other consumer
        # path (upstream #78: the archive is loaded INTO the reference).
        return [image_archive] if image_archive else []
    return []


def check(
    *,
    mode: str,
    base: Path,
    compose_file: str = "docker-compose.prod.yml",
    dockerfile: str = "backend/Dockerfile",
    build_context: str = ".",
    image_archive: str = "",
    elsewhere: list[Path] | None = None,
) -> ReadinessReport:
    """Check the assets ``mode`` needs, relative to ``base``.

    Args:
        mode: ``"compose"``, ``"dockerfile"`` or ``"image"``. Anything
            else fails closed - an unrecognised mode means the check does
            not know what to look for, which is never the same as
            "nothing to look for". Image mode without a configured
            ``image_archive`` has no filesystem prerequisites (the image
            is pulled from the pinned reference), so its report is ok
            with an explicitly noted empty check list.
        base: the directory app-relative paths resolve against. For a
            frozen run this is the config file's directory, i.e. the
            bundle root - which is exactly the #2109 defect.
        elsewhere: additional roots to search when something is missing,
            so the report can name where the file actually is.

    Returns:
        A :class:`ReadinessReport`; ``report.ok`` is the verdict.
    """
    report = ReadinessReport(base=base, mode=mode)
    if mode not in KNOWN_MODES:
        report.missing.append(
            f"unknown deployment mode {mode!r} (known: {', '.join(KNOWN_MODES)})"
        )
        return report

    if mode == "image" and not image_archive:
        # Point 4 of the gate contract: an empty check list must be a
        # STATED verdict, never mistakable for "forgot to look".
        report.checked.append("(no filesystem prerequisites: the image is pulled from the pinned reference)")
        return report

    for relative in _required(
        mode,
        compose_file=compose_file,
        dockerfile=dockerfile,
        build_context=build_context,
        image_archive=image_archive,
    ):
        report.checked.append(relative)
        candidate = base / relative
        if candidate.exists():
            continue
        report.missing.append(str(candidate))
        for root in elsewhere or []:
            alternative = root / relative
            if alternative.exists():
                report.found_elsewhere.append(str(alternative))
    return report


def check_config(config: Any, *, base: Path, elsewhere: list[Path] | None = None) -> ReadinessReport:
    """Same check, driven by a ``LauncherConfig``.

    Reads the mode and the three path fields off the config, defaulting
    the way the package itself does (an empty ``deployment_mode`` means
    compose).
    """
    mode = getattr(config, "deployment_mode", "") or "compose"
    return check(
        mode=mode,
        base=base,
        compose_file=getattr(config, "compose_file", "") or "docker-compose.prod.yml",
        dockerfile=getattr(config, "dockerfile_file", "") or "backend/Dockerfile",
        build_context=getattr(config, "build_context", "") or ".",
        image_archive=getattr(config, "image_archive", "") or "",
        elsewhere=elsewhere,
    )
