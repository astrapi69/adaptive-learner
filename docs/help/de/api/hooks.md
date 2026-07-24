# Hook-Spezifikationen

Die 10 Hookspecs leben in `backend/app/hookspecs.py`. Drei
davon sind KI-Aufruf-Varianten (sync / async / stream), die
über v1.5.0 und v1.6.0 schrittweise dazukamen; der Rest ist
seit v0.2.0 unverändert. Jede Hookspec definiert den
Aufruf-Vertrag; Plugins implementieren sie mit `@hookimpl`.

## get_assessment_questions

```python
@hookspec
def get_assessment_questions(lang: str) -> list[dict] | None:
    """Fragepack für die angefragte Sprache zurückgeben.

    Implementiert von: assessment-Plugin.
    Modus: Liste (nicht firstresult). Die Route nutzt
    aktuell das Ergebnis des ersten Plugins; ein zukünftiges
    "mehrere Frage-Packs"-Feature könnte Anbieter benannte
    Packs registrieren lassen.
    """
```

Return-Form:

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
    """Rohantworten zu einem 6-Methoden-Profil aggregieren.

    Implementiert von: assessment-Plugin.
    firstresult: genau ein Plugin berechnet das Profil.
    """
```

Input-`answers`-Form:

```python
[
  {"question_id": "q01", "answer_ids": ["a", "b"]},  # multi
  {"question_id": "q02", "answer_id": "c"},          # single
  ...
]
```

Return: `dict[method, float]` mit den sechs Methoden-Keys.

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
    """System-Prompt für eine (Methode, Schritt, Sprache)-Zelle.

    Implementiert von: session-Plugin.
    firstresult: genau ein Plugin komponiert den Prompt.
    """
```

Return: ein String, bereit als `system`-Rolle-Nachricht
gesendet zu werden. Die Implementierung des Session-Plugins
liest aus dem 42-Zellen-`_PROMPTS`-Dict und hängt einen
Kontextblock an.

## ai_complete

```python
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """KI-Anbieter aufrufen, Assistant-Text zurückgeben.

    Implementiert von: ai-anthropic, ai-openai, ai-gemini.
    firstresult: das Plugin des passenden Anbieters liefert
    den Text; andere liefern None.
    """
```

Jedes Anbieter-Plugin prüft den `model`-Präfix
(`claude-*`, `gpt-*`, `gemini-*`) und liefert den Assistant-
Text, wenn ihm das Modell gehört. Nicht-passende Plugins
liefern None, sodass firstresult zum nächsten durchfällt.

`messages`-Form (OpenAI-Stil):

```python
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."},
  {"role": "user", "content": "..."},
]
```

Anbieter-Plugins normalisieren diese Form zu ihrer eigenen API
(Anthropic trennt `system` raus; Gemini faltet es ein).

## recommend_method_switch

```python
@hookspec
def recommend_method_switch(
    history: list[dict],
    profile: dict,
) -> dict | None:
    """Switch-Empfehlung zurück oder None.

    Implementiert von: session-Plugin.
    Modus: Liste. Plugins liefern einzelne Empfehlungen; ein
    zukünftiger Arbiter wählt die höchste-Konfidenz-Nicht-
    None.
    """
```

Return-Form:

```python
{
  "recommended": True,
  "to_method": "dialogic",
  "reason": "Drei Sessions stagnierendes Verständnis.",
  "confidence": 0.75,  # optional
}
```

`None` (oder `{"recommended": False}`) zurückgeben, wenn kein
Wechsel angezeigt ist.

## on_session_complete

```python
@hookspec
def on_session_complete(
    session: dict,
    rating: dict,
) -> None:
    """Seiteneffekt-Hook: feuert beim Session-Ende.

    Implementiert von: tracking-Plugin (schreibt einen
    ProgressCommit).
    Modus: Liste. Jeder Subscriber läuft; Fehler werden
    gefangen und geloggt, rollen aber das Session-End nicht
    zurück.
    """
```

Fehler in diesem Hook DÜRFEN NICHT propagieren - der
`_fire_on_session_complete`-Wrapper in
`backend/app/main.py` fängt und loggt sie.

## get_progress_summary

```python
@hookspec
def get_progress_summary(
    project_id: str,
    db: Session,
) -> dict | None:
    """Eine Namespace-Slice der Fortschritts-Summary zurück.

    Implementiert von: tracking-Plugin (liefert die "tracking"-
    Namespace-Slice).
    Modus: Liste. Slices werden in der Route shallow-merged.
    """
```

Jedes Plugin liefert ein Dict, gekeyt auf einen eindeutigen
Namespace. Das Tracking-Plugin liefert
`{"tracking": {...}, "step_evaluation": {...}}`. Ein
zukünftiges Stagnations-Detektor-Plugin könnte
`{"stagnation": {...}}` liefern usw.

## get_tool_recommendations

```python
@hookspec
def get_tool_recommendations(
    profile: dict,
    lang: str,
    limit: int = 5,
) -> list[dict] | None:
    """Gerankte externe Tool-Empfehlungen zurück.

    Implementiert von: tools-Plugin.
    Modus: Liste. Die Route nutzt aktuell das Ergebnis des
    ersten Plugins; ein zukünftiger Multi-Source-Recommender
    könnte mergen.
    """
```

Return-Form:

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

## firstresult vs Listen-Modus

| Hookspec | Modus | Warum |
|---|---|---|
| get_assessment_questions | Liste (effektiv firstresult) | Aktuell ein Pack; künftig benannte Packs |
| calculate_profile | firstresult | Genau ein Algorithmus |
| create_session_prompt | firstresult | Genau ein Prompt-Komponist |
| ai_complete | firstresult | Der passende Anbieter besitzt den Aufruf |
| recommend_method_switch | Liste | Mehrere Plugins können vorschlagen |
| on_session_complete | Liste | Seiteneffekte fächern auf |
| get_progress_summary | Liste | Namespace-Slices mergen |
| get_tool_recommendations | Liste (effektiv firstresult) | Aktuell eine Quelle |

Die `Liste`-Modi, die sich aktuell wie firstresult verhalten,
sind bewusst so: der Vertrag ist offen für Multi-Plugin-
Erweiterung, aber die v0.7.0-Implementierung nutzt nur das
erste.
