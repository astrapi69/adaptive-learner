"""The loader reads a set entry the way the engine projects it (#3711).

Browser mode projects every entry through the engine's
``asContentSetEntry``; this loader used to reject the whole manifest where
the engine falls back, so one repo listed different sets per mode. Here:
the whole manifest survives an entry the engine would project, the
fallback values match the engine's, and each fallback is logged.
"""

from __future__ import annotations

import logging

import pytest

from adaptive_learner_content_loader.manifest_parser import parse_manifest_yaml

MANIFEST = """
schema_version: "1.9"
name: Test repo
sets:
  - id: good
    title: Good
    target_language: fr
    level: A1
    version: "1.0.0"
    lesson_count: 1
  - id: odd
    title: Odd
    level: A1
    version: "1.0.0"
    lesson_count: 1
{extra}
"""


@pytest.mark.parametrize(
    ("extra", "field", "projected", "logged"),
    [
        ("", "target_language", "", "no target_language"),
        ("    target_language: fr\n    visibility: secret", "visibility", "visible", "visibility"),
        (
            "    target_language: fr\n    review_status: approved",
            "review_status",
            None,
            "review_status",
        ),
    ],
    ids=["no-target-language", "unknown-visibility", "unknown-review-status"],
)
def test_one_odd_entry_keeps_the_whole_manifest(
    extra: str, field: str, projected: object, logged: str, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING):
        manifest = parse_manifest_yaml(MANIFEST.format(extra=extra))
    assert [entry.id for entry in manifest.sets] == ["good", "odd"]
    value = getattr(manifest.sets[1], field)
    assert (value.value if hasattr(value, "value") else value) == projected
    assert any(
        logged in record.getMessage() and "'odd'" in record.getMessage()
        for record in caplog.records
    )


def test_known_values_pass_untouched_and_unlogged(caplog: pytest.LogCaptureFixture) -> None:
    extra = "    target_language: de\n    visibility: hidden\n    review_status: generated"
    with caplog.at_level(logging.WARNING):
        manifest = parse_manifest_yaml(MANIFEST.format(extra=extra))
    odd = manifest.sets[1]
    assert (odd.target_language, odd.visibility.value, odd.review_status.value) == (
        "de",
        "hidden",
        "generated",
    )
    assert not caplog.records
