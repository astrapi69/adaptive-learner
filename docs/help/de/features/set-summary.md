# Set-Abschluss-Übersicht

Wenn früher jede Lektion eines Sets abgeschlossen war, endete das in
einer Trophäenkarte - "alle N Lektionen fertig" - und sonst nichts,
obwohl die App pro Aufgabe längst Fehleranzahl, Serie,
Beherrschungs-Flag und die eigene Falschantwort erfasst. Die
**Set-Abschluss-Übersicht** ist das fehlende Gesamtbild: jeder Fehler
des gerade abgeschlossenen Sets, an einem Ort.

Erreichbar über die **Nächster-Schritt**-Vorschläge am Ende der
letzten Lektion eines Sets, oder von der Set-Seite selbst.

---

## Was sie zeigt

- **Summen** - Fehler und Zeitaufwand über das ganze Set, nicht nur
  die zuletzt gespielte Lektion.
- **Nach Lektion** - welche Lektionen des Sets die meisten Fehler
  produziert haben.
- **Nach Aufgabentyp** - ob sich Fehler bei einem bestimmten Typ
  (Zuordnung, Lückentext, Freitext, ...) häufen.
- **Schwachstellen** - die einzelnen Elemente, bei denen es immer
  wieder hapert, jeweils mit deiner letzten Falschantwort neben der
  richtigen - so siehst du genau, was zu üben ist, nicht nur dass
  etwas zu üben ist.

---

## Wie es funktioniert

Die Seite ist rein lesend und Storage-unabhängig: sie liest dieselben
Zeilen, die deine Wiederholungs-Sitzungen ohnehin schreiben
(Fehleranzahlen, Beherrschungs-Flags) und führt sie durch einen
einzigen Aggregationsschritt - die Zahlen stimmen exakt mit dem
überein, was SRS-Wiederholung und Lernpfad bereits erfassen, keine
separate Buchführung, die auseinanderlaufen könnte.

---

## Verwandte Seiten

- [Lektionen und Wiederholungen](../user-guide/lessons.md) - woher die zugrunde liegenden Fehler- und Beherrschungsdaten stammen
- [Lernpfad](../user-guide/learning-path.md) - die Set-Ebenen-Fortschrittsansicht, die diese Seite ergänzt
