"""Tests for the semver-aware version comparator
(Phase 43 / EXP-002 / 2C-cache).
"""

from __future__ import annotations

import pytest

from adaptive_learner_content_loader.version import (
    compare_versions,
    needs_update,
)


class TestCompareVersions:
    def test_equal_versions(self) -> None:
        assert compare_versions("1.0.0", "1.0.0") == 0
        assert compare_versions("1.0", "1.0.0") == 0  # zero-padded
        assert compare_versions("2.5", "2.5") == 0

    def test_strictly_newer_patch(self) -> None:
        assert compare_versions("1.0.1", "1.0.0") == 1
        assert compare_versions("1.0.0", "1.0.1") == -1

    def test_strictly_newer_minor(self) -> None:
        assert compare_versions("1.1.0", "1.0.99") == 1

    def test_strictly_newer_major(self) -> None:
        assert compare_versions("2.0.0", "1.99.99") == 1

    def test_pre_release_lower_than_release(self) -> None:
        # 1.0.0-rc1 < 1.0.0 < 2.0.0-alpha
        assert compare_versions("1.0.0-rc1", "1.0.0") == -1
        assert compare_versions("1.0.0", "1.0.0-rc1") == 1
        assert compare_versions("2.0.0-alpha", "1.0.0") == 1

    def test_pre_release_ordering(self) -> None:
        # Numeric < alpha, then numeric ordering, then dotted shorter < longer.
        assert compare_versions("1.0.0-1", "1.0.0-2") == -1
        assert compare_versions("1.0.0-1", "1.0.0-alpha") == -1
        assert compare_versions("1.0.0-alpha", "1.0.0-beta") == -1
        assert compare_versions("1.0.0-alpha", "1.0.0-alpha.1") == -1

    def test_build_metadata_ignored(self) -> None:
        assert compare_versions("1.0.0+meta", "1.0.0") == 0
        assert compare_versions("1.0.0+a", "1.0.0+b") == 0

    def test_invalid_version_raises(self) -> None:
        with pytest.raises(ValueError):
            compare_versions("latest", "1.0.0")
        with pytest.raises(ValueError):
            compare_versions("1.0.0", "v1.0.0")


class TestNeedsUpdate:
    def test_strictly_newer_upstream_means_update(self) -> None:
        assert needs_update("1.0.0", "1.0.1") is True
        assert needs_update("1.0.0", "2.0.0") is True

    def test_equal_means_no_update(self) -> None:
        assert needs_update("1.0.0", "1.0.0") is False

    def test_future_cache_means_no_update(self) -> None:
        # Don't downgrade a cache the user got from a newer
        # source than the current upstream.
        assert needs_update("2.0.0", "1.0.0") is False

    def test_release_overrides_pre_release(self) -> None:
        assert needs_update("1.0.0-rc1", "1.0.0") is True
        assert needs_update("1.0.0", "1.0.0-rc1") is False
