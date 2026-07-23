# Lecciones de contenido y repasos

Una **lección de contenido** es una pequeña unidad de aprendizaje
hecha a mano (normalmente de 5 a 10 minutos) que se descarga de un
conjunto de lecciones público. Se ejecuta en un visor propio, no
en la sesión de chat con IA. Tras la lección, la app recuerda
exactamente qué palabras, parejas o frases respondiste mal y las
programa para una sesión de repaso enfocada más adelante.

Las lecciones son una **vía de aprendizaje alternativa** que no
requiere una clave de API de IA, ideal para probar la app o para
contenidos en los que el material curado funciona mejor que el
chat libre.

---

## De dónde provienen las lecciones

Las lecciones residen en **conjuntos de contenido**, pequeños
paquetes publicados en repos públicos de GitHub. El
**explorador de conjuntos** en `/content` enumera cada conjunto
disponible; haz clic en uno para descargarlo. El conjunto se
almacena en caché localmente (en el sistema de archivos en modo
backend, en IndexedDB en modo navegador puro), de modo que tras la
primera descarga puedas aprender sin conexión.

La biblioteca incluida abarca varios conjuntos de contenido en
distintos idiomas y dominios. Cada versión añade más: consulta
el
[repo de conjuntos](https://github.com/astrapi69/adaptive-learner-content)
para ver el catálogo actual.

---

## El flujo de la lección

Abre un conjunto, elige una lección y el **visor de lecciones** te
guía paso a paso por cada tarjeta y ejercicio:

1. Las **tarjetas** presentan material para leer. Haz clic en
   "Siguiente" cuando estés listo.
2. Los **ejercicios** comprueban lo que has recordado. Hay cuatro
   tipos disponibles:
   - **Asociar** — arrastra parejas (palabra ↔ traducción). Las
     dos fichas de una pareja encontrada comparten un **color
     propio** y una **insignia numérica**, de modo que la
     asociación sea reconocible de forma segura para daltónicos
     (no solo por color).
   - **Elección de imagen** — elige la imagen que corresponde a la
     pista.
   - **Texto libre** — escribe la respuesta.
   - **Fichas de palabras** — compón una frase a partir de fichas.
   - **Texto con huecos** — completa un hueco en la frase (se
     genera específicamente a partir de tus errores, ver más
     abajo).

Una barra de progreso en la parte superior sigue cuánto has
avanzado en la lección. Puedes parar en cualquier momento: tu
progreso se guarda paso a paso y continúa donde lo dejaste.

### Atajo Enter

Puedes manejar toda la lección con el teclado: **Enter** comprueba
un ejercicio respondido y luego pasa al siguiente paso; los campos
de texto libre y de texto con huecos se envían con Enter (sin
salto de línea). Los controles que necesitan Enter por sí mismos
mantienen la prioridad. El atajo es conmutable en **Ajustes →
Aprendizaje** (activado por defecto) y también vale en la
repetición de errores ("Repetir errores").

### Enlaces de ejemplo y de teoría

- **Ver ejemplo:** un paso de teoría puede llevar un enlace
  opcional a un ejemplo detallado, que aparece como botón "Ver
  ejemplo".
- **Volver a leer la teoría:** un ejercicio muestra un enlace
  discreto a la teoría precedente más cercana; desde ahí, "Volver
  al ejercicio" te lleva de nuevo a la tarea. Así consultas una
  regla sin perder el hilo.

### El resumen

Cuando se completa el último ejercicio, aparece el **resumen de la
lección**:

- Una **valoración de estrellas de 0 a 3** basada en tu
  resultado:
  - **3 estrellas** ≥ 90 % correcto
  - **2 estrellas** ≥ 75 %
  - **1 estrella** ≥ 50 %
  - **0 estrellas** por debajo del 50 %
- Un **desglose ejercicio por ejercicio** que muestra qué
  ejercicios has aprobado y cuáles contenían errores (con la
  respuesta correcta para los fallados).
- **Siguiente lección**, **Repetir** y **Volver al conjunto** como
  botones, para que la siguiente acción esté a un clic de
  distancia.

Si logras 3 estrellas al primer intento, se reproduce una pequeña
animación de celebración. (Si tienes activado el ajuste del SO
"reducir movimiento", la animación lo respeta.)

### Exportar el resultado

El resumen ofrece **"Copiar resultado"** y **"Guardar como
archivo"**. Ambos generan un **informe Markdown** con tu
puntuación, un desglose error por error (tu respuesta + la
respuesta correcta) y las áreas que aún son débiles. El informe se
presta para pegarlo en un asistente de IA que te ayude de forma
específica. La exportación es un generador puro sin backend y
funciona en ambos modos de almacenamiento.

---

## Seguimiento de errores a nivel de elemento

Cada respuesta incorrecta en cada tipo de ejercicio escribe una
línea que apunta al **elemento concreto que fallaste**: la palabra,
la pareja o la frase individual. La app NO recuerda solo "lograste
6/10 en la lección 3"; recuerda "te costó especialmente *bonjour*
y *merci*".

Cuando respondes el mismo elemento correctamente **3 veces
seguidas**, se marca como **dominado** y se elimina de la cola de
repaso. Si más tarde respondes mal un elemento dominado, **vuelve
a bajar** a la cola. Un dominio fallado es un dominio olvidado.

---

## La cola de repaso

Cuando tienes uno o más elementos que necesitan repaso, aparece la
**tarjeta de repaso** en el Dashboard. Muestra:

- Cuántos elementos están pendientes
- Cuántos están **vencidos** (pasada la fecha de repaso prevista)
- Un botón **Repasar ahora** que abre una mini sesión enfocada en
  `/review/:setId`

La programación utiliza tres niveles, basados en cuántas veces
seguidas has respondido bien el elemento:

| Racha correcta | Próximo repaso |
|---|---|
| 0 | 1 día después |
| 1 | 3 días después |
| 2 | 7 días después |
| 3 (dominado) | eliminado de la cola |

Dentro de la cola, las entradas se ordenan: **primero las
vencidas**, luego por **número de errores en orden descendente**,
luego por **error más reciente primero**. Así suben los elementos
con los que más te cuesta.

---

## Sesiones de repaso

Una sesión de repaso en `/review/:setId` sintetiza una
**mini-lección sobre la marcha** a partir de las entradas
superiores de tu cola. Estrategia mixta:

- Si fallaste originalmente una palabra en un ejercicio de
  **asociación** o de **elección de imagen**, haces exactamente ese
  ejercicio de nuevo (con una mezcla nueva, no solo memoria
  muscular).
- Si fallaste algo en **texto libre** o **fichas de palabras**, el
  repaso intenta generar un ejercicio de **texto con huecos** que
  apunte exactamente a la palabra fallada. El mismo conocimiento en
  otra forma: se entrena la flexibilidad, no solo la repetición de
  un formato de ejercicio específico.
- Si para un elemento no se puede construir un texto con huecos
  correcto (p. ej. cuando la consigna original no contenía la
  respuesta en la frase), el repaso reproduce silenciosamente el
  ejercicio original. Nunca obtienes un paso roto o vacío.

Cuando completas una sesión de repaso, se ejecuta la misma
maquinaria de valoración + estrellas + seguimiento de elementos.
Domina 50 elementos mediante repasos y consigues la insignia
**Maestro del repaso**.

## Ronda de corrección al final de la lección

Cuando completas una lección con errores,
la página de resumen muestra una pequeña **ronda de corrección**
entre tu puntuación y el botón "Siguiente lección". Toma hasta
cinco errores concretos de esa lección y ofrece cada uno como un
texto con huecos nuevo que apunta exactamente a la palabra / el
artículo fallado.

- **Omitible en cualquier momento.** El botón "Siguiente lección"
  permanece visible: la ronda de corrección es práctica
  voluntaria, no una barrera.
- **Aparece solo si hay algo que corregir.** Las lecciones con
  puntuación perfecta la omiten por completo. También las
  lecciones cuyos errores no se pueden reformular en un texto con
  huecos correcto (algo poco frecuente).
- **Cada texto con huecos completado cuenta para el dominio.** La
  ronda de corrección escribe los mismos registros de seguimiento
  de elementos que la lección principal; tu racha en esos
  elementos avanza hacia el umbral de dominio de 3 correctas.

Al final aparece una breve línea "{n} elementos mejorados" para
que veas el efecto de tu práctica adicional.

## Feedback visual de diferencias

Las respuestas incorrectas de
texto libre y de fichas de palabras muestran ahora una
**diferencia a nivel de token** entre tu entrada y la respuesta
canónica. Tres colores, nunca solo color:

- **Rojo tachado** — lo que escribiste y no correspondía (con una
  marca × para lectores de pantalla y usuarios daltónicos).
- **Verde** — lo que la respuesta canónica contiene y pasaste por
  alto (con una marca +).
- **Amarillo** con flecha → — una palabra ligeramente incorrecta,
  representada como `tu-palabra` → `esperada`.

La misma diferencia aparece en el resumen de la lección, en el
desglose de cada ejercicio, para cada respuesta de texto libre o
de fichas de palabras cuya entrada del usuario conoce el
almacenamiento.

---

## XP e insignias

Cada lección completada otorga XP según una fórmula de estrellas:

- **30 XP** de base
- **+10 XP por estrella** lograda (0 → 0, 1 → +10, 2 → +20, 3 →
  +30)
- **+20 XP de bonificación** si consigues 3 estrellas al primer
  intento (cada paso con intentos = 1, sin repeticiones)
- El mismo **multiplicador de racha diaria** que en las sesiones
  de chat (+25 % por día consecutivo, con tope a los 7 días)

Cuatro insignias nuevas se desbloquean en torno a las lecciones:

- **Primera lección** — completa tu primera lección de contenido.
- **10 lecciones completadas** — completa 10 lecciones de
  contenido.
- **Racha de 3 estrellas** — logra tres lecciones seguidas con 3
  estrellas.
- **Maestro del repaso** — domina 50 elementos mediante repetición
  espaciada.

Las lecciones completadas también cuentan para tu **racha
diaria**, de modo que aprender con lecciones de contenido llena el
mapa de calor del mismo modo que las sesiones de chat.

---

## Modos de almacenamiento

Las lecciones funcionan en **ambos** modos de almacenamiento: API
(backend) y Dexie (solo navegador / GitHub Pages). El seguimiento
de errores a nivel de elemento y la programación SRS se ejecutan
de forma idéntica contra IndexedDB en modo navegador puro, de modo
que quienes visiten la página pública de GitHub Pages obtengan el
ciclo completo de repaso sin backend.

La gamificación también está alineada: en
modo navegador puro consigues por las lecciones completadas **los
mismos XP e insignias de lección** que en modo servidor; la lógica
de estrellas, racha e insignias está portada a TypeScript y
asegurada contra valores de referencia idénticos. Ya no hay
ninguna diferencia funcional entre los modos al completar una
lección.

---

## Privacidad

Todos los progresos de lecciones, las líneas de errores de
elementos, los estados de la cola de repaso y los datos de
programación permanecen **en tu propio dispositivo**, en el
sistema de archivos (modo API) o en el navegador (IndexedDB). No
se envía a ningún sitio nada sobre con qué palabras te cuesta.
