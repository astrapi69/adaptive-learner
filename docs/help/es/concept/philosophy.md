# Filosofía

Adaptive Learner implementa el modelo de aprendizaje de seis métodos
descrito por Asterios Raptis en la serie «Von Theorie zur Praxis»
(Medium, 2024). Esta página explica el *por qué* de las decisiones
de diseño.

---

## El problema con las herramientas de aprendizaje habituales

La mayoría de las herramientas de IA para el aprendizaje hacen una
sola cosa: responder preguntas. Son buenas en ello. Pero responder
preguntas no es lo mismo que aprender.

El aprendizaje requiere:

1. Recibir información nueva (**entrada**).
2. Intentar aplicarla (**intento**).
3. Cometer errores y verlos (**error**).
4. Recibir retroalimentación explicativa (**retroalimentación**).
5. Ajustar el enfoque (**adaptación**).
6. Practicar con variaciones (**repetición**).
7. Conectar con lo que ya sabes (**integración**).

Un chatbot salta al paso 4 directamente. Adaptive Learner recorre
todos los pasos.

---

## Los seis métodos

No todos aprendemos igual. La investigación educativa distingue al
menos seis estilos cognitivos fundamentales:

| Método | Enfoque |
|--------|---------|
| **Deductivo** | Regla primero, luego aplicación |
| **Inductivo** | Ejemplos primero, luego regla |
| **Basado en errores** | Error primero, luego comprensión |
| **Dialógico** | Aprendizaje mediante conversación |
| **Contextual** | Situaciones reales simuladas |
| **Adaptativo con IA** | El sistema elige según tu perfil |

La clave: no es «¿qué tipo de aprendiz eres?», sino «¿qué método
funciona *mejor* para *este* material *ahora mismo*?». El perfil de
aprendizaje captura tus pesos relativos; el sistema ajusta
continuamente.

---

## Los siete pasos como ciclo

El ciclo de siete pasos no es una lista de tareas. Es un bucle:
después del paso 7 (integración), el siguiente ciclo comienza con
un material nuevo ligeramente más difícil. La IA recuerda dónde
te equivocaste, qué conceptos conceptuales erróneos estuvieron
presentes, qué método te llevó al éxito más rápido.

El dual-prompt evaluator (el segundo agente de IA que corre en
paralelo) mide tu comprensión después de cada respuesta y decide
cuándo estás listo para el siguiente paso. No avanzas por el tiempo
transcurrido sino por lo que realmente has comprendido.

---

## Git para el aprendizaje

Internamente, el progreso se almacena como «commits de progreso»,
un término tomado del control de versiones. Igual que `git commit`
toma una instantánea del código, un commit de progreso toma una
instantánea del estado de aprendizaje: comprensión, estrés,
adecuación del método, paso del ciclo.

Esto permite:

- **Historial auditable** — puedes ver exactamente cómo evolucionó
  tu comprensión sesión a sesión.
- **Análisis de regresión** — si tu comprensión baja después de un
  descanso, el sistema lo detecta y ajusta el ritmo.
- **Exportaciones reproducibles** — el repositorio de aprendizaje
  (plugin opcional) convierte el historial de commits en archivos
  Markdown que puedes versionar con Git de verdad.

---

## Tres pilares

El diseño descansa sobre tres pilares técnicos:

1. **Repetición espaciada** — la ciencia detrás del recuerdo a largo
   plazo. Las tarjetas se programan en seis bandas (+1d, +3d, +7d,
   +14d, +30d) según el rendimiento.

2. **Recuperación activa** — forzarte a recordar activamente (en
   lugar de releer pasivamente) consolida el conocimiento.
   El evaluador del paso 2 (intento) lo mide.

3. **IA adaptativa** — la IA no solo responde sino que también
   evalúa, diagnostica y adapta. El sistema de doble prompt es lo
   que distingue a Adaptive Learner de un chatbot con buenas
   respuestas.

---

## Principios de diseño

- **Sin paywalls** — todos los plugins son MIT; la clave de la IA
  es tuya.
- **Primero sin conexión** — el modo Dexie funciona completamente
  en el navegador, sin servidor.
- **Sin gamificación coercitiva** — XP e insignias son un espejo
  del progreso, no un sistema de incentivos. Sin clasificaciones,
  sin presión social.
- **Sin caja negra** — el código es abierto; puedes auditar exactamente
  cómo se construyen los prompts, cómo se calcula el perfil y cómo
  funciona el evaluador.
