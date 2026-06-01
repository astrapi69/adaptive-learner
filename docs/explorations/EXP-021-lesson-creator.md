# EXP-021: Lektions-Creator (eigenständig, ohne Chat-Analyse)

**Kategorie:** Feature
**Phase:** 2
**Priorität:** Hoch
**Abhängig von:** EXP-002 (Content-Repo), EXP-003 (Lektionsformat), EXP-006 (Freitext/Word Tiles), EXP-013 (analysis-to-lesson-Generator), Phase 64 (Share-Wizard, Platzierung, Autoren-Credit)
**Status:** Geplant (Umsetzung als eigene Phase, z.B. Phase 65)

> Hinweis zur Herkunft: Dieses Dokument fasst die Spezifikation des
> eigenständigen Lektions-Creators als Explorations-Planungsdokument
> zusammen. Die verbindliche Sub-Phasen-Aufteilung lebt in der
> Roadmap; hier stehen Problem, Konzept, Stufen und der Wiederverwendungs-Plan.

## Problem

Lernende können heute eine Lektion nur auf einem Weg erzeugen:
**einen Chat importieren und analysieren** (EXP-013 /
``analysis-to-lesson.ts``). Wer eine Lektion **von Grund auf** bauen
möchte - ein Thema wählen, Karten anlegen, Übungen erzeugen, speichern -
hat keinen Einstieg. Das schließt genau die motivierten Beitragenden
aus, die Phase 64 (Community-Sharing, Lücken-Vorschläge) anspricht:
Die App fragt "Kannst du helfen?", bietet aber keinen Weg, eine neue
Lektion ohne Umweg über einen Chat-Import zu erstellen.

## Kernkonzept

Eine neue Route ``/create-lesson`` mit einem **vierstufigen Assistenten**,
der dieselben Bausteine wiederverwendet, die Phase 59/64 bereits
geschaffen haben: das Metadaten-Formular der Save-as-Offline-Lesson,
den ``analysis-to-lesson``-Übungsgenerator (entkoppelt vom
Analyse-Input) und den Share-Wizard aus Phase 64C.

### Stufe 1 - Metadaten

- **Titel** (Pflicht)
- **Titel (Zielsprache)** / ``title_native`` (optional)
- **Ausgangssprache** (Dropdown, Standard: App-Sprache)
- **Zielsprache** (Dropdown, Pflicht)
- **Niveau** (CEFR-Dropdown: A1-C2)
- **Thema / Beschreibung** (Textfeld)
- **Autorenname** (aus localStorage vorausgefüllt, Phase 64C-2)

### Stufe 2 - Karten-Editor

- Karten einzeln hinzufügen: **Vorderseite** (Zielsprache),
  **Rückseite** (Ausgangssprache), **Notizen** (optional: Grammatik,
  Beispielsätze), **Bildreferenz** (optional, für Picture-Choice),
  **Token-Rollen** (optional, fortgeschritten:
  Artikel/Verb/Nomen/Adjektiv).
- Kartenliste: alle Karten anzeigen, **umsortierbar** (``@dnd-kit``
  aus den Word Tiles wiederverwenden).
- **Minimum: 4 Karten**, damit Übungen generierbar sind.
- **CSV-Import:** ``front,back,notes`` einfügen oder hochladen für
  Mengen-Erfassung.

### Stufe 3 - Übungsgenerator

- **Übungen automatisch erstellen** - erzeugt eine Mischung aller fünf
  Typen aus den Karten:
  - Matching (Gruppen von 4-5 Karten)
  - Freitext (je Karte)
  - Picture Choice (falls Bilder vorhanden)
  - Word Tiles (aus Notizen/Beispielsätzen, falls vorhanden)
  - Cloze (aus Notizen/Beispielsätzen, falls vorhanden)
- **Richtung:** folgt der Nutzer-Voreinstellung aus den Einstellungen
  (EXP-018) bzw. automatisch nach Niveau.
- **Manueller Übungs-Editor** (fortgeschritten, Folge-Ausbau): einzelne
  Übungen anlegen, Typ + Karten wählen, konfigurieren - für Power-User
  und Content-Autoren.
- **Vorschau:** Lektion wie im Viewer anzeigen.
- **Zähler:** "12 Übungen generiert".

### Stufe 4 - Speichern + Teilen

- Lokal speichern (in "Meine Lektionen", ``saveUserSet``).
- Optional mit der Community teilen (löst den Phase-64-Share-Wizard
  aus - inklusive Platzierung, Duplikat-Prüfung und Autoren-Credit).

## Einstiegspunkte

- **Content-Browser:** prominenter Button "Neue Lektion erstellen".
- **Meine-Lektionen-Bereich:** "+"-Button.
- **Dashboard:** Schnellaktion, wenn der Nutzer noch keine Lektion hat.

## Wiederverwendung statt Neubau

| Baustein | Quelle | Anpassung |
| --- | --- | --- |
| Metadaten-Formular | ``SaveOfflineLessonModal`` | für eigenständige Nutzung lösen (kein Analyse-Kontext) |
| Übungs-Generierung | ``analysis-to-lesson.ts`` | refaktorieren, damit sie ohne Analyse-Input nur aus Karten arbeitet |
| Karten-Umsortierung | ``@dnd-kit`` (Word Tiles, Phase 64) | bestehendes Muster |
| Schema-Validierung | ``content-validator.ts`` | unverändert |
| Platzierung / Duplikat / Credit | ``placement-engine.ts`` / ``duplicate-detection.ts`` / Share-Wizard (Phase 64) | unverändert |
| Speichern | ``IStorageService.contentLoader.saveUserSet`` | unverändert |

Der zentrale Refactor ist die **Entkopplung des Übungsgenerators**:
``analysis-to-lesson.ts`` erwartet heute ein Analyse-Objekt. Die
Karten-zu-Übungen-Logik (Matching/Freitext/Cloze/Word-Tiles aus
``vocabulary[]``) wird in eine reine ``cards-to-exercises``-Funktion
extrahiert, die sowohl der Analyse-Pfad als auch der neue Creator
aufrufen.

## MVP-Abgrenzung

- **MVP:** Metadaten-Formular + Karten-Editor + Auto-Generierung +
  Speichern + (Wiederverwendung des) Share-Wizards.
- **Folge-Ausbau:** manueller Übungs-Editor (einzelne Übungen von Hand
  konfigurieren), CSV-Datei-Upload (vs. Einfügen), Token-Rollen-UI,
  Bild-Upload für Picture Choice.

## Schema

Keine neuen Pflichtfelder. Der Creator erzeugt eine ``ContentLesson``
nach Schema 1.3 (additiv); die in Phase 64 ergänzten optionalen Felder
(``variation_of``, ``contributed_by``, ``contributed_at``) werden vom
Share-Wizard gesetzt, nicht vom Creator selbst.

## Offene Fragen

- **Bild-Assets:** Picture-Choice braucht Bilddateien. Der Creator
  müsste Asset-Upload + die ``assets/``-Manifest-Deklaration (Phase 54)
  unterstützen, oder zunächst auf die Platzhalter-SVGs setzen.
- **Beispielsätze für Cloze/Word-Tiles:** ohne Notizen/Beispielsätze
  kann der Generator nur Matching + Freitext erzeugen. Soll der Creator
  Beispielsätze als eigenes Kartenfeld erzwingen, um die Typ-Vielfalt
  (Validator: >= 2 Typen) zu sichern?
- **Qualitäts-Gate:** der Creator sollte denselben
  ``content-validator`` live anwenden, damit der Nutzer schon beim
  Bauen sieht, ob die Lektion teilbar ist (>= 5 Übungen, >= 2 Typen).

## Bezug zu Phase 64

Phase 64 hat die "letzte Meile" (Teilen, Platzieren, Duplikate,
Credit) gebaut, aber den Erstellungs-Einstieg bewusst ausgeklammert
("This is a MAJOR feature"). EXP-021 ist die natürliche Fortsetzung:
Sobald Nutzer Lektionen mühelos von Grund auf bauen können, wird aus
"Kannst du helfen?" (EXP-021-fähige Lücken-Vorschläge aus Phase 64E)
ein konkreter, klickbarer Erstellungs-Workflow.
