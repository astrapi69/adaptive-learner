# Repositorios de contenido - publicar tu propio repositorio

Adaptive Learner incluye una biblioteca de contenido oficial, pero el
sistema de contenido es abierto: puedes mantener tu **propio
repositorio de contenido** en GitHub, conectarlo en la app y ponerlo a
disposición de otras personas que aprenden. Esta página ofrece la
visión general; las instrucciones completas paso a paso están en la
**[Guía de repositorios de contenido](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**.

---

## ¿Qué es un repo de contenido?

Un repo de contenido es un repositorio de GitHub que contiene
**conjuntos de contenido** en el formato de Adaptive Learner. Un
conjunto es una colección de lecciones para un par de idiomas y un
nivel (por ejemplo "Español A1 para hablantes de alemán") o para un
dominio de conocimiento (por ejemplo "Fundamentos de Python").

La biblioteca oficial y todos los repos de usuarios usan el **mismo
formato** - no existe un esquema "oficial" aparte. En cuanto tu repo
supera la validación, es una fuente de contenido de pleno derecho.
Nunca necesitas un servidor propio: un repo de contenido no es más que
archivos en un repositorio Git.

---

## Requisitos previos

- Un **repositorio de GitHub** (público; también es posible uno
  privado, mediante un token por repo).
- Un **`manifest.yaml`** en la raíz que enumere tus conjuntos.
- Lecciones en el **formato de lección**.
- Python 3 con PyYAML, para validar localmente antes de publicar.

Las referencias de formato de autoridad están en el repo de contenido
oficial:

- [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

---

## Estructura de directorios

Un repo de contenido sigue un árbol fijo. El idioma de origen (el
idioma en que están escritas las explicaciones) es la carpeta
superior; el idioma de destino y el nivel forman la siguiente:

```
my-content-repo/
  manifest.yaml                  # root manifest: lists every set
  sets/
    de/                          # source language (German speakers)
      es-a1/                     # target language + level (Spanish A1)
        manifest.yaml            # set manifest: lists the lessons
        lessons/
          01-greetings.json      # one JSON file per lesson (NN-slug.json)
        assets/                  # optional: images / audio
  scripts/validate_content.py    # the validator (from the starter kit)
```

---

## Validar localmente

```bash
pip install pyyaml
python3 scripts/validate_content.py
```

Código de salida 0 cuando todos los conjuntos pasan; en caso
contrario, 1 con un informe por archivo. Comprueba el esquema, la
estructura de directorios y los mínimos de calidad (al menos 5
ejercicios, 2 tipos de ejercicio, 1 paso de teoría por lección, campos
de tarjeta no vacíos, etc.).

---

## ¿Cómo aparece en la app?

Una vez que tu repo se valida, quien aprende lo conecta en
**Ajustes > Datos > Repositorios de contenido**: pega la URL, la app
obtiene el manifiesto raíz, lo valida técnicamente, sincroniza los
conjuntos y los almacena en caché. Después aparecen en el
**Explorador de contenido** con una insignia de origen. Los repos
también se pueden compartir mediante un enlace `/add-repo` y un
código QR.

Un repo llega a la sección **Repositorios recomendados** de la app
solo a través del `recommended-repos.json` curado por el equipo del
proyecto - el canal para el respaldo oficial (confianza 3).

---

## Niveles de confianza

El nivel de confianza indica a quien aprende cuánta revisión ha tenido
el contenido. Se refiere a la procedencia y a la revisión, no es un
veredicto sobre la calidad.

| Nivel | Nombre | Significado |
|-------|------|---------|
| **1** | Validado | Esquema correcto, se cumplen los mínimos de calidad - automáticamente al sincronizar. El contenido no se revisa individualmente. |
| **2** | Verificado | Aportado por la comunidad y revisado por un mantenedor en cuanto a la corrección del contenido. |
| **3** | Oficial | Curado y con calidad asegurada por el equipo del proyecto. |

La confianza 2+ exige más que los mínimos técnicos: traducciones
precisas, artículos/géneros correctos, acentos completos, una
progresión sensata, distractores plausibles y precisión cultural. Una
**revisión con IA** opcional dentro de la app ayuda a los autores a
detectar estos problemas antes de compartir (ver EXP-033); es
orientativa y nunca bloquea el compartir.

---

## Reciprocidad para cursos y sitios web (EXP-029)

Las lecciones y los dominios pueden llevar **medios complementarios**
(vídeos, pódcasts, artículos, libros, cursos, sitios web). El filtro
para los medios comerciales es la **reciprocidad, no el precio**: los
medios gratuitos siempre están permitidos; los cursos/sitios web
comerciales solo cuando el proveedor enlaza de vuelta, mantiene su
propio repo de contenido o tiene una colaboración documentada. Así los
autores de contenido se convierten en socios del ecosistema en lugar
de anunciantes. Detalles en
`docs/explorations/EXP-029-media-reciprocity.md`.

---

## Kit de inicio como plantilla

La forma más rápida de empezar es el repo de inicio ya preparado
**[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test)**:
contiene `docs/`, plantillas por dominio, una lección de ejemplo
completa (el efecto Inception), un conjunto de ejemplo ejecutable,
`books.yaml` y el validador. Haz un fork, sustituye la lección de
ejemplo por la tuya, regístrala en el `manifest.yaml` raíz, valida y
conecta el repo en la app.

---

## Véase también

- **[Guía completa de repositorios de contenido](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**
- [Crear lecciones - Visión general](overview.md)
- [Recomendaciones de libros](books.md)
