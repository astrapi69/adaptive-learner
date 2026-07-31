"""Every path resolver is pinned in the e2e config (#2263).

The e2e backend must never reach the developer's real machine. #2248
closed the config-dir channel after the suite read the real
``secrets.yaml``; the inventory that followed found ``get_cache_dir``
still unpinned, so ``content_backup`` wrote into the developer's real
``~/.cache/adaptive_learner``.

This pins the CLASS, not the instance: every ``ADAPTIVE_LEARNER_*_DIR``
resolver that exists in ``app/paths.py`` must be set in the e2e
config's backend environment. A fourth resolver added later cannot
quietly stay unpinned - this test turns red the moment it is added.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PATHS_MODULE = REPO_ROOT / "backend" / "app" / "paths.py"
E2E_CONFIG = REPO_ROOT / "e2e" / "playwright.config.ts"

# Env vars read by the resolvers in app/paths.py.
RESOLVER_ENV_RE = re.compile(r'os\.environ\.get\("(ADAPTIVE_LEARNER_[A-Z_]*DIR)"\)')


def _declared_resolvers() -> set[str]:
    return set(RESOLVER_ENV_RE.findall(PATHS_MODULE.read_text(encoding="utf-8")))


def test_paths_module_declares_the_expected_resolver_set() -> None:
    """Point 4: name what was measured - an empty set must not read clean."""
    resolvers = _declared_resolvers()
    assert resolvers, "found no ADAPTIVE_LEARNER_*_DIR resolvers in paths.py - scan is broken"
    print(f"resolvers found in paths.py: {sorted(resolvers)}")
    assert "ADAPTIVE_LEARNER_DATA_DIR" in resolvers


def test_every_path_resolver_is_pinned_in_the_e2e_backend_env() -> None:
    config = E2E_CONFIG.read_text(encoding="utf-8")
    unpinned = sorted(env for env in _declared_resolvers() if f"{env}=" not in config)
    assert not unpinned, (
        f"{unpinned} not pinned in {E2E_CONFIG.relative_to(REPO_ROOT)} - the e2e backend "
        "would resolve them against the developer's real machine (#2248/#2263). Add each "
        "to the BACKEND_ENV block, pointing inside the throwaway e2e data dir."
    )


def test_pinned_values_stay_inside_the_throwaway_dir() -> None:
    """A pin that points at a real user directory is not isolation."""
    config = E2E_CONFIG.read_text(encoding="utf-8")
    for env in sorted(_declared_resolvers()):
        for match in re.finditer(rf"{env}=(\S+?)`", config):
            value = match.group(1)
            assert "E2E_DATA_DIR" in value or value.startswith("/tmp/"), (
                f"{env} is pinned to {value!r}, which is not inside the throwaway e2e dir"
            )
