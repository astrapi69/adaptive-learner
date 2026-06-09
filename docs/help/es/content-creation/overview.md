# Crear lecciones — Visión general

Adaptive Learner vive de los contenidos. Puedes construir tus
propias lecciones, directamente en la app o como archivo en el
formato del repo de contenido, y compartirlas con la comunidad.
Esta página ofrece la visión general; los detalles completos del
formato están en las fuentes enlazadas.

---

## Dos formas de crear lecciones

### 1. En la app: el creador de lecciones

El **creador de lecciones** en `/create-lesson` es un asistente de
4 pasos (Metadatos → Editor de tarjetas → Generador de ejercicios
→ Guardar/Compartir) y **no necesita una clave de IA**:

- Ordenar tarjetas mediante arrastrar y soltar o **importarlas
  desde CSV**.
- **Generar ejercicios automáticamente** a partir de las tarjetas
  (los cinco tipos de ejercicio) o ajustarlos a mano.
- **Plantillas** (Vacía / Vocabulario / Gramática / Conversación)
  y **autoguardado de borradores**.
- **Vista previa** en el visor real de lecciones antes de guardar.
- **Guardar localmente** o **compartir mediante pull request**.

Hay puntos de entrada en el explorador de contenido y en el
Dashboard.

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

- [Crear contenido de lecciones (desarrolladores)](../developer/authoring-content.md) — detalles del esquema, assets, tarjetas de código/fórmula
- [Recomendaciones de libros](books.md) — mantener `books.yaml`
- [Varios repositorios de contenido](../features/content-repos.md) — conectar un repo propio
