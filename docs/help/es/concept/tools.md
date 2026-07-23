# Herramientas: los tres pilares

Adaptive Learner no intenta ser tu única herramienta de aprendizaje.
Intenta ser el orquestador que te señala la herramienta externa
adecuada para lo que estás haciendo ahora mismo. El catálogo incluye
cinco herramientas, mapeadas en tres pilares.

## Los tres pilares

### 1. Repetición espaciada

La ciencia cognitiva lo tiene claro: el repaso espaciado supera al
repaso masivo para la retención a largo plazo. El intervalo entre
repasos importa; herramientas como Anki convierten esto en una
disciplina.

**Herramienta recomendada**: [Anki](https://apps.ankiweb.net/).
Gratuito en escritorio, de pago en iOS, el algoritmo de
programación está bien calibrado y es el estándar de facto. La
mayoría de las otras aplicaciones en este espacio copian los
intervalos de Anki.

**Úsalo para**: todo lo que deba recordarse a largo plazo.
Vocabulario, fórmulas, entidades con nombre, recetas de corrección
de errores. Las sesiones de Adaptive Learner son excelentes para
la comprensión; Anki es excelente para no olvidar.

Los pesos del perfil de Adaptive Learner apuntan «deductivo» y
«error_based» con más fuerza hacia Anki, ya que ambos métodos
producen material que vale la pena convertir en tarjetas.

### 2. Recuperación activa de tus propias fuentes

El segundo pilar es construir conocimiento a partir de documentos
que tú aportas. Las herramientas modernas te permiten subir PDF,
notas y transcripciones, y luego hacerte preguntas o preguntarle
a la IA sobre ese corpus específico.

**Herramienta recomendada**: [NotebookLM](https://notebooklm.google.com/).
La herramienta de Google que convierte tus fuentes en un gráfico
de conocimiento interactivo. Mejor que ChatGPT para este propósito
porque las respuestas de la IA están ancladas en los documentos
que proporcionas.

**También útil**:
[Excalidraw](https://excalidraw.com/) para esbozar la estructura
de tu conocimiento,
[Obsidian](https://obsidian.md/) para gráficos de conocimiento
en notas enlazadas que crecen a lo largo de meses.

**Úsalo para**: aprendizaje específico de un dominio donde tienes
material existente (artículos de investigación, documentos
internos, diapositivas del curso) y quieres extraer la estructura
del conocimiento.

### 3. Prompts de IA adaptativa

El tercer pilar es el acceso directo a la IA para preguntas
puntuales que no encajan en los otros dos pilares. A veces solo
necesitas una explicación. A veces quieres hacer una lluvia de
ideas.

**Herramienta recomendada**:
[Claude](https://claude.ai/),
[ChatGPT](https://chat.openai.com/) o
[Gemini](https://gemini.google.com/). Adaptive Learner usa las
mismas APIs internamente; también puedes hablar con ellas
directamente en sus interfaces web para una exploración menos
estructurada.

**Úsalo para**: preguntas abiertas, lluvia de ideas, «explícame
este párrafo», «dame tres enfoques diferentes de este problema».
El chat no estructurado brilla para el pensamiento divergente;
las sesiones de Adaptive Learner brillan para la práctica
convergente y enfocada.

## Cómo Adaptive Learner clasifica las herramientas

La tarjeta de Recomendaciones de herramientas del Panel principal
ejecuta una puntuación simple:

```
score(herramienta) = sum(profile_weight[k] for k in herramienta.weight_keys)
```

Cada herramienta declara cuáles 1-2 ejes de métodos sirve mejor:

| Herramienta | Claves de peso | Por qué |
|-------------|----------------|---------|
| Anki | deductive, error_based | Las tarjetas codifican reglas + correcciones |
| NotebookLM | inductive, contextual | Ejemplos + material situado |
| Prompt de IA adaptativa | ai_adaptive, dialogic | Conversación adaptativa |
| Excalidraw | contextual, inductive | Estructura visual a partir de ejemplos |
| Obsidian | deductive, inductive | Teoría + ejemplos en un solo gráfico |

Los pesos del perfil de tu evaluación se suman para las claves
de peso de cada herramienta, y la lista clasificada es lo que
muestra el Panel principal. La clasificación se actualiza cada
vez que cambia tu perfil (al repetir la evaluación).

## Recomendaciones espaciadas

Una segunda superficie de seguimiento en el Panel principal: la
tarjeta **Espaciado**. Esto NO son recomendaciones de herramientas;
son recomendaciones de acción. El sistema registra cuánto tiempo
ha pasado desde tu última sesión en cada método y luego sugiere:

| Tiempo desde el último commit | Tipo de tarjeta | Intervalo |
|-------------------------------|-----------------|-----------|
| Nunca | primera vez | 1 día |
| > 14 días | refrescar | 1 día |
| 7-14 días | repasar | 3 días |
| 3-7 días | practicar | 7 días |
| < 3 días | mantener | 14 días |

Un método que no has tocado en dos semanas obtiene una tarjeta
«Refrescar en 1 día». Un método que usaste ayer obtiene
«Mantener en 14 días» (o no aparece porque la lista está limitada
a 5).

Las tarjetas se ordenan por urgencia (intervalo menor × peso mayor
= mayor prioridad). No tienes que seguirlas: son sugerencias, no
órdenes.

## Integraciones de primera clase incluidas

Tres herramientas se incluyen como exportación integrada en lugar
de recomendación externa:

- **Exportación Anki .apkg** — revisa las
  tarjetas de memoria extraídas por la IA en la página `/anki`,
  acepta las que quieras y haz clic en Exportar. El `.apkg` se
  construye en el cliente mediante sql.js + JSZip y funciona
  directamente en Anki de escritorio. Sin transferencia manual.
- **Paquete ZIP de NotebookLM** — página de
  Progreso → Descargar paquete de estudio. El ZIP contiene
  `summary.md`, `vocabulary.md`, `rules.md`, `errors.md`,
  `flashcards.md` y `sessions/*.md` formateados para la carga
  de fuentes de NotebookLM. NotebookLM no tiene API pública, así
  que este es el mejor camino alternativo.
- **Voz (TTS + STT + Práctica de pronunciación)** —
  integraciones de la Web Speech API directamente en
  la Sesión y la Evaluación, y una página dedicada `/pronunciation`
  para proyectos de idiomas. No se necesita herramienta externa.

## Qué NO está en el catálogo

Excluido deliberadamente:

- **Duolingo / Babbel / aplicaciones gamificadas similares** —
  conflictan con la filosofía. Adaptive Learner sí incluye XP +
  insignias + rachas, pero como una capa motivacional
  sobre contenido no gamificado, no como el bucle principal.
- **Khan Academy / Coursera** — están orientadas a la finalización
  de cursos, no a la adquisición de habilidades. Espacio de
  problema diferente.
- **Memrise** — demasiado similar a Anki; el catálogo mantiene
  una herramienta por nicho.
- **Notion** — exagerado para el nicho de «notas enlazadas»;
  Obsidian encaja perfectamente sin dependencia de la nube.

El catálogo es pequeño a propósito. Agregar más diluiría la señal.
