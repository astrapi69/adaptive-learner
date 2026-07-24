# Hook specifications

The 10 hookspecs live in `backend/app/hookspecs.py`. Each
hookspec defines the calling contract; plugins implement
them with `@hookimpl`. Three of them are AI-call variants
(sync / async / stream) shipped progressively across v1.5.0
and v1.6.0; the rest are unchanged since v0.2.0.

## get_assessment_questions

```python
@hookspec
def get_assessment_questions(lang: str) -> list[dict] | None:
    """Return the question pack for the requested language.

    Implemented by: assessment plugin.
    Mode: list (not firstresult). The route currently uses
    the first plugin's result; a future "multiple question
    packs" feature could let providers register named packs.
    """
```

Return shape:

```python
[
  {
    "id": "q01",
    "type": "single" | "multi",
    "text": "...",
    "answers": [
      {"id": "a", "text": "...", "weights": {"deductive": 1.0}},
      ...
    ]
  },
  ...
]
```

## calculate_profile

```python
@hookspec(firstresult=True)
def calculate_profile(answers: list[dict]) -> dict[str, float]:
    """Aggregate raw answers into a 6-method profile.

    Implemented by: assessment plugin.
    firstresult: exactly one plugin computes the profile.
    """
```

Input `answers` shape:

```python
[
  {"question_id": "q01", "answer_ids": ["a", "b"]},  # multi
  {"question_id": "q02", "answer_id": "c"},          # single
  ...
]
```

Return: `dict[method, float]` with the six method keys.

## create_session_prompt

```python
@hookspec(firstresult=True)
def create_session_prompt(
    project: dict,
    profile: dict,
    method: str,
    step: int,
    lang: str,
) -> str:
    """Compose the system prompt for one (method, step, lang) cell.

    Implemented by: session plugin.
    firstresult: exactly one plugin composes the prompt.
    """
```

Return: a string ready to be sent as the `system` role
message. The session plugin's implementation reads from the
42-cell `_PROMPTS` dict and appends a context block.

## ai_complete

```python
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """Call the AI provider, return the assistant text.

    Implemented by: ai-anthropic, ai-openai, ai-gemini.
    firstresult: the matching provider plugin returns the
    text; others return None.
    """
```

Each provider plugin checks the `model` prefix
(`claude-*`, `gpt-*`, `gemini-*`) and returns the assistant
text if it owns the model. Non-matching plugins return None,
letting firstresult fall through to the next.

`messages` shape (OpenAI-style):

```python
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."},
  {"role": "user", "content": "..."},
]
```

Provider plugins normalise this shape to their own API
(Anthropic separates `system` out; Gemini folds it in).

## ai_complete_async (v1.5.0+)

```python
@hookspec(firstresult=True)
async def ai_complete_async(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str:
    """Awaitable variant of ai_complete.

    Implemented by: ai-anthropic, ai-openai, ai-gemini.
    Used at the step 6 -> 7 cycle boundary so step-eval +
    topic-transition fire concurrently via asyncio.gather
    (saves ~T_2 of latency).
    """
```

The orchestrator helper `call_ai_complete_async` prefers
this hook; falls back to `ai_complete` wrapped in
`asyncio.to_thread` when not implemented.

## ai_complete_stream (v1.6.0+)

```python
@hookspec(firstresult=True)
def ai_complete_stream(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> AsyncIterator[str]:
    """Return an async iterator of text deltas.

    Implemented by: ai-anthropic, ai-openai, ai-gemini, each
    using the provider SDK's native async streaming.
    Powers ``POST /api/plugins/session/{id}/message/stream``
    (SSE: emits ``start`` / ``chunk`` / ``done`` events).
    """
```

## recommend_method_switch

```python
@hookspec
def recommend_method_switch(
    history: list[dict],
    profile: dict,
) -> dict | None:
    """Return a switch recommendation, or None.

    Implemented by: session plugin.
    Mode: list. Plugins return individual recommendations;
    a future arbiter picks the highest-confidence non-None.
    """
```

Return shape:

```python
{
  "recommended": True,
  "to_method": "dialogic",
  "reason": "Three sessions of stagnant understanding.",
  "confidence": 0.75,  # optional
}
```

Return `None` (or `{"recommended": False}`) when no switch is
warranted.

## on_session_complete

```python
@hookspec
def on_session_complete(
    session: dict,
    rating: dict,
) -> None:
    """Side-effect hook: fired when a session is ended.

    Implemented by: tracking plugin (writes a ProgressCommit).
    Mode: list. Each subscriber runs; errors are caught and
    logged but don't roll back the session-end.
    """
```

Errors in this hook MUST NOT propagate - the
`_fire_on_session_complete` wrapper in
`backend/app/main.py` catches and logs them.

## get_progress_summary

```python
@hookspec
def get_progress_summary(
    project_id: str,
    db: Session,
) -> dict | None:
    """Return one namespace slice of the progress summary.

    Implemented by: tracking plugin (returns the "tracking"
    namespace slice).
    Mode: list. Slices are shallow-merged in the route.
    """
```

Each plugin returns a dict keyed by a unique namespace. The
tracking plugin returns `{"tracking": {...}, "step_evaluation": {...}}`.
A future stagnation-detector plugin could return
`{"stagnation": {...}}` etc.

## get_tool_recommendations

```python
@hookspec
def get_tool_recommendations(
    profile: dict,
    lang: str,
    limit: int = 5,
) -> list[dict] | None:
    """Return ranked external-tool recommendations.

    Implemented by: tools plugin.
    Mode: list. The route currently uses the first plugin's
    result; a future multi-source recommender could merge.
    """
```

Return shape:

```python
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "...",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

## firstresult vs list mode

| Hookspec | Mode | Why |
|---|---|---|
| get_assessment_questions | list (effective firstresult) | Currently one pack; future could register named packs |
| calculate_profile | firstresult | Exactly one algorithm |
| create_session_prompt | firstresult | Exactly one prompt composer |
| ai_complete | firstresult | The matching provider owns the call |
| recommend_method_switch | list | Multiple plugins can suggest |
| on_session_complete | list | Side-effects fan out |
| get_progress_summary | list | Namespace slices merge |
| get_tool_recommendations | list (effective firstresult) | Currently one source |

The `list` modes that currently behave as firstresult are
deliberate: the contract is open to multi-plugin extension
but the v0.7.0 implementation uses just the first.
