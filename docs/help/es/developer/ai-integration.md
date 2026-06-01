# Integración de IA

Adaptive Learner ejecuta cada conversación de aprendizaje a
través de hasta **tres** llamadas a la IA por viaje de ida y
vuelta — la respuesta en streaming, el evaluador de pasos y (en
el paso 7) el evaluador de transición de tema. Tres proveedores
se incluyen por defecto; los nuevos proveedores se conectan
mediante la familia de hooks `ai_complete*`.

## El hook ai_complete

```python
# backend/app/hookspecs.py
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """Devuelve el texto del asistente, o None si este plugin no maneja ``model``."""
```

`firstresult=True` significa que pluggy se detiene en el primer
retorno distinto de None. Cada plugin de proveedor comprueba el
prefijo del `model` y devuelve el texto del asistente si es
propietario del modelo:

```python
@hookimpl
def ai_complete(
    self, messages, model, api_key, max_tokens
) -> str | None:
    if not model.startswith("claude-"):
        return None
    # ... llamar a la API de Anthropic, devolver el texto ...
```

Se incluyen tres plugins: `ai-anthropic` (claude-*), `ai-openai`
(gpt-*), `ai-gemini` (gemini-*).

## Variantes asíncrona y en streaming

```python
@hookspec(firstresult=True)
async def ai_complete_async(messages, model, api_key, max_tokens) -> str:
    """Awaitable; misma forma que ai_complete. v1.5.0+."""

@hookspec(firstresult=True)
def ai_complete_stream(messages, model, api_key, max_tokens):
    """Devuelve un iterador asíncrono de deltas de texto. v1.6.0+."""
```

`ai_complete_async` lo usa la ruta de sesión en el límite de
ciclo paso 6→7 para que la evaluación de pasos y la transición
de tema se disparen de forma concurrente mediante `asyncio.gather`
(`async_evaluation: true` en `app.yaml`).

`ai_complete_stream` alimenta el endpoint SSE en streaming
`POST /api/plugins/session/{id}/message/stream` que emite eventos
`start` / `chunk` / `done`.

## Lógica de selección de proveedor (v1.20.0)

`_resolve_active_key()` de la ruta de sesión llama a
`services/settings.resolve_api_key(db, user_id, provider)`
que recorre la cadena de tres capas:

1. Variable de entorno `ADAPTIVE_LEARNER_<PROVEEDOR>_API_KEY`.
2. `ai.<proveedor>.api_key` en
   `~/.config/adaptive_learner/secrets.yaml`.
3. `UserSettings.api_key_<proveedor>` descifrado con Fernet.
4. `None` — la llamada muestra `ai_error` en la interfaz.

`resolve_default_model(db, user_id, provider)` recorre la misma
cadena para el sobreescritura del modelo (env > yaml > sobreescritura
de interfaz > `DEFAULT_MODELS[provider]`).

Luego se dispara `ai_complete*` con los valores resueltos. El
plugin del proveedor correspondiente devuelve el texto; los demás
devuelven None (firstresult se detiene en el primer resultado).

## Arquitectura de doble prompt (v0.5.0) + auto-bucle (v1.4.0)

Cada `POST /api/plugins/session/{id}/message` para un rol `user`
realiza hasta tres llamadas a la IA:

1. **Respuesta de aprendizaje** — en streaming mediante
   `ai_complete_stream`. Prompt del sistema compuesto por
   `build_prompt(project, profile, method, cycle_step, lang)`
   desde la matriz de 42 celdas. `max_tokens=1024`. SSE emite
   eventos `start` / `chunk` / `done`.
2. **Evaluador de pasos** — prompt del sistema separado
   (`EVALUATION_SYSTEM_PROMPT`) que pide a la IA leer el
   intercambio y emitir un veredicto JSON (`advance`,
   `confidence`, `reason`, `suggested_step`). `max_tokens=256`.
   El veredicto del evaluador dirige el avance de `cycle_step`
   (condicionado a `confidence ≥ 0.6`).
3. **Transición de tema** — solo en el paso 7. Una tercera
   llamada a la IA juzga si el tema fue integrado y si se debe
   iniciar un nuevo ciclo en un nuevo subtema. Límite de
   `max_cycles=5` por sesión.

Si el evaluador devuelve JSON no analizable, se activa el
fallback determinista de +1 (limitado a 7) y se registra
`fallback_used=True`.

El límite de ciclo (paso 6 → 7) dispara la evaluación de pasos
y la transición de tema de forma concurrente mediante
`asyncio.gather` (ahorra ~T₂ de latencia). Devuelto en el bloque
`timings` de la respuesta del mensaje (`learning_ms`,
`evaluation_ms`, `topic_transition_ms`, `total_ms`,
`parallel_saved_ms`).

## La matriz de prompts de 42 celdas

`plugins/adaptive-learner-plugin-session/adaptive_learner_session/prompts.py`
contiene un `dict[method, dict[step, dict[lang, str]]]` — seis
métodos, siete pasos, dos idiomas, 84 celdas. Cada celda es 1-2
oraciones que establecen el rol de la IA + la tarea del paso. Un
bloque de contexto («Proyecto de aprendizaje: 'X' | Objetivo: 'Y'.
Pista del perfil: …») se adjunta en el momento de la composición.

Para el modo Dexie, los prompts se exportan literalmente a
`frontend/src/data/session-prompts.json` y los carga
`frontend/src/storage/prompts.ts`. El mismo texto, el mismo
formato de bloque de contexto — sin deriva posible.

## Añadir un nuevo proveedor

1. Crea `plugins/adaptive-learner-plugin-ai-nuevoproveedor/`.
2. Implementa el hookimpl `ai_complete`: comprueba el prefijo del
   modelo, llama a la API HTTP del proveedor, devuelve el texto.
3. Añade el prefijo del proveedor a `DEFAULT_MODELS` en
   `ai_orchestration.py` con un modelo por defecto económico.
4. Añade el nombre del proveedor al enum `AIProvider` en
   `app/schemas/__init__.py`.
5. Añádelo a `AI_PROVIDERS` en
   `frontend/src/lib/constants.ts`.
6. Para paridad en modo Dexie: añade un cliente a
   `frontend/src/storage/ai-providers.ts` y enrútalo desde
   `aiComplete()`.

Cada plugin de proveedor prueba su hookimpl + la llamada al
proveedor de forma aislada — consulta
`plugins/adaptive-learner-plugin-ai-anthropic/tests/` como
plantilla (la llamada HTTP al proveedor está simulada).

## Llamadas directas desde el navegador (modo Dexie)

En el modo Dexie la llamada a la IA no pasa por el sistema de
plugins. `storage/ai-providers.ts` realiza la solicitud HTTP
directamente. Anthropic requiere el encabezado
`anthropic-dangerous-direct-browser-access: true` para superar
la verificación previa CORS; OpenAI y Gemini aceptan llamadas
directas desde el navegador por defecto.

La lógica de doble prompt es la misma en ambos modos —
`storage/session-flow.ts` llama a `aiComplete()` dos veces y
analiza el JSON del evaluador de la misma manera que lo hace el
backend.

## Umbral de confianza

`session.step_evaluation.confidence_threshold` en
`backend/config/app.yaml` (por defecto 0.6) determina si un
veredicto real del evaluador (sin fallback) realmente mueve el
paso del ciclo. Ponlo más alto para ser más conservador, más bajo
para ser más agresivo. Los veredictos de fallback (fallos de
análisis) siempre aplican el avance de +1 independientemente.

El puerto Dexie refleja esto con un 0.6 fijo en
`storage/session-flow.ts`. Una fase futura lo expondrá en la
interfaz de Ajustes.

## Otras superficies de IA (resumen de solo lectura)

Varias funciones fuera de sesión usan los mismos plugins de
proveedor de IA mediante `ai_complete*`:

- **Analizador de conversaciones** (Fase 12 / v0.9.0+) —
  `frontend/src/chat_import/analysis.ts` divide los
  transcripts importados en fragmentos de 16K caracteres con
  superposición de 2 mensajes, dispara `ai_complete` por
  fragmento y fusiona los resultados. Extrae tema / puntos
  débiles / patrones de errores / método recomendado /
  vocabulario (desde v1.20.0). El analizador JSON tolerante
  maneja el comportamiento defectuoso de modelos de clase Haiku
  (salida entre vallas de código, prosa de preámbulo).
- **Extracción Anki** (Fase 30 / v1.17.0) — `.../anki/card_extraction.py`
  extrae candidatos a tarjetas de memoria de una sesión o
  conversación; la ruta de vocabulario se ejecuta del lado del
  cliente sin IA cuando `analysis_result.vocabulary` está
  relleno.
- **Preguntas de estudio NotebookLM + guía** (Fase 32 / v1.19.0)
  — `.../notebooklm/question_generator.py` + `study_guide.py`;
  analizador JSON tolerante; las preguntas editadas por el usuario
  omiten la regeneración.
- **Juez de pronunciación** (Fase 31 / v1.18.0) —
  `.../pronunciation.py` genera frases objetivo y juzga la
  similitud del audio del aprendiz (habilitación condicionada a
  la taxonomía de asignatura de Idiomas).
