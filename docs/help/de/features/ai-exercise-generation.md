# KI-Übungsgenerierung

Eine Lektion, die nur aus Theorie besteht (ohne Übungen), lässt
sich in eine übbare Lektion verwandeln, indem die KI aus ihren
Karten **Übungen generiert**. Das ist die EXP-036-Pipeline.
Sie braucht einen konfigurierten KI-Schlüssel
(Einstellungen → KI); ohne einen ist der Knopf sichtbar, aber
deaktiviert, mit dem Grund im Tooltip.

<!-- TODO: Screenshot — der „Übungen generieren"-Knopf an einer reinen Theorie-Lektion -->

---

## Die Pipeline

Die Generierung ist kein einzelner KI-Aufruf — sie ist eine
**Generieren → Qualitäts-Gate → Balancieren → Feedback**-Pipeline:

1. **Generieren.** Ein Generierungs-Prompt fordert vom Modell
   Übungen über die unterstützten Typen an; ein defensiver
   JSON-Parser verträgt die üblichen Formatierungs-Macken.
2. **Qualitäts-Gate.** Ein deterministisches Gate verwirft Übungen,
   die fehlerhaft, trivial oder Duplikate bestehender sind — bevor
   du sie überhaupt siehst.
3. **Balancieren.** Die erzeugten Übungen werden über die
   Übungstypen balanciert, damit eine Lektion nicht nur aus einer
   Form besteht.
4. **Regenerieren mit Feedback.** Stimmt das Ergebnis nicht,
   kannst du mit Feedback regenerieren und den nächsten Versuch
   steuern.

---

## Pro Lektion und pro Set

- **Einzelne Lektion:** ein **„Übungen generieren"**-Knopf
  erscheint an reinen Theorie-Lektionen.
- **Ganzes Set:** die Batch-Generierung füllt Übungen über jede
  reine Theorie-Lektion eines Sets in einem Durchlauf nach.

---

## Qualität und Vertrauen

Weil das Qualitäts-Gate deterministisch ist, erfüllen generierte
Übungen dieselbe Mindesthürde wie handgeschriebene (genug Übungen,
mehr als ein Typ, keine leeren Karten). Die Generierung ergänzt
handgeschriebene Inhalte — sie überschreibt deine bestehenden
Übungen nie stillschweigend.

Zum Prüfen *bestehender* Inhaltsqualität (handgeschrieben oder
generiert) siehe [KI-Inhaltsprüfung](../user-guide/ai-validation.md).

---

## Verwandte Seiten

- [KI-Inhaltsprüfung](../user-guide/ai-validation.md) — set-weite Qualitätschecks
- [Lektionen erstellen](../content-creation/overview.md) — Lektionen selbst bauen
- [Lektionen und Wiederholungen](../user-guide/lessons.md) — die Übungstypen
