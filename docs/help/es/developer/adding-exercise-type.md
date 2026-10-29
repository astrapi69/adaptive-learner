# Añadir un nuevo tipo de ejercicio

El modelo canónico **no** se amplía por especulación. Un nuevo tipo de
ejercicio solo se añade cuando un contenido concreto lo necesita, y
entonces como un único PR aditivo y pequeño. Esta es la receta
vinculante, derivada del trabajo real de opción múltiple `cloze`/`select`
(#1342) y del pipeline de esquema de EXP-039.

Antes de empezar, confirma que el tipo es un **tipo** nuevo de verdad, y
no una presentación o una convención ya cubierta por el
[catálogo de tipos de ejercicio](authoring-content.md#exercise-type-catalog-status)
(la opción múltiple de texto, Verdadero/Falso y desplegable/radio/casilla
**no** son tipos nuevos). Debe poder **calificarse de forma binaria en el
SRS** (un único resultado correcto/incorrecto por elemento): esa es la
línea que traza la lista de "excluidos deliberadamente" del catálogo.

## Pasos

1. **Entrada EXP / justificación.** Registra la necesidad, la semántica
   de calificación binaria y la delimitación frente a los tipos existentes
   en la exploración correspondiente (`docs/explorations/EXP-041-*` para
   la idoneidad de tipos de ejercicio, o una EXP nueva). Ningún tipo sin
   una razón documentada.
2. **Ampliar el formato en el engine.** El hogar canónico del formato de
   lección es el paquete
   [learn-content-engine](https://github.com/astrapi69/learn-content-engine):
   añade el tipo a su esquema, a su capa semántica escrita a mano
   (`src/rules.ts`) y a su
   [referencia de formato](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md),
   y después publica el engine. Un cambio de formato **empieza en el
   engine**: el `schema/*.json` de la app es un espejo de bytes de la
   release fijada con exactamente un escritor
   (`scripts/sync_schema_mirror_from_engine.py`, #2265).
3. **Subir el pin, ejecutar la sincronización.** Eleva el pin de
   `learn-content-engine` en `frontend/package.json` y ejecuta después
   `make sync-schema` en el **mismo PR**: refresca el espejo
   `schema/*.json` a partir del paquete instalado y regenera cada
   artefacto derivado: la capa Pydantic estructural
   (`plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema_generated.py`
   mediante `scripts/generate_pydantic_models.py`), la réplica del
   esquema ajv del navegador
   (`frontend/src/lib/content/validation/lesson.schema.generated.json`)
   con su validador independiente, y el documento de referencia de formato. **Nunca edites a mano** un
   artefacto espejado o generado; la barrera de deriva
   `make sync-schema-check` falla si lo haces.
4. **Versión del esquema.** Mantén `CURRENT_SCHEMA_VERSION` en `models.py`
   alineada con la versión del esquema del engine fijado (**minor** =
   aditiva; el contenido antiguo sigue validando gracias a la coincidencia
   de versión mayor). No añadas reglas entre campos del lado de la app a
   `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py`:
   las reglas semánticas son del engine y se ejecutan en tiempo de
   autoría y en el frontend antes de guardar un conjunto de usuario
   (#3245); el backend solo almacena y sirve la lección.
5. **Registrar el renderizador.** Añade la rama + el tipo a
   `SUPPORTED_EXERCISE_TYPES` en
   `frontend/src/components/exercises/shell/ExerciseDispatcher.tsx`. El
   **registro debe ser igual al enum**: una prueba de paridad lo impone,
   así que un tipo sin renderizar hace fallar la CI (el invariante que
   evita el esquema muerto).
6. **Conectar calificación / SRS.** Emite un `ExerciseScored` desde el
   renderizador mediante `useControlledExercise`; la ruta compartida
   `onComplete` → `recordStepResult` en `LessonStepView.tsx` ya reparte
   cada intento a través de `getStorage().elementErrors.recordBulk`:
   reutilízala, no añadas una segunda ruta de registro.
7. **Validación del repo de contenido.** Amplía el validador del cliente
   (`frontend/src/lib/content/validation/content-validator.ts`). Los
   mínimos de calidad viven en el `quality-rules.json` del engine
   (espejado en `schema/quality-rules.json`); si el tipo les afecta,
   amplíalos en el engine, no en la app.
8. **Documentación de autoría.** Añade el tipo a la
   [tabla del catálogo](authoring-content.md#exercise-type-catalog-status)
   y un bloque de referencia `### <type>` con un ejemplo JSON (EN + DE).
9. **Pruebas.** El esquema acepta un ejemplo válido y rechaza uno
   inválido (campo obligatorio ausente / clave extra); el renderizador
   renderiza y califica correcto/incorrecto; el intento del SRS queda
   registrado; añade una línea base visual móvil si el aspecto del
   control es nuevo.
10. **Seguimiento (no en este PR).** Los repos de contenido
    (`adaptive-learner-content`) adoptan el nuevo tipo cuando vuelven a
    fijar su release del engine; anótalo, no te bloquees por ello.

## Por qué esto se mantiene pequeño

Como el formato se espeja desde la release fijada del engine y cada
artefacto de la app deriva de ese espejo (paso 3), y la prueba de paridad
del dispatcher impone registro igual a enum (paso 5), un tipo nuevo es un
cambio aditivo con una forma fija: engine → pin → generar → renderizador
→ calificación → documentación → pruebas. Ninguna copia paralela
mantenida a mano puede derivar, y ningún tipo puede publicarse sin
renderizador.
