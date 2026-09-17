"""Every path resolver is pinned to a tmp dir for the pytest run (#3145).

``tests/test_e2e_path_isolation.py`` (#2263) pins the class for the e2e
backend. The pytest side had no such guard: ``conftest.py`` pinned the data
and config dirs but not ``ADAPTIVE_LEARNER_CACHE_DIR``, so ``get_cache_dir()``
resolved to the developer's real ``~/.cache/adaptive_learner`` and the
autouse ``_isolate_content_cache`` fixture deleted the real content-loader
cache before and after every test. Two concurrent runs also cleared each
other's cache mid-test.

Like the e2e guard this pins the CLASS: every ``ADAPTIVE_LEARNER_*_DIR``
resolver in ``app/paths.py`` must be pinned in ``conftest.py`` and must
resolve inside a temporary location while the suite runs.
"""

from __future__ import annotations

import re
import tempfile
from pathlib import Path

from app import paths

REPO_ROOT = Path(__file__).resolve().parents[2]
PATHS_MODULE = REPO_ROOT / "backend" / "app" / "paths.py"
CONFTEST = REPO_ROOT / "backend" / "tests" / "conftest.py"

RESOLVER_ENV_RE = re.compile(r'os\.environ\.get\("(ADAPTIVE_LEARNER_[A-Z_]*DIR)"\)')
RESOLVER_FUNCTIONS = {
    "ADAPTIVE_LEARNER_DATA_DIR": paths.get_data_dir,
    "ADAPTIVE_LEARNER_CONFIG_DIR": paths.get_config_dir,
    "ADAPTIVE_LEARNER_CACHE_DIR": paths.get_cache_dir,
}


def _declared_resolvers() -> set[str]:
    return set(RESOLVER_ENV_RE.findall(PATHS_MODULE.read_text(encoding="utf-8")))


def _is_temporary(path: Path) -> bool:
    resolved = path.resolve()
    temp_root = Path(tempfile.gettempdir()).resolve()
    return resolved.is_relative_to(temp_root) or resolved.parts[1:2] == ("tmp",)


def test_paths_module_declares_the_expected_resolver_set() -> None:
    """An empty scan must not read as clean."""
    resolvers = _declared_resolvers()
    assert resolvers >= set(RESOLVER_FUNCTIONS), (
        f"resolver scan found {sorted(resolvers)} - expected at least "
        f"{sorted(RESOLVER_FUNCTIONS)}; the regex or paths.py changed"
    )


def test_every_path_resolver_is_pinned_in_conftest() -> None:
    conftest = CONFTEST.read_text(encoding="utf-8")
    unpinned = sorted(
        env
        for env in _declared_resolvers()
        if not re.search(rf'os\.environ\["{env}"\]\s*=', conftest)
    )
    assert not unpinned, (
        f"{unpinned} not pinned in backend/tests/conftest.py - pytest would resolve them "
        "against the developer's real machine (#3145). Pin each to tempfile.mkdtemp() next "
        "to the ADAPTIVE_LEARNER_DATA_DIR block."
    )


def test_every_known_resolver_has_a_function_mapping() -> None:
    """A new resolver must be added to RESOLVER_FUNCTIONS so the runtime check covers it."""
    missing = sorted(_declared_resolvers() - set(RESOLVER_FUNCTIONS))
    assert not missing, f"add {missing} to RESOLVER_FUNCTIONS in this test"


def test_every_path_resolver_resolves_inside_tmp_during_pytest() -> None:
    outside = {
        env: str(resolver())
        for env, resolver in RESOLVER_FUNCTIONS.items()
        if not _is_temporary(resolver())
    }
    assert not outside, (
        f"resolved outside a temporary location during pytest: {outside} - a test "
        "cleanup would touch real user data (#3145)"
    )


def test_content_loader_cache_is_not_the_real_user_cache() -> None:
    """The autouse fixture deletes this folder around every test."""
    cache = paths.get_cache_dir() / "content-loader"
    real_home = Path.home().resolve()
    assert not cache.resolve().is_relative_to(real_home / ".cache"), (
        f"content-loader cache {cache} is inside the real ~/.cache; the autouse "
        "_isolate_content_cache fixture would delete the developer's cached sets"
    )
