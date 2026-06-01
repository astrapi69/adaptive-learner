# EXP-022: Visueller Lernpfad mit xyflow/React Flow

**Kategorie:** Feature
**Phase:** Zukunft (nach Abschluss der aktuellen Pipeline)
**Priorität:** Mittel
**Abhängig von:** bestehendes Content-System (EXP-002/003), adaptiver
Generator (EXP-013), Fehler-Analyzer (EXP-007), EXP-021 (Lektions-Creator)
**Status:** Exploration
**Library:** [xyflow/React Flow](https://github.com/xyflow/xyflow)

> Hinweis zur Herkunft: Dieses Dokument hält die Idee fest, einen
> knotenbasierten Graphen (React Flow / xyflow) als visuelle
> Darstellungsschicht über bereits vorhandene Daten zu legen. Es ist
> ein Explorations-Planungsdokument, keine Spezifikation. Nichts wird
> hier implementiert; die verbindliche Sub-Phasen-Aufteilung lebt -
> falls die Idee weiterverfolgt wird - in der Roadmap.

## Problem

Die App stellt Lernfortschritt, Content-Hierarchie und Fehlermuster
heute durchgehend als **Listen** dar: das Content-Browser-Set ist ein
Baum aus aufklappbaren Listen, der adaptive Lernpfad ist eine
Reihenfolge, die Fehleranalyse eine Aufzählung von Fokusbereichen. Das
ist funktional vollständig, aber es fehlt eine **räumliche, visuelle
Sicht**, die Zusammenhänge auf einen Blick zeigt - welche Lektion auf
welcher aufbaut, wo der Lernende gerade steht, welche Fehler
zusammenhängen. Lernpfade sind ihrer Natur nach Graphen; sie als reine
Liste zu zeigen, verschenkt Verständlichkeit und Motivation.

Das ist **keine funktionale Lücke** - alle Daten existieren und sind
nutzbar. Es ist ein **visueller Differenzierer**: eine Darstellung, die
den adaptiven Kern der App sichtbar und greifbar macht.

## Kernkonzept

[React Flow (xyflow)](https://github.com/xyflow/xyflow) ist eine
React-Bibliothek für knoten- und kantenbasierte Diagramme (Nodes +
Edges) mit Zoom, Pan, eigenen Knoten-Komponenten und Auto-Layout. Die
Idee ist, sie als **reine Darstellungsschicht** über bereits
vorhandene Datenquellen zu legen - der Graph wird aus dem
Content-System, dem adaptiven Generator und dem Fehler-Analyzer
abgeleitet, nicht als neue Datenhaltung eingeführt.

## Anwendungsfälle

### 1. Learning Path Graph (primär)

Ein visueller Knotengraph, der die **Lektionsabfolge** eines Sets
zeigt: jede Lektion ein Knoten, Kanten als Voraussetzungs-/Abfolge-
Beziehungen. Pro Knoten visualisiert:

- **Mastery-Status** (offen / in Arbeit / pausiert / abgeschlossen /
  gemeistert) farbcodiert über die bestehenden ``--exercise-*`` /
  Status-Tokens.
- **Empfohlene nächste Schritte** (Anbindung an die Smart-Next-Step-
  Suggestions aus Phase 64 und den Review-Queue / adaptiven Pfad).
- **Fortschrittsindikator** (Sterne, gemeisterte Elemente).

Das ist der Use Case mit dem höchsten Wert: er macht aus der heutigen
Lektionsliste eine Landkarte des Lernwegs.

### 2. Content Browser Tree

Der ``/content``-Set-Browser (heute ein Quell-Sprache -> Ziel-Sprache
-> Niveau-Baum aus Listen) als **interaktiver, zoombarer Baum** statt
als Liste. Gleiche Daten, räumliche Navigation: hinein-/herauszoomen,
Äste auf-/zuklappen, einen Pfad durch den Sprachbaum verfolgen.

### 3. Error Cluster Visualization

Ein verbundener Graph **zusammenhängender Fehler**: die
``ElementError``-Historie und die Klassifikation des Fehler-Analyzers
(z.B. ``article_gender`` / ``spelling_accent`` / ``verb_conjugation``
/ ``word_order`` aus EXP-013) als Cluster-Graph. Knoten sind einzelne
Fehler oder Elemente, Kanten ihre Verwandtschaft (gleiche Kategorie,
gleiches Wort, gemeinsame Lektion). Macht sichtbar, dass scheinbar
einzelne Fehler ein gemeinsames Muster haben.

### 4. Lesson Creator (EXP-021)

Ein visueller **Beziehungs-Editor für Übungen und Karten** im
geplanten eigenständigen Lektions-Creator (EXP-021): Karten und
Übungen als Knoten, Kanten als "diese Übung nutzt diese Karten".
Erlaubt es Autoren, die Struktur einer Lektion visuell zu bauen und zu
prüfen, statt nur über Formulare.

## Abhängigkeiten

| Datenquelle | Liefert für | Status |
| --- | --- | --- |
| Content-System (EXP-002/003) | Lektions-/Set-Struktur (Use Case 1+2) | vorhanden |
| Adaptiver Generator (EXP-013) | Empfohlene nächste Schritte, Fokusbereiche (Use Case 1) | vorhanden |
| Fehler-Analyzer (EXP-007/013) | ``ElementError`` + Klassifikation (Use Case 3) | vorhanden |
| Lektions-Creator (EXP-021) | Karten/Übungs-Beziehungen (Use Case 4) | geplant |

Der Graph führt **keine neue Datenhaltung** ein. Jeder Use Case ist
ein Ableiter (Daten -> ``{nodes, edges}``) plus ein Renderer.

## Wiederverwendung statt Neubau

- **Status-Farben:** die bestehenden Theme-Tokens (``--exercise-*``,
  Status-Paare) - der Graph muss in allen sechs Themes (inkl.
  High-Contrast) lesbar sein, ohne harte Farben.
- **Mastery-/Fortschritts-Logik:** ``isFullyMastered`` /
  ``is_fully_mastered``, Sternberechnung, Pausen-/Abbruch-Status -
  unverändert lesen, nur darstellen.
- **Dual-Storage:** Knoten/Kanten werden aus
  ``IStorageService``-Daten abgeleitet und müssen in **beiden Modi**
  (API + Dexie) funktionieren - der Graph ist rein clientseitig und
  daher von Natur aus Dexie-tauglich.

## Offene Fragen

- **Neue Abhängigkeit:** React Flow ist eine neue Frontend-Dependency
  (Bundle-Größe, Wartung). Vor jeder Umsetzung gilt die Regel "neue
  Dependency nur nach Rückfrage". Zu prüfen: Bundle-Impact (Code-
  Splitting via ``React.lazy`` analog ``html5-qrcode``), Lizenz (React
  Flow Core ist MIT, ``@xyflow/react``), Auto-Layout-Bedarf
  (zusätzliche Lib wie ``dagre``/``elkjs`` für gerichtete Layouts?).
- **Auto-Layout vs. fixe Positionen:** Lektionsabfolgen sind meist
  linear/baumartig - reicht ein einfaches gerichtetes Layout, oder
  braucht es eine Layout-Engine?
- **Mobile/Touch:** Pan/Zoom-Graphen auf kleinen Screens; verträgt
  sich das mit den Mobile-Scroll-Fixes aus Phase 63?
- **Barrierefreiheit:** ein Canvas-/SVG-Graph braucht eine
  zugängliche Alternative (Liste bleibt als Fallback) und Fokus-/
  Tastatur-Navigation (WCAG-Audit-Linie aus Phase 58/61).
- **Umfang:** Use Case 1 (Learning Path Graph) ist der MVP-Kandidat;
  2-4 sind Folgeausbauten. Alle vier auf einmal wäre zu groß.

## Abgrenzung

- **Kein funktionaler Ersatz:** die Listen-Ansichten bleiben (Fallback
  + Barrierefreiheit). Der Graph ist eine zusätzliche Sicht, kein
  Austausch.
- **Reihenfolge:** erst wenn die aktuelle Pipeline (Content-,
  Adaptiv-, Fehler-System) vollständig ist; der Graph lebt von diesen
  Daten und sollte nicht parallel zu deren Aufbau entstehen.
- **MVP:** Use Case 1, ein Set, ein Layout, alle sechs Themes,
  Dexie-tauglich, mit Listen-Fallback.
