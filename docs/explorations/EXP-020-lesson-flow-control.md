# EXP-020: Lektions-Flusssteuerung (Prüfen/Weiter + Schrittsicherung)

**Kategorie:** Feature
**Phase:** 2
**Priorität:** Hoch
**Abhängig von:** EXP-001 (Matching/Picture-Choice), EXP-003 (Lektionsformat), EXP-006 (Freitext/Word Tiles)
**Status:** Geplant (Umsetzung als Phase 63)

> Hinweis zur Herkunft: Dieses Dokument fasst die Spezifikation der
> Phase 63 (Lesson Flow Control) als Explorations-Planungsdokument
> zusammen. Die verbindliche Sub-Phasen-Aufteilung lebt in der
> Roadmap; hier stehen Problem, Konzept und Stufen-Logik.

## Problem

Der Lektions-Viewer führt die Lernenden Schritt für Schritt durch
Theorie- und Übungsschritte. Zwei Schwächen im Ablauf untergraben den
Lernwert:

1. **Der Weiter-Button ist immer aktiv.** Er steht unabhängig davon
   bereit, ob die Übung beantwortet wurde. Lernende können eine Übung
   überspringen, ohne sie zu lösen - der pädagogische Kern (erst
   antworten, dann Feedback) wird umgangen, und das Fehler-Tracking
   (EXP-007) sieht die übersprungene Übung nie.

2. **Der Übungszustand geht beim Zurück-Navigieren verloren.** Wer
   Übung 3 von 8 löst, auf Weiter klickt und dann zurückblättert
   (Vorheriger-Button oder Browser-Zurück), bekommt eine frische,
   leere Übung statt seines Ergebnisses. Die Arbeit ist scheinbar weg
   und muss wiederholt werden.

Beide Schwächen sind besonders auf dem Mobilgerät spürbar, dem
primären Nutzungskontext einer Lern-App.

## Kernkonzept

Ein einziger, **zweiphasiger Button** steuert jeden Übungsschritt, und
jeder geprüfte Schritt wird **persistiert und beim Wiederbesuch
gesperrt** angezeigt. Das ist das Standardmuster großer Lern-Apps
(Duolingo, Babbel, Busuu).

- **Phase 1 (unbeantwortet):** Der Button heißt *Prüfen* und ist
  **deaktiviert**, bis die Übung eine prüfbare Antwort trägt.
- **Klick auf Prüfen:** Die Antwort wird bewertet, das Feedback
  (richtig/falsch, Token-Diff, Lob) erscheint.
- **Phase 2 (geprüft):** Der Button wird zu *Weiter* und navigiert zum
  nächsten Schritt.

Theorieschritte behalten den schlichten, immer aktiven *Weiter*-Button -
die Zweiphasen-Logik gilt nur für Übungsschritte.

### Grundregeln

- Die fünf Übungs-Renderer (Matching, Picture-Choice, Freitext, Word
  Tiles, Cloze) melden über **ein** gemeinsames Signal, ob die Antwort
  prüfbar ist (mind. ein Paar / eine Auswahl / nicht-leerer Text / alle
  Kacheln gesetzt / alle Lücken gefüllt). Erst dann wird *Prüfen*
  aktiv.
- Die Auswertung läuft weiterhin im Renderer (Scoring, Token-Diff,
  Element-Attempts für das SRS aus EXP-007); der Button löst sie nur
  zentral aus.
- Das Verhalten ist **additiv und opt-in**: Review- und Adaptive-
  Lesson-Ansichten dürfen die alte, selbstständige Renderer-Logik
  (eigener Prüfen-Button pro Übung) behalten. Nur der Lektions-Viewer
  hebt die Steuerung auf die geteilte Schaltfläche.
- Ein abgeschlossener Schritt ist **gesperrt**: beim Wiederbesuch wird
  das Ergebnis gezeigt, nicht eine neu beantwortbare Übung. Ausnahme
  ist *Lektion wiederholen*, das den gesamten Fortschritt zurücksetzt.

## Stufen

### Stufe 1 - Zweiphasiger Button + Interaktionssignal

Die Ablaufsteuerung wandert vom Renderer in den Viewer, ohne die
anderen Ansichten zu brechen.

- Pro Übungsschritt eine kleine Zustandsmaschine im Viewer:
  *unbeantwortet -> beantwortbar -> geprüft*. *Prüfen* ist deaktiviert,
  solange nicht beantwortbar; nach der Auswertung wird der Button zu
  *Weiter*.
- Jeder Renderer bekommt einen optionalen, gesteuerten Modus: er
  blendet den eigenen Prüfen-/Wiederholen-Button aus, meldet die
  Beantwortbarkeit über einen `onInteraction`-Rückruf und stellt das
  Auslösen der Auswertung über einen imperativen Griff (Ref) bereit.
- Beim Schrittwechsel wird die Zustandsmaschine zurückgesetzt, **bevor**
  der neue Renderer sein erstes Interaktionssignal sendet (Render-
  Phasen-Reset statt Effekt, sonst überschreibt die Eltern-Reihenfolge
  das erste Signal).
- Deaktivierter *Prüfen*-Button trägt einen Hinweis ("Beantworte die
  Aufgabe zuerst"); neue i18n-Keys (`lesson.button.check` /
  `lesson.button.next` / `lesson.button.check_disabled_hint`) in allen
  acht Katalogen.

### Stufe 2 - Persistenz + gesperrte Wiederbesuch-Ansicht

Der Schrittzustand überlebt die Navigation.

- Beim Klick auf *Prüfen* wird das Ergebnis sofort persistiert: zum
  bereits gespeicherten Score (`LessonProgress.step_results`) kommt die
  **rohe Antwort** des Lernenden (typdiskriminiert pro Übungstyp).
  Additiv in beiden Speichermodi (Dexie-IndexedDB + Backend-JSON) -
  kein Schema-Bruch.
- Wird ein bereits abgeschlossener Schritt betreten, rendert der Viewer
  ihn **gesperrt**: die Übung wird aus der gespeicherten Rohantwort exakt
  rekonstruiert (gesetzte Felder gesperrt, richtig grün / falsch rot mit
  Diff), nicht erneut beantwortbar; der Button zeigt direkt *Weiter*.
- Schritte, die vor diesem Feature abgeschlossen wurden (ohne
  Rohantwort), bekommen eine kompakte "Abgeschlossen"-Tafel mit dem
  gespeicherten Score als Rückfall-Ansicht.

## Erwartetes Ergebnis

Die Lernenden müssen jede Übung beantworten, bevor sie weitergehen
(kein stilles Überspringen mehr), bekommen ein klares Prüfen -> Feedback
-> Weiter, und verlieren beim Zurückblättern nie ihre Arbeit. Der
Lektionsfluss fühlt sich endlich wie eine ernsthafte Lern-App an, und
das Fehler-Tracking (EXP-007) sieht jede tatsächlich gelöste Übung.
