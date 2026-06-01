# Lecciones de contenido y repasos

Una **lección de contenido** es una pequeña unidad de aprendizaje
creada manualmente (normalmente de 5 a 10 minutos) descargada
desde un conjunto de lecciones público. Se ejecuta en un visor
dedicado, no en la sesión de chat de IA. Después de la lección,
la aplicación recuerda exactamente qué palabras, parejas o
frases cometiste errores y las programa para una sesión de repaso
enfocada más adelante.

Las lecciones son un **camino alternativo** de aprendizaje que no
necesita una clave API de IA — perfecto para probar la aplicación
o para contenido donde el material curado supera al chat libre.

---

## De dónde vienen las lecciones

Las lecciones viven en **conjuntos de contenido** — pequeños
paquetes publicados en repositorios públicos de GitHub. El
**Navegador de conjuntos** de la aplicación en `/content` lista
todos los conjuntos disponibles; haz clic en uno para descargarlo.
El conjunto se almacena en caché localmente (en el sistema de
archivos si ejecutas con un backend, en IndexedDB en el despliegue
solo para el navegador), así que puedes estudiar sin conexión
después de la primera descarga.

El conjunto piloto de v1.27.0 es **Francés A1** (2 lecciones, 14
tarjetas, 9 ejercicios que cubren los cuatro tipos de ejercicios).
Cada versión posterior añade más — consulta el
[repositorio de conjuntos](https://github.com/astrapi69/adaptive-learner-content)
para el catálogo actual.

---

## El flujo de la lección

Abre un conjunto, elige una lección y el **visor de lecciones**
te guía por cada tarjeta y ejercicio paso a paso:

1. Las **tarjetas** presentan material para leer. Haz clic en
   «Siguiente» cuando estés listo.
2. Los **ejercicios** comprueban lo que recuerdas. Se incluyen
   cuatro tipos:
   - **Emparejamiento** — arrastra parejas (palabra ↔ traducción).
   - **Elección de imagen** — elige la imagen que coincide con el
     enunciado.
   - **Texto libre** — escribe la respuesta.
   - **Fichas de palabras** — construye una oración con fichas.

Una barra de progreso en la parte superior muestra el avance por
la lección. Puedes salir en cualquier momento — tu progreso se
guarda por paso y se reanuda donde lo dejaste.

### La pantalla de resumen

Cuando el último ejercicio se completa, aparece el **resumen de
la lección**:

- Una **valoración de 0 a 3 estrellas** basada en tu puntuación:
  - **3 estrellas** ≥ 90 % correcto
  - **2 estrellas** ≥ 75 %
  - **1 estrella** ≥ 50 %
  - **0 estrellas** por debajo del 50 %
- Un **desglose por ejercicio** que muestra qué ejercicios
  superaste y cuáles tuvieron errores (con la respuesta correcta
  revelada para los incorrectos).
- Botones de **Siguiente lección**, **Repetir** y **Volver al
  conjunto** para que la siguiente acción sea un solo clic.

Consigue 3 estrellas en tu primer intento y las estrellas muestran
una pequeña animación de celebración. (Si tienes activado el
ajuste del sistema operativo «reducir movimiento», la animación
lo respeta.)

---

## Seguimiento de errores a nivel de elemento

Cada respuesta incorrecta en cada tipo de ejercicio escribe una
fila vinculada al **elemento específico que fallaste** — la
palabra, pareja o frase individual. La aplicación NO solo recuerda
«obtuviste 6/10 en la lección 3»; recuerda «tuviste dificultades
específicamente con *bonjour* y *merci*».

Acierta el mismo elemento **3 veces seguidas** y pasa a
**dominado** — eliminado de la cola de repaso. Falla un elemento
dominado más adelante y **retrocede** a la cola. Un dominio
fallido es un dominio olvidado.

---

## La cola de repaso

Cuando tienes uno o más elementos que necesitan repaso, la
**tarjeta de cola de repaso** aparece en el Panel principal.
Muestra:

- Cuántos elementos están pendientes
- Cuántos están **vencidos** (pasada su fecha de repaso
  programada)
- Un botón **Repasar ahora** que abre una minisesión enfocada
  en `/review/:setId`

La programación usa tres bandas según cuántas veces hayas
acertado el elemento consecutivamente:

| Racha de aciertos | Siguiente repaso |
|---|---|
| 0 | 1 día después |
| 1 | 3 días después |
| 2 | 7 días después |
| 3 (dominado) | eliminado de la cola |

Dentro de la cola, los elementos se ordenan: **vencidos primero**,
luego por **recuento de errores descendente**, luego por
**fallo más reciente primero**. Así los elementos con los que más
dificultades tienes suben a la cima.

---

## Sesiones de repaso

Una sesión de repaso en `/review/:setId` sintetiza una
**minilección al vuelo** a partir de los elementos más prioritarios
de tu cola. Estrategia mixta desde **v1.35.0**:

- Si fallaste originalmente una palabra en un ejercicio de
  **emparejamiento** o **elección de imagen**, repetirás ese
  ejercicio (con nuevo orden aleatorio para que no sea solo
  memoria muscular).
- Si fallaste algo en **texto libre** o **fichas de palabras**,
  el repaso intenta generar un ejercicio de **relleno de huecos**
  dirigido exactamente a la palabra que fallaste. El mismo
  conocimiento en una forma diferente — se ejercita tu
  flexibilidad, no solo el recuerdo de un formato específico.
- Si la generación del relleno de huecos no puede construir un
  hueco limpio para ese elemento (p. ej., el enunciado fuente no
  incluía la respuesta en línea), el repaso vuelve silenciosamente
  a reproducir el original. Nunca verás un paso roto o vacío.

Cuando terminas una sesión de repaso, la misma maquinaria de
puntuación + valoración con estrellas + seguimiento de elementos
se ejecuta. Domina 50 elementos a través de los repasos y obtendrás
la insignia **Maestro del repaso**.

## Ronda de corrección al final de cada lección

Novedad en **v1.35.0**: cuando terminas una lección que tuvo
respuestas incorrectas, la pantalla de resumen muestra una pequeña
**ronda de corrección** entre tu puntuación y el botón «Siguiente
lección». Toma hasta cinco de tus errores específicos de esta
lección y ofrece cada uno como un nuevo relleno de huecos dirigido
a la palabra o el artículo exacto que fallaste.

- **Puedes saltártela en cualquier momento.** El botón «Siguiente
  lección» permanece visible durante toda la ronda — la ronda de
  corrección es práctica opcional, no una barrera.
- **Solo aparece cuando hay algo que corregir.** Las lecciones
  perfectas la omiten por completo. Las lecciones cuyos errores no
  pueden convertirse en un relleno de huecos limpio (infrecuente)
  también la omiten.
- **Cada relleno completado cuenta para el dominio.** La ronda de
  corrección escribe las mismas filas de seguimiento de elementos
  que la lección principal; tu racha en esos elementos específicos
  avanza hacia el umbral de 3 aciertos para el dominio.

Una línea corta «{n} elementos mejorados» aparece al final de la
ronda para que puedas ver el impacto de tu práctica extra.

## Retroalimentación con diferencia visual

También nuevo en **v1.35.0**: las respuestas incorrectas de texto
libre y fichas de palabras muestran ahora una **diferencia a nivel
de token** entre lo que escribiste y la respuesta canónica. Tres
colores, nunca solo color:

- **Tachado rojo** — lo que escribiste que no corresponde (con un
  marcador × para lectores de pantalla y usuarios con daltonismo).
- **Verde** — lo que incluye la respuesta canónica y que te faltó
  (con un marcador +).
- **Ámbar** con flecha → — una palabra que escribiste con un pequeño
  error, mostrada como `lo-que-escribiste` → `esperado`.

La misma diferencia aparece en las filas del desglose por ejercicio
del resumen de la lección para cualquier intento de texto libre o
fichas de palabras que el almacén v1.35.0+ tenga registrado con
la respuesta del usuario.

---

## XP e insignias

Cada lección completada otorga XP según una fórmula por estrellas:

- **30 XP** base
- **+10 XP por estrella** obtenida (0 → 0, 1 → +10, 2 → +20, 3 → +30)
- **+20 XP de bonificación** si obtienes 3 estrellas en el primer
  intento (cada paso con intentos = 1, sin reintentos)
- El mismo **multiplicador de racha diaria** que las sesiones de
  chat (+25 % por cada día consecutivo de actividad, limitado a
  7 días)

Cuatro nuevas insignias se desbloquean en torno a las lecciones:

- **Primera lección** — completa tu primera lección de contenido.
- **10 lecciones completadas** — completa 10 lecciones de contenido.
- **Racha de 3 estrellas** — obtén 3 estrellas en tres lecciones
  seguidas.
- **Maestro del repaso** — domina 50 elementos a través de la
  repetición espaciada.

Las finalizaciones de lecciones también cuentan para tu **racha
diaria**, por lo que estudiar con lecciones de contenido rellena
el mapa de calor igual que las sesiones de chat.

---

## Modos de almacenamiento

Las lecciones funcionan en **ambos** modos de almacenamiento —
API (backend) y Dexie (solo navegador / GitHub Pages). El
seguimiento de errores a nivel de elemento y la programación SRS
se ejecutan de forma idéntica contra IndexedDB en el despliegue
solo para el navegador, por lo que los usuarios que visiten el
sitio público de GitHub Pages obtienen el bucle de repaso completo
sin un backend.

Lo que es *diferente* en el modo solo navegador: los efectos
secundarios de otorgamiento de XP y obtención de insignias solo
se activan en el modo API (necesitan los hooks de gamificación del
backend). En el modo Dexie sigues ganando XP e insignias a través
de las sesiones de chat; la finalización de la lección simplemente
no añade a ese total por ahora.

---

## Privacidad

Todo el progreso de las lecciones, las filas de errores de
elementos, el estado de la cola de repaso y los datos de
programación permanecen **en tu propio dispositivo** en modo API
(sistema de archivos) o navegador (IndexedDB). Nada sobre qué
palabras te cuestan más se envía a ningún lugar.
