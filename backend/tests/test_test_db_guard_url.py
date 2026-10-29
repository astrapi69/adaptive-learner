"""The test-isolation guard reads the URL's parts, not its text (#3550).

SQLAlchemy 2.1 renders ``:memory:`` percent-encoded in ``str(engine.url)``
(``sqlite:///%3Amemory%3A``); the old text match rejected the in-memory
test DB and stopped the whole suite before its first test.
"""

from __future__ import annotations

import pytest
from sqlalchemy.engine import make_url

from tests.conftest import looks_like_test_database


@pytest.mark.parametrize(
    ("url", "is_test"),
    [
        ("sqlite:///:memory:", True),
        ("sqlite:////tmp/pytest-of-u/run/test.db", True),
        ("sqlite:///some/dir/test.db", True),
        ("sqlite:////home/u/.local/share/adaptive_learner/adaptive_learner.db", False),
        ("sqlite:///relative/app.db", False),
    ],
    ids=["memory", "tmp-path", "test-db-suffix", "production", "other-file"],
)
def test_guard_classifies_the_parsed_database(url: str, is_test: bool) -> None:
    assert looks_like_test_database(make_url(url).database or "") is is_test


def test_guard_accepts_memory_whatever_the_text_rendering() -> None:
    """The guard input is ``url.database``; a percent-encoded rendering of
    the same URL (the 2.1 form) must not change the verdict."""
    url = make_url("sqlite:///:memory:")
    encoded_rendering = str(url).replace(":memory:", "%3Amemory%3A")
    assert ":memory:" not in encoded_rendering
    assert looks_like_test_database(url.database or "")
