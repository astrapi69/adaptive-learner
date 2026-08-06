# EXP-041: Aufgabentyp-Eignung und faire Bewertung freier Eingaben

**Kategorie:** Didaktik / Übungs-Architektur / Content-Generierung
**Phase:** Analyse + Empfehlung
**Priorität:** Mittel-Hoch (Frust-Fall, Launch-relevant)
**Abhängig von:** EXP-002 (Content-Repository), EXP-007 (Übungen + SRS), EXP-013 (adaptive Generierung), EXP-036 (AI Exercise Generation Pipeline)
**Issue:** astrapi69/adaptive-learner#1222
**Status:** Analyse abgeschlossen, Empfehlung steht. Umsetzung gestaffelt: Content-Generierungs-Regel sofort, Content-Sichtung kurzfristig, Self-Assessment als eigene Folge-EXP mittelfristig.

> Dieses Dokument ist **Analyse + Empfehlung**, kein Implementierungsauftrag.
> Es klaert, welcher Aufgabentyp zu welchem Lernziel passt und wie freie
> Eingaben fair bewertet werden. Konkreter Code-Schritt mit hoechstem
> Nutzen/Aufwand-Verhältnis ist eine Content-Generierungs-Regel; ein neuer
> Self-Assessment-Aufgabentyp ist eine bewusste Roadmap-Entscheidung, kein
> Quick-Fix.

Analyse und Empfehlung für Adaptive Learner. Ausgangspunkt: eine word_tiles-Aufgabe
("Definition: Ankereffekt", Anweisung "Übersetze"), bei der ein inhaltlich korrekter
deutscher Satz Wort für Wort als falsch markiert wurde, weil er nicht der hinterlegten
Musterlösung entsprach.

Das ist kein Code-Bug. Es ist eine Fehlanwendung des Aufgabentyps, mit einer Wurzel
in der Content-Generierung. Diese Datei klärt, was Best Practice ist, und schließt mit
einer konkreten Empfehlung, getrennt nach Nutzersicht und App-/Architektursicht.

---

## 1. Das Kernproblem in einem Satz

Wörtliches String-Matching (exact-match) ist bei **freier Sprachproduktion** immer
entweder zu streng (der inhaltlich richtige Nutzer sieht alles rot, der demotivierende
Fall hier) oder, wenn man es aufweicht, zu lasch (alles geht durch, kein Lerneffekt).
Es gibt keinen mittleren Schwellwert, der beides löst. Der Fehler liegt nicht im
Algorithmus, sondern darin, welcher Inhalt ihm vorgesetzt wird.

---

## 2. Die drei Lernziel-Stufen und ihr passender Typ

Lernforschung und etablierte Apps (Duolingo, Anki, Babbel) koppeln den Aufgabentyp an
die kognitive Anforderung. Drei Stufen:

### Stufe 1 — Wiedererkennen (leichteste Stufe)
- **Typen:** Multiple-Choice, Matching, picture_choice.
- **Beispiel:** "Welche Beschreibung trifft auf den Ankereffekt zu?"
- Der Nutzer muss die richtige Antwort nur **erkennen**, nicht selbst formulieren.
- Robust automatisch bewertbar, kein Frust-Risiko. Geringster Lerneffekt pro Aufgabe,
  aber wertvoll als Einstieg und zur Auflockerung.

### Stufe 2 — Gezieltes Abrufen (mittlere Stufe) — der Sweet Spot für Definitionen
- **Typ:** cloze mit Lücken.
- **Beispiel:** "Der Ankereffekt beschreibt, dass eine zuerst genannte ___ als
  Bezugspunkt für spätere Urteile dient."
- Der Nutzer **produziert aktiv**, aber nur ein bis zwei Schlüsselbegriffe, an Stellen,
  wo es eine klar richtige Antwort gibt.
- Aktiv genug für echten Lerneffekt (aktiver Abruf), eng genug für faire Bewertung.
- **Das ist der entscheidende Hebel:** Die meisten "Definiere X"-Fälle gehören hierhin,
  nicht in freie Volltext-Eingabe.

### Stufe 3 — Freie Produktion (schwerste Stufe) — hier ist die eigentliche Frage
- **Beispiel:** "Erkläre den Unterschied zwischen Framing und Priming in eigenen Worten."
- Der Nutzer formuliert frei. Es gibt **viele richtige Formulierungen**.
- Genau hier versagt exact-match. Die Lösungsansätze siehe Abschnitt 3.

---

## 3. Vier Ansätze für freie Texteingabe (einfach bis anspruchsvoll)

### a) Vermeiden, wo möglich (die ehrlichste Best Practice)
Freie Volltext-Definitionen als automatisch bewertete Aufgabe sind fast immer die
falsche Wahl. Duolingo nutzt sie kaum, aus genau diesem Grund. Gute Apps lösen
"Definiere X" über cloze oder MC, nicht über Volltext. **Der größte Teil des Problems
verschwindet, wenn man den Inhalt dem richtigen Typ zuordnet (Stufe 1 oder 2).**

### b) Akzeptanz-Listen (der bestehende free_text mit `accept`)
Mehrere richtige Formulierungen vorab hinterlegen.
- Funktioniert gut für **kurze** Antworten (ein Wort, eine Phrase): "Hauptstadt von
  Frankreich" → akzeptiere "Paris".
- **Bricht bei ganzen Sätzen zusammen:** Man kann unmöglich alle gültigen Formulierungen
  einer Definition vorab auflisten. Für Definitionssätze untauglich.

### c) Keyword-basierte Bewertung (statt Wort-für-Wort)
Prüfen, ob die **wesentlichen Schlüsselbegriffe** vorkommen, statt exakter Übereinstimmung.
- "Der Ankereffekt..." gilt als korrekt, wenn "zuerst genannt", "Bezugspunkt" und
  "Folgeurteil" (oder Synonyme) enthalten sind, egal in welcher Formulierung.
- Deutlich fairer als exact-match.
- **Technisch anspruchsvoll:** Synonym-Handling, Stemming, Umgang mit Verneinungen.
  Bleibt unscharf, produziert Grenzfälle. Mittlerer Aufwand, mittlere Qualität.

### d) Self-Assessment (was die Profis tatsächlich machen)
Der Ansatz von **Anki** und die Empfehlung der Lernforschung für freie Antworten:
1. Nutzer schreibt (oder denkt) seine Antwort.
2. Die **Musterlösung wird gezeigt**.
3. Der Nutzer **bewertet selbst**: "Wusste ich" / "Teilweise" / "Nicht gewusst".
4. Diese Selbsteinschätzung steuert das Spaced-Repetition-Intervall.

Klingt zunächst unbefriedigend ("der Nutzer könnte schummeln"), ist aber für freie
Produktion überlegen:
- Respektiert, dass es viele richtige Formulierungen gibt.
- Vermeidet falsch-negatives Feedback (den Frust-Fall vom Screenshot).
- Der **Testing-Effekt** der Lernforschung: Schon der aktive Abrufversuch plus der
  Abgleich mit der Musterlösung bringt den Lerneffekt, unabhängig davon, wer die Note
  vergibt. Schummeln schadet primär dem Schummelnden, nicht der Bewertungslogik.
- Ehrlichste Methode, freie Antworten **fair** zu behandeln.

---

## 4. Was man NICHT tun sollte

**exact-match "toleranter" machen, damit freie Formulierungen durchgehen.**
Das ist verlockend, aber eine Falle: Man weicht die Bewertung für *alle* word_tiles auf,
auch für die, wo exact-match korrekt ist (echte Übersetzungssätze mit eindeutiger
Wortreihenfolge). Man tauscht ein sichtbares Problem (zu streng) gegen ein unsichtbares
(zu lasch, kein Lerneffekt). Das Problem ist der Inhalt, nicht der Algorithmus.

---

## 5. Die strukturelle Wurzel: Typ-Wahl in der Content-Generierung

Der Fehler ist vermutlich **kein Einzelfall**. Das Set ist KI-generiert, und der
Generator wählt Aufgabentypen nach **Abwechslung**, nicht nach **didaktischer Eignung**.
Bei konkreten Sätzen funktioniert word_tiles, bei "Definiere ein abstraktes Konzept"
entsteht genau dieser Fehler, potenziell in jeder Lektion und in jedem so erzeugten Set.

Zwei Nebenindizien stützen das:
- Die Anweisung sagt **"Übersetze"**, obwohl Deutsch zu Deutsch nichts zu übersetzen ist.
  Das Label ist ein Überbleibsel aus dem Sprachlern-Ursprung von word_tiles. Selbst die
  UI weiß nicht, was sie sagen soll, weil der Typ zweckentfremdet wird.
- Bei muttersprachlichem Wissensinhalt ist die ganze "Übersetzen + Wörter sortieren"-
  Mechanik fehl am Platz.

**Der nachhaltige Fix ist eine Regel, die den Aufgabentyp an das Lernziel koppelt:**

| Lernziel | Richtiger Typ |
|---|---|
| Faktenwissen mit einer Antwort | cloze (Lücke) |
| Konzept wiedererkennen | Multiple-Choice / Matching |
| Definition eines Konzepts | cloze mit Schlüsselbegriff-Lücken |
| Freie Erklärung / Transfer / Vergleich | Self-Assessment (nie exact-match) |
| Satz mit eindeutiger Wortreihenfolge (Sprachenlernen) | word_tiles |

Diese Regel gehört in die Content-Generierungs-Anweisung (LESSON-FORMAT bzw. die
KI-Generierungs-Prompts), damit schlecht passende Aufgaben **gar nicht erst entstehen**.

---

## 6. Empfehlung

### 6a. Was am besten für den Nutzer ist
Der Nutzer will **fair und sinnvoll** bewertet werden. Konkret heißt das:
- **Niemals einen inhaltlich richtigen Nutzer komplett rot markieren.** Das ist der
  schädlichste Einzelmoment, er vertreibt genau die motivierten Lernenden.
- **Definitionen als cloze**, nicht als Volltext. Der Nutzer ruft aktiv ab (lernwirksam)
  und wird fair bewertet (eine richtige Antwort pro Lücke). Bestes Verhältnis aus
  Lerneffekt und Frustfreiheit.
- **Echte freie Antworten als Self-Assessment.** Wo "in eigenen Worten" gefragt ist,
  zeigt die App die Musterlösung und lässt den Nutzer selbst einordnen. Das fühlt sich
  erwachsen und fair an statt willkürlich bestraft.

### 6b. Was am besten für die App ist
Die App braucht **automatisch und zuverlässig bewertbare** Aufgaben plus eine
**wartbare Content-Pipeline**:
- **cloze ist das stärkste vorhandene Werkzeug** und deckt Stufe 1 und 2 sowie die
  meisten Definitionsfälle ab. Kein neuer Code nötig, nur eine Content-Regel. Sofort
  umsetzbar, geringstes Risiko.
- **Keyword-Bewertung (c) NICHT bauen.** Hoher Aufwand, unscharfes Ergebnis, viele
  Grenzfälle. Schlechtes Verhältnis aus Aufwand und Nutzen.
- **Self-Assessment (d) ist die einzige saubere Lösung für freie Produktion**, aber ein
  **neuer Aufgabentyp** (oder eine Erweiterung von free_text). Das ist echte
  Entwicklungsarbeit und gehört als bewusste Roadmap-/EXP-Entscheidung behandelt, nicht
  als Quick-Fix. Es passt gut ins SRS-Modell: die Selbsteinschätzung liefert direkt das
  Intervall-Signal.

### 6c. Empfohlene Reihenfolge
1. **Sofort (Content-Regel):** Generierungs-Regel ergänzen (Tabelle Abschnitt 5).
   word_tiles nur für eindeutige Sätze, Definitionen als cloze, freie Erklärungen
   bekommen vorerst keinen exact-match-Typ. Verhindert neue Fehlerfälle.
2. **Kurzfristig (Content-Sichtung):** Das Beeinflussungs-Set (und andere KI-generierte
   Sets) auf word_tiles-mit-Definitionsinhalt durchsehen und betroffene Aufgaben durch
   cloze oder MC ersetzen. Behebt die bestehenden Fälle.
3. **Mittelfristig (Architektur, EXP):** Self-Assessment als neuen Aufgabentyp evaluieren
   (EXP-Exploration), für die Fälle, in denen freie Produktion didaktisch gewollt ist.
   Bewusste Entscheidung, kein Schnellschuss.

### Kernsatz
Für Nutzer und App gilt dasselbe Optimum: **Definitionen und Faktenwissen als cloze/MC
(fair und automatisch bewertbar), echte freie Produktion als Self-Assessment (fair, aber
neuer Typ), exact-match niemals für freie Sprache.** Der größte Gewinn bei geringstem
Aufwand liegt in einer Content-Generierungs-Regel, die den Typ an das Lernziel koppelt,
damit der Frust-Fall vom Screenshot strukturell nicht mehr entsteht.

### Bezug zum Launch
Dieser Fund ist ein starkes Argument für den gestaffelten Launch mit Inhalts- und
Native-Speaker-Review vor breitem Publikum. Ein Nutzer, der inhaltlich richtig liegt und
trotzdem alles rot sieht, ist genau der Nutzer, den eine closed Beta abfangen soll, bevor
er bei einem öffentlichen Launch verloren geht.

---

## 7. Entscheidung: kein Vorrats-Schema, Katalog + Rezept (Nachtrag)

Getroffene Architektur-Entscheidung nach der cloze-select-Multiple-Choice-Arbeit
(#1341/#1342): Das kanonische Modell wird **nicht** auf Vorrat um ungenutzte
Aufgabentypen erweitert. Erweiterbarkeit wird stattdessen durch zwei Doku-
Artefakte garantiert, ohne totes Schema zu erzeugen:

- **Typ-Katalog mit Status** in der Authoring-Referenz
  (`docs/help/{en,de}/developer/authoring-content.md`): implementiert /
  ohne neuen Typ abbildbar / geplant-bei-Bedarf / bewusst nicht.
- **Erweiterungs-Rezept** als Entwickler-Doku
  (`docs/help/{en,de}/developer/adding-exercise-type.md`): die verbindliche
  Ein-PR-Schrittfolge (Pydantic-Modell → EXP-039-Generierung → Renderer im
  Dispatcher → SRS-Anschluss → Doku → Tests).

**Invariante als Begründung:** Ein Typ wird nur zusammen mit seinem Renderer
ausgeliefert — die `SUPPORTED_EXERCISE_TYPES`-Registry muss dem
`ExerciseType`-Enum entsprechen, erzwungen durch einen Paritätstest im
Dispatcher. Ein Enum-Wert ohne Renderer bricht die CI.

**Präzedenz:** Der v1.4-preview-Vorstoß und der `picture_choice`-Vorfall
(Text-MC auf einem Bild-Typ → Platzhalter-Kacheln statt bedienbarer Kontrolle,
`astrapi69/adaptive-learner-content-test#10`) sind die konkreten Lehren: ein
Typ ohne (passenden) Renderer schadet mehr, als er nutzt. Daher: kein
`multiple_choice`-/`choice`-Typ — Text-MC ist `cloze` `select`-Modus; ein
neuer Typ kommt nur bei konkretem Content-Bedarf über das Rezept.
