# Plan de estudios

La página del Plan de estudios es tu material de aprendizaje
estructurado: el «libro» frente al cual ocurren tus sesiones. Es
una capa opcional pero potente sobre las sesiones de IA de libre
flujo.

## Qué es un plan de estudios

Un plan de estudios es un árbol de **temas** más una lista plana de
**lecciones**, todo perteneciente a un aprendiz. Puedes tener
varios planes de estudios en paralelo («Gramática española»,
«Spring Boot para desarrolladores Java», «Fundamentos de guitarra
solista»).

- Los **temas** forman un árbol: capítulos y subcapítulos. Cada
  tema tiene un título, una descripción opcional y una referencia
  al padre. El botón «Añadir subtema» crea un hijo.
- Las **lecciones** son planas bajo el plan de estudios. Cada una
  tiene un título y un cuerpo de contenido de texto enriquecido.
  Úsalas para material escrito: notas, resúmenes, hojas de
  ejercicios.

## Crear un plan de estudios

La página del Plan de estudios lista todos los planes de estudio
que posees. El formulario «Crear plan de estudios» toma un título
+ descripción opcional + idioma opcional; al hacer clic en Crear
se abre inmediatamente la vista del nuevo plan de estudios.

## El árbol de temas

El lado izquierdo de la vista del plan de estudios muestra el
árbol de temas, reordenable mediante arrastrar y soltar (también
táctil en el móvil). Haz clic en un tema para profundizar; la ruta
de navegación bajo el encabezado muestra el camino de regreso a
la raíz.

- **Añadir tema** en el nivel raíz: hermano de todo tema de nivel
  superior existente.
- **Añadir subtema** bajo el tema actualmente enfocado.
- **Renombrar** haciendo clic en el título en modo de edición.
- **Eliminar** quita el tema Y sus descendientes (el modo Dexie
  gestiona la cascada en una sola transacción; el modo API delega
  al backend).

El árbol es solo metadatos; los temas no tienen contenido propio.
El contenido vive en las lecciones.

## Lecciones

El lado derecho de la vista del plan de estudios es la lista de
lecciones, ordenada por `order_index`. Cada fila muestra el título
de la lección y un fragmento de su contenido; hacer clic abre el
editor de lecciones.

El editor de lecciones es **texto enriquecido TipTap**:
negrita / cursiva / subrayado / tachado, encabezados
(H1-H3), listas con viñetas + ordenadas + de tareas, cita en
bloque, código en línea, bloques de código con valla con resaltado
de sintaxis `lowlight` en 11 lenguajes (bash / css / html / java
/ javascript / json / markdown / python / sql / typescript / yaml),
enlaces, alineación de texto, resaltado, deshacer / rehacer,
contador de caracteres. La barra de herramientas es compatible con
el móvil con desplazamiento horizontal y objetivos táctiles de 40px.

Las descripciones del plan de estudios, las notas de sesión y el
contenido de las lecciones usan el mismo editor. Las exportaciones
a Markdown / PDF pasan por `renderStoredContent`, que recorre el
árbol de documentos TipTap y emite Markdown GFM; el contenido de
texto plano heredado pasa sin cambios.

## Cómo los planes de estudios se conectan con las sesiones

Las sesiones pueden sembrar desde una importación de historial de
chat o desde cero. El analizador de conversaciones
(`/api/imports`) extrae un campo `suggested_curriculum`; un clic
en la importación analizada siembra un Plan de estudios con temas
+ lecciones que coinciden con las lagunas identificadas por la IA.

La IA de sesión no extrae (todavía) automáticamente el contenido
de lecciones individuales al prompt del sistema: eso es una
retención deliberada hasta que la forma de la integración
currículum-IA se consolide.

## Comportamiento por modo de almacenamiento

Tanto ApiStorage como DexieStorage implementan el CRUD del plan
de estudios. En el modo Local los datos viven en IndexedDB y
sobreviven a las recargas del navegador mientras no borres los
datos del sitio. En el modo Servidor los datos viven en la base de
datos SQLite del backend FastAPI.

[Cómo funcionan los modos de almacenamiento](settings.md#storage-mode)
