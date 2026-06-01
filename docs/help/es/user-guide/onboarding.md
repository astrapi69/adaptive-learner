# Incorporación

Después del selector de idioma en la página de inicio, el flujo
de incorporación recopila cuatro campos obligatorios más una
taxonomía opcional:

1. **Tema** — qué quieres aprender. «Gramática española»,
   «Fundamentos de aprendizaje automático», «Improvisación de
   guitarra solista». Sé específico; la IA lo usará para anclar
   cada sesión.
2. **Objetivo** — cómo se ve el éxito. «Aprobar el examen B2»,
   «Construir un motor de recomendaciones de extremo a extremo»,
   «Tocar un solo en un blues de 12 compases sobre una pista de
   acompañamiento sin perder el tiempo.» Los objetivos concretos
   producen una orientación de la IA más útil.
3. **Plazo** — cuándo quieres alcanzar el objetivo. «6 semanas»,
   «Antes de fin de verano», «Para el tercer trimestre». Se usa
   para marcar el ritmo de las expectativas y fijar el objetivo
   de seguimiento de la racha.
4. **Minutos diarios** — cuánto tiempo puedes dedicar
   realísticamente. 15-45 minutos es el punto óptimo para el
   aprendizaje adaptativo; la aplicación no recompensa las
   sesiones maratonianas.

**Taxonomía de asignaturas** (opcional, desde v1.9.0) — un
sugeridor difuso relaciona tu tema con la taxonomía sembrada de
más de 80 nodos en Idiomas / Matemáticas / Programación /
Ciencias / Música / Humanidades / Ciencias Sociales / Habilidades.
Elegir una asignatura de Idiomas desbloquea la Práctica de
Pronunciación para el proyecto más adelante.

**Etiquetas** (opcional) — etiquetas de texto libre separadas por
comas («preparación-examen», «diario», «ritmo-propio») que
aparecen en la barra de filtros del Panel principal más adelante.

También puedes omitir el formulario por completo: se crea un
usuario predeterminado y aterrizas directamente en el Panel
principal.

También eliges un **idioma** para el proyecto. Este es el idioma
en que la IA responderá durante las sesiones; puede ser diferente
del idioma de la interfaz (podrías preferir la interfaz en tu
idioma nativo pero aprender español en español).

## Opcional: problema actual

Un campo de «problema actual» te permite traer una pregunta
abierta al proyecto de inmediato. Si lo rellenas, la primera
sesión comienza con este obstáculo concreto en lugar de un
prompt abierto de «¿en qué quieres trabajar?».

## Qué ocurre a continuación

Cuando envías el formulario, tres cosas ocurren en un solo viaje
de ida y vuelta:

1. Se crea un registro `User` (o se reutiliza: tu navegador local
   mantiene el mismo usuario entre sesiones).
2. Una fila `LearningProject` recibe tu tema / objetivo / plazo /
   minutos-diarios / idioma.
3. La ruta de Evaluación se abre automáticamente. Puedes omitirla
   desde aquí, pero entonces la aplicación usará el método de
   aprendizaje «deductivo» por defecto hasta que la realices.

## Editar tu proyecto

Los detalles del proyecto no son inamovibles. La página del Plan
de estudios te permite ajustar el tema y el objetivo a medida que
descubres qué quieres aprender realmente. La página de Ajustes
gestiona los cambios de idioma.

## Qué no se almacena

- **Sin correo electrónico**, sin contraseña, sin cuenta.
- **Sin análisis**, sin rastreadores de terceros.
- **Sin telemetría** enviada fuera de tu dispositivo en el modo Local.

Tu proveedor de IA ve tus mensajes (ese es el punto de pedirle
a la IA). Adaptive Learner en sí mismo solo almacena lo que
escribes, de forma local o en el backend FastAPI, según el
[modo de almacenamiento](settings.md#storage-mode) que hayas
elegido.
