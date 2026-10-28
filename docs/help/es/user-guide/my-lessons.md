# Mis lecciones: crear, guardar, compartir

**Mis lecciones** son lecciones que *tú* creas - convertidas al
mismo formato reproducible sin conexión que los conjuntos de
contenido descargados. Puedes crear una lección a partir de un
chat analizado, guardar una buena lección adaptativa para
reproducirla, exportar una lección para compartirla con alguien
e importar lecciones que otros han compartido. Estos pasos
funcionan sin conexión, y tus lecciones se quedan en tu
dispositivo hasta que uses una función que las transmita, por
ejemplo una contribución a la comunidad (pull request) o
"Compartir como repositorio", que suben la lección a GitHub, o una
revisión con IA, que envía su contenido a tu proveedor de IA.

Encontrarás Mis lecciones en la parte superior del **Navegador
de conjuntos** (`/content`), por encima de los conjuntos
descargados.

---

## Crear una lección a partir de un análisis de chat

1. Importa un chat y **analízalo** (consulta *Importación*).
2. En el resultado del análisis, haz clic en **Guardar como
   lección sin conexión**.
3. Se muestra una vista previa con la estructura de la lección -
   cuántos ejercicios y pasos teóricos, el tiempo estimado.
   Ajusta el título si quieres.
4. Haz clic en **Guardar**. La lección aparece en **Mis
   lecciones**.

La lección se construye a partir de lo que encontró el análisis:

- **Teoría** del tema, resumen, subtemas, tus fortalezas y
  debilidades, patrones de errores comunes y cualquier plan de
  estudios sugerido.
- **Ejercicios** del vocabulario extraído - emparejamiento y
  escribir-la-traducción de cada palabra, más relleno de huecos
  y ejercicios de orden de palabras a partir de cualquier oración
  de ejemplo.

Cuanto más rico sea el análisis (especialmente el vocabulario con
oraciones de ejemplo), más rica será la lección. Si no hay
suficientes elementos de vocabulario, obtendrás una **guía de
estudio solo teórica** y una sugerencia para importar un chat más
largo para obtener más material de práctica.

Las lecciones generadas se reproducen en el visor de lecciones
normal con puntuación completa, exactamente igual que una lección
descargada.

---

## Reproducir, editar, eliminar

Cada lección en Mis lecciones tiene:

- **Reproducir** - ábrela en el visor de lecciones.
- **Editar** - abre el **creador de lecciones prerrellenado** con
  los metadatos, las tarjetas y los ejercicios de la lección. Si
  uno de tus conjuntos contiene **varias lecciones**, un
  **selector de lecciones** pregunta primero cuál quieres editar.
  Las lecciones de texto de libro abren directamente el editor de
  ejercicios; los metadatos del libro adjuntos se conservan. Al
  guardar eliges entre **Guardar cambios** (sobrescribe la misma
  lección - tu progreso de aprendizaje se conserva para las
  tarjetas sin cambios, las modificadas empiezan de cero) y
  **Guardar como copia** (crea una lección nueva y el original
  queda intacto). Las lecciones basadas en análisis siguen
  abriendo el análisis de chat subyacente. Las lecciones ajenas
  (descargadas) permanecen de solo lectura.
- **Eliminar** - elimínala (con confirmación).

---

## Guardar una lección adaptativa

Cuando terminas una **lección adaptativa**, aparece un botón
**¿Guardar esta lección?** en el resumen. Guardar conserva una
instantánea que puedes reproducir más tarde desde Mis lecciones -
útil cuando una sesión adaptativa resultó especialmente provechosa.
La instantánea sigue siendo reproducible aunque el generador
adaptativo cambie en una versión posterior.

---

## Exportar y compartir

Cada lección en Mis lecciones se puede compartir. Exportar no requiere
ninguna cuenta; el pull request para la comunidad requiere una cuenta de
GitHub. Un token de GitHub agiliza el pull request y es necesario para
compartir un conjunto entero como repositorio propio:

- **Exportar** - descarga la lección como un único archivo `.json`.
- **Exportar como conjunto** - descarga un `.zip` de conjunto de
  contenido (manifiesto + lecciones).
- **Compartir con la comunidad** - conduce a un **pull request** en el
  repositorio oficial de contenido. El JSON de la lección queda en la
  ruta correcta del árbol de contenido, y la validación del repositorio
  se ejecuta automáticamente. El pull request es visible públicamente en
  GitHub desde el momento en que se crea. Un mantenedor lo revisa; si lo
  acepta, todos pueden descargar la lección. El pull request se crea por
  uno de dos caminos:
    - **Sin token** - para una sola lección, la app abre el editor de
      archivos de GitHub en la ruta correcta, con el título y la
      descripción del PR ya rellenados. La ruta, el título y la
      descripción van en la dirección de esa página, y en una lección
      pequeña también su contenido; GitHub recibe todo eso ya al abrirse
      la página, antes de que confirmes nada. En una lección más grande,
      la app descarga primero el archivo y tú pegas su contenido en el
      editor. En un conjunto con varias lecciones, la app descarga los
      archivos y abre la página de subida de GitHub, donde tú los
      arrastras. En todos estos casos, GitHub crea el fork y el pull
      request solo cuando tú confirmas en GitHub.
    - **Con un token de GitHub** (Ajustes > Integraciones, consulta
      [Ajustes](settings.md)) - compartes una sola lección sin salir de
      la app: la app hace un fork del repositorio, confirma la lección
      con un commit, abre el pull request y luego te muestra el enlace.
      Un conjunto con varias lecciones sigue el camino sin token. Si
      GitHub rechaza el token, el mensaje te remite a Ajustes >
      Integraciones.
- **Compartir como repositorio** - sube el conjunto entero, en el
  formato de repositorio de contenido, a un repositorio de GitHub tuyo
  (que se crea si aún no existe) en un solo commit. Eliges el
  repositorio (`owner/name`) y la rama y, cuando el repositorio se crea,
  si será privado o público; uno que ya existe conserva su visibilidad.
  Antes se ejecuta una comprobación de calidad: si encuentra problemas
  que las comprobaciones de un repositorio de contenido rechazarían, los
  enumera y el botón pasa a **Exportar de todos modos**. Compartir como
  repositorio requiere un token de GitHub y solo está disponible en la
  versión de navegador de la app; si no, el botón sigue visible pero
  desactivado, con el motivo como descripción emergente. Después puedes
  conectar el repositorio como fuente de contenido (consulta
  [Varios repositorios de contenido](../features/content-repos.md)).

Lo que compartes o exportas contiene el contenido de la lección, pero no
el progreso de aprendizaje ni el historial de errores de la app. Lo que
está en la lección va con ella, también lo personal: por ejemplo tu
nombre, si lo indicas al compartir y dejas que se muestre (entonces
figura en la lección y en el pull request), y, en una lección creada a
partir de un análisis de chat, todo lo que encontró el análisis,
incluidos el vocabulario y las frases de ejemplo de tu chat, tus puntos
fuertes y débiles y tus patrones de error frecuentes.

---

## Importar una lección

Haz clic en **Importar lección**, elige un archivo de lección
`.json` o un conjunto `.zip` y la aplicación lo valida y muestra
una vista previa. Confirma para añadirlo a Mis lecciones. Si el
archivo no es válido, verás un motivo específico en lugar de una
importación rota.

Esto cierra el ciclo: un aprendiz exporta una lección, otro la
importa y la reproduce - completamente sin conexión.
