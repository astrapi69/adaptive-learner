# Lektionen erstellen - Überblick

Adaptive Learner lebt von Inhalten. Du kannst eigene Lektionen
bauen - direkt in der App oder als Datei im Content-Repo-Format -
und sie mit der Community teilen. Diese Seite gibt den Überblick;
die ausführlichen Formatdetails stehen in den verlinkten Quellen.

---

## Zwei Wege, Lektionen zu erstellen

### 1. In der App: der Lektions-Creator

Der **Lektions-Creator** unter `/create-lesson` ist ein
4-Schritt-Assistent (Metadaten → Karten-Editor → Übungs-Editor
→ Speichern/Teilen) und braucht **keinen KI-Schlüssel**:

- Karten per Drag-and-drop ordnen oder aus **CSV importieren**;
  Karten können ein **hochgeladenes Bild** tragen.
- Im Metadaten-Schritt ist die **Wissensdomäne** wählbar (z. B.
  Sprache, Programmieren, Psychologie, Hundetraining,
  Verkehrskunde).
- Übungen aus den Karten **automatisch generieren** oder in
  Schritt 3 **vollständig selbst bearbeiten**: alle
  Kern-Übungstypen lassen sich anlegen, ändern und manuell
  hinzufügen - inklusive nativem **Multiple Choice** mit einem
  prominenten Umschalter für **Einfach-/Mehrfachauswahl**.
- **Diktat** (Audio-Diktat) steht direkt im Aufgabentyp-Picker;
  den Audio-Clip lädst du als Datei hoch (in der Lektion
  eingebettet) oder gibst einen Asset-Pfad an. Die Lektion wird
  dabei automatisch als erweiterungsabhängig markiert.
- Der **Erweiterungs-Assistent** erstellt KI-gestützt alle fünf
  Extension-Übungstypen (Kategorisierung, Fehlerkorrektur,
  Leseverständnis, benoteter Quiz, Diktat).
- **Vorlagen** (Leer / Vokabeln / Grammatik / Konversation) und
  **Entwurfs-Autospeicherung**.
- **Vorschau** im echten Lektions-Viewer vor dem Speichern.
- **Lokal speichern** oder **per Pull Request teilen**.

Einstiegspunkte gibt es im Content Browser und im Dashboard.

#### Wissens-Lektion aus Text (Buch-Modus)

Die fünfte Vorlagen-Karte, **„Wissens-Lektion aus Text"**, startet
einen eigenen 3-Schritt-Fluss (Metadaten → Buchtext → Überprüfen):
Füge einen Abschnitt (z. B. ein Kapitel) deines Lehrbuchs ein - die
KI formuliert ihn **in eigenen Worten** als Theorie-Schritte (nie als
Kopie) und generiert dazu passende Übungen, die auf ihren
Theorie-Schritt verweisen. Optional lassen sich Buchangaben (Titel,
Autor, URL, ISBN/ASIN) hinterlegen; sie bleiben beim späteren
Bearbeiten der Lektion erhalten.

Statt Text einzufügen kannst du auch eine **Buchdatei hochladen**
(EPUB, DOCX, TXT oder Markdown, bis 20 MiB). Die Datei wird
vollständig **im Browser** zerlegt - nichts wird hochgeladen - und
die erkannten Kapitel erscheinen als **Auswahlliste mit
Häkchen**. Abschnitte, die nach Vor- oder Nachspann aussehen
(Vorwort, Glossar, Index …), sind per Heuristik **standardmäßig
abgewählt**, bleiben aber sichtbar und wählbar:

- **Ein Abschnitt gewählt** - er wird ins Textfeld übernommen
  (mit Vorschau; ein gefülltes Feld fragt vorher nach).
- **Mehrere Abschnitte gewählt** - die **Batch-Generierung**
  erzeugt **eine Lektion pro Abschnitt** und speichert sie
  zusammen als Mehrfach-Lektions-Set.

Beim **Bearbeiten** eines Mehrfach-Lektions-Sets fragt ein
**Lektions-Picker**, welche Lektion du öffnen willst; Buchtext-
Lektionen öffnen direkt den Übungs-Editor.

Anders als der Karten-Weg braucht dieser Modus einen
**konfigurierten KI-Schlüssel**. Füge nur Texte ein, an denen du die
Rechte hast oder die für den persönlichen Gebrauch bestimmt sind.

### 2. Als Datei: das Content-Repo-Format

Eine Lektion ist eine JSON-Datei in einem **Content-Set**. Sets
liegen in öffentlichen GitHub-Repos und folgen einem festen
Verzeichnisbaum (`sets/{Quellsprache}/{Zielsprache-Niveau}/`). Die
maßgeblichen Anleitungen liegen im Inhalts-Repository:

- **Erste Schritte:**
  [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- **Lektionsformat:**
  [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

Ein fertiges **Starter-Kit** zum Abgucken und Kopieren ist
[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test).

---

## Teilen per Pull Request

Lektion teilen erzeugt einen echten **Pull Request** (Fork →
Commit → PR). Die App schlägt automatisch den richtigen Pfad und
einen nummerierten Dateinamen vor und erkennt Duplikate/Varianten.
Die **Validierungs-Pipeline** des Inhalts-Repos prüft jede
eingereichte Lektion bei jedem PR (Schema, Sprachpaar,
Qualitäts-Mindestmaße), sodass nur saubere Inhalte in den Katalog
gelangen. Optional gibt es eine KI-gestützte Inhaltsprüfung; sie
blockiert das Teilen nie.

---

## Verwandte Seiten

- [Lektionsinhalte erstellen (Entwickler)](../developer/authoring-content.md) - Schemadetails, Assets, Code-/Formel-Karten
- [Buchempfehlungen](books.md) - `books.yaml` pflegen
- [Mehrere Content-Repositories](../features/content-repos.md) - eigenes Repo verbinden
