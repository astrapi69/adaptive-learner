# EXP-018: Übungsrichtung - Rezeptiv vs. Produktiv

**Kategorie:** Feature
**Phase:** 2
**Priorität:** Hoch
**Abhängig von:** EXP-001 (Matching/Picture-Choice), EXP-006 (Freitext/Word Tiles), EXP-013 (fehler-basierte adaptive Lektionen)
**Status:** Geplant (Implementierung als Phase 62 / v1.46.0)

> Hinweis zur Herkunft: Dieses Dokument fasst die Spezifikation der
> Phase 62 (v1.46.0) als Explorations-Planungsdokument zusammen. Die
> verbindliche Sub-Phasen-Aufteilung lebt in der Roadmap; hier steht
> das Konzept und die Stufen-Logik.

## Problem

Jede Übung prüft Wissen heute in **einer impliziten Richtung**. Eine
französische Vokabelkarte `{front: "Bonjour", back: "Guten Tag"}` zeigt
immer die französische Seite und erwartet die deutsche Antwort (oder
umgekehrt, je nach Übungstyp). Aber:

- **"Bonjour" = "Guten Tag" erkennen** (REZEPTIV) und
- **"Bonjour" produzieren, wenn "Guten Tag" gezeigt wird** (PRODUKTIV)

sind **fundamental verschiedene Lerndimensionen**. Wer eine Vokabel
erkennt, kann sie noch lange nicht aktiv produzieren. Das aktuelle
SRS behandelt beide als eine einzige Mastery, was die produktive
Schwäche der Lernenden unsichtbar macht.

## Kernkonzept

Die Richtung wird **explizit**: jede Übung trägt eine Richtung, das
SRS verfolgt Mastery **pro Richtung**, und der adaptive Generator
berücksichtigt die Richtung beim Lektionsbau.

- `source_to_target`: Lernende sehen die Quellsprache (DE) und müssen
  die Zielsprache (FR) produzieren = **PRODUKTIV** (schwerer).
- `target_to_source`: Lernende sehen die Zielsprache (FR) und müssen
  die Quellsprache (DE) erkennen = **REZEPTIV** (leichter).

Quell- und Zielsprache stammen aus `source_language` +
`target_language` des Content-Sets (eingeführt in v1.44.0 / EXP-004).

### Grundregeln

- Richtung ist **optional** im Schema. Default: `target_to_source`
  (rezeptiv, leichter, rückwärtskompatibel).
- SRS verfolgt Mastery **pro Richtung**. Eine rezeptiv gemeisterte
  Karte ist NICHT produktiv gemeistert.
- "Vollständig gemeistert" verlangt **beide** Richtungen. Badges und
  Statistiken spiegeln das wider.
- Produktive Übungen sind inhärent **schwerer**: langsamere
  SRS-Intervalle, höhere erwartete Fehlerraten (nicht stärker
  bestraft), produktiv erst nach solider Rezeption.
- Cloze-Übungen sind in-context und überspringen den
  Richtungs-Flip.

## Stufen

### Stufe 1 - Fundament: Schema + richtungsbewusstes SRS

Das Datenmodell lernt die Richtung kennen, bevor die UI sie nutzt.

- Optionales Feld `direction` auf der Exercise
  (`source_to_target` | `target_to_source` | `both` | `random`),
  Default `target_to_source`. Schema bleibt 1.2 (additiv).
- `ElementError` bekommt eine `direction`-Spalte; die Composite-
  Uniqueness wird zu
  `(user_id, set_id, lesson_id, exercise_id, element_key, direction)`.
  Eine Karte hat damit bis zu zwei Fehler-Zeilen, je mit eigenem
  `error_count` / `correct_streak` / `mastered` / `mastered_at`.
- Alembic-Migration + Dexie-Schema-Bump; Backfill setzt bestehende
  Zeilen auf `target_to_source` (alle waren rezeptiv).
- `isFullyMastered(elementErrors)` prüft beide Richtungen.

### Stufe 2 - Renderer: richtungsbewusste Kartenanzeige

Alle fünf Renderer drehen Vorder-/Rückseite je nach Richtung über
**eine** gemeinsame Hilfsfunktion
`resolveCardDisplay(card, direction) -> {prompt, answer, promptLang, answerLang}`.

- Matching, Picture-Choice, Freitext, Word Tiles drehen Anzeige +
  Bewertung passend zur Richtung.
- Word Tiles produktiv ist der primäre Lernwert (Satz in der
  Zielsprache zusammensetzen).
- Cloze überspringt den Flip (in-context).
- Anweisungstexte pro Richtung + Typ als i18n-Keys in 8 Sprachen
  (`exercise.instruction.<type>.<receptive|productive>`).

### Stufe 3 - Scheduling + Adaption: Queue und Generator

- Die Review-Queue liefert die Richtung pro Item; dasselbe Element
  kann zweimal erscheinen (je Richtung). Produktive Fehler werden
  1,2x höher gewichtet. Rezeptiv gemeisterte, aber produktiv offene
  Elemente erscheinen nur produktiv.
- Der adaptive Generator (v1.36.0) bekommt eine
  `direction_strategy` (`auto` | `receptive_first` | `productive_focus`
  | `balanced`). Auto verschiebt den Mix mit wachsender Rezeptions-
  Mastery (< 50 % -> 80/20 rezeptiv; 50-80 % -> 50/50; > 80 % ->
  20/80 produktiv). Pro Element: nicht rezeptiv gemeistert -> rezeptiv
  zuerst; rezeptiv aber nicht produktiv -> produktiv; beides -> selten.

### Stufe 4 - Inhalt, UI, Statistik, Doku

- Pilot-Lektionen (FR A1 + ES A1, de- und en-Quelle) bekommen eine
  progressive Richtung: Lektion 1-5 rezeptiv, 6-8 gemischt, 9-10
  überwiegend produktiv. Spiegelung ins Content-Repo.
- Subtiler Richtungs-Indikator im Lesson-Viewer (Auge = erkennen,
  Stift = produzieren) mit Tooltip - kein Banner.
- Statistiken zeigen immer den rezeptiv/produktiv-Split
  ("Rezeptiv: 247 | Produktiv: 89"); Focus-Areas und Badges
  ebenfalls (Badges verlangen beide Richtungen).
- Einstellung "Bevorzugte Übungsrichtung" (Automatisch / Erkennen
  zuerst / Produzieren / Ausgeglichen, Default Automatisch) speist
  `direction_strategy`.
- Doku: Benutzerhandbuch, Konzept/Philosophie, Entwickler,
  Authoring-Guide, Hilfe-Glossar ("Übungsrichtung").

## Erwartetes Ergebnis

Lernende sehen erstmals, dass Erkennen und Produzieren getrennte
Fähigkeiten sind, und das System führt sie automatisch von der
Rezeption zur Produktion - der pädagogisch korrekten Reihenfolge.
