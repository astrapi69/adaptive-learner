# Curriculum

Die Curriculum-Seite ist dein strukturiertes Lernmaterial —
das "Buch", gegen das deine Sessions laufen. Eine optionale,
aber starke Schicht über den freien KI-Sessions.

## Was ein Curriculum ist

Ein Curriculum ist ein Baum aus **Themen** plus eine flache
Liste von **Lektionen**, alles einem Lernenden zugeordnet. Du
kannst mehrere Curricula nebeneinander führen ("Spanische
Grammatik", "Spring Boot für Java-Entwickler", "Solo-Gitarre").

- **Themen** bilden einen Baum — Kapitel und Unterkapitel.
  Jedes Thema hat einen Titel, optional eine Beschreibung und
  einen Eltern-Verweis. Der "Unterthema hinzufügen"-Button
  erzeugt ein Kind.
- **Lektionen** sind flach unter dem Curriculum. Jede hat
  einen Titel und einen Rich-Text-Inhalt. Nutze sie für
  schriftliches Material: Notizen, Zusammenfassungen,
  Aufgabenblätter.

## Curriculum anlegen

Die Curriculum-Seite listet jedes Curriculum, das du besitzt.
Das "Curriculum anlegen"-Formular nimmt Titel + optionale
Beschreibung + optionale Sprache; Klick auf Anlegen öffnet das
neue Curriculum direkt.

## Der Themen-Baum

Links in der Curriculum-Ansicht steht der Themen-Baum, per
Drag-and-Drop sortierbar (auch touch-freundlich auf Mobile).
Klick auf ein Thema öffnet es; der Breadcrumb unter dem Titel
zeigt den Weg zur Wurzel zurück.

- **Thema hinzufügen** auf Wurzelebene — Geschwister jeder
  bestehenden Top-Level-Themen.
- **Unterthema hinzufügen** unter dem aktuell fokussierten
  Thema.
- **Umbenennen** durch Klick auf den Titel im Edit-Modus.
- **Löschen** entfernt das Thema UND seine Kinder (im
  Dexie-Modus in einer Transaktion; im API-Modus delegiert
  ans Backend).

Der Baum ist reine Metadaten; Themen tragen keinen eigenen
Inhalt. Inhalt sitzt in Lektionen.

## Lektionen

Rechts in der Curriculum-Ansicht steht die Lektionsliste,
sortiert nach `order_index`. Jede Zeile zeigt den Lektions-
titel und einen Ausschnitt; Klick öffnet den Lektions-Editor.

Der Editor ist ein reiner Markdown-/Plaintext-Editor — bewusst
kein voller WYSIWYG (der Bibliogon-Ära-TipTap-Editor wurde
beim v0.1.0-Skeleton-Schnitt entfernt, siehe die Projekt-
referenz für die Abwägung). Überschriften, Links, Code-Blöcke,
Listen und einfache Hervorhebungen funktionieren über
Markdown.

## Wie Curricula zu Sessions passen

In v0.7.0 ziehen Sessions noch keine Themen-/Lektions-Inhalte
in den KI-System-Prompt. Der Wert des Curriculums liegt heute
darin, **dein eigenes Denken zu strukturieren**: schreibe
Zusammenfassungen, baue einen Themenbaum, verknüpfe Lektionen
miteinander.

Eine zukünftige Phase wird das Curriculum in den Session-
Prompt einklinken, sodass die KI auf deine eigenen Notizen
verweisen kann. Bewusst aufgeschoben, bis die Curriculum-
Datenform sich gesetzt hat.

## Pro-Speichermodus-Verhalten

Sowohl ApiStorage als auch DexieStorage implementieren
Curriculum-CRUD. Im Lokal-Modus lebt das Curriculum in
IndexedDB und überlebt Browser-Reloads, solange du Site-Daten
nicht löschst. Im Server-Modus lebt es in der SQLite-Datenbank
des FastAPI-Backends.

[Wie Speichermodi funktionieren](settings.md#speicher-modus)
