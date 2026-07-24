# AI integration

Adaptive Learner runs every learning conversation through up
to **three** AI calls per round-trip - the streamed response,
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
4. `None` - the call surfaces `ai_error` to the UI.

`resolve_default_model(db, user_id, provider)` walks the same
chain for the model override (env > yaml > UI override >
`DEFAULT_MODELS[provider]`).

Then `ai_complete*` fires with the resolved values. The
matching provider's plugin returns the text; the others
return None (firstresult stops at the first hit).

## Dual-prompt architecture (v0.5.0) + auto-loop (v1.4.0)

Every `POST /api/plugins/session/{id}/message` for a `user`
role makes up to three AI calls:

1. **Learning reply** - streamed via `ai_complete_stream`.
   System prompt composed by `build_prompt(project, profile,
   method, cycle_step, lang)` from the 42-cell matrix, with an
   explicit "reply in the learner's language" directive appended
   (`build_language_directive(lang)`, #827 - see below).
   `max_tokens=1024`. SSE emits `start` / `chunk` /
   `done` events.
2. **Step evaluator** - separate system prompt
   (`EVALUATION_SYSTEM_PROMPT`) asking the AI to read the
   exchange and emit a JSON verdict
   (`advance`, `confidence`, `reason`, `suggested_step`).
   `max_tokens=256`. The evaluator's verdict drives the
   `cycle_step` advance (gated by `confidence ≥ 0.6`).
3. **Topic transition** - only at step 7. A third AI call
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
holds a `dict[method, dict[step, dict[lang, str]]]` - six
methods, seven steps, two languages, 84 cells. Each cell is
1-2 sentences setting the AI's role + the step's task. A
context block ("Learning project: 'X' | Goal: 'Y'. Profile
hint: …") gets appended at compose time.

For Dexie mode, the prompts are exported verbatim to
`frontend/src/data/session-prompts.json` and loaded by
`frontend/src/storage/ai/prompts.ts`. Same text, same context
block format - no drift possible.

## Output-language directive (#827)

The 42-cell matrix is written in only two languages (de / en),
so a learner using one of the other UI languages would receive
an English prompt and get an English reply. To fix that, an
explicit "respond in the learner's language" instruction is
appended to the composed system prompt. It names the learner's
language (English name + endonym) so the AI answers in it
regardless of the language the prompt itself is written in,
covering all **11** UI languages.

The backend builds it in
`plugins/adaptive-learner-plugin-session/.../prompts.py`
(`LANGUAGE_NAMES` + `build_language_directive(lang)`); the Dexie
port is byte-identical in
`frontend/src/storage/ai/prompts.ts`
(`buildLanguageDirective(lang)`), so the two modes never drift.

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
   `frontend/src/storage/ai/ai-providers.ts` and route to it from
   `aiComplete()`.

Each provider plugin tests its hookimpl + provider call in
isolation - see `plugins/adaptive-learner-plugin-ai-anthropic/tests/`
for a template (the provider HTTP call is mocked).

## Browser-direct calls (Dexie mode)

In Dexie mode the AI call doesn't go through the plugin
system. `storage/ai/ai-providers.ts` makes the HTTP request
directly. Anthropic requires the
`anthropic-dangerous-direct-browser-access: true` header to
clear the CORS preflight; OpenAI and Gemini accept direct
browser calls out of the box.

The dual-prompt logic is the same in both modes -
`storage/ai/session-flow.ts` calls `aiComplete()` twice and
parses the evaluator's JSON the same way the backend does.
Every browser-direct AI feature lives under
`frontend/src/lib/ai/` (the pure engines) and
`frontend/src/storage/ai/` (the provider clients), so the
GitHub-Pages deployment runs the full AI surface with no
backend.

## Confidence threshold

`backend/config/app.yaml`'s
`session.step_evaluation.confidence_threshold` (default 0.6)
gates whether a real (non-fallback) evaluator verdict actually
moves the cycle step. Set higher to be more conservative,
lower to be more eager. Fallback verdicts (parse failures)
always apply the +1 advance regardless.

The Dexie port mirrors this with a hardcoded 0.6 in
`storage/ai/session-flow.ts`. A future phase will expose this in
the Settings UI.

## AI exercise generation pipeline (EXP-036 / AIX-01..06)

A theory-only lesson can have exercises authored by the AI. The
pipeline is `generate -> quality-gate -> balance -> feedback`,
all under `frontend/src/lib/ai/`. The engines are library-grade
(no app-state imports) and take a provider SEAM so the Dexie
(browser-direct) and API paths inject their own completion
function:

1. **Generate (AIX-01)** -
   `exercise-generation-prompt.ts` builds the prompt from the
   lesson's theory steps; `generate-exercises.ts` calls the AI
   and `exercise-generation-parser.ts` defensively parses the
   reply into structurally valid cards (tolerates fenced output
   and preamble prose).
2. **Quality gate (AIX-03)** -
   `exercise-quality-gate.ts` is a deterministic (no AI) filter:
   it rejects duplicates, single-character answers, a distractor
   equal to the correct answer, a matching card with fewer than
   three pairs, etc., and flags soft issues as warnings.
3. **Balance (AIX-04)** -
   `exercise-distribution.ts` reorders (never deletes) the cards
   so no single exercise type is over-represented at the front
   and the same type does not repeat three times in a row while
   another type is available. `distributionGaps()` reports absent
   types so a regeneration prompt can mention them.
4. **Regenerate with feedback (AIX-05)** - the user's feedback is
   folded back into the prompt for another pass.

A **"generate exercises" button** appears on theory-only lessons
(AIX-02), and **batch generation (AIX-06)** runs the per-lesson
pipeline sequentially across every theory-only lesson in a set
(`generate-exercises-for-set.ts` + `set-batch-deps.ts`):
sequential for token-budget + rate-limit reasons, reporting
progress, skipping a lesson that errors, and honouring an
`AbortSignal` (already-generated lessons are kept).

## AI content validation (EXP-033)

Set-wide AI quality checks for authored content. The user picks
a provider + model and runs a **"Check with AI"** report:

- `content-validator.ts` builds a **batched** prompt
  (`VALIDATION_BATCH_SIZE` cards per call) and parses the JSON
  reply; `validation-runner.ts` orchestrates the batches and
  aggregates per-card results behind the same provider seam.
  Cost guards cap the cards per run and the call site enforces a
  rate limit.
- The report is cached in IndexedDB and exportable to Markdown
  (`validation-markdown.ts`), with a "Checked with: <provider>
  <model>" provenance line (`validation-provenance.ts`).
- A **content hash + signature** (`content-hash.ts`,
  `validation-signature.ts`) backs an **"AI-Checked" badge** so a
  set whose content changed after the check is no longer shown as
  validated.

## Configured-providers overview + per-provider Test (#810)

The Settings AI tab shows a `ConfiguredProvidersTable` - one row
per provider with its model, a **masked key preview** (first 4 +
ellipsis + last 4 via `lib/providers/maskSecret.ts`), the active
provider radio, and a **per-provider Test button**. The Test hits
the provider's **models-list** endpoint (OpenAI `/v1/models`,
Gemini `/v1beta/models`, Anthropic `/v1/models`), **not** a
generation call, so a successful test costs nothing (#800).

The masked preview is supplied on the settings payload
(`key_preview_<provider>`): computed server-side in API mode,
client-side in Dexie mode, so the overview works in both modes.

Model picking groups the live model list into **Recommended** +
**All models** (`lib/ai/model-recommendations.ts`): a small static
list of recommended model FAMILIES (matched as id prefixes,
newest-dated variant wins) pulls the same 2-3 good models to the
top for every provider. The live list is discovered via the same
models-list endpoint (`storage/ai/model-discovery.ts` in Dexie
mode; `backend/app/services/model_discovery.py` in API mode), with
a per-tab sessionStorage cache.

## Feature gating (active / disabled / hidden)

AI features are gated through a central registry
(`frontend/src/features/featureConfig.ts`) and the
`useFeatureAvailable` hook (`features/useFeatureAvailable.ts`),
resolved from a memoised `{mode, hasAiKey}` context. Every
AI-backed feature (session start/resume, conversation analysis,
Anki extraction, NotebookLM questions/guide, AI lesson
generation, pronunciation) is in `NEEDS_AI_KEY`: it shows as
**active** with a usable key, **disabled** (reason
`api_key_required`) without one, never silently **hidden** -
matching the visible-but-disabled feature-state policy (#335).

## Other AI surfaces (read-only summary)

Several non-session features use the same AI provider plugins
via `ai_complete*`:

- **Conversation analyzer** (Phase 12 / v0.9.0+) -
  `frontend/src/chat_import/analysis.ts` chunks imported
  transcripts at 16K chars with 2-message overlap, fires
  `ai_complete` per chunk, merges results. Extracts topic /
  weaknesses / error_patterns / recommended_method /
  vocabulary (since v1.20.0). Tolerant JSON parser handles
  Haiku-class misbehaviour (fenced output, preamble prose).
- **Anki extraction** (Phase 30 / v1.17.0) - `plugins/.../
  anki/card_extraction.py` extracts flashcard candidates
  from a session or conversation; vocabulary path runs
  client-side without AI when `analysis_result.vocabulary`
  is populated.
- **NotebookLM study questions + guide** (Phase 32 /
  v1.19.0) - `plugins/.../notebooklm/question_generator.py`
  + `study_guide.py`; tolerant JSON parser; user-edited
  questions skip re-generation.
- **Pronunciation judge** (Phase 31 / v1.18.0) -
  `plugins/.../pronunciation.py` generates target phrases
  + judges learner audio similarity (eligibility gated by
  the Languages subject taxonomy).
