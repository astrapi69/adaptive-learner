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

1. **Manifiesto raíz** (`manifest.yaml`) — enumera cada conjunto
   del repo. El explorador de conjuntos lo lee para el catálogo de
   origen.
2. **Manifiesto del conjunto** (`sets/{set-id}/manifest.yaml`) —
   hermano del manifiesto raíz, enumera los archivos de lección
   del conjunto concreto.
3. **Archivos de lección** (`sets/{set-id}/lessons/NN-slug.json`)
   — un archivo JSON por lección, validado contra el esquema de
   lección en cada descarga (ver *El esquema es la única fuente de
   verdad* más abajo).

Los conjuntos piloto que se incluyen con Adaptive Learner residen
en el repo de contenido separado
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(extraído como checkout hermano `../adaptive-learner-content` y
empaquetado por la build mediante
`frontend/scripts/copy-bundled-content.mjs`) y sirven bien como
plantilla.

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
  *Lesson format reference* también se generan (**no los edites a
  mano**); siguen el espejo del engine, así que vuelve a ejecutar el
  generador tras cada re-pin.

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

- **`target_language`** — lo que el aprendiz APRENDE (p. ej.
  `fr`).
- **`source_language`** — lo que el aprendiz ya HABLA, es decir, el
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

Ambos códigos deben ser ISO-639-1 (dos letras), y
`source_language` debe diferir de `target_language`. Los conjuntos
anteriores a v1.2 sin estos campos siguen cargándose: la antigua
clave `language` se acepta como `target_language`, y
`source_language` recurre a `en`.

## Disposición de directorios

El árbol está organizado por IDIOMA DE ORIGEN, luego
destino+nivel:

```
mi-content-repo/
  manifest.yaml               # Raíz: enumera cada conjunto (con path + par)
  sets/
    de/                       # Idioma de origen: alemán
      fr-a1/                  # Destino francés, nivel A1  -> ID fr-a1-from-de
        manifest.yaml         # Conjunto: enumera las lecciones
        lessons/
          01-begruessung.json
          ...
        assets/               # imágenes / audio opcionales
    en/                       # Idioma de origen: inglés
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

## Formato del manifiesto

Ambos archivos de manifiesto (raíz + conjunto) usan la misma forma
con `schema_version: '1.0'`. Campos obligatorios:

```yaml
schema_version: '1.0'
name: Mein Englisch-B1-Set
description: >-
  Optionale Langbeschreibung.
sets:
  - id: language-en-b1        # slug-sicher, eindeutig
    title: Englisch B1 (Fortgeschrittene)
    language: en              # BCP-47 (z.B. en, fr, zh-Hans)
    level: B1                 # CEFR für Sprachen, frei für andere Domänen
    version: '1.0.0'          # Semver — pro Set-Release erhöht
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Optionale Set-Beschreibung.
    tags:
      - intermediate
      - business
metadata:
  author: Dein Name
  license: CC-BY-SA-4.0       # oder die Lizenz deiner Wahl
```

El manifiesto del conjunto enumera además cada archivo de lección:

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

El cargador de contenido itera `metadata.lessons` en el orden
dado; los nombres de archivo en disco son irrelevantes: solo
cuenta el orden del manifiesto.

## Esquema de lección (v1.0)

Cada lección es un único archivo JSON. Estructura de nivel
superior:

```json
{
  "id": "01-greetings",
  "title": "Begrüßungen",
  "description": "Optionale 1-2-Satz-Zusammenfassung.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Cards

Una Card es la unidad aprendible más pequeña, típicamente un único
término o concepto. Cada Card tiene una id estable (referenciada
desde los ejercicios) y un par front/back:

```json
{
  "id": "art-le",
  "front": "le",
  "back": "der (männlich Singular)",
  "notes": "Vor konsonantenanfangenden männlichen Substantiven. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

`notes` acepta Markdown. Úsalo para reglas de pronunciación,
avisos de falsos amigos, indicaciones de excepciones, todo lo que
mejore la retención a largo plazo. Los `tags` controlan el
filtrado del SRS.

### Steps

Una lección es una secuencia paso a paso; cada paso es THEORY (un
bloque de Markdown) o EXERCISE (uno de los tipos de ejercicio):

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Warum Artikel wichtig sind",
  "body": "# Artikel im Französischen\n\nJedes französische Nomen hat ein Geschlecht..."
}
```

Un paso de teoría puede llevar opcionalmente un **enlace de
ejemplo** (esquema v1.4, aditivo: las lecciones existentes siguen
siendo válidas sin él). Si está presente, el visor renderiza
debajo un botón para abrir el ejemplo:

```json
{
  "id": "intro",
  "type": "theory",
  "body": "Die Korrelation misst den Zusammenhang...",
  "example_url": "https://example.com/correlation-visualizer",
  "example_label": "Interaktive Visualisierung"
}
```

- `example_url` (opcional): debe ser una URL `http(s)`.
- `example_label` (opcional): el texto del enlace; si está vacío,
  se convierte en un "Ver ejemplo" localizado.

O un ejercicio:

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Begrüßungen zuordnen",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Ordne jede Begrüßung ihrer Übersetzung zu.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hallo"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## Referencia de tipos de ejercicio

### matching

Ejercicio de arrastrar parejas. El renderizador baraja antes de
mostrar.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Ordne jedem französischen Nomen seinen Artikel zu.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Cada pair debe tener exactamente dos claves: `left` + `right`.

### picture_choice

Opción múltiple con imágenes. ≥ 2 imágenes, exactamente una
marcada como correcta.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Welche Begrüßung passt zum Abend?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Optionaler Markdown-Tipp auf Knopfdruck.",
  "distractors": ["Bonjour"]
}
```

Importante: `is_correct` es un **String** `"true"`, no un booleano
de JSON.

Si la ruta `src` apunta a un archivo inexistente, el renderizador
recurre al `label`: por tanto, picture_choice funciona también sin
assets ilustrativos.

> **Nunca crees opción múltiple de texto como `picture_choice`.** Ese
> tipo es solo para assets de imagen reales; con opciones de texto
> renderiza mosaicos de marcador de posición, no un control usable
> (cf. astrapi69/adaptive-learner-content-test#10). La opción
> múltiple de texto es `multiple_choice` (preferido) o `cloze` en
> modo `select`; ver la sección cloze más abajo.

### free_text

Escribir la respuesta. El renderizador primero compara de forma
exacta, luego con tolerancia de Levenshtein.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "Wie sagt man 'Danke' auf Französisch?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "Beginnt mit M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]` es la respuesta canónica que se muestra ante un
intento fallido. Enumera ≥ 3 variantes para cubrir mayúsculas/
minúsculas + puntuación; el espacio en blanco lo normaliza el
renderizador.

### word_tiles

Poner las fichas en el orden correcto. El renderizador baraja
antes de mostrar.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Bring die Kacheln in die Reihenfolge: Ich sehe eine Katze.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Gleiche Wortreihenfolge wie im Deutschen."
}
```

Si hay varios órdenes de palabras correctos, añade
`accept_orderings`:

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

Cada orden es una permutación de los índices de las fichas.

### cloze (Fase 52 / v1.35.0 — Esquema 1.1)

Texto con huecos con marcadores `___` visibles en la frase. Cada
`___` corresponde a una entrada en `blanks[]` (asignación de
izquierda a derecha; el cargador comprueba `sentence.count("___")
== len(blanks)`).

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Setze den unbestimmten Artikel ein.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "männlicher unbestimmter Artikel",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* ist der männliche unbestimmte Artikel."
}
```

**Modos de renderizado** — definidos por ejercicio mediante
`cloze_mode`:

- `"type"` (predeterminado si no se define): un `<input>` por
  hueco. Se valida con el mismo comparador NFC + Levenshtein-≤-1
  que free-text, de modo que las autoras solo tengan que enumerar
  variantes semánticas (no erratas).
- `"select"`: un `<select>` por hueco. Las opciones provienen de
  `accept[0]` + los `distractors` del ejercicio, barajadas por
  hueco con una semilla estable. **Requiere `distractors` no
  vacíos**: el validador de esquema rechaza
  `cloze_mode: "select"` sin ellos.

**Opción múltiple: desde el esquema v1.6 existe un tipo nativo
`multiple_choice`.** **Coexiste** con el mecanismo `cloze`
`select`/`multiselect` (EXP-036 §4.3, #890): la opción múltiple
basada en cloze existente sigue siendo válida, nada queda deprecated.
Prefiere `multiple_choice` para el nuevo contenido de opción múltiple
de texto: la corrección es un flag por opción, así que la trampa de
la disyunción accept/distractors no puede ocurrir. Verdadero/Falso y
Sí/No tampoco necesitan un tipo propio: los cubre un
`multiple_choice` de dos opciones (o un `cloze` `select` de dos
opciones).

**Preferido (esquema v1.6+, #1525): el tipo nativo
`multiple_choice`.** Cada opción lleva su propio flag `correct`, de
modo que no hay listas accept/distractors separadas que mantener
disjuntas. `multiple: false` (predeterminado) es opción única
(exactamente una correcta); `multiple: true` es "selecciona todo lo
que aplique" (evaluación de conjunto exacto, sin puntos parciales):

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

**Mecanismo legacy (sigue siendo plenamente válido: coexistencia,
nada deprecated):** antes de v1.6, la opción múltiple de texto se
creaba como `cloze` en modo `select` (EXP-036 §4.3, #890). Una
pregunta de respuesta única es un cloze con un hueco: la `sentence`
(que termina en `___`) es la pregunta, el `accept[0]` del hueco es la
opción correcta y los `distractors` son las opciones incorrectas.
Ejemplo: `"sentence": "The capital of France is ___."`,
`"blanks": [{"accept": ["Paris"]}]`, `"cloze_mode": "select"`,
`"distractors": ["Berlin", "Madrid", "Rome"]`.

También puedes poner la pregunta entera en `prompt` y usar un
`"sentence": "___"` a secas; el renderizador muestra un `<select>`
con la respuesta correcta + los distractores, evalúa la elección, da
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

**"Selecciona todo lo que aplique"** (dos o más respuestas correctas,
p. ej. una pregunta de examen de conducir) usa
`cloze_mode: "multiselect"` (coincidencia de conjunto exacto sobre
`accept` + `distractors`, #1195):

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
asigna por orden a la siguiente entrada de `blanks`. Cada hueco
puede tener su propio hint + placeholder + lista accept. El SRS de
elementos despliega un ElementAttempt por hueco: quien rellena con
fluidez el hueco A pero falla constantemente el hueco B obtiene un
seguimiento de dominio con granularidad por hueco.

**Roles de token en las Cards (Fase 52I / v1.35.0)** — metadatos
opcionales de la Card con los que el generador de cloze puede
elegir en tiempo de ejecución (sesiones de repaso + la ronda de
corrección al final de la lección) un hueco semánticamente
significativo:

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
`preposition` / `gender_marker` / `tense_marker`. Añadir un rol es
un incremento de versión menor del esquema: no lo amplíes en
línea.

## Dirección del ejercicio (v1.46.0 / EXP-018)

Cada ejercicio acepta un campo opcional `direction` que indica en
qué dirección practican los aprendices la tarjeta:

- `target_to_source` (predeterminado) — RECEPTIVO: se muestra el
  idioma de destino y se reconoce el idioma de origen (más fácil).
- `source_to_target` — PRODUCTIVO: se muestra el idioma de origen
  y se produce el idioma de destino (más difícil).
- `both` / `random` — deja al renderizador / generador adaptativo
  la elección de una dirección concreta por intento.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

El campo es aditivo: el esquema permanece en la versión 1.2, y las
lecciones sin `direction` se comportan exactamente como antes
(receptivo). El SRS sigue el dominio por dirección: una tarjeta
dominada de forma receptiva aún no está dominada de forma
productiva. Los ejercicios cloze son dependientes del contexto e
ignoran `direction`. Para una progresión de dificultad, se
mantienen las lecciones tempranas como receptivas y se introduce
`source_to_target` en lecciones posteriores (eso es justamente lo
que hace el contenido piloto incluido).

### Anotaciones para el generador adaptativo de lecciones (v1.36.0+)

El generador adaptativo de lecciones de la fase 53
(`/adaptive-lesson/:setId`, F-114) recombina los ejercicios
existentes para abordar de forma específica las debilidades
concretas de los aprendices. El generador funciona sin anotaciones
adicionales, pero dos campos lo hacen claramente más inteligente:

1. **Mayor cobertura de `token_roles` en las tarjetas.** El
   generador usa `token_roles` para:
   - Elegir huecos semánticamente sensatos cuando se generan
     variantes de cloze a partir de errores (ya en v1.35.0)
   - Clasificar errores como `article_gender` / `verb_conjugation`,
     para los chips de "foco de práctica" en el Dashboard (53E)
   - Encontrar ejercicios ALTERNATIVOS que prueban el mismo
     elemento cuando el ejercicio original fue erróneo (lógica de
     variaciones 53D — encuentra candidatos cuya tarjeta tiene una
     entrada `token_roles` apropiada)

   Añade una entrada `token_roles` a CADA tarjeta que enseñe una
   unidad gramatical propia (artículos, formas verbales
   conjugadas, sustantivos con género). Coste: una entrada JSON
   adicional por tarjeta; beneficio: una generación adaptativa
   claramente más rica.

2. **Tags de tarjeta como `tags: ["article", "masculine"]`** los
   lee el clasificador de errores como fallback cuando faltan los
   `token_roles`. No sustituyen a `token_roles`: son una anotación
   económica a medio camino.

Lo que TODAVÍA no necesitamos (aplazado a un futuro incremento del
esquema):

- Referencias cruzadas `related_cards` entre tarjetas de
  lecciones distintas
- Valoraciones de dificultad por ejercicio (el generador estima
  actualmente la dificultad a partir de `exercise.type`)
- Frases de ejemplo por tarjeta en `notes`, analizables como
  contextos cloze alternativos (el generador de cloze usa
  exclusivamente `front`)

Regla práctica: añade `token_roles` a cada tarjeta que enseñe un
token gramatical. Es, con diferencia, el hábito de autoría más
eficaz para el sistema adaptativo.

## Assets (imágenes que incluye un conjunto) — v1.37.0+

Los ejercicios picture-choice y las imágenes de portada de las
tarjetas provienen de dos fuentes:
1. **Archivos de asset de autoría**, declarados en el manifiesto
   del conjunto y entregados junto al JSON de lección
2. **SVG de marcador de posición**, generados por el runtime
   cuando no existe ningún asset (paneles de color para palabras
   de color, dígitos grandes para números, estilo avatar para
   todo lo demás)

Si publicas un conjunto sin assets, picture-choice funciona igual:
el generador de SVG de marcador de posición cubre colores +
números automáticamente y recurre a un avatar determinista para
todo lo demás.

### Disposición de directorios

Dentro del directorio del conjunto, los assets residen en
`assets/`:

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

Cada asset debe declararse en el manifiesto del conjunto, para que
el descargador sepa qué debe traer:

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

El `path` es relativo al directorio `assets/` del conjunto (NO al
JSON de lección). En el JSON de lección, los ejercicios
picture-choice referencian los assets CON el prefijo `assets/`:

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

El frontend elimina el prefijo `assets/` automáticamente al llamar
al resolutor de assets, de modo que el JSON de lección permanezca
en la forma intuitiva para las autoras.

### Límites de tamaño + formato

- **Límite por asset**: 500 KiB. El validador del manifiesto
  rechaza los assets cuyo `size_kb` declarado supera este límite.
  El descargador rechaza también los assets cuyo tamaño real en
  bytes supera la declaración en más de un 10 %, lo que mantiene
  el manifiesto honesto.
- **Límite blando por conjunto**: 10 MiB de tamaño total. El
  validador avisa, pero no rechaza.
- **Formatos aceptados**: `.png` / `.jpg` / `.jpeg` / `.webp` /
  `.svg`. Sin GIF (el contenido animado distrae), sin BMP (sin
  compresión). Para fotos, se prefiere WebP — claramente más
  pequeño que PNG con calidad comparable. Para iconos +
  diagramas, se prefiere SVG — escala con nitidez + tamaño de
  archivo mínimo.

### Recomendaciones de tamaño

Las fichas picture-choice se renderizan hasta un máximo de 150x150
px en escritorio y 100x100 px en móvil (`object-fit: contain`).
Las imágenes de origen de 300x300 px ofrecen el mejor resultado en
pantallas Retina sin un consumo de datos innecesario. Los PNG por
encima de 150 KiB rara vez se ven mejor que un WebP bien
comprimido de la mitad de tamaño.

### Cuándo basta el marcador de posición del runtime

Tres tipos de lección en los que el marcador de posición del
runtime es tan bueno que las imágenes de autoría no aportan
ninguna ganancia de aprendizaje:

- **Lecciones de color** (`rouge` / `rojo` / `rot` / `red`): el
  generador de marcadores de posición crea una ficha hex de color
  acorde al nombre del color. Las fichas de autoría son
  redundantes.
- **Lecciones de números** (`7` / `42` / `1492`): el marcador de
  posición renderiza los dígitos grandes + centrados. Las imágenes
  de autoría solo tendrían sentido con sistemas de numeración no
  arábigos.
- **Conceptos abstractos** sin una representación visual obvia
  (`patience`, `liberté`): el marcador de posición de avatar
  aporta un ancla visual clara sin imponer una elección de icono
  discutible.

Para todo lo demás (animales, objetos, comida, lugares, partes del
cuerpo), las imágenes de autoría ayudan de forma medible al
reconocimiento + el recuerdo.

## Lista de comprobación de calidad

Antes del PR de una nueva lección, comprobar:

- [ ] **3-5 pasos de teoría** + **8-12 ejercicios** por lección
- [ ] **Al menos 3 tipos de ejercicio** representados (matching, picture-choice, free-text, word-tiles o cloze — cloze a partir de v1.35.0)
- [ ] **Pasos de teoría ≤ 200 palabras** por paso
- [ ] **Ejercicios free-text**: ≥ 3 variantes accept + ≥ 3 distractores
- [ ] **Word-tiles**: ≥ 3 fichas por ejercicio
- [ ] **estimated_minutes**: 10-15 (realista, no idealizado)
- [ ] **Los distractores son incorrectos-pero-plausibles** — semánticamente relacionados, nunca al azar
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
   lecciones → Poner a disposición de la comunidad* se ejecuta
   primero una comprobación basada en reglas (siempre, sin IA).
   Impone los **valores mínimos** de abajo; un conjunto por debajo
   no se puede compartir. Si los supera y hay una clave de IA
   configurada, el aprendiz puede iniciar OPCIONALMENTE una
   comprobación con IA complementaria (precisión de traducción,
   plausibilidad de distractores, gramática, nivel, sensibilidad
   cultural, naturalidad). El paso de IA nunca es automático,
   requiere consentimiento explícito (el contenido de la lección
   se envía al proveedor configurado) y nunca bloquea el
   compartir: la comprobación basada en reglas es la barrera.
2. **En la CI del repo de contenido.** Un pull request a
   `astrapi69/adaptive-learner-content` ejecuta
   `scripts/validate_content.py` (reflejado bajo
   `docs/ci/adaptive-learner-content/`) y comprueba cada conjunto
   con las mismas reglas, para que un PR manual no eluda la
   barrera.

**Valores mínimos de calidad (barrera dura):** ≥ 5 ejercicios por
lección, ≥ 2 tipos de ejercicio, ≥ 1 paso de teoría, free-text ≥ 2
respuestas aceptadas + distractores, matching ≥ 3 parejas,
picture-choice con distractores, sin anversos/reversos de tarjeta
vacíos y (en escrituras de origen no latinas) reversos de tarjeta
en la escritura de origen. Son valores mínimos, no objetivos: la
lista de comprobación de arriba exige más.

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
print(f'OK: {lesson.id} — {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

Validar todas las lecciones de un repo de contenido de una vez,
con el validador del repo de contenido (el mismo script que su CI
ejecuta en cada PR):

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

Encuentra cada conjunto bajo `sets/{source}/{target-level}/` y
comprueba el esquema más los valores mínimos de calidad (≥5
ejercicios, ≥2 tipos de ejercicio, ≥1 paso de teoría, accepts de
free-text + distractores, parejas de matching, sin tarjetas
vacías, integridad de card-id). Las nuevas lecciones se detectan
automáticamente: no hace falta cambiar ningún test.

## Flujo de trabajo del PR

En cuanto tu conjunto esté listo:

1. Abre un PR contra el repo principal (para conjuntos que deban
   incluirse con la app), O
2. Crea un repo de contenido propio bajo tu cuenta de GitHub y
   configura el cargador de contenido mediante
   `backend/config/plugins/content-loader.yaml` (bajo
   `default_sources`).

El cargador de contenido admite cualquier repo público de GitHub
como origen. Los repos privados requieren un personal access token
que se define mediante la gestión de claves de tres capas
(`~/.config/adaptive_learner/secrets.yaml`).

## Errores comunes

**Referencias de card-id**: cada entrada `card_ids` de un
ejercicio debe existir en los `cards[]` de la lección. Si copias
un ejercicio entre lecciones y olvidas llevarte la Card
correspondiente, la validación falla.

**IDs seguras para slug**: todas las IDs (Lesson, Card, Step,
Exercise) deben coincidir con `^[a-z0-9]+(-[a-z0-9]+)*$`. Sin guion
bajo, sin apóstrofos, sin mayúsculas, sin guiones iniciales/
finales.

**`is_correct: "true"`**: es un String, no un booleano de JSON. El
esquema exige explícitamente `"true"`, porque los campos de
picture_choice están modelados internamente como dict[str, str].

**Campos adicionales**: cada modelo tiene `extra="forbid"`. Un
campo no documentado provoca el rechazo de toda la lección. Cíñete
a los campos documentados.

**Body de teoría**: los pasos de teoría necesitan un campo `body`
no vacío (Markdown). Los pasos de ejercicio no deben llevar
`body`; usa en su lugar el `prompt` del ejercicio.

## Referencia: los conjuntos piloto

Los dos conjuntos que se incluyen con Adaptive Learner son las
referencias canónicas:

- `sets/en/fr-a1/` — francés A1 para angloparlantes (10
  lecciones, ~2 horas); `sets/de/fr-a1/` es el conjunto piloto en
  alemán.
- `sets/en/es-a1/` + `sets/de/es-a1/` — español A1 (15 lecciones
  por idioma de origen), en el repo `adaptive-learner-content`.

Ambos siguen las convenciones descritas en esta guía. Leer una
lección completa es la forma más rápida de interiorizar la
estructura.

---

## Vía de participación en la comunidad (v1.42.0)

No tienes que crear las lecciones a mano desde cero. La forma más
rápida de aportar algo es **crear una lección en la app y
compartirla**:

1. Importa un chat y analízalo, luego **Guardar como lección
   offline** (o termina una lección adaptativa y **¿Guardar esta
   lección?**). La lección aparece bajo **Mis lecciones** en el
   explorador de conjuntos.
2. Haz clic en "Mis lecciones" en **Exportar como conjunto de
   contenido** para descargar un conjunto de contenido como `.zip`
   (manifiesto + lecciones). Las exportaciones solo contienen el
   contenido de la lección: sin progreso, sin historial de
   errores, nada personal.
3. Haz clic en **Poner a disposición de la comunidad** para abrir
   un **pull request** precargado en el repositorio de contenido:
   el JSON de la lección se hace commit en la ruta correcta del
   árbol, sin necesidad de un adjunto `.zip`.
4. La CI del repo valida el PR automáticamente; un maintainer
   revisa la lección, ajusta el manifiesto (id, title, language,
   level, tags) a las convenciones de arriba y lo fusiona bajo
   `sets/`. Tras el merge, cualquiera puede descargarla desde el
   explorador de conjuntos.

Esta es la vía social: la revisión es **manual** (un maintainer
cura cada incorporación — nada se publica automáticamente), y todo
el flujo solo necesita GitHub. Las lecciones generadas ya se
validan contra el esquema, de modo que una lección aportada suele
necesitar solo algo de pulido del manifiesto.

## Asistente para compartir, variaciones y crédito de autoría (Fase 64)

Compartir una lección desde **Mis lecciones** abre un asistente de
cuatro pasos, en lugar de saltar directamente a GitHub:

1. **Vista previa + ubicación.** La app calcula exactamente dónde
   aterriza la lección en el árbol
   (`sets/{origen}/{destino}-{nivel}/`) y un nombre de archivo
   numerado automáticamente (`{nn}-{slug}.json`, el siguiente
   número tras las lecciones existentes). Un par + nivel
   completamente nuevo muestra *"¡Nuevo conjunto! Eres el
   primero."*
2. **Comprobación de duplicados.** La lección se compara con las
   lecciones ya existentes en esa ruta (superposición de tarjetas
   y ejercicios — orientativo, nunca bloqueante). Si existe algo
   similar, puedes:
   - **Compartir como variación** — la lección se marca con
     `variation_of: "{original_id}"` más una `variation_note`
     opcional ("¿En qué se diferencia tu versión?").
   - **Proponer solo los ejercicios nuevos** (en casi-duplicados)
     — el asistente extrae exactamente los ejercicios que le
     faltan al original, junto con sus tarjetas, como una
     variación complementaria.
3. **Resumen de calidad.** Los hallazgos del validador basado en
   reglas (más la comprobación de IA opcional); las advertencias
   se muestran, pero nunca bloquean.
4. **Compartir + celebrar.** Un clic abre el pull request de
   GitHub (editor de archivos en lecciones pequeñas, página de
   subida en grandes), y la app lo agradece con una pequeña
   celebración.

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
(opcional)"* que se recuerda localmente para la próxima vez). Si
está presente, el visor muestra una línea discreta *"Aportado por
{name}"* bajo el título, y el texto del pull request enumera al
autor en su tabla de metadatos.

### Historial de aportaciones y lagunas

Las lecciones compartidas se recuerdan localmente (sin necesidad
de cuenta) bajo **Mis aportaciones**, con un contador y una
distinción *Colaborador de la comunidad* a partir de cinco
lecciones compartidas. El explorador de conjuntos muestra además
**Lecciones que faltan** — sugerencias alentadoras para el
siguiente nivel CEFR de un par existente o para un idioma de
destino que existe para un idioma de origen pero falta para otro
("¿Puedes ayudar?").

---

## Páginas relacionadas

- [Crear lecciones — Visión general](../content-creation/overview.md) — introducción + creador de lecciones en la app
- [Recomendaciones de libros](../content-creation/books.md) — mantener `books.yaml` por dominio
- [Varios repositorios de contenido](../features/content-repos.md) — conectar un repo propio
