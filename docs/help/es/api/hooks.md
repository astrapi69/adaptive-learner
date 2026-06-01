# Especificaciones de hooks

Los 10 hookspecs viven en `backend/app/hookspecs.py`. Cada
hookspec define el contrato de llamada; los plugins los implementan
con `@hookimpl`. Tres de ellos son variantes de llamada de IA
(síncrona / asíncrona / streaming) introducidas progresivamente en
v1.5.0 y v1.6.0; el resto no ha cambiado desde v0.2.0.

## get_assessment_questions

```python
@hookspec
def get_assessment_questions(lang: str) -> list[dict] | None:
    """Devuelve el paquete de preguntas para el idioma solicitado.

    Implementado por: plugin de evaluación.
    Modo: list (no firstresult). La ruta actualmente usa el resultado
    del primer plugin; una futura funcionalidad de "múltiples paquetes
    de preguntas" permitiría a los proveedores registrar paquetes nombrados.
    """
```

Forma del valor devuelto:

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
    """Agrega las respuestas brutas en un perfil de 6 métodos.

    Implementado por: plugin de evaluación.
    firstresult: exactamente un plugin calcula el perfil.
    """
```

Forma de `answers` de entrada:

```python
[
  {"question_id": "q01", "answer_ids": ["a", "b"]},  # multi
  {"question_id": "q02", "answer_id": "c"},          # single
  ...
]
```

Devuelve: `dict[method, float]` con las seis claves de método.

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
    """Compone el prompt de sistema para una celda (método, paso, idioma).

    Implementado por: plugin de sesión.
    firstresult: exactamente un plugin compone el prompt.
    """
```

Devuelve: una cadena lista para enviarse como mensaje de rol `system`.
La implementación del plugin de sesión lee del dict `_PROMPTS` de 42
celdas y añade un bloque de contexto.

## ai_complete

```python
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """Llama al proveedor de IA, devuelve el texto del asistente.

    Implementado por: ai-anthropic, ai-openai, ai-gemini.
    firstresult: el plugin del proveedor correspondiente devuelve el
    texto; los demás devuelven None.
    """
```

Cada plugin de proveedor comprueba el prefijo de `model`
(`claude-*`, `gpt-*`, `gemini-*`) y devuelve el texto del asistente
si es el propietario del modelo. Los plugins no coincidentes devuelven
None, dejando que firstresult pase al siguiente.

Forma de `messages` (estilo OpenAI):

```python
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."},
  {"role": "user", "content": "..."},
]
```

Los plugins de proveedor normalizan esta forma a su propia API
(Anthropic separa `system`; Gemini lo integra).

## ai_complete_async (v1.5.0+)

```python
@hookspec(firstresult=True)
async def ai_complete_async(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str:
    """Variante awaitable de ai_complete.

    Implementado por: ai-anthropic, ai-openai, ai-gemini.
    Usado en el límite de ciclo paso 6 → 7 para que la evaluación de paso +
    transición de tema se disparen de forma concurrente mediante
    asyncio.gather (ahorra ~T_2 de latencia).
    """
```

El helper orquestador `call_ai_complete_async` prefiere este hook;
recurre a `ai_complete` envuelto en `asyncio.to_thread` cuando no
está implementado.

## ai_complete_stream (v1.6.0+)

```python
@hookspec(firstresult=True)
def ai_complete_stream(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> AsyncIterator[str]:
    """Devuelve un iterador asíncrono de deltas de texto.

    Implementado por: ai-anthropic, ai-openai, ai-gemini, cada uno
    usando el streaming asíncrono nativo del SDK del proveedor.
    Alimenta ``POST /api/plugins/session/{id}/message/stream``
    (SSE: emite eventos ``start`` / ``chunk`` / ``done``).
    """
```

## recommend_method_switch

```python
@hookspec
def recommend_method_switch(
    history: list[dict],
    profile: dict,
) -> dict | None:
    """Devuelve una recomendación de cambio, o None.

    Implementado por: plugin de sesión.
    Modo: list. Los plugins devuelven recomendaciones individuales;
    un futuro árbitro elegirá la de mayor confianza distinta de None.
    """
```

Forma del valor devuelto:

```python
{
  "recommended": True,
  "to_method": "dialogic",
  "reason": "Tres sesiones con comprensión estancada.",
  "confidence": 0.75,  # opcional
}
```

Devuelve `None` (o `{"recommended": False}`) cuando no se justifica
ningún cambio.

## on_session_complete

```python
@hookspec
def on_session_complete(
    session: dict,
    rating: dict,
) -> None:
    """Hook de efecto secundario: disparado cuando se finaliza una sesión.

    Implementado por: plugin de seguimiento (escribe un ProgressCommit).
    Modo: list. Cada suscriptor se ejecuta; los errores se capturan y
    se registran, pero no deshacen la finalización de la sesión.
    """
```

Los errores en este hook NO DEBEN propagarse: el envoltorio
`_fire_on_session_complete` en
`backend/app/main.py` los captura y registra.

## get_progress_summary

```python
@hookspec
def get_progress_summary(
    project_id: str,
    db: Session,
) -> dict | None:
    """Devuelve un segmento de espacio de nombres del resumen de progreso.

    Implementado por: plugin de seguimiento (devuelve el segmento de
    espacio de nombres "tracking").
    Modo: list. Los segmentos se fusionan superficialmente en la ruta.
    """
```

Cada plugin devuelve un dict con clave de espacio de nombres único. El
plugin de seguimiento devuelve `{"tracking": {...}, "step_evaluation": {...}}`.
Un futuro plugin detector de estancamiento podría devolver
`{"stagnation": {...}}`, etc.

## get_tool_recommendations

```python
@hookspec
def get_tool_recommendations(
    profile: dict,
    lang: str,
    limit: int = 5,
) -> list[dict] | None:
    """Devuelve recomendaciones de herramientas externas ordenadas.

    Implementado por: plugin de herramientas.
    Modo: list. La ruta actualmente usa el resultado del primer plugin;
    un futuro recomendador multi-fuente podría fusionar.
    """
```

Forma del valor devuelto:

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

## firstresult vs modo list

| Hookspec | Modo | Por qué |
|---|---|---|
| get_assessment_questions | list (firstresult efectivo) | Actualmente un paquete; el futuro podría registrar paquetes nombrados |
| calculate_profile | firstresult | Exactamente un algoritmo |
| create_session_prompt | firstresult | Exactamente un compositor de prompts |
| ai_complete | firstresult | El proveedor correspondiente es el dueño de la llamada |
| recommend_method_switch | list | Múltiples plugins pueden sugerir |
| on_session_complete | list | Los efectos secundarios se dispersan |
| get_progress_summary | list | Los segmentos de espacio de nombres se fusionan |
| get_tool_recommendations | list (firstresult efectivo) | Actualmente una sola fuente |

Los modos `list` que actualmente se comportan como firstresult son
deliberados: el contrato está abierto a extensión multi-plugin, pero la
implementación de v0.7.0 usa solo el primero.
