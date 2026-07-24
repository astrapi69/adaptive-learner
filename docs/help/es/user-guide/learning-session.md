# Una sesión de aprendizaje

Una sesión es una conversación enfocada con la IA a través del
ciclo de aprendizaje de siete pasos. Las sesiones son cortas:
entre 15 y 45 minutos es lo habitual. El botón «Iniciar sesión»
del Panel principal crea una nueva; la aplicación elige el método
de aprendizaje (tu dominante según la evaluación) y el paso inicial
del ciclo (normalmente 1 = Entrada).

## Los siete pasos

| # | Paso | Lo que ocurre |
|---|------|---------------|
| 1 | Entrada | La IA presenta material nuevo al estilo del método activo |
| 2 | Intento | Aplicas lo que acabas de aprender; la IA plantea una tarea |
| 3 | Error | Aparece un error; la IA lo marca con precisión |
| 4 | Retroalimentación | La IA explica la corrección en profundidad |
| 5 | Adaptación | Ajustas tu enfoque; la IA puede reformular |
| 6 | Repetición | Una tarea nueva que ejercita el mismo concepto |
| 7 | Integración | La IA conecta el material de hoy con el contexto más amplio |

El ciclo es un *marco*, no una cinta transportadora. Los pasos
pueden repetirse, saltar hacia adelante o incluso retroceder cuando
tu último turno muestra confusión. La IA juzga por turno y la barra
de progreso de la aplicación se actualiza en consecuencia.

[El ciclo en detalle](../concept/seven-steps.md)

## Cómo te guía la IA

Cada mensaje que envías activa hasta tres llamadas a la IA:

1. **La respuesta de aprendizaje** - transmitida token a token
   mediante SSE. Ves el cursor en línea (▍) mientras el asistente
   piensa; los tokens aterrizan en la burbuja a medida que llegan
   (sin marcador de «Pensando...»). El prompt del sistema se
   compone a partir de una matriz de 42 celdas (6 métodos × 7
   pasos), por lo que una Entrada deductiva se siente muy diferente
   a una Repetición contextual.
2. **El evaluador de pasos** - una segunda llamada a la IA lee el
   intercambio y decide si estás listo para avanzar. Emite
   `advance`, `confidence`, `reason`, `suggested_step`. La
   aplicación aplica la sugerencia cuando la confianza ≥ 0,6.
3. **El evaluador de transición de tema** (solo en el paso 7) -
   una tercera llamada a la IA decide si el tema ha sido integrado.
   Si es así Y `continue_recommended`, un nuevo ciclo comienza
   automáticamente con un subtema nuevo (auto-bucle, máximo 5
   ciclos por sesión).

El veredicto se muestra discretamente sobre el chat como una
notificación «Paso movido de X a Y porque…» cuando realmente se
aplica. Las tarjetas de transición de ciclo se muestran como
tarjetas «Ciclo N» con borde discontinuo en el historial del chat.

**Voz activada / desactivada** - un botón de TTS (▶) junto a cada
respuesta de la IA la lee en voz alta; un botón de micrófono (🎤)
en la entrada te permite dictar; las transcripciones provisionales
rellenan el área de texto para que puedas revisar antes de enviar.
Ambas son de la Web Speech API; actívalas en Ajustes → Voz.

## Indicador de progreso del ciclo

En la parte superior de la página de Sesión hay una tira de
progreso de 7 círculos. El paso actual está relleno con el color
de acento de tu proyecto; los pasos pasados están rellenos más
tenuemente; los futuros están vacíos. Cuando el evaluador te mueve
hacia adelante (¡o hacia atrás!), la tira se anima para hacer
visible la transición.

En móvil (≤768px) la tira se convierte en una única fila
horizontal de pequeños círculos para ahorrar espacio vertical.

## Recomendaciones de cambio de método

A veces el método activo sencillamente no funciona. Después de
tres sesiones en las que tu calificación de «comprensión» no crece
y tu calificación de «estrés» se mantiene alta, la aplicación
muestra un **Banner de cambio de método**: «¿Quieres probar [otro
método] para la siguiente sesión?». Acepta y la siguiente sesión
comienza con el nuevo método activo.

La recomendación lee tu perfil y prefiere tu segundo método más
fuerte que no hayas usado recientemente. Puedes descartar el
banner; volverá si el patrón de estancamiento continúa.

Ambos modos de almacenamiento (Servidor + Local) admiten
recomendaciones de cambio de método.

## Calificación + finalización de una sesión

La página de Sesión tiene un botón «Finalizar sesión». Antes de
que se cierre rellenas una breve calificación: comprensión, estrés
y adecuación del método en una escala 1-5, más una **nota de texto
enriquecido** opcional (TipTap: negrita, cursiva, listas, bloques
de código con resaltado de sintaxis, enlaces). La nota es tuya: la
IA no la lee.

Las calificaciones + el resumen del viaje de varios ciclos se
convierten en una fila `ProgressCommit`, la instantánea al estilo
Git de una sesión. Completar una sesión otorga XP (50 base ×
multiplicador de racha, más bonificaciones por ciclo), verifica las
insignias recién ganadas y actualiza tu racha. Ver
[Progreso](progress.md), [Panel principal](dashboard.md) y el
[concepto de Seguimiento](../concept/tracking.md).
