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

Der Editor ist **TipTap-Rich-Text** (seit v1.14.0): fett /
kursiv / unterstrichen / durchgestrichen, Überschriften
(H1–H3), Aufzählungs- + Nummerierungs- + Aufgaben-Listen,
Blockquote, Inline-Code, Fenced Code-Blöcke mit `lowlight`-
Syntax-Highlighting für 11 Sprachen (bash / css / html /
java / javascript / json / markdown / python / sql /
typescript / yaml), Links, Textausrichtung, Highlight,
Undo / Redo, Zeichenzähler. Die Toolbar ist mobilfreundlich
mit horizontalem Scroll + 40-px-Touch-Zielen.

Curriculum-Beschreibungen, Sitzungsnotizen und Lektions-
Inhalte nutzen denselben Editor. Markdown- / PDF-Exporte
gehen durch `renderStoredContent`, das den TipTap-Doc-Baum
durchläuft und GFM-Markdown erzeugt; Plain-Text-Inhalte von
vor v1.14.0 werden unverändert durchgereicht.

## Wie Curricula zu Sessions passen

Sessions lassen sich aus einem Chat-Verlauf-Import oder von
Grund auf starten. Der Konversations-Analyzer
(`/api/imports`) extrahiert ein `suggested_curriculum`-Feld;
ein Klick im analysierten Import sät ein Curriculum mit
Topics + Lektionen aus den Lücken, die die KI identifiziert
hat.

Die Session-KI zieht (noch) keine einzelnen Lektions-Inhalte
in den System-Prompt — das ist ein bewusster Halt, bis sich
die Curriculum-KI-Integrations-Form gesetzt hat.

## Pro-Speichermodus-Verhalten

Sowohl ApiStorage als auch DexieStorage implementieren
Curriculum-CRUD. Im Lokal-Modus lebt das Curriculum in
IndexedDB und überlebt Browser-Reloads, solange du Site-Daten
nicht löschst. Im Server-Modus lebt es in der SQLite-Datenbank
des FastAPI-Backends.

[Wie Speichermodi funktionieren](settings.md)
