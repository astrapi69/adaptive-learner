# Plugin-Endpoints

Jede Plugin-Route mountet unter `/api/plugins/{plugin-name}/`.

## Assessment-Plugin

```
GET /api/plugins/assessment/questions?lang=de
```

Liefert das 12-Fragen-Pack mit `text` aufgelöst in der
angefragten Sprache. Jede Antwort trägt die per-Methode-
Gewichte.

```json
[
  {
    "id": "q01",
    "type": "multi",
    "text": "Wie gehst du an ein neues Thema heran?",
    "answers": [
      {
        "id": "a",
        "text": "Ich lese erst die Regeln und Theorie.",
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

Sowohl Einfachauswahl (`answer_id: string`) als auch
Mehrfachauswahl (`answer_ids: string[]`) werden akzeptiert.
Liefert das erzeugte LearningProfile:

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

Liefert das aktuellste LearningProfile für das Projekt.

## Session-Plugin

```
POST /api/plugins/session/start
```

Body:

```json
{
  "project_id": "p1",
  "method": "deductive",
  "cycle_step": 1,
  "lang": "de"
}
```

`method`, `cycle_step`, `lang` sind optional. Liefert die
erzeugte Session + den komponierten System-Prompt:

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
  "system_prompt": "Du bist ein deduktiver Lernbegleiter. ..."
}
```

```
POST /api/plugins/session/{session_id}/message
```

Body:

```json
{"role": "user", "content": "Ich würde gerne mit dem Präsens anfangen."}
```

Der Server speichert die User-Nachricht, feuert
`ai_complete`, persistiert die Assistant-Antwort, lässt den
Schritt-Bewerter laufen und liefert das Composite:

```json
{
  "user_message": {"id": "m1", "session_id": "s1", "role": "user", "content": "...", "created_at": "..."},
  "assistant_message": {"id": "m2", "session_id": "s1", "role": "assistant", "content": "...", "created_at": "..."},
  "ai_error": null,
  "session": {"...": "Session-Zeile nach cycle_step-Update"},
  "step_evaluation": {
    "advance": true,
    "confidence": 0.85,
    "reason": "Lerner hat den Input klar erfasst.",
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
  "notes": "Hat sich produktiv angefühlt."
}
```

Persistiert eine SessionRating-Zeile. Liefert die Zeile zurück.

```
POST /api/plugins/session/{session_id}/end
```

Beendet die Session. Feuert `on_session_complete` (Tracking-
Plugin schreibt einen ProgressCommit). Liefert:

```json
{"session": {"...": "die Session mit status='completed' und ended_at gesetzt"}}
```

```
GET /api/plugins/session/switch-recommendation/{session_id}
```

Liefert:

```json
{"recommended": false, "to_method": null, "reason": null}
```

Oder, wenn Stagnation erkannt wird:

```json
{"recommended": true, "to_method": "dialogic", "reason": "Drei Sessions flaches Verständnis + hoher Stress."}
```

```
POST /api/plugins/session/{session_id}/switch
```

Body:

```json
{"to_method": "dialogic", "reason": "Hat sich richtig angefühlt."}
```

Aktualisiert `session.method`, schreibt eine MethodSwitch-
Audit-Zeile, liefert die aktualisierte Session.

## Tracking-Plugin

```
GET /api/plugins/tracking/progress/{project_id}
```

Liefert die namespaced Summary; der `tracking`-Slice trägt
die Aggregator-Ausgabe:

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

Liefert alle ProgressCommit-Zeilen des Projekts,
chronologisch.

## Tools-Plugin

```
GET /api/plugins/tools/recommendations/{project_id}?lang=de
```

Liefert die 5 Katalog-Tools nach Relevanz zum Profil:

```json
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "Spaced-Repetition-Karteikarten - ideal um Regeln und Fehlerkorrekturen langfristig zu festigen.",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

```
GET /api/plugins/tools/spaced/{project_id}?lang=de
```

Liefert Spaced-Repetition-Aktionskarten, getrieben durch
Recency:

```json
[
  {
    "id": "sr-deductive-first",
    "method": "deductive",
    "interval_days": 1,
    "action": "session",
    "title": "Erste Übung in Deduktion.",
    "urgency": 0.5
  },
  ...
]
```

## Plugin-Discovery

```
GET /api/plugins/manifests
GET /api/plugins/health
GET /api/plugins/errors
```

Jede liefert eine Map, gekeyt auf Plugin-Namen. Genutzt von
der Settings > Plugins-UI (in v0.7.0 aufgeschoben).
