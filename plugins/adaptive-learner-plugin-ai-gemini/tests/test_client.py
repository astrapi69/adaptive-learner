"""Tests for the Gemini SDK wrapper. NO real API calls.

Phase 6E: migrated from the deprecated ``google.generativeai``
to the current ``google.genai`` 2.x SDK. The wrapper's external
contract (``complete(messages, model, api_key)`` returns a
string) is unchanged; the internal call shape and the
patch-target name move from ``genai.configure`` +
``genai.GenerativeModel`` to ``genai.Client(api_key).models.
generate_content(...)``.

Every test patches
``adaptive_learner_ai_gemini.client.genai`` so no network
egress happens under any circumstance.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from adaptive_learner_ai_gemini.client import (
    DEFAULT_MAX_TOKENS,
    _split_system_and_chat,
    complete,
)


@pytest.fixture()
def genai_mock():
    """Patch the SDK at the plugin's import point. Yields the
    mocked ``genai`` module so tests can assert on call args.

    The mock wires the new 2.x call surface:
    ``genai.Client(api_key=...).models.generate_content(...)``.
    """
    with patch("adaptive_learner_ai_gemini.client.genai", create=True) as m:
        client_instance = MagicMock()
        client_instance.models.generate_content.return_value = SimpleNamespace(text="fine response")
        m.Client.return_value = client_instance
        yield m


@pytest.fixture()
def genai_types_mock():
    """The wrapper calls ``genai_types.GenerateContentConfig(...)``
    to build the config object. Patching ``genai_types`` lets us
    capture those constructor kwargs without instantiating the
    real Pydantic-like config class."""
    with patch("adaptive_learner_ai_gemini.client.genai_types", create=True) as m:
        m.GenerateContentConfig.side_effect = lambda **kwargs: SimpleNamespace(**kwargs)
        yield m


# --- _split_system_and_chat ------------------------------------------------


def test_split_collects_system_messages_into_single_instruction():
    sys, chat = _split_system_and_chat(
        [
            {"role": "system", "content": "Be concise."},
            {"role": "system", "content": "Use Markdown."},
            {"role": "user", "content": "Hi"},
        ]
    )
    assert sys == "Be concise.\n\nUse Markdown."
    assert chat == [{"role": "user", "parts": [{"text": "Hi"}]}]


def test_split_translates_assistant_role_to_model():
    """Gemini uses ``model`` instead of ``assistant``."""
    _, chat = _split_system_and_chat(
        [
            {"role": "user", "content": "first"},
            {"role": "assistant", "content": "reply"},
            {"role": "user", "content": "follow-up"},
        ]
    )
    assert chat == [
        {"role": "user", "parts": [{"text": "first"}]},
        {"role": "model", "parts": [{"text": "reply"}]},
        {"role": "user", "parts": [{"text": "follow-up"}]},
    ]


def test_split_drops_unknown_roles():
    _, chat = _split_system_and_chat(
        [
            {"role": "tool", "content": "ignored"},
            {"role": "user", "content": "kept"},
        ]
    )
    assert chat == [{"role": "user", "parts": [{"text": "kept"}]}]


def test_split_drops_non_string_or_empty_content():
    _, chat = _split_system_and_chat(
        [
            {"role": "user", "content": None},
            {"role": "user", "content": 12345},
            {"role": "user", "content": ""},
            {"role": "user", "content": "ok"},
        ]
    )
    assert chat == [{"role": "user", "parts": [{"text": "ok"}]}]


def test_split_returns_none_system_when_no_system_messages():
    sys, _ = _split_system_and_chat([{"role": "user", "content": "Hi"}])
    assert sys is None


def test_split_uses_text_dict_part_shape():
    """google-genai 2.x requires each part to be a dict with
    a ``text`` key (the 0.8.x SDK accepted a bare string). Pin
    the new shape so a future SDK regression surfaces here."""
    _, chat = _split_system_and_chat([{"role": "user", "content": "Hi"}])
    assert chat[0]["parts"][0] == {"text": "Hi"}


# --- complete (happy path) -------------------------------------------------


def test_complete_returns_assistant_text(genai_mock, genai_types_mock):
    out = complete(
        [{"role": "user", "content": "ping"}],
        model="gemini-2.0-flash",
        api_key="ak-test-1234",
    )
    assert out == "fine response"


def test_complete_instantiates_client_with_api_key(genai_mock, genai_types_mock):
    """Phase 6E shape: api_key flows through
    ``genai.Client(api_key=...)`` rather than the old
    ``genai.configure(api_key=...)``."""
    complete(
        [{"role": "user", "content": "ping"}],
        model="gemini-2.0-flash",
        api_key="ak-test-XYZ",
    )
    genai_mock.Client.assert_called_once_with(api_key="ak-test-XYZ")


def test_complete_passes_model_name_and_max_tokens(genai_mock, genai_types_mock):
    complete(
        [{"role": "user", "content": "x"}],
        model="gemini-1.5-pro",
        api_key="k",
    )
    # model name lands on the generate_content kwargs.
    gc_kwargs = genai_mock.Client.return_value.models.generate_content.call_args.kwargs
    assert gc_kwargs["model"] == "gemini-1.5-pro"
    # max_tokens lands on the GenerateContentConfig kwargs.
    config_kwargs = genai_types_mock.GenerateContentConfig.call_args.kwargs
    assert config_kwargs["max_output_tokens"] == DEFAULT_MAX_TOKENS


def test_complete_lifts_system_messages_into_config(genai_mock, genai_types_mock):
    """v0.2.0 lifted system messages into the GenerativeModel
    constructor; v0.3.0 lifts them into the per-call
    GenerateContentConfig.system_instruction field."""
    complete(
        [
            {"role": "system", "content": "Always answer in German."},
            {"role": "user", "content": "What is 2+2?"},
        ],
        model="gemini-2.0-flash",
        api_key="k",
    )
    config_kwargs = genai_types_mock.GenerateContentConfig.call_args.kwargs
    assert config_kwargs["system_instruction"] == "Always answer in German."


def test_complete_passes_translated_contents(genai_mock, genai_types_mock):
    complete(
        [
            {"role": "user", "content": "first"},
            {"role": "assistant", "content": "reply"},
            {"role": "user", "content": "follow-up"},
        ],
        model="gemini-2.0-flash",
        api_key="k",
    )
    gc_kwargs = genai_mock.Client.return_value.models.generate_content.call_args.kwargs
    contents = gc_kwargs["contents"]
    # Gemini-style: role=model in place of role=assistant;
    # parts are dicts wrapping ``text``.
    assert contents == [
        {"role": "user", "parts": [{"text": "first"}]},
        {"role": "model", "parts": [{"text": "reply"}]},
        {"role": "user", "parts": [{"text": "follow-up"}]},
    ]


def test_complete_returns_empty_string_on_missing_text(genai_mock, genai_types_mock):
    """The SDK occasionally returns a response without ``.text``
    (safety filter triggered). The wrapper returns the empty
    string rather than raising."""
    genai_mock.Client.return_value.models.generate_content.return_value = (
        SimpleNamespace()  # no .text attribute
    )
    out = complete(
        [{"role": "user", "content": "x"}],
        model="gemini-2.0-flash",
        api_key="k",
    )
    assert out == ""


def test_complete_respects_custom_max_tokens(genai_mock, genai_types_mock):
    complete(
        [{"role": "user", "content": "x"}],
        model="gemini-2.0-flash",
        api_key="k",
        max_tokens=512,
    )
    config_kwargs = genai_types_mock.GenerateContentConfig.call_args.kwargs
    assert config_kwargs["max_output_tokens"] == 512


# --- stream (v1.6.0 / Phase 19) --------------------------------------------


class _FakeAsyncChunkStream:
    """Async iterator yielding ``GenerateContentResponse``-shaped
    chunks for the streaming wrapper."""

    def __init__(self, deltas: list[str]):
        self._items = [SimpleNamespace(text=d) for d in deltas]

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._items:
            raise StopAsyncIteration
        return self._items.pop(0)


@pytest.mark.asyncio
async def test_stream_yields_each_text_delta(genai_mock, genai_types_mock):
    """``client.aio.models.generate_content_stream`` returns a
    coroutine resolving to an async iterator; the wrapper consumes
    each chunk's ``.text`` and yields non-empty strings."""
    from adaptive_learner_ai_gemini.client import stream

    async def fake_stream_call(**kwargs):  # noqa: ARG001
        return _FakeAsyncChunkStream(["Hi", " from", " gemini"])

    genai_mock.Client.return_value.aio.models.generate_content_stream.side_effect = fake_stream_call

    out = [
        c
        async for c in stream(
            [{"role": "user", "content": "x"}],
            model="gemini-2.0-flash",
            api_key="k",
            max_tokens=128,
        )
    ]
    assert out == ["Hi", " from", " gemini"]
    # SDK was invoked with the model + content list + config object.
    call_kwargs = genai_mock.Client.return_value.aio.models.generate_content_stream.call_args.kwargs
    assert call_kwargs["model"] == "gemini-2.0-flash"


@pytest.mark.asyncio
async def test_stream_skips_chunks_with_empty_or_missing_text(genai_mock, genai_types_mock):
    """Safety-flag and finish-reason chunks come with ``text=None`` or
    no ``text`` attribute; the wrapper drops them."""
    from adaptive_learner_ai_gemini.client import stream

    # Mix of valid + empty + missing-text shaped chunks.
    chunks = [
        SimpleNamespace(text="real"),
        SimpleNamespace(text=None),
        SimpleNamespace(),  # no text attr at all
        SimpleNamespace(text=""),
        SimpleNamespace(text="more"),
    ]

    class _Stream:
        def __aiter__(self_inner):
            return self_inner

        async def __anext__(self_inner):
            if not chunks:
                raise StopAsyncIteration
            return chunks.pop(0)

    async def fake_stream_call(**kwargs):  # noqa: ARG001
        return _Stream()

    genai_mock.Client.return_value.aio.models.generate_content_stream.side_effect = fake_stream_call

    out = [
        c
        async for c in stream(
            [{"role": "user", "content": "x"}],
            model="gemini-2.0-flash",
            api_key="k",
        )
    ]
    assert out == ["real", "more"]
