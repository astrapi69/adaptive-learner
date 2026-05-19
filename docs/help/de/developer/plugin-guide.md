# Plugin schreiben

Plugins erweitern AdaptiveLearner, ohne den Core anzufassen.
Das Plugin-System nutzt
[PluginForge](https://github.com/astrapi69/pluginforge)
(eine Hülle um [pluggy](https://pluggy.readthedocs.io/)).
Jedes Plugin ist ein eigenständiges Poetry-Paket, registriert
über einen Entry-Point.

Dieses Tutorial baut ein "Hello-World"-Plugin, das eine Route
und einen Hook-Listener hinzufügt.

## 1. Verzeichnis anlegen

```bash
mkdir -p plugins/adaptive-learner-plugin-hello/adaptive_learner_hello
mkdir -p plugins/adaptive-learner-plugin-hello/tests
cd plugins/adaptive-learner-plugin-hello
```

## 2. pyproject.toml

```toml
[tool.poetry]
name = "adaptive-learner-plugin-hello"
version = "0.1.0"
description = "Adaptive Learner: hello-world plugin"
authors = ["Your Name"]
license = "MIT"

[tool.poetry.dependencies]
python = "^3.11"
pluginforge = "^0.7.0"
fastapi = "^0.118.0"

[project.entry-points."adaptive_learner.plugins"]
hello = "adaptive_learner_hello.plugin:HelloPlugin"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

Der Entry-Point-Name (`hello`) ist der Schlüssel, unter dem
die Plugin-Registry das Plugin trackt. Der Klassenpfad
(`adaptive_learner_hello.plugin:HelloPlugin`) ist der Python-
Importpfad.

## 3. plugin.py

```python
from pluginforge import BasePlugin, hookimpl
from typing import Any

class HelloPlugin(BasePlugin):
    name = "hello"
    version = "0.1.0"
    # pluginforge v0.7.0+ Identitäts-Gating. Setze auf
    # "adaptive_learner", damit der ``PluginManager`` des Hosts
    # (der ``app_id="adaptive_learner"`` übergibt) das Plugin
    # als für diese App vorgesehen erkennt. Plugins ohne dieses
    # Attribut werden mit v0.8.0-Hosts ausgefiltert.
    target_application = "adaptive_learner"
    depends_on: list[str] = []

    @hookimpl
    def on_session_complete(
        self, session: dict[str, Any], rating: dict[str, Any]
    ) -> None:
        print(f"Hello! Session {session['id']} beendet.")
```

`BasePlugin` ist die Basisklasse von PluginForge. Der
`@hookimpl`-Dekorator markiert eine Methode als
Implementierung eines Hooks aus `backend/app/hookspecs.py`.

## 4. routes.py

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/plugins/hello", tags=["hello"])

@router.get("/greet")
def greet() -> dict:
    return {"message": "Hallo vom Hello-Plugin!"}
```

## 5. Routen in plugin.py registrieren

```python
from fastapi import FastAPI
from .routes import router

class HelloPlugin(BasePlugin):
    ...

    def mount_routes(self, app: FastAPI) -> None:
        app.include_router(router)
```

Der Plugin-Manager ruft `mount_routes()` für jedes Plugin auf,
das diese Methode definiert — nach Core-App-Init.

## 6. Tests

```python
# tests/test_plugin.py
from adaptive_learner_hello.plugin import HelloPlugin

def test_hello_plugin_has_name():
    plugin = HelloPlugin()
    assert plugin.name == "hello"
```

## 7. Installieren + aktivieren

Plugin als Path-Dep in `backend/pyproject.toml` eintragen:

```toml
[tool.poetry.dependencies]
...
adaptive-learner-plugin-hello = {path = "../plugins/adaptive-learner-plugin-hello", develop = true}
```

Dann:

```bash
cd backend && poetry lock && poetry install
make dev
curl http://localhost:18001/api/plugins/hello/greet
```

## Die 8 Hookspecs

Alle Hookspecs leben in `backend/app/hookspecs.py`:

1. `get_assessment_questions(lang: str)` — Fragepack zurückgeben (Liste).
2. `calculate_profile(answers: list)` — Methodengewichte berechnen (firstresult).
3. `create_session_prompt(...)` — System-Prompt zusammensetzen (firstresult).
4. `ai_complete(messages, model, api_key, max_tokens)` — KI aufrufen (firstresult, Modell-Präfix passt).
5. `recommend_method_switch(history, profile)` — Switch-Empfehlung oder None.
6. `on_session_complete(session, rating)` — Seiteneffekt (z.B. ProgressCommit schreiben).
7. `get_progress_summary(project_id, db)` — Namespace-Slice der Summary zurück.
8. `get_tool_recommendations(profile, lang)` — gerankte Tools zurück.

[Vollständige Hookspec-Referenz](../api/hooks.md)

## firstresult-Semantik

Hooks mit `firstresult=True` halten beim ersten Plugin, das
einen Nicht-None-Wert liefert. Sinnvoll für "genau ein Plugin
sollte das übernehmen" — z.B. `ai_complete`, wo das Plugin des
passenden Anbieters den Text liefert und alle anderen None.

Hooks ohne `firstresult=True` laufen über jedes Plugin
(List-Modus). Der Aufrufer bekommt eine Liste der Ergebnisse
und entscheidet, was tun (merge, präferieren etc.).
