# EXP-034: Content Discovery + Suchindex (Content Discovery & Search Index)

**Kategorie:** Vision · **Phase:** gestuft (Repo-Index → Client-Suche →
Aggregator) · **Priorität:** Mittel · **Abhängig von:** EXP-002
(Content-Repository, der Content-Loader + Cache), EXP-003 (Lektionsformat
v1.4 — die Manifeste, aus denen der Index generiert wird), EXP-023
(Multi-Content-Repository — `recommended-repos.json`, Trust-Level, mehrere
Repos), EXP-032/033 (Content-Validierung — `ai_validated` / `trust_level`
im Index), EXP-030 (Multi-User — Voraussetzung erst für den optionalen
Aggregator-Service in Phase 2) · **Issue:** —

> Design-Dokument. Kein Code. Es beschreibt, **wie** ein Lernender
> Lernmaterial **findet, bevor** er es vollständig herunterlädt — analog
> zu `npm search` vs. `npm install`. Kern: jedes Content-Repo generiert
> einen schlanken `search-index.json` (~4 KB, nur Metadaten), der client-
> seitig durchsucht wird; **kein Server nötig**. Erst nach dem Finden wird
> ein einzelnes Set heruntergeladen, nicht mehr das ganze Repo. Das löst
> das Skalierungsproblem für die nächsten 100+ Community-Repos.

---

## 1. Problem

Aktuell muss ein Content-Repo vollständig synchronisiert werden bevor der
User darin suchen kann. Bei wachsendem Ökosystem (viele Community-Repos)
skaliert das nicht:

- Speicherplatz: jede Lektion komplett in Dexie
- Ladezeit: Erststart bei vielen Repos langsam
- Bandbreite: alles herunterladen nur um zu browsen
- Suche: nur lokal, kein Repo-übergreifendes Discovery

## 2. Ziel

Ein User soll Lernmaterial FINDEN können ohne es vorher komplett
herunterladen zu müssen. Erst nach dem Finden wird das Material
heruntergeladen.

Analogie: `npm search` zeigt Pakete an, `npm install` lädt sie erst
herunter.

## 3. Architektur-Optionen

### Option A: Repo-seitiger Suchindex (empfohlen)

Jedes Content-Repo generiert eine `search-index.json` die nur Metadaten
enthält:

```json
{
  "repo": "astrapi69/adaptive-learner-content",
  "generated": "2026-06-17T12:00:00Z",
  "sets": [
    {
      "id": "es-a1-from-de",
      "name": "Spanisch A1",
      "description": "Grundlagen Spanisch...",
      "source_language": "de",
      "target_language": "es",
      "level": "a1",
      "domain": "language",
      "lesson_count": 15,
      "card_count": 450,
      "tags": ["artikel", "konjugation", "alltag"],
      "ai_validated": true,
      "trust_level": 3,
      "book": null
    }
  ],
  "total_lessons": 358,
  "total_cards": 10740
}
```

Vorteile:

- Ein Fetch pro Repo (wenige KB statt MB)
- Repo-Autor generiert den Index (CI oder Script)
- Kein Server nötig
- Durchsuchbar ohne Download
- Offline-fähig (Index cachen, ~5 KB pro Repo)

### Option B: Zentraler Katalog-Server

Ein Server aggregiert alle Repo-Indices. API:
`GET /api/catalog/search?q=spanisch&level=a1`

Vorteile: eine Quelle, schneller.
Nachteile: Server-Kosten, Single-Point-of-Failure, widerspricht dem
"kein Server ohne Finanzierung" Prinzip.

Empfehlung: NICHT in Phase 1. Erst wenn EXP-030 Multi-User mit Server
kommt.

### Option C: Hybrid (empfohlen für später)

Phase 1: Repo-seitiger Index (Option A).
Phase 2: Aggregator-Service der Indices einsammelt (ein
Static-Site-Generator, kein Server: GitHub Action baut eine `katalog.json`
aus allen `recommended-repos.json` Indices zusammen, deployed als
statische Datei).

## 4. Content Discovery Flow (Option A)

### Für den User:

1. User öffnet "Inhalte entdecken" / "Neue Inhalte"
2. App lädt `search-index.json` von allen recommended-repos (parallel,
   gecacht)
3. Suchfeld: User tippt "Spanisch" oder "KI" oder "A2"
4. Ergebnisse: Sets aus ALLEN Repos, gefiltert
   - Name, Beschreibung, Sprache, Level, Kartenanzahl
   - Trust-Badge (Official/Verified/Validated/AI-Checked)
   - "Herunterladen" Button pro Set
5. Klick auf "Herunterladen": nur dieses Set laden (nicht das ganze Repo)
6. Heruntergeladenes Set erscheint im Content-Browser

### Für den Content-Autor:

1. Content erstellen (LESSON-FORMAT v1.4)
2. `validate_content.py --generate-index` — generiert `search-index.json`
   aus den Manifesten
3. Committen + pushen
4. CI verifiziert den Index (Format, Vollständigkeit)

## 5. Suchindex-Format (Detail)

### `search-index.json` (Repo-Level)

Pro Set: Metadaten die für Suche + Filter reichen:

- `id`, `name`, `description` (durchsuchbar)
- `source_language`, `target_language` (Filter)
- `level` (Filter: a1/a2/b1/b2/c1/c2)
- `domain` (Filter: language/ai/psychology/...)
- `lesson_count`, `card_count` (Sortierung)
- `tags[]` (durchsuchbar, vom Autor vergeben)
- `ai_validated`: boolean (Filter)
- `trust_level`: 1/2/3 (Filter/Sortierung)
- `book`: {title, author} oder null (Filter: Buch-Begleiter)
- `updated_at`: Timestamp (Sortierung: Neueste zuerst)

NICHT im Index:

- Karten-Inhalte (das ist der Download)
- Einzel-Lektions-Details (zu granular)
- User-Fortschritt (lokal, nicht im Repo)

### Größe

Pro Set: ~200 Bytes. 20 Sets = ~4 KB. 100 Repos mit je 20 Sets = ~400 KB.
Das ist vernachlässigbar.

## 6. Suche (Client-seitig)

Kein Server, kein Elasticsearch. Alles im Browser:

### Einfache Suche (Phase 1):

- String-Match auf name + description + tags
- Lowercase, Akzent-normalisiert
- Filter: Sprache, Level, Domain, Trust

### Erweiterte Suche (Phase 2):

- Fuzzy-Match (Levenshtein, geringe Distanz)
- Gewichtung: Name > Tags > Description
- Sortierung: Relevanz / Neueste / Beliebteste

Library-First Prüfung (siehe `.claude/rules/reusability.md` §
Implementierungs-Hierarchie):

- Fuse.js (~30 KB, fuzzy search, client-seitig)
- minisearch (~15 KB, Full-Text-Index)
- Oder: native `Array.filter` + `includes` (Phase 1 reicht) — Stufe 1
  zuerst, Library nur wenn nötig.

## 7. Per-Set-Download statt Repo-Sync

Aktuell: ganzes Repo wird synchronisiert.
Neu: nur ausgewählte Sets herunterladen.

Flow:

1. Index zeigt Sets
2. User wählt ein Set
3. App lädt nur `set-manifest.yaml` + Lektionen dieses Sets
4. In Dexie speichern (wie heute, gleiche Tabellen)
5. Nicht heruntergeladene Sets bleiben nur im Index

Das erfordert: Set-URLs im Index (oder Konvention:
`/sets/{set-id}/set-manifest.yaml`).

## 8. Offline-Strategie

- `search-index.json` cachen (localStorage oder Dexie), TTL: 24 h (dann
  refreshen wenn online)
- Offline: Suche funktioniert auf dem gecachten Index
- Download nur online möglich
- Heruntergeladene Sets funktionieren offline (wie heute)

## 9. Roadmap

| ID | Task | Aufwand |
|----|------|---------|
| DIS-01 | `search-index.json` Format spezifizieren | S |
| DIS-02 | `validate_content.py --generate-index` | S |
| DIS-03 | CI-Action: Index bei jedem Push generieren + committen | S |
| DIS-04 | App: Index-Loader (parallel, gecacht) | M |
| DIS-05 | App: "Inhalte entdecken" Seite (Suche + Filter) | L |
| DIS-06 | App: Per-Set-Download statt Repo-Sync | M |
| DIS-07 | App: Suche im Content-Browser (lokale + Index) | M |
| DIS-08 | Aggregator (Phase 2: statisch generiert) | M |
| DIS-09 | Fuzzy-Suche (Phase 2, Library evaluieren) | S |

## 10. Offene Fragen

1. Soll der Index automatisch generiert werden (CI) oder manuell (Autor)?
   Empfehlung: CI (GitHub Action bei jedem Push auf main), Autor muss
   nichts tun.

2. Granularität: Set-Level oder Lektion-Level? Empfehlung: Set-Level für
   Phase 1 (reicht für Discovery). Lektion-Level als Phase 2 wenn User
   innerhalb eines Sets suchen wollen.

3. Tags: vom Autor oder automatisch? Empfehlung: Autor (manuell im
   Manifest). Automatische Tags (aus Karten-Inhalten) als Phase 2.

4. Rate-Limiting bei vielen Repos: 100 parallele Fetches auf
   `raw.githubusercontent.com`? Empfehlung: max 10 parallel, Queue für den
   Rest.

5. Suchindex in `recommended-repos.json` integrieren oder eigene Datei?
   Empfehlung: eigene Datei (`search-index.json`), `recommended-repos`
   bleibt die Liste der Repos, nicht der Inhalt.

## 11. Bewertung

Phase 1 (Repo-seitiger Index + Client-Suche) ist machbar ohne Server, ohne
neue Infrastruktur, ohne Kosten. Der Index wird einmal pro Repo-Update
generiert (~4 KB), im Browser gecacht, client-seitig durchsucht. Das löst
das Skalierungsproblem für die nächsten 100+ Repos.

Phase 2 (Aggregator + Fuzzy) ist ein Comfort-Feature, kein Blocker.
