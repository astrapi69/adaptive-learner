"""Tests for the Perplexity client wrapper. NO real API calls.

Every test patches ``adaptive_learner_ai_perplexity.client.openai``
so no network egress happens under any circumstance. The fixture
asserts on the SDK call arguments to pin the message-passing
contract AND the Perplexity base_url override.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from adaptive_learner_ai_perplexity.client import (
    DEFAULT_MAX_TOKENS,
    PERPLEXITY_BASE_URL,
    _filter_messages,
    complete,
)


def _fake_response(text: str = "sonar says hi") -> SimpleNamespace:
    """The shape the wrapper reads from ``ChatCompletion``:
    ``.choices[0].message.content``."""
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


@pytest.fixture()
def openai_mock():
    """Patch the SDK at the plugin's import point."""
    with patch("adaptive_learner_ai_perplexity.client.openai", create=True) as m:
        client_instance = MagicMock()
        client_instance.chat.completions.create.return_value = _fake_response()
        m.OpenAI.return_value = client_instance
        yield m


def test_filter_keeps_known_roles_drops_rest():
    out = _filter_messages(
        [
            {"role": "system", "content": "Be concise."},
            {"role": "tool", "content": "dropped"},
            {"role": "user", "content": "Hi"},
            {"role": "user", "content": ""},
        ]
    )
    assert out == [
        {"role": "system", "content": "Be concise."},
        {"role": "user", "content": "Hi"},
    ]


def test_complete_sends_bearer_key_to_perplexity_base_url(openai_mock):
    """The one property that distinguishes this client from the
    ai-openai wrapper: the OpenAI-compatible call goes to
    ``https://api.perplexity.ai``."""
    text = complete(
        [{"role": "user", "content": "hello"}],
        model="sonar-pro",
        api_key="pplx-test-key-1234567890",
    )
    assert text == "sonar says hi"
    openai_mock.OpenAI.assert_called_once_with(
        api_key="pplx-test-key-1234567890",
        base_url=PERPLEXITY_BASE_URL,
    )
    create = openai_mock.OpenAI.return_value.chat.completions.create
    create.assert_called_once_with(
        model="sonar-pro",
        messages=[{"role": "user", "content": "hello"}],
        max_tokens=DEFAULT_MAX_TOKENS,
    )


def test_complete_passes_custom_max_tokens(openai_mock):
    complete(
        [{"role": "user", "content": "hello"}],
        model="sonar",
        api_key="pplx-k",
        max_tokens=256,
    )
    create = openai_mock.OpenAI.return_value.chat.completions.create
    assert create.call_args.kwargs["max_tokens"] == 256


def test_complete_returns_empty_string_on_empty_choices(openai_mock):
    openai_mock.OpenAI.return_value.chat.completions.create.return_value = SimpleNamespace(
        choices=[]
    )
    out = complete([{"role": "user", "content": "x"}], model="sonar", api_key="pplx-k")
    assert out == ""


def test_base_url_is_the_documented_endpoint():
    assert PERPLEXITY_BASE_URL == "https://api.perplexity.ai"
