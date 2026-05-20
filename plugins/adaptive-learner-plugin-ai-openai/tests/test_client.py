"""Tests for the OpenAI SDK wrapper. NO real API calls.

Every test patches ``adaptive_learner_ai_openai.client.openai`` so
no network egress happens under any circumstance. The fixture
asserts on the SDK call arguments to pin the message-passing
contract.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from adaptive_learner_ai_openai.client import (
    DEFAULT_MAX_TOKENS,
    _filter_messages,
    complete,
)


def _fake_response(text: str = "fine response") -> SimpleNamespace:
    """Build the shape ``openai.types.chat.ChatCompletion`` exposes
    for the fields the wrapper reads: ``.choices`` is a list whose
    first element has ``.message.content``."""
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


@pytest.fixture()
def openai_mock():
    """Patch the SDK at the plugin's import point. Yields the mocked
    ``openai`` module so tests can assert on call args."""
    with patch("adaptive_learner_ai_openai.client.openai", create=True) as m:
        client_instance = MagicMock()
        client_instance.chat.completions.create.return_value = _fake_response()
        m.OpenAI.return_value = client_instance
        yield m


# --- _filter_messages ------------------------------------------------------


def test_filter_keeps_system_user_assistant_in_order():
    out = _filter_messages(
        [
            {"role": "system", "content": "Be concise."},
            {"role": "user", "content": "Hi"},
            {"role": "assistant", "content": "Hello."},
        ]
    )
    assert [m["role"] for m in out] == ["system", "user", "assistant"]
    assert [m["content"] for m in out] == ["Be concise.", "Hi", "Hello."]


def test_filter_drops_unknown_roles():
    out = _filter_messages(
        [
            {"role": "tool", "content": "ignored"},
            {"role": "function", "content": "ignored too"},
            {"role": "user", "content": "kept"},
        ]
    )
    assert out == [{"role": "user", "content": "kept"}]


def test_filter_drops_non_string_or_empty_content():
    out = _filter_messages(
        [
            {"role": "user", "content": None},
            {"role": "user", "content": 12345},
            {"role": "user", "content": ""},
            {"role": "user", "content": "ok"},
        ]
    )
    assert out == [{"role": "user", "content": "ok"}]


# --- complete (happy path) -------------------------------------------------


def test_complete_returns_assistant_text(openai_mock):
    out = complete(
        [{"role": "user", "content": "ping"}],
        model="gpt-4o",
        api_key="sk-test-1234",
    )
    assert out == "fine response"


def test_complete_instantiates_client_with_api_key(openai_mock):
    complete(
        [{"role": "user", "content": "ping"}],
        model="gpt-4o",
        api_key="sk-test-XYZ",
    )
    openai_mock.OpenAI.assert_called_once_with(api_key="sk-test-XYZ")


def test_complete_passes_model_and_default_max_tokens(openai_mock):
    complete(
        [{"role": "user", "content": "x"}],
        model="gpt-4o-mini",
        api_key="k",
    )
    call_kwargs = openai_mock.OpenAI.return_value.chat.completions.create.call_args.kwargs
    assert call_kwargs["model"] == "gpt-4o-mini"
    assert call_kwargs["max_tokens"] == DEFAULT_MAX_TOKENS


def test_complete_passes_filtered_messages_inline(openai_mock):
    """OpenAI keeps role=system inline (unlike Anthropic); the
    wrapper passes filtered messages verbatim."""
    complete(
        [
            {"role": "system", "content": "Always answer in German."},
            {"role": "user", "content": "What is 2+2?"},
            {"role": "tool", "content": "should be dropped"},
        ],
        model="gpt-4o",
        api_key="k",
    )
    call_kwargs = openai_mock.OpenAI.return_value.chat.completions.create.call_args.kwargs
    assert call_kwargs["messages"] == [
        {"role": "system", "content": "Always answer in German."},
        {"role": "user", "content": "What is 2+2?"},
    ]


def test_complete_returns_empty_string_on_no_choices(openai_mock):
    openai_mock.OpenAI.return_value.chat.completions.create.return_value = SimpleNamespace(
        choices=[]
    )
    out = complete(
        [{"role": "user", "content": "x"}],
        model="gpt-4o",
        api_key="k",
    )
    assert out == ""


def test_complete_returns_empty_string_on_missing_content(openai_mock):
    """Edge case: finish_reason='content_filter' can produce a
    choice without content. Wrapper returns the empty string
    rather than raising on None."""
    openai_mock.OpenAI.return_value.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=None))]
    )
    out = complete(
        [{"role": "user", "content": "x"}],
        model="gpt-4o",
        api_key="k",
    )
    assert out == ""


def test_complete_respects_custom_max_tokens(openai_mock):
    complete(
        [{"role": "user", "content": "x"}],
        model="gpt-4o",
        api_key="k",
        max_tokens=512,
    )
    call_kwargs = openai_mock.OpenAI.return_value.chat.completions.create.call_args.kwargs
    assert call_kwargs["max_tokens"] == 512


# --- stream (v1.6.0 / Phase 19) --------------------------------------------


def _fake_chunk(content):
    """Mock ``ChatCompletionChunk`` with the field the wrapper reads."""
    return SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=content))])


class _FakeAsyncStream:
    """Async iterator yielding pre-baked ``ChatCompletionChunk``
    objects; simulates the response of
    ``AsyncOpenAI.chat.completions.create(stream=True)``."""

    def __init__(self, chunks: list):
        self._chunks = list(chunks)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._chunks:
            raise StopAsyncIteration
        return self._chunks.pop(0)


@pytest.mark.asyncio
async def test_stream_yields_each_delta_content_in_order():
    from adaptive_learner_ai_openai.client import stream

    chunks = [_fake_chunk("Hello"), _fake_chunk(", "), _fake_chunk("world!")]
    with patch("adaptive_learner_ai_openai.client.openai", create=True) as m:
        async_client = MagicMock()

        async def fake_create(**kwargs):  # noqa: ARG001
            return _FakeAsyncStream(chunks)

        async_client.chat.completions.create.side_effect = fake_create
        m.AsyncOpenAI.return_value = async_client
        out = [
            c
            async for c in stream(
                [{"role": "user", "content": "hi"}],
                model="gpt-4o",
                api_key="k",
                max_tokens=128,
            )
        ]
    assert out == ["Hello", ", ", "world!"]
    # The SDK was invoked with stream=True + the messages we filtered.
    call_kwargs = async_client.chat.completions.create.call_args.kwargs
    assert call_kwargs["stream"] is True
    assert call_kwargs["model"] == "gpt-4o"
    assert call_kwargs["max_tokens"] == 128


@pytest.mark.asyncio
async def test_stream_drops_role_and_finish_markers_with_none_content():
    """The first chunk in an OpenAI stream usually carries
    ``delta.role`` with ``content=None``; the wrapper drops it."""
    from adaptive_learner_ai_openai.client import stream

    chunks = [
        _fake_chunk(None),  # role marker
        _fake_chunk("real"),
        _fake_chunk(""),  # empty
        _fake_chunk("text"),
        _fake_chunk(None),  # finish marker
    ]
    with patch("adaptive_learner_ai_openai.client.openai", create=True) as m:
        async_client = MagicMock()

        async def fake_create(**kwargs):  # noqa: ARG001
            return _FakeAsyncStream(chunks)

        async_client.chat.completions.create.side_effect = fake_create
        m.AsyncOpenAI.return_value = async_client
        out = [
            c
            async for c in stream(
                [{"role": "user", "content": "x"}],
                model="gpt-4o",
                api_key="k",
            )
        ]
    assert out == ["real", "text"]


@pytest.mark.asyncio
async def test_stream_skips_chunks_with_no_choices():
    """OpenAI emits keepalive chunks with an empty choices list; the
    wrapper skips them."""
    from adaptive_learner_ai_openai.client import stream

    chunks = [
        SimpleNamespace(choices=[]),
        _fake_chunk("real"),
    ]
    with patch("adaptive_learner_ai_openai.client.openai", create=True) as m:
        async_client = MagicMock()

        async def fake_create(**kwargs):  # noqa: ARG001
            return _FakeAsyncStream(chunks)

        async_client.chat.completions.create.side_effect = fake_create
        m.AsyncOpenAI.return_value = async_client
        out = [
            c
            async for c in stream(
                [{"role": "user", "content": "x"}],
                model="gpt-4o",
                api_key="k",
            )
        ]
    assert out == ["real"]
