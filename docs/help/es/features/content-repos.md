# Varios repositorios de contenido

Las lecciones provienen de **repositorios de contenido**, repos
públicos de GitHub que agrupan conjuntos estructurados de
lecciones. No estás limitado al catálogo oficial: Adaptive Learner
puede cargar varios repositorios a la vez, conectar los tuyos
propios y recomendar repos curados (EXP-023).

<!-- TODO: Captura de pantalla — Ajustes → Datos → sección Repositorios de contenido con el repo oficial + un repo propio -->

---

## El repositorio oficial

El repo oficial
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
siempre está cargado y no se puede eliminar. Proporciona el
catálogo estándar mantenido (cursos de idiomas, fundamentos de
Python, psicología y más). Cada conjunto de él lleva en el
explorador de contenido la insignia de origen **Oficial**.

Además, una selección de lecciones está **integrada** directamente
en la app (Incluido), de modo que la página pública de GitHub
Pages muestre contenido de inmediato incluso sin conexión a la
red. Si un conjunto existe tanto incluido como en el repo oficial,
gana la versión más alta; en caso de empate, se prefiere la
variante de GitHub.

---

## Conectar un repositorio propio

En **Ajustes → Datos → Repositorios de contenido** añades una URL
de repo de GitHub. La app comprueba el repo automáticamente
(consulta *Niveles de confianza* más abajo), sincroniza el
catálogo de lecciones y lo almacena localmente en la misma caché
que el contenido oficial (sistema de archivos en modo servidor,
IndexedDB en modo navegador puro).

- **Sincronización manual y automática.** Puedes pulsar
  "Sincronizar ahora" en cualquier momento; además, cada repo se
  actualiza automáticamente cada 24 horas.
- **Insignia de origen.** Los conjuntos de tu repo llevan en el
  explorador de contenido su propia insignia de origen, de modo
  que siempre ves de dónde procede una lección.

---

## Gestionar varios repositorios

Puedes conectar todos los repos que quieras. En la lista de
**Ajustes → Datos** puedes:

- **Añadirlos** mediante la URL del repo,
- **Eliminarlos** (el repo oficial queda protegido),
- **Reordenarlos** — el orden determina la **prioridad**. Si dos
  repos contienen el mismo conjunto, gana el que está más arriba.

Las instalaciones más antiguas con un solo repo conectado se
migran automáticamente a la nueva presentación en lista.

---

## Compartir repositorios

Puedes compartir un repo mediante un **enlace directo** y un
**código QR**. Un enlace del tipo `/add-repo?...` abre en el
receptor directamente el cuadro de diálogo "Añadir repositorio"
con la URL precargada; el código QR hace lo mismo en el
smartphone. Así compartes un curso con tu grupo de estudio sin
teclear nada a mano.

<!-- TODO: Captura de pantalla — Cuadro de diálogo para compartir con código QR -->

---

## Niveles de confianza

Cada repo conectado pasa por una **validación técnica
automática**, que se ejecuta de nuevo en cada sincronización. De
ahí resulta un nivel de confianza:

| Nivel | Significado |
|---|---|
| **0** | Aún no validado o validación fallida. |
| **1** | Técnicamente válido: al menos una lección, sin contenido ejecutable. |
| **3** | **Recomendado oficialmente** — de la lista curada de recomendaciones. |

La validación es puramente técnica (estructura + seguridad). Una
valoración de contenido/basada en la comunidad (confianza 2)
necesita un servicio de backend compartido y está aplazada por
ahora.

---

## Repositorios recomendados

El repo oficial mantiene una lista curada
(`recommended-repos.json`). En **Ajustes → Datos** hay a partir de
ella una sección de descubrimiento en la que añades repositorios
recomendados con **un clic**. Aparecen con la insignia
**Recomendado oficialmente** (confianza 3).

---

## Valoraciones locales

Puedes dar **estrellas** a cada repo localmente. Esta valoración
es puramente privada y solo se guarda en tu dispositivo; te ayuda
a organizar tus propios orígenes. Las valoraciones a nivel de
comunidad también necesitan un servicio de backend compartido y
están aplazadas.

---

## Repositorios privados y de profesores

Un repo puede ser privado (por ejemplo, de un docente). Para ello
guardas por repo un **token de acceso personal**. El token se
mantiene localmente (localStorage) y, de forma deliberada, **no**
forma parte de la configuración exportable, para que no se incluya
accidentalmente al compartir los ajustes.

---

## Páginas relacionadas

- [Explorador de contenido](content-browser.md) — encontrar, filtrar y descargar conjuntos
- [Crear lecciones](../content-creation/overview.md) — aportar contenido propio
- [Copia de seguridad y restauración](backup.md) — los repos conectados forman parte del snapshot
