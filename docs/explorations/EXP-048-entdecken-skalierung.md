# EXP-048: Entdecken bei wachsender Bibliothek

**Kategorie:** Feature (Content-Discovery) · **Phase:** Analyse (keine
Umsetzung in diesem Dokument) · **Priorität:** P2 (kein Blocker; der billige
Zeitpunkt ist jetzt, solange die Bibliothek noch ausprobierbar ist) ·
**Abhängig von:** EXP-034 / #736 (Entdecken-Seite), #1343 + #1699
(Quellsprach-Facette), #1246 (Such-/Filterleiste), EXP-023
(Multi-Content-Repository) · **Issue:** #2297 (Sammel-Vorgang)

> Explorationsdokument. Kein Code, kein Schema-Eingriff, nur Messung, Entwurf
> und angemeldeter Bedarf. Entdecken zeigt heute alle Sets einer Quelle in
> einer Liste. Das trägt bei der heutigen Größe, aber der Bereich existiert,
> damit die Bibliothek wächst. Die eigentliche Frage ist nicht "welche Filter
> fehlen", sondern: die zwei Aufgaben, für die Nutzer herkommen, sind
> gegenläufig, und eine Leiste für beide wird für beide mittelmäßig.

---

## 0. Kernbefund vorweg

**Der Katalog zerfällt in zwei Populationen, und die Trennung liegt bereits
sauber in den Daten.** Gemessen an allen 45 live veröffentlichten Sets:

| Population | Merkmal | Sets | Quelle == Ziel | Niveau |
|---|---|---|---|---|
| Sprachsets | `domain == "language"` | 27 | 0 von 27 | immer CEFR |
| Wissenssets | `domain != "language"` | 18 | 18 von 18 | Freitext, teils Müll |

Kein einziger Mischfall. Damit ist der Diskriminator für die zwei Einstiege
schon vorhanden und braucht keine Schemaänderung; er ist allerdings eine
Datenkonvention, keine Schemazusage (siehe Teil 6).

Zwei weitere Befunde, die den Entwurf mitbestimmen:

- **Die Zielsprache ist heute nicht filterbar.** `target_language` steht in
  45 von 45 Einträgen, aber `DiscoverFilters` kennt nur `sourceLanguage`
  ([discover-index.ts:50-64](../../frontend/src/lib/content/repos/discover-index.ts#L50-L64)).
  Die Aufgabe "Sprachkombination finden" ist heute also gar nicht lösbar,
  nicht nur schlecht gelöst.
- **Der Durchsichtsstand steht im Index, und die App wirft ihn weg.**
  `review_status` liegt in 45 von 45 Einträgen; `normalizeSet`
  ([search-index-loader.ts:142-180](../../frontend/src/lib/content/repos/search-index-loader.ts#L142-L180))
  liest das Feld nicht, es fällt beim Parsen auf den Boden. Das ist ein
  Datenpfad-Fehler, keine Oberflächenfrage, und deshalb ein eigener Vorgang
  (#2299), der nicht auf diesen Entwurf wartet: die Kette hat zwei Stellen,
  an denen eine gesetzte Kennzeichnung verschwinden kann - den
  Indexgenerator (in der Engine-Spur bereits einmal aufgetreten) und diesen
  Parser - und beide waren blind.

## Teil 1: Welche Merkmale tragen tatsächlich

### Messmethode

Gemessen am 2026-08-01 gegen die **live veröffentlichten** Indizes, nicht
gegen den lokalen Arbeitsbaum: `recommended-repos.json` von
`astrapi69/adaptive-learner-content@main` gelesen, daraus je Eintrag
`search-index.json` am gepinnten Commit geholt (die offizielle Quelle
branchverfolgt), genau wie `collectDiscoveryRepos` es tut. Das Skript liegt im
Arbeitsverzeichnis der Sitzung und ist in fünf Zeilen reproduzierbar; die
Zahlen unten sind Ausgabe, keine Schätzung.

**Erhoben: 8 Quellen, 45 Sets, 551 Lektionen.** Der Auftrag nannte
siebenundvierzig Sets über zehn Quellen, und die Engine-Spur hat am selben Tag
47 von 47 über alle Repositories gemeldet. Beide Zahlen sind gemessen, sie
messen Verschiedenes, und der Unterschied ist aufgelöst (siehe unten): es
fehlt nichts im Entdecken-Bereich.

### Die zwei fehlenden Quellen: aufgelöst, kein Verlust

Der Kontostand kennt neun Inhalte-Repositories plus die offizielle Quelle.
Acht davon stehen in der Registry, zwei nicht:

| Repository | Sets | in Registry | in Entdecken | warum |
|---|---|---|---|---|
| `adaptive-learner-content-test` | 1 (`graded-quiz-demo-from-de`) | nein | nein | Das Set steht auf `visibility: hidden`. Selbst bei Registrierung würde `normalizeSet` es beim Parsen verwerfen - genau der Mechanismus aus #1702 / #1707. |
| `adaptive-learner-content-template` | 1 (`example-set`) | nein | nein | Gerüst-Vorlage, kein Lerninhalt. |

45 plus diese zwei ergibt 47, acht plus diese zwei ergibt zehn. Die
Engine-Spur zählt alle Repositories, die App liest die registrierten - die
Differenz ist genau die beabsichtigte Auslassung, kein blinder Fleck.

**Ein Nebenbefund fällt dabei an:** `example-set` steht auf `visibility:
visible`. Für das Template folgenlos, solange es nicht registriert ist; wer
aber ein eigenes Repository daraus erzeugt und registrieren lässt, bewirbt
zuerst das Beispiel-Set. Angemeldet als
astrapi69/adaptive-learner-content-template#42.

### Abdeckung je Merkmal

| Merkmal | belegt | Anteil | taugt als Filter |
|---|---|---|---|
| `id`, `name` | 45/45 | 100 % | Identität, kein Filter |
| `source_language` | 45/45 | 100 % | ja, ist heute die Achse |
| `target_language` | 45/45 | 100 % | **ja, fehlt heute** |
| `level` | 45/45 | 100 % | nur für Sprachsets (siehe unten) |
| `domain` | 45/45 | 100 % | ja, als Einstieg |
| `lesson_count`, `card_count` | 45/45 | 100 % | Anzeige, Sortierung |
| `tags` | 45/45 | 100 % | Suchtext, kein eigener Filter |
| `visibility` | 45/45 | 100 % | Systemfeld, wird beim Parsen angewandt |
| `review_status` | 45/45 | 100 % | ja, siehe Teil 3 |
| `trust_level` | 45/45 | 100 % | schwach (nur zwei Werte belegt) |
| `ai_validated` | 45/45 | 100 % | **untauglich: 1 von 45 ist `true`** |
| `updated_at` | 45/45 | 100 % | Sortierung "Neueste" |
| `description` | 44/45 | 98 % | Suchtext |
| `book` | 3/45 | 7 % | Anzeige, kein Filter |

Kein Merkmal fällt unter die Vollabdeckung, weil der Generator jedes Feld
schreibt. Die Abdeckung sagt hier also wenig; die **Verteilung** entscheidet.

### Verteilung

**Quellsprache** (die heutige Standardachse): de 33, en 9, hi 2, el 1. Ein
deutschsprachiger Nutzer sieht im Standardzustand 33 Sets, ein englischer 9.

**Sprachpaar:** 14 belegte Zellen, 5 davon mit genau einem Set.

| Paar | Sets | Paar | Sets | Paar | Sets |
|---|---|---|---|---|---|
| de -> de | 18 | de -> fr | 3 | de -> ko | 1 |
| en -> es | 4 | de -> ja | 2 | de -> pt | 1 |
| de -> en | 3 | en -> de | 2 | de -> zh | 1 |
| de -> es | 3 | hi -> en | 2 | el -> fr | 1 |
| en -> fr | 3 | de -> it | 1 | | |

**Bereich:** language 27, dog-training 6, programming 3, psychology 2,
technology 2, ai 2, software 1, philosophy 1, traffic-knowledge 1. Für einen
deutschsprachigen Nutzer: 15 Sprachsets und 18 Wissenssets über 8 Bereiche.

**Niveau:** a1 20, a2 12, b1 8, b2 2, dazu `a0`, `einsteiger`, `reflexion`
mit je 1. Die letzten drei sind keine Stufen einer Skala, sondern Freitext
aus verschiedenen Quellen. Da `availableLevels` die Optionen aus den Daten
zieht, bietet die Niveau-Facette diesen Text heute als gleichwertige Option an.

**Vertrauen:** 28 Sets auf 3, 17 auf 1, nichts auf 2. Ein Dreistufenfilter
über zwei belegte Werte trennt nur "offiziell" von "Rest".

**KI-geprüft:** 44 nein, 1 ja. Ein Filter, der 44 von 45 Ergebnissen
wegwirft oder gar nichts tut, ist keiner. Er belegt heute einen der fünf
Plätze in der Filterleiste.

**Beschriftungen:** `discover.domain.*` übersetzt vier Bereiche (language,
ai, psychology, programming). Die restlichen fünf erscheinen als roher
Bezeichner, also "dog-training" statt "Hundetraining", in allen 11 Katalogen.

## Teil 2: Die Entwurfsfrage

### Entscheidung

**Zwei Einstiege, eine Liste, eine Filtermenge.** Die Einstiege sind
Vorbelegungen über demselben Ergebnisraum, keine zwei Seiten und keine zwei
Routen. Die Quellsprache bleibt als Achse über beiden Einstiegen stehen, weil
sie in beiden Aufgaben gilt: Ein Nutzer kann kein Material verwenden, dessen
Erklärsprache er nicht liest. Der Einstieg wählt also nicht die Sprache,
sondern die **zweite Achse**:

- Einstieg "Sprache lernen" (Sprachsets): zweite Achse = Zielsprache, danach
  Niveau als Verfeinerung.
- Einstieg "Fachgebiet" (Wissenssets): zweite Achse = Bereich, kein Niveau.

### Begründung

1. **Die Daten trennen sich vollständig** (18 von 18 Wissenssets mit Quelle
   == Ziel, 27 von 27 Sprachsets mit Quelle != Ziel). Eine Vorbelegung kann
   also exakt sein statt heuristisch.
2. **Die Achsen sind wechselseitig bedeutungslos.** Innerhalb der Sprachsets
   hat `domain` genau einen Wert; innerhalb der Wissenssets ist die
   Zielsprache identisch mit der Quellsprache und das Niveau Freitext. Eine
   gemeinsame Leiste zeigt also in jeder Aufgabe drei Bedienelemente, von
   denen zwei nichts bewirken. Das ist die heutige Lage.
3. **Reihenfolge statt Gleichrangigkeit löst es nicht.** Man könnte
   argumentieren: erst das Paar, dann das Fachgebiet. Für die
   Fachgebiet-Aufgabe wäre die erste Stufe dann eine Pflichtwahl über eine
   Achse, die dort keine Information trägt (Ziel == Quelle).

### Benannte Nachteile

1. **Die Vorbelegung verdrahtet eine Konvention, keine Zusage.** `domain ==
   "language"` ist heute in 45 von 45 Fällen korrekt, aber das Schema
   erzwingt es nicht. Gegenmaßnahme: der Einstieg ist eine Vorbelegung, keine
   Partition; es bleibt ein Zustand "Alles", und die Konvention wird durch
   einen Test gegen das Fixture festgehalten, damit ein Mischfall auffällt
   statt zu verschwinden.
2. **Ein echter Mischfall fällt zwischen die Stühle.** "Spanisch für
   Programmierer" wäre ein Sprachset mit Fachgebiet. Es landet im
   Sprach-Einstieg und ist im Fachgebiet-Einstieg nur über die Textsuche
   auffindbar, bis das Schema für Sprachsets ein Sachgebiet trägt (Teil 6).
3. **Ein Einstieg kann leer sein.** Für el gibt es heute 1 Sprachset und 0
   Wissenssets. Gegenmaßnahme: Der Einstieg trägt seine Trefferzahl,
   berechnet aus den geladenen Daten; ein leerer Einstieg zeigt die Null und
   den Ausweg, statt ins Nichts zu führen.
4. **Ein Schritt mehr vor dem ersten Ergebnis.** Gegenmaßnahme: Der Einstieg
   ist vorbelegt (zuletzt gewählter, sonst Sprache lernen) und wird wie die
   Quellsprache persistiert, analog #1343. Wer nichts wählt, sieht sofort
   eine Liste.

### Was ausdrücklich nicht gewählt wurde

- **Zwei Seiten oder zwei Reiter.** Verdoppelt die Navigation, teilt die
  Textsuche und macht den Mischfall unerreichbar.
- **Eine Leiste mit allen Facetten.** Der heutige Zustand: fünf
  Bedienelemente, von denen je nach Aufgabe zwei bis drei folgenlos sind.
- **Ein Assistent mit Pflichtschritten.** Für einen Katalog, der auch bei
  Wachstum in Sekunden überblickbar bleiben soll, ist ein erzwungener
  Mehrschritt-Dialog zu teuer.

## Teil 3: Durchsichtsstand sichtbar machen

### Was das Feld ist

`review_status` auf `ContentSet`, Engine-Schema 1.9
(learn-content-engine v0.16.0, angemeldeter Bedarf
learn-content-engine#94). Drei Zustände, abgeleitet aus der **Herkunft**:
`authored` (von einem Sprecher oder Fachkundigen geschrieben, keine Durchsicht
nötig; auch die Bedeutung eines fehlenden Feldes), `generated`
(maschinell erzeugt, Durchsicht offen), `reviewed` (maschinell erzeugt und
durchgesehen). `ContentSetEntry` projiziert das Feld normalisiert in den
Index.

**Live-Verteilung:** 42 `authored`, 3 `generated`, 0 `reviewed`. Die drei
sind `ja-a1-from-de`, `ko-a1-from-de`, `zh-a1-from-de`, alle aus der
offiziellen Quelle.

**Wichtige Einschränkung:** Nur diese drei Sets **erklären** ihren Zustand im
Manifest; die übrigen 42 tragen `authored`, weil das Feld fehlt und der
Generator den Standard einsetzt. Die App kann "als handgeschrieben erklärt"
und "nichts gesagt" nicht unterscheiden, und das ist eine bewusste
Engine-Entscheidung, keine Lücke der App. Folge für die Darstellung: aus
`authored` darf keine Aussage abgeleitet werden, die stärker ist als
"kein Hinweis auf Maschinenherkunft".

### Vorschlag

**Beides, Merkmal am Eintrag und Facette, aber asymmetrisch.**

- `generated`: neutrales Abzeichen am Eintrag, Wortlaut in Richtung
  "Maschinell erstellt, noch nicht durchgesehen". Neutrale Darstellung
  (`secondary`, wie das Vertrauens-Abzeichen), kein Warnrot, kein
  Warndreieck. Der Eintrag bleibt sichtbar, herunterladbar und normal
  sortiert; verstecken wäre der falsche Schluss aus derselben Information
  (vgl. Feature-State-Policy #335: sichtbar mit Begründung schlägt versteckt).
- `reviewed`: eigenes, positives Abzeichen. Heute nirgends belegt, aber der
  Zustand ist der Zweck der ganzen Übung, und wenn die Durchsicht läuft, ist
  das Umlegen des Feldes der Auslieferungsmechanismus.
- `authored`: **kein Abzeichen.** Abwesenheit ist kein Mangel. Ein Abzeichen
  "nicht geprüft" an einem handgeschriebenen Set wäre genau die Vermischung,
  die learn-content-engine#94 nach Rückmeldung des Maintainers vermieden hat.

**Facette:** eine Auswahl "Durchsicht" mit "Alle" / "Ohne Maschinen-Sets" /
"Nur durchgesehen", eingeblendet nur, solange der geladene Katalog überhaupt
`generated`- oder `reviewed`-Einträge enthält. Datengetrieben wie die
Bereichsliste, damit die Leiste nicht durch tote Optionen wächst.

**Nicht mit `ai_validated` verschmelzen.** Das ist ein anderer Sachverhalt
(maschinelle Prüfung ist gelaufen) und heute an genau einem Set gesetzt,
das zugleich `authored` ist. Der bessere Zug ist, die Facette "KI-geprüft"
durch die Durchsicht-Facette zu **ersetzen** und `ai_validated` nur noch als
Abzeichen zu führen; die Filterleiste gewinnt einen Platz statt einen zu
verlieren.

**Kosten app-seitig:** ein Feld in `normalizeSet`, ein Feld in
`SearchableSet` (beides #2299, Vorbedingung), ein Abzeichen in
`SetDiscoveryCard` und
`DiscoverSetListView`, eine Facette, Schlüssel in 11 Katalogen. Kein
Schema-Eingriff, kein Engine-Pin nötig: der Index wird von App-Code gelesen.
(Der Pin 0.14.0 in `frontend/package.json` betrifft die Validierung
heruntergeladener Sets; das ist #2265 und hier nicht der Weg.)

## Teil 4: Entwurf

### Ablauf, Aufgabe "Sprachkombination"

1. Ankunft: Quellsprache steht bereits (UI-Sprache oder gemerkte Wahl),
   Einstieg "Sprache lernen" ist vorbelegt, die Liste zeigt Ergebnisse.
2. Zielsprache wählen: Marken mit Zahl, nur belegte Ziele, sortiert nach
   Menge (für de heute: en 3, es 3, fr 3, ja 2, it 1, ko 1, pt 1, zh 1).
3. Verfeinern, optional: Niveau, Durchsicht, Quelle.
4. Eintrag herunterladen; der Weg nach "Meine Inhalte" wird wie heute
   angeboten.

### Ablauf, Aufgabe "Fachgebiet"

1. Ankunft wie oben, Einstieg auf "Fachgebiet" umgestellt (bleibt gemerkt).
2. Bereich wählen: Marken mit Zahl, übersetzt (heute für de: Hundetraining 6,
   Programmierung 3, Psychologie 2, Technik 2, KI 2, Software 1, Philosophie
   1, Verkehrskunde 1).
3. Verfeinern: Durchsicht, Quelle. **Kein Niveau**, weil die Werte dort
   Freitext sind.
4. Herunterladen wie oben.

### Null Treffer

Regel: Jede aktive Einschränkung ist sichtbar und einzeln entfernbar. Kein
Leerzustand ohne mindestens einen Ausweg.

- Die aktiven Facetten stehen als entfernbare Marken über der Liste (heute
  gilt das nur für die Quellsprache, alles andere verschwindet mit der
  eingeklappten Leiste).
- "Alle Filter zurücksetzen" als eine Handlung.
- Gezielte Auswege, aus den Daten berechnet, nicht als Textbaustein: "In
  Englisch gibt es dazu 3 Sets" (die heutige Quellsprachen-Rückfalltür aus
  #1343, verallgemeinert auf jede Facette), "Ohne Niveaufilter: 7 Sets".
- Wenn die Bibliothek zur Anfrage wirklich nichts hat, ist das eine eigene
  Aussage, kein Filterproblem: Hinweis auf eigene Quelle hinzufügen
  (Einstellungen) beziehungsweise auf das Anlegen einer eigenen Lektion.

### Menge

Heute wird **jeder** Treffer gerendert, ohne Obergrenze; bei 45 Sets
unauffällig. Vorschlag: in Schüben von 24 rendern, mit einem Knopf "Weitere
anzeigen"; die Trefferzahl über der Liste bleibt die volle Zahl und ist damit
weiterhin die ehrliche Auskunft. Kein Endlos-Scrollen: es macht den
Zurück-Weg kaputt und verschleiert, wie groß das Ergebnis eigentlich ist.
Keine harte Obergrenze mit Aufforderung zum Einschränken; die Filter sind
dann sichtbar genug, dass Einschränken ohnehin die naheliegende Handlung ist.

### Verhältnis zur Quellenverwaltung

**Entscheidung: Entdecken durchsucht weiterhin alle validierten Quellen der
Registry plus die eigenen Repos, unabhängig von der Quellenverwaltung.**
Begründung: Die Quellenverwaltung in den Einstellungen fügt eigene
Repositories hinzu oder entfernt sie; sie ist keine Sichtbarkeitsschaltung
für die Suche. Eine Suche, die etwas nicht findet, weil es auf einer anderen
Seite abgeschaltet wurde, ist die teuerste Form von Stille.

Zwei Ergänzungen, damit das nicht undurchsichtig wird: eine Facette "Quelle"
(die Liste der Quellen ist mit acht Einträgen kurz und wächst langsam), und
im Leerzustand ein Verweis auf die Quellenverwaltung, wenn eigene Repos
konfiguriert sind. Eine echte Schaltung "diese Quelle nicht durchsuchen"
bleibt bewusst offen, bis es dafür einen Anlass gibt.

### Telefon

Die Leiste ist bereits einklappbar (#1246): Suche und Filter schließen sich
gegenseitig aus. Die Regel für den Entwurf: **die einzige dauerhaft sichtbare
Filterfläche ist eine Zeile mit Marken** (Quellsprache, Einstieg, aktive
Facetten), waagerecht scrollbar, nicht umbrechend. Alles andere bleibt
eingeklappt. Damit kostet die Filterfläche auf dem Telefon eine Zeile statt
eines Blocks, und die Lehre aus #1699 (stilles Filtern ist schlimmer als eine
volle Leiste) bleibt eingelöst, weil jede wirksame Einschränkung in dieser
Zeile steht.

### Textsuche neben den Filtern

Beibehalten. Sie ist heute Teilstring-Suche über Name, Beschreibung und Tags
mit Normalisierung (akzent- und digraphenunempfindlich) und trägt bei dieser
Katalogröße. Zwei Punkte:

- **Eine Lücke unabhängig von der Größe:** gesucht wird nur im Text des
  Eintrags, und die Namen sind in der Erklärsprache verfasst. Wer die
  Oberfläche auf Englisch benutzt und "Spanish" eingibt, findet die
  deutschsprachigen Spanisch-Sets nicht. Die Sprachnamen in der aktuellen
  UI-Sprache in den Suchtext aufzunehmen, ist app-seitig billig
  (`languageDisplayName` existiert) und unabhängig vom Rest dieses Entwurfs.
- **Schwelle für mehr:** Rangfolge und Tippfehlertoleranz lohnen erst, wenn
  der Katalog über etwa 200 Sets liegt oder eine einzelne Quelle mehr als 50
  Sets liefert (heute: 28 aus der größten Quelle). Vorher ist die Bibliothek
  in einer Bildschirmhöhe überblickbar.
  **Schwelle bewusst überschritten (#2336):** Auf ausdrückliche
  Nutzer-Entscheidung wurde die Tippfehlertoleranz samt Rangfolge (exakte
  Treffer über reinen Tippfehler-Treffern) trotz der noch nicht erreichten
  200-Sets-Schwelle gebaut. Umgesetzt app-seitig ohne neue Abhängigkeit
  (begrenztes Levenshtein, ein Edit je Suchwort ab 4 Zeichen); der Vermerk
  steht hier, im Commit, in der PR und im Issue, damit die Abweichung nicht
  still ist.

## Teil 5: Zuschnitt

| Stufe | Inhalt | Aufwand |
|---|---|---|
| 0 | **#2299: `review_status` kommt am Parser an** (Datenpfad, unabhängig von diesem Entwurf, Vorbedingung für Stufe 1) | klein, 1 PR |
| 1 | Abzeichen + Facette für den Durchsichtsstand (ersetzt "KI-geprüft") | klein, 1 PR |
| 1 | Zielsprache-Facette mit Zahlen | klein, 1 PR |
| 1 | Aktive Facetten als entfernbare Marken, dauerhaft sichtbar | klein bis mittel |
| 1 | Bereichs-Beschriftungen für die fehlenden 5 Bereiche, 11 Kataloge | klein |
| 1 | Leerzustand: Ausweg je aktiver Facette, "alles zurücksetzen" | klein bis mittel |
| 2 | Zwei Einstiege als Vorbelegung, Niveau nur im Sprach-Einstieg | mittel, 1 PR |
| 2 | Quellen-Facette | klein |
| 2 | Sprachnamen der UI-Sprache im Suchtext | klein |
| 3 | Schubweises Rendern mit "Weitere anzeigen" | klein |
| 3 | Sprachpaar-Matrix als alternativer Einstieg | mittel, laut Entwurf erst ab etwa 30 belegten Paaren (heute 14) — Schwelle bewusst überschritten, gebaut in #2337 |
| 3 | Rangfolge und Tippfehlertoleranz | mittel, laut Entwurf erst ab etwa 200 Sets — Schwelle bewusst überschritten, gebaut in #2336 |

**Kleinster erster Wurf mit spürbarer Wirkung:** die vier ersten Zeilen der
Stufe 1. Sie brauchen keinen Indexwechsel, keinen Engine-Pin und keine
Entscheidung aus Teil 2; sie machen die Zielsprache erreichbar, den
Durchsichtsstand sichtbar und das Filtern nachvollziehbar.

**Was ohne Änderung am Suchindex geht:** alles in Stufe 1 und 2. Jedes dafür
nötige Merkmal steht bereits in 45 von 45 Einträgen.

**Was nicht geht:** ein Fachgebiet für Sprachsets, eine verlässliche
Niveauskala für Wissenssets, ein stabiles Bereichsvokabular. Siehe Teil 6.

## Teil 6: Angemeldeter Bedarf (Schema-Hoheit learn-content-engine)

Nicht app-seitig erfinden; `ContentSet` ist `additionalProperties: false`,
und die App hat mit `KNOWN_CONTENT_DOMAINS` bereits ein Ersatzvokabular, das
gepflegt werden muss, weil das Schema keines hat.

1. **Kontrolliertes Vokabular für `domain`.** Heute Freitext. Über acht
   Quellen sind neun Werte entstanden, darunter das Paar `programming` /
   `software` und das Paar `ai` / `technology`, die sich überschneiden. Ein
   Einstieg über Fachgebiete zersplittert mit jedem neuen Repository weiter.
2. **`level` für Nicht-Sprachsets.** Heute Freitext, live belegt mit `a0`,
   `einsteiger`, `reflexion` neben CEFR. Gebraucht wird entweder ein Enum
   oder ein ausdrücklicher Wert "kein Niveau", damit eine Niveaufacette nicht
   Müll als Option anbietet.
3. **Kein Bedarf** für die Trennung Sprachset / Wissensset: `domain` plus die
   Beziehung Quelle zu Ziel trägt sie heute vollständig.

Für einen späteren Mischfall (Sprachset mit Sachgebiet) wäre ein eigenes Feld
nötig; das ist heute kein Bedarf, sondern eine Beobachtung, und wird erst
angemeldet, wenn ein solches Set entsteht.

## Teil 7: Fragen und Annahmen

- **Aus dem Repository beantwortet:** Der Durchsichtsstand liegt als
  `review_status` vor (Engine-Release v0.16.0, Bedarf #94, geschlossen), drei
  Zustände, fehlend gleich `authored`. Grundlage: Release-Text und
  Live-Indizes, nicht der lokale Schema-Spiegel (der steht auf Engine 0.14.0
  und kennt das Feld noch nicht).
- **Abweichung von der Auftragszahl: aufgelöst.** Auftrag und Engine-Spur
  nannten 47 Sets über 10 Quellen, hier gemessen 45 über 8. Der Unterschied
  sind das Test- und das Template-Repository (Teil 1); im Entdecken-Bereich
  fehlt nichts. Der Vergleich der beiden Listen war die Entscheidung, nicht
  die Plausibilität.
- **Annahme, sichtbar getroffen:** Maschinell erzeugte Sets bleiben in der
  Standardansicht sichtbar und gekennzeichnet, statt standardmäßig gefiltert
  zu werden. Begründung: #335 (nichts verstecken, was dem Nutzer gehört) und
  die Tatsache, dass es zu Japanisch, Koreanisch und Chinesisch heute
  überhaupt nur diese Sets gibt. Wer sie nicht will, schaltet die Facette um.
- **Geparkt:** Braucht Entdecken eine Schaltung "diese Quelle nicht
  durchsuchen"? Heute nein (8 Quellen, keine Beschwerde). Wieder aufnehmen,
  wenn die Registry deutlich wächst oder eine Quelle als störend gemeldet
  wird.
- **Geparkt:** Soll die Trefferliste Lektionen statt Sets zeigen können? Der
  Auftrag nennt "alle Sets und Lektionen"; der Index trägt aber nur Sets
  (`lesson_count`, keine Lektionstitel). Eine Lektionssuche vor dem
  Herunterladen wäre ein Indexwechsel und damit ein eigener Bedarf. Nicht in
  diesem Entwurf.

## Bewertung

Der teuerste Fehler wäre, jetzt Facetten nachzurüsten und die Aufgabenfrage
offen zu lassen: Jede weitere Facette in einer gemeinsamen Leiste macht beide
Aufgaben langsamer. Die Trennung ist billig, weil die Daten sie bereits
hergeben, und sie ist umkehrbar, weil die Einstiege nur Vorbelegungen über
einer Liste sind.

Unabhängig davon und sofort fällig ist der Durchsichtsstand: Das Feld liegt
im Index, die App wirft es weg, und solange das so bleibt, lädt jemand ein
maschinell erzeugtes, nicht durchgesehenes Set herunter, ohne es zu erfahren.
