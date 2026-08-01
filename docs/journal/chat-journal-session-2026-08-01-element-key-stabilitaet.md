# Chat-Journal: Elementschlüssel-Stabilität (Untersuchung, dann drei Schritte)

Datum: 2026-08-01, Session ab ca. 14:30 Uhr

Kurzfassung des Ertrags: Der Aktualisierungsschutz legt jetzt vor, was er
erhalten kann, statt nur zu melden, was verloren geht. Am Morgen warnte er über
acht von dreizehn Übungstypen gar nicht und lag bei einem still falsch; am Abend
sind 186 von 190 bewegten Steckplätzen zuordenbar, und die vier übrigen fallen in
eine Entscheidung des Nutzers statt ins Schweigen.

Die Kette selbst steht in den Vorgängen (#2301, #2303/#2305, #2265/#2307,
#2308/#2309). Hier stehen die Entscheidungswege und die zwei Nebenfunde, die in
keinem Auftrag standen und ohne diesen Eintrag nicht rekonstruierbar wären.

## 1. Untersuchung: die Messung entschied gegen den erwarteten Weg (14:30)

- Auftrag: Woraus wird der `element_key` gebildet, wie stabil ist er, und
  wandert die Element-Ebene ins Schema (Weg A) oder wird sie app-seitig über
  Positionen gelöst (Weg B)?
- Verfahren: Git-Historie von 9 Inhalts-Repositories, 46 der 48 gelisteten Sets,
  312 Commits mit Elternteil, 598 geänderte Lektionsdateien. Je überlebender
  Übung die geordneten Elementschlüssel verglichen.
- Ergebnis: 185 inhaltliche Änderungen gegen 1 Einfügen und 1 Entfernen, rund
  92 zu 1. 172 der 185 fallen auf zwei Umschrift-Korrekturläufe an
  ja-a1/ko-a1/zh-a1 - **exakt die 172 real verwaisten Zeilen aus #2161**. Dass
  das Verfahren den eingetretenen Schadensfall punktgenau reproduziert, war die
  Probe darauf, dass es das Richtige zählt.
- Entscheidungsweg: Die Messung legte einen dritten Weg nahe, der im Auftrag
  nicht stand. Der Umschlüsselungs-Kern aus der #2161-Rettung liegt bereits in
  beiden Speichermodi ausgeliefert, transaktional und wiederholbar; es fehlte
  nur die Herleitung der Zuordnung. Weg C deckt 99 Prozent des Schadensbildes
  ohne Schema-Stufe, ohne Prägewelle und ohne die Alles-oder-nichts-Kopplung aus
  dem Abschluss von learn-content-engine#90.
- Zweiter Befund derselben Untersuchung: Der Warn-Notbehelf deckt die
  Element-Ebene **doch** ab (`computeUpdateImpact` vergleicht das volle Tripel).
  Der Druck war also geringer als angenommen - das gehörte in die Vorlage, auch
  wenn es die eigene Empfehlung schwächt.
- Entscheidung des Architekten: C jetzt, A als Ziel, B nicht allein.

## 2. Nebenfund im Wächter: ein Typ war nicht vergessen, sondern falsch (14:50)

- Befund: `ELEMENT_KEY_EXTRACTORS` deckte fünf von dreizehn Übungstypen ab. <!-- doc-ref-exempt: historische Nennung - genau dieser Bezeichner wurde in #2303 entfernt und durch die eine Regel ersetzt --> Für
  die übrigen acht lieferte die Kopie die leere Menge, also galt jede Lernerzeile
  darauf als gefährdet und **jede** Aktualisierung als brechend.
- Der eigentliche Punkt: Von den fünf angeblich gedeckten Typen war einer still
  falsch - die Kopie wandte auf cloze-multiselect die Lücken-Regel an. Dessen
  einzige Zeile konnte nie matchen, also war dort ebenfalls jede Aktualisierung
  brechend, also sah es wie korrektes Warnen aus.
- Klasse: Ein Fehler, dessen Symptom von richtigem Verhalten nicht
  unterscheidbar ist, solange man nur auf das Ergebnis schaut. Zwei
  Implementierungen derselben Regel, und niemand vergleicht sie.
- Entscheidungsweg: Nicht die Kopie erweitern, sondern beseitigen. Eine Regel
  (`lib/srs/element-keys.ts`), beide Aufrufer rufen sie. Die Aufzählung sperrt
  beim Compiler - Kern-Typen über die Engine-Union, Erweiterungen über
  `ExtensionWizardType` -, beides durch Entfernen eines Eintrags belegt statt
  behauptet.
- Beim Testen fiel ein leer-grüner Fall auf: die graded-quiz-Fixture ließ
  `points` weg, der Payload-Leser verwarf sie, beide Seiten lieferten leer, der
  Paritätstest bestand ohne Aussage. Fixture korrigiert, ein Pin dagegen
  eingezogen.
- Ergebnis: #2303, PR #2305, gemergt `8bf6dc4d`.

## 3. Nebenfund beim Engine-Pin: ein Gate prüfte eine zufällige Übereinstimmung (15:10)

Dieser Fund stand in keinem Auftrag und ist der wichtigere der beiden.

- Ausgangslage: Der Pin sollte von 0.14.0 auf die aktuelle Fassung steigen, damit
  die Engine-Arbeit (`stable_id`, `attribution`, `review_status`) app-seitig
  ankommt. Reine Routine.
- Befund: Nach dem Bump gingen `sync-schema-check` und `engine-parity-check` rot,
  obwohl die Dokumente semantisch identisch waren und sogar dieselbe Byte-Länge
  hatten.
- Ursache: Drei Dateien hatten **zwei Schreiber**. Das Spiegel-Skript kopierte die
  Engine-Bytes, danach schrieb `generate_lesson_schema.py` dieselben Dokumente
  aus dem eigenen Serialisierer erneut. Bis Engine 0.14.0 schrieb die Engine
  `sort_keys=True` + ASCII-escaped - exakt die Ausgabe des App-Generators. Die
  Gates waren also nicht grün, weil gespiegelt wurde, sondern weil zwei
  unabhängige Erzeuger zufällig dasselbe lieferten. Engine 0.16.x wechselte auf
  Einfüge-Reihenfolge und literales UTF-8, und die Zufallsgleichheit endete.
- Weg zur Diagnose, ehrlich: Ich habe unterwegs zweimal falsch geschlossen -
  erst "der Generator verliert `stable_id`", dann "es ist nur das Escaping".
  Beides durch Nachmessen widerlegt, bevor es in die Vorlage ging. `stable_id`
  war vorhanden, nur an anderer Stelle; die Schlüsselreihenfolge war der Rest.
- Entscheidungsweg: Drei Optionen vorgelegt, weil alle drei einen Gate-Vertrag
  berühren. Der Architekt wählte A (ein Schreiber je Pfad). Begründung, die über
  die Optionen hinausgeht: B hätte den Vertrag von Byte- auf semantische
  Gleichheit gelockert und den zweiten Schreiber stehen lassen - die beiden wären
  weiter gedriftet, nur unsichtbar. C hätte von der Engine verlangt, eine
  Schreibweise beizubehalten, damit ein fremder Generator zufällig danebenliegen
  kann.
- Beleg, dass nichts verloren geht: Die Engine liefert `$schema`, `$id` und
  `x-schema-version` selbst mit denselben Werten, und `quality-rules.json` in
  exakt der Form, die der Generator baute - samt eines `_comment`, der das
  App-Skript namentlich nennt. Das erneute Schreiben war von Anfang an Dopplung,
  nicht Ergänzung.
- Suche nach der Klasse: 12 Generatoren gegen 3780 versionierte Dateien, per
  mtime-Zuordnung. 14 Dateien berührt, jede mit genau einem Schreiber. Grenze
  benannt: sieben Generatoren schrieben auf dem konvergierten Baum nichts, für
  die ruht die Aussage auf disjunkten Namensräumen statt auf Beobachtung.
- Ergebnis: #2265, PR #2307, gemergt `ca1c28ba`. Als Regel festgehalten in
  `lessons/ci-gates.md`, Korpus-Deckel bewusst angehoben.

## 4. Weg C: die stärkere Quelle lag schon da (15:45)

- Entscheidungsweg: In der Untersuchung hatte ich `correct_answer` als Textzeugen
  vorgeschlagen, damit eine Fehlzuordnung nachträglich erkennbar wird. Beim
  Bauen zeigte sich, dass der Wächter VOR dem Anwenden läuft - die
  zwischengespeicherte Fassung steht also noch vollständig da und ist die
  stärkere Quelle. Die schwächere wäre nicht aus Abwägung gewählt worden, sondern
  weil niemand nachgesehen hatte, was zu diesem Zeitpunkt verfügbar ist.
- Entscheidende Einzelentscheidung: Umsortierung wird VOR Länge geprüft. Das
  reale Ereignis `135c4442` hat gleichzeitig verkürzt und umsortiert; als bloße
  Längenänderung gemeldet, wäre genau der Fehlermodus verschwunden,
  dessentwegen Weg B ausgeschieden ist.
- Verschärfung gegenüber dem Auftrag: Der nächtliche Abgleich **berechnet** gar
  keinen Plan, statt ihn nur nicht anzuwenden. Damit hängt die Bedingung an der
  Struktur und nicht an Disziplin.
- Reihenfolge: erst herunterladen, dann umschlüsseln, mit gepinntem Test. Im
  Fehlerfall bleibt der Lernende im bekannten verwaisten Zustand statt in einem
  neuen, den keine Fassung kennt.
- Ergebnis: #2308, PR #2309, gemergt `c14a1df0`. 35 neue Tests, volle
  Frontend-Suite 8112 grün.

## 5. Was offen bleibt, absichtlich

- **learn-content-engine#91** (Sub-Element-Ids): offen, verkleinerter Umfang.
  Der Vorgang erlaubt in seinem eigenen Text, bei einem App-Entscheid geschlossen
  zu werden - das trifft nicht zu. Weg C verkleinert den Rest auf gemessene 4 von
  190; sie fallen in einen Dialog, bleiben aber verwaist. Ein Schließen mit
  "app-seitig gelöst" wäre genau die Lesart, gegen die der Vorgang existiert.
- **#2130** (Schlüsselwechsel auf `stable_id` + einmaliger Abgleich): unverändert
  an die Release-Kopplung gebunden. Weniger dringlich, nicht weniger richtig.
- Ein Lektions-Kandidat ("vor der Frage, was mitgeführt werden muss, steht die
  Frage, was ohnehin vorliegt") wurde bewusst NICHT in `.claude/rules/`
  geschrieben: ein Vorkommen ist ein Präzedenzfall, keine Klasse, und der
  Regel-Korpus stand auf Spielraum 0. Vermerkt fürs zweite Auftreten.

## Statistik

- 4 Vorgänge angelegt (#2301, #2303, #2308 plus Wiederverwendung von #2265),
  3 PRs, alle gemergt.
- Frontend-Suite 8046 -> 8112 Tests; Backend 1665 grün.
- 2 Nebenfunde, beide außerhalb des Auftrags, beide behoben; einer als bindende
  Regel festgehalten.
