# Lecciones + internos del SRS

Esta página documenta cómo está conectada la pila de
funcionalidades de lecciones de contenido + SRS (v1.27.0–v1.31.0)
a través del backend, el frontend y dos plugins. Para la visión
general orientada al usuario, consulta
[`user-guide/lessons.md`](../user-guide/lessons.md).

---

## Visión general de la arquitectura

```
┌──────────────────────────────────────────────────────────┐
│ Frontend: visor de lecciones + sesión de repaso          │
│   pages/Lesson.tsx  ──→  ExerciseDispatcher  ──→  uno de │
│   pages/Review.tsx           ↓               4 componentes│
│                              ↓               de ejercicio │
│                              ↓                           │
│                   recordStepResult                       │
│                              ↓                           │
│                  elementErrors.recordBulk                │
│                              ↓                           │
└──────────────────────────────────────────────────────────┘
                              ↓
                   Límite IStorageService
                              ↓
   ┌─────────────────────┐      ┌─────────────────────────┐
   │ ApiStorage          │      │ DexieStorage            │
   │                     │      │                         │
   │ POST /api/users/    │      │ element-errors-dexie.ts │
   │   {id}/element-     │      │   espeja el servicio    │
   │   errors            │      │   backend 1:1 contra    │
   │                     │      │   IndexedDB             │
   └─────────────────────┘      └─────────────────────────┘
            ↓
   ┌──────────────────────────────────────────────────────┐
   │ Backend                                              │
   │                                                      │
   │  app/services/element_errors.py                      │
   │    - matriz de transición de upsert                  │
   │    - MASTERY_THRESHOLD = 3                           │
   │                                                      │
   │  app/services/element_srs.py                         │
   │    - planificador de bandas 1d/3d/7d                 │
   │    - orden: vencido → error_count → last_error_at    │
   │                                                      │
   │  app/services/lesson_progress.py                     │
   │    - upsert_progress con flip mark_completed         │
   │      activa lesson_session_unification               │
   │                                                      │
   │  app/services/lesson_session_unification.py          │
   │    - find_or_create_content_pseudo_project (lazy)    │
   │    - record_lesson_completion_session                │
   │    - dispara on_session_complete via manager._pm.hook│
   └──────────────────────────────────────────────────────┘
                              ↓
            ┌─────────────────────────────────┐
            │ Plugin de gamificación          │
            │   despacho on_session_complete  │
            │     method == "content"  →      │
            │       award_xp_for_lesson_      │
            │       session (fórmula lección) │
            │     else →                      │
            │       award_xp_for_session      │
            │       (fórmula chat, sin cambio)│
            │   badge_service.evaluate_user   │
            │     → 4 nuevos predicados       │
            └─────────────────────────────────┘
```

---

## Seguimiento de errores a nivel de elemento (v1.30.0 / Fase 46B)

### Modelo

`app/models/__init__.py:ElementError` con una restricción
UNIQUE compuesta sobre
`(user_id, set_id, lesson_id, exercise_id, element_key)`.
Claves de elemento con ámbito de lección según la decisión **D2**: la misma
palabra en dos lecciones distintas genera dos filas separadas.

```python
class ElementError(Base):
    user_id: str           # FK → users.id (CASCADE)
    set_id: str            # id del conjunto de contenido (string, no FK)
    lesson_id: str         # id de la lección de contenido (string, no FK)
    exercise_id: str       # id del ejercicio dentro de la lección
    element_key: str       # la palabra/par/frase específica
    element_type: str      # "vocabulary" | "grammar_rule"
    user_answer: str
    correct_answer: str
    error_count: int       # incrementado en cada intento incorrecto
    correct_streak: int    # incrementado en correcto, reiniciado en incorrecto
    last_error_at: datetime | None
    last_attempt_at: datetime
    mastered: bool         # True si correct_streak ≥ 3
    mastered_at: datetime | None
```

Desacoplado de `learning_sessions` (sin FK) por diseño:
las lecciones de contenido referencian IDs de conjunto/lección por
cadena, no mediante una unión relacional. Esto significa que la tabla
sobrevive a las eviciones de caché de forma independiente de cualquier
fila de sesión.

### Matriz de transición de upsert

`app/services/element_errors.py:upsert_element_error` es
el único mutador. Comportamiento:

| Disparador | Acción |
|---|---|
| Primera aparición (correcto) | INSERT de fila, `correct_streak=1` |
| Primera aparición (incorrecto) | INSERT de fila, `error_count=1` |
| Fila existente, intento correcto | `correct_streak += 1`; activa `mastered=True` si la racha alcanza `MASTERY_THRESHOLD` (3) |
| Fila existente, intento incorrecto en fila no dominada | `error_count += 1`, `correct_streak = 0` |
| Fila existente, intento incorrecto en fila **dominada** | degrada: `mastered=False`, `mastered_at=None`, `correct_streak=0`, `error_count += 1` |

El umbral de maestría es una constante a nivel de código
(`MASTERY_THRESHOLD = 3`); según la decisión **D4** es
intrínseco a la semántica del SRS, no un parámetro de configuración.

### Espejo en Dexie

`frontend/src/storage/element-errors-dexie.ts` espeja el
servicio backend 1:1 contra IndexedDB. El contrato sobre
`IElementErrorsNamespace` es idéntico en ambas implementaciones
de almacenamiento, de modo que el gate de lanzamiento en modo Dexie
(`make test-dexie-smoke`) detecta cualquier divergencia.

---

## Planificación del SRS (v1.30.0 / Fase 46C)

### Política de intervalos

`app/services/element_srs.py:next_review_due_at` proyecta la
próxima revisión de una fila no dominada:

| `correct_streak` | Intervalo |
|---|---|
| 0 | 1 día después de `last_attempt_at` |
| 1 | 3 días |
| 2 | 7 días |
| ≥ 3 | dominado — excluido de la cola |

### Ordenación por prioridad

El endpoint de la cola de repaso ordena por:

1. **Vencidos primero** (`next_review_due_at < now` tiene
   prioridad sobre `next_review_due_at > now`)
2. **Contador de errores descendente** (más errores = mayor prioridad)
3. **Último error primero** (el fallo más reciente tiene prioridad
   sobre fallos más antiguos, resolución en microsegundos mediante
   `-last_error_at.timestamp_us`)

La tupla está ordenada por `_sort_key` que devuelve
`tuple[int, int, int]` (el hotfix de CI v1.30.0 `9275841`
fijó la anotación de mypy tras una refactorización de datetime a
microsegundos enteros).

### Endpoint

`GET /api/users/{user_id}/element-errors/review-queue`
devuelve la cola priorizada. Equivalente en Dexie:
`computeReviewQueueDexie` en
`element-errors-dexie.ts`. El widget del Dashboard
`<ReviewQueueCard>` llama a uno u otro dependiendo del modo
de almacenamiento configurado y muestra el contador + la
insignia de vencidos + una llamada a la acción hacia la sesión de repaso.

---

## Unificación LessonProgress ↔ LearningSession (v1.31.0 / Fase 46F)

### La decisión

El trabajo de `ElementError` de v1.30.0 se desacopló
intencionalmente de `LearningSession`. La Fase 46F de v1.31.0 añade
la capa de unificación: cada finalización de lección de contenido
ahora escribe una fila `LearningSession` para que la
maquinaria existente de gamificación + seguimiento + racha la
recoja sin nuevos hooks.

Tres decisiones condicionan la forma:

- **D1 (pseudo-proyecto lazy)**: un `LearningProject`
  "Lecciones de Contenido" con `kind="content"` se crea
  automáticamente en la primera finalización de lección (nunca
  se siembra durante el proceso de incorporación). Uno por usuario.
- **D2 (`method="content"` 7.º valor)**: añadido al conjunto
  de valores válidos de `LearningSession.method`
  específicamente para la ruta de unificación. Los otros seis
  métodos (deductive / inductive / error_based /
  dialogic / contextual / ai_adaptive) cubren las sesiones de
  chat sin cambios.
- **D5 (reutilizar, no extender)**: no hay nuevo hookspec.
  `record_lesson_completion_session` dispara el hook
  existente `on_session_complete` mediante
  `manager._pm.hook`. Los manejadores existentes de los plugins
  de gamificación + seguimiento se ejecutan como si la lección
  fuera una sesión de chat, con despacho sobre `method`.

### Cambio de esquema

```python
# app/models/__init__.py — Fase 46F.1
LEARNING_PROJECT_KIND_STANDARD = "standard"
LEARNING_PROJECT_KIND_CONTENT = "content"

class LearningProject(Base):
    ...
    kind: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=LEARNING_PROJECT_KIND_STANDARD,
        server_default=LEARNING_PROJECT_KIND_STANDARD,
    )
```

Alembic `0020_learning_project_kind` añade la columna mediante
`batch_alter_table` + `add_column` con
`server_default="standard"` para que las filas existentes se
actualicen limpiamente en SQLite. La superficie de sincronización
recoge la columna para que el viaje de ida y vuelta a través de
`ApiStorage` ↔ `DexieStorage` funcione en ambas direcciones.

### Helper de unificación

`app/services/lesson_session_unification.py` tiene dos
funciones públicas:

- `find_or_create_content_pseudo_project(db, user_id)` —
  búsqueda idempotente; solo crea en caso de no encontrar.
- `record_lesson_completion_session(db, *, user_id,
  lesson_progress_id, score_correct, score_total)` —
  escribe la fila `LearningSession`, hace commit y luego dispara
  `on_session_complete`.

Ambas se invocan desde
`app/services/lesson_progress.py:upsert_progress` cuando
la fila pasa de `in_progress` a `completed`. La ruta de
escritura en la BD del helper propaga excepciones (problema real de BD),
pero la ruta de disparo del hook envuelve las excepciones de los
suscriptores según el patrón
`_fire_on_session_complete` del `routes.py` del plugin de sesión:
un fallo en la gamificación no puede deshacer la lección
que el usuario ya vio en la pantalla de resumen.

### Filtro en el frontend

`frontend/src/lib/learning-project.ts` expone
`isStandardProject` + `filterStandardProjects`. Tres
consumidores aplican el filtro:

- `DashboardFilterBar.tsx` (el selector de proyectos del dashboard)
- `ExportSection.tsx` (selector de exportación)
- `Anki.tsx` (desplegable de proyectos de Anki)

El endpoint backend expone intencionalmente el pseudo-proyecto
para que una futura vista de "toda la actividad" pueda suscribirse.
El filtro es una decisión de política de UI, no de ocultación de datos.

---

## Regla de XP para la fórmula de lección (v1.31.0 / Fase 46E.1)

`adaptive_learner_gamification.xp_service` incorpora:

- `compute_stars(correct, total)` — de 0 a 3 a partir de una
  puntuación, con bandas en 50 % / 75 % / 90 %. Espeja el
  `computeStars` del frontend en `lib/lesson-summary.ts` para que
  ambos lados proyecten la misma calificación en estrellas.
- `calculate_lesson_session_xp(*, stars, first_attempt,
  streak_days)` — calculador puro. 30 base + 10/estrella +
  20 primer-intento-3-estrellas + el mismo multiplicador de racha
  +25 %/día (limitado a 7) que la fórmula de chat.
- `_is_first_attempt(db, lesson_progress_id)` — lee
  `LessonProgress.step_results` JSON y devuelve True si y solo si
  cada fila de paso tiene `attempts == 1`.
- `award_xp_for_lesson_session(db, *, session)` — envoltorio
  de persistencia que resuelve user_id a partir del FK del proyecto
  y aplica la fórmula.

El despacho ocurre en `GamificationPlugin.on_session_complete`
según `session["method"]`. Los métodos de chat permanecen en
`award_xp_for_session`. El método de contenido se dirige a la
fórmula de lección. El payload de la sesión del helper de
unificación lleva las claves específicas de la lección
(`lesson_progress_id`, `score_correct`,
`score_total`); los payloads de sesiones de chat no las tienen, por lo
que el envoltorio de XP de lección degradaría con elegancia si
el despacho alguna vez se filtrara — pero la prueba de fijación de
regresiones en
`backend/tests/test_lesson_session_unification.py`
afirma el premio exacto de la lección (100 XP para una
finalización de 4/4 en primer intento + racha del primer día), por
lo que cualquier filtración aparecería de inmediato.

---

## Insignias de lección (v1.31.0 / Fase 46E.2)

Cuatro nuevos predicados añadidos a
`adaptive_learner_gamification.badge_service._EVALUATORS`:

| Clave | Predicado | Helper |
|---|---|---|
| `first_lesson` | `_completed_lesson_count >= 1` | cuenta `LessonProgress.status="completed"` (no a través de LearningSession, la fila de lección es la autoridad) |
| `lessons_10` | `_completed_lesson_count >= 10` | igual |
| `three_star_streak` | `_last_n_lessons_all_three_star(n=3)` | lee las últimas 3 `LessonProgress` completadas del usuario por `completed_at` desc; proyecta cada una mediante `xp_service.compute_stars` |
| `review_master` | `_mastered_elements_count >= 50` | cuenta `ElementError.mastered=True` |

Recuento del catálogo: **24 → 28** (+1 getting_started + 1
consistency + 2 depth). La prueba de simetría "every yaml badge has
an evaluator" existente (en
`backend/tests/test_gamification_badges_integration.py`)
detecta la divergencia entre ambas listas.

---

## Advertencias sobre el modo de almacenamiento

La cadena de seguimiento de elementos + SRS funciona de forma idéntica en
**ambos** modos de almacenamiento: el contrato `IElementErrorsNamespace`
es independiente del modo y el gate de lanzamiento en modo Dexie
(18 specs, incluyendo la ruta `/review`) bloquea cualquier regresión.

La unificación lección-sesión + los efectos secundarios de gamificación
son **solo para modo API**. En modo Dexie la finalización de la lección
sigue escribiendo `LessonProgress`, sigue registrando
filas `ElementError` y sigue alimentando la cola de repaso,
pero la escritura de `LearningSession` + el hook `on_session_complete`
nunca se disparan (no hay backend, no hay hookable). Los usuarios en
modo Dexie obtienen el bucle de repaso completo; los premios de XP / insignias
de la ruta de sesión de chat siguen funcionando, pero las finalizaciones de
lecciones no contribuyen todavía a ese total.

Una futura unificación de los efectos secundarios de gamificación en
`DexieStorage` (para que la finalización de una lección de un usuario
en modo Dexie también otorgue XP localmente) es un objetivo deliberadamente
excluido de v1.31.0: requeriría duplicar la implementación de la
fórmula en TypeScript o un shim de service worker para el hook
on_session_complete. Ambos son refactorizaciones más grandes de lo que
permite el alcance de v1.31.0.

---

## Dónde buscar a continuación

- `backend/app/services/element_errors.py` — la matriz de transición de upsert.
- `backend/app/services/element_srs.py` — el planificador.
- `backend/app/services/lesson_session_unification.py` —
  el pseudo-proyecto + disparo del hook.
- `plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/xp_service.py` —
  `calculate_lesson_session_xp` + despacho.
- `plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/badge_service.py` —
  los cuatro nuevos predicados.
- `frontend/src/lib/learning-project.ts` — el helper de filtro del
  pseudo-proyecto.
- `e2e/dexie/dexie-mode.spec.ts` — el gate de lanzamiento que
  previene regresiones en modo Dexie (spec de lecciones en
  `/lesson/...`, spec de repaso en `/review/...`).

---

## Token-diff + cloze + ronda de corrección (v1.35.0 / Fase 52)

Tres adiciones en capas que transforman el repaso pasivo en
aprendizaje activo:

**Token-diff + DiffHighlight** — las respuestas incorrectas de
texto libre y fichas de palabras ahora muestran `<DiffHighlight tokens={tokenDiff(
input, canonical)} />` en línea debajo del párrafo de resultado.
El desglose por ejercicio del resumen de lección muestra el mismo
diff para texto libre + fichas de palabras cuando el `user_answer`
almacenado de v1.35.0+ está disponible (las filas más antiguas usan
solo la línea canónica). Algoritmo en
`frontend/src/lib/exercises/token-diff.ts`: LCS puro a nivel de
palabra, normalizado con NFC, sensible a mayúsculas y acentos.

**Tipo de ejercicio cloze (esquema 1.1)** — quinto ExerciseType:
rellenar el hueco con marcadores `___` visibles. Dos modos de
representación: `type` (por defecto, `<input>`) y `select`
(`<select>` con opciones de `distractors`). Fan-out de SRS por
hueco mediante `deriveClozeAttempts`: un ElementAttempt por
hueco, para que el seguimiento de maestría por hueco funcione de
forma limpia. Renderer en
`frontend/src/components/exercises/ClozeExercise.tsx`;
esquema en
`plugins/adaptive-learner-plugin-content-loader/
adaptive_learner_content_loader/schema.py`.

**Generador de cloze** — `generateClozeFromError(error,
sourceExercise, sourceCard)` sintetiza un paso cloze a partir
de un ElementError. Algoritmo:

1. Si `sourceCard.token_roles` tiene una entrada cuyo
   `token === error.correct_answer`, deja ese token en blanco en
   `sourceCard.front`.
2. De lo contrario, si `sourceCard.front` contiene literalmente
   `error.correct_answer` exactamente una vez, déjalo en blanco.
3. De lo contrario, si la fuente es free_text y su prompt
   contiene la respuesta exactamente una vez, déjala en blanco.
4. De lo contrario, devuelve null: el llamador recae en el repaso.

Determinista: mismas entradas → salida byte-idéntica. Sin IA,
sin aleatoriedad, sin async. Los distractores llevan
`error.user_answer` primero (cuando difiere del correcto),
luego `sourceExercise.distractors` filtrados y deduplicados. Código
en `frontend/src/lib/exercises/cloze-generator.ts`.

**Ronda de corrección al final de la lección** —
`<CorrectionBlock />` se monta dentro de `LessonSummary` entre
la puntuación/desglose y los botones de acción. Al montarse,
lee las filas ElementError de la lección recién finalizada,
genera un cloze por cada fallo no dominado (máx. 5),
y guía al usuario por ellos. Cada cloze completado
escribe nuevas filas ElementAttempt contra el mismo
element_key bajo el que se registró el fallo original, por lo que
la racha + maestría del SRS avanza. Se oculta por sí solo en caso
de puntuación perfecta / sin errores / sin cloze construible. Código en
`frontend/src/components/exercises/CorrectionBlock.tsx`.

**Cloze en sesiones de repaso (Fase 52G)** —
la rama por elemento de `synthesizeReviewLesson`
(`_buildReviewStep`) ahora elige:

- fuente free_text o word_tiles → intenta cloze, recae en repaso
- fuente matching, picture_choice, cloze → siempre repaso

Criterios de decisión documentados en
`frontend/src/lib/review-lesson.ts`. Los IDs de pasos de repaso
empiezan con `review-`; los IDs de pasos cloze generados empiezan
con `review-cloze-` para la trazabilidad.

**Token-roles en fichas (Fase 52I)** — anotación opcional
`token_roles: list[{token, role}]` en Card con un enum cerrado de
roles gramaticales (article / verb / noun
/ adjective / preposition / gender_marker /
tense_marker). El generador los usa para elegir un hueco
semánticamente significativo en lugar de depender de la coincidencia
de subcadenas. Añadir un rol es un pequeño incremento de
schema_version; mantén el enum cerrado.
