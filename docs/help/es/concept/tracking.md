# Seguimiento: Git para el aprendizaje

La mayoría de las aplicaciones de aprendizaje registran «porcentaje
completado» o «días de racha». Estos números son fáciles de
calcular pero casi no te dicen nada sobre cómo estás aprendiendo
realmente. Adaptive Learner toma prestado el modelo mental de Git.

## La analogía con Git

| Git | Aprendizaje |
|-----|-------------|
| Commit | Instantánea de una sesión (método, calificaciones, duración) |
| Diff | Delta respecto a la sesión anterior en el mismo tema |
| Branch | Un cambio de método (deductivo → dialógico) |
| Log | El historial cronológico completo de commits |
| Blame | Qué sesión introdujo un patrón específico |
| Bisect | Encontrar la sesión en que la comprensión dejó de crecer |

No usamos Git literalmente. Usamos su disciplina de estado
versionado, recuperable y comparable. Las sesiones son duraderas:
no desaparecen cuando cierras la pestaña. Puedes mirar hacia atrás,
comparar y encontrar patrones.

## Qué se guarda en el commit

Cada sesión que termina con una calificación produce una fila
`ProgressCommit`:

| Columna | Qué captura |
|---------|-------------|
| method | Cuál de los seis métodos usó esta sesión |
| understanding | Tu calificación 1-5, reescalada a 0,0-1,0 |
| stress | Misma reescala |
| error_rate | 0,0-1,0 (actualmente siempre 0,0; reservado para una futura fracción de error por paso) |
| duration_minutes | Tiempo transcurrido entre started_at y ended_at |
| committed_at | Cuándo se escribió el commit |
| project_id | A qué proyecto de aprendizaje pertenece |
| session_id | A qué sesión pertenece |

Eso es todo. Siete campos, sin NULLs (los valores de calificación
son obligatorios para terminar). Unos pocos bytes por sesión.

## Qué puedes hacer con esto

### Líneas de tendencia

La Línea de tiempo de progreso del Panel principal muestra tus
últimas 5 calificaciones de comprensión + estrés. Cinco puntos
son suficientes para detectar la dirección:

- Ambas subiendo: progreso + confianza en alza. Sigue adelante.
- Comprensión subiendo, estrés subiendo: estás estirándote. Esto
  es bueno pero solo sostenible hasta cierto punto.
- Comprensión plana, estrés subiendo: estancamiento. El heurístico
  de cambio de método se activa aquí.
- Comprensión bajando: algo cambió. ¿El tema se volvió más difícil?
  ¿El método dejó de adaptarse? Es hora de revisar el historial.

### Distribución de métodos

¿Qué métodos has usado realmente? Muchos aprendices descubren que
se quedan en un método (a menudo el deductivo) y nunca prueban
los demás. El gráfico de barras del Panel principal es un espejo,
no una competición.

### Racha

Días de calendario consecutivos con al menos una sesión. Se
reinicia en el momento en que pasa un día sin sesión. Esta es la
única métrica de «gamificación» en Adaptive Learner, y es
deliberadamente discreta. El otro lado del gráfico es más
importante.

### Agregados de evaluación de pasos

El evaluador de doble prompt escribe una fila `StepEvaluation`
por cada turno de la IA. El agregador de seguimiento los convierte
en:

- **Confianza media** — qué segura está la IA en promedio de que
  estás listo para avanzar. Bajo (< 0,5) significa que el material
  es genuinamente difícil para ti. Es información, no un veredicto.
- **Recuento de repeticiones** — con qué frecuencia dijo el
  evaluador «quédate aquí». Las fases de mucha repetición son
  normales para temas densos.
- **Tiempo por paso** — total de segundos reales que has pasado en
  cada paso a lo largo del proyecto (limitado para excluir huecos
  de > 2 h). El paso con más tiempo es donde ocurre el trabajo
  cognitivo para ti.

La página de Progreso muestra todo esto como gráficos de barras.

## Qué no registramos

Deliberadamente:

- **Sin métricas de participación** — sin culpa de «minutos al día»,
  sin notificaciones, sin recordatorios diarios. Adaptive Learner
  no lucha por tu atención.
- **Sin comparación con otros usuarios** — estás solo con tus datos
  (modo Local) o solo con el backend (modo Servidor). Sin
  clasificaciones, sin comparación entre pares.
- **Sin «lecciones completadas»** — no hay un plan de estudios fijo
  que completar. Tú fijas tu propio tema.
- **Sin «porcentaje de dominio»** — ¿qué significaría el 100% para
  un tema de aprendizaje? El dominio es una postura, no una línea
  de llegada.

## Capa de gamificación (v1.16.0)

Sobre el sustrato de ProgressCommit-como-Git se añaden tres capas
motivacionales:

- **XP + Niveles** — 50 XP base por sesión terminada, más +10 por
  ciclo completado, +25 por ciclo-paso-7, +50 de bonificación por
  primer método, todo multiplicado por el multiplicador de racha
  (hasta 2,75× a los 7 días de racha). Los niveles siguen
  `threshold(n) = 50 * n * (n - 1)`; los niveles 1-5 están a
  0 / 100 / 300 / 600 / 1000 XP.
- **24 insignias** en 5 categorías (getting_started 3 /
  consistency 4 / method_explorer 7 / depth 7 / polyglot 3),
  sembradas desde `badges.yaml` al primer inicio. Los predicados
  se evalúan después de cada sesión.
- **Mapa de calor de racha** — 365 días, estilo GitHub, columnas
  semanales. Congelaciones: 1 por cada 7 días de racha, máximo 3
  acumuladas, semántica de pausa-no-reinicio. Alternancia de modo
  fin de semana que omite los huecos de sáb./dom.

La gamificación es **opcional**. Desactivar las notificaciones de
toast en Ajustes → Gamificación silencia los prompts; el sistema
sigue registrando el estado. Las perspectivas de evaluación de
pasos + el historial de commits al estilo Git siguen siendo el
análisis de carga.

## Privacidad

En modo Local los datos están en IndexedDB en tu dispositivo.
Léelos mediante las DevTools del navegador o expórtalos para hacer
una copia de seguridad. Nadie más puede verlos a menos que tenga
acceso a este perfil del navegador.

En modo Servidor los datos están en SQLite en el host del backend.
Salvo las claves API cifradas, ninguno de los datos de las filas es
sensible en el sentido habitual: son solo nombres de métodos,
calificaciones enteras y marcas de tiempo. Pero son *tuyos*.
Adaptive Learner no los envía a ningún servicio externo de análisis
o telemetría.

## Por qué esto importa para el aprendizaje

Los contadores de racha en la mayoría de las aplicaciones son
adictivos pero superficiales. Una racha de 90 días en Duolingo
no te dice nada sobre *qué* aprendiste. El modelo Git te da
patrones:

- «Cambié de deductivo a dialógico el 10 de mayo y mi línea de
  comprensión subió ese día.»
- «Pasé el 40% de mi tiempo en el paso 3 (Error). El tema tiene
  más trampas de las que esperaba.»
- «No he hecho una sesión contextual en tres semanas; la tarjeta
  de recomendación espaciada tiene razón al sugerirlo.»

Estas son las preguntas que se hace un aprendiz serio. Adaptive
Learner te da el sustrato para hacerlas; la capa de gamificación
de v1.16.0 es el azúcar encima, desactivada por defecto en espíritu.
