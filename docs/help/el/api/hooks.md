# Προδιαγραφές hook

Τα 10 hookspecs βρίσκονται στο `backend/app/hookspecs.py`. Κάθε
hookspec ορίζει το συμβόλαιο κλήσης· τα plugins τα υλοποιούν
με `@hookimpl`. Τρία από αυτά είναι παραλλαγές κλήσης ΤΝ
(sync / async / stream) που εισήχθησαν διαδοχικά στις v1.5.0
και v1.6.0· τα υπόλοιπα παρέμειναν αναλλοίωτα από την v0.2.0.

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

Μορφή επιστροφής:

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

Μορφή εισόδου `answers`:

```python
[
  {"question_id": "q01", "answer_ids": ["a", "b"]},  # multi
  {"question_id": "q02", "answer_id": "c"},          # single
  ...
]
```

Επιστροφή: `dict[method, float]` με τα έξι κλειδιά μεθόδων.

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

Επιστροφή: συμβολοσειρά έτοιμη να σταλεί ως μήνυμα ρόλου `system`.
Η υλοποίηση του session plugin διαβάζει από το 42-κελιακό
λεξικό `_PROMPTS` και προσαρτά ένα μπλοκ πλαισίου.

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

Κάθε plugin παρόχου ελέγχει το πρόθεμα του `model`
(`claude-*`, `gpt-*`, `gemini-*`) και επιστρέφει το κείμενο
του assistant αν κατέχει το μοντέλο. Τα μη-αντιστοιχούμενα
plugins επιστρέφουν None, επιτρέποντας στο firstresult να
προχωρήσει στο επόμενο.

Μορφή `messages` (στυλ OpenAI):

```python
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."},
  {"role": "user", "content": "..."},
]
```

Τα plugins παρόχων κανονικοποιούν αυτή τη μορφή στο δικό τους API
(το Anthropic εξάγει το `system` ξεχωριστά· το Gemini το
ενσωματώνει).

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

Το βοηθητικό του orchestrator `call_ai_complete_async` προτιμά
αυτό το hook· υποβαθμίζεται στο `ai_complete` τυλιγμένο σε
`asyncio.to_thread` όταν δεν έχει υλοποιηθεί.

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

Μορφή επιστροφής:

```python
{
  "recommended": True,
  "to_method": "dialogic",
  "reason": "Three sessions of stagnant understanding.",
  "confidence": 0.75,  # optional
}
```

Επιστρέφει `None` (ή `{"recommended": False}`) όταν δεν ενδείκνυται
αλλαγή.

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

Τα σφάλματα σε αυτό το hook ΔΕΝ ΠΡΕΠΕΙ να διαδίδονται — το
περιτύλιγμα `_fire_on_session_complete` στο
`backend/app/main.py` τα συλλαμβάνει και τα καταγράφει.

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

Κάθε plugin επιστρέφει ένα dict κλειδωμένο σε μοναδικό namespace.
Το tracking plugin επιστρέφει `{"tracking": {...}, "step_evaluation": {...}}`.
Ένα μελλοντικό plugin ανίχνευσης στασιμότητας θα μπορούσε να
επιστρέφει `{"stagnation": {...}}` κ.λπ.

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

Μορφή επιστροφής:

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

## firstresult έναντι λειτουργίας list

| Hookspec | Λειτουργία | Γιατί |
|---|---|---|
| get_assessment_questions | list (ουσιαστικά firstresult) | Προς το παρόν ένα πακέτο· στο μέλλον θα μπορούσαν να καταχωρηθούν ονομαστά πακέτα |
| calculate_profile | firstresult | Ακριβώς ένας αλγόριθμος |
| create_session_prompt | firstresult | Ακριβώς ένας συντάκτης prompt |
| ai_complete | firstresult | Ο αντιστοιχούμενος πάροχος κατέχει την κλήση |
| recommend_method_switch | list | Πολλά plugins μπορούν να προτείνουν |
| on_session_complete | list | Οι παρενέργειες εξαπλώνονται |
| get_progress_summary | list | Τα τμήματα namespace συγχωνεύονται |
| get_tool_recommendations | list (ουσιαστικά firstresult) | Προς το παρόν μία πηγή |

Οι λειτουργίες `list` που συμπεριφέρονται επί του παρόντος ως
firstresult είναι σκόπιμες: το συμβόλαιο είναι ανοιχτό σε
επέκταση πολλών plugins αλλά η υλοποίηση v0.7.0 χρησιμοποιεί
μόνο την πρώτη.
