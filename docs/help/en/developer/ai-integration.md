# AI integration

Adaptive Learner runs every learning conversation through up
to **three** AI calls per round-trip — the streamed response,
the step evaluator, and (at step 7) the topic-transition
evaluator. Three providers ship out of the box; new providers
plug in via the `ai_complete*` hook family.

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

## Async + streaming variants

```python
@hookspec(firstresult=True)
async def ai_complete_async(messages, model, api_key, max_tokens) -> str:
    """Awaitable; same shape as ai_complete. v1.5.0+."""

@hookspec(firstresult=True)
def ai_complete_stream(messages, model, api_key, max_tokens):
    """Returns an async iterator of text deltas. v1.6.0+."""
```

`ai_complete_async` is used by the session route at the
step 6→7 cycle boundary so step-evaluation +
topic-transition fire concurrently via `asyncio.gather`
(`async_evaluation: true` in `app.yaml`).

`ai_complete_stream` powers the streaming SSE endpoint
`POST /api/plugins/session/{id}/message/stream` that emits
`start` / `chunk` / `done` events.

## Provider selection logic (v1.20.0)

The session route's `_resolve_active_key()` calls
`services/settings.resolve_api_key(db, user_id, provider)`
which walks the three-layer chain:

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` env var.
2. `ai.<provider>.api_key` in
   `~/.config/adaptive_learner/secrets.yaml`.
3. Fernet-decrypted `UserSettings.api_key_<provider>`.
4. `None` — the call surfaces `ai_error` to the UI.

`resolve_default_model(db, user_id, provider)` walks the same
chain for the model override (env > yaml > UI override >
`DEFAULT_MODELS[provider]`).

Then `ai_complete*` fires with the resolved values. The
matching provider's plugin returns the text; the others
return None (firstresult stops at the first hit).

## Dual-prompt architecture (v0.5.0) + auto-loop (v1.4.0)

Every `POST /api/plugins/session/{id}/message` for a `user`
role makes up to three AI calls:

1. **Learning reply** — streamed via `ai_complete_stream`.
   System prompt composed by `build_prompt(project, profile,
   method, cycle_step, lang)` from the 42-cell matrix.
   `max_tokens=1024`. SSE emits `start` / `chunk` /
   `done` events.
2. **Step evaluator** — separate system prompt
   (`EVALUATION_SYSTEM_PROMPT`) asking the AI to read the
   exchange and emit a JSON verdict
   (`advance`, `confidence`, `reason`, `suggested_step`).
   `max_tokens=256`. The evaluator's verdict drives the
   `cycle_step` advance (gated by `confidence ≥ 0.6`).
3. **Topic transition** — only at step 7. A third AI call
   judges whether the topic was integrated and whether to
   start a new cycle on a new subtopic. Cap of
   `max_cycles=5` per session.

If the evaluator returns unparseable JSON, the deterministic
+1 fallback kicks in (capped at 7) and `fallback_used=True`
is recorded.

The cycle boundary (step 6 → 7) fires step-eval +
topic-transition concurrently via `asyncio.gather` (saves ~T₂
of latency). Returned in the `timings` block of the message
response (`learning_ms`, `evaluation_ms`,
`topic_transition_ms`, `total_ms`, `parallel_saved_ms`).

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

## Other AI surfaces (read-only summary)

Several non-session features use the same AI provider plugins
via `ai_complete*`:

- **Conversation analyzer** (Phase 12 / v0.9.0+) —
  `frontend/src/chat_import/analysis.ts` chunks imported
  transcripts at 16K chars with 2-message overlap, fires
  `ai_complete` per chunk, merges results. Extracts topic /
  weaknesses / error_patterns / recommended_method /
  vocabulary (since v1.20.0). Tolerant JSON parser handles
  Haiku-class misbehaviour (fenced output, preamble prose).
- **Anki extraction** (Phase 30 / v1.17.0) — `plugins/.../
  anki/card_extraction.py` extracts flashcard candidates
  from a session or conversation; vocabulary path runs
  client-side without AI when `analysis_result.vocabulary`
  is populated.
- **NotebookLM study questions + guide** (Phase 32 /
  v1.19.0) — `plugins/.../notebooklm/question_generator.py`
  + `study_guide.py`; tolerant JSON parser; user-edited
  questions skip re-generation.
- **Pronunciation judge** (Phase 31 / v1.18.0) —
  `plugins/.../pronunciation.py` generates target phrases
  + judges learner audio similarity (eligibility gated by
  the Languages subject taxonomy).
