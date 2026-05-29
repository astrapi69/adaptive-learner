# Belohnungs-Schicht

Die Belohnungs-Schicht (EXP-008, Phase 55) ergänzt das
emotionale Feedback über dem bestehenden mechanischen Tracking.
Sie ist rein im Frontend und funktioniert in beiden
Speicher-Modi.

## Bausteine

| Modul | Aufgabe |
|---|---|
| `lib/praise/phrase-picker.ts` | Wiederholungsfreies Durchlaufen der Lob-Phrasen, liest `data/praise/{lang}.json` (gebündelt aus `backend/config/praise/*.yaml` via `make sync-praise`). |
| `lib/feedback/feedbackPref.ts` | Intensität (`subtle`/`normal`/`enthusiastic`) + Ton-Einstellungen in localStorage; Reduced-Motion-Override; Gating + Frequenz-Helfer pro Stufe. |
| `hooks/useFeedbackIntensity.ts` | Live-Effektiv-Intensität (liest neu bei Pref- und Reduced-Motion-Änderung). |
| `lib/feedback/milestones.ts` | Reine Schwellenwert-Erkennung (Serie/Mastery/Level). |
| `lib/feedback/celebrationQueue.ts` | Modul-globaler FIFO mit ID-Deduplizierung; ein Listener (der Host). |
| `lib/praise/celebration-bus.ts` | `emitCelebration` (spielt den zugeordneten Ton + benachrichtigt Abonnenten) und die `celebrate*`-Meilenstein-Helfer. |
| `lib/feedback/celebration-stats.ts` | Erfasst den Gamification-Stand + steuert die Meilenstein/Abzeichen-Belohnung beim Abschluss. |
| `lib/audio/sound-effects.ts` | Zur Laufzeit synthetisierte Töne (keine Audio-Dateien). |
| `components/exercises/AnswerCelebration.tsx` | Haptik + Lob + Bus-Emit pro Antwort. |
| `components/feedback/Confetti.tsx` | Reiner CSS-Konfetti-Regen. |
| `components/feedback/MilestoneHost.tsx` + `MilestoneOverlay.tsx` | Leert die Queue, zeigt eine Einblendung nach der anderen. |

## Ablauf

1. Eine Übung rendert `<AnswerCelebration isCorrect>`; sie löst
   Haptik aus, wählt eine Phrase (Intensität + Frequenz
   gefiltert) und emittiert `answer_correct`/`answer_wrong` auf
   dem Bus.
2. `emitCelebration` spielt den zugeordneten Ton (selbst-gefiltert
   über die Ton-Einstellung) und benachrichtigt Abonnenten.
3. Beim Lektionsabschluss erfasst die Seite den
   Gamification-Stand, führt die Belohnung aus, und
   `celebrateProgressSince` erkennt Meilensteine + Abzeichen und
   leitet sie über `celebrateMilestone`, das eine Einblendung in
   die Queue stellt und einen Ton emittiert. `MilestoneHost` zeigt
   die Einblendungen nacheinander.

## Regeln

- Alle Animationen sind CSS (transform + opacity); keine
  Animations-Bibliotheken. `prefers-reduced-motion` unterdrückt
  jede Animation und erzwingt die effektive Intensität `subtle`.
- Töne werden zur Laufzeit aus additiven Rezepten synthetisiert
  (`renderSamples` ist der reine, testbare Kern); der
  `AudioContext` wird beim ersten Abspielen innerhalb einer
  Nutzergeste verzögert erzeugt.
- Die Belohnungs-Schicht ist ergänzend: jeder Hinweis ist auch
  sichtbar. Ein Fehler darin darf den Lektions-Ablauf nie
  unterbrechen (die Stat-Lesezugriffe sind defensiv).
