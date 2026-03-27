# AdaptivLearner - Konzeptdokument

**Repository:** https://github.com/astrapi69/adaptivlearner
**Verwandtes Projekt:** [PluginForge](https://github.com/astrapi69/pluginforge)
**Artikelserie:** [Von Theorie zur Praxis](https://asterios-raptis.medium.com/) (Lern-Artikel)
**Version:** 0.1.0 (geplant)
**Stand:** 2026-03-27

---

## 1. Ziel

AdaptivLearner ist ein adaptives Lernsystem, das auf den Erkenntnissen der Artikelserie "Von Theorie zur Praxis" basiert. Es ist die zweite Anwendung die auf PluginForge aufbaut (nach Bibliogon).

Kernthese aus der Serie: Die beste Lernmethode ist keine feste Methode, sondern die Faehigkeit, zwischen Methoden zu wechseln. Das System lernt, wie der Nutzer lernt, und passt sich an.

Langfristiges Ziel: Kommerzielles SaaS-Produkt. Core bleibt Open Source (MIT), Premium-Plugins kostenpflichtig.

---

## 2. Fachliches Modell (aus der Artikelserie)

### 2.1 Sechs Lernmethoden (Artikel 1)

| Methode | Beschreibung | Staerke |
|---------|-------------|---------|
| Deduktiv | Regel lernen, dann anwenden | Klar strukturierte Regelsysteme |
| Induktiv | Anwenden, dann Regel ableiten | Wenn Intuition wichtiger als Praezision |
| Fehlerzentriert | Bewusst Fehler provozieren, dann korrigieren | Themen mit Teilwissen |
| Dialogisch | Gespraeche mit sofortiger Rueckmeldung | Hoher Stress, Motivationsaufbau |
| Kontextuell | Lernen in simulierten Alltagssituationen | Transfer in reale Anwendungen |
| KI-adaptiv | System waehlt Methode basierend auf Daten | Wenn Nutzer selbst nicht weiss was passt |

Keine Methode dominiert. Jede hat einen funktionalen Bereich. Das System muss erkennen, wann es die Methode wechseln muss.

### 2.2 Der 7-Schritte-Lernzyklus (Artikel 1)

Jede Lernsession folgt diesem Zyklus:

1. **Input** - Information, Beispiel, Aufgabe
2. **Versuch** - Anwendung ohne Sicherheitsnetz
3. **Fehler** - Abweichung zwischen Erwartung und Ergebnis
4. **Feedback** - Korrektur mit Erklaerung (nicht nur richtig/falsch)
5. **Anpassung** - Methode aendern, Tempo korrigieren, Fokus verschieben
6. **Wiederholung** - Erneuter Versuch unter veraenderten Bedingungen
7. **Integration** - Wissen bleibt, weil es aus Erfahrung entstanden ist

Schritt 5 ist nicht optional. Wer die Anpassung ueberspringt, wiederholt Fehler statt sie zu korrigieren.

### 2.3 Git-Prinzip fuer Lernfortschritt (Artikel 3)

- "Commits" = abgeschlossene Sessions mit Metadaten
- "Branches" = verschiedene Themen oder Methoden-Strecken
- "Diffs" = Veraenderung der Performance zwischen Sessions
- Fehlermuster-Erkennung ueber Zeit
- Versionierter, nachvollziehbarer Lernverlauf

### 2.4 Drei Werkzeug-Bausteine (Artikel 4)

1. **Spaced Repetition** (Anki oder gleichwertig) - Fakten und Vokabeln
2. **Active Recall** (NotebookLM oder gleichwertig) - Verstaendnis mit eigenem Material
3. **Adaptiver KI-Prompt** - Personalisierte Lernsteuerung

---

## 3. Architektur

### 3.1 Schichtenmodell

```
+----------------------------------------------------------+
|  AdaptivLearner App (Frontend: React)                    |
+----------------------------------------------------------+
|  AdaptivLearner App (Backend: FastAPI)                   |
|  - User/Session CRUD                                     |
|  - Lernprofil-Verwaltung                                 |
|  - Session-Orchestrierung                                |
+----------------------------------------------------------+
|  PluginForge (Framework)                                  |
|  +-- pluggy (Hook-Specs + Hook-Impls)                    |
|  +-- YAML-Konfiguration                                  |
|  +-- Plugin-Lifecycle                                    |
|  +-- FastAPI-Router-Integration                          |
+----------------------------------------------------------+
|  Plugins                                                  |
|  +-- plugin-assessment    (Lerntyp-Ermittlung)           |
|  +-- plugin-session       (Lernsessions, 7-Schritte)     |
|  +-- plugin-ai-anthropic  (Claude API)                   |
|  +-- plugin-ai-openai     (GPT API)                      |
|  +-- plugin-ai-gemini     (Gemini API)                   |
|  +-- plugin-tracking      (Fortschritt, Git-Prinzip)     |
|  +-- plugin-tools         (Anki/NotebookLM Empfehlungen) |
+----------------------------------------------------------+
```

### 3.2 Repositories

| Repository | Beschreibung | Lizenz |
|------------|-------------|--------|
| `pluginforge` | Plugin-Framework (Basis) | MIT |
| `adaptivlearner` | Lern-App (dieses Repo) | MIT (Core) |
| `adaptivlearner-plugin-ai-anthropic` | Claude-Provider (spaeter separat) | MIT |
| `adaptivlearner-plugin-ai-openai` | GPT-Provider (spaeter separat) | MIT |
| `adaptivlearner-plugin-ai-gemini` | Gemini-Provider (spaeter separat) | MIT |

Fuer v0.1.0 liegen alle Plugins im Hauptrepo unter `plugins/`. Auslagerung in separate Pakete ab v0.3.0.

### 3.3 Tech-Stack

| Komponente | Technologie |
|------------|-------------|
| PluginForge | Python 3.11+, pluggy, PyYAML |
| Backend | FastAPI, SQLAlchemy, SQLite (spaeter PostgreSQL) |
| Frontend | React 18, TypeScript, Vite |
| AI-Provider | anthropic SDK, openai SDK, google-generativeai SDK |
| Charts | Recharts (Frontend) |
| Tooling | Poetry, npm, Docker, Make |

---

## 4. Datenmodell

### 4.1 Core-Tabellen (App)

```
User
  id: UUID (PK)
  name: str
  email: str (optional, unique)
  language: str (default "de")  # de, en, es, fr, el
  created_at: datetime
  updated_at: datetime

LearningProject
  id: UUID (PK)
  user_id: UUID (FK -> User)
  topic: str                    # "Python", "Spanisch", "Klavier"
  goal: str                     # "Job", "Pruefung", "Hobby"
  timeframe: str                # "3 Monate"
  daily_minutes: int            # 30
  current_problem: str          # Freitext
  active: bool (default true)
  created_at: datetime
  updated_at: datetime
```

### 4.2 Plugin-Tabellen

**plugin-assessment:**

```
LearningProfile
  id: UUID (PK)
  user_id: UUID (FK -> User)
  project_id: UUID (FK -> LearningProject)
  deductive: float       # 0.0 - 1.0 Gewichtung
  inductive: float
  error_based: float
  dialogic: float
  contextual: float
  ai_adaptive: float
  assessed_at: datetime
  version: int           # Re-Assessment erhoehen Version
```

**plugin-session:**

```
LearningSession
  id: UUID (PK)
  project_id: UUID (FK -> LearningProject)
  method: str            # "deductive", "inductive", etc.
  started_at: datetime
  ended_at: datetime (nullable)
  cycle_step: int        # 1-7, aktueller Schritt im Zyklus
  status: str            # "active", "completed", "abandoned"

SessionMessage
  id: UUID (PK)
  session_id: UUID (FK -> LearningSession)
  role: str              # "user", "assistant", "system"
  content: str
  created_at: datetime

SessionRating
  id: UUID (PK)
  session_id: UUID (FK -> LearningSession)
  understanding: int     # 1-5
  stress: int            # 1-5
  method_fit: int        # 1-5 (wie gut passte die Methode)
  notes: str (optional)
  created_at: datetime
```

**plugin-tracking:**

```
ProgressCommit
  id: UUID (PK)
  project_id: UUID (FK -> LearningProject)
  session_id: UUID (FK -> LearningSession)
  method: str
  understanding: float   # Durchschnitt der Session
  stress: float
  error_rate: float      # Berechnet aus Session-Verlauf
  duration_minutes: int
  committed_at: datetime

MethodSwitch
  id: UUID (PK)
  project_id: UUID (FK -> LearningProject)
  from_method: str
  to_method: str
  reason: str            # "stagnation", "high_stress", "manual", "ai_recommended"
  switched_at: datetime
```

---

## 5. Hook-Specs

Die Anwendung definiert Hooks, Plugins implementieren sie:

```python
from pluginforge import hookspec

class AdaptivLearnerHookSpec:

    # Assessment
    @hookspec
    def get_assessment_questions(self, lang: str) -> list[dict]:
        """Liefert Fragen fuer den Lerntyp-Test."""

    @hookspec
    def calculate_profile(self, answers: list[dict]) -> dict:
        """Berechnet Lernprofil aus Antworten."""

    # Session
    @hookspec(firstresult=True)
    def create_session_prompt(self, project: dict, profile: dict,
                               method: str, step: int, lang: str) -> str:
        """Erstellt den System-Prompt fuer eine Lernsession."""

    @hookspec(firstresult=True)
    def process_message(self, session_id: str, message: str,
                         history: list[dict], provider: str) -> str:
        """Verarbeitet eine Nachricht via KI-Provider."""

    @hookspec
    def recommend_method_switch(self, project_id: str,
                                 current_method: str,
                                 recent_ratings: list[dict]) -> dict | None:
        """Empfiehlt Methodenwechsel basierend auf Performance."""

    # AI Provider
    @hookspec(firstresult=True)
    def ai_complete(self, messages: list[dict], model: str,
                     api_key: str) -> str:
        """Sendet Nachrichten an einen KI-Provider. Erster Treffer gewinnt."""

    # Tracking
    @hookspec
    def on_session_complete(self, session: dict, rating: dict) -> None:
        """Wird nach Abschluss einer Session aufgerufen."""

    @hookspec
    def get_progress_summary(self, project_id: str) -> dict:
        """Liefert Fortschrittszusammenfassung."""

    # Tools
    @hookspec
    def get_tool_recommendations(self, profile: dict, lang: str) -> list[dict]:
        """Empfiehlt Werkzeuge basierend auf Lernprofil."""
```

---

## 6. Plugins im Detail

### 6.1 plugin-assessment

Ermittelt das initiale Lernprofil ueber 12 Fragen. Jede Frage hat 4 Antwortoptionen die verschiedenen Methoden zugeordnet sind. Ergebnis: Gewichtetes Profil (keine starren Labels).

Re-Assessment nach 10 Sessions moeglich, um Profilaenderungen zu tracken.

Alle Fragen und Antworten muessen in allen 5 Sprachen vorliegen (i18n via PluginForge).

### 6.2 plugin-session

Kern des Systems. Orchestriert Lernsessions nach dem 7-Schritte-Zyklus:

1. Waehlt Methode basierend auf Profil (oder manuell vom Nutzer)
2. Generiert System-Prompt passend zur Methode und zum Zyklus-Schritt
3. Leitet Nachrichten an den aktiven AI-Provider weiter
4. Trackt den Fortschritt innerhalb der Session
5. Am Ende: Self-Rating durch den Nutzer
6. Methoden-Switch-Empfehlung wenn Stagnation erkannt

System-Prompt-Strategie pro Methode:

| Methode | Prompt-Kern |
|---------|------------|
| Deduktiv | "Erklaere die Regel zuerst, dann gib Uebungen" |
| Induktiv | "Gib Beispiele, lass den Nutzer die Regel ableiten" |
| Fehlerzentriert | "Provoziere typische Fehler, erklaere dann warum" |
| Dialogisch | "Fuehre ein Gespraech, korrigiere sofort, halte Stress niedrig" |
| Kontextuell | "Simuliere eine Alltagssituation zum Thema" |
| KI-adaptiv | "Waehle die Methode die gerade am besten passt, begruende" |

### 6.3 plugin-ai-anthropic / openai / gemini

Jeder Provider implementiert den `ai_complete`-Hook. Der Nutzer speichert seinen API-Key pro Provider. Der aktive Provider wird in den User-Settings gewaehlt.

```python
# plugin-ai-anthropic
class AnthropicPlugin(BasePlugin):
    name = "ai-anthropic"

    @hookimpl
    def ai_complete(self, messages, model, api_key):
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=model or "claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=messages,
        )
        return response.content[0].text
```

Analoges Pattern fuer OpenAI und Gemini. firstresult=True im Hook-Spec sorgt dafuer, dass nur der aktive Provider antwortet.

Providerauswahl: Der PluginManager aktiviert nur den vom Nutzer gewaehlten AI-Provider. Die anderen bleiben deaktiviert. Wechsel zur Laufzeit moeglich.

### 6.4 plugin-tracking

Erstellt ProgressCommits nach jeder Session. Berechnet:

- Gleitender Durchschnitt Verstaendnis (letzte 5 Sessions)
- Gleitender Durchschnitt Stress
- Fehlerquote-Trend
- Streak (aufeinanderfolgende Tage mit mindestens einer Session)
- Methodenwechsel-Historie

Stagnation-Erkennung: Wenn Verstaendnis-Durchschnitt ueber 3 Sessions nicht steigt UND Stress-Durchschnitt ueber 3 liegt, wird ein Methodenwechsel empfohlen.

### 6.5 plugin-tools

Statische Empfehlungen basierend auf Lernprofil:

- Hoher Deduktiv-Anteil: Anki-Decks mit Regelkarten
- Hoher Induktiv-Anteil: NotebookLM mit eigenen Notizen
- Hoher Fehlerzentriert-Anteil: Fehler-Logbuch fuehren
- Hoher Dialogisch-Anteil: Sprach-Apps, Tandem-Partner
- Hoher Kontextuell-Anteil: Immersion, Podcasts, Alltagsanwendung
- Hoher KI-adaptiv-Anteil: Adaptiver KI-Prompt aus der Serie

---

## 7. API-Endpunkte

### 7.1 Core (App)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| POST | /api/users | Nutzer anlegen |
| GET | /api/users/{id} | Nutzer laden |
| PATCH | /api/users/{id} | Nutzer aktualisieren |
| POST | /api/users/{id}/projects | Lernprojekt anlegen |
| GET | /api/users/{id}/projects | Lernprojekte auflisten |
| PATCH | /api/projects/{id} | Projekt aktualisieren |

### 7.2 Plugin-Routen (via PluginForge mount_routes)

| Methode | Pfad | Plugin | Beschreibung |
|---------|------|--------|-------------|
| GET | /api/plugins/assessment/questions | assessment | Fragen laden |
| POST | /api/plugins/assessment/evaluate | assessment | Profil berechnen |
| GET | /api/plugins/assessment/profile/{project_id} | assessment | Profil laden |
| POST | /api/plugins/session/start | session | Session starten |
| POST | /api/plugins/session/{id}/message | session | Nachricht senden |
| POST | /api/plugins/session/{id}/rate | session | Session bewerten |
| POST | /api/plugins/session/{id}/end | session | Session beenden |
| GET | /api/plugins/tracking/progress/{project_id} | tracking | Fortschritt laden |
| GET | /api/plugins/tracking/commits/{project_id} | tracking | Commit-Historie |
| GET | /api/plugins/tools/recommendations/{project_id} | tools | Werkzeug-Empfehlungen |

### 7.3 Settings

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| GET | /api/settings | Einstellungen laden |
| PATCH | /api/settings | Einstellungen aktualisieren |
| POST | /api/settings/api-key | API-Key speichern (verschluesselt) |
| DELETE | /api/settings/api-key/{provider} | API-Key loeschen |

API-Keys werden server-seitig verschluesselt gespeichert (Fernet, Schluessel aus Umgebungsvariable).

---

## 8. Frontend

### 8.1 Seiten

| Seite | Beschreibung |
|-------|-------------|
| `/` | Landing / Sprachauswahl (wenn kein Nutzer) |
| `/onboarding` | Lernprojekt anlegen (Thema, Ziel, Zeit) |
| `/assessment` | Lerntyp-Test (12 Fragen) |
| `/dashboard` | Hauptseite: Profil, Fortschritt, Session starten |
| `/session` | Aktive Lernsession (Chat-Interface) |
| `/progress` | Detaillierter Fortschritt (Charts, Commits) |
| `/settings` | Sprache, API-Key, Provider-Auswahl |

### 8.2 Dashboard-Komponenten

- **Lernprofil-Radar:** Recharts RadarChart mit 6 Methoden-Achsen
- **Fortschritts-Timeline:** LineChart mit Verstaendnis und Stress ueber Zeit
- **Session-Counter:** Abgeschlossene Sessions, Gesamtminuten, Streak
- **Methoden-Verteilung:** BarChart welche Methode wie oft genutzt wurde
- **Letzte Sessions:** Liste mit Methode, Bewertung, Datum
- **Empfehlungen:** Werkzeug-Empfehlungen basierend auf Profil
- **Quick-Start:** Button fuer neue Session (Methode wird vorgeschlagen)

### 8.3 Session-Interface

- Chat-artig (Nachrichten-Verlauf)
- Oben: Aktive Methode + aktueller Zyklus-Schritt (1-7) als Progress-Bar
- Methodenwechsel-Banner wenn System Wechsel empfiehlt
- Am Ende: Rating-Dialog (Verstaendnis, Stress, Methoden-Fit, je 1-5)

---

## 9. Mehrsprachigkeit

5 Sprachen: Deutsch (DE), Englisch (EN), Spanisch (ES), Franzoesisch (FR), Griechisch (EL)

Zwei Ebenen:
1. **UI-Strings:** Via PluginForge i18n (config/i18n/{lang}.yaml)
2. **KI-Sessions:** System-Prompt und Nutzerinteraktion in der gewaehlten Sprache

Die Assessment-Fragen muessen in allen 5 Sprachen vorliegen. Die KI-Provider bekommen die Sprache als Parameter im System-Prompt.

---

## 10. Sicherheit

- API-Keys werden mit Fernet verschluesselt in der DB gespeichert
- Verschluesselungsschluessel aus Umgebungsvariable `ADAPTIVLEARNER_SECRET_KEY`
- Kein API-Key wird jemals im Klartext ans Frontend gesendet
- Frontend zeigt nur: "Key gespeichert fuer Anthropic" (maskiert)
- CORS konfigurierbar via app.yaml
- Rate-Limiting fuer AI-Provider-Aufrufe (konfigurierbar)

---

## 11. Konfiguration

### config/app.yaml

```yaml
app:
  name: "AdaptivLearner"
  version: "0.1.0"
  description: "Lerne, wie du wirklich lernst"
  default_language: "de"
  secret_key_env: "ADAPTIVLEARNER_SECRET_KEY"

plugins:
  entry_point_group: "adaptivlearner.plugins"
  enabled:
    - "assessment"
    - "session"
    - "ai-anthropic"
    - "ai-openai"
    - "ai-gemini"
    - "tracking"
    - "tools"

database:
  url: "sqlite:///./adaptivlearner.db"

cors:
  origins:
    - "http://localhost:5173"
```

### config/plugins/session.yaml

```yaml
default_method: "ai_adaptive"
max_session_duration_minutes: 60
cycle_steps: 7
stagnation_threshold_sessions: 3
stagnation_stress_threshold: 3.0
```

### config/plugins/ai-anthropic.yaml

```yaml
default_model: "claude-sonnet-4-20250514"
max_tokens: 2048
```

---

## 12. Roadmap

### Phase 1: MVP (v0.1.0)

- PluginForge als Dependency (muss vorher auf PyPI sein)
- Backend: FastAPI, SQLAlchemy, SQLite
- Core: User, LearningProject CRUD
- plugin-assessment: 12 Fragen, Profil-Berechnung (DE + EN)
- plugin-session: 7-Schritte-Zyklus, Chat-Interface
- plugin-ai-anthropic: Claude als erster Provider
- plugin-tracking: ProgressCommits, Basis-Dashboard-Daten
- plugin-tools: Statische Empfehlungen
- Frontend: Onboarding, Assessment, Dashboard, Session, Settings
- Docker Compose
- i18n: DE + EN

### Phase 2: Multi-Provider + vollstaendige i18n (v0.2.0)

- plugin-ai-openai: GPT-Provider
- plugin-ai-gemini: Gemini-Provider
- Provider-Auswahl im Frontend
- i18n komplett: ES, FR, EL
- Assessment-Fragen in allen 5 Sprachen
- Verbessertes Stagnation-Detection

### Phase 3: Erweiterte Analyse (v0.3.0)

- Detaillierter Fortschritts-Verlauf (Git-Prinzip UI)
- Fehlermuster-Erkennung
- Session-Vergleich ueber Zeit
- Export: Lernverlauf als PDF/Markdown
- Plugins in separate Pakete auslagern

### Phase 4: SaaS-Features (v0.4.0)

- PostgreSQL statt SQLite
- User-Authentifizierung (JWT)
- Multi-User
- Premium-Plugins (erweiterte Analyse, Team-Features)
- Abrechnungsintegration

---

## 13. Abgrenzung

Was AdaptivLearner NICHT ist:
- Kein LMS (Learning Management System) - keine Kursverwaltung
- Kein Karteikarten-System (dafuer Anki empfehlen)
- Kein Content-Repository - der Lerninhalt kommt vom KI-Provider
- Kein Ersatz fuer menschliche Lehrer - ein Werkzeug zur Selbstoptimierung
