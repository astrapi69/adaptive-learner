# La evaluación de tipo de aprendizaje

La evaluación consiste en 12 preguntas sobre cómo tiendes a
abordar el material nuevo. Cada pregunta lleva entre 5 y 10
segundos responderla; toda la prueba se completa en menos de
dos minutos.

## Cómo funciona

Cada pregunta muestra 3-4 posibles respuestas. La mayoría de las
preguntas son de **selección única** (botones de opción — elige una).
Algunas son de **selección múltiple** (casillas de verificación —
elige todo lo que corresponda). La aplicación te indica de qué tipo
es cada pregunta.

En dispositivos móviles y táctiles, **desliza a izquierda o derecha**
para navegar entre preguntas. Las teclas de flecha del teclado hacen
lo mismo en el escritorio. Una sugerencia de una sola vez en la
primera pregunta lo señala.

Detrás de cada respuesta hay un peso: cuánto orientarte hacia uno
de los seis métodos de aprendizaje (deductivo, inductivo, basado en
errores, dialógico, contextual, adaptativo con IA) supone elegirla.
La calculadora suma esos pesos, normaliza por el número de preguntas
y produce un perfil de 6 métodos.

## Los seis métodos de un vistazo

| Método | Fortaleza |
|--------|-----------|
| Deductivo | Reglas primero, ejemplos después — orientado a la teoría |
| Inductivo | Ejemplos primero, deducir la regla — orientado a los patrones |
| Basado en errores | Provocar errores, aprender de ellos — orientado a la fricción |
| Dialógico | Conversación sin presión — orientado al intercambio |
| Contextual | Escenarios del mundo real — orientado a la situación |
| Adaptativo con IA | La IA elige por turno — orientado a la meta |

[Los seis métodos en profundidad](../concept/six-methods.md)

## Tu perfil

Después de la última pregunta verás un **gráfico radar**: seis ejes,
el peso de cada método como un punto en su eje. La forma te dice
mucho:

- **Un punto claro** que sobresale mucho = un método dominante.
  La aplicación se apoyará en ese método por defecto.
- **Una forma redonda** = aprendiz equilibrado. La aplicación
  comienza con el predeterminado «deductivo» pero está más
  dispuesta a cambiar de método entre sesiones.
- **Una forma plana** con valores bajos = no elegiste preferencias
  fuertes. No hay problema; el método adaptativo con IA funciona
  especialmente bien en este caso.

El **método dominante** (peso más alto, desempate alfabético) se
muestra explícitamente encima del gráfico. Un botón de
**Texto a voz** junto al resultado lee el resumen en voz alta
(Web Speech API; funciona en navegadores modernos).

## Preguntas de selección múltiple

Cuando una pregunta permite múltiples respuestas, el peso de cada
elección se divide por cuántas elegiste. Elegir dos respuestas
aporta el mismo peso total que elegir una: no puedes manipular la
prueba eligiendo siempre todo.

## Repetir la evaluación

Tu visión de cómo aprendes cambia con el tiempo. La página de
Evaluación es siempre accesible desde el enlace «Repetir
evaluación» del Panel principal. Volver a evaluarte aumenta el
campo `version` de tu perfil y sobrescribe los pesos anteriores;
el comportamiento de la IA cambia a partir de la siguiente sesión.

## Omitir la evaluación

Si omites la prueba, la aplicación usa **deductivo** como método
predeterminado y seguirás obteniendo sesiones útiles. Realiza la
evaluación cuando estés listo: no hay penalización por retrasarla.
