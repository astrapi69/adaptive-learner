# Crear contenido de lecciones

Esta guía describe paso a paso cómo configurar un nuevo conjunto
de lecciones para el cargador de contenido de Adaptive Learner.
Quien quiera construir un conjunto de idiomas o temático, para uso
propio o como aportación al fondo público de contenido, debería
leerla entera una vez antes de la primera lección.

## ¿Qué es un conjunto de contenido?

Un **conjunto de contenido** es un paquete versionado de lecciones
que un usuario puede descargar desde la página del explorador de
conjuntos (`/content`). El plugin del cargador de contenido
(v1.27.0) se encarga del descubrimiento, la descarga, el caché y
la conciliación de versiones en ambos modos de almacenamiento.

Un conjunto tiene tres niveles:

1. **Manifiesto raíz** (`manifest.yaml`) - enumera cada conjunto
   del repo. El explorador de conjuntos lo lee para el catálogo de
   origen.
2. **Manifiesto del conjunto** (`sets/{set-id}/manifest.yaml`) -
   hermano del manifiesto raíz, enumera los archivos de lección
   del conjunto concreto.
3. **Archivos de lección** (`sets/{set-id}/lessons/NN-slug.json`)
   - un archivo JSON por lección, validado contra el esquema de
   lección en cada descarga (ver *El esquema es la única fuente de
   verdad* más abajo).

Los conjuntos que se incluyen con Adaptive Learner residen en el
repo de contenido separado
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(extraído como checkout hermano `../adaptive-learner-content` y
empaquetado offline en la build de GitHub Pages mediante
`frontend/scripts/copy-bundled-content.mjs`) y sirven bien como
plantilla. El tamaño actual de la biblioteca (número de lecciones /
conjuntos / dominios, la tabla por conjunto y los dominios activos)
es el bloque CONTENT-STATS del [`README.md`](https://github.com/astrapi69/adaptive-learner#readme)
del proyecto - ese bloque es la única fuente de verdad, generado a
partir de un checkout fresco del contenido, así que esta guía no
duplica los números.

## El esquema es la única fuente de verdad (EXP-039)

El formato de lección/ejercicio tiene **una definición canónica**: el
JSON Schema de lección que publica el paquete npm
[learn-content-engine](https://github.com/astrapi69/learn-content-engine)
(inmutable por release publicada). Dentro de esta app, la capa
Pydantic **estructural** del plugin del cargador de contenido
(`adaptive_learner_content_loader.schema`) se **regenera** a partir
de ese espejo (`scripts/generate_pydantic_models.py`); solo los
validadores semánticos entre campos se escriben a mano.
`make sync-schema` refresca el espejo y vuelve a emitir los
artefactos derivados, y las barreras de paridad de bytes demuestran
que `schema/*.json` es igual a la release fijada del engine. Los
lugares que antes derivaban ya no pueden hacerlo:

- `schema/lesson.schema.json` (+ archivos hermanos): el JSON Schema
  legible por máquina (Draft 2020-12). Referéncialo desde un `.json`
  de lección mediante una clave `"$schema"` de nivel superior para
  obtener autocompletado del IDE y validación en línea.
- `schema/quality-rules.json`: los mínimos de calidad compartidos
  (p. ej. número de ejercicios, número de respuestas aceptadas de
  free-text), consumidos por el validador de contenido del lado del
  cliente en lugar de una segunda copia mantenida a mano.
- Los tipos de lección TypeScript del frontend y la página MkDocs
  [Lesson format reference](lesson-format-reference.md) también se
  generan (**no los edites a mano**); siguen el espejo del engine,
  así que vuelve a ejecutar el generador tras cada re-pin.

Una barrera contra la deriva (`make sync-schema-check`, parte de
`release-test`, más `backend/tests/test_lesson_schema_drift.py` en
`make test`) falla si algún artefacto generado diverge del espejo
fijado del engine. El cierre de la cadena es la barrera de paridad
de bytes app-contra-engine: `make engine-parity-check`
(`scripts/check_engine_schema_parity.py`), el pin offline
`engine-schema-parity.test.ts` y el test de coherencia del pin
`engine-pin.test.ts` (dependencia de `frontend/package.json` ==
`schema/engine-version.txt`). Los repos de contenido reflejan **la
release fijada del engine** (no este repo) y validan contra ese
espejo en su propia CI.

**Procedimiento para cambios de formato (autoridad del esquema en el
engine):** un cambio en el formato de lección empieza en el engine, o
se ratifica allí: primero PR en el engine + release npm; después esta
app sube el pin del engine (`frontend/package.json` +
`schema/engine-version.txt`) y vuelve a ejecutar `make sync-schema`,
que refresca el espejo y regenera la capa Pydantic estructural; solo
los nuevos validadores semánticos se escriben a mano; después los
repos de contenido actualizan su pin `engine-version.txt`. Una
edición manual del espejo (o un pin obsoleto) pone en rojo las
barreras de paridad de bytes; el paso olvidado se hace visible, nunca
hay deriva silenciosa.

## Pares de idiomas (v1.44.0)

Cada conjunto de contenido declara el PAR de idiomas que enseña:

- **`target_language`** - lo que el aprendiz APRENDE (p. ej.
  `fr`).
- **`source_language`** - lo que el aprendiz ya HABLA, es decir, el
  idioma en el que están escritos los campos **`back`** de las
  tarjetas, las **`notes`** y el texto de **teoría** (p. ej.
  `de`).

Esto es justamente lo que hace que "Francés para angloparlantes"
sea un conjunto *distinto* de "Francés para germanoparlantes":
mismo destino (`fr`), distinto idioma de origen (`en` frente a
`de`), distinto idioma de explicación. Un aprendiz solo ve
conjuntos cuyo `source_language` coincide con uno de los idiomas
que habla (el idioma de la app más los idiomas adicionales
opcionales en Ajustes → Aprendizaje).

Las IDs de conjunto codifican el par como
`{destino}-{nivel}-from-{origen}` (p. ej. `fr-a1-from-de`), y cada
conjunto declara un **`path`** que apunta a su directorio de
idioma de origen (`sets/de/fr-a1`). Un conjunto lleva además
**`title`** (en el idioma de origen, lo que lee el aprendiz) y
**`title_native`** (en el idioma de destino, como segundo título).

Ambos códigos deben ser ISO 639-1 (dos letras), y
`source_language` debe diferir de `target_language`. Los conjuntos
anteriores a v1.2 sin estos campos siguen cargándose: la antigua
clave `language` se acepta como `target_language`, y
`source_language` recurre a `en`.

## Disposición de directorios

El árbol está organizado por IDIOMA DE ORIGEN, luego
destino+nivel:

```
my-content-repo/
  manifest.yaml               # Root: lists every set (with path + pair)
  sets/
    de/                       # Source language: German
      fr-a1/                  # Target French, level A1  -> ID fr-a1-from-de
        manifest.yaml         # Set: lists the lessons
        lessons/
          01-begruessung.json
          ...
        assets/               # optional images / audio
    en/                       # Source language: English
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

### Índice de búsqueda (`search-index.json`)

El descubrimiento y la búsqueda de contenido (la superficie
*Descubrir*) se apoyan en un `search-index.json` ligero publicado en
la raíz del repo (~4 KB, solo metadatos - sin contenido de tarjetas).
El repo de contenido oficial lo proporciona, y la app obtiene los
índices de cada repo configurado del lado del cliente (a prueba de
CORS, cacheados en localStorage con un TTL stale-while-revalidate de
24 h) para que un aprendiz pueda ENCONTRAR un conjunto antes de
descargarlo. Cada entrada anuncia el `id`, `name`, `description`,
`source_language` / `target_language`, `level`, `domain`,
`lesson_count`, `card_count`, `tags` del conjunto, un flag
`ai_validated`, un `trust_level`, un `book` acompañante opcional y una
marca de tiempo `updated_at`. Mantenlo sincronizado con los
manifiestos de los conjuntos; un PR al repo oficial lo regenera.

## Formato del manifiesto

El esquema de campos del manifiesto (el `manifest.yaml` raíz que
enumera los conjuntos del repo, y cada campo obligatorio y opcional:
`schema_version`, `name`, y por conjunto `id`, `title`,
`title_native`, `target_language`, `source_language`, `level`,
`version`, `lesson_count`, `path`, `domain`, `tags`, `book`,
`visibility`) vive en la referencia del engine:
[learn-content-engine, Manifest format](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md#manifest-format).
El esquema estricto del engine (los campos desconocidos se rechazan)
lo valida, así que la lista de campos anterior no puede derivar.
Redacta los campos del par de idiomas (`target_language` /
`source_language`) como se describe en
[Pares de idiomas](#pares-de-idiomas-v1440); el alias `language`
anterior a v1.2 sigue cargándose, pero se desaconseja para conjuntos
nuevos.

El campo opcional **`visibility`** (engine 0.14.0+, `visible` si no
se indica) es una **indicación de visualización** para las apps
consumidoras: `visibility: hidden` pide a la app que no muestre el
conjunto a los estudiantes - pensado para fixtures de
referencia/conformidad que deben permanecer en el repo para la
validación del engine pero que no son contenido de aprendizaje. La
app filtra los conjuntos ocultos de las superficies de exploración
y de Descubrir (incluso si ya están en caché); el engine los sigue
validando. Ya no existe una lista de conjuntos ocultos que
mantener en el lado de la app.

Comportamiento del cargador específico de la app a tener en cuenta:

- El manifiesto del conjunto enumera cada archivo de lección bajo
  `metadata.lessons`, y el cargador de contenido itera esa lista
  **en el orden dado**: los nombres de archivo en disco son
  irrelevantes, solo cuenta el orden del manifiesto:

  ```yaml
  metadata:
    lessons:
      - 01-intro.json
      - 02-articles.json
      - ...
  ```

## Esquema de lección

Cada lección es un único archivo JSON: metadatos de nivel superior
(`id`, `title`, `description`, `estimated_minutes`), una lista de
**cards** (las unidades aprendibles más pequeñas - ids estables,
pares front/back, `notes` en Markdown, `tags` para el SRS) y una
lista de **steps**, cada uno o bien un paso de THEORY (un `body` en
Markdown, opcionalmente un enlace `example_url` o `examples` en
línea) o bien un paso de EXERCISE (exactamente un ejercicio).

La referencia completa del formato, campo por campo - cada campo,
cada tipo de ejercicio, cada modo cloze, con ejemplos JSON validados
por la suite de tests del engine - vive en la **referencia del
engine**:

- [learn-content-engine - `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md)
  - la referencia canónica del formato de lección para autoras y
  validadores de terceros (sin necesidad de un checkout de la app)
- el esquema legible por máquina incluido con cada release del engine:
  `import schema from "learn-content-engine/schema/lesson.schema.json"`
- el gemelo dentro de la app: la
  [Lesson format reference](lesson-format-reference.md) generada

El esquema incluido del engine es idéntico byte a byte al
`schema/lesson.schema.json` generado de este repo (garantizado por
`make engine-parity-check`), de modo que "valida contra el engine" y
"valida en la app" son la misma afirmación.

## Qué tipo de ejercicio para qué objetivo de aprendizaje

Elige el tipo de ejercicio por el **objetivo de aprendizaje**, no por
variedad. La evaluación por coincidencia exacta palabra por palabra -
un `word_tiles` de frase entera, o un `free_text` de frase completa -
falla para la **producción libre**: un concepto puede formularse de
muchas maneras correctas, así que un aprendiz con contenido correcto
resulta marcado como incorrecto palabra por palabra. Ese es el momento
más desmotivador que puede producir una lección de autoría. En su
lugar, adecúa el tipo al objetivo:

| Objetivo de aprendizaje | Tipo adecuado |
|---|---|
| Un hecho con una sola respuesta | `cloze` (un hueco) |
| Reconocer un concepto | opción múltiple (`cloze` en modo `select`) / `matching` |
| Definir un concepto | `cloze` con huecos en términos clave |
| Explicación libre / transferencia / comparación | todavía no hay un tipo de coincidencia exacta - usa `cloze` / opción múltiple por ahora; la autoevaluación está planificada |
| Frase con un único orden de palabras no ambiguo (aprendizaje de idiomas) | `word_tiles` |

Regla práctica: reserva `word_tiles` para frases cuyo orden de
palabras sea genuinamente único (un ejercicio de traducción), y crea
definiciones y hechos como `cloze` (u opción múltiple vía `cloze` en
modo `select`). Nunca metas una definición de forma libre en
`word_tiles` o en un `free_text` de frase completa - no hay una
evaluación justa por coincidencia exacta para ella. Análisis completo:
ver EXP-041
(`docs/explorations/EXP-041-aufgabentyp-eignung-und-faire-bewertung.md`).

## Catálogo de tipos de ejercicio (estado)

Una referencia de cada tipo de ejercicio: lo que se incluye, lo que es
expresable sin un tipo nuevo, lo que es candidato y lo que se excluye
deliberadamente. El modelo canónico **no** se amplía sobre el papel -
un tipo se incluye solo con su renderizador (el registro
`SUPPORTED_EXERCISE_TYPES` debe ser igual al enum `ExerciseType`; un
test de paridad lo impone, la lección aprendida de los casos
v1.4-preview / `picture_choice`). Los tipos nuevos se añaden ante una
demanda concreta de contenido mediante la receta
[Adding a new exercise type](adding-exercise-type.md).

### Implementados (el enum `ExerciseType`)

| Tipo | Para qué (objetivo de aprendizaje, EXP-041) | Nota |
|------|-----------------------------------|------|
| `matching` | Reconocer / emparejar conceptos | Arrastrar parejas, ≥ 3 parejas. |
| `picture_choice` | Reconocer a partir de una **imagen** real | ≥ 2 imágenes, exactamente una correcta. No para opción múltiple de texto. |
| `free_text` | Producir una respuesta corta con forma de hecho | Coincidencia exacta, luego Levenshtein ≤ 1. |
| `word_tiles` | Un único orden de palabras no ambiguo (idioma) | Fichas barajadas; `accept_orderings` para variantes. |
| `cloze` (`type`) | Un hecho con una sola respuesta | Un `<input>` por hueco. |
| `cloze` (`select`) | Opción múltiple única (mecanismo legacy) | Se renderiza como botones pulsables (#1342). `accept[0]` correcto + `distractors`. |
| `cloze` (`multiselect`) | "Selecciona todo lo que aplique" (mecanismo legacy) | Coincidencia de conjunto exacto sobre `accept` (todas correctas) + `distractors` (#1195). |
| `multiple_choice` | **Opción múltiple de texto nativa** (esquema v1.6, #1525) | `options` (`{text, correct?}`, textos únicos) + `multiple`. Única = exactamente una correcta; múltiple = coincidencia de conjunto exacto, sin puntos parciales. |

Desde el esquema v1.6 existe un tipo nativo `multiple_choice`.
**Coexiste** con el mecanismo `cloze` `select`/`multiselect` (EXP-036
§4.3, #890) - la opción múltiple basada en cloze existente sigue
siendo válida, nada queda deprecated. Prefiere `multiple_choice` para
el nuevo contenido de opción múltiple de texto: la corrección es un
flag por opción, así que la trampa de la disyunción accept/distractors
no puede ocurrir. Ver
[Creación de opción múltiple](#creacion-de-opcion-multiple).

### Nivel de extensión (el espacio de nombres `ext:`)

Más allá del enum core cerrado hay tipos de ejercicio en el espacio de
nombres `ext:<vendor>-<name>`. Son estructuralmente opacos para el
esquema core: una lección que los use los declara en
`requires_extensions`, y el payload lo valida la extensión registrada,
nunca el esquema core. El mecanismo se describe en la referencia del
engine
[learn-content-engine - `docs/extensions.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/extensions.md).
La app ha adoptado cinco tipos de extensión (`SUPPORTED_EXT_EXERCISE_TYPES`
en el `ExerciseDispatcher`; una barrera de paridad mantiene el
dispatcher y el guard de carga sincronizados, de modo que todo lo
cargable es renderizable):

| Tipo | Para qué | Payload (`ext_payload`) | Adoptado |
|------|----------|-------------------------|---------|
| `ext:al-categorization` | Clasificar términos en grupos | `categories: [{name, items[]}]`, al menos 2 grupos | #1591 (primer tipo de extensión, inventario #1579) |
| `ext:al-error-correction` | Corregir un texto erróneo | `tokens[]` + `error_index` + `accept[]` | #1593 |
| `ext:al-reading-comprehension` | Comprensión lectora (pasaje + preguntas) | `passage` + `questions[]` (cada una una subpregunta `multiple_choice` / `free_text`) | #1603 |
| `ext:al-graded-quiz` | Cuestionario calificado | `questions[]` (cada una con `points`) + `pass_threshold` opcional | #1616; el conjunto de referencia de demostración está oculto en Descubrir / Mi contenido (#1702) |
| `ext:al-dictation` | Dictado de audio (escuchar y luego transcribir) | `audio` (un clip de `assets/` o un URI de datos incrustado mediante la subida del editor, #1911) + `accept[]` (coincidencia de transcripción tolerante) | #1881 (quinta adopción) |

**Dos vías de autoría.** Los ejercicios de extensión pueden crearse
(a) directamente como JSON del repo de contenido (la vía canónica,
descrita en la referencia del engine) o (b) en la app. El Creador de
lecciones incorporó un **asistente de autoría de extensiones**
(#1852), al que se llega desde la plantilla *Tipos de ejercicio
avanzados* en el paso 1, que cubre los cinco tipos (#1859
categorización + corrección de errores, #1865 comprensión lectora +
cuestionario calificado, #1887 dictado). El dictado también es
accesible desde el selector de tipos de ejercicio core en el paso 3,
tras una barrera `requires_extensions` generalizada (#1895). Cualquiera
de las dos vías emite el mismo JSON de lección y define
`requires_extensions` (versionado, p. ej. `ext:al-dictation@1`).

#### Ejemplo por tipo de extensión

Cada bloque es el objeto de ejercicio tal como aparece en un `.json`
de lección; los datos específicos del tipo viven bajo `ext_payload`.
La referencia canónica de campos es el `docs/extensions.md` del engine.

```json
{
  "type": "ext:al-categorization",
  "prompt": "Sort each word into fruit or vegetable.",
  "ext_payload": {
    "categories": [
      {"name": "Fruit", "items": ["apple", "banana"]},
      {"name": "Vegetable", "items": ["carrot", "potato"]}
    ]
  }
}
```

```json
{
  "type": "ext:al-error-correction",
  "prompt": "One word is wrong. Correct it.",
  "ext_payload": {
    "tokens": ["The", "two", "child", "are", "playing"],
    "error_index": 2,
    "accept": ["children"]
  }
}
```

```json
{
  "type": "ext:al-reading-comprehension",
  "prompt": "Read the text and answer.",
  "ext_payload": {
    "passage": "Marie is sitting in a café. She orders a coffee and reads a book.",
    "questions": [
      {
        "prompt": "Where is Marie?",
        "type": "multiple_choice",
        "options": [
          {"text": "In a café", "correct": true},
          {"text": "At home"},
          {"text": "At the station"}
        ]
      }
    ]
  }
}
```

```json
{
  "type": "ext:al-graded-quiz",
  "prompt": "Greetings quiz.",
  "ext_payload": {
    "pass_threshold": 60,
    "questions": [
      {
        "prompt": "How do you say 'hello' in French?",
        "type": "multiple_choice",
        "points": 1,
        "options": [
          {"text": "Bonjour", "correct": true},
          {"text": "Merci"},
          {"text": "Au revoir"}
        ]
      }
    ]
  }
}
```

```json
{
  "type": "ext:al-dictation",
  "prompt": "Listen and type what you hear.",
  "ext_payload": {
    "audio": "assets/audio/comment-ca-va.mp3",
    "accept": ["Comment ça va ?", "Comment ca va"]
  }
}
```

### Disponibilidad en el asistente de lecciones

Jugable (existe un renderizador), generable (la mezcla de IA puede
producirlo) y añadible manualmente (lo añades y editas a mano en el
paso 3) son tres cosas distintas. Los seis tipos core son jugables Y
generables: el selector de tipos del asistente de creación de
lecciones (`ALL_TYPES` en `ExerciseGenerator.tsx`) ofrece cada tipo
core, y cada ejercicio del paso 3 es editable en línea y reordenable,
con un botón manual **+ Añadir ejercicio** (#1849, #1853).

| Tipo | Jugable | Generable (mezcla de IA) | Añadible manualmente (paso 3) |
|------|----------|----------------------|---------------------------|
| `matching` | sí | sí | sí |
| `free_text` | sí | sí | sí |
| `cloze` | sí | sí | sí |
| `word_tiles` | sí | sí | sí |
| `picture_choice` | sí | sí | sí |
| `multiple_choice` | sí | sí (#1853; control de modo única/múltiple #1888) | sí |
| `ext:al-dictation` | sí | no | sí, mediante el selector core (#1895) o el asistente de extensiones (#1887) |
| `ext:al-categorization` | sí | no | mediante el asistente de extensiones (#1859) |
| `ext:al-error-correction` | sí | no | mediante el asistente de extensiones (#1859) |
| `ext:al-reading-comprehension` | sí | no | mediante el asistente de extensiones (#1865) |
| `ext:al-graded-quiz` | sí | no | mediante el asistente de extensiones (#1865) |

Los cuatro tipos de extensión que no son dictado se crean en el
asistente de extensiones (o como JSON del repo de contenido), nunca se
mezclan en la generación core de IA.

**Escuchar primero es un modo, no un tipo.** Desde #1687 (decisión
#1600, opción A) los ejercicios `free_text` y `matching` pueden llevar
un elemento de audio primero (escuchar primero, luego responder). El
tipo del ejercicio no cambia. La opción B de la misma decisión, un
tipo de dictado, se incluyó como la extensión `ext:al-dictation`
(#1881), documentada en el nivel de extensión anterior.

### El Creador de lecciones como herramienta de autoría

El Creador de lecciones dentro de la app (`/create-lesson`) es una
superficie de autoría completa, no solo un botón de generación por IA:

- **Cada ejercicio del paso 3 es editable en el sitio.** Cada
  ejercicio generado o añadido se abre en un editor en línea (los seis
  tipos core, más los editores de extensión); reordena arrastrando,
  elimina o regenera toda la mezcla (#1845).
- **Añade un ejercicio a mano.** El botón **+ Añadir ejercicio**
  elige un tipo y añade un ejercicio vacío directamente al editor en
  línea, para que puedas crear sin ninguna generación de IA (#1849,
  #1853). El selector enumera los seis tipos core más el dictado
  (#1895).
- **La frase de ejemplo impulsa la generación.** Una tarjeta (paso 2)
  puede llevar una **frase de ejemplo** opcional. Es lo que habilita
  la generación de `cloze` y `word_tiles` para esa tarjeta (para
  cloze, la frase debe contener el término front de la tarjeta para
  poder ocultarlo), y una imagen de tarjeta habilita `picture_choice`.
  Sin ellas, esos tipos se omiten en silencio, y el paso 3 explica qué
  tipo seleccionado no produjo nada (#1847, #1848).
- **Los prompts generados siguen el idioma de la interfaz.** Las
  plantillas de instrucción de los ejercicios se localizan en el
  momento de la generación (#1857), de modo que una autora en una
  interfaz en alemán obtiene prompts en alemán, no valores por defecto
  en inglés. Cuando abres una lección más antigua para editarla,
  cualquier prompt de ejercicio que siga siendo idéntico byte a byte a
  un valor por defecto en inglés legacy se migra de forma oportunista
  a la plantilla del idioma de la interfaz (solo estado de edición,
  persistido solo si guardas) (#1861).

### Expresable sin un tipo nuevo (convenciones, no tipos)

| Concepto | Cómo |
|---------|-----|
| Verdadero/Falso, Sí/No | `multiple_choice` de dos opciones (o un `cloze` `select` de dos opciones) |
| Desplegable / radio / casilla | Presentación de `multiple_choice` / cloze select - no tipos separados |

### Planeados si hacen falta (candidatos - NO un compromiso)

| Candidato | Cercano a | Cuándo |
|-----------|------|------|
| Ordenar / clasificar | `word_tiles` | Solo ante una demanda concreta de contenido, luego mediante la receta. |
| Campo numérico (comparación numérica) | `free_text` | Solo ante una demanda concreta de contenido, luego mediante la receta. |

### Excluidos deliberadamente

| Excluido | Por qué (una línea) |
|----------|----------------|
| Ensayo / texto largo / dibujo / fórmula / revisión por pares / autoevaluación libre | No evaluable de forma binaria por el SRS; autoevaluación aplazada (#1268). |
| Audio / vídeo / subida de archivos | Almacenamiento + infraestructura; entra en conflicto con offline-first. Única excepción: los clips cortos de audio de dictado que el editor de ejercicios incrusta en la lección como URI de datos. |
| Hotspot / simulación / memoria / crucigrama | Esfuerzo de desarrollo sin valor para el SRS (una decisión posterior y separada, si acaso). |
| Matriz / Likert / deslizador | Tipos de encuesta, no tipos de aprendizaje. |
| Selectores de fecha / hora | Tipos de formulario, no tipos de aprendizaje. |

## Referencia de tipos de ejercicio

La referencia de campos por tipo - `matching`, `picture_choice`,
`free_text`, `word_tiles`, `multiple_choice` y `cloze` con sus modos
`type` / `select` / `multiselect`: campos obligatorios, ejemplos JSON
y las reglas semánticas (marcadores `___` de cloze == `blanks`,
integridad referencial de `card_ids`, disyunción accept/distractors de
multiselect, exactamente-una-correcta de picture-choice) - vive en la
referencia del engine:
[learn-content-engine - `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md).
Cada ejemplo JSON de allí se extrae y valida con la suite de tests del
engine, así que la referencia no puede quedarse obsoleta. Las
convenciones de autoría específicas de la app de abajo se quedan aquí.

### Creación de opción múltiple

**Preferido (esquema v1.6+, #1525): el tipo nativo `multiple_choice`.**
Las opciones llevan su propio flag `correct`, de modo que no hay listas
accept/distractors separadas que mantener disjuntas. `multiple: false`
(predeterminado) es opción única (exactamente una correcta);
`multiple: true` es "selecciona todo lo que aplique" (evaluación de
conjunto exacto, sin puntos parciales):

```json
{
  "id": "ex-capital",
  "type": "multiple_choice",
  "prompt": "What is the capital of France?",
  "card_ids": ["card-paris"],
  "options": [
    {"text": "Paris", "correct": true},
    {"text": "Berlin"},
    {"text": "Madrid"},
    {"text": "Rome"}
  ]
}
```

**Mecanismo legacy (sigue siendo plenamente válido: coexistencia, nada
deprecated):** antes de v1.6, la opción múltiple de texto se creaba
como `cloze` en modo `select` (EXP-036 §4.3, #890). Una pregunta de
respuesta única es un cloze con un hueco: la `sentence` (que termina en
`___`) es la pregunta, el `accept[0]` del hueco es la opción correcta y
los `distractors` son las opciones incorrectas. Ejemplo:
`"sentence": "The capital of France is ___."`,
`"blanks": [{"accept": ["Paris"]}]`, `"cloze_mode": "select"`,
`"distractors": ["Berlin", "Madrid", "Rome"]`.

También puedes poner la pregunta entera en `prompt` y usar un
`"sentence": "___"` a secas - el renderizador muestra un `<select>` con
la respuesta correcta + los distractores, evalúa la elección, da
feedback y alimenta el SRS:

```json
{
  "id": "ex-hook-state",
  "type": "cloze",
  "prompt": "Which hook manages local state in a function component?",
  "card_ids": ["card-usestate"],
  "sentence": "___",
  "blanks": [{"accept": ["useState"]}],
  "cloze_mode": "select",
  "distractors": ["useEffect", "useContext", "useRef"]
}
```

> **Nunca crees opción múltiple de texto como `picture_choice`.** Ese
> tipo es solo para assets de imagen reales; con opciones de texto
> renderiza mosaicos de marcador de posición, no un control usable
> (cf. astrapi69/adaptive-learner-content-test#10). La opción múltiple
> de texto es `multiple_choice` (preferido) o `cloze` en modo
> `select`, como arriba.

**"Selecciona todo lo que aplique"** (dos o más respuestas correctas,
p. ej. una pregunta de examen de conducir) usa
`cloze_mode: "multiselect"`:

```json
{
  "type": "cloze",
  "cloze_mode": "multiselect",
  "sentence": "Which cities are in Germany?",
  "accept": ["Berlin", "Hamburg"],
  "distractors": ["Vienna", "Zurich"]
}
```

**Se admiten varios huecos por cloze**: cada `___` de la frase se
asigna por orden a la siguiente entrada de `blanks`. Cada hueco puede
tener su propio hint + placeholder + lista accept. El SRS de elementos
despliega un ElementAttempt por hueco: quien rellena con fluidez el
hueco A pero falla constantemente el hueco B obtiene un seguimiento de
dominio con granularidad por hueco.

**Roles de token en las Cards (Fase 52I / v1.35.0)** - metadatos
opcionales de la Card con los que el generador de cloze puede elegir en
tiempo de ejecución (sesiones de repaso + la ronda de corrección al
final de la lección) un hueco semánticamente significativo:

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "eine Katze",
  "tags": ["article"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

Enum cerrado de roles: `article` / `verb` / `noun` / `adjective` /
`preposition` / `gender_marker` / `tense_marker`. Añadir un rol es un
incremento de versión menor del esquema - no lo amplíes en línea.

## Escrituras no latinas: convención de transliteración

Reglas vinculantes para conjuntos cuyo idioma de destino usa una
escritura no latina (japonés, chino, coreano, griego, hindi, ...).
Establecidas y aplicadas en el repo de contenido - precedentes:
[content#90](https://github.com/astrapi69/adaptive-learner-content/issues/90),
[content#91](https://github.com/astrapi69/adaptive-learner-content/issues/91);
barridos de lagunas restantes:
[content#106](https://github.com/astrapi69/adaptive-learner-content/issues/106),
[content#107](https://github.com/astrapi69/adaptive-learner-content/issues/107).

**1. Regla de dirección.** La transliteración es solo para el idioma
**de destino** no latino cuando el idioma de origen escribe con
escritura latina (de→ja, de→zh, de→ko, ...). Un idioma **de origen**
no latino con un destino en escritura latina (hi→en, el→fr) no recibe
transliteración - el aprendiz ya lee su propia escritura.

**2. Formato.** Paréntesis redondos directamente tras el original:
こんにちは (konnichiwa). En los pasos de teoría siempre; en opciones y
prompts solo donde sea inofensivo (ver la regla de no-traición).

**3. Regla de no-traición (el núcleo).** La transliteración nunca debe
revelar la solución. Las tareas de lectura de escritura, el
reconocimiento de tonos, las fichas de `word_tiles` y los contextos de
frase de cloze se quedan SIN transliteración en el elemento consultado;
las tareas de significado la reciben. En caso de duda, déjala fuera.

- Ejemplo positivo (emparejamiento de significado, content#91): la
  pareja de matching `{"left": "妈 (mā)", "right": "Mama / Mutter"}` -
  el conocimiento consultado es el significado, así que la ayuda de
  lectura no revela nada.
- Ejemplo negativo (lectura de escritura, content#91): los ejercicios
  de lectura de escritura de `ko-a1/01-hangul-lesen` se quedan sin
  transliteración, porque la romanización ES la respuesta (carácter →
  sonido); `가 (ga)` en el prompt daría al aprendiz la solución.

**4. Romanización estándar por idioma, consistente dentro de un
conjunto:** japonés Hepburn, chino Pinyin CON marcas de tono, coreano
Revised Romanization, griego/hindi una transliteración simplificada
común. Nunca mezcles sistemas dentro de un conjunto.

**5. Tareas de escritura** (`free_text` / cloze en modo `type`):
`accept[0]` es la forma romanizada canónica; además, acepta variantes
comunes - japonés: grafías Kunrei (si/ti/tu/hu/zi, p. ej. `konnitiwa`
junto a `konnichiwa`); chino: Pinyin sin tonos (`nihao` junto a
`nǐ hǎo`); coreano: alternativas extendidas (p. ej.
`annyeong haseyo`). Regla mnemotécnica: **un ejercicio nunca debe
fallar por el teclado del aprendiz.** Precedente (bloqueo por IME,
content#107): un cloze que solo aceptaba 가 era irresoluble sin un IME
coreano - la forma romanizada `ga` tenía que aceptarse también.

Qué tipo lleva qué objetivo de aprendizaje: ver el
[catálogo de tipos de ejercicio](#catalogo-de-tipos-de-ejercicio-estado).

## Dirección del ejercicio (v1.46.0 / EXP-018)

Cada ejercicio acepta un campo opcional `direction` que indica en qué
dirección practican los aprendices la tarjeta:

- `target_to_source` (predeterminado) - RECEPTIVO: se muestra el
  idioma de destino y se reconoce el idioma de origen (más fácil).
- `source_to_target` - PRODUCTIVO: se muestra el idioma de origen y se
  produce el idioma de destino (más difícil).
- `both` / `random` - deja al renderizador / generador adaptativo la
  elección de una dirección concreta por intento.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

El campo es aditivo - el esquema permanece en la versión 1.2, y las
lecciones sin `direction` se comportan exactamente como antes
(receptivo). El SRS sigue el dominio por dirección: una tarjeta
dominada de forma receptiva aún no está dominada de forma productiva.
Los ejercicios cloze son dependientes del contexto e ignoran
`direction`. Para una progresión de dificultad, se mantienen las
lecciones tempranas como receptivas y se introduce `source_to_target`
en lecciones posteriores (eso es justamente lo que hace el contenido
piloto incluido).

### Anotaciones para el generador adaptativo de lecciones (v1.36.0+)

El generador adaptativo de lecciones de la fase 53
(`/adaptive-lesson/:setId`, F-114) recombina los ejercicios existentes
para abordar de forma específica las debilidades concretas de los
aprendices. El generador funciona sin anotaciones adicionales, pero
dos campos lo hacen claramente más inteligente:

1. **Mayor cobertura de `token_roles` en las tarjetas.** El generador
   usa `token_roles` para:
   - Elegir huecos semánticamente sensatos cuando se generan variantes
     de cloze a partir de errores (ya en v1.35.0)
   - Clasificar errores como `article_gender` / `verb_conjugation`,
     para los chips de "foco de práctica" en el Dashboard (53E)
   - Encontrar ejercicios ALTERNATIVOS que prueban el mismo elemento
     cuando el ejercicio original fue erróneo (lógica de variaciones
     53D - encuentra candidatos cuya tarjeta tiene una entrada
     `token_roles` apropiada)

   Añade una entrada `token_roles` a CADA tarjeta que enseñe una
   unidad gramatical propia (artículos, formas verbales conjugadas,
   sustantivos con género). Coste: una entrada JSON adicional por
   tarjeta; beneficio: una generación adaptativa claramente más rica.

2. **Tags de tarjeta como `tags: ["article", "masculine"]`** los lee
   el clasificador de errores como fallback cuando faltan los
   `token_roles`. No sustituyen a `token_roles` - son una anotación
   económica a medio camino.

Lo que TODAVÍA no necesitamos (aplazado a un futuro incremento del
esquema):

- Referencias cruzadas `related_cards` entre tarjetas de lecciones
  distintas
- Valoraciones de dificultad por ejercicio (el generador estima
  actualmente la dificultad a partir de `exercise.type`)
- Frases de ejemplo por tarjeta en `notes`, analizables como contextos
  cloze alternativos (el generador de cloze usa exclusivamente `front`)

Regla práctica: añade `token_roles` a cada tarjeta que enseñe un token
gramatical. Es, con diferencia, el hábito de autoría más eficaz para
el sistema adaptativo.

## Assets (imágenes que incluye un conjunto) - v1.37.0+

Los ejercicios picture-choice y las imágenes de portada de las
tarjetas provienen de dos fuentes:
1. **Archivos de asset de autoría**, declarados en el manifiesto del
   conjunto y entregados junto al JSON de lección
2. **SVG de marcador de posición**, generados por el runtime cuando no
   existe ningún asset (paneles de color para palabras de color,
   dígitos grandes para números, estilo avatar para todo lo demás)

Si publicas un conjunto sin assets, picture-choice funciona igual: el
generador de SVG de marcador de posición cubre colores + números
automáticamente y recurre a un avatar determinista para todo lo demás.

### Disposición de directorios

Dentro del directorio del conjunto, los assets residen en `assets/`:

```
sets/
  language-fr-a1/
    manifest.yaml
    lessons/
      01-greetings.json
      02-numbers.json
      ...
    assets/
      img/
        chat.png
        chien.png
        oiseau.png
```

### Declaración en el manifiesto

Cada asset debe declararse en el manifiesto del conjunto, para que el
descargador sepa qué debe traer:

```yaml
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 10
    assets:
      - path: img/chat.png
        size_kb: 45
      - path: img/chien.png
        size_kb: 38
```

El `path` es relativo al directorio `assets/` del conjunto (NO al JSON
de lección). En el JSON de lección, los ejercicios picture-choice
referencian los assets CON el prefijo `assets/`:

```json
{
  "type": "picture_choice",
  "prompt": "Welches ist 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Katze", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Hund"}
  ]
}
```

El frontend elimina el prefijo `assets/` automáticamente al llamar al
resolutor de assets, de modo que el JSON de lección permanezca en la
forma intuitiva para las autoras.

### Límites de tamaño + formato

- **Límite por asset**: 500 KiB. El validador del manifiesto rechaza
  los assets cuyo `size_kb` declarado supera este límite. El
  descargador rechaza también los assets cuyo tamaño real en bytes
  supera la declaración en más de un 10 % - lo que mantiene el
  manifiesto honesto.
- **Límite blando por conjunto**: 10 MiB de tamaño total. El validador
  avisa, pero no rechaza.
- **Formatos aceptados**: `.png` / `.jpg` / `.jpeg` / `.webp` /
  `.svg`. Sin GIF (el contenido animado distrae), sin BMP (sin
  compresión). Para fotos, se prefiere WebP - claramente más pequeño
  que PNG con calidad comparable. Para iconos + diagramas, se prefiere
  SVG - escala con nitidez + tamaño de archivo mínimo.

### Recomendaciones de tamaño

Las fichas picture-choice se renderizan hasta un máximo de 150x150 px
en escritorio y 100x100 px en móvil (`object-fit: contain`). Las
imágenes de origen de 300x300 px ofrecen el mejor resultado en
pantallas Retina sin un consumo de datos innecesario. Los PNG por
encima de 150 KiB rara vez se ven mejor que un WebP bien comprimido de
la mitad de tamaño.

### Cuándo basta el marcador de posición del runtime

Tres tipos de lección en los que el marcador de posición del runtime
es tan bueno que las imágenes de autoría no aportan ninguna ganancia
de aprendizaje:

- **Lecciones de color** (`rouge` / `rojo` / `rot` / `red`): el
  generador de marcadores de posición crea una ficha hex de color
  acorde al nombre del color. Las fichas de autoría son redundantes.
- **Lecciones de números** (`7` / `42` / `1492`): el marcador de
  posición renderiza los dígitos grandes + centrados. Las imágenes de
  autoría solo tendrían sentido con sistemas de numeración no arábigos.
- **Conceptos abstractos** sin una representación visual obvia
  (`patience`, `liberté`): el marcador de posición de avatar aporta un
  ancla visual clara sin imponer una elección de icono discutible.

Para todo lo demás (animales, objetos, comida, lugares, partes del
cuerpo), las imágenes de autoría ayudan de forma medible al
reconocimiento + el recuerdo.

## Lista de comprobación de calidad

Antes del PR de una nueva lección, comprobar:

- [ ] **3-5 pasos de teoría** + **8-12 ejercicios** por lección
- [ ] **Al menos 3 tipos de ejercicio** representados (matching, picture-choice, free-text, word-tiles o cloze - cloze a partir de v1.35.0)
- [ ] **Pasos de teoría ≤ 200 palabras** por paso
- [ ] **Ejercicios free-text**: ≥ 3 variantes accept + ≥ 3 distractores
- [ ] **Word-tiles**: ≥ 3 fichas por ejercicio
- [ ] **estimated_minutes**: 10-15 (realista, no idealizado)
- [ ] **Los distractores son incorrectos-pero-plausibles** - semánticamente relacionados, nunca al azar
- [ ] **Las notes de la tarjeta** aportan valor real (pronunciación, falsos amigos, marca de excepción)
- [ ] **Estructura progresiva**: los conceptos posteriores se apoyan en los anteriores del mismo conjunto
- [ ] **Precisión cultural**: uso real del idioma, no solo frases hechas de libro de texto
- [ ] **Validación de esquema**: la lección carga limpiamente vía `dict_to_lesson()` (ver Pruebas locales)
- [ ] **Integridad de las card-id**: cada `exercise.card_ids[i]` existe en los `cards[]` de la lección
- [ ] **Par de idiomas**: `target_language` + `source_language` definidos (ISO 639-1, distintos), `title_native` presente

## Validación (dos niveles, v1.44.0)

El contenido se asegura mediante dos niveles de validación con las
MISMAS comprobaciones:

1. **En la app, antes de compartir.** Al compartir mediante *Mis
   lecciones → Poner a disposición de la comunidad* se ejecuta primero
   una comprobación basada en reglas (siempre, sin IA). Impone los
   **valores mínimos** de abajo; un conjunto por debajo no se puede
   compartir. Si los supera y hay una clave de IA configurada, el
   aprendiz puede iniciar OPCIONALMENTE una comprobación con IA
   complementaria (precisión de traducción, plausibilidad de
   distractores, gramática, nivel, sensibilidad cultural, naturalidad).
   El paso de IA nunca es automático, requiere consentimiento explícito
   (el contenido de la lección se envía al proveedor configurado) y
   nunca bloquea el compartir - la comprobación basada en reglas es la
   barrera.
2. **En la CI del repo de contenido.** Un pull request a
   `astrapi69/adaptive-learner-content` ejecuta su propio
   `scripts/validate_content.py` (estructura contra el espejo de
   esquema fijado al engine, incluido en el repo + valores mínimos de
   calidad) más una barrera de conformidad con el engine
   (`learn-content-engine` `validate()` sobre cada lección), de modo
   que un PR manual no pueda eludir la barrera.

**Valores mínimos de calidad (barrera dura):** ≥ 5 ejercicios por
lección, ≥ 2 tipos de ejercicio, ≥ 1 paso de teoría, free-text ≥ 2
respuestas aceptadas + distractores, matching ≥ 3 parejas,
picture-choice con distractores, sin anversos/reversos de tarjeta
vacíos y (en escrituras de origen no latinas) reversos de tarjeta en
la escritura de origen. Son valores mínimos, no objetivos - la lista
de comprobación de arriba exige más.

### Comprobación de contenido con IA para todo el conjunto (opcional)

Además de la comprobación al compartir, un conjunto descargado puede
revisarse para todo el conjunto mediante *Comprobar con IA*. Esto es
totalmente opcional y usa el **proveedor + modelo** que el aprendiz
tenga configurado (Anthropic / OpenAI / Gemini); las tarjetas se
envían por lotes a ese proveedor para su revisión. El flujo muestra
una estimación de coste, se ejecuta con una barra de progreso +
cancelación, y produce un **informe por tarjeta** que se cachea en el
navegador y puede exportarse como **Markdown** (con una línea que
registra qué proveedor + modelo ejecutó la comprobación). Cuando el
informe pasa, el conjunto gana una **insignia "Comprobado con IA"**
respaldada por un hash de contenido + una firma, de modo que una
edición posterior de las tarjetas invalida la insignia hasta que el
conjunto se vuelva a comprobar. La comprobación con IA nunca es una
barrera - es una procedencia orientativa, no un requisito de
publicación.

## Pruebas locales

El validador de esquema del cargador de contenido se ejecuta como
parte de `make test`. Validar una sola lección a mano:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} - {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

Validar todas las lecciones de un repo de contenido de una vez, con el
validador del repo de contenido (el mismo script que su CI ejecuta en
cada PR):

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

Encuentra cada conjunto bajo `sets/{source}/{target-level}/` y
comprueba el esquema más los valores mínimos de calidad (≥5
ejercicios, ≥2 tipos de ejercicio, ≥1 paso de teoría, accepts de
free-text + distractores, parejas de matching, sin tarjetas vacías,
integridad de card-id). Las nuevas lecciones se detectan
automáticamente - no hace falta cambiar ningún test.

## Flujo de trabajo del PR

En cuanto tu conjunto esté listo:

1. Abre un PR contra el repo principal (para conjuntos que deban
   incluirse con la app), O
2. Crea un repo de contenido propio bajo tu cuenta de GitHub y
   configura el cargador de contenido mediante
   `backend/config/plugins/content-loader.yaml` (bajo
   `default_sources`).

El cargador de contenido admite cualquier repo público de GitHub como
origen. Los repos privados requieren un personal access token que se
define mediante la gestión de claves de tres capas
(`~/.config/adaptive_learner/secrets.yaml`).

## Errores comunes

**Referencias de card-id**: cada entrada `card_ids` de un ejercicio
debe existir en los `cards[]` de la lección. Si copias un ejercicio
entre lecciones y olvidas llevarte la Card correspondiente, la
validación falla.

**IDs seguras para slug**: todas las IDs (Lesson, Card, Step,
Exercise) deben coincidir con `^[a-z0-9]+(-[a-z0-9]+)*$`. Sin guion
bajo, sin apóstrofos, sin mayúsculas, sin guiones iniciales/finales.

**`is_correct: "true"`**: es un String, no un booleano de JSON. El
esquema exige explícitamente `"true"`, porque los campos de
picture_choice están modelados internamente como dict[str, str].

**Campos adicionales**: cada modelo tiene `extra="forbid"`. Un campo
no documentado provoca el rechazo de toda la lección. Cíñete a los
campos documentados.

**Body de teoría**: los pasos de teoría necesitan un campo `body` no
vacío (Markdown). Los pasos de ejercicio no deben llevar `body` - usa
en su lugar el `prompt` del ejercicio.

## Referencia: los conjuntos incluidos

Adaptive Learner incluye una biblioteca considerable en varios
dominios (idiomas, programación, psicología, IA, tecnología - ver el
bloque CONTENT-STATS del README para los recuentos en vivo + la tabla
completa por conjunto). Algunas buenas referencias canónicas en el
repo `adaptive-learner-content`:

- `sets/en/fr-a1/` - francés A1 para angloparlantes;
  `sets/de/fr-a1/` es la contraparte con origen en alemán.
- `sets/en/es-a1/` + `sets/de/es-a1/` - español A1 (uno por idioma de
  origen).
- El conjunto "Python - Grundlagen" bajo `sets/de/` es un ejemplo de
  `domain: programming` (origen alemán == destino), útil como
  referencia no lingüística.

Todos siguen las convenciones descritas en esta guía. Leer una
lección completa es la forma más rápida de interiorizar la estructura.

---

## Vía de participación en la comunidad (v1.42.0)

> **Recorrido paso a paso con capturas de pantalla:**
> [Create a lesson in the app, step by step](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f)
> (Medium) recorre el Creador de lecciones de la app de principio a
> fin, desde la primera tarjeta hasta compartir la lección terminada.

No tienes que crear las lecciones a mano desde cero. La forma más
rápida de aportar algo es **crear una lección en la app y
compartirla**:

1. Importa un chat y analízalo, luego **Guardar como lección offline**
   (o termina una lección adaptativa y **¿Guardar esta lección?**). La
   lección aparece bajo **Mis lecciones** en el explorador de
   conjuntos.
2. En "Mis lecciones", haz clic en **Exportar como conjunto de
   contenido** para descargar un conjunto de contenido como `.zip`
   (manifiesto + lecciones). Las exportaciones solo contienen el
   contenido de la lección - sin progreso, sin historial de errores,
   nada personal.
3. Haz clic en **Poner a disposición de la comunidad** para abrir un
   **pull request** precargado en el repositorio de contenido - el
   JSON de la lección se hace commit en la ruta correcta del árbol,
   sin necesidad de un adjunto `.zip`.
4. La CI del repo valida el PR automáticamente; un maintainer revisa
   la lección, ajusta el manifiesto (id, title, language, level, tags)
   a las convenciones de arriba y lo fusiona bajo `sets/`. Tras el
   merge, cualquiera puede descargarla desde el explorador de
   conjuntos.

Esta es la vía social: la revisión es **manual** (un maintainer cura
cada incorporación - nada se publica automáticamente), y todo el flujo
solo necesita GitHub. Las lecciones generadas ya se validan contra el
esquema, de modo que una lección aportada suele necesitar solo algo de
pulido del manifiesto.

## Asistente para compartir, variaciones y crédito de autoría (Fase 64)

Compartir una lección desde **Mis lecciones** abre un asistente de
cuatro pasos, en lugar de saltar directamente a GitHub:

1. **Vista previa + ubicación.** La app calcula exactamente dónde
   aterriza la lección en el árbol
   (`sets/{source}/{target}-{level}/`) y un nombre de archivo numerado
   automáticamente (`{nn}-{slug}.json`, el siguiente número tras las
   lecciones existentes). Un par + nivel completamente nuevo muestra
   *"¡Nuevo conjunto! Eres el primero."*
2. **Comprobación de duplicados.** La lección se compara con las
   lecciones ya existentes en esa ruta (superposición de tarjetas y
   ejercicios - orientativo, nunca bloqueante). Si existe algo
   similar, puedes:
   - **Compartir como variación** - la lección se marca con
     `variation_of: "{original_id}"` más una `variation_note` opcional
     ("¿En qué se diferencia tu versión?").
   - **Proponer solo los ejercicios nuevos** (en casi-duplicados) - el
     asistente extrae exactamente los ejercicios que le faltan al
     original, junto con sus tarjetas, como una variación
     complementaria.
3. **Resumen de calidad.** Los hallazgos del validador basado en
   reglas (más la comprobación de IA opcional); las advertencias se
   muestran, pero nunca bloquean.
4. **Compartir + celebrar.** Un clic abre el pull request de GitHub
   (editor de archivos en lecciones pequeñas, página de subida en
   grandes), y la app lo agradece con una pequeña celebración.

### Campos de variación y crédito (Esquema 1.3, todos opcionales)

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "Mehr Übungen zur Angleichung",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

Los cuatro son aditivos y opcionales; las lecciones sin ellos se
comportan exactamente como antes. `contributed_by` se define si el
autor activa el crédito al compartir (un campo *"Tu nombre
(opcional)"* que se recuerda localmente para la próxima vez). Si está
presente, el visor muestra una línea discreta *"Aportado por {name}"*
bajo el título, y el texto del pull request enumera al autor en su
tabla de metadatos.

### Historial de aportaciones y lagunas

Las lecciones compartidas se recuerdan localmente (sin necesidad de
cuenta) bajo **Mis aportaciones**, con un contador y una distinción
*Colaborador de la comunidad* a partir de cinco lecciones compartidas.
El explorador de conjuntos muestra además **Lecciones que faltan** -
sugerencias alentadoras para el siguiente nivel CEFR de un par
existente o para un idioma de destino que existe para un idioma de
origen pero falta para otro ("¿Puedes ayudar?").

---

## Páginas relacionadas

- [Crear lecciones - Visión general](../content-creation/overview.md) - introducción + creador de lecciones en la app
- [Recomendaciones de libros](../content-creation/books.md) - mantener `books.yaml` por dominio
- [Varios repositorios de contenido](../features/content-repos.md) - conectar un repo propio
- [Create a lesson in the app, step by step](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f) - recorrido externo en Medium con capturas de pantalla
