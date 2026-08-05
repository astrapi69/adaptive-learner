# EXP-049: Auffindbarkeit der öffentlichen Flächen

**Kategorie:** Querschnitt (SEO / Discoverability) · **Phase:** Analyse (keine
Umsetzung in diesem Dokument) · **Priorität:** P3 (kein Blocker; Wirkung liegt
in Reichweite, nicht in Funktion) · **Abhängig von:** #1104 (SEO-Meta, bereits
ausgeliefert), EXP-034 / #736 (Suchindex), EXP-048 / #2297 (In-App-Entdecken),
#2299 (`review_status` am Parser), EXP-023 (Multi-Content-Repository) ·
**Issue:** #2400 (Sammel-Vorgang)

> Explorationsdokument. Kein Code, keine Sitemap gebaut, kein Schema-Eingriff,
> kein Eingriff in fremde Repositories, nur Messung, Entwurf und angemeldeter
> Bedarf. Die Anwendung läuft seit der Bindungsumstellung nur noch auf Loopback
> und ist damit für Suchmaschinen strukturell unerreichbar. Das ist eine Folge
> der Architektur, kein Versäumnis. Der Ertrag liegt in dem, was tatsächlich
> öffentlich ausgeliefert wird, und das ist zuerst zu erheben.

> **Zusammengeführt (2026-08-05):** Dieselbe Exploration wurde unabhängig
> doppelt erarbeitet - hier und im Engine-Repository
> (`learn-content-engine/docs/proposals/discoverability.md`, engine#124,
> PR engine#125). Der Fehler lag in der Auftragsvergabe, nicht bei den
> Spuren; beide kommen zum selben Kernbefund (die Landeseite liefert keinen
> indizierbaren Text, ohne serverseitiges Rendern hilft daran keine
> Optimierung). Diese Fassung ist der Träger. Aus der Engine-Fassung
> übernommen: die gemessene Flächentabelle mit Zeichenzahlen, der Befund zur
> Engine-Pages-Seite und die Erzeugungs-Aufstellung ohne Schema-Änderung.
> Zwei Befunde führt NUR diese Fassung, als eigenständige Befunde: die vier
> Set-Zahlen im ausgelieferten Text (#2403, darunter die Meta-Beschreibung -
> die sichtbarste falsche Zahl im Bestand) und die indizierbare Vorschau
> (#2404, eine Staging-Kopie in Suchergebnissen ist ein Fehler). Die
> Engine-Fassung bleibt bestehen und verweist hierher.

---

## 0. Kernbefund vorweg

**Es gibt nicht ein Auffindbarkeitsproblem, sondern drei getrennte Flächen mit
drei getrennten Diagnosen.** Sie dürfen nicht zusammengefasst werden, weil sie
sich in genau der Frage unterscheiden, auf die es ankommt: liefert die Adresse
einem Suchdienst fertiges HTML oder eine leere Hülle.

| Fläche | Adresse | Was ein Crawler bekommt | Indizierbar |
|---|---|---|---|
| Produktions-App | `astrapi69.github.io/adaptive-learner/` | Statischer `<head>` (reich, #1104), Rumpf leer, alles Weitere im Browser gerendert | nur die eine Landeseite, kein Inhalt |
| Doku | `astrapi69.github.io/adaptive-learner/docs/` | Fertiges statisches HTML (MkDocs Material) | ja, vollständig |
| Vorschau | `astrapi69.github.io/adaptive-learner-content-test/` | Dieselbe leere Hülle wie Produktion, Staging | ungewollt indizierbar |

Zwei Befunde bestimmen den Rest des Dokuments:

- **Die App ist eine clientseitig gerenderte Einzelseite (SPA).** Der `<head>`
  ist seit #1104 vollständig ausgestattet (Titel, Beschreibung, Open Graph,
  Twitter-Card, JSON-LD, Canonical), aber der Inhalt (Sets, Lektionen,
  Dashboard) entsteht erst im Browser aus geladenem JavaScript und Dexie-Daten.
  Es gibt **keine eigene Adresse je Set oder Lektion** und keine Vorab-Erzeugung
  (Prerender/SSR). Damit ist genau **eine** Seite indizierbar (die Landeseite),
  und der eigentliche Ertrag, die Lerninhalte, ist unsichtbar.
- **Die Doku ist bereits der Idealfall** und braucht am wenigsten: echtes
  statisches HTML in acht Sprachen, das mit dem gleichen Auslieferungslauf
  unter `/docs/` mitgeht.

**Gemessene Ausgangslinie (2026-08-05):** Weder eine Suche nach Produktname und
Beschreibung noch eine `site:`-Abfrage auf `astrapi69.github.io` förderte die
Auslieferung zutage. Das bestätigt die Prämisse "weitgehend unsichtbar" mit
einer tatsächlichen, wenn auch groben Messung. Einschränkung ausdrücklich: das
verfügbare Suchwerkzeug ist US-beschränkt und keine Search Console; die Zahl ist
Richtungssignal, kein belastbares Indizierungsmaß (siehe Teil 7).

---

## Teil 1: Bestandsaufnahme mit Zahlen

### Messmethode

Gemessen am 2026-08-05 gegen den Arbeitsbaum (`frontend/index.html`,
`frontend/public/`, `.github/workflows/deploy-*.yml`, `mkdocs.yml`, README) und
gegen die live veröffentlichten Indizes, so wie EXP-048 sie am 2026-08-01
gelesen hat. Alle Zahlen unten sind Ausgabe, keine Schätzung; wo eine Zahl aus
EXP-048 stammt, ist sie so gekennzeichnet.

### Welche Adressen sind öffentlich

| Ort | Adresse | Auslöser | Speicher-Modus |
|---|---|---|---|
| Produktions-App | `astrapi69.github.io/adaptive-learner/` | Push auf `main` (nur bei Release) | Dexie, kein Backend |
| Doku (im selben Artefakt) | `.../adaptive-learner/docs/` | derselbe Lauf | statisch |
| Vorschau | `astrapi69.github.io/adaptive-learner-content-test/` | Push auf `develop` | Dexie, kein Backend |
| Haupt-Repository | `github.com/astrapi69/adaptive-learner` | GitHub selbst | README rendert |
| Inhalte-Repositories | `github.com/astrapi69/adaptive-learner-content` (+ 7 weitere registrierte Quellen) | GitHub selbst | Rohdateien |

Die Vorschau geht auf den `gh-pages`-Zweig des **content-test**-Repositories
(`deploy-preview.yml`), damit die Produktionsseite sauber bleibt. Sie ist damit
eine zweite öffentliche Kopie der App.

### Was jede Adresse einem Suchdienst ausliefert

- **Produktions-App:** `index.html` mit vollständigem statischem `<head>`
  (#1104). Der `<body>` ist `<div id="root"></div>` plus das Modul-Skript.
  Moderne Crawler rendern JavaScript, aber es gibt keine verlinkbaren
  Inhaltsseiten und keine Vorab-Erzeugung, also entsteht aus dem Rendern keine
  zweite indizierbare Seite. **Ergebnis: eine Landeseite, kein Inhalt.**
- **Doku:** Fertiges HTML je Seite in acht Sprachen (en, de, el, es, fr, ja,
  pt, tr - die Engine-Fassung hat die Verzeichnisse gezählt, je ~60 Seiten;
  die ursprüngliche Fassung hier sprach fälschlich von "DE und EN"), MkDocs
  Material. **Vollständig indizierbar.**
- **Vorschau (eigenständiger Befund dieser Fassung, #2404):** Dieselbe
  `index.html` wie Produktion, inklusive
  `<meta name="robots" content="index, follow">` und Canonical auf die
  Produktions-Adresse. Der Canonical hilft gegen Doppelindizierung, aber die
  Staging-Seite trägt keine eigene Robots-Sperre und sollte gar nicht in den
  Index. Eine Staging-Kopie in Suchergebnissen ist ein Fehler, kein
  Schönheitsfehler.
- **Haupt-Repository:** README wird von GitHub als HTML gerendert und ist
  crawlbar (das ist heute die faktische Landeseite für die Zielgruppe
  "Mitwirkende", siehe Teil 2).
- **Inhalte-Repositories:** Die Lektionen liegen als JSON/YAML-Dateien. GitHub
  liefert Rohdateien mit `X-Robots-Tag: noindex` aus; sie sind keine lesbaren
  Seiten und tauchen nicht als Treffer auf. Der Inhalt ist öffentlich
  *abrufbar*, aber nicht *auffindbar*.

### Gemessene Zeichenzahlen je Fläche (aus der Engine-Fassung, live 2026-08-05)

Gemessen gegen die live veröffentlichten Adressen, nicht gegen Konfiguration:
sichtbarer `<body>`-Text nach Abzug von Skripten, Styles und Kommentaren.

| Adresse | HTTP | Text für den Crawler | Meta-Beschr. | OG | Sitemap | robots |
|---|---|---|---|---|---|---|
| `astrapi69.github.io/adaptive-learner/` | 200 | **0 Zeichen** | ja (veraltet, #2403) | 11 Tags | ja, 2 Adressen | ja, `Allow: /` |
| `.../adaptive-learner/content` | 301 auf dieselbe Hülle | 0 | geerbt | geerbt | in der Sitemap gelistet | - |
| `.../adaptive-learner/docs/` | 200 | **5155 Zeichen** | - | - | **ja, 480 Adressen** | - |
| `astrapi69.github.io/learn-content-engine/` | 200 | 570 Zeichen | **nein** | **nein** | **nein** | **nein** |
| `.../learn-content-engine/api/` | 200 | 9989 Zeichen | ja | - | nein | nein |
| `astrapi69.github.io/adaptive-learner-content/` | **404** | - | - | - | - | - |
| `raw.githubusercontent.com/.../search-index.json` | 200 | (JSON, keine Seite) | - | - | - | - |

Die Null in der ersten Zeile ist der Kernbefund als Zahl: die eine
indizierbare Seite liefert keinen einzigen sichtbaren Textbuchstaben aus.
Die 480-Adressen-Sitemap der Doku ist die einzige in Masse crawlbare Fläche.

**Engine-Pages-Seite (Zuständigkeit: Engine-Repository).** Die Landeseite
des Engine-Repositories trägt weder Meta-Beschreibung noch Open-Graph-Block
noch robots.txt. Sie ist der Einstiegspunkt der Schema-`$id`-Adressen, wird
also von Maschinen und gelegentlich Menschen besucht; wenige Zeilen HTML
schließen die Metadaten-Hälfte. Eine Sitemap wäre dort dagegen NICHT
sinnvoll: zwei Seiten plus ein Verzeichnis von JSON-Artefakten, die ein
Crawler ohnehin in einem Sprung findet. Beides wird in der Engine-Fassung
als dortiger Schritt geführt und hier nur eingeordnet.

### Was es an SEO-Infrastruktur schon gibt (#1104, geschlossen)

`frontend/index.html` trägt bereits: `title`, `meta description`,
`meta keywords`, `meta author`, `meta robots = index, follow`, `link canonical`,
komplettes Open Graph, Twitter-Card, und ein JSON-LD `WebApplication`.
`frontend/public/` trägt `robots.txt` (erlaubt alles, verweist auf die Sitemap)
und `sitemap.xml`.

**`sitemap.xml`** (handgepflegt, `lastmod 2026-06-24`) listet genau zwei
Adressen: `/` und `/content`. Beide sind SPA-Hüllen; `/content` rendert die
Ansicht "Meine Inhalte" clientseitig und trägt keinen indizierbaren Inhalt. Die
Sitemap verspricht damit eine Inhaltsseite, die es als Seite nicht gibt.

**MkDocs** hat `site_url` gesetzt und erzeugt beim Bauen selbst eine
`sitemap.xml` unter `/docs/`. Diese ist von der `robots.txt` an der Wurzel
**nicht** verlinkt (die verweist nur auf die App-Sitemap). Die Doku-Sitemap
existiert also, wird aber nicht angekündigt.

### Die Inhalts-Zahlen, und warum drei verschiedene kursieren

Es gibt zwei verschiedene Bezugsgrößen, und drei verschiedene Zahlen im Code:

| Bezugsgröße | Zahl | Quelle |
|---|---|---|
| **Gebündelt** in die Produktionsseite (offline aus `adaptive-learner-content@main`) | **28 Sets, 325 Lektionen, 2 Bereiche** (language, software) | README CONTENT-STATS, selbstheilend im Deploy |
| **Live registriert** über alle 8 Quellen (Laufzeit-Entdecken) | **45 Sets, 551 Lektionen** | EXP-048, live 2026-08-01 |

Der Auftrag nennt "achtundzwanzig Sets" - das ist die **gebündelte** Zahl (die
offizielle Quelle, `trust_level 3`), und sie ist korrekt. Die 45 sind der
gesamte Entdecken-Katalog inklusive Community-Quellen.

**Drift-Befund (eigenständiger Befund dieser Fassung, #2403):** Die
SEO-Metadaten behaupten eine dritte Zahl. `index.html`
sagt an zwei Stellen "26 Content-Sets in 10 Sprachen" (Meta-Beschreibung und
JSON-LD), die Hilfe-Seiten sagen "26 Content-Sets - 424 Lektionen", die README
sagt 28. Vier Zahlen in vier Dateien, alle in öffentlich ausgeliefertem Text.
Das ist genau der Fall, den die Regel "Doc values: read from code, not from
memory" verbietet: eine fest verdrahtete Zahl, die driftet. Die SEO-Beschreibung
ist die sichtbarste davon, weil sie als Suchtreffer-Ausriss erscheint. Gemessen
(Engine-Fassung): 28 Sets, 9 Ziel- aus 4 Quellsprachen - der Claim "26 Sets in
10 Sprachen" ist doppelt falsch. **Entschieden (Architekt):** Zahlen aus Text
ohne Gate heraushalten, mit Gate hinein - die Meta-Beschreibung liegt im
Repository und ist messbar, also greift hier die Gate-Hälfte: entweder die
Zahl entfernen oder sie an eine Prüfung gegen den gebauten Bestand hängen
(#2403).

### Der Durchsichtsstand (für Teil 3 wichtig)

Aus EXP-048, live: **42 `authored`, 3 `generated`, 0 `reviewed`.** Die drei
maschinell erzeugten, nicht durchgesehenen Sets sind `ja-a1-from-de`,
`ko-a1-from-de`, `zh-a1-from-de`, alle aus der offiziellen Quelle und damit
**gebündelt**. Das ist derselbe Bestand, den der Auftrag mit "drei Sets
maschinell erzeugt und nicht durchgesehen" meint.

---

## Teil 2: Drei Zielgruppen, drei Antworten

### Zielgruppe 1: Nutzer, die eine Lernanwendung suchen

Sie suchen nach der Sache ("Sprachlern-App KI kostenlos offline"), nicht nach
dem Namen. **Zielseite:** die Produktions-Landeseite
`astrapi69.github.io/adaptive-learner/`.

**Was dort ist:** ein reicher statischer `<head>` (#1104), der einem Crawler
Titel, Beschreibung und JSON-LD liefert. Das reicht für *einen* ordentlichen
Suchtreffer-Ausriss, wenn die Seite überhaupt indiziert wird.

**Was fehlt:** sichtbarer, crawlbarer Text im `<body>`. Die eine indizierbare
Seite hat kein indizierbares Inhaltswort außerhalb der Meta-Tags. Wer nach
"Sprachen lernen mit Fehlerwiederholung" sucht, findet nichts, weil dieser Satz
nirgends im ausgelieferten HTML steht, nur in der clientseitig gerenderten
Oberfläche. Ein Suchtreffer entsteht aus Text auf der Seite, nicht aus einer
App, die den Text erst nach dem Laden zeichnet.

**Konsequenz:** Die größte Einzelwirkung für diese Zielgruppe ist eine
tatsächliche Landeseite mit crawlbarem Prosatext (was das Produkt ist, für wen,
die sieben Lernmodi als Wörter, nicht als React-Komponenten). Das ist die
einzige Stelle, an der sich Prerender lohnt, und nur an dieser Stelle.

### Zielgruppe 2: Lernende, die Inhalte suchen

Sie suchen nach einem Thema oder einem Sprachpaar ("Japanisch A1 Anfänger",
"Hundetraining Lektionen"). **Zielseite:** existiert heute nicht. Die 28
gebündelten (bzw. 45 registrierten) Sets liegen als Dateien in Repositories, die
niemand als Seite liest.

**Was fehlt:** eine lesbare öffentliche Ansicht der Sets. Ob und wie weit sie
gehen soll, ist die eigentliche Frage und der Gegenstand von Teil 3. Der
Entdecken-Bereich der App (EXP-048) löst das *innerhalb* der App vorbildlich,
aber er ist clientseitig und damit für Suchmaschinen unsichtbar, genau wie der
Rest der App.

**Konsequenz:** Diese Zielgruppe ist die aufwändigste und zugleich die, in der
der Architekten-Auftrag "die Lerninhalte sollen gefunden werden" konkret wird.
Teil 3 behandelt sie allein.

### Zielgruppe 3: Entwickler und Mitwirkende

Sie suchen nach einer Technik oder einem Problem ("PluginForge Hook", "Dexie
Storage Modus") und landen in der Doku oder im Repository. **Zielseite:** die
Doku unter `/docs/` und die README.

**Was fehlt:** am wenigsten. Die Doku ist echtes statisches HTML in acht
Sprachen, bereits indizierbar. Zwei kleine Lücken: die Doku-Sitemap ist nicht
von der Wurzel-`robots.txt` verlinkt (#2405), und es fehlt eine
Sprachauszeichnung (hreflang, #2406), damit ein deutscher Sucher die DE-Seite
und ein englischer die EN-Seite bekommt statt der jeweils falschen.

**Konsequenz:** Geringster Aufwand, schon fast erreicht. Die Arbeit hier ist
Feinschliff, kein Fundament.

---

## Teil 3: Die Inhalte (der schwierige Teil)

Der Architekt will, dass die Lerninhalte gefunden werden. Das ist mehr als eine
Sitemap, weil es eine Produktentscheidung berührt.

### Granularität: was soll gefunden werden

Drei Stufen, mit Aufwand um Größenordnungen auseinander:

| Stufe | Was gefunden wird | Datenquelle | Aufwand |
|---|---|---|---|
| Set | "Japanisch A1, 12 Lektionen" | `search-index.json` (trägt Sets) | klein |
| Lektion | einzelne Lektion mit Inhalt | die Lektionsdateien selbst | groß |
| Thema | quer über Sets, z. B. "Präteritum" | existiert heute nirgends | offen |

**Wichtige Datengrenze:** Der Suchindex trägt **nur Sets** (`lesson_count`,
keine Lektionstitel) - das hat EXP-048 (Teil 7) bereits festgestellt. Set-Seiten
sind damit billig aus vorhandenen Metadaten erzeugbar; Lektionsseiten
erfordern, die Lektionsdateien selbst zu lesen und ihren Inhalt auszugeben. Die
Themen-Granularität gibt es in den Daten heute gar nicht und ist ohne
Index-Wechsel nicht erreichbar.

### Erzeugungsweg, und die Produktfrage

Zwei Wege, die sich in genau der Produktfrage unterscheiden:

- **Aus dem Suchindex: Übersichtsseiten (Set-Ebene).** Titel, Sprache, Niveau,
  Bereich, Lektionszahl, plus ein Verweis "in der App öffnen". Das ist
  **produktneutral**: es bewirbt den Inhalt, gibt ihn aber nicht preis. Wer die
  Seite liest, weiß, dass es das Set gibt, und muss die App öffnen, um es zu
  lernen. **Aufstellung aus der Engine-Fassung, was dafür schon da ist:** jedes
  Content-Repository veröffentlicht bereits eine `search-index.json` mit
  Set-Id, Titel, Beschreibung, Sprachen, Niveau, Bereich, Zählern,
  `visibility` und `review_status`; die Registry (`recommended-repos.json`)
  enumeriert die Repositories. Ein Generator über die Registry erzeugt damit
  die komplette Set-Ebene - **keine neuen Daten, keine Schema-Änderung, keine
  Arbeit in den Inhalts-Repositories** (die Engine-Fassung führt unter
  "Registered needs" für die Content-Repos ausdrücklich: keine).
- **Aus den Lektionsdateien: vollständige Seiten (Lektions-Ebene).** Das
  bedeutet, die Lerninhalte öffentlich lesbar zu machen. **Die Produktfrage,
  ausdrücklich benannt:** Wer die Lektion als Seite liest, braucht die App nicht
  mehr für den Inhalt, nur noch für das Üben (Fehlerwiederholung, Spaced
  Repetition, die sieben Modi). Das kann gewollt sein (Reichweite, Vertrauen,
  "erst lesen, dann üben") oder unerwünscht (der Inhalt ist das, was die Leute
  zurückbringt). Beide Seiten standen hier zunächst offen.

**Entschieden (Architekt, 2026-08-05): die Mittelposition.** Veröffentlicht
werden nur die **Theoriestufen**, nicht die Antworten. Aus der Engine-Fassung
übernommen, wie das ableitbar ist: `type: "theory"`-Stufen tragen die Prosa;
`accept`, `pairs` und `blanks` tragen die Antworten und bleiben
unveröffentlicht. Das erhält den Grund, warum jemand die App braucht (die
Übungsschleife samt Fehlerwiederholung), und gibt trotzdem etwas
Auffindbares - ableitbar aus dem Schema, ohne Arbeit in den
Inhalts-Repositories.

Reihenfolge unverändert: Set-Übersichtsseiten zuerst. Sie lösen die
Auffindbarkeit für Zielgruppe 2 zum großen Teil (der Sucher findet, dass es
"Japanisch A1" gibt und wo); die Theoriestufen-Ebene folgt als eigener
Vorgang danach.

### Umgang mit den ungeprüften Sets

Drei Sets sind `generated` und nicht durchgesehen (`ja/ko/zh-a1-from-de`). Sie
öffentlich auffindbar zu machen, während die App sie als ungeprüft kennzeichnet
(EXP-048, Teil 3), wäre widersprüchlich: der Suchtreffer würde etwas bewerben,
das die App selbst mit einem Vorbehalt zeigt.

**Entschieden (Architekt, 2026-08-05): Ausnehmen.** Ungeprüfte Sets erhalten
keine öffentliche Seite, bis `review_status` auf `reviewed` steht. Begründung:
ein Suchergebnis trägt kein Abzeichen - öffentliche Auffindbarkeit wäre ein
Widerspruch zur Kennzeichnung in der Anwendung. Der Filter existiert bereits
im Index (`review_status`, und dieselbe Regel deckt `visibility: hidden` für
Demo- und Beispiel-Sets). Der benannte Preis bleibt benannt: gerade zu
Japanisch, Koreanisch und Chinesisch gibt es heute nur diese Sets (EXP-048),
deren Auffindbarkeit entfällt damit vorerst. Die verworfene Alternative
(kennzeichnen + `noindex`) bleibt dokumentiert, ist aber nicht der Weg.

Die Entscheidung setzt voraus, dass der Durchsichtsstand überhaupt am
erzeugenden Code ankommt. Das ist **#2299** (`review_status` fällt heute beim
Parsen auf den Boden) und damit eine **Vorbedingung**, dieselbe, die EXP-048
als Stufe 0 führt. Ohne #2299 kann eine öffentliche Seite den Zustand nicht
einmal lesen - die Entscheidung hängt an diesem Vorgang.

### Wo entstehen die Seiten (angemeldeter Bedarf, keine Entscheidung)

Drei mögliche Orte, jeder mit einer Hoheitsfrage:

- **In der App-Auslieferung** (dieser Auslieferungslauf, `deploy-gh-pages.yml`).
  Der Lauf checkt das Inhalte-Repository ohnehin aus, um Inhalte zu bündeln; aus
  demselben Checkout Set-Übersichtsseiten zu erzeugen, bliebe in der Hoheit
  *dieses* Repositories. Naheliegend für die Set-Ebene.
- **In den Inhalte-Repositories.** Berührt die Hoheit über die Content-Repos
  (`astrapi69/adaptive-learner-content` u. a.), die für dieses Repository fremd
  sind. **Bedarf anmelden statt entscheiden.**
- **An einem dritten Ort.** Eigene Auffindbarkeits-Auslieferung; am meisten
  Freiheit, am meisten laufender Aufwand.

Empfehlung als Vorschlag: die Set-Ebene in der App-Auslieferung erzeugen, weil
sie dort in eigener Hoheit bleibt und den vorhandenen Content-Checkout nutzt.
Alles, was die Lektionsinhalte selbst betrifft, berührt die Content-Repo-Hoheit
und wird angemeldet, nicht gebaut.

---

## Teil 4: Die Umsetzungsfragen danach

Erst wenn Teil 1 bis 3 stehen, sind diese sinnvoll. Was heute fehlt oder klemmt:

- **Sitemap je öffentlichem Ort, erzeugt statt gepflegt.** Die App-Sitemap ist
  handgepflegt, driftet (Stand 2026-06-24) und listet mit `/content` eine Seite,
  die es als indizierbare Seite nicht gibt. Sinnvoll wird eine erzeugte Sitemap
  erst, wenn es echte Adressen zu listen gibt (die Set-Übersichtsseiten aus Teil
  3). Die Doku-Sitemap wird von MkDocs schon erzeugt, ist aber nicht
  angekündigt.
- **Robots, besonders für die Vorschau.** Die Vorschau
  (`adaptive-learner-content-test`) trägt heute `robots: index, follow` und ist
  eine Staging-Kopie der Produktion. Sie sollte `noindex` sein. Der Canonical
  auf die Produktion mildert die Doppelung, ersetzt die Sperre aber nicht.
- **Metadaten für Vorschauen beim Teilen.** Bereits vorhanden (Open Graph +
  Twitter-Card, #1104) für die Landeseite. Für künftige Set-Seiten müssten
  eigene OG-Werte je Seite entstehen, sonst tragen alle denselben Ausriss.
- **Strukturierte Daten.** Heute `WebApplication` (passend für die App). Für
  Set-Übersichtsseiten gibt es passendere schema.org-Typen (`Course`,
  `LearningResource`); das lohnt erst, wenn diese Seiten existieren.
- **Sprachauszeichnung (hreflang, #2406).** Die Inhalte sind mehrsprachig, die
  Doku ist achtsprachig. Ohne hreflang bekommt ein englischer Sucher unter Umständen die
  deutsche Seite. Die App-Landeseite trägt `og:locale` + Alternate, aber keinen
  `hreflang`-Verweis (es gibt auch nur eine Adresse). Für die Doku und spätere
  Set-Seiten ist hreflang die richtige Auszeichnung.

---

## Teil 5: Umsetzungsschritte, nach Wirkung geordnet

Jede Zeile ist ein Vorschlag mit Aufwandsschätzung, keine Zusage. Reihenfolge
nach Wirkung je Aufwand.

| # | Schritt | Zielgruppe | Aufwand | Wirkung |
|---|---|---|---|---|
| 1 | Feste Set-Zahl aus den SEO-Metadaten (`index.html` Meta + JSON-LD) und den Hilfe-Seiten lösen: entfernen oder an eine Prüfung hängen (**#2403**) | alle | klein | hoch (Vertrauen; verhindert falschen Ausriss) |
| 2 | Vorschau-Auslieferung auf `noindex` setzen (eigene `robots.txt`/Meta im Preview-Build, **#2404**) | - | klein | mittel (hält Staging aus dem Index) |
| 3 | Wurzel-`robots.txt` um die Doku-Sitemap ergänzen; App-Sitemap um die tote `/content`-Zeile bereinigen (**#2405**) | 2, 3 | klein | mittel |
| 4 | hreflang für die Doku, acht Sprachen (**#2406**) | 3 | klein bis mittel | mittel |
| 5 | Echte Landeseite mit crawlbarem Prosatext (prerender nur dieser einen Seite) | 1 | mittel | hoch (die einzige indizierbare Seite bekommt Inhalt) |
| 6 | Set-Übersichtsseiten aus `search-index.json`, in der App-Auslieferung erzeugt, OHNE die ungeprüften Sets (Entscheidung Teil 3; setzt #2299 voraus) | 2 | mittel | hoch (löst Zielgruppe 2 produktneutral) |
| 7 | Erzeugte Sitemap über die neuen Set-Seiten, plus `Course`/`LearningResource`-JSON-LD je Set-Seite | 2 | klein bis mittel | mittel (sobald 5/6 stehen) |
| 8 | Theoriestufen-Seiten je Lektion (entschiedene Mittelposition, Teil 3: Prosa ja, Antworten nein) | 2 | groß | hoch |

**Kleinster erster Wurf mit spürbarer Wirkung:** die Schritte 1 bis 4, als
eigene Vorgänge angelegt (2026-08-05): **#2403, #2404, #2405, #2406** - drei
davon in Minuten erledigt, einer (#2404) ein echter Fehler. Sie brauchen keine
neue Seite und keinen Eingriff in fremde Repositories; sie räumen die
vorhandene Drift auf, halten Staging aus dem Index und richten die schon
indizierbare Doku sauber aus. Schritt 5 und 6 sind der eigentliche Hebel und
je ein eigener Vorgang; Schritt 8 folgt der eingetragenen Mittelposition.

---

## Teil 6: Was ausdrücklich nicht sinnvoll ist, und warum

- **Jetzt eine Sitemap bauen.** Es gibt keine echten Inhaltsadressen zu listen.
  Die vorhandene Zwei-Zeilen-Sitemap verspricht mit `/content` bereits eine
  Seite, die als Seite nicht existiert. Eine Sitemap wird erst mit den
  Set-Seiten (Schritt 6) sinnvoll; vorher listet sie Hüllen.
- **Die installierte lokale App für Suchmaschinen erschließen.** Sie ist seit
  der Bindungsumstellung auf Loopback gebunden und damit strukturell
  unerreichbar. Das ist korrekt und kein Ziel dieses Dokuments.
- **Rohe Inhaltsdateien (JSON/YAML) indizieren lassen.** Das sind keine lesbaren
  Seiten, GitHub liefert sie `noindex` aus, und als Suchtreffer wären sie
  wertlos. Auffindbarkeit entsteht aus erzeugten Seiten, nicht aus rohen Daten.
- **Die ganze SPA vorab erzeugen (SSR).** Die App ist ein interaktives Werkzeug,
  keine Inhaltsseite. Nur die Landeseite (Schritt 5) und die Set-Seiten (Schritt
  6) müssen crawlbar sein; den App-Rumpf vorab zu erzeugen ist teuer und ohne
  Gegenwert.
- **Vollständige Lektionsseiten samt Antworten bauen.** Die Produktfrage ist
  entschieden (Teil 3, Mittelposition): Theoriestufen ja, Antworten nein.
  Eine Umsetzung, die `accept`/`pairs`/`blanks` mit veröffentlicht, stünde
  gegen die Entscheidung, nicht nur gegen eine Empfehlung.
- **In fremde Repositories oder ins Schema eingreifen.** Die Content-Repos sind
  für dieses Repository fremd; die Erzeugung von Set-Seiten dort und jede
  Feldergänzung sind angemeldeter Bedarf (Teil 3, Teil 4), keine Entscheidung.

---

## Teil 7: Fragen und Annahmen

- **Aus dem Repository beantwortet:** Das SEO-Grundgerüst ist vorhanden und
  ausgeliefert (#1104, geschlossen 2026-06-24) - Meta, Open Graph, Twitter-Card,
  JSON-LD, Canonical, `robots.txt`, `sitemap.xml`. Grundlage:
  `frontend/index.html` und `frontend/public/` im Arbeitsbaum.
- **Aus dem Repository beantwortet:** Es gibt zwei App-Auslieferungen
  (Produktion auf `main`, Vorschau auf `develop` in das content-test-Repo) plus
  die Doku im selben Produktions-Artefakt unter `/docs/`. Grundlage:
  `deploy-gh-pages.yml`, `deploy-preview.yml`, `mkdocs.yml`.
- **Zahl aufgelöst:** Der Auftrag nennt "28 Sets"; das ist die gebündelte
  offizielle Quelle (README CONTENT-STATS: 28 Sets, 325 Lektionen, 2 Bereiche),
  nicht der volle Entdecken-Katalog (45 Sets über 8 Quellen, EXP-048). Beide
  Zahlen sind gemessen und messen Verschiedenes. Die SEO-Metadaten führen eine
  dritte, veraltete Zahl (26), was Schritt 1 begründet.
- **Gemessene Ausgangslinie, mit Einschränkung:** Weder Namens- noch
  `site:`-Suche förderte die Auslieferung zutage (2026-08-05). Das verfügbare
  Suchwerkzeug ist US-beschränkt und keine Google Search Console; die Aussage
  ist "kein Beleg für Indizierung gefunden", nicht "nachweislich nicht
  indiziert". Eine belastbare Ausgangslinie braucht Zugriff auf die Search
  Console des Eigentümers und ist hier nicht herstellbar - für die nächste
  Sitzung mit diesem Zugriff vermerkt.
- **Ursprüngliche Annahme, durch Entscheidung überholt:** Die frühere Annahme
  (sichtbar mit Kennzeichnung plus `noindex`) ist durch die
  Architekten-Entscheidung ersetzt: ungeprüfte Sets bleiben ganz draußen, bis
  `review_status` auf `reviewed` steht (Teil 3). #335 gilt weiter für die
  App-Oberfläche; ein Suchtreffer kann die dort gezeigte Kennzeichnung aber
  nicht transportieren, deshalb ist Ausnehmen dort kein Verstecken.
- **Vorbedingung, übernommen:** Set-Seiten mit Durchsichtsstand setzen #2299
  voraus (`review_status` kommt am Parser an), dieselbe Stufe 0 wie in EXP-048.
- **Entschieden (2026-08-05):** Die Lektions-Ebene wird als Mittelposition
  öffentlich: nur die Theoriestufen, keine Antworten (Teil 3). Die frühere
  Parkung ist damit aufgelöst.
- **Geparkt:** Wo genau entstehen künftige Set-Seiten (App-Auslieferung vs.
  Content-Repo)? Berührt fremde Repo-Hoheit; als Bedarf angemeldet, nicht
  entschieden.

## Bewertung

Der teuerste Fehler wäre, sofort eine Sitemap oder Prerender-Maschinerie zu
bauen, ohne die drei Flächen zu trennen: die Doku ist schon crawlbar, die
Vorschau soll gar nicht in den Index, und die App liefert eine leere Hülle, an
der eine Sitemap nichts ändert. Die billige und sofort fällige Arbeit ist
Aufräumen (Schritte 1 bis 4): die driftende Set-Zahl aus dem öffentlichen Text
nehmen, die Staging-Kopie sperren, die schon indizierbare Doku sauber ausrichten.
Der eigentliche Hebel für den Architekten-Auftrag - dass die Lerninhalte
gefunden werden - ist die Set-Übersichtsseite (Schritt 6); die Lektions-Ebene
folgt danach in der entschiedenen Mittelposition (Schritt 8: Theoriestufen ja,
Antworten nein).
