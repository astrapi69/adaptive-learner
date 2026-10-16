#!/usr/bin/env python3
"""Dependency currency report for every surface (release Step 4b, #3778).

``make release-outdated`` used to list three surfaces by hand (backend,
launcher, frontend) while the repository had twenty, so the plugins with their
own ``poetry.lock``, ``docs/``, ``e2e/``, the pre-commit revs, the GitHub
Actions and the Docker base images were reported by nothing before a release.

The package surfaces are found, not listed: every directory with a
``pyproject.toml`` (poetry) or a ``package.json`` (bun) outside dependency and
fixture trees. Then the pre-commit hook revs and the action refs against their
newest tags, the ``FROM`` lines, and the pinned Bun against npm.

A report, not a gate: it always exits 0. A surface that cannot be checked
(no poetry, no network) says so in its section instead of disappearing. The
release session decides what to bump (patch + minor within a major; majors in
their own session, release-workflow.md Step 4b).
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SKIPPED_PARTS = {
    "node_modules",
    ".venv",
    "venv",
    "dist",
    "build",
    "fixtures",
    "__fixtures__",
    "site",
}
PLUGIN_PREFIX = "adaptive-learner-plugin-"
VERSION_TAG = re.compile(r"^v?(\d+(?:\.\d+)*)$")


def package_surfaces(root: Path) -> dict[str, list[Path]]:
    """Every poetry and bun project directory under ``root``, sorted."""
    found: dict[str, list[Path]] = {"poetry": [], "bun": []}
    for kind, manifest in (("poetry", "pyproject.toml"), ("bun", "package.json")):
        for path in root.rglob(manifest):
            rel_parts = path.relative_to(root).parts[:-1]
            if any(part in SKIPPED_PARTS or part.startswith(".") for part in rel_parts):
                continue
            if not rel_parts:
                continue
            found[kind].append(path.parent)
    return {kind: sorted(dirs) for kind, dirs in found.items()}


def precommit_revs(text: str) -> list[tuple[str, str]]:
    """(repo URL, rev) of every remote hook repo in .pre-commit-config.yaml."""
    return re.findall(r"-\s+repo:\s*(https?://\S+)\s*\n\s+rev:\s*['\"]?([^'\"\s]+)", text)


def action_refs(texts: list[str]) -> list[tuple[str, str]]:
    """(owner/repo, ref) of every remote action, once each, sorted."""
    refs = set()
    for text in texts:
        for owner, repo, ref in re.findall(
            r"uses:\s*([\w.-]+)/([\w.-]+)(?:/[\w./-]+)?@([\w.-]+)", text
        ):
            refs.add((f"{owner}/{repo}", ref))
    return sorted(refs)


def newest_tag(tags: list[str]) -> str | None:
    """The highest plain version tag (``v1.2.3`` or ``1.2.3``); pre-releases and peeled refs are ignored."""
    versions = [(parts, tag) for tag in tags if (parts := _parts(tag))]
    return max(versions)[1] if versions else None


def _parts(tag: str) -> tuple[int, ...] | None:
    match = VERSION_TAG.match(tag)
    return tuple(int(n) for n in match.group(1).split(".")) if match else None


def is_behind(current: str, newest: str | None) -> bool:
    """Whether ``newest`` is news for a ref pinned as ``current``. A major-only
    ref (``v5``, the action convention) is behind only on a newer major; an
    exact rev (``v0.17.0``) on any newer version."""
    cur, new = _parts(current), (_parts(newest) if newest else None)
    if cur is None or new is None:
        return False
    if len(cur) == 1:
        return new[0] > cur[0]
    return new > cur


def from_lines(text: str) -> list[str]:
    """The image of every ``FROM`` line of a Dockerfile."""
    return [
        line.split(None, 1)[1].strip() for line in text.splitlines() if line.startswith("FROM ")
    ]


def _run(cmd: list[str], cwd: Path) -> str:
    try:
        result = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=300, check=False
        )
    except FileNotFoundError:
        return f"(could not check: {cmd[0]} is not installed)"
    except subprocess.TimeoutExpired:
        return "(could not check: timed out)"
    out = (result.stdout + result.stderr).strip()
    return out or "(nothing outdated)"


def _remote_tags(url: str) -> list[str]:
    out = subprocess.run(
        ["git", "ls-remote", "--tags", "--refs", url],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    return [
        line.rsplit("refs/tags/", 1)[1] for line in out.stdout.splitlines() if "refs/tags/" in line
    ]


def _section(title: str) -> None:
    print(f"\n=== {title} ===")


def _report_packages(root: Path) -> None:
    surfaces = package_surfaces(root)
    for path in surfaces["poetry"]:
        _section(f"{path.relative_to(root)} (poetry show --outdated)")
        out = _run(["poetry", "show", "--outdated", "--no-ansi"], path)
        if path.name == "backend":
            # The backend pulls the plugins as path dependencies; their own
            # surfaces report them.
            out = "\n".join(line for line in out.splitlines() if not line.startswith(PLUGIN_PREFIX))
        print(out)
    for path in surfaces["bun"]:
        _section(f"{path.relative_to(root)} (bun outdated)")
        print(_run(["bun", "outdated"], path))


def _report_tags(title: str, pairs: list[tuple[str, str]], url_of) -> None:
    _section(title)
    for name, current in pairs:
        try:
            newest = newest_tag(_remote_tags(url_of(name)))
        except (OSError, subprocess.SubprocessError) as error:
            print(f"{name}: {current} (could not check: {error})")
            continue
        print(
            f"{name}: {current}  -> {newest}"
            if is_behind(current, newest)
            else f"{name}: {current} (current)"
        )


def main(root: Path = REPO_ROOT) -> int:
    _report_packages(root)
    precommit = root / ".pre-commit-config.yaml"
    if precommit.exists():
        _report_tags(
            "pre-commit hook revs",
            precommit_revs(precommit.read_text(encoding="utf-8")),
            lambda url: url,
        )
    workflows = [
        p.read_text(encoding="utf-8")
        for p in sorted((root / ".github" / "workflows").glob("*.yml"))
    ]
    _report_tags(
        "GitHub Actions (ref against the newest tag)",
        action_refs(workflows),
        lambda repo: f"https://github.com/{repo}",
    )
    _section("Docker base images (check by hand)")
    for dockerfile in sorted(root.rglob("Dockerfile*")):
        if any(part in SKIPPED_PARTS for part in dockerfile.relative_to(root).parts):
            continue
        for image in from_lines(dockerfile.read_text(encoding="utf-8")):
            print(f"{dockerfile.relative_to(root)}: {image}")
    _section("Toolchain: pinned Bun against npm")
    pins = sorted(
        set(
            re.findall(
                r"bun@(\d+\.\d+\.\d+)",
                (root / "backend" / "Dockerfile").read_text(encoding="utf-8"),
            )
        )
    )
    print(
        f"pinned: {', '.join(pins) or '?'}; npm latest: {_run(['npm', 'view', 'bun', 'version'], root)}"
    )
    print(
        "\nApply routine bumps (patch + minor within a major) with 'poetry update <allowlist>' / bun, never bare;"
        " majors get their own session. Mind the two-week rule for fresh releases."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
