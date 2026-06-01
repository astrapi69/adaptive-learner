# Escribir un plugin

Los plugins extienden AdaptiveLearner sin tocar el núcleo. El
sistema de plugins usa [PluginForge](https://github.com/astrapi69/pluginforge)
(un envoltorio sobre [pluggy](https://pluggy.readthedocs.io/)).
Cada plugin es un paquete Poetry independiente registrado
mediante un punto de entrada.

Este tutorial explica cómo crear un plugin «hello-world» que
añade una ruta y escucha un hook.

## 1. Crear la estructura de directorios

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
description = "Adaptive Learner: plugin hello-world"
authors = ["Tu Nombre"]
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

El nombre del punto de entrada (`hello` aquí) es lo que usa el
registro de plugins para rastrear el plugin. La ruta de la clase
(`adaptive_learner_hello.plugin:HelloPlugin`) es la ruta de
importación Python a la clase del plugin.

## 3. plugin.py

```python
from pluginforge import BasePlugin, hookimpl
from typing import Any

class HelloPlugin(BasePlugin):
    name = "hello"
    version = "1.0.0"
    # Verificación de identidad pluginforge ^0.10.0. Fíjalo en
    # "adaptive_learner" para que el PluginManager del host (que
    # pasa ``app_id="adaptive_learner"``) reconozca el plugin como
    # dirigido a esta aplicación. La transición v0.9.0 convirtió
    # esto en un FILTRO DURO — los plugins sin esto son rechazados
    # en el momento del descubrimiento.
    target_application = "adaptive_learner"
    depends_on: list[str] = []

    @hookimpl
    def on_session_complete(
        self, session: dict[str, Any], rating: dict[str, Any]
    ) -> None:
        print(f"¡Hola! La sesión {session['id']} ha terminado.")
```

`BasePlugin` es la clase base de PluginForge. El decorador
`@hookimpl` marca un método como implementación de un hook
especificado en `backend/app/hookspecs.py`.

## 4. routes.py

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/plugins/hello", tags=["hello"])

@router.get("/greet")
def greet() -> dict:
    return {"message": "¡Hola desde el plugin hello!"}
```

## 5. Registrar las rutas en plugin.py

```python
from fastapi import FastAPI
from .routes import router

class HelloPlugin(BasePlugin):
    ...

    def mount_routes(self, app: FastAPI) -> None:
        app.include_router(router)
```

El gestor de plugins llama a `mount_routes()` para cada plugin
que lo define, después de que la aplicación núcleo está
inicializada.

## 6. Pruebas

```python
# tests/test_plugin.py
from adaptive_learner_hello.plugin import HelloPlugin

def test_hello_plugin_has_name():
    plugin = HelloPlugin()
    assert plugin.name == "hello"
```

## 7. Instalar + activar

Añade el plugin como dependencia de ruta en `backend/pyproject.toml`:

```toml
[tool.poetry.dependencies]
...
adaptive-learner-plugin-hello = {path = "../plugins/adaptive-learner-plugin-hello", develop = true}
```

Luego:

```bash
cd backend && poetry lock && poetry install
make dev
curl http://localhost:18001/api/plugins/hello/greet
```

## Los 10 hookspecs

Todas las especificaciones de hooks viven en
`backend/app/hookspecs.py`:

1. `get_assessment_questions(lang: str)` — devuelve el paquete de
   preguntas.
2. `calculate_profile(answers: list)` — calcula los pesos de los
   métodos (firstresult).
3. `create_session_prompt(...)` — compone el prompt del sistema
   (firstresult).
4. `ai_complete(messages, model, api_key, max_tokens)` — llama a
   la IA de forma síncrona (firstresult, el proveedor enruta por
   prefijo de modelo).
5. `ai_complete_async(...)` — variante asíncrona para la
   evaluación paralela en el límite del ciclo (v1.5.0+, firstresult).
6. `ai_complete_stream(...)` — variante en streaming que produce
   deltas de texto mediante SSE (v1.6.0+, firstresult).
7. `recommend_method_switch(history, profile)` — devuelve una
   recomendación de cambio o None.
8. `on_session_complete(session, rating)` — efecto secundario
   broadcast; la gamificación y el seguimiento escuchan.
9. `get_progress_summary(project_id, db)` — devuelve un fragmento
   de espacio de nombres del resumen del panel.
10. `get_tool_recommendations(profile, lang)` — devuelve
    herramientas ordenadas.

[Referencia completa de hookspecs](../api/hooks.md)

## Semántica de firstresult

Los hooks marcados con `firstresult=True` se detienen en el
primer plugin que devuelve un valor distinto de None. Útil para
los casos de «exactamente un plugin debe manejar esto» — como
`ai_complete`, donde el plugin del proveedor correspondiente
devuelve el texto y los demás devuelven None.

Los hooks sin `firstresult=True` se ejecutan en cada plugin (modo
lista). El llamador recibe una lista de resultados y decide qué
hacer (fusionar, preferir, etc.).
