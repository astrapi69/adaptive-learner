# Onboarding

El inicio es deliberadamente breve: el
**inicio rápido** solo requiere dos campos.

1. **Nombre** — cómo debe dirigirse la app a ti.
2. **Tema** — qué quieres aprender. "Gramática española",
   "Fundamentos de machine learning", "Improvisación de guitarra
   en solitario". Sé concreto; ese es el ancla de tu proyecto.

Todo lo demás (objetivo, plazo, minutos por día, idioma) toma
**valores predeterminados** razonables que puedes cambiar en
cualquier momento.

## Empezar directamente o configurar el perfil

Tras enviar, la app te ofrece dos vías:

- **Empezar directamente** — llegas de inmediato al Dashboard y
  puedes iniciar una lección o sesión.
- **Configurar el perfil** — abre el **asistente de onboarding**:
  una pregunta por pantalla (objetivo → plazo → minutos por día →
  problema actual → prueba de tipo de aprendizaje opcional), cada
  una con valor previo, de modo que "Siguiente" siempre funcione,
  además de barra de progreso y "Atrás". Las respuestas se guardan
  en ambos modos de almacenamiento.

La **prueba de tipo de aprendizaje ya no es obligatoria**; solo se
puede acceder a ella a través del último paso del asistente. Más
información en [Prueba de tipo de aprendizaje](assessment.md).

## Evaluación reanudable

Si interrumpes la prueba de tipo de aprendizaje a mitad, la app
recuerda el estado intermedio (pregunta actual, respuestas
anteriores, hora de inicio) por proyecto, de modo que **continúes
donde lo dejaste**. El Dashboard y los Ajustes te invitan
activamente a **continuar, crear o rehacer** el perfil de
aprendizaje. En cuanto el perfil está calculado, se descarta el
estado intermedio.

## Opcional: problema actual

En el paso "problema actual" puedes incorporar de inmediato una
pregunta abierta al proyecto. Si lo rellenas, la primera sesión de
IA arranca con ese obstáculo concreto en lugar de con una consigna
abierta de "¿en qué quieres trabajar?".

## Subjects y tags

Puedes asignar opcionalmente a tu proyecto un **Subject** (materia
del árbol de taxonomía precargado) y **tags** (etiquetas de texto
libre separadas por comas). Ambos aparecen más tarde en la barra
de filtros del Dashboard; el filtro de Subject solo enumera tus
propios Subjects, ordenados por uso más frecuente. Quien elija un
Subject de idiomas desbloquea el ejercicio de pronunciación.

## Editar el proyecto

Los detalles del proyecto no están escritos en piedra. En la
página de currículo puedes ajustar el tema y el objetivo en cuanto
descubras qué quieres aprender de verdad. El idioma lo cambias en
los Ajustes.

## Qué no se guarda

- **Sin correo electrónico**, sin contraseña, sin cuenta.
- **Sin analítica**, sin rastreadores de terceros.
- **Ninguna telemetría** abandona tu dispositivo en modo local.

Tu proveedor de IA ve tus mensajes (ese es justamente el sentido
de la consulta a la IA). Adaptive Learner mismo solo guarda lo que
escribes, localmente o en el backend de FastAPI, según el
[modo de almacenamiento](settings.md) configurado.
