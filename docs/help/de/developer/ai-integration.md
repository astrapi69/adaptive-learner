# KI-Integration

Adaptive Learner fährt jede Lern-Konversation durch bis zu
**drei** KI-Aufrufe pro Roundtrip - die gestreamte Antwort, den
Schritt-Bewerter und (bei Schritt 7) den
Themen-Übergangs-Bewerter. Drei Anbieter sind out-of-the-box
dabei; neue Anbieter klinken sich über die `ai_complete*`-Hook-
Familie ein.

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

## Async- + Streaming-Varianten

```python
@hookspec(firstresult=True)
async def ai_complete_async(messages, model, api_key, max_tokens) -> str:
    """Awaitable; gleiche Form wie ai_complete. v1.5.0+."""

@hookspec(firstresult=True)
def ai_complete_stream(messages, model, api_key, max_tokens):
    """Liefert einen Async-Iterator von Text-Deltas. v1.6.0+."""
```

`ai_complete_async` wird von der Session-Route an der Zyklus-
Grenze Schritt 6→7 genutzt, damit Schritt-Bewertung und
Themen-Übergang gleichzeitig über `asyncio.gather` feuern
(`async_evaluation: true` in `app.yaml`).

`ai_complete_stream` treibt den Streaming-SSE-Endpunkt
`POST /api/plugins/session/{id}/message/stream`, der
`start` / `chunk` / `done`-Events emittiert.

## Anbieter-Auswahl-Logik (v1.20.0)

Die `_resolve_active_key()` der Session-Route ruft
`services/settings.resolve_api_key(db, user_id, provider)` auf,
das die Drei-Schichten-Kette durchläuft:

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`-Umgebungsvariable.
2. `ai.<provider>.api_key` in
   `~/.config/adaptive_learner/secrets.yaml`.
3. Fernet-entschlüsseltes `UserSettings.api_key_<provider>`.
4. `None` - der Aufruf reicht `ai_error` an die UI durch.

`resolve_default_model(db, user_id, provider)` durchläuft
dieselbe Kette für das Modell-Override (env > yaml > UI-Override >
`DEFAULT_MODELS[provider]`).

Dann feuert `ai_complete*` mit den aufgelösten Werten. Das Plugin
des passenden Anbieters liefert den Text; die anderen liefern
None (firstresult stoppt beim ersten Treffer).

## Dual-Prompt-Architektur (v0.5.0) + Auto-Loop (v1.4.0)

Jeder `POST /api/plugins/session/{id}/message` für eine
`user`-Rolle macht bis zu drei KI-Aufrufe:

1. **Lernantwort** - gestreamt über `ai_complete_stream`. Der
   System-Prompt wird von `build_prompt(project, profile, method,
   cycle_step, lang)` aus der 42-Zellen-Matrix komponiert, mit
   einer explizit angehängten "antworte in der Sprache des
   Lernenden"-Direktive (`build_language_directive(lang)`, #827 -
   siehe unten). `max_tokens=1024`. SSE emittiert
   `start` / `chunk` / `done`-Events.
2. **Schritt-Bewerter** - separater System-Prompt
   (`EVALUATION_SYSTEM_PROMPT`), der die KI bittet, den Austausch
   zu lesen und ein JSON-Urteil zu emittieren (`advance`,
   `confidence`, `reason`, `suggested_step`). `max_tokens=256`.
   Das Urteil des Bewerters treibt den `cycle_step`-Vorschub
   (gedeckelt durch `confidence ≥ 0.6`).
3. **Themen-Übergang** - nur bei Schritt 7. Ein dritter KI-Aufruf
   beurteilt, ob das Thema integriert wurde und ob ein neuer
   Zyklus auf einem neuen Unterthema starten soll. Deckel von
   `max_cycles=5` pro Session.

Wenn der Bewerter unparsbares JSON liefert, springt der
deterministische +1-Fallback (gedeckelt auf 7) und
`fallback_used=True` wird vermerkt.

Die Zyklus-Grenze (Schritt 6 → 7) feuert Schritt-Bewertung +
Themen-Übergang gleichzeitig über `asyncio.gather` (spart ~T₂ an
Latenz). Im `timings`-Block der Message-Antwort zurückgegeben
(`learning_ms`, `evaluation_ms`, `topic_transition_ms`,
`total_ms`, `parallel_saved_ms`).

## Die 42-Zellen-Prompt-Matrix

`plugins/adaptive-learner-plugin-session/adaptive_learner_session/prompts.py`
hält ein `dict[method, dict[step, dict[lang, str]]]` - sechs
Methoden, sieben Schritte, zwei Sprachen, 84 Zellen. Jede
Zelle ist 1-2 Sätze, die die Rolle der KI und die Aufgabe des
Schritts setzen. Ein Kontextblock ("Lernprojekt: 'X' | Ziel:
'Y'. Profil-Hinweis: …") wird beim Komponieren angehängt.

Für den Dexie-Modus werden die Prompts wortgetreu nach
`frontend/src/data/session-prompts.json` exportiert und von
`frontend/src/storage/ai/prompts.ts` geladen. Gleicher Text,
gleicher Kontextblock - kein Drift möglich.

## Ausgabesprachen-Direktive (#827)

Die 42-Zellen-Matrix ist nur in zwei Sprachen (de / en)
geschrieben, daher würde ein Lernender mit einer der anderen
UI-Sprachen einen englischen Prompt bekommen und englisch
beantwortet werden. Dagegen wird eine explizite "antworte in der
Sprache des Lernenden"-Anweisung an den komponierten System-
Prompt angehängt. Sie benennt die Sprache des Lernenden
(englischer Name + Endonym), damit die KI in ihr antwortet,
unabhängig davon, in welcher Sprache der Prompt selbst
geschrieben ist - über alle **11** UI-Sprachen.

Das Backend baut sie in
`plugins/adaptive-learner-plugin-session/.../prompts.py`
(`LANGUAGE_NAMES` + `build_language_directive(lang)`); der Dexie-
Port ist byte-identisch in
`frontend/src/storage/ai/prompts.ts`
(`buildLanguageDirective(lang)`), damit die zwei Modi nie
auseinanderlaufen.

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
   `frontend/src/storage/ai/ai-providers.ts` hinzufügen und aus
   `aiComplete()` dorthin routen.

Jedes Anbieter-Plugin testet seinen Hookimpl + HTTP-Aufruf
isoliert - siehe `plugins/adaptive-learner-plugin-ai-anthropic/tests/`
als Vorlage (der HTTP-Aufruf wird gemockt).

## Browser-Direkt-Aufrufe (Dexie-Modus)

Im Dexie-Modus geht der KI-Aufruf nicht durch das Plugin-
System. `storage/ai/ai-providers.ts` macht den HTTP-Request
direkt. Anthropic erfordert den
`anthropic-dangerous-direct-browser-access: true`-Header zur
CORS-Freigabe; OpenAI und Gemini akzeptieren direkte Browser-
Aufrufe standardmäßig.

Die Dual-Prompt-Logik ist in beiden Modi identisch -
`storage/ai/session-flow.ts` ruft `aiComplete()` zweimal und
parst das Evaluator-JSON genau wie das Backend. Jedes
browser-direkte KI-Feature liegt unter `frontend/src/lib/ai/`
(die reinen Engines) und `frontend/src/storage/ai/` (die
Anbieter-Clients), damit das GitHub-Pages-Deployment die
gesamte KI-Oberfläche ohne Backend ausführt.

## Konfidenz-Schwellenwert

`session.step_evaluation.confidence_threshold` in
`backend/config/app.yaml` (Standard 0.6) bestimmt, ob ein
echtes (Nicht-Fallback-)Bewerter-Urteil den Zyklus-Schritt
verschiebt. Höher = konservativer, niedriger = forscher.
Fallback-Urteile (Parse-Fehler) wenden den +1-Advance immer
an, unabhängig vom Schwellwert.

Der Dexie-Port spiegelt das mit einem hartkodierten 0.6 in
`storage/ai/session-flow.ts`. Eine spätere Phase wird das in die
Einstellungen-UI heben.

## KI-Übungsgenerierungs-Pipeline (EXP-036 / AIX-01..06)

Eine reine Theorie-Lektion kann Übungen von der KI verfasst
bekommen. Die Pipeline ist `generate -> quality-gate -> balance
-> feedback`, alles unter `frontend/src/lib/ai/`. Die Engines
sind library-grade (keine App-State-Imports) und nehmen einen
Provider-SEAM, damit der Dexie-Pfad (browser-direkt) und der
API-Pfad ihre eigene Completion-Funktion injizieren:

1. **Generieren (AIX-01)** -
   `exercise-generation-prompt.ts` baut den Prompt aus den
   Theorie-Schritten der Lektion; `generate-exercises.ts` ruft
   die KI und `exercise-generation-parser.ts` parst die Antwort
   defensiv in strukturell gültige Karten (toleriert
   Code-Fences und Vorspann-Prosa).
2. **Quality-Gate (AIX-03)** -
   `exercise-quality-gate.ts` ist ein deterministischer (KI-
   freier) Filter: er verwirft Duplikate, Ein-Zeichen-Antworten,
   einen Distraktor gleich der richtigen Antwort, eine
   Matching-Karte mit weniger als drei Paaren usw. und markiert
   weiche Probleme als Warnungen.
3. **Balancieren (AIX-04)** -
   `exercise-distribution.ts` ordnet die Karten um (löscht nie),
   damit kein einzelner Übungstyp vorne überrepräsentiert ist und
   derselbe Typ nicht dreimal in Folge auftaucht, solange ein
   anderer Typ verfügbar ist. `distributionGaps()` meldet
   abwesende Typen, damit ein Regenerierungs-Prompt sie erwähnen
   kann.
4. **Mit Feedback regenerieren (AIX-05)** - das Feedback des
   Nutzers fließt für einen weiteren Durchlauf in den Prompt
   zurück.

Ein **"Übungen generieren"-Button** erscheint auf reinen
Theorie-Lektionen (AIX-02), und die **Batch-Generierung
(AIX-06)** fährt die Pro-Lektion-Pipeline sequenziell über jede
reine Theorie-Lektion eines Sets
(`generate-exercises-for-set.ts` + `set-batch-deps.ts`):
sequenziell aus Token-Budget- + Rate-Limit-Gründen, mit
Fortschrittsmeldung, eine fehlerhafte Lektion überspringend und
ein `AbortSignal` beachtend (bereits generierte Lektionen
bleiben erhalten).

## KI-Inhaltsvalidierung (EXP-033)

Set-weite KI-Qualitätsprüfungen für verfasste Inhalte. Der
Nutzer wählt Anbieter + Modell und fährt einen **"Mit KI
prüfen"**-Bericht:

- `content-validator.ts` baut einen **gebündelten** Prompt
  (`VALIDATION_BATCH_SIZE` Karten pro Aufruf) und parst die
  JSON-Antwort; `validation-runner.ts` orchestriert die Bündel
  und aggregiert die Pro-Karte-Ergebnisse hinter demselben
  Provider-Seam. Kostenschranken deckeln die Karten pro Lauf, und
  die Aufrufstelle erzwingt ein Rate-Limit.
- Der Bericht wird in IndexedDB gecacht und ist nach Markdown
  exportierbar (`validation-markdown.ts`), mit einer "Geprüft
  mit: <Anbieter> <Modell>"-Provenienz-Zeile
  (`validation-provenance.ts`).
- Ein **Content-Hash + Signatur** (`content-hash.ts`,
  `validation-signature.ts`) untermauert ein **"KI-geprüft"-
  Abzeichen**, damit ein Set, dessen Inhalt sich nach der Prüfung
  geändert hat, nicht mehr als validiert angezeigt wird.

## Konfigurierte-Anbieter-Übersicht + Pro-Anbieter-Test (#810)

Der Einstellungen-KI-Tab zeigt eine `ConfiguredProvidersTable` -
eine Zeile pro Anbieter mit seinem Modell, einer **maskierten
Key-Vorschau** (erste 4 + Auslassung + letzte 4 über
`lib/providers/maskSecret.ts`), dem Aktiv-Anbieter-Radio und
einem **Pro-Anbieter-Test-Button**. Der Test trifft den
**Modell-Listen**-Endpunkt des Anbieters (OpenAI `/v1/models`,
Gemini `/v1beta/models`, Anthropic `/v1/models`), **nicht** einen
Generierungs-Aufruf, damit ein erfolgreicher Test nichts kostet
(#800).

Die maskierte Vorschau wird auf der Settings-Payload geliefert
(`key_preview_<provider>`): serverseitig im API-Modus,
clientseitig im Dexie-Modus berechnet, damit die Übersicht in
beiden Modi funktioniert.

Die Modellauswahl gruppiert die Live-Modell-Liste in
**Empfohlen** + **Alle Modelle**
(`lib/ai/model-recommendations.ts`): eine kleine statische Liste
empfohlener Modell-FAMILIEN (als id-Präfixe gematcht, die
neueste-datierte Variante gewinnt) zieht für jeden Anbieter
dieselben 2-3 guten Modelle nach oben. Die Live-Liste wird über
denselben Modell-Listen-Endpunkt entdeckt
(`storage/ai/model-discovery.ts` im Dexie-Modus;
`backend/app/services/model_discovery.py` im API-Modus), mit
einem Pro-Tab-sessionStorage-Cache.

## Feature-Gating (aktiv / deaktiviert / versteckt)

KI-Features werden über ein zentrales Registry
(`frontend/src/features/featureConfig.ts`) und den
`useFeatureAvailable`-Hook (`features/useFeatureAvailable.ts`)
gegated, aufgelöst aus einem memoisierten `{mode, hasAiKey}`-
Kontext. Jedes KI-gestützte Feature (Session-Start/-Wiederaufnahme,
Konversationsanalyse, Anki-Extraktion, NotebookLM-Fragen/-Leitfaden,
KI-Lektionsgenerierung, Aussprache) ist in `NEEDS_AI_KEY`: es
zeigt sich als **aktiv** mit nutzbarem Key, **deaktiviert**
(Grund `api_key_required`) ohne einen, nie still **versteckt** -
gemäß der sichtbar-aber-deaktiviert-Feature-State-Policy (#335).

## Weitere KI-Oberflächen (Nur-Lese-Zusammenfassung)

Mehrere Nicht-Session-Features nutzen dieselben KI-Anbieter-
Plugins über `ai_complete*`:

- **Konversationsanalysator** (Phase 12 / v0.9.0+) -
  `frontend/src/chat_import/analysis.ts` zerteilt importierte
  Transkripte bei 16K Zeichen mit 2-Nachrichten-Überlappung,
  feuert `ai_complete` pro Chunk, merged die Ergebnisse.
  Extrahiert topic / weaknesses / error_patterns /
  recommended_method / vocabulary (seit v1.20.0). Toleranter
  JSON-Parser fängt Haiku-Klasse-Fehlverhalten ab (Fenced-
  Output, Vorspann-Prosa).
- **Anki-Extraktion** (Phase 30 / v1.17.0) - `plugins/.../
  anki/card_extraction.py` extrahiert Flashcard-Kandidaten aus
  einer Session oder Konversation; der Vokabel-Pfad läuft
  clientseitig ohne KI, wenn `analysis_result.vocabulary`
  befüllt ist.
- **NotebookLM-Lernfragen + Leitfaden** (Phase 32 /
  v1.19.0) - `plugins/.../notebooklm/question_generator.py`
  + `study_guide.py`; toleranter JSON-Parser; nutzer-editierte
  Fragen überspringen die Re-Generierung.
- **Aussprache-Bewerter** (Phase 31 / v1.18.0) -
  `plugins/.../pronunciation.py` generiert Zielphrasen
  + bewertet die Audio-Ähnlichkeit des Lernenden (Eignung
  gegated durch die Sprachen-Subject-Taxonomie).
