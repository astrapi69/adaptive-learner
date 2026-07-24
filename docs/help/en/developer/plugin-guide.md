# Writing a plugin

Plugins extend AdaptiveLearner without touching the core. The
plugin system uses [PluginForge](https://github.com/astrapi69/pluginforge)
(a wrapper around [pluggy](https://pluggy.readthedocs.io/)).
Each plugin is a standalone Poetry package registered via an
entry point.

This tutorial walks through creating a "hello-world" plugin
that adds a route and listens to one hook.

## 1. Scaffold the directory

```bash
mkdir -p plugins/adaptive-learner-plugin-hello/adaptive_learner_hello
mkdir -p plugins/adaptive-learner-plugin-hello/tests
cd plugins/adaptive-learner-plugin-hello
```

## 2. pyproject.toml

```toml
[tool.poetry]
name = "adaptive-learner-plugin-hello"
version = "1.0.0"
description = "Adaptive Learner: hello-world plugin"
authors = ["Your Name"]
license = "MIT"

[tool.poetry.dependencies]
python = "^3.11"
pluginforge = "^0.10.0"
fastapi = "^0.136.0"

[project.entry-points."adaptive_learner.plugins"]
hello = "adaptive_learner_hello.plugin:HelloPlugin"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

The entry point name (`hello` here) is what the plugin
registry uses to track the plugin. The class path
(`adaptive_learner_hello.plugin:HelloPlugin`) is the Python
import path to the plugin class.

## 3. plugin.py

```python
from pluginforge import BasePlugin, hookimpl
from typing import Any

class HelloPlugin(BasePlugin):
    name = "hello"
    version = "1.0.0"
    # pluginforge ^0.10.0 identity gating. Set this to
    # "adaptive_learner" so the host's PluginManager (which
    # passes ``app_id="adaptive_learner"``) recognises the
    # plugin as targeted at this app. The v0.9.0 transition
    # made this a HARD filter - plugins without it are
    # rejected at discovery time.
    target_application = "adaptive_learner"
    depends_on: list[str] = []

    @hookimpl
    def on_session_complete(
        self, session: dict[str, Any], rating: dict[str, Any]
    ) -> None:
        print(f"Hello! Session {session['id']} ended.")
```

`BasePlugin` is the base class from PluginForge. The
`@hookimpl` decorator marks a method as implementing a hook
specified in `backend/app/hookspecs.py`.

## 4. routes.py

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/plugins/hello", tags=["hello"])

@router.get("/greet")
def greet() -> dict:
    return {"message": "Hello from the hello plugin!"}
```

## 5. Register routes in plugin.py

```python
from fastapi import FastAPI
from .routes import router

class HelloPlugin(BasePlugin):
    ...

    def mount_routes(self, app: FastAPI) -> None:
        app.include_router(router)
```

The plugin manager calls `mount_routes()` for every plugin
that defines it, after the core app is initialised.

## 6. Tests

```python
# tests/test_plugin.py
from adaptive_learner_hello.plugin import HelloPlugin

def test_hello_plugin_has_name():
    plugin = HelloPlugin()
    assert plugin.name == "hello"
```

## 7. Install + activate

Add the plugin as a path-dep in `backend/pyproject.toml`:

```toml
[tool.poetry.dependencies]
...
adaptive-learner-plugin-hello = {path = "../plugins/adaptive-learner-plugin-hello", develop = true}
```

Then:

```bash
cd backend && poetry lock && poetry install
make dev
curl http://localhost:18001/api/plugins/hello/greet
```

## The 10 hookspecs

All hook specifications live in `backend/app/hookspecs.py`:

1. `get_assessment_questions(lang: str)` - return question pack.
2. `calculate_profile(answers: list)` - compute method weights
   (firstresult).
3. `create_session_prompt(...)` - compose the system prompt
   (firstresult).
4. `ai_complete(messages, model, api_key, max_tokens)` - call
   the AI synchronously (firstresult, provider routes by model
   prefix).
5. `ai_complete_async(...)` - async variant for parallel
   cycle-boundary evaluation (v1.5.0+, firstresult).
6. `ai_complete_stream(...)` - streaming variant yielding text
   deltas via SSE (v1.6.0+, firstresult).
7. `recommend_method_switch(history, profile)` - return a
   switch recommendation or None.
8. `on_session_complete(session, rating)` - broadcast side
   effect; gamification + tracking listen.
9. `get_progress_summary(project_id, db)` - return one
   namespace slice of the dashboard summary.
10. `get_tool_recommendations(profile, lang)` - return ranked
    tools.

[Full hookspec reference](../api/hooks.md)

## firstresult semantics

Hooks marked `firstresult=True` stop at the first plugin that
returns a non-None value. Useful for "exactly one plugin
should handle this" cases - like `ai_complete`, where the
matching provider's plugin returns the text and others return
None.

Hooks without `firstresult=True` run on every plugin (list
mode). The caller receives a list of results and decides what
to do (merge, prefer, etc.).
