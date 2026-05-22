"""Tests for the Anthropic SDK wrapper. NO real API calls.

Every test patches ``adaptive_learner_ai_anthropic.client.anthropic``
so no network egress happens under any circumstance. The fixture
asserts on the SDK call arguments to pin the messages-transform
contract.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from adaptive_learner_ai_anthropic.client import (
    DEFAULT_MAX_TOKENS,
    _split_system_and_chat,
    complete,
)


def _fake_response(text: str = "fine response") -> SimpleNamespace:
    """Build the shape ``anthropic.types.Message`` exposes for the
    fields the wrapper reads: ``.content`` is a list of objects with
    a ``.text`` attribute."""
    return SimpleNamespace(content=[SimpleNamespace(text=text)])


@pytest.fixture()
def anthropic_mock():
    """Patch the SDK at the plugin's import point. Yields the mocked
    ``anthropic`` module so tests can assert on call args."""
    with patch("adaptive_learner_ai_anthropic.client.anthropic", create=True) as m:
        client_instance = MagicMock()
        client_instance.messages.create.return_value = _fake_response()
        m.Anthropic.return_value = client_instance
        yield m


# --- _split_system_and_chat ------------------------------------------------


def test_split_collects_system_messages_into_single_string():
    sys, chat = _split_system_and_chat(
        [
            {"role": "system", "content": "Be concise."},
            {"role": "system", "content": "Use Markdown."},
            {"role": "user", "content": "Hi"},
        ]
    )
    assert sys == "Be concise.\n\nUse Markdown."
    assert chat == [{"role": "user", "content": "Hi"}]


def test_split_returns_none_system_when_no_system_messages():
    sys, _ = _split_system_and_chat([{"role": "user", "content": "Hi"}])
    assert sys is None


def test_split_preserves_user_assistant_order():
    _, chat = _split_system_and_chat(
        [
            {"role": "user", "content": "first"},
            {"role": "assistant", "content": "reply"},
            {"role": "user", "content": "follow-up"},
        ]
    )
    assert [m["content"] for m in chat] == ["first", "reply", "follow-up"]


def test_split_drops_messages_with_unknown_role():
    _, chat = _split_system_and_chat(
        [
            {"role": "tool", "content": "ignored"},
            {"role": "user", "content": "kept"},
        ]
    )
    assert chat == [{"role": "user", "content": "kept"}]


def test_split_drops_messages_with_non_string_content():
    _, chat = _split_system_and_chat(
        [
            {"role": "user", "content": None},
            {"role": "user", "content": 12345},
            {"role": "user", "content": "ok"},
        ]
    )
    assert chat == [{"role": "user", "content": "ok"}]


def test_split_drops_empty_system_messages():
    sys, _ = _split_system_and_chat(
        [
            {"role": "system", "content": ""},
            {"role": "user", "content": "x"},
        ]
    )
    assert sys is None


# --- complete (happy path) -------------------------------------------------


def test_complete_returns_assistant_text(anthropic_mock):
    out = complete(
        [{"role": "user", "content": "ping"}],
        model="claude-sonnet-4-6",
        api_key="sk-test-1234",
    )
    assert out == "fine response"


def test_complete_instantiates_client_with_api_key(anthropic_mock):
    complete(
        [{"role": "user", "content": "ping"}],
        model="claude-sonnet-4-6",
        api_key="sk-test-XYZ",
    )
    anthropic_mock.Anthropic.assert_called_once_with(api_key="sk-test-XYZ")


def test_complete_passes_model_and_default_max_tokens(anthropic_mock):
    complete(
        [{"role": "user", "content": "x"}],
        model="claude-haiku-4-5",
        api_key="k",
    )
    call_kwargs = anthropic_mock.Anthropic.return_value.messages.create.call_args.kwargs
    assert call_kwargs["model"] == "claude-haiku-4-5"
    assert call_kwargs["max_tokens"] == DEFAULT_MAX_TOKENS


def test_complete_routes_system_messages_to_top_level_kwarg(anthropic_mock):
    complete(
        [
            {"role": "system", "content": "Always answer in German."},
            {"role": "user", "content": "What is 2+2?"},
        ],
        model="claude-sonnet-4-6",
        api_key="k",
    )
    call_kwargs = anthropic_mock.Anthropic.return_value.messages.create.call_args.kwargs
    assert call_kwargs["system"] == "Always answer in German."
    assert call_kwargs["messages"] == [{"role": "user", "content": "What is 2+2?"}]


def test_complete_omits_system_kwarg_when_no_system_messages(anthropic_mock):
    """Phase 36 Bug 5 regression: when there's no system message,
    the SDK call MUST omit ``system`` entirely. Passing
    ``system=None`` becomes JSON ``null`` on the wire which the
    Anthropic API rejects with HTTP 400 ("system: Input should be
    a valid array"). Reproduces the Anki-extract failure flagged
    by the Phase 36 manual test."""
    complete(
        [{"role": "user", "content": "Extract Anki cards from: foo bar"}],
        model="claude-haiku-4-5-20251001",
        api_key="k",
    )
    call_kwargs = anthropic_mock.Anthropic.return_value.messages.create.call_args.kwargs
    # The kwarg MUST be absent entirely (not present-with-None).
    assert "system" not in call_kwargs, (
        "system=None on the wire is what broke the Anki extraction in "
        "Phase 36; the SDK call must omit the kwarg when there's no "
        "system message."
    )


def test_complete_concatenates_multiple_content_blocks(anthropic_mock):
    anthropic_mock.Anthropic.return_value.messages.create.return_value = SimpleNamespace(
        content=[
            SimpleNamespace(text="part one "),
            SimpleNamespace(text="part two"),
        ]
    )
    out = complete(
        [{"role": "user", "content": "x"}],
        model="claude-sonnet-4-6",
        api_key="k",
    )
    assert out == "part one part two"


def test_complete_handles_empty_content_blocks_gracefully(anthropic_mock):
    anthropic_mock.Anthropic.return_value.messages.create.return_value = SimpleNamespace(content=[])
    out = complete(
        [{"role": "user", "content": "x"}],
        model="claude-sonnet-4-6",
        api_key="k",
    )
    assert out == ""


def test_complete_respects_custom_max_tokens(anthropic_mock):
    complete(
        [{"role": "user", "content": "x"}],
        model="claude-sonnet-4-6",
        api_key="k",
        max_tokens=512,
    )
    call_kwargs = anthropic_mock.Anthropic.return_value.messages.create.call_args.kwargs
    assert call_kwargs["max_tokens"] == 512


# --- stream (v1.6.0 / Phase 19) --------------------------------------------


class _FakeAsyncTextStream:
    """Async iterator yielding pre-baked deltas; simulates the
    ``stream_handle.text_stream`` from the Anthropic SDK."""

    def __init__(self, deltas: list[str]):
        self._deltas = list(deltas)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._deltas:
            raise StopAsyncIteration
        return self._deltas.pop(0)


class _FakeStreamHandle:
    """Async-context-manager mock of
    ``AsyncAnthropic.messages.stream(...)``. Exposes the
    ``text_stream`` attribute the wrapper consumes."""

    def __init__(self, deltas: list[str]):
        self.text_stream = _FakeAsyncTextStream(deltas)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None


@pytest.mark.asyncio
async def test_stream_yields_each_text_delta_in_order():
    from adaptive_learner_ai_anthropic.client import stream

    deltas = ["Hello", ", ", "world!"]
    with patch("adaptive_learner_ai_anthropic.client.anthropic", create=True) as m:
        async_client = MagicMock()
        async_client.messages.stream.return_value = _FakeStreamHandle(deltas)
        m.AsyncAnthropic.return_value = async_client
        chunks = [
            c
            async for c in stream(
                [{"role": "user", "content": "hi"}],
                model="claude-haiku-4-5-20251001",
                api_key="k",
                max_tokens=128,
            )
        ]
    assert chunks == deltas
    # Verify the SDK got the model + max_tokens we passed.
    call_kwargs = async_client.messages.stream.call_args.kwargs
    assert call_kwargs["model"] == "claude-haiku-4-5-20251001"
    assert call_kwargs["max_tokens"] == 128


@pytest.mark.asyncio
async def test_stream_skips_empty_and_non_string_deltas():
    """Anthropic's text_stream occasionally yields empty strings on
    keepalives. The wrapper drops them so consumers don't render
    empty bubbles."""
    from adaptive_learner_ai_anthropic.client import stream

    with patch("adaptive_learner_ai_anthropic.client.anthropic", create=True) as m:
        async_client = MagicMock()
        async_client.messages.stream.return_value = _FakeStreamHandle(["valid", "", "more valid"])
        m.AsyncAnthropic.return_value = async_client
        chunks = [
            c
            async for c in stream(
                [{"role": "user", "content": "x"}],
                model="claude-haiku-4-5-20251001",
                api_key="k",
            )
        ]
    assert chunks == ["valid", "more valid"]


@pytest.mark.asyncio
async def test_stream_passes_split_system_prompt():
    """The split-system-and-chat transform applies to streaming too."""
    from adaptive_learner_ai_anthropic.client import stream

    with patch("adaptive_learner_ai_anthropic.client.anthropic", create=True) as m:
        async_client = MagicMock()
        async_client.messages.stream.return_value = _FakeStreamHandle(["ok"])
        m.AsyncAnthropic.return_value = async_client
        _ = [
            c
            async for c in stream(
                [
                    {"role": "system", "content": "Be concise."},
                    {"role": "user", "content": "x"},
                ],
                model="claude-haiku-4-5-20251001",
                api_key="k",
            )
        ]
    call_kwargs = async_client.messages.stream.call_args.kwargs
    assert call_kwargs["system"] == "Be concise."
    assert call_kwargs["messages"] == [{"role": "user", "content": "x"}]
