"""Tests for the v1.6.0 / Phase 19 streaming orchestrator.

Verifies:
  - ``call_ai_complete_stream`` returns the async iterator yielded
    by the matching plugin hookimpl.
  - When the hookspec is registered but no plugin implements it,
    the wrapper returns ``None`` so the caller can fall back to
    ``ai_complete_async``.
  - The wrapper handles BOTH ``async def`` hookimpls (returning a
    coroutine that resolves to an iterator) and plain ``def``
    hookimpls (returning an async generator directly).
  - Provider exceptions during the dispatch collapse to ``None``
    rather than propagating (the route's fallback path takes over).
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import AsyncIterator

import pytest

from adaptive_learner_session.ai_orchestration import call_ai_complete_stream


async def _yield_chunks(chunks: list[str]) -> AsyncIterator[str]:
    """Helper: async generator yielding the given chunks one at a time."""
    for c in chunks:
        yield c


def _pm_with_async_def_stream(chunks: list[str]):
    """A pm whose ai_complete_stream is an ``async def`` hookimpl —
    calling it returns a coroutine that must be awaited to obtain
    the async iterator."""

    async def _ai_complete_stream(messages, model, api_key, max_tokens=None):  # noqa: ARG001
        return _yield_chunks(chunks)

    return SimpleNamespace(hook=SimpleNamespace(ai_complete_stream=_ai_complete_stream))


def _pm_with_plain_def_stream(chunks: list[str]):
    """A pm whose ai_complete_stream is a plain ``def`` returning an
    async generator directly (no coroutine wrapper)."""

    def _ai_complete_stream(messages, model, api_key, max_tokens=None):  # noqa: ARG001
        return _yield_chunks(chunks)

    return SimpleNamespace(hook=SimpleNamespace(ai_complete_stream=_ai_complete_stream))


def _pm_without_stream():
    """A pm that has the stream hook attribute but every plugin
    returned None (pluggy returns None on firstresult when no
    plugin claims it)."""

    def _ai_complete_stream(messages, model, api_key, max_tokens=None):  # noqa: ARG001
        return None

    return SimpleNamespace(hook=SimpleNamespace(ai_complete_stream=_ai_complete_stream))


def _pm_no_stream_hook_at_all():
    """A pm with no ai_complete_stream attribute (old pluginforge
    builds without the hookspec registered)."""

    return SimpleNamespace(hook=SimpleNamespace())


def _pm_with_throwing_stream():
    def _ai_complete_stream(messages, model, api_key, max_tokens=None):  # noqa: ARG001
        raise RuntimeError("provider melted down")

    return SimpleNamespace(hook=SimpleNamespace(ai_complete_stream=_ai_complete_stream))


@pytest.mark.asyncio
async def test_call_stream_with_async_def_hookimpl_returns_iterator():
    pm = _pm_with_async_def_stream(["Hello", ", ", "world!"])
    iterator = await call_ai_complete_stream(pm=pm, messages=[], model="m", api_key="k")
    assert iterator is not None
    chunks = [c async for c in iterator]
    assert chunks == ["Hello", ", ", "world!"]


@pytest.mark.asyncio
async def test_call_stream_with_plain_def_hookimpl_returns_iterator():
    pm = _pm_with_plain_def_stream(["a", "b"])
    iterator = await call_ai_complete_stream(pm=pm, messages=[], model="m", api_key="k")
    assert iterator is not None
    chunks = [c async for c in iterator]
    assert chunks == ["a", "b"]


@pytest.mark.asyncio
async def test_call_stream_returns_none_when_no_plugin_implements():
    pm = _pm_without_stream()
    result = await call_ai_complete_stream(pm=pm, messages=[], model="m", api_key="k")
    assert result is None


@pytest.mark.asyncio
async def test_call_stream_returns_none_when_no_hook_attribute():
    pm = _pm_no_stream_hook_at_all()
    result = await call_ai_complete_stream(pm=pm, messages=[], model="m", api_key="k")
    assert result is None


@pytest.mark.asyncio
async def test_call_stream_returns_none_on_plugin_exception():
    """A provider exception during dispatch must NOT propagate;
    the caller (SSE route) falls back to call_ai_complete_async."""
    pm = _pm_with_throwing_stream()
    result = await call_ai_complete_stream(pm=pm, messages=[], model="m", api_key="k")
    assert result is None
