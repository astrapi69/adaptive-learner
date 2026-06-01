# Endpoints de plugins

Las rutas de cada plugin se montan bajo `/api/plugins/{plugin-name}/`.

## Plugin de evaluación

```
GET /api/plugins/assessment/questions?lang=en
```

Devuelve el paquete de 12 preguntas con `text` resuelto al idioma
solicitado. Cada respuesta lleva los pesos por método.

```json
[
  {
    "id": "q01",
    "type": "multi",
    "text": "¿Cómo abordas un tema nuevo?",
    "answers": [
      {
        "id": "a",
        "text": "Leo las reglas y la teoría primero.",
        "weights": {"deductive": 1.0}
      },
      ...
    ]
  },
  ...
]
```

```
POST /api/plugins/assessment/evaluate
```

Cuerpo:

```json
{
  "project_id": "p1",
  "answers": [
    {"question_id": "q01", "answer_ids": ["a", "b"]},
    {"question_id": "q02", "answer_id": "c"},
    ...
  ]
}
```

Se aceptan tanto la forma de selección única (`answer_id: string`)
como la de selección múltiple (`answer_ids: string[]`). Devuelve el
LearningProfile creado:

```json
{
  "id": "pr1",
  "user_id": "abc-123",
  "project_id": "p1",
  "deductive": 0.4167,
  "inductive": 0.1833,
  "error_based": 0.0833,
  "dialogic": 0.0833,
  "contextual": 0.0833,
  "ai_adaptive": 0.1500,
  "assessed_at": "2026-05-19T12:00:00+00:00",
  "version": 1,
  "dominant_method": "deductive"
}
```

```
GET /api/plugins/assessment/profile/{project_id}
```

Devuelve el LearningProfile más reciente del proyecto.

## Plugin de sesión

```
POST /api/plugins/session/start
```

Cuerpo:

```json
{
  "project_id": "p1",
  "method": "deductive",
  "cycle_step": 1,
  "lang": "en"
}
```

`method`, `cycle_step`, `lang` son opcionales. Devuelve la sesión
creada + el prompt de sistema compuesto:

```json
{
  "session": {
    "id": "s1",
    "project_id": "p1",
    "method": "deductive",
    "started_at": "2026-05-19T12:00:00+00:00",
    "ended_at": null,
    "cycle_step": 1,
    "status": "active"
  },
  "system_prompt": "You are a deductive learning companion. ..."
}
```

```
POST /api/plugins/session/{session_id}/message
```

Cuerpo:

```json
{"role": "user", "content": "Me gustaría empezar con el presente."}
```

El servidor guarda el mensaje del usuario, dispara `ai_complete`,
persiste la respuesta del asistente, ejecuta el evaluador de pasos y
devuelve el compuesto:

```json
{
  "user_message": {"id": "m1", "session_id": "s1", "role": "user", "content": "...", "created_at": "..."},
  "assistant_message": {"id": "m2", "session_id": "s1", "role": "assistant", "content": "...", "created_at": "..."},
  "ai_error": null,
  "session": {"...": "fila de sesión después del avance de cycle_step"},
  "step_evaluation": {
    "advance": true,
    "confidence": 0.85,
    "reason": "El aprendiz ha comprendido claramente la entrada.",
    "suggested_step": 2,
    "fallback_used": false,
    "applied": true,
    "from_step": 1
  }
}
```

```
POST /api/plugins/session/{session_id}/rate
```

Cuerpo:

```json
{
  "understanding": 4,
  "stress": 2,
  "method_fit": 5,
  "notes": "Se sintió productivo."
}
```

Persiste una fila SessionRating. Devuelve la fila.

```
POST /api/plugins/session/{session_id}/end
```

Cierra la sesión. Dispara `on_session_complete` (el plugin de
seguimiento escribe un ProgressCommit). Devuelve:

```json
{"session": {"...": "la sesión con status='completed' y ended_at establecido"}}
```

```
GET /api/plugins/session/switch-recommendation/{session_id}
```

Devuelve:

```json
{"recommended": false, "to_method": null, "reason": null}
```

O, cuando se detecta estancamiento:

```json
{"recommended": true, "to_method": "dialogic", "reason": "Tres sesiones con comprensión estancada + alto estrés."}
```

```
POST /api/plugins/session/{session_id}/switch
```

Cuerpo:

```json
{"to_method": "dialogic", "reason": "Parecía lo correcto."}
```

Actualiza `session.method`, escribe una fila de auditoría MethodSwitch,
devuelve la sesión actualizada.

## Plugin de seguimiento

```
GET /api/plugins/tracking/progress/{project_id}
```

Devuelve el resumen con espacios de nombres; el segmento `tracking`
lleva la salida del agregador:

```json
{
  "tracking": {
    "total_sessions": 7,
    "total_minutes": 195,
    "streak_days": 3,
    "sessions_per_method": {"deductive": 4, "inductive": 2, "dialogic": 1},
    "method_distribution": [...],
    "recent_understanding": [0.6, 0.8, 0.8, 0.8, 1.0],
    "recent_stress": [0.4, 0.4, 0.2, 0.2, 0.2],
    "mean_understanding": 0.8,
    "mean_stress": 0.3,
    "recent_sessions": [...]
  },
  "step_evaluation": {
    "total_evaluations": 28,
    "average_confidence": 0.78,
    "advance_count": 21,
    "repeat_count": 5,
    "backward_count": 2,
    "fallback_count": 1,
    "evaluations_per_step": {"1": 7, "2": 6, ...},
    "time_seconds_per_step": {"1": 180.5, ...}
  }
}
```

```
GET /api/plugins/tracking/commits/{project_id}
```

Devuelve todas las filas de ProgressCommit del proyecto, en orden
cronológico.

## Plugin de herramientas

```
GET /api/plugins/tools/recommendations/{project_id}?lang=en
```

Devuelve las 5 herramientas del catálogo ordenadas por relevancia para
el perfil del proyecto:

```json
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "Tarjetas de repetición espaciada — ideales para consolidar reglas y correcciones de errores a largo plazo.",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

```
GET /api/plugins/tools/spaced/{project_id}?lang=en
```

Devuelve tarjetas de acción de repetición espaciada impulsadas por la
recencia:

```json
[
  {
    "id": "sr-deductive-first",
    "method": "deductive",
    "interval_days": 1,
    "action": "session",
    "title": "Primera práctica en deducción.",
    "urgency": 0.5
  },
  ...
]
```

## Plugin de sesión — streaming + pronunciación (v1.6.0+, v1.18.0+)

```
POST /api/plugins/session/{id}/message/stream  (SSE)
```

El mismo cuerpo que `/message`; emite tres tipos de eventos SSE:

- `start` — payload `{user_message}` (el turno del usuario ya
  persistido).
- `chunk` — payload `{delta}` (uno o más fragmentos de texto
  llegando del streaming del proveedor de IA).
- `done` — payload idéntico a la respuesta síncrona de `/message`:
  mensaje del asistente + cycle_step + tiempos +
  tarjeta de transición de ciclo opcional.

```
GET  /api/plugins/session/pronunciation/eligibility/{project_id}
POST /api/plugins/session/pronunciation/phrase
POST /api/plugins/session/pronunciation/judge
```

La elegibilidad de pronunciación está condicionada por la taxonomía de
materias del proyecto (recorre los ancestros buscando una raíz de
Languages / Sprachen). El endpoint judge devuelve
`{matches, score, feedback, missed_sounds}`.

## Plugin de gamificación (v1.16.0+)

```
GET  /api/plugins/gamification/xp/{user_id}
POST /api/plugins/gamification/xp/{user_id}/award
POST /api/plugins/gamification/xp/{user_id}/award-assessment
POST /api/plugins/gamification/xp/{user_id}/award-import
GET  /api/plugins/gamification/badges
GET  /api/plugins/gamification/badges/{user_id}
POST /api/plugins/gamification/badges/{user_id}/evaluate
GET  /api/plugins/gamification/streak/{user_id}
GET  /api/plugins/gamification/streak/{user_id}/heatmap
POST /api/plugins/gamification/streak/{user_id}/weekend-mode
POST /api/plugins/gamification/reset/{user_id}
```

`/streak/{user_id}/heatmap` devuelve
`[{date, count}, ...]` para los últimos 365 días (clampea entre
[7, 730]). El endpoint de restablecimiento pide doble confirmación y luego
borra las filas de `user_xp` + `user_badges` + `user_streaks`.

## Plugin de Anki (v1.17.0+)

```
GET    /api/plugins/anki/cards/{user_id}
POST   /api/plugins/anki/cards
PATCH  /api/plugins/anki/cards/{id}
DELETE /api/plugins/anki/cards/{id}
POST   /api/plugins/anki/cards/extract/session/{id}
POST   /api/plugins/anki/cards/extract/conversation/{id}
POST   /api/plugins/anki/cards/mark-exported
```

La extracción con IA es iniciada por el usuario. La ruta de extracción
de conversación también lee `analysis_result.vocabulary` (desde v1.20.0)
para producir tarjetas cloze sin una llamada adicional de IA cuando el
análisis ya ha poblado el array de vocabulario.

## Plugin de NotebookLM (v1.19.0+)

```
GET    /api/plugins/notebooklm/questions/{user_id}
POST   /api/plugins/notebooklm/questions
PATCH  /api/plugins/notebooklm/questions/{id}
DELETE /api/plugins/notebooklm/questions/{id}
POST   /api/plugins/notebooklm/generate-from-session/{id}
POST   /api/plugins/notebooklm/generate-from-project/{id}
POST   /api/plugins/notebooklm/study-guide/{project_id}
```

`/study-guide/{project_id}` devuelve `text/markdown` (una gran llamada
de IA con recorte de contenido hasta ~30K caracteres). Las ediciones del
usuario activan `edited=True` para que el re-ejecutor de IA las omita.

## Descubrimiento de plugins

```
GET /api/plugins/manifests
GET /api/plugins/health
GET /api/plugins/errors
```

Cada uno devuelve un mapa con clave por nombre de plugin. Utilizado por
la UI de Ajustes > Plugins para el estado de activación + visibilidad
de errores de carga.
