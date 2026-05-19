# KI-Integration

AdaptiveLearner fährt jede Lern-Konversation durch zwei KI-
Aufrufe pro Roundtrip — einen für die Antwort, einen für den
Schritt-Bewerter. Drei Anbieter sind out-of-the-box dabei;
neue Anbieter klinken sich über den `ai_complete`-Hook ein.

## Der ai_complete-Hook

```python
# backend/app/hookspecs.py
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """Liefert den Assistant-Text oder None, wenn dieses Plugin ``model`` nicht behandelt."""
```

`firstresult=True` heißt: pluggy stoppt beim ersten Nicht-None-
Return. Jedes Anbieter-Plugin prüft den `model`-Präfix und
liefert den Text, wenn ihm das Modell gehört:

```python
@hookimpl
def ai_complete(
    self, messages, model, api_key, max_tokens
) -> str | None:
    if not model.startswith("claude-"):
        return None
    # ... Anthropic-API aufrufen, Text zurückgeben ...
```

Drei Plugins gehören zum Standardumfang: `ai-anthropic`
(claude-*), `ai-openai` (gpt-*), `ai-gemini` (gemini-*).

## Anbieter-Auswahl-Logik

Die Funktion `_resolve_active_key()` der Session-Route sucht:

1. Den `UserSettings.active_provider` des Users (`anthropic` /
   `openai` / `gemini`).
2. Das passende `api_key_<provider>`-Feld in `UserSettings`
   (beim Lesen mit Fernet entschlüsselt).
3. Das passende `model_override_<provider>`-Feld (oder
   Fallback auf `DEFAULT_MODELS[provider]`).

Dann feuert sie `ai_complete` mit diesen Werten. Das Plugin
des passenden Anbieters liefert den Text; die anderen liefern
None (firstresult stoppt beim ersten Treffer).

## Dual-Prompt-Architektur

Jeder `POST /api/plugins/session/{id}/message` für eine
`user`-Rolle macht **zwei** KI-Aufrufe:

1. **Lernantwort** — nutzt den System-Prompt, den
   `build_prompt(project, profile, method, cycle_step, lang)`
   aus der 42-Zellen-Matrix komponiert. `max_tokens=1024`.
2. **Schritt-Bewerter** — nutzt einen separaten System-Prompt
   (`EVALUATION_SYSTEM_PROMPT`), der die KI bittet, den
   Austausch zu lesen und ein JSON-Urteil zu emittieren
   (`advance`, `confidence`, `reason`, `suggested_step`).
   `max_tokens=256`.

Beide Aufrufe nutzen denselben Anbieter + Key. Das Urteil des
Bewerters treibt den `cycle_step`-Vorschub. Wenn der Bewerter
unparsbares JSON liefert, springt der deterministische
+1-Fallback (gedeckelt auf 7) und `fallback_used=True` wird
für Audits vermerkt.

## Die 42-Zellen-Prompt-Matrix

`plugins/adaptive-learner-plugin-session/adaptive_learner_session/prompts.py`
hält ein `dict[method, dict[step, dict[lang, str]]]` — sechs
Methoden, sieben Schritte, zwei Sprachen, 84 Zellen. Jede
Zelle ist 1-2 Sätze, die die Rolle der KI und die Aufgabe des
Schritts setzen. Ein Kontextblock ("Lernprojekt: 'X' | Ziel:
'Y'. Profil-Hinweis: …") wird beim Komponieren angehängt.

Für den Dexie-Modus werden die Prompts wortgetreu nach
`frontend/src/data/session-prompts.json` exportiert und von
`frontend/src/storage/prompts.ts` geladen. Gleicher Text,
gleicher Kontextblock — kein Drift möglich.

## Neuen Anbieter hinzufügen

1. `plugins/adaptive-learner-plugin-ai-newprovider/` anlegen.
2. `ai_complete`-Hookimpl umsetzen: Modell-Präfix prüfen,
   HTTP-API des Anbieters rufen, Text zurückgeben.
3. Anbieter-Präfix in `DEFAULT_MODELS` in
   `ai_orchestration.py` mit billigem Default eintragen.
4. Anbieter-Name in `AIProvider`-Enum in
   `app/schemas/__init__.py` ergänzen.
5. In `AI_PROVIDERS` in `frontend/src/lib/constants.ts`
   eintragen.
6. Für Dexie-Parität: Client zu
   `frontend/src/storage/ai-providers.ts` hinzufügen und aus
   `aiComplete()` dorthin routen.

Jedes Anbieter-Plugin testet seinen Hookimpl + HTTP-Aufruf
isoliert — siehe `plugins/adaptive-learner-plugin-ai-anthropic/tests/`
als Vorlage (der HTTP-Aufruf wird gemockt).

## Browser-Direkt-Aufrufe (Dexie-Modus)

Im Dexie-Modus geht der KI-Aufruf nicht durch das Plugin-
System. `storage/ai-providers.ts` macht den HTTP-Request
direkt. Anthropic erfordert den
`anthropic-dangerous-direct-browser-access: true`-Header zur
CORS-Freigabe; OpenAI und Gemini akzeptieren direkte Browser-
Aufrufe standardmäßig.

Die Dual-Prompt-Logik ist in beiden Modi identisch —
`storage/session-flow.ts` ruft `aiComplete()` zweimal und
parst das Evaluator-JSON genau wie das Backend.

## Konfidenz-Schwellenwert

`session.step_evaluation.confidence_threshold` in
`backend/config/app.yaml` (Standard 0.6) bestimmt, ob ein
echtes (Nicht-Fallback-)Bewerter-Urteil den Zyklus-Schritt
verschiebt. Höher = konservativer, niedriger = forscher.
Fallback-Urteile (Parse-Fehler) wenden den +1-Advance immer
an, unabhängig vom Schwellwert.

Der Dexie-Port spiegelt das mit einem hartkodierten 0.6 in
`storage/session-flow.ts`. Eine spätere Phase wird das in die
Einstellungen-UI heben.
