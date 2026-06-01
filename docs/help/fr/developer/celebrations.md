# Couche de célébration

La couche de célébration (EXP-008, Phase 55) ajoute le retour
émotionnel par-dessus le suivi mécanique existant. Elle est
entièrement côté frontend et fonctionne dans les deux modes
de stockage.

## Composants

| Module | Rôle |
|---|---|
| `lib/praise/phrase-picker.ts` | Cycle de phrases de félicitations sans répétition, lit `data/praise/{lang}.json` (bundlé depuis `backend/config/praise/*.yaml` via `make sync-praise`). |
| `lib/feedback/feedbackPref.ts` | Intensité (`subtle`/`normal`/`enthusiastic`) + préférences sonores en localStorage ; override reduced-motion ; filtrage par niveau + helpers de fréquence. |
| `hooks/useFeedbackIntensity.ts` | Intensité effective en direct (relit lors d'un changement de préférence ou de reduced-motion). |
| `lib/feedback/milestones.ts` | Détection pure de seuils (série/maîtrise/niveau). |
| `lib/feedback/celebrationQueue.ts` | FIFO au niveau module avec déduplication par id ; un seul écouteur (le host). |
| `lib/praise/celebration-bus.ts` | `emitCelebration` (joue le son mappé + notifie les abonnés) et les helpers `celebrate*` pour les jalons. |
| `lib/feedback/celebration-stats.ts` | Capture un instantané de la gamification + déclenche la célébration des jalons/badges à la complétion. |
| `lib/audio/sound-effects.ts` | Sons synthétisés à l'exécution (aucun fichier audio). |
| `components/exercises/AnswerCelebration.tsx` | Retour haptique + phrase + émission sur le bus par réponse. |
| `components/feedback/Confetti.tsx` | Burst de confettis en CSS pur. |
| `components/feedback/MilestoneHost.tsx` + `MilestoneOverlay.tsx` | Vide la file, affiche une overlay à la fois. |

## Flux

1. Un exercice rend `<AnswerCelebration isCorrect>` ; il déclenche
   une vibration haptique, choisit une phrase (filtrée par intensité
   + fréquence) et émet `answer_correct`/`answer_wrong` sur le bus.
2. `emitCelebration` joue le son mappé (s'auto-filtre selon la
   préférence sonore) et notifie les abonnés.
3. À la complétion de la leçon, la page capture un instantané de
   la gamification, exécute l'attribution, puis
   `celebrateProgressSince` détecte les jalons + badges et les
   route via `celebrateMilestone`, qui met une overlay en file
   et émet un son. `MilestoneHost` affiche les overlays
   séquentiellement.

## Règles

- Toutes les animations sont en CSS (transform + opacity) ; aucune
  bibliothèque d'animation. `prefers-reduced-motion` supprime
  chaque animation et force l'intensité effective à `subtle`.
- Les sons sont synthétisés à l'exécution à partir de recettes
  additives (`renderSamples` est le cœur pur et testable) ;
  l'`AudioContext` est créé paresseusement au premier play dans
  un geste utilisateur.
- La couche de célébration est supplémentaire : chaque signal est
  également visible. Un échec en son sein ne doit jamais
  interrompre le flux de la leçon (les lectures de stats sont
  défensives).
