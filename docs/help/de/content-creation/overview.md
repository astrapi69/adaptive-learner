# Lektionen erstellen — Überblick

Adaptive Learner lebt von Inhalten. Du kannst eigene Lektionen
bauen — direkt in der App oder als Datei im Content-Repo-Format —
und sie mit der Community teilen. Diese Seite gibt den Überblick;
die ausführlichen Formatdetails stehen in den verlinkten Quellen.

---

## Zwei Wege, Lektionen zu erstellen

### 1. In der App: der Lektions-Creator

Der **Lektions-Creator** unter `/create-lesson` ist ein
4-Schritt-Assistent (Metadaten → Karten-Editor → Übungs-Generator
→ Speichern/Teilen) und braucht **keinen KI-Schlüssel**:

- Karten per Drag-and-drop ordnen oder aus **CSV importieren**.
- Übungen aus den Karten **automatisch generieren** (alle fünf
  Übungstypen) oder von Hand feinjustieren.
- **Vorlagen** (Leer / Vokabeln / Grammatik / Konversation) und
  **Entwurfs-Autospeicherung**.
- **Vorschau** im echten Lektions-Viewer vor dem Speichern.
- **Lokal speichern** oder **per Pull Request teilen**.

Einstiegspunkte gibt es im Content Browser und im Dashboard.

#### Wissens-Lektion aus Text (Buch-Modus)

Die fünfte Vorlagen-Karte, **„Wissens-Lektion aus Text"**, startet
einen eigenen 3-Schritt-Fluss (Metadaten → Buchtext → Überprüfen):
Füge einen Abschnitt (z. B. ein Kapitel) deines Lehrbuchs ein — die
KI formuliert ihn **in eigenen Worten** als Theorie-Schritte (nie als
Kopie) und generiert dazu passende Übungen, die auf ihren
Theorie-Schritt verweisen. Optional lassen sich Buchangaben (Titel,
Autor, URL, ISBN/ASIN) hinterlegen. Weitere Abschnitte ergänzt du,
indem du den Assistenten erneut durchläufst.

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

- [Lektionsinhalte erstellen (Entwickler)](../developer/authoring-content.md) — Schemadetails, Assets, Code-/Formel-Karten
- [Buchempfehlungen](books.md) — `books.yaml` pflegen
- [Mehrere Content-Repositories](../features/content-repos.md) — eigenes Repo verbinden
