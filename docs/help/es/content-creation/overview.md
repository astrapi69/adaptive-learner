# Crear lecciones - Visión general

Adaptive Learner vive de los contenidos. Puedes construir tus
propias lecciones, directamente en la app o como archivo en el
formato del repo de contenido, y compartirlas con la comunidad.
Esta página ofrece la visión general; los detalles completos del
formato están en las fuentes enlazadas.

---

## Dos formas de crear lecciones

### 1. En la app: el creador de lecciones

El **creador de lecciones** en `/create-lesson` es un asistente de
4 pasos (Metadatos → Editor de tarjetas → Editor de ejercicios
→ Guardar/Compartir) y **no necesita una clave de IA**:

- Ordenar tarjetas mediante arrastrar y soltar o **importarlas
  desde CSV**; las tarjetas pueden llevar una **imagen subida**.
- El paso de metadatos ofrece un selector de **dominio de
  conocimiento** (p. ej. idioma, programación, psicología,
  adiestramiento canino, educación vial).
- **Generar ejercicios automáticamente** a partir de las tarjetas
  o **editarlos por completo tú mismo** en el paso 3: todos los
  tipos de ejercicio principales se pueden crear, cambiar y añadir
  manualmente - incluida la **opción múltiple** nativa con un
  conmutador destacado de **selección única/múltiple**.
- El **dictado** (dictado de audio) está disponible directamente
  en el selector de tipos de ejercicio; sube el clip de audio como
  archivo (incrustado en la lección) o indica una ruta de asset.
  La lección se marca automáticamente como dependiente de
  extensiones.
- El **asistente de autoría de extensiones** crea con ayuda de la
  IA los cinco tipos de ejercicio de extensión (categorización,
  corrección de errores, comprensión lectora, cuestionario
  calificado, dictado).
- **Plantillas** (Vacía / Vocabulario / Gramática / Conversación)
  y **autoguardado de borradores**.
- **Vista previa** en el visor real de lecciones antes de guardar.
- **Guardar localmente** o **compartir mediante pull request**.

Hay puntos de entrada en el explorador de contenido y en el
Dashboard.

#### Lección de conocimiento a partir de texto (modo libro)

La quinta tarjeta de plantilla, **"Lección de conocimiento a
partir de texto"**, inicia un flujo propio de 3 pasos (Metadatos →
Texto del libro → Revisión): pega una sección (p. ej. un capítulo)
de tu libro de texto - la IA la reformula **con sus propias
palabras** como pasos de teoría (nunca como copia) y genera
ejercicios a juego que enlazan con su paso de teoría.
Opcionalmente se pueden adjuntar datos del libro (título, autor,
URL, ISBN/ASIN); se conservan cuando editas la lección más
adelante.

En lugar de pegar texto también puedes **subir un archivo de
libro** (EPUB, DOCX, TXT o Markdown, hasta 20 MiB). El archivo se
procesa por completo **en el navegador** - no se sube nada - y los
capítulos detectados aparecen como una **lista con casillas de
verificación**. Las secciones que parecen preliminares o finales
(prólogo, glosario, índice, …) quedan **desmarcadas por defecto**
mediante una heurística, pero siguen visibles y seleccionables:

- **Una sección seleccionada** - se inserta en el campo de texto
  (con vista previa; si el campo no está vacío, se pregunta
  primero).
- **Varias secciones seleccionadas** - la **generación por lotes**
  crea **una lección por sección** y las guarda juntas como un
  conjunto de varias lecciones.

Al **editar** un conjunto de varias lecciones, un **selector de
lecciones** pregunta qué lección abrir; las lecciones de texto de
libro abren directamente el editor de ejercicios.

A diferencia de la vía basada en tarjetas, este modo requiere una
**clave de IA configurada**. Pega solo textos sobre los que tengas
derechos o que estén destinados al uso personal.

### 2. Como archivo: el formato del repo de contenido

Una lección es un archivo JSON dentro de un **conjunto de
contenido**. Los conjuntos residen en repos públicos de GitHub y
siguen un árbol de directorios fijo
(`sets/{idioma-origen}/{idioma-destino-nivel}/`). Las guías de
referencia están en el repositorio de contenido:

- **Primeros pasos:**
  [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- **Formato de lección:**
  [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

Un **kit de inicio** listo para examinar y copiar es
[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test).

---

## Compartir mediante pull request

Compartir una lección genera un **pull request** real (fork →
commit → PR). La app propone automáticamente la ruta correcta y un
nombre de archivo numerado, y detecta duplicados/variantes. La
**pipeline de validación** del repo de contenido comprueba cada
lección enviada en cada PR (esquema, par de idiomas, mínimos de
calidad), de modo que solo entren al catálogo contenidos
correctos. Opcionalmente hay una revisión de contenido asistida
por IA; nunca bloquea el compartir.

---

## Páginas relacionadas

- [Crear contenido de lecciones (desarrolladores)](../developer/authoring-content.md) - detalles del esquema, assets, tarjetas de código/fórmula
- [Recomendaciones de libros](books.md) - mantener `books.yaml`
- [Varios repositorios de contenido](../features/content-repos.md) - conectar un repo propio
