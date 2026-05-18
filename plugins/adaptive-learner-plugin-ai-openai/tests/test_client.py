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
