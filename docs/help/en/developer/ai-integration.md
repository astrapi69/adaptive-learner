# AI integration

AdaptiveLearner runs every learning conversation through two
AI calls per round-trip — one for the response, one for the
step evaluator. Three providers ship out of the box; new
providers plug in via the `ai_complete` hook.

## The ai_complete hook

```python
# backend/app/hookspecs.py
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """Return the assistant text, or None if this plugin doesn't handle ``model``."""
```

`firstresult=True` means pluggy stops at the first non-None
return. Each provider plugin checks the `model` prefix and
returns the assistant text if it owns the model:

```python
@hookimpl
def ai_complete(
    self, messages, model, api_key, max_tokens
) -> str | None:
    if not model.startswith("claude-"):
        return None
    # ... call Anthropic API, return the text ...
```

Three plugins ship: `ai-anthropic` (claude-*), `ai-openai`
(gpt-*), `ai-gemini` (gemini-*).

## Provider selection logic

The session route's `_resolve_active_key()` looks up:

1. The user's `UserSettings.active_provider` (`anthropic` /
   `openai` / `gemini`).
2. The matching `api_key_<provider>` field on `UserSettings`
   (decrypted with Fernet at read time).
3. The matching `model_override_<provider>` field (or fall
   back to `DEFAULT_MODELS[provider]`).

Then it fires `ai_complete` with those values. The matching
provider's plugin returns the text; the others return None
(firstresult stops at the first hit).

## Dual-prompt architecture

Every `POST /api/plugins/session/{id}/message` for a `user`
role makes **two** AI calls:

1. **Learning reply** — uses the system prompt composed by
   `build_prompt(project, profile, method, cycle_step, lang)`
   from the 42-cell matrix. `max_tokens=1024`.
2. **Step evaluator** — uses a separate system prompt
   (`EVALUATION_SYSTEM_PROMPT`) asking the AI to read the
   exchange and emit a JSON verdict
   (`advance`, `confidence`, `reason`, `suggested_step`).
   `max_tokens=256`.

Both calls use the same provider + key. The evaluator's
verdict drives the `cycle_step` advance. If the evaluator
returns unparseable JSON, the deterministic +1 fallback kicks
in (capped at 7) and `fallback_used=True` is recorded for
audit.

## The 42-cell prompt matrix

`plugins/adaptive-learner-plugin-session/adaptive_learner_session/prompts.py`
holds a `dict[method, dict[step, dict[lang, str]]]` — six
methods, seven steps, two languages, 84 cells. Each cell is
1-2 sentences setting the AI's role + the step's task. A
context block ("Learning project: 'X' | Goal: 'Y'. Profile
hint: …") gets appended at compose time.

For Dexie mode, the prompts are exported verbatim to
`frontend/src/data/session-prompts.json` and loaded by
`frontend/src/storage/prompts.ts`. Same text, same context
block format — no drift possible.

## Adding a new provider

1. Create `plugins/adaptive-learner-plugin-ai-newprovider/`.
2. Implement the `ai_complete` hookimpl: check the model
   prefix, call the provider's HTTP API, return the text.
3. Add the provider's prefix to `DEFAULT_MODELS` in
   `ai_orchestration.py` with a cheap default model.
4. Add the provider name to the `AIProvider` enum in
   `app/schemas/__init__.py`.
5. Add it to `AI_PROVIDERS` in
   `frontend/src/lib/constants.ts`.
6. For Dexie-mode parity: add a client to
   `frontend/src/storage/ai-providers.ts` and route to it from
   `aiComplete()`.

Each provider plugin tests its hookimpl + provider call in
isolation — see `plugins/adaptive-learner-plugin-ai-anthropic/tests/`
for a template (the provider HTTP call is mocked).

## Browser-direct calls (Dexie mode)

In Dexie mode the AI call doesn't go through the plugin
system. `storage/ai-providers.ts` makes the HTTP request
directly. Anthropic requires the
`anthropic-dangerous-direct-browser-access: true` header to
clear the CORS preflight; OpenAI and Gemini accept direct
browser calls out of the box.

The dual-prompt logic is the same in both modes —
`storage/session-flow.ts` calls `aiComplete()` twice and
parses the evaluator's JSON the same way the backend does.

## Confidence threshold

`backend/config/app.yaml`'s
`session.step_evaluation.confidence_threshold` (default 0.6)
gates whether a real (non-fallback) evaluator verdict actually
moves the cycle step. Set higher to be more conservative,
lower to be more eager. Fallback verdicts (parse failures)
always apply the +1 advance regardless.

The Dexie port mirrors this with a hardcoded 0.6 in
`storage/session-flow.ts`. A future phase will expose this in
the Settings UI.
