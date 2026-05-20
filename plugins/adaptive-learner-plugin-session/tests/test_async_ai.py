"""Tests for the v1.5.0 / Phase 18B async AI wrappers.

Verifies:
  - ``call_ai_complete_async`` falls back to the sync hook (via
    ``asyncio.to_thread``) when no ``ai_complete_async`` is
    registered.
  - ``call_ai_complete_async`` prefers the async hook when it IS
    available and returns a coroutine.
  - ``evaluate_step_async`` + ``evaluate_topic_transition_async``
    exercise the same fallback path end-to-end.
  - ``asyncio.gather`` over the two evaluators delivers real
    parallel overlap (slow mock sleeps 0.1s each; total wall-time
    is closer to 0.1s than 0.2s).
"""

from __future__ import annotations

import asyncio
import json
import time
from types import SimpleNamespace

import pytest

from adaptive_learner_session.ai_orchestration import call_ai_complete_async
from adaptive_learner_session.step_evaluator import evaluate_step_async
from adaptive_learner_session.topic_transition import (
    evaluate_topic_transition_async,
)


def _step_eval_json() -> str:
    return json.dumps(
        {
            "advance": True,
            "confidence": 0.9,
            "reason": "Looks ready.",
            "suggested_step": 7,
        }
    )


def _transition_json() -> str:
    return json.dumps(
        {
            "cycle_complete": True,
            "summary": "Done.",
            "next_topic": "Next thing",
            "next_topic_rationale": "Logical",
            "difficulty_adjustment": "same",
            "continue_recommended": True,
        }
    )


def _sync_pm(reply: str, *, sleep_s: float = 0.0):
    """Fake pm with sync ai_complete that optionally sleeps."""

    def _ai_complete(messages, model, api_key, max_tokens=None):  # noqa: ARG001
        if sleep_s:
            time.sleep(sleep_s)
        return reply

    return SimpleNamespace(hook=SimpleNamespace(ai_complete=_ai_complete))


def _async_pm(reply: str):
    """Fake pm where ai_complete_async returns a coroutine directly."""

    async def _ai_complete_async(messages, model, api_key, max_tokens=None):  # noqa: ARG001
        return reply

    def _ai_complete(*args, **kwargs):  # noqa: ARG001
        raise AssertionError("sync should not be called when async is available")

    return SimpleNamespace(
        hook=SimpleNamespace(
            ai_complete=_ai_complete,
            ai_complete_async=_ai_complete_async,
        )
    )


@pytest.mark.asyncio
async def test_call_async_falls_back_to_sync_in_thread():
    pm = _sync_pm("hello")
    result = await call_ai_complete_async(
        pm=pm, messages=[], model="m", api_key="k"
    )
    assert result == "hello"


@pytest.mark.asyncio
async def test_call_async_prefers_async_hook_when_available():
    pm = _async_pm("hello async")
    result = await call_ai_complete_async(
        pm=pm, messages=[], model="m", api_key="k"
    )
    assert result == "hello async"


@pytest.mark.asyncio
async def test_evaluate_step_async_returns_dataclass():
    pm = _sync_pm(_step_eval_json())
    evaluation = await evaluate_step_async(
        pm=pm,
        method="deductive",
        current_step=6,
        history=[],
        model="m",
        api_key="k",
    )
    assert evaluation.fallback_used is False
    assert evaluation.advance is True
    assert evaluation.suggested_step == 7


@pytest.mark.asyncio
async def test_evaluate_topic_transition_async_returns_dataclass():
    pm = _sync_pm(_transition_json())
    transition = await evaluate_topic_transition_async(
        pm=pm,
        goal="g",
        topic="t",
        method="deductive",
        history=[],
        model="m",
        api_key="k",
    )
    assert transition.fallback_used is False
    assert transition.cycle_complete is True


@pytest.mark.asyncio
async def test_gather_runs_evaluators_in_parallel():
    """Both evaluators sleep 0.1s each in their sync mock; gather
    should overlap them so the total wall-time is closer to 0.1s
    than to 0.2s. We pin a generous upper bound (0.18s) to absorb
    CI jitter."""
    pm_eval = _sync_pm(_step_eval_json(), sleep_s=0.1)
    pm_trans = _sync_pm(_transition_json(), sleep_s=0.1)
    start = time.monotonic()
    eval_task = evaluate_step_async(
        pm=pm_eval,
        method="deductive",
        current_step=6,
        history=[],
        model="m",
        api_key="k",
    )
    trans_task = evaluate_topic_transition_async(
        pm=pm_trans,
        goal="g",
        topic="t",
        method="deductive",
        history=[],
        model="m",
        api_key="k",
    )
    evaluation, transition = await asyncio.gather(eval_task, trans_task)
    elapsed = time.monotonic() - start
    assert evaluation.advance is True
    assert transition.cycle_complete is True
    # Sequential would be ~0.2s; parallel ~0.1s. The bound below
    # leaves room for CI noise without making the test flaky.
    assert elapsed < 0.18, f"Expected parallel overlap; took {elapsed:.3f}s"
