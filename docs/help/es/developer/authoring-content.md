# Crear contenido de lecciones

Esta guía explica cómo crear un nuevo conjunto de lecciones para
el cargador de contenido de Adaptive Learner. Cualquiera que
quiera publicar un conjunto de idiomas o temas — para uso personal
o como contribución al grupo de contenido público — debe leer
esto de principio a fin antes de escribir cualquier lección.

## Qué es un conjunto de contenido

Un **conjunto de contenido** es un paquete versionado de lecciones
que un usuario puede descargar desde la página del Navegador de
conjuntos (`/content`). El plugin Content-Loader (incluido en
v1.27.0) gestiona el descubrimiento, la descarga, el almacenamiento
en caché y la reconciliación de versiones en ambos modos de
almacenamiento.

Un conjunto tiene tres capas:

1. **Manifiesto raíz** (`manifest.yaml`) — lista cada conjunto que
   incluye el repositorio. Lo usa el Navegador de conjuntos para
   renderizar el catálogo de fuentes.
2. **Manifiesto del conjunto** (`sets/{id-conjunto}/manifest.yaml`)
   — hermano del manifiesto raíz, lista los archivos de lecciones
   dentro de este conjunto específico.
3. **Archivos de lecciones** (`sets/{id-conjunto}/lessons/NN-slug.json`)
   — un archivo JSON por lección, validado con el esquema v1.0 en
   cada descarga.

Los conjuntos piloto que se incluyen con Adaptive Learner viven en
el repositorio de contenido separado
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(clonado como hermano en `../adaptive-learner-content` e incluido
en la compilación por `frontend/scripts/copy-bundled-content.mjs`)
y son buenas plantillas para copiar.

## Pares de idiomas (v1.44.0)

Cada conjunto de contenido declara el PAR de idiomas que enseña:

- **`target_language`** — lo que el aprendiz está APRENDIENDO
  (p. ej., `fr`).
- **`source_language`** — lo que el aprendiz YA HABLA, es decir,
  el idioma en que están escritos los campos **`back`**, **`notes`**
  y el texto de **teoría** de las tarjetas (p. ej., `de`).

Esto es lo que hace que «Francés para hablantes de inglés» sea un
conjunto *diferente* de «Francés para hablantes de alemán»: mismo
objetivo (`fr`), fuente diferente (`en` vs `de`), idioma de
explicación diferente. Un aprendiz solo ve los conjuntos cuyo
`source_language` coincide con un idioma que habla (su idioma de
la aplicación, más cualquiera habilitado en Ajustes → Aprendizaje).

Los ids de conjunto codifican el par como `{objetivo}-{nivel}-from-{fuente}`
(p. ej., `fr-a1-from-de`), y cada conjunto declara un **`path`**
que apunta a su directorio en el idioma fuente (`sets/de/fr-a1`).
Un conjunto también lleva **`title`** (en el idioma fuente, lo que
lee el aprendiz) y **`title_native`** (en el idioma objetivo,
mostrado como etiqueta secundaria).

Ambos códigos deben ser ISO 639-1 de 2 letras, y `source_language`
debe diferir de `target_language`. Los conjuntos anteriores a v1.2
sin estos campos siguen cargándose: la antigua clave `language` se
acepta como `target_language` y `source_language` toma `en` por
defecto.

## Estructura del sistema de archivos

El árbol está organizado por idioma FUENTE, luego objetivo+nivel:

```
mi-repositorio-contenido/
  manifest.yaml               # raíz: lista cada conjunto (con path + par)
  sets/
    de/                       # idioma fuente: alemán
      fr-a1/                  # objetivo francés, nivel A1  -> id fr-a1-from-de
        manifest.yaml         # conjunto: lista las lecciones
        lessons/
          01-begruessung.json
          ...
        assets/               # imágenes / audio opcionales
    en/                       # idioma fuente: inglés
      fr-a1/                  # -> id fr-a1-from-en
        ...
```

## Formato del manifiesto

Ambos archivos de manifiesto (raíz + conjunto) usan la misma
forma `schema_version: '1.0'`. Campos requeridos:

```yaml
schema_version: '1.0'
name: Mi conjunto inglés B1
description: >-
  Descripción larga opcional.
sets:
  - id: language-en-b1        # con guiones, único
    title: English B1 (Intermediate)
    language: en              # BCP-47 (p. ej. en, fr, zh-Hans)
    level: B1                 # MCER para idiomas, libre para otros
    version: '1.0.0'          # semver — se incrementa por lanzamiento
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Descripción opcional a nivel de conjunto.
    tags:
      - intermediate
      - business
metadata:
  author: Tu Nombre
  license: CC-BY-SA-4.0       # o la que corresponda
```

El manifiesto del conjunto además lista cada archivo de lección:

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

El Content-Loader recorre `metadata.lessons` en orden; el orden
de los archivos en el directorio no importa, solo el orden del
manifiesto.

## Esquema de lecciones (v1.0)

Cada lección es un único archivo JSON. Forma de nivel superior:

```json
{
  "id": "01-saludos",
  "title": "Saludos",
  "description": "Resumen opcional de 1-2 oraciones.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Tarjetas

Una tarjeta es la unidad aprendible más pequeña — típicamente un
solo término o concepto. Cada tarjeta tiene un id estable
(referenciado desde los ejercicios) y un par frente/reverso:

```json
{
  "id": "art-le",
  "front": "le",
  "back": "el (masculino singular)",
  "notes": "Se usa antes de sustantivos masculinos que empiezan por consonante. **le chat**, **le livre**.",
  "tags": ["articulo", "definido"]
}
```

Las notas admiten Markdown. Úsalas para consejos de pronunciación,
advertencias de falsos amigos, alertas de formas irregulares —
cualquier cosa que ayude a la retención a largo plazo. Las
etiquetas impulsan el filtrado SRS.

### Pasos

Una lección es una secuencia de pasos, cada uno de TEORÍA (un
bloque Markdown) o EJERCICIO (uno de los cuatro tipos de ejercicios):

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Por qué importan los artículos",
  "body": "# Artículos en francés\n\nCada sustantivo francés tiene género..."
}
```

O un ejercicio:

```json
{
  "id": "ex-match-saludos",
  "type": "exercise",
  "title": "Empareja los saludos",
  "exercise": {
    "id": "ex-match-saludos",
    "type": "matching",
    "prompt": "Empareja cada saludo con su traducción.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hola"},
      {"left": "Salut", "right": "Ei"}
    ]
  }
}
```

## Referencia de tipos de ejercicios

### matching

Ejercicio de arrastrar-emparejar. El renderizador baraja antes de
mostrar.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Empareja cada sustantivo francés con su artículo.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Cada par debe tener exactamente dos claves: `left` + `right`.

### picture_choice

Opción múltiple con imágenes. ≥ 2 imágenes, exactamente una
marcada como correcta.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "¿Cuál es el saludo de la tarde?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Pista opcional en Markdown mostrada a petición.",
  "distractors": ["Bonjour"]
}
```

Nota: `is_correct` es una **cadena** `"true"`, no un booleano
JSON.

Si `src` apunta a un recurso que no existe, el renderizador
recae en el texto de `label` — los ejercicios de elección de
imagen siguen siendo funcionales incluso sin recursos de imagen.

### free_text

Escribir la respuesta. El renderizador hace primero coincidencia
exacta, luego un fallback tolerante con Levenshtein.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "¿Cómo se dice 'Gracias' en francés?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "Empieza por M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]` es la respuesta canónica mostrada después de un
intento incorrecto. Incluye ≥ 3 variantes para cubrir mayúsculas
y puntuación; el renderizador normaliza los espacios en blanco.

### word_tiles

Organizar fichas en orden. El renderizador baraja antes de mostrar.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Ordena: Veo un gato.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Mismo orden de palabras que en español."
}
```

Si son correctos múltiples órdenes de palabras, añade `accept_orderings`:

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

Cada ordenación es una permutación de los índices de las fichas.

### cloze (Fase 52 / v1.35.0 — esquema 1.1)

Rellenar el hueco con marcadores `___` visibles en la oración.
Cada `___` corresponde a una entrada en `blanks[]` (mapeo de
izquierda a derecha; el cargador aplica
`sentence.count("___") == len(blanks)`).

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Rellena el artículo indefinido.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "artículo indefinido masculino",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* es el artículo indefinido masculino."
}
```

**Modos de renderizado** — establecidos por ejercicio mediante `cloze_mode`:

- `"type"` (por defecto cuando se omite): un `<input>` por hueco.
  Validado con el mismo comparador NFC + Levenshtein-≤-1 que usa
  texto libre, por lo que los autores solo necesitan enumerar
  variantes semánticas (no errores tipográficos).
- `"select"`: un `<select>` por hueco. Las opciones se extraen de
  `accept[0]` + los `distractors` del ejercicio, barajadas por
  hueco con una semilla estable. **Requiere `distractors` no vacíos**
  — el validador del esquema rechaza los ejercicios `cloze_mode:
  "select"` sin ellos.

**Los huecos múltiples** están soportados: cada `___` en la
oración se mapea a la siguiente entrada en `blanks`, en orden.
Cada hueco puede tener su propia pista, marcador de posición y
lista de respuestas aceptadas. El SRS a nivel de elemento reparte
un ElementAttempt por hueco, por lo que un aprendiz que rellena
fluidamente el hueco A pero falla consistentemente el hueco B
obtiene seguimiento de dominio por hueco.

**Token-roles en tarjetas (Fase 52I / v1.35.0)** — metadatos
opcionales en Card que permiten al generador de cloze en tiempo
de ejecución (sesiones de repaso + la ronda de corrección al
final de la lección) apuntar a un hueco semánticamente
significativo:

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "un gato",
  "tags": ["articulo"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

Enumeración cerrada de roles: `article` / `verb` / `noun` /
`adjective` / `preposition` / `gender_marker` / `tense_marker`.
Añadir un rol es un incremento de versión menor del esquema — no
lo extiendas en el lugar.

## Dirección del ejercicio (v1.46.0 / EXP-018)

Cada ejercicio acepta un campo opcional `direction` que indica en
qué dirección practica el aprendiz la tarjeta:

- `target_to_source` (por defecto) — RECEPTIVO: el aprendiz ve el
  idioma objetivo y reconoce el idioma fuente (más fácil).
- `source_to_target` — PRODUCTIVO: el aprendiz ve el idioma fuente
  y produce el objetivo (más difícil).
- `both` / `random` — deja que el renderizador / generador
  adaptativo elija una dirección concreta por intento.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

El campo es aditivo — el esquema se mantiene en la versión 1.2 y
las lecciones sin `direction` se comportan exactamente como antes
(receptivo). El SRS rastrea el dominio por dirección, por lo que
una tarjeta dominada receptivamente no está dominada
productivamente aún. Los ejercicios de cloze son en contexto e
ignoran `direction`. Para una progresión de dificultad, mantén
las primeras lecciones receptivas e introduce `source_to_target`
en lecciones posteriores (el contenido piloto incluido hace
exactamente esto).

### Anotaciones que ayudan al generador de lecciones adaptativas (v1.36.0+)

El generador de lecciones adaptativas de la Fase 53
(`/adaptive-lesson/:setId`, F-114) recombina los ejercicios
creados para practicar las debilidades específicas del aprendiz.
El generador funciona sin anotaciones extra, pero dos campos lo
hacen materialmente más inteligente:

1. **Mayor cobertura de `token_roles` en las tarjetas.** El
   generador usa `token_roles` para:
   - Elegir huecos semánticamente significativos al generar
     variantes de cloze desde errores (ya cubierto en v1.35.0)
   - Clasificar errores como `article_gender` / `verb_conjugation`
     para los chips de «Áreas de enfoque» del Panel (53E)
   - Encontrar ejercicios ALTERNATIVOS que prueban el mismo
     elemento cuando el usuario cometió un error en el original
     (lógica de variación 53D — encuentra candidatos cuya
     tarjeta tiene una entrada `token_roles` coincidente)

   Añade una entrada `token_roles` a CADA tarjeta que enseña una
   unidad gramatical discreta — artículos, formas verbales
   conjugadas, sustantivos de género. El coste es una entrada
   JSON extra por tarjeta; el beneficio es una generación
   adaptativa mucho más rica.

2. **Etiquetas gramaticales a nivel de tarjeta
   (`tags: ["article", "masculine"]`, etc.)** las lee el
   clasificador de errores como fallback cuando `token_roles`
   está ausente. No sustituyen a `token_roles` — son una
   anotación a medio camino de bajo esfuerzo.

Lo que AÚN NO necesitamos (aplazado a un incremento de esquema
futuro):

- Referencias cruzadas `related_cards` entre tarjetas de
  diferentes lecciones
- Valoraciones de dificultad por ejercicio (el generador estima
  la dificultad a partir de `exercise.type` hoy)
- Oraciones de ejemplo por tarjeta en `notes` analizables como
  contextos alternativos de cloze (el generador de cloze solo usa
  `front`)

En caso de duda: añade `token_roles` a cada tarjeta que enseña un
token gramatical. Ese es el único hábito de creación de contenido
con mayor impacto para el sistema adaptativo.

## Recursos (imágenes incluidas en un conjunto) — v1.37.0+

Los ejercicios de elección de imagen y las imágenes de portada de
las tarjetas vienen de:

1. **Archivos de recursos creados**, declarados en el manifiesto
   a nivel de conjunto e incluidos junto al JSON de la lección
2. **SVG de marcador de posición**, generados por el sistema en
   tiempo de ejecución cuando no existe ningún recurso (paletas de
   colores para etiquetas de color, numerales grandes para dígitos,
   estilo avatar para todo lo demás)

Si publicas un conjunto sin ningún recurso, la elección de imagen
sigue funcionando — el generador de SVG de marcador de posición
gestiona automáticamente los colores y números, y recae en un
avatar determinista para todo lo demás.

### Estructura de directorios

Dentro del directorio de un conjunto, los recursos viven en
`assets/`:

```
sets/
  language-fr-a1/
    manifest.yaml
    lessons/
      01-saludos.json
      02-numeros.json
      ...
    assets/
      img/
        chat.png
        chien.png
        oiseau.png
```

### Declaración en el manifiesto

Cada recurso debe declararse en el `manifest.yaml` a nivel de
conjunto para que el descargador sepa qué obtener:

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

El `path` es relativo al directorio `assets/` del conjunto (NO
al JSON de la lección). Dentro del JSON de la lección, los
ejercicios de elección de imagen referencian los recursos CON
el prefijo `assets/`:

```json
{
  "type": "picture_choice",
  "prompt": "¿Cuál es 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Gato", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Perro"}
  ]
}
```

El frontend elimina automáticamente el prefijo `assets/` al
llamar al resolvedor de recursos, por lo que el JSON de la
lección mantiene la forma intuitiva que esperan los autores.

### Límites de tamaño y formato

- **Límite por recurso**: 500 KiB. El validador del manifiesto
  rechaza los recursos cuyo `size_kb` declarado supere este valor.
  El descargador también rechaza los recursos cuya longitud en
  bytes real supera el `size_kb` declarado en más de un 10% —
  mantiene el manifiesto honesto.
- **Límite suave por conjunto**: 10 MiB de recursos totales. El
  validador advierte pero no rechaza.
- **Formatos aceptados**: `.png` / `.jpg` / `.jpeg` / `.webp` /
  `.svg`. Sin GIF (el contenido animado es una distracción) y sin
  BMP (sin compresión). Para fotos, prefiere WebP — mucho más
  pequeño que PNG con calidad comparable. Para iconos y diagramas,
  prefiere SVG — escala limpiamente + tamaño de archivo pequeño.

### Recomendaciones de tamaño

Las fichas de elección de imagen se renderizan a máximo 150×150 px
en escritorio, 100×100 px en móvil (`object-fit: contain`). Las
imágenes fuente de 300×300 px dan el mejor resultado en pantallas
retina sin exceso de tamaño. Los PNG por encima de 150 KiB rara
vez se ven mejor que un WebP correctamente comprimido a la mitad
del tamaño.

### Omitir imágenes creadas — dejar que el marcador de posición lo cubra

Tres tipos de lección donde el marcador de posición en tiempo de
ejecución es suficientemente bueno y las imágenes creadas no
añaden valor de aprendizaje:

- **Lecciones de colores** (`rouge` / `rojo` / `rot` / `red`):
  el generador de marcadores produce una paleta de color sólida
  basada en el nombre del color. Las paletas creadas son
  redundantes.
- **Lecciones de números** (`7` / `42` / `1492`): el marcador
  renderiza los dígitos grandes y centrados. Las imágenes creadas
  solo importarían para sistemas numéricos no arábigos.
- **Conceptos abstractos** sin una representación visual obvia
  (`patience`, `liberté`): el marcador de avatar da un anclaje
  visual limpio sin forzar una elección de icono controvertida.

Para todo lo demás (animales, objetos, comida, lugares, partes
del cuerpo), las imágenes creadas ayudan materialmente al
reconocimiento y la memorización.

## Lista de verificación de calidad

Antes de abrir un PR para una nueva lección, verifica:

- [ ] **3-5 pasos de teoría** + **8-12 ejercicios** por lección
- [ ] **Al menos 3 tipos de ejercicios** representados
  (emparejamiento, elección de imagen, texto libre, fichas de
  palabras o cloze — cloze disponible desde v1.35.0+)
- [ ] **Pasos de teoría ≤ 200 palabras** cada uno
- [ ] **Ejercicios de texto libre**: ≥ 3 variantes de respuesta
  aceptada + ≥ 3 distractores
- [ ] **Fichas de palabras**: ≥ 3 fichas por ejercicio
- [ ] **estimated_minutes**: 10-15 (realista, no aspiracional)
- [ ] **Los distractores son incorrectos pero plausibles** —
  semánticamente relacionados, nunca aleatorios
- [ ] **Las notas de las tarjetas** aportan valor real
  (pronunciación, falso amigo, señal de excepción)
- [ ] **Estructura progresiva**: los conceptos posteriores se
  construyen sobre los anteriores en el mismo conjunto
- [ ] **Precisión cultural**: uso del mundo real, no solo frases
  de libro de texto
- [ ] **Validación del esquema**: la lección carga limpiamente
  mediante `dict_to_lesson()` (ver Pruebas locales)
- [ ] **Integridad de card-id**: cada `exercise.card_ids[i]`
  existe en `cards[]` de la lección
- [ ] **Par de idiomas**: `target_language` + `source_language`
  establecidos (ISO 639-1, diferentes), `title_native` presente

## Validación (dos capas, v1.44.0)

El contenido está protegido por dos capas de validación que
ejecutan las MISMAS comprobaciones:

1. **En la aplicación, antes de compartir.** Cuando un aprendiz
   comparte una lección mediante *Mis lecciones → Compartir con
   la comunidad*, primero se ejecuta una comprobación basada en
   reglas (siempre, sin IA necesaria). Aplica los **mínimos**
   indicados a continuación; un conjunto por debajo de cualquiera
   de ellos no puede compartirse. Si pasa Y hay una clave de IA
   configurada, el aprendiz puede OPTAR por una revisión de IA
   suplementaria (precisión de traducción, plausibilidad de
   distractores, gramática, adecuación al nivel, sensibilidad
   cultural, naturalidad). El paso de IA nunca es automático,
   requiere consentimiento explícito (el contenido de la lección
   se envía al proveedor configurado) y nunca bloquea el
   intercambio — el paso basado en reglas es la barrera.
2. **En el CI del repositorio de contenido.** Una PR a
   `astrapi69/adaptive-learner-content` ejecuta
   `scripts/validate_content.py` (reflejado en
   `docs/ci/adaptive-learner-content/`), que vuelve a comprobar
   cada conjunto con las mismas reglas para que una PR manual no
   pueda saltarse la barrera.

**Mínimos de calidad (barrera dura):** ≥ 5 ejercicios por lección,
≥ 2 tipos de ejercicios, ≥ 1 paso de teoría, texto libre ≥ 2
respuestas aceptadas + distractores, emparejamiento ≥ 3 pares,
distractores en elección de imagen, sin frente/reverso de tarjeta
vacíos y (para scripts fuente no latinos) reversos de tarjeta en
el script fuente. Estos son mínimos, no objetivos — la lista de
verificación anterior pide más.

## Pruebas locales

El validador de esquema del Content-Loader se ejecuta como parte
de `make test`. Para validar una sola lección manualmente:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} tarjetas, {len(lesson.steps)} pasos')
"
```

Para validar todas las lecciones de un repositorio de contenido a
la vez, usa el propio validador del repositorio de contenido (el
mismo script que su CI ejecuta en cada PR):

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

Descubre cada conjunto bajo `sets/{fuente}/{objetivo-nivel}/` y
comprueba el esquema más los mínimos de calidad (≥5 ejercicios, ≥2
tipos de ejercicios, ≥1 paso de teoría, respuestas + distractores
de texto libre, pares de emparejamiento, sin tarjetas vacías,
integridad de card-id) en cada uno. Añadir una nueva lección se
detecta automáticamente — no es necesario editar pruebas.

## Flujo de trabajo de PR

Una vez que tu conjunto esté listo:

1. Abre una PR contra el repositorio principal de adaptive-learner
   (para los conjuntos que deben incluirse con la aplicación), O
2. Crea tu propio repositorio de contenido bajo tu cuenta de
   GitHub y apunta el Content-Loader a él desde
   `backend/config/plugins/content-loader.yaml` (en
   `default_sources`).

El Content-Loader admite cualquier repositorio público de GitHub
como fuente. Los repositorios privados requieren un token de
acceso personal configurado mediante la cadena de claves de tres
capas (`~/.config/adaptive_learner/secrets.yaml`).

## Errores comunes

**Referencias de card-id**: cada entrada `card_ids` en un ejercicio
debe existir en `cards[]` de la lección. Si copias un ejercicio
entre lecciones y olvidas copiar la tarjeta, la validación falla.

**Ids seguros para slugs**: todos los ids (lección, tarjeta, paso,
ejercicio) deben coincidir con `^[a-z0-9]+(-[a-z0-9]+)*$`. Sin
guiones bajos, sin apóstrofos, sin letras mayúsculas, sin guiones
al principio ni al final.

**`is_correct: "true"`**: es una cadena, no un booleano JSON. El
esquema requiere específicamente `"true"` porque los campos de
elección de imagen son todos dict[str, str] internamente.

**Campos extra**: cada modelo tiene `extra="forbid"`. Añadir un
campo que el esquema no conoce rechazará toda la lección. Cíñete
a los campos documentados.

**Cuerpo de teoría**: los pasos de teoría requieren un campo
`body` no vacío (Markdown). Los pasos de ejercicio no deben llevar
`body` — usa el `prompt` del ejercicio en su lugar.

## Referencia: los conjuntos piloto

Los dos conjuntos incluidos con Adaptive Learner son las
referencias canónicas:

- `sets/en/fr-a1/` — Francés A1 para hablantes de inglés
  (10 lecciones, ~2 horas en total); `sets/de/fr-a1/` es el
  piloto con fuente alemana.
- `sets/en/es-a1/` + `sets/de/es-a1/` — Español A1 (15 lecciones
  cada fuente), en el repositorio `adaptive-learner-content`.

Ambos siguen las convenciones descritas en esta guía. Leer una
lección completa de principio a fin antes de crear la tuya propia
es la forma más rápida de interiorizar la estructura.

---

## Camino de contribución a la comunidad (v1.42.0)

No tienes que crear lecciones manualmente desde cero. La forma
más rápida de contribuir es **crear una lección en la aplicación
y compartirla**:

1. Importa un chat y analízalo, luego **Guardar como lección sin
   conexión** (o termina una lección adaptativa y **¿Guardar esta
   lección?**). La lección aparece en **Mis lecciones** en el
   Navegador de conjuntos.
2. Desde Mis lecciones, haz clic en **Exportar como conjunto**
   para descargar un `.zip` de conjunto de contenido (manifiesto
   + lecciones). Las exportaciones contienen solo el contenido de
   la lección — sin progreso, sin historial de errores, sin datos
   personales.
3. Haz clic en **Compartir con la comunidad** para abrir un issue
   de GitHub prerrellenado en el repositorio de contenido. Adjunta
   el `.zip` exportado.
4. Un mantenedor revisa la lección, pule el manifiesto (id, título,
   idioma, nivel, etiquetas) para que coincida con las convenciones
   anteriores y la añade en `sets/`. Una vez fusionada, todos
   pueden descargarla desde el Navegador de conjuntos.

Este es el camino social: la revisión es **manual** (un mantenedor
curada cada adición — nada se publica automáticamente), y todo el
flujo solo necesita GitHub. Las lecciones generadas ya se validan
contra el esquema, por lo que una lección contribuida normalmente
solo necesita pulido del manifiesto antes de publicarse.

## Asistente de compartir, variaciones y crédito del autor (Fase 64)

Compartir una lección desde **Mis lecciones** abre un asistente
de cuatro pasos en lugar de ir directamente a GitHub:

1. **Vista previa + colocación.** La aplicación calcula
   exactamente dónde aterrizará la lección en el árbol
   (`sets/{fuente}/{objetivo}-{nivel}/`) y un nombre de archivo
   autonumerado (`{nn}-{slug}.json`, el siguiente número después
   de las lecciones existentes). Un par + nivel completamente
   nuevo muestra *«¡Nuevo conjunto! Eres el primero.»*
2. **Comprobación de duplicados.** La lección se compara con las
   lecciones ya en esa ruta del árbol por superposición de
   tarjetas y ejercicios (informativo — nunca bloquea). Si hay
   algo similar puedes:
   - **Compartir como variación** — la lección se etiqueta con
     `variation_of: "{id_original}"` más una `variation_note`
     opcional («¿en qué se diferencia tu versión?»).
   - **Sugerir solo los ejercicios nuevos** (casi duplicados) —
     el asistente extrae solo los ejercicios que el original no
     tiene, más las tarjetas que referencian, como una variación
     complementaria.
3. **Resumen de calidad.** Los resultados del validador basado
   en reglas (más la revisión de IA opcional); las advertencias
   se muestran pero nunca bloquean.
4. **Compartir + celebrar.** Un clic abre la PR/issue de GitHub y
   la aplicación te agradece con una pequeña celebración.

### Campos de variación + crédito (esquema 1.3, todos opcionales)

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "Más ejercicios sobre concordancia",
  "contributed_by": "María S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

Los cuatro son aditivos y opcionales; las lecciones sin ellos se
comportan exactamente como antes. `contributed_by` se establece
cuando el autor opta por el crédito al compartir (un campo *«Tu
nombre (opcional)»* que se recuerda localmente para la próxima
vez). Cuando está presente, el visor muestra una línea discreta
*«Contribuido por {nombre}»* bajo el título y el issue de GitHub
lista al autor en su tabla de metadatos.

### Historial de contribuciones y vacíos

Las lecciones compartidas se recuerdan localmente (sin cuenta
necesaria) en **Mis contribuciones** con un contador y un
reconocimiento de *Colaborador de la comunidad* a las cinco
aportaciones. El Navegador de conjuntos también muestra
**Lecciones faltantes** — sugerencias alentadoras para el
siguiente nivel MCER de un par existente, o un objetivo enseñado
para un idioma fuente pero faltante para otro («¿Puedes ayudar?»).
