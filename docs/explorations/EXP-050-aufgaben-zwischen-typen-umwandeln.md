# CCW-Prompt: Exploration Aufgaben zwischen Typen umwandeln (EXP-050)

**Kategorie:** Feature (Lektions-Editor) · **Stand:** 2026-08-07 · **Status:** Exploration, kein Code

## Kurzfazit und Empfehlung

Umwandeln ist technisch **kein Schema-Eingriff** (das Content-Schema ist ein
einziges flaches Objekt, jeder Typ liest andere Felder desselben Objekts), aber
inhaltlich nur für eine **kleine Gruppe** von Paaren sinnvoll. Der wunde Punkt
ist nicht die Feldabbildung, sondern der **Lernfortschritt**: SRS- und
Fehlerhistorie hängen am `element_key`, und der ist der **kanonische
Antwort-Text**, den eine **typ-abhängige Regel** erzeugt. Ein Typwechsel
wechselt die Regel, der Schlüssel wandert, die Kartenhistorie verwaist -
**es sei denn**, die Umwandlung trägt genau denselben kanonischen Antwort-Text
weiter, dann bleibt der Schlüssel identisch und der Fortschritt geht mit.

Empfehlung (kleinster erster Wurf): nur die **schlüssel-erhaltenden
Einzelantwort-Umwandlungen** (im Kern `-> free_text`, wo die eine kanonische
Antwort 1:1 übernommen wird). Dort gibt es weder Rückfrage noch Erfindung
**noch** stillen Fortschrittsverlust. Alles Weitere (Erfindung von Distraktoren,
Passagen, Bildern; Fan-out-Typen) ist ein späterer, eigener Schritt und verlangt
zwingend eine Ansage vor der Umwandlung.

**Geprüfte Menge:** alle 13 Typen gegen die Schema-Wahrheitsquelle
(`plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema_generated.py`,
`schema.py`), die Blank-Fabriken + Validatoren
(`frontend/src/lib/exercises/authoring/{exercise-edit,extension-edit,exercise-builder}.ts`,
`frontend/src/lib/exercises/payload/*.ts`), die Fortschritts-/SRS-Schlüssel
(`frontend/src/lib/srs/{element-keys,exercise-identity,element-attempt}.ts`,
`frontend/src/storage/lessons/{element-errors-dexie,lesson-progress-dexie}.ts`,
`backend/app/models/__init__.py`) und der Editier-Speicherweg
(`frontend/src/pages/lesson/CreateLesson.tsx`, `lib/content/lesson/draft-to-lesson.ts`).

---

## Teil 1: Welche Umwandlungen sind möglich (Matrix)

### Datenlage

Das Schema ist **ein flaches, `frozen`, `extra="forbid"` Objekt**
(`schema_generated.py:364-471`): jeder Typ trägt seine Felder auf demselben
`Exercise`, unterschieden durch `type`. Umwandeln heißt deshalb immer:
`type` ändern, die **Zielfelder ergänzen** und die **Quellfelder entfernen**
(ein stehengebliebenes `pairs` auf einem jetzt-`free_text` würde beim Laden von
`extra="forbid"` abgewiesen). Es gibt **heute keine** Umwandlung auf
Übungsebene (Suche nach `convert/changeType/switchType` leer); das einzige
Vorbild ist der **Unterfragen**-Typwechsel `multiple_choice <-> free_text`
innerhalb von Leseverständnis/Benotetes-Quiz, der beide Zweige (`options` und
`accept`) im Zustand hält und erst beim Normalisieren den ungenutzten Zweig
verwirft (`extension-edit.ts:86-96, 253-275` - `WizardSubQuestion`).

### Vier Antwort-Familien (das ordnet alle 13 Typen)

| Familie | Typen | Kern der Antwort |
|---|---|---|
| **A Einzelantwort-Text** | `free_text`, `word_tiles`, `cloze(type)`, `ext:al-dictation`, `ext:al-image-description`, `ext:al-error-correction` | ein kanonischer Text (`accept[0]` / Kacheln / Lückenwort / Transkript / Korrektur) |
| **B Auswahl** | `multiple_choice`, `picture_choice`, `cloze(select/multiselect)` | Optionen mit Richtig-Markierung |
| **C Struktur (Paare/Gruppen)** | `matching`, `ext:al-categorization` | 1:1-Paare bzw. N Elemente in benannte Körbe |
| **D Mehrteilig mit Passage** | `ext:al-reading-comprehension`, `ext:al-graded-quiz` | Passage + mehrere Unterfragen |

`ext:al-dictation` und `ext:al-image-description` sind zwar Familie A, brauchen
aber ein **Asset** (Audio/Bild). Als **Ziel** aus Text sind sie deshalb
unmöglich (dieselbe Grenze wie die KI-Erzeugung, Schwester-Vorgang #2510).

### Matrix nach Familien (deckt alle 13x13 = 169 Zellen ab)

Einordnung: **VF** verlustfrei · **VA** verlustarm (Struktur/Zusatz fällt,
Inhalt bleibt) · **E** Ergänzung nötig (Ziel braucht mehr, als die Quelle
hergibt) · **X** unmöglich/Neuerfindung.

| von \ nach | A Text | A Medien (dict/img) | B Auswahl | C Struktur | D Passage |
|---|---|---|---|---|---|
| **A Text** | VF/VA (innerhalb A) | E (Asset fehlt) -> X aus Text | E (Distraktoren erfinden) | X (keine Paare/Gruppen) | X (keine Passage) |
| **B Auswahl** | VA (Richtige -> `accept`, Falsche -> `distractors`) | X (Asset) | VF/VA (innerhalb B) | X | X |
| **C Struktur** | VA -> X (N Paare auf 1 Antwort) | X | X | matching<->categorization: VA/X | X |
| **D Passage** | X (mehrteilig -> 1) | X | X | X | RC<->GQ: VF/E |

### Die tatsächlich sinnvolle Teilmenge (der Kern der Antwort)

Von 169 geordneten Paaren tragen nur wenige. Diese Liste ist die eigentliche
Matrix; alles Übrige fällt nach den Familienregeln oben in **X**.

| Umwandlung | Klasse | Feldabbildung | `element_key`-Folge |
|---|---|---|---|
| `word_tiles -> free_text` | **VF** | `accept = [tiles.join(" ")]` | identisch (beide: der eine String) -> **Fortschritt bleibt** |
| `multiple_choice -> free_text` | VA | `accept = [richtige.sort().join(", ")]`, `distractors = falsche` | identisch, wenn `accept[0]` = derselbe sortierte String -> bleibt |
| `cloze(select) -> free_text` | VA | `accept = blanks[0].accept`, Satz/Distraktoren fallen | 1 Schlüssel bleibt, wenn `accept[0]` erhalten |
| `ext:al-dictation -> free_text` | VA | `accept` übernehmen, `audio` fällt | identisch |
| `ext:al-image-description -> free_text` | VA | `accept` übernehmen, `image` fällt | identisch |
| `ext:al-error-correction -> free_text` | VA | `accept = [korrigierter Satz]` | **wandert** (Fehlerkorrektur-Key != Satz) -> verwaist |
| `graded-quiz -> reading-comprehension` | **VF** | `points`/`pass_threshold` fallen, `passage`+`questions` bleiben | wandert (RC- vs GQ-Regel) -> verwaist |
| `free_text -> multiple_choice` | **E** | `accept -> richtige Option`, Falsche aus `distractors` **oder erfunden** | wandert, wenn Satz nicht gleich bleibt |
| `reading-comprehension -> graded-quiz` | **E** | pro Frage `points` ergänzen (+`pass_threshold`) | wandert |
| `free_text -> cloze` | **E** | Satz mit `___` + Lücke bestimmen | wandert |
| `single- <-> mehrfach-Auswahl` | **schon heute** | nur das `multiple`-Flag (+ mehr Richtige) | siehe Hinweis |

**Wichtiger Einzelbefund:** Die vom Anlass genannte „Einfachauswahl zu
Mehrfachauswahl" ist in diesem Schema **kein Typwechsel**, sondern das Umlegen
des `multiple`-Flags auf demselben Typ `multiple_choice` - und das ist im Editor
**heute schon** möglich (`ExerciseEditor.tsx:475-583`, Radio single/multiple).
Der `element_key` für Mehrfachauswahl ist die sortiert-verbundene Menge der
richtigen Texte; solange dieselben Richtigen richtig bleiben, ändert er sich
nicht. Das ist der billigste „Fortschritt bleibt"-Fall und braucht **keine neue
Umwandlung**, nur ggf. eine klarere Beschriftung.

Fazit Teil 1: sinnvoll sind im Wesentlichen **Umwandlungen innerhalb Familie A**
und **B -> A**, plus das saubere Paar **RC <-> GQ**. Alles Richtung Struktur (C),
Passage (D) oder Medien ist Neuerfindung und gehört nicht in eine Umwandlung,
sondern in Neuanlegen.

---

## Teil 2: Was mit dem Fortschritt passiert (der wunde Punkt)

**Verdikt: Eine `id`-erhaltende Umwandlung reicht NICHT, um den Fortschritt zu
retten. Sie verwaist die SRS-/Fehlerhistorie - außer der kanonische
Antwort-Text (die `element_key`-Menge) bleibt Zeichen für Zeichen gleich.**

Woran der Fortschritt hängt (Fundstellen):

- Der SRS-/Fehler-Schlüssel ist zusammengesetzt aus
  `(user, set, lesson, exercise_id, element_key, direction)` -
  `frontend/src/storage/lessons/element-errors-dexie.ts:43-55` (`rowKey`) und
  `backend/app/models/__init__.py:1529-1540` (UNIQUE-Constraint).
- `exercise_id = stable_id ?? id` - `frontend/src/lib/srs/exercise-identity.ts:35-39`.
  Dieser Teil **überlebt** eine `id`-erhaltende Änderung. Genau das hat v2.11.0
  verankert (#2455, EXP-045): Fortschritt hängt an **stabilen Kennungen** statt
  am Inhalt, seither verwaisen Tippfehlerkorrektur und Umsortieren nicht mehr.
- Aber `element_key` ist **kein** Id, sondern der **kanonische Antwort-Text**,
  erzeugt durch eine **typ-abhängige Regel** -
  `frontend/src/lib/srs/element-keys.ts:105-182`
  (`CORE_ELEMENT_KEY_RULES` / `EXT_ELEMENT_KEY_RULES`, dispatch per
  `exercise.type`). Jeder Typ liest **andere Felder** und liefert **andere
  Anzahl** Schlüssel:
  - `matching` -> ein Schlüssel je `pairs[].left` (Fan-out N)
  - `cloze` -> ein Schlüssel je Lücke (Fan-out N)
  - `free_text` -> `[accept[0]]` (genau 1)
  - `word_tiles` -> `[tiles.join(" ")]` (genau 1)
  - `multiple_choice` -> `[richtige.map(text).sort().join(", ")]` (genau 1)

Daraus folgt die **entscheidende Regel für Umwandlungen**:

- **Gleiche Schlüsselmenge -> Fortschritt bleibt.** Wenn Quelle und Ziel je
  **genau einen** Schlüssel liefern und die Umwandlung denselben String erzeugt
  (z. B. `word_tiles.tiles.join(" ")` wird zu `free_text.accept[0]`), ist der
  `element_key` identisch. Die Zeile wird weiter aufgelöst, die Historie geht
  mit. **Ohne** Zutun, weil `exercise_id` ohnehin stabil ist.
- **Andere Schlüsselmenge -> Verwaisung.** Fan-out-Typen (matching, cloze) haben
  N Schlüssel; ein Wechsel auf einen 1-Schlüssel-Typ (oder umgekehrt) ändert
  Anzahl und Inhalt -> alle alten Zeilen bleiben liegen, werden aber nie wieder
  aufgelöst (nicht gelöscht, nur verwaist).

Was **immer** überlebt: die grobe `LessonProgress.step_results` (Schlüssel
`step_id = step-ex-${i}-${ex.id}`, **ohne** Typ) - Lektions-Abschluss/Score,
nicht die feingranulare SRS-Historie (`lesson-progress-dexie.ts:171-200`).
Verschiebt sich beim Editieren zusätzlich der Array-Index `i`, verwaist auch das.

**Kein Netz auf dem Editier-Weg.** Es existiert bereits
Umschlüsselungs-Technik (`lib/content/update/update-impact.ts`,
`remap-plan.ts:159-208` `planElementKeyRemaps`,
`element-errors-dexie.ts:247-394` `remapElementKeysDexie`/`archiveRetiredDexie`,
#2161/#2130/#2308) - aber sie hängt **nur** am Repo-Content-Update, **nicht** am
lokalen Editor-Speichern. `CreateLesson.saveLocally`
(`frontend/src/pages/lesson/CreateLesson.tsx:519-569`) ruft **keinen**
Impact/Remap. Eine Umwandlung, die heute den Schlüssel verschöbe, verlöre die
Historie **still**. Genau die Klasse, gegen die dieser Bestand über Wochen
(EXP-045, #2455/#2309) gearbeitet hat.

**Konsequenz für das Feature:**
1. Vor einer Umwandlung wird **berechnet**, ob die `element_key`-Menge erhalten
   bleibt (das ist deterministisch aus Quelle+Zielabbildung ableitbar).
2. Bleibt sie erhalten -> Umwandlung ist eine reine Änderung, Fortschritt geht
   mit, keine Ansage nötig.
3. Wandert sie -> **vor** dem Übernehmen sagen, was verloren geht, und
   idealerweise die vorhandene Remap-Technik (`planElementKeyRemaps`) auf den
   Editier-Weg heben, damit die Historie mitgenommen statt verworfen wird.

Der stille Verlust ist die einzige inakzeptable Variante.

---

## Teil 3: Was mit Ergänzung geschieht

Fälle der Klasse **E** (Ziel braucht mehr als die Quelle): `free_text ->
multiple_choice` (Distraktoren fehlen), `free_text -> cloze` (Lücke fehlt),
`reading-comprehension -> graded-quiz` (Punkte fehlen).

- **Zwei Wege, beide angeboten:** der Nutzer füllt die Lücke selbst, oder ein
  Modell schlägt vor. Der Vorschlag ist **nie** stille Übernahme.
- **Dieselbe Vorsicht wie bei der Lektions-Erzeugung.** Erfundene, offensichtlich
  falsche Distraktoren entwerten die Aufgabe. Es gilt die schon gebaute
  Qualitäts-Disziplin: lieber eine Ergänzung weniger als eine, die inhaltlich
  nicht trägt (vgl. `exercise-quality-gate.ts`, EXP-041 Eignung).
- **Vorschau vor Übernehmen ist bereits da.** Der Inline-Editor
  (`ExerciseEditor` / `ExtensionExerciseEditor`) hält einen **Entwurf** und
  committet erst per **Speichern**; Abbrechen verwirft. Eine Umwandlung baut den
  Entwurf des Zieltyps (Felder abgebildet, Lücken markiert leer) und der Nutzer
  sieht + bearbeitet ihn **vor** dem Speichern. Für den KI-Vorschlag füllt die
  Modellantwort denselben Entwurf; der Nutzer prüft und speichert. Es braucht
  also **keine** separate Vorschau-Fläche - der Entwurf-plus-Speichern des
  bestehenden Editors **ist** die Vorschau.
- Eine Umwandlung, die still etwas erfindet, ist schlechter als eine, die nach
  einer Eingabe fragt: bei fehlenden Pflichtfeldern bleibt „Speichern" durch den
  vorhandenen Validator gesperrt (`validateExerciseEdit` /
  `validateExtensionExercise`), bis der Nutzer die Lücke füllt.

---

## Teil 4: Wo und wie

- **Ort:** im Zeilen-Editor einer Aufgabe (die Zeile aus `ExerciseGenerator`
  bzw. `ExtensionSteps`, die den Inline-Editor öffnet). Ein **Typ-Auswahlfeld**
  im Editor-Kopf listet die möglichen Ziele; ein Wechsel baut den Zielentwurf und
  lässt `id`/`stable_id` unangetastet.
- **Unmögliche Ziele ausgegraut mit Grund, nicht versteckt** - dieselbe
  Konvention wie beim Assistenten (#2510): ein ausgegrautes Ziel trägt eine
  Beschriftung + `aria-describedby` mit dem Grund („braucht Bild/Audio, im Editor
  als neue Aufgabe anlegen" bzw. „braucht Paare/Passage, nicht aus dieser Aufgabe
  ableitbar"). So erfährt der Nutzer, dass es das Ziel gibt und warum es hier
  nicht geht.
- **Rückgängig:** Nach einem Verlust nur möglich, wenn die alte Fassung
  aufgehoben wird. Empfehlung: **kein** eigener Undo-Stack. Der bestehende Weg
  trägt genug - Abbrechen im Editor verwirft die noch nicht gespeicherte
  Umwandlung vollständig; nach dem Speichern ist die vorige Fassung über die
  Historie der eigenen Lektion (Git-gestütztes Learning-Repo / erneutes
  Editieren) erreichbar. Ein aufgabenweiser Undo-mit-Snapshot lohnt den Aufwand
  im ersten Wurf nicht; wenn überhaupt, dann als späteres, allgemeines
  Editor-Undo, nicht als Sonderweg der Umwandlung.
- **Bereits beantwortete Aufgabe:** Der gespeicherte `raw_answer` in
  `step_results` ist für den **alten** Typ geformt
  (`lesson-progress-dexie.ts:183-192`, „exakt gesperrte Ansicht"); nach einem
  Typwechsel kann die neue Zielkomponente ihn nicht re-hydrieren. Empfehlung: bei
  einer Umwandlung den gespeicherten Roh-Antwortzustand dieses Elements
  **verwerfen** (die Aufgabe gilt als neu zu beantworten), und - siehe Teil 2 -
  die SRS-Historie nur behalten, wenn die Schlüsselmenge erhalten bleibt.

---

## Teil 5: Zuschnitt

**Kleinster erster Wurf (spürbar, ohne Rückfrage, ohne Erfindung, ohne stillen
Verlust):** die **schlüssel-erhaltenden** Einzelantwort-Umwandlungen - konkret
der Kern `-> free_text`, wo die eine kanonische Antwort 1:1 in `accept[0]`
übernommen wird und der `element_key` dadurch **identisch** bleibt:

1. `word_tiles -> free_text` (VF, Schlüssel identisch).
2. `multiple_choice -> free_text` (VA: Falsche wandern nach `distractors`;
   `accept[0]` = sortiert-verbundene Richtige, Schlüssel identisch).
3. `ext:al-dictation -> free_text`, `ext:al-image-description -> free_text`
   (VA: Asset fällt, `accept` + Schlüssel bleiben).

Dieser Wurf braucht: das Typ-Feld im Editor, vier deterministische
Abbildungsfunktionen, eine Schlüssel-Erhalt-Prüfung (rein rechnerisch) und den
`extra="forbid"`-sauberen Feldtausch. Kein Modell, keine Ansage, kein Remap.

**Danach, in Reihenfolge (je eigener Vorgang, mit Aufwand grob):**

- **Stufe 2 - VA mit Ansage (S):** `cloze(select) -> free_text`,
  `error-correction -> free_text`, `graded-quiz -> reading-comprehension`. Hier
  wandert der Schlüssel; nötig ist die **Fortschritts-Ansage** und - besser - das
  Heben von `planElementKeyRemaps` auf den Editier-Weg (Wiederverwendung, kein
  neues Schema). Aufwand mittel, weil der Remap-Weg heute nur am Content-Update
  hängt.
- **Stufe 3 - E, Nutzer füllt (M):** `free_text -> multiple_choice`,
  `reading-comprehension -> graded-quiz`, `free_text -> cloze`. Zielentwurf mit
  leeren Pflichtfeldern, „Speichern" durch den Validator gesperrt, bis der Nutzer
  ergänzt.
- **Stufe 4 - E, Modellvorschlag (M-L):** derselbe E-Fall mit optionalem
  KI-Vorschlag für Distraktoren/Lücke, Vorschau im Entwurf, Qualitäts-Gate wie
  bei der Erzeugung.

**Was ausdrücklich NICHT gebaut werden sollte (mit Begründung):**

- **Umwandlung in Medientypen** (`picture_choice`, `dictation`,
  `image-description`) **aus Text**: das Asset fehlt und kann nicht erfunden
  werden - als Ziel ausgegraut, nicht anbieten. Wer ein Bild/Audio hat, legt die
  Aufgabe neu an.
- **Umwandlung in Struktur-/Passagentypen** (`matching`, `categorization`,
  `reading-comprehension`, `graded-quiz`) **aus einer einfachen Aufgabe**: Paare,
  Körbe oder eine Passage müssten erfunden werden - das ist Neuanlegen, nicht
  Umwandeln. (`RC <-> GQ` ist die Ausnahme, weil die Nutzlast dieselbe ist.)
- **Ein aufgabenweiser Undo-Stack nur für die Umwandlung**: Sonderweg für ein
  Problem, das der Editor-Abbrechen + Lektions-Historie schon deckt.
- **`single- <-> mehrfach-Auswahl` als eigene Umwandlung**: ist heute schon das
  `multiple`-Flag im Editor; eine zweite Bedienung dafür erzeugte zwei Wege für
  dieselbe Sache.
- **Stiller Fortschrittsverlust in irgendeiner Stufe**: nie. Wandert der
  Schlüssel, wird es gesagt oder umgeschlüsselt.

---

## Schema-Bedarf

**Keiner für dieses Feature.** Umwandeln nutzt nur Felder, die auf dem flachen
`Exercise`-Objekt bereits existieren; kein neues Feld, keine Engine-Änderung. Die
stabile Kennung (`stable_id`) ist seit v2.11.0 vorhanden und trägt den
Identitätsteil. Sollte Stufe 2 die SRS-Umschlüsselung auf den Editier-Weg heben,
geschieht auch das mit **vorhandener** Technik (`planElementKeyRemaps`) -
ebenfalls ohne Schema-Eingriff. Falls später ein erstklassiges
„Umwandlungs-Protokoll" pro Aufgabe gewünscht wird (für Undo über Sitzungen),
wäre das eine Schema-Frage und gehörte zu `learn-content-engine` angemeldet,
nicht app-seitig erfunden.

---

## Endbericht (Zusammenfassung)

- **Matrix / geprüfte Menge:** alle 13 Typen, vier Antwort-Familien (A Text,
  B Auswahl, C Struktur, D Passage). Von 169 geordneten Paaren tragen nur die
  Umwandlungen **innerhalb A**, **B -> A** und **RC <-> GQ**; der Rest ist
  Neuerfindung (Medien-Assets, Paare, Passagen) und gehört zu Neuanlegen. Ein
  begründetes Weniger ist hier die Antwort.
- **Fortschritt (Fundstelle):** SRS/Fehler hängen an
  `(exercise_id, element_key, ...)`; `exercise_id = stable_id ?? id` überlebt
  (`exercise-identity.ts:35-39`), aber `element_key` ist der typ-abhängige
  kanonische Antwort-Text (`element-keys.ts:105-182`). Bleibt die Schlüsselmenge
  gleich, geht der Fortschritt mit; wandert sie, verwaist er - heute **still**,
  weil der Editier-Weg (`CreateLesson.tsx:519-569`) kein Impact/Remap ruft.
- **Ergänzung / Vorschau:** Nutzer-Eingabe oder Modellvorschlag, nie stille
  Erfindung; der bestehende Inline-Editor (Entwurf + Speichern/Abbrechen +
  Validator-Gate) ist bereits die Vorschau.
- **Ort / unmögliche Ziele / Rückgängig:** Typ-Feld im Zeilen-Editor; unmögliche
  Ziele ausgegraut + begründet (`aria-describedby`, wie #2510); kein eigener
  Undo-Stack (Abbrechen + Lektions-Historie genügt); ein bereits gespeicherter
  Roh-Antwortzustand wird bei Umwandlung verworfen.
- **Zuschnitt / kleinster Wurf:** zuerst die schlüssel-erhaltenden
  `-> free_text`-Umwandlungen (kein Modell, keine Ansage, kein Verlust); danach
  VA-mit-Ansage (Remap heben), dann E-mit-Nutzereingabe, dann E-mit-KI-Vorschlag.
  Nicht bauen: Medien-/Struktur-Ziele aus Text, Umwandlungs-Undo-Sonderweg,
  single/multiple als zweite Bedienung, stiller Verlust.

**Offene Fragen / Annahmen:**
- Angenommen, dass die Schlüssel-Erhalt-Prüfung rein aus Quelle+Zielabbildung
  rechenbar ist (belegt durch die deterministischen Regeln in `element-keys.ts`);
  zu bestätigen bei der Umsetzung mit echten Zeilen.
- Ob Stufe 2 die Remap-Technik auf den Editier-Weg hebt oder nur eine Ansage
  zeigt, ist eine Produktentscheidung (Aufwand vs. Datenrettung) und in diesem
  Dokument als Empfehlung, nicht als Festlegung, formuliert.
