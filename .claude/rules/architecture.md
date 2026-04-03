# Architektur-Regeln

## Schichtenmodell (4 Schichten, IMMER einhalten)

```
1. Frontend        React 18 + TypeScript + Vite + Recharts
2. Backend         FastAPI + SQLAlchemy + SQLite + Pydantic v2
3. PluginForge     Externes PyPI-Paket (pluginforge), basiert auf pluggy
4. Plugins         Im Repo unter backend/plugins/, manuelle Registrierung (v0.1.0)
```

Neue Features gehoeren IMMER in ein Plugin, es sei denn sie betreffen den Kern (User/Project CRUD, Settings, API-Key-Verwaltung).

## Zwei Repositories

| Repo | Zweck | Lizenz |
|------|-------|--------|
| `pluginforge` | Anwendungsunabhaengiges Plugin-Framework (PyPI) | MIT |
| `adaptive-learner` | Adaptives Lernsystem, nutzt PluginForge | MIT |

PluginForge ist EXTERN. Aenderungen an PluginForge sind ein separates Repo und ein separater Release-Zyklus.

## Backend (Python/FastAPI)

### Struktur pro Plugin (v0.1.0, im Repo)

```
backend/plugins/{name}/
  __init__.py
  plugin.py          # {Name}Plugin(BasePlugin) + @hookimpl Methoden
  routes.py          # FastAPI Router (delegiert an Service-Funktionen)
  models.py          # SQLAlchemy Models (optional)
  {modul}.py         # Geschaeftslogik (kein FastAPI-Code hier)
```

### Regeln

- Plugin-Klasse erbt von BasePlugin (pluginforge) UND nutzt @hookimpl fuer Hooks.
- Geschaeftslogik in eigenen Modulen, NICHT in routes.py.
- routes.py enthaelt nur FastAPI-Endpunkte die an Service-Funktionen delegieren.
- Hook-Specs stehen in backend/app/hookspecs.py.
- Pydantic v2 fuer alle Request/Response Schemas.
- SQLAlchemy 2.0 Mapped Columns.
- Konfiguration via YAML (backend/config/plugins/{name}.yaml), NICHT hardcoded.
- i18n-Strings in backend/config/i18n/{lang}.yaml (5 Sprachen: DE, EN, ES, FR, EL).

### AI-Provider-Architektur

- Jeder Provider ist ein eigenes Plugin (ai_anthropic, ai_openai, ai_gemini).
- Alle implementieren denselben Hook: `ai_complete(messages, model, api_key)`.
- `firstresult=True` im Hook-Spec: Nur der aktive Provider antwortet.
- Provider-Auswahl ueber UserSettings.active_provider.
- API-Keys werden Fernet-verschluesselt in der DB gespeichert.
- Schluessel aus Umgebungsvariable `ADAPTIVE_LEARNER_SECRET_KEY`.

### Session-Architektur

- Der 7-Schritte-Zyklus wird vom session-Plugin gesteuert.
- System-Prompt aendert sich je nach Methode UND Zyklus-Schritt.
- Prompt-Templates in plugins/session/prompts.py.
- Methoden-Wechsel-Logik in plugins/session/switching.py.
- Stagnation-Detection basiert auf gleitendem Durchschnitt der letzten N Ratings.

## Frontend (React/TypeScript)

### Komponentenstrategie

- Recharts fuer alle Charts (Radar, Line, Bar).
- Kein UI-Framework (kein MUI, kein Tailwind). Custom CSS mit Variables.
- API-Aufrufe NUR ueber frontend/src/api/client.ts.

### State Management

- React State + Props. Kein globales State-Management fuer v0.1.0.
- Wenn noetig: Zustand, NICHT Redux.

## Persistenz

- Backend: SQLAlchemy + SQLite.
- Frontend: Kein lokaler Storage fuer Lerndaten. Alles via API.
- API-Keys: Fernet-verschluesselt in DB (UserSettings).

## Datenfluss

```
UI (React) -> API Client -> FastAPI Router -> Service/Plugin -> SQLAlchemy -> SQLite
```

Unidirektional. Keine direkte DB-Zugriffe aus Routern.
