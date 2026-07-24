# Explorador de contenido

El **explorador de contenido** en `/content` es tu punto central
para encontrar, descargar e iniciar conjuntos de lecciones. Está
organizado en torno al flujo de aprendizaje: primero la búsqueda,
luego continuar, y por último el catálogo.

<!-- TODO: Captura de pantalla - Explorador de contenido con campo de búsqueda, sección Continuar aprendizaje y árbol de conjuntos -->

---

## Búsqueda

En la parte superior hay un **campo de búsqueda de ancho
completo**. Filtra al instante (con antirrebote, contra el
catálogo almacenado en caché localmente) por títulos de conjuntos,
descripciones, dominio, títulos de lecciones, anversos y reversos
de tarjetas, y etiquetas. La búsqueda es **tolerante** a mayúsculas
y minúsculas y a los acentos, y reconoce los dígrafos alemanes
(ae/oe/ue/ss). Los resultados sustituyen el árbol del catálogo, con
resaltado, número de coincidencias y estado vacío.
`Cmd/Ctrl + K` salta directamente al campo de búsqueda.

---

## Continuar aprendizaje

Justo debajo de la búsqueda, **Continuar aprendizaje** muestra la
última lección abierta por conjunto, cada una con exactamente una
acción: **reanudar** (lección en curso o pausada, paso n de
total), **siguiente** lección con las estrellas tras finalizar, o
**conjunto completado**.

---

## Idiomas y conocimiento

El catálogo se divide en dos árboles:

- **Idiomas** - como árbol *idioma de origen → idioma de destino →
  nivel*, filtrado según el idioma de tu app (puedes activar
  idiomas de origen adicionales en Ajustes → Aprendizaje).
- **Conocimiento** - dominios no lingüísticos (p. ej.
  programación, psicología) con sus propios iconos.

---

## Insignias de origen y filtro de origen

Cada conjunto descargado lleva una **insignia de origen** que
muestra de dónde procede:

- **Oficial** / **Incluido** - del catálogo oficial o integrado en
  la app.
- **Repositorio propio** - de un repositorio que has conectado.
- **Recomendado oficialmente** - de la lista curada de
  recomendaciones.

Un **filtro de origen** muestra, si lo deseas, solo los conjuntos
de un origen determinado. Más información en
[Varios repositorios de contenido](content-repos.md).

---

## Recomendaciones de libros

Si el catálogo mantiene libros recomendados para un dominio
(`books.yaml`), el explorador de contenido los muestra como
**literatura complementaria** del dominio correspondiente.
Funciona en ambos modos de almacenamiento y no necesita backend.
Formato y mantenimiento:
[Recomendaciones de libros](../content-creation/books.md).

---

## Filtro de Subject

Si has asignado Subjects (materias) a tus proyectos de
aprendizaje, el **Dashboard** muestra un filtro de Subject que
enumera **solo tus propios** Subjects (oculto cuando no hay
ninguno), ordenados por **uso más frecuente** y agrupados por
categoría a partir de más de cinco entradas.

---

## Mis lecciones

Las lecciones creadas o importadas por ti mismo aparecen en la
sección **Mis lecciones** con acciones para reproducir, editar,
eliminar, exportar y compartir. Cómo construir tus propias
lecciones se explica en
[Crear lecciones](../content-creation/overview.md).

---

## Páginas relacionadas

- [Lecciones y repasos](../user-guide/lessons.md) - el flujo de la lección
- [Varios repositorios de contenido](content-repos.md) - conectar y gestionar orígenes
- [Mis lecciones](../user-guide/my-lessons.md)
