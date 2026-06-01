# Capa de celebración

La capa de celebración (EXP-008, Fase 55) añade el feedback
emocional sobre el seguimiento mecánico existente. Es exclusiva del
frontend y funciona en ambos modos de almacenamiento.

## Componentes

| Módulo | Función |
|---|---|
| `lib/praise/phrase-picker.ts` | Ciclo de frases de elogio sin repetición, lee `data/praise/{lang}.json` (incluido en el bundle desde `backend/config/praise/*.yaml` mediante `make sync-praise`). |
| `lib/feedback/feedbackPref.ts` | Intensidad (`subtle`/`normal`/`enthusiastic`) + preferencias de sonido en localStorage; anulación por reduced-motion; restricción por nivel + helpers de frecuencia. |
| `hooks/useFeedbackIntensity.ts` | Intensidad efectiva en vivo (se recalcula al cambiar las preferencias + al cambiar reduced-motion). |
| `lib/feedback/milestones.ts` | Detección de umbrales pura (racha/maestría/nivel). |
| `lib/feedback/celebrationQueue.ts` | FIFO a nivel de módulo con deduplicación por id; un único listener (el host). |
| `lib/praise/celebration-bus.ts` | `emitCelebration` (reproduce el sonido mapeado + notifica a los suscriptores) y los helpers de hitos `celebrate*`. |
| `lib/feedback/celebration-stats.ts` | Toma una instantánea de la gamificación + gestiona la celebración de hitos/insignias al completar. |
| `lib/audio/sound-effects.ts` | Sonidos sintetizados en tiempo de ejecución (sin archivos de audio). |
| `components/exercises/AnswerCelebration.tsx` | Vibración háptica + elogio + emisión al bus por respuesta. |
| `components/feedback/Confetti.tsx` | Explosión de confeti solo con CSS. |
| `components/feedback/MilestoneHost.tsx` + `MilestoneOverlay.tsx` | Vacía la cola, muestra un overlay a la vez. |

## Flujo

1. Un ejercicio renderiza `<AnswerCelebration isCorrect>`; dispara una
   vibración háptica, elige una frase (limitada por intensidad y frecuencia) y
   emite `answer_correct`/`answer_wrong` en el bus.
2. `emitCelebration` reproduce el sonido mapeado (autolimitado por la
   preferencia de sonido) y notifica a los suscriptores.
3. Al completar la lección, la página toma una instantánea de la
   gamificación, ejecuta el premio y luego `celebrateProgressSince` detecta
   hitos + insignias y los enruta mediante `celebrateMilestone`, que
   encola un overlay y emite un sonido. `MilestoneHost` muestra
   los overlays de forma secuencial.

## Reglas

- Todas las animaciones son CSS (transform + opacity); no hay
  bibliotecas de animación. `prefers-reduced-motion` suprime todas las
  animaciones y fuerza la intensidad efectiva a `subtle`.
- Los sonidos se sintetizan en tiempo de ejecución a partir de recetas
  aditivas (`renderSamples` es el núcleo puro y verificable); el
  `AudioContext` se crea de forma lazy en el primer evento de reproducción
  dentro de un gesto del usuario.
- La capa de celebración es suplementaria: todas las señales también
  son visibles. Un fallo en ella nunca debe interrumpir el flujo de la
  lección (las lecturas de estadísticas son defensivas).
