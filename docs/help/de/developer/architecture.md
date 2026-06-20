# Architektur

Adaptive Learner ist ein 4-Schichten-System. Die Grenzen sind
strikt: jede Schicht kennt nur die Schicht darunter.

```
1. Frontend       React 19 + TypeScript 6 (strict) + Vite 8
2. Backend        FastAPI + SQLAlchemy 2.0 + SQLite + Pydantic v2
3. PluginForge    Externes PyPI-Paket, basiert auf pluggy
4. Plugins        Eigenständige Pakete, registriert per Entry-Point
```

## Frontend: Dual-Storage

Seit v0.7.0 hat das Frontend einen einzigen Punkt, an dem der
Backend-Speicher gewählt wird. Jede Seite konsumiert ein
`IStorageService` über die `getStorage()`-Factory. Zwei
Implementierungen erfüllen das Interface:

- **ApiStorage** — dünner Durchgriff auf `api/client.ts`,
  ruft das FastAPI-Backend.
- **DexieStorage** — persistiert alles in IndexedDB via
  Dexie 4. KI-Aufrufe gehen direkt aus dem Browser an
  Anthropic / OpenAI / Gemini.

`IStorageService` umfasst inzwischen 22 Namespaces über die
Phasen 7–34 hinweg (Users, Projects, Settings inkl.
`key_source_*`, Assessment, Session mit `streamMessage`,
Tracking, Tools, Curricula, Topics, Lessons, Plugins, System,
Backup, Export, Subjects, Tags, ProjectTaxonomy, Imports,
Gamification, Anki, Pronunciation, NotebookLM).

Die Factory liest `localStorage["adaptive-learner.storage_mode"]`
(in den Einstellungen gesetzt), dann `VITE_STORAGE_MODE`
(im GH-Pages-Build gesetzt), Fallback `api`. Der Wechsel ist
bewusst kein Live-Swap.

## Drei-Schichten-Geheimnisse (v1.20.0 / Phase 34)

Jeder KI-Aufruf läuft durch `services/settings.resolve_api_key`:

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`-Umgebungsvariable.
2. `ai.<provider>.api_key` in
   `~/.config/adaptive_learner/secrets.yaml`.
3. Fernet-entschlüsselte DB-Spalte.
4. `None` — der Aufruf zeigt einen Fehler in der UI.

Die Quelle wird als `UserSettingsOut.key_source_*`-Enum
(`env` / `secrets_yaml` / `settings` / `none`) zum Frontend
zurückgegeben. Die Einstellungs-UI deaktiviert Speichern /
Entfernen, wenn die Quelle `env` oder `secrets_yaml` ist.

[Storage-Layer im Detail](storage-layer.md)

## Backend: geschichteter FastAPI-Stack

```
UI (React) -> API-Client -> FastAPI-Router -> Service/Plugin -> SQLAlchemy -> SQLite
```

Einbahnstraße. Router sind dünn (Eingabe validieren, Service
aufrufen, Response zurück). Geschäftslogik lebt in Service-
Modulen und Plugins. Services werfen
`AdaptiveLearnerError`-Subklassen; der globale Exception-
Handler in `main.py` mappt sie auf HTTP-Codes.

## Plugin-System

[PluginForge](https://github.com/astrapi69/pluginforge) ist
ein externes PyPI-Paket (wir pinnen `^0.7.0`). Es umhüllt
[pluggy](https://pluggy.readthedocs.io/) — Pythons De-facto-
Plugin-Spec, genutzt von pytest, tox, devpi und vielen mehr.

v0.7.0 hat Identitäts-Gating gebracht: jedes Plugin
deklariert ``target_application = "adaptive_learner"`` und der
``PluginManager`` wird mit ``app_id="adaptive_learner"``
konstruiert. Fremde Plugins, die eine andere App adressieren,
werden automatisch herausgefiltert, selbst wenn ihre
Entry-Point-Gruppe kollidiert.

Acht Hook-Spezifikationen leben in `backend/app/hookspecs.py`.
Sieben Plugins gehören zum Standardumfang:

| Plugin | Routen | Hooks |
|---|---|---|
| assessment | /questions, /evaluate, /profile/{id} | get_assessment_questions, calculate_profile |
| ai-anthropic | (nur Hooks) | ai_complete (firstresult, Modell `claude-*`) |
| ai-openai | (nur Hooks) | ai_complete (firstresult, Modell `gpt-*`) |
| ai-gemini | (nur Hooks) | ai_complete (firstresult, Modell `gemini-*`) |
| session | /start, /{id}/message, /{id}/rate, /{id}/end, /switch-recommendation/{id}, /{id}/switch | create_session_prompt (firstresult), recommend_method_switch |
| tracking | /progress/{id}, /commits/{id} | on_session_complete, get_progress_summary |
| tools | /recommendations/{id}, /spaced/{id} | get_tool_recommendations |

PluginForge baut die Registry beim App-Start in
`backend/app/main.py` auf. Plugin-Discovery läuft über
Entry-Points in der `pyproject.toml` jedes Plugins:

```toml
[project.entry-points."adaptive_learner.plugins"]
my_plugin = "my_plugin.plugin:MyPlugin"
```

## Datenfluss

Eine typische Session-Nachricht:

```
User tippt -> SessionChat.send() -> getStorage().session.message()
                                                |
                       ApiStorage                          DexieStorage
                           |                                    |
       POST /api/plugins/session/{id}/message         direkter KI-Aufruf
                           |                                    |
                Session-Plugin-Route                  Schritt-Bewerter
                           |                                    |
                  ai_complete-Hook                  Schreiben in IndexedDB
                           |
                    Schritt-Bewerter
                           |
                Schreiben in SQLite
```

Beide Pfade liefern denselben `SessionMessageExchangeResult`-
Shape; das Frontend verzweigt nicht auf den Speichermodus.

## Repository-Layout

```
adaptive-learner/
├── backend/app/           FastAPI-Schale + DB + Hookspecs + Plugin-Manager
├── backend/config/        app.yaml + i18n/ (11 Sprachen)
├── frontend/src/storage/  IStorageService + ApiStorage + DexieStorage
├── frontend/src/pages/    Landing, Onboarding, Assessment, Dashboard, ...
├── plugins/               7 Plugins, jedes ein eigenständiges Poetry-Paket
├── launcher/              Cross-OS PyInstaller-Desktop-Launcher
├── docs/help/             MkDocs-Quelltext dieser Seite
├── .github/workflows/     CI + GH-Pages-Deploy
└── Makefile, docker-compose.yml
```

[Dev-Umgebung aufsetzen](setup.md)
