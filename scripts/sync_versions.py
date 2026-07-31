#!/usr/bin/env python3
"""Synchronize all subsystem versions to backend/pyproject.toml.

`backend/pyproject.toml` is the canonical Python source-of-truth.
This script reads its version and writes the same value to every
derived location:

- ``frontend/package.json`` (top-level "version" key)
- ``launcher/pyproject.toml`` (Poetry version)
- ``launcher/adaptive_learner_launcher/__init__.py`` (``__version__`` literal)
- ``launcher/adaptive-learner-launcher.spec`` (CFBundleVersion +
  CFBundleShortVersionString plist entries; both get the same value)
- ``launcher/launcher.json`` (``app_version`` field; the docker-app-launcher
  update check compares it against the latest GitHub release)
- ``plugins/*/pyproject.toml`` (every plugin)
- Plugin ``__init__.py`` files that hold a ``__version__ = "..."``
  literal AND do not already use importlib.metadata or tomllib
  (skip files that already derive)
- The human-readable version-display sites (README badges + "current
  release" lines) listed in ``scripts/version_display_sites.py`` (#2179);
  ``verify_docs.py`` checks the SAME list, so writer and checker cannot
  drift apart.

After updating those files, this script regenerates ``install.sh``
via the existing ``scripts/generate_install_sh.sh``.

Modes:
  apply (default): write changes
  --dry-run:        show changes without writing
  --check:          exit 1 if any drift detected; never writes

The --check mode is what verify_version_pins.sh and CI use.

stdlib only (tomllib, json, re, subprocess).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CANONICAL = REPO / "backend" / "pyproject.toml"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from version_display_sites import VERSION_DISPLAY_SITES  # noqa: E402


def sync_version_display_sites(
    canonical: str, dry_run: bool, root: Path = REPO
) -> tuple[int, int, list[str]]:
    """Rewrite the human-readable version-display sites (#2179).

    Returns ``(sites_changed, sites_inspected, problems)``. A missing file
    or a vanished pattern is a PROBLEM (fail closed at the caller), never a
    silent skip - "0 found" must not read as "0 drift". The inspected count
    is printed by the caller so the measured set is part of the output
    (gate contract point 4).
    """
    changed = 0
    inspected = 0
    problems: list[str] = []
    if not VERSION_DISPLAY_SITES:
        return 0, 0, ["version_display_sites.py lists no sites (fail-closed)"]
    for rel, pattern, label in VERSION_DISPLAY_SITES:
        path = root / rel
        if not path.exists():
            problems.append(f"{label}: {rel} is missing")
            continue
        text = path.read_text(encoding="utf-8")
        match = re.search(pattern, text)
        if match is None:
            problems.append(f"{label}: pattern not found in {rel} (site drifted?)")
            continue
        inspected += 1
        if match.group(1) == canonical:
            continue
        changed += 1
        print(f"  display: {rel}: {match.group(1)} -> {canonical} ({label})")
        if not dry_run:
            def _swap(m: re.Match) -> str:
                start, end = m.span(1)
                offset = m.start()
                return m.group(0)[: start - offset] + canonical + m.group(0)[end - offset :]

            path.write_text(re.sub(pattern, _swap, text), encoding="utf-8")
    return changed, inspected, problems


def read_canonical_version() -> str:
    with CANONICAL.open("rb") as f:
        data = tomllib.load(f)
    return data["tool"]["poetry"]["version"]


def update_pyproject_version(
    path: Path, new_version: str, dry_run: bool
) -> bool:
    """Update first ``version = "..."`` line under ``[tool.poetry]``.
    Returns True if the file changed (or would change in dry-run)."""
    content = path.read_text(encoding="utf-8")
    pattern = re.compile(r'^(version\s*=\s*)"([^"]+)"', re.MULTILINE)
    match = pattern.search(content)
    if not match:
        print(f"WARN: no version field in {path}", file=sys.stderr)
        return False
    if match.group(2) == new_version:
        return False
    new_content = pattern.sub(rf'\g<1>"{new_version}"', content, count=1)
    if not dry_run:
        path.write_text(new_content, encoding="utf-8")
    print(f"  {path.relative_to(REPO)}: {match.group(2)} -> {new_version}")
    return True


def update_package_json_version(
    path: Path, new_version: str, dry_run: bool
) -> bool:
    content = path.read_text(encoding="utf-8")
    data = json.loads(content)
    if data.get("version") == new_version:
        return False
    old = data.get("version")
    data["version"] = new_version
    if not dry_run:
        # Preserve trailing newline + 2-space indent (npm default).
        path.write_text(
            json.dumps(data, indent=2) + "\n", encoding="utf-8"
        )
    print(f"  {path.relative_to(REPO)}: {old} -> {new_version}")
    return True


def _display_path(path: Path) -> str:
    """Format a path for user-facing output.

    Prefers repo-relative when the path lives inside REPO (the
    production case); falls back to the bare filename when the
    path is outside REPO (e.g. tempfile-based unit tests).
    """
    try:
        return str(path.relative_to(REPO))
    except ValueError:
        return path.name


def update_spec_plist(
    path: Path, new_version: str, dry_run: bool
) -> bool:
    """Update CFBundleVersion + CFBundleShortVersionString in
    PyInstaller spec. Both keys get the same value (no Apple-style
    separation between user-facing and build-number)."""
    content = path.read_text(encoding="utf-8")
    changed = False

    for key in ("CFBundleVersion", "CFBundleShortVersionString"):
        pattern = re.compile(
            rf'("{re.escape(key)}":\s*)["\']([^"\']+)["\']'
        )
        match = pattern.search(content)
        if match and match.group(2) != new_version:
            content = pattern.sub(
                rf'\g<1>"{new_version}"', content, count=1
            )
            print(
                f"  {path.relative_to(REPO)} ({key}): "
                f"{match.group(2)} -> {new_version}"
            )
            changed = True

    if changed and not dry_run:
        path.write_text(content, encoding="utf-8")
    return changed


def update_init_version_literal(
    path: Path, new_version: str, dry_run: bool
) -> bool:
    """Update ``__version__ = "..."`` literal in __init__.py.

    Skips files that already use importlib.metadata or tomllib for
    derivation. Frozen binaries (PyInstaller) need the literal
    embedded; that is why we keep the literal pattern for the
    launcher rather than refactoring to importlib."""
    if not path.is_file():
        return False
    content = path.read_text(encoding="utf-8")
    if "importlib.metadata" in content or "tomllib" in content:
        return False
    pattern = re.compile(
        r'^(__version__\s*=\s*)"([^"]+)"', re.MULTILINE
    )
    match = pattern.search(content)
    if not match:
        return False
    if match.group(2) == new_version:
        return False
    new_content = pattern.sub(rf'\g<1>"{new_version}"', content, count=1)
    if not dry_run:
        path.write_text(new_content, encoding="utf-8")
    print(
        f"  {path.relative_to(REPO)}: __version__ "
        f"{match.group(2)} -> {new_version}"
    )
    return True


def update_launcher_json_app_version(
    path: Path, new_version: str, dry_run: bool
) -> bool:
    """Update the version-bearing fields in ``launcher.json`` (surgical).

    ``launcher.json`` is the docker-app-launcher config. Its ``app_version``
    drives the update check (compared against the latest GitHub release);
    the ``image_reference`` tag pins which published GHCR image the image
    mode pulls (#2110 Teil 4) - both must track the canonical version. A
    regex per value keeps the rest of the hand-formatted JSON untouched
    (no full reserialization)."""
    if not path.is_file():
        return False
    content = path.read_text(encoding="utf-8")
    changed = False
    fields = (
        ("app_version", re.compile(r'("app_version"\s*:\s*")([^"]+)(")')),
        (
            "image_reference",
            re.compile(
                r'("image_reference"\s*:\s*"ghcr\.io/astrapi69/adaptive-learner:)([^"]+)(")'
            ),
        ),
    )
    display = path.relative_to(REPO) if path.is_relative_to(REPO) else path
    for field, pattern in fields:
        match = pattern.search(content)
        if not match or match.group(2) == new_version:
            continue
        content = pattern.sub(rf"\g<1>{new_version}\g<3>", content, count=1)
        print(
            f"  {display}: {field} "
            f"{match.group(2)} -> {new_version}"
        )
        changed = True
    if changed and not dry_run:
        path.write_text(content, encoding="utf-8")
    return changed


_INSTALL_PLACEHOLDER = "@@ADAPTIVE_LEARNER_VERSION@@"

# Generated installer artifacts. The template is the editable source;
# the target is regenerated at release time. ``executable`` controls
# whether ``chmod 0o755`` is applied after a write - install.sh +
# install.ps1 both flip the bit on Linux/macOS so they curl-pipe
# directly without an extra ``chmod`` step. Windows ignores the bit.
_INSTALL_ARTIFACTS = (
    {
        "label": "install.sh",
        "template": REPO / "install.sh.template",
        "target": REPO / "install.sh",
        "executable": True,
    },
    {
        "label": "install.ps1",
        "template": REPO / "install.ps1.template",
        "target": REPO / "install.ps1",
        "executable": False,
    },
)


def _render_template(template_path: Path, canonical_version: str) -> str:
    """Substitute ``@@ADAPTIVE_LEARNER_VERSION@@`` -> ``v<canonical_version>``.

    Pure-Python so the same code path works on every platform. The
    earlier bash-only generator could resolve to either Git Bash or
    WSL2 on Windows runners depending on PATH order; WSL2 mishandles
    native Windows paths and returned spurious drift.
    """
    return template_path.read_text(encoding="utf-8").replace(
        _INSTALL_PLACEHOLDER, f"v{canonical_version}"
    )


def _regenerate_one(artifact: dict, canonical: str, dry_run: bool) -> bool:
    """Regenerate a single artifact from its template. Returns True
    when the artifact changed (or would change in dry-run)."""
    template_path: Path = artifact["template"]
    target_path: Path = artifact["target"]
    label: str = artifact["label"]
    executable: bool = artifact["executable"]

    if not template_path.is_file():
        print(
            f"WARN: {template_path.relative_to(REPO)} missing, "
            f"{label} not regenerated",
            file=sys.stderr,
        )
        return False

    rendered = _render_template(template_path, canonical)

    if not target_path.is_file():
        if dry_run:
            print(f"  {label} would be created from template")
        else:
            target_path.write_text(rendered, encoding="utf-8")
            if executable:
                try:
                    target_path.chmod(0o755)
                except OSError:
                    pass
            print(f"  {label} created from template")
        return True

    if target_path.read_text(encoding="utf-8") == rendered:
        return False

    if dry_run:
        print(f"  {label} would be regenerated from template")
    else:
        target_path.write_text(rendered, encoding="utf-8")
        if executable:
            try:
                target_path.chmod(0o755)
            except OSError:
                pass
        print(f"  {label} regenerated from template")
    return True


def regenerate_install_sh(dry_run: bool) -> bool:
    """Regenerate every installer artifact (install.sh + install.ps1).

    Returns True if any artifact changed (or would change in dry-run).
    The name is kept for backward compatibility with verify scripts +
    callers that pre-date install.ps1.
    """
    canonical = read_canonical_version()
    changed = False
    for artifact in _INSTALL_ARTIFACTS:
        if _regenerate_one(artifact, canonical, dry_run):
            changed = True
    return changed


def collect_targets() -> list[tuple[Path, str]]:
    """Return list of (file, kind). Kinds: pyproject, package_json,
    spec, init_literal."""
    targets: list[tuple[Path, str]] = []

    targets.append((REPO / "frontend" / "package.json", "package_json"))
    # frontend/bun.lock carries NO app version (unlike npm's package-lock.json,
    # which duplicated it in two fields), so there is nothing to sync there.

    targets.append((REPO / "launcher" / "pyproject.toml", "pyproject"))
    targets.append(
        (
            REPO / "launcher" / "adaptive_learner_launcher" / "__init__.py",
            "init_literal",
        )
    )
    targets.append(
        (REPO / "launcher" / "adaptive-learner-launcher.spec", "spec")
    )
    targets.append(
        (REPO / "launcher" / "launcher.json", "launcher_json")
    )

    for plugin_pyproject in sorted(
        (REPO / "plugins").glob("*/pyproject.toml")
    ):
        targets.append((plugin_pyproject, "pyproject"))
    for plugin_init in sorted((REPO / "plugins").glob("*/*/__init__.py")):
        targets.append((plugin_init, "init_literal"))

    return targets


HANDLERS = {
    "pyproject": update_pyproject_version,
    "package_json": update_package_json_version,
    "spec": update_spec_plist,
    "init_literal": update_init_version_literal,
    "launcher_json": update_launcher_json_app_version,
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group()
    g.add_argument(
        "--dry-run",
        action="store_true",
        help="show changes without writing",
    )
    g.add_argument(
        "--check",
        action="store_true",
        help="exit 1 if any drift; never writes",
    )
    args = ap.parse_args()

    canonical = read_canonical_version()
    label = "Canonical version (backend/pyproject.toml)"
    print(f"{label}: {canonical}")
    print()

    if args.check:
        drift = 0
        for path, kind in collect_targets():
            if HANDLERS[kind](path, canonical, dry_run=True):
                drift += 1
        if regenerate_install_sh(dry_run=True):
            drift += 1
        d_changed, d_inspected, d_problems = sync_version_display_sites(
            canonical, dry_run=True
        )
        print(
            f"Inspected {d_inspected} version-display site(s): "
            f"{d_changed} drifted."
        )
        for problem in d_problems:
            print(f"FAIL display-site: {problem}", file=sys.stderr)
        drift += d_changed + len(d_problems)
        print()
        if drift > 0:
            print(f"DRIFT: {drift} file(s) out of sync with {canonical}.")
            return 1
        print(f"All subsystems in sync with {canonical}.")
        return 0

    changed_count = 0
    for path, kind in collect_targets():
        if HANDLERS[kind](path, canonical, args.dry_run):
            changed_count += 1
    if regenerate_install_sh(args.dry_run):
        changed_count += 1
    d_changed, d_inspected, d_problems = sync_version_display_sites(
        canonical, dry_run=args.dry_run
    )
    print(
        f"Inspected {d_inspected} version-display site(s): "
        f"{d_changed} rewritten."
    )
    changed_count += d_changed

    print()
    if d_problems:
        for problem in d_problems:
            print(f"FAIL display-site: {problem}", file=sys.stderr)
        return 1
    if args.dry_run:
        print(
            f"DRY RUN: {changed_count} file(s) would be updated "
            f"to {canonical}."
        )
    else:
        print(
            f"Synced {changed_count} file(s) to {canonical}."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
