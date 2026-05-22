# Plugin endpoints

Each plugin's routes mount under `/api/plugins/{plugin-name}/`.

## Assessment plugin

```
GET /api/plugins/assessment/questions?lang=en
```

Returns the 12-question pack with `text` resolved to the
requested language. Each answer carries the per-method
weights.

```json
[
  {
    "id": "q01",
    "type": "multi",
    "text": "How do you approach a new topic?",
    "answers": [
      {
        "id": "a",
        "text": "I read the rules and theory first.",
        "weights": {"deductive": 1.0}
      },
      ...
    ]
  },
  ...
]
```

```
POST /api/plugins/assessment/evaluate
```

Body:

```json
{
  "project_id": "p1",
  "answers": [
    {"question_id": "q01", "answer_ids": ["a", "b"]},
    {"question_id": "q02", "answer_id": "c"},
    ...
  ]
}
```

Both single-select (`answer_id: string`) and multi-select
(`answer_ids: string[]`) shapes are accepted. Returns the
created LearningProfile:

```json
{
  "id": "pr1",
  "user_id": "abc-123",
  "project_id": "p1",
  "deductive": 0.4167,
  "inductive": 0.1833,
  "error_based": 0.0833,
  "dialogic": 0.0833,
  "contextual": 0.0833,
  "ai_adaptive": 0.1500,
  "assessed_at": "2026-05-19T12:00:00+00:00",
  "version": 1,
  "dominant_method": "deductive"
}
```

```
GET /api/plugins/assessment/profile/{project_id}
```

Returns the latest LearningProfile for the project.

## Session plugin

```
POST /api/plugins/session/start
```

Body:

```json
{
  "project_id": "p1",
  "method": "deductive",
  "cycle_step": 1,
  "lang": "en"
}
```

`method`, `cycle_step`, `lang` are optional. Returns the
created session + the composed system prompt:

```json
{
  "session": {
    "id": "s1",
    "project_id": "p1",
    "method": "deductive",
    "started_at": "2026-05-19T12:00:00+00:00",
    "ended_at": null,
    "cycle_step": 1,
    "status": "active"
  },
  "system_prompt": "You are a deductive learning companion. ..."
}
```

```
POST /api/plugins/session/{session_id}/message
```

Body:

```json
{"role": "user", "content": "I'd like to start with the present tense."}
```

The server saves the user message, fires `ai_complete`,
persists the assistant reply, runs the step evaluator, and
returns the composite:

```json
{
  "user_message": {"id": "m1", "session_id": "s1", "role": "user", "content": "...", "created_at": "..."},
  "assistant_message": {"id": "m2", "session_id": "s1", "role": "assistant", "content": "...", "created_at": "..."},
  "ai_error": null,
  "session": {"...": "session row after cycle_step advance"},
  "step_evaluation": {
    "advance": true,
    "confidence": 0.85,
    "reason": "Learner clearly grasped the input.",
    "suggested_step": 2,
    "fallback_used": false,
    "applied": true,
    "from_step": 1
  }
}
```

```
POST /api/plugins/session/{session_id}/rate
```

Body:

```json
{
  "understanding": 4,
  "stress": 2,
  "method_fit": 5,
  "notes": "Felt productive."
}
```

Persists a SessionRating row. Returns the row.

```
POST /api/plugins/session/{session_id}/end
```

Closes the session. Fires `on_session_complete` (tracking
plugin writes a ProgressCommit). Returns:

```json
{"session": {"...": "the session with status='completed' and ended_at set"}}
```

```
GET /api/plugins/session/switch-recommendation/{session_id}
```

Returns:

```json
{"recommended": false, "to_method": null, "reason": null}
```

Or, when stagnation is detected:

```json
{"recommended": true, "to_method": "dialogic", "reason": "Three sessions of flat understanding + high stress."}
```

```
POST /api/plugins/session/{session_id}/switch
```

Body:

```json
{"to_method": "dialogic", "reason": "Felt right."}
```

Updates `session.method`, writes a MethodSwitch audit row,
returns the updated session.

## Tracking plugin

```
GET /api/plugins/tracking/progress/{project_id}
```

Returns the namespaced summary; the `tracking` slice carries
the aggregator's output:

```json
{
  "tracking": {
    "total_sessions": 7,
    "total_minutes": 195,
    "streak_days": 3,
    "sessions_per_method": {"deductive": 4, "inductive": 2, "dialogic": 1},
    "method_distribution": [...],
    "recent_understanding": [0.6, 0.8, 0.8, 0.8, 1.0],
    "recent_stress": [0.4, 0.4, 0.2, 0.2, 0.2],
    "mean_understanding": 0.8,
    "mean_stress": 0.3,
    "recent_sessions": [...]
  },
  "step_evaluation": {
    "total_evaluations": 28,
    "average_confidence": 0.78,
    "advance_count": 21,
    "repeat_count": 5,
    "backward_count": 2,
    "fallback_count": 1,
    "evaluations_per_step": {"1": 7, "2": 6, ...},
    "time_seconds_per_step": {"1": 180.5, ...}
  }
}
```

```
GET /api/plugins/tracking/commits/{project_id}
```

Returns all ProgressCommit rows for the project, chronological.

## Tools plugin

```
GET /api/plugins/tools/recommendations/{project_id}?lang=en
```

Returns the 5 catalog tools ranked by relevance to the
project's profile:

```json
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "Spaced-repetition flashcards - great for cementing rules and error-corrections long-term.",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

```
GET /api/plugins/tools/spaced/{project_id}?lang=en
```

Returns spaced-repetition action cards driven by recency:

```json
[
  {
    "id": "sr-deductive-first",
    "method": "deductive",
    "interval_days": 1,
    "action": "session",
    "title": "First practice in deduction.",
    "urgency": 0.5
  },
  ...
]
```

## Session plugin — streaming + pronunciation (v1.6.0+, v1.18.0+)

```
POST /api/plugins/session/{id}/message/stream  (SSE)
```

Same body shape as `/message`; emits three SSE event types:

- `start` — payload `{user_message}` (the user turn now
  persisted).
- `chunk` — payload `{delta}` (one or more text chunks
  arriving from the AI provider's stream).
- `done` — payload identical to the synchronous `/message`
  response: assistant message + cycle_step + timings +
  optional cycle-transition card.

```
GET  /api/plugins/session/pronunciation/eligibility/{project_id}
POST /api/plugins/session/pronunciation/phrase
POST /api/plugins/session/pronunciation/judge
```

Pronunciation eligibility is gated by the project's subject
taxonomy (walks ancestors looking for a Languages /
Sprachen root). The judge endpoint returns
`{matches, score, feedback, missed_sounds}`.

## Gamification plugin (v1.16.0+)

```
GET  /api/plugins/gamification/xp/{user_id}
POST /api/plugins/gamification/xp/{user_id}/award
POST /api/plugins/gamification/xp/{user_id}/award-assessment
POST /api/plugins/gamification/xp/{user_id}/award-import
GET  /api/plugins/gamification/badges
GET  /api/plugins/gamification/badges/{user_id}
POST /api/plugins/gamification/badges/{user_id}/evaluate
GET  /api/plugins/gamification/streak/{user_id}
GET  /api/plugins/gamification/streak/{user_id}/heatmap
POST /api/plugins/gamification/streak/{user_id}/weekend-mode
POST /api/plugins/gamification/reset/{user_id}
```

`/streak/{user_id}/heatmap` returns
`[{date, count}, ...]` for the last 365 days (clamps to
[7, 730]). The reset endpoint double-confirms then wipes
`user_xp` + `user_badges` + `user_streaks` rows.

## Anki plugin (v1.17.0+)

```
GET    /api/plugins/anki/cards/{user_id}
POST   /api/plugins/anki/cards
PATCH  /api/plugins/anki/cards/{id}
DELETE /api/plugins/anki/cards/{id}
POST   /api/plugins/anki/cards/extract/session/{id}
POST   /api/plugins/anki/cards/extract/conversation/{id}
POST   /api/plugins/anki/cards/mark-exported
```

AI extraction is user-triggered. The conversation-extract
path also reads `analysis_result.vocabulary` (since v1.20.0)
to produce cloze cards without an extra AI call when the
analysis already populated the vocabulary array.

## NotebookLM plugin (v1.19.0+)

```
GET    /api/plugins/notebooklm/questions/{user_id}
POST   /api/plugins/notebooklm/questions
PATCH  /api/plugins/notebooklm/questions/{id}
DELETE /api/plugins/notebooklm/questions/{id}
POST   /api/plugins/notebooklm/generate-from-session/{id}
POST   /api/plugins/notebooklm/generate-from-project/{id}
POST   /api/plugins/notebooklm/study-guide/{project_id}
```

`/study-guide/{project_id}` returns `text/markdown` (one
big AI call with content-clipping to ~30K chars). User
edits flip `edited=True` so the AI re-runner skips them.

## Plugin discovery

```
GET /api/plugins/manifests
GET /api/plugins/health
GET /api/plugins/errors
```

Each returns a map keyed by plugin name. Used by Settings >
Plugins UI for activation status + load-error visibility.
