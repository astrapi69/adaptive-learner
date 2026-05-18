"""Tests for the Gemini SDK wrapper. NO real API calls.

Every test patches ``adaptive_learner_ai_gemini.client.genai`` so
no network egress happens under any circumstance.
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
    """Patch the SDK at the plugin's import point. Yields the mocked
    ``genai`` module so tests can assert on call args."""
    with patch("adaptive_learner_ai_gemini.client.genai", create=True) as m:
        model_instance = MagicMock()
        model_instance.generate_content.return_value = SimpleNamespace(text="fine response")
        m.GenerativeModel.return_value = model_instance
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
    assert chat == [{"role": "user", "parts": ["Hi"]}]


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
        {"role": "user", "parts": ["first"]},
        {"role": "model", "parts": ["reply"]},
        {"role": "user", "parts": ["follow-up"]},
    ]


def test_split_drops_unknown_roles():
    _, chat = _split_system_and_chat(
        [
            {"role": "tool", "content": "ignored"},
            {"role": "user", "content": "kept"},
        ]
    )
    assert chat == [{"role": "user", "parts": ["kept"]}]


def test_split_drops_non_string_or_empty_content():
    _, chat = _split_system_and_chat(
        [
            {"role": "user", "content": None},
            {"role": "user", "content": 12345},
            {"role": "user", "content": ""},
            {"role": "user", "content": "ok"},
        ]
    )
    assert chat == [{"role": "user", "parts": ["ok"]}]


def test_split_returns_none_system_when_no_system_messages():
    sys, _ = _split_system_and_chat([{"role": "user", "content": "Hi"}])
    assert sys is None


# --- complete (happy path) -------------------------------------------------


def test_complete_returns_assistant_text(genai_mock):
    out = complete(
        [{"role": "user", "content": "ping"}],
        model="gemini-2.0-flash",
        api_key="ak-test-1234",
    )
    assert out == "fine response"


def test_complete_configures_api_key(genai_mock):
    complete(
        [{"role": "user", "content": "ping"}],
        model="gemini-2.0-flash",
        api_key="ak-test-XYZ",
    )
    genai_mock.configure.assert_called_once_with(api_key="ak-test-XYZ")


def test_complete_passes_model_name_and_max_tokens(genai_mock):
    complete(
        [{"role": "user", "content": "x"}],
        model="gemini-1.5-pro",
        api_key="k",
    )
    call_kwargs = genai_mock.GenerativeModel.call_args.kwargs
    assert call_kwargs["model_name"] == "gemini-1.5-pro"
    assert call_kwargs["generation_config"]["max_output_tokens"] == DEFAULT_MAX_TOKENS


def test_complete_lifts_system_messages_into_constructor(genai_mock):
    complete(
        [
            {"role": "system", "content": "Always answer in German."},
            {"role": "user", "content": "What is 2+2?"},
        ],
        model="gemini-2.0-flash",
        api_key="k",
    )
    call_kwargs = genai_mock.GenerativeModel.call_args.kwargs
    assert call_kwargs["system_instruction"] == "Always answer in German."


def test_complete_passes_translated_history_to_generate_content(genai_mock):
    complete(
        [
            {"role": "user", "content": "first"},
            {"role": "assistant", "content": "reply"},
            {"role": "user", "content": "follow-up"},
        ],
        model="gemini-2.0-flash",
        api_key="k",
    )
    model_instance = genai_mock.GenerativeModel.return_value
    history_arg = model_instance.generate_content.call_args.args[0]
    # Gemini-style: role=model in place of role=assistant.
    assert history_arg == [
        {"role": "user", "parts": ["first"]},
        {"role": "model", "parts": ["reply"]},
        {"role": "user", "parts": ["follow-up"]},
    ]


def test_complete_returns_empty_string_on_missing_text(genai_mock):
    """The SDK occasionally returns a response without ``.text``
    (safety filter triggered). The wrapper returns the empty
    string rather than raising."""
    genai_mock.GenerativeModel.return_value.generate_content.return_value = (
        SimpleNamespace()  # no .text attribute
    )
    out = complete(
        [{"role": "user", "content": "x"}],
        model="gemini-2.0-flash",
        api_key="k",
    )
    assert out == ""


def test_complete_respects_custom_max_tokens(genai_mock):
    complete(
        [{"role": "user", "content": "x"}],
        model="gemini-2.0-flash",
        api_key="k",
        max_tokens=512,
    )
    call_kwargs = genai_mock.GenerativeModel.call_args.kwargs
    assert call_kwargs["generation_config"]["max_output_tokens"] == 512
