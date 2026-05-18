"""Tests for the session-to-ProgressCommit translator."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from adaptive_learner_tracking import RATING_SCALE
from adaptive_learner_tracking.commits import (
    _duration_minutes,
    _normalise_rating,
    _parse_iso,
    build_commit_kwargs,
)


def _session(
    started: str | None = "2026-01-01T12:00:00+00:00",
    ended: str | None = "2026-01-01T12:30:00+00:00",
    method: str = "deductive",
    **overrides,
) -> dict:
    base = {
        "id": "sess-1",
        "project_id": "proj-1",
        "method": method,
        "started_at": started,
        "ended_at": ended,
    }
    base.update(overrides)
    return base


def _rating(understanding: int = 4, stress: int = 2) -> dict:
    return {"understanding": understanding, "stress": stress}


# --- Happy path -----------------------------------------------------------


def test_build_commit_kwargs_returns_all_expected_keys():
    out = build_commit_kwargs(_session(), _rating())
    assert set(out.keys()) == {
        "project_id",
        "session_id",
        "method",
        "understanding",
        "stress",
        "error_rate",
        "duration_minutes",
    }


def test_build_passes_through_ids_and_method():
    out = build_commit_kwargs(_session(method="dialogic"), _rating())
    assert out["project_id"] == "proj-1"
    assert out["session_id"] == "sess-1"
    assert out["method"] == "dialogic"


def test_understanding_rescales_to_unit_interval():
    out = build_commit_kwargs(_session(), _rating(understanding=4, stress=2))
    assert out["understanding"] == pytest.approx(4 / RATING_SCALE)
    assert out["stress"] == pytest.approx(2 / RATING_SCALE)


def test_error_rate_defaults_to_zero():
    out = build_commit_kwargs(_session(), _rating())
    assert out["error_rate"] == 0.0


def test_duration_minutes_computed_from_iso_strings():
    out = build_commit_kwargs(
        _session(
            started="2026-01-01T12:00:00+00:00",
            ended="2026-01-01T12:45:30+00:00",
        ),
        _rating(),
    )
    assert out["duration_minutes"] == 45


def test_duration_zero_when_endpoints_equal():
    out = build_commit_kwargs(
        _session(
            started="2026-01-01T12:00:00+00:00",
            ended="2026-01-01T12:00:30+00:00",
        ),
        _rating(),
    )
    assert out["duration_minutes"] == 0


def test_duration_zero_on_missing_timestamps():
    out = build_commit_kwargs(
        _session(started=None, ended=None),
        _rating(),
    )
    assert out["duration_minutes"] == 0


# --- Incomplete payload returns None --------------------------------------


@pytest.mark.parametrize(
    "missing",
    [
        {"id": None},
        {"id": ""},
        {"project_id": None},
        {"project_id": ""},
        {"method": None},
        {"method": ""},
    ],
)
def test_returns_none_on_required_field_missing(missing):
    out = build_commit_kwargs(_session(**missing), _rating())
    assert out is None


# --- Robust rating handling -----------------------------------------------


@pytest.mark.parametrize("bad", [None, "not a number", [], {}])
def test_non_numeric_rating_normalises_to_zero(bad):
    out = build_commit_kwargs(_session(), {"understanding": bad, "stress": bad})
    assert out["understanding"] == 0.0
    assert out["stress"] == 0.0


@pytest.mark.parametrize("excess", [6, 100, -1])
def test_out_of_range_rating_clamped_to_unit_interval(excess: int):
    out = build_commit_kwargs(_session(), {"understanding": excess, "stress": excess})
    assert 0.0 <= out["understanding"] <= 1.0
    assert 0.0 <= out["stress"] <= 1.0


# --- ISO parse ------------------------------------------------------------


def test_parse_iso_accepts_datetime_passthrough():
    now = datetime.now(UTC)
    assert _parse_iso(now) is now


def test_parse_iso_returns_none_on_garbage():
    assert _parse_iso("not a date") is None
    assert _parse_iso("") is None
    assert _parse_iso(None) is None


def test_parse_iso_returns_none_on_non_string():
    assert _parse_iso(12345) is None


# --- Normalise rating -----------------------------------------------------


def test_normalise_rating_boundaries():
    assert _normalise_rating(0) == 0.0
    assert _normalise_rating(5) == 1.0
    assert _normalise_rating(2.5) == 0.5


# --- _duration_minutes directly -------------------------------------------


def test_duration_handles_datetime_objects_directly():
    start = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    end = start + timedelta(minutes=15, seconds=30)
    assert _duration_minutes(start, end) == 15
