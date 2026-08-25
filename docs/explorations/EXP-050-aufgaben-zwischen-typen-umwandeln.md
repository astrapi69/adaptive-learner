# CCW-Prompt: Exploration Aufgaben zwischen Typen umwandeln (EXP-050)

**Kategorie:** Feature (Lektions-Editor) · **Stand:** 2026-08-15 · **Status:** Exploration, Stufe 1 umgesetzt

> **Korrektur 2026-08-15 (#2613), gegen den Code geprüft — die ursprüngliche
> Fassung (2026-08-07) behauptete an drei Stellen etwas anderes als der Code:**
>
> 1. **`ext:al-error-correction -> free_text` ist schlüsselerhaltend, NICHT
>    wandernd.** `element-keys.ts` leitet den Fehlerkorrektur-Schlüssel als
>    `asErrorCorrectionPayload(...).accept[0]` ab — identisch zur
>    `free_text`-Regel `accept[0]`. Bei `accept = ec.accept` bleibt der
>    Schlüssel gleich. Die alte Zeile („`accept = [korrigierter Satz]` …
>    wandert") war im Mapping UND in der Schlüsselfolge falsch.
> 2. **`graded-quiz -> reading-comprehension` ist KEINE verlustfreie Umwandlung
>    (VF), sondern eine mit Ergänzung (E).** `GradedQuizPayload =
>    {pass_threshold?, questions}` trägt **kein** `passage`;
>    `ReadingComprehensionPayload` verlangt ein nicht-leeres `passage`. Das Ziel
>    braucht ein Feld, das die Quelle nicht hat -> Ergänzung (Stufe 3/4), nicht
>    Stufe 2.
> 3. **„Kein Netz auf dem Editier-Weg" (Teil 2) ist überholt.**
>    `CreateLesson.saveLocally` ruft seit #2519/#2566
>    (`carryOverReviewProgress`, `lib/content/lesson/edit/edit-remap.ts`)
>    `planElementKeyRemaps` gegen alte + neue Lektion und wendet den Remap über
>    `storage.elementErrors.remapKeys` an (Dexie + API). `certain` wird
>    automatisch übernommen, `uncertain` gemeldet. Der „stille Verlust" ist
>    nicht mehr der Normalfall.
>
> Lehre (mehrfach an einem Tag aufgetreten): Eine Exploration ist eine
> Vorhersage, kein Vertrag. Vor der Umsetzung jede Feldabbildung + Schlüsselfolge
> gegen `element-keys.ts` + die Payload-Module prüfen, nicht gegen diese Tabelle.
> Die betroffenen Zeilen unten sind korrigiert und tragen den Vermerk **[korr.
> 2026-08-15]**.

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
Passagen, Bildern; Fan-out-Typen) ist ein späterer, eigener Schritt. **[korr.
2026-08-15]** Eine Ansage vor der Umwandlung ist dabei nur für die
`uncertain`-Schlüsselwanderung nötig — der `certain`-Fall wird vom Editier-Remap
(#2519/#2566) beim Speichern verlustfrei übernommen, siehe Teil 2.

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
| `cloze(select) -> free_text` | VA | `accept = blanks[0].accept`, Satz/Distraktoren fallen | **[korr. 2026-08-15]** EIN-blockig: 1 Schlüssel `blanks[0].accept[0]` bleibt -> Fortschritt bleibt. MEHR-blockig: N Schlüssel -> 1 -> wandert (Editier-Remap meldet `uncertain`, siehe Teil 2) |
| `ext:al-dictation -> free_text` | VA | `accept` übernehmen, `audio` fällt | identisch |
| `ext:al-image-description -> free_text` | VA | `accept` übernehmen, `image` fällt | identisch |
| `ext:al-error-correction -> free_text` | VA | **[korr. 2026-08-15]** `accept = ec.accept` übernehmen, `tokens`/`error_index` fallen | **identisch** — der EC-Schlüssel IST `accept[0]` (`element-keys.ts`), gleich der `free_text`-Regel -> **Fortschritt bleibt**, keine Ansage |
| `graded-quiz -> reading-comprehension` | **[korr. 2026-08-15] E** | `points`/`pass_threshold` fallen, `questions` bleiben — ABER `passage` **fehlt in GQ** und ist in RC Pflicht -> muss ergänzt werden | Schlüssel bleibt bei Ein-Richtig-MC/Freitext-Fragen (RC- = GQ-Kanon), wandert nur bei Mehr-Richtig-MC; nachrangig, weil ohnehin Ergänzung -> Stufe 3/4 |
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

Fazit Teil 1 **[korr. 2026-08-15]**: schlüsselerhaltend und ohne Ergänzung sind
die Umwandlungen **innerhalb Familie A** und **B -> A** — inklusive
`error-correction -> free_text` (der EC-Schlüssel IST `accept[0]`) und
ein-blockigem `cloze(select) -> free_text`; diese gehören zur Stufe-1-Klasse.
Das Paar **RC <-> GQ** ist NICHT sauber verlustfrei: `graded-quiz ->
reading-comprehension` braucht ein `passage`, das GQ nicht hat (Ergänzung), und
`reading-comprehension -> graded-quiz` braucht `points` — beide sind
Ergänzungsfälle (Stufe 3/4), nicht Stufe 2. Alles Richtung Struktur (C), Passage
(D) oder Medien ist Neuerfindung und gehört in Neuanlegen.

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

**Das Netz auf dem Editier-Weg existiert bereits [korr. 2026-08-15].** Die
frühere Fassung schrieb, `CreateLesson.saveLocally` rufe keinen Impact/Remap und
ein Schlüsselwechsel verliere die Historie *still*. Das stimmt seit #2519/#2566
nicht mehr: `CreateLesson.saveLocally`
(`frontend/src/pages/lesson/CreateLesson.tsx:572`) ruft direkt nach dem
erfolgreichen `saveUserSet` `carryOverReviewProgress(...)`
(`frontend/src/lib/content/lesson/edit/edit-remap.ts`). Das führt
`planElementKeyRemaps` gegen die **alte** Lektion
(`editContext.lessons[editIndex]`) und die **neue** aus und wendet den Plan über
`storage.elementErrors.remapKeys` an — **storage-modus-agnostisch** (Dexie via
`remapElementKeysDexie`, API via `api.elementErrors.remap`). Ergebnis:

- **`certain`** (gleiche Position, gleiche Länge): Historie wird automatisch
  umgeschlüsselt, kein Verlust, keine Ansage nötig.
- **`uncertain`** (Längenänderung / Umsortierung / mehrdeutig, z. B. `cloze` mit
  N Lücken -> 1 `free_text`): NICHT übernommen, wird als Toast gemeldet.

Die Umschlüsselungs-Technik selbst
(`remap-plan.ts` `planElementKeyRemaps`, `update-impact.ts`,
`element-errors-dexie.ts` `remapElementKeysDexie`/`archiveRetiredDexie`,
#2161/#2130/#2308) hängt also NICHT mehr nur am Repo-Content-Update.

**Konsequenz für das Feature [korr. 2026-08-15]:**
1. Vor einer Umwandlung wird mit `conversionPreservesElementKeys`
   (`exercise-convert.ts`, Stufe 1) **berechnet**, ob die `element_key`-Menge
   erhalten bleibt (deterministisch aus Quelle+Zielabbildung).
2. Bleibt sie erhalten -> reine Änderung, Fortschritt geht mit, keine Ansage
   (Stufe-1-Klasse).
3. Wandert sie -> der Editier-Remap trägt sie beim Speichern automatisch mit,
   wo er kann (`certain`), und meldet den Rest (`uncertain`). Eine **Vor**-
   Umwandlungs-Ansage ist deshalb nur noch dort nötig, wo die Prüfung sagt, der
   Schlüssel wandert UND der Carry nicht greift (die `uncertain`-Klasse, im Kern
   `cloze` N -> 1). Das ist der einzige Rest von Stufe 2.

Der stille Verlust — die einzige inakzeptable Variante — ist durch #2519/#2566
bereits ausgeschlossen.

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

> **Umgesetzt [2026-08-15]:** Stufe 1 ist ausgeliefert — Kern-Editor
> (`word_tiles` / `multiple_choice`, #2595/#2596) und Extension-Quellen
> (`ext:al-dictation` / `ext:al-image-description`, #2606/#2609). Die
> Schlüssel-Erhalt-Prüfung ist `conversionPreservesElementKeys` in
> `frontend/src/lib/exercises/authoring/exercise-convert.ts`.

**Danach, in Reihenfolge (je eigener Vorgang, mit Aufwand grob):**

- **Stufe 2 - Rest-Ansage (S) [korr. 2026-08-15]:** Der ursprüngliche
  Stufe-2-Zuschnitt ist durch die drei Korrekturen oben weitgehend aufgelöst:
  - `error-correction -> free_text` ist schlüsselerhaltend -> **Stufe-1-Klasse**
    (`accept = ec.accept`, kein Ansage-Bedarf).
  - `cloze(select) -> free_text` ist ein-blockig schlüsselerhaltend; nur der
    MEHR-blockige Fall (N -> 1) wandert und wird vom Editier-Remap als
    `uncertain` gemeldet.
  - `graded-quiz -> reading-comprehension` ist ein **Ergänzungsfall** (fehlendes
    `passage`) -> Stufe 3/4, nicht hier.

  Der echte Rest von Stufe 2 ist damit klein: die schlüsselerhaltenden
  `error-correction`/ein-blockig-`cloze` als Stufe-1-Nachzügler ergänzen, plus
  eine **Vor**-Umwandlungs-Ansage (`useConfirm`) NUR dort, wo
  `conversionPreservesElementKeys` false ist UND der Editier-Remap nicht trägt
  (`cloze` N -> 1). Kein neues Remap-Heben nötig — das ist seit #2519/#2566 da.
- **Stufe 3 - E, Nutzer füllt (M):** `free_text -> multiple_choice`,
  `graded-quiz <-> reading-comprehension` (beide Richtungen: GQ->RC ergänzt
  `passage`, RC->GQ ergänzt `points`), `free_text -> cloze`. Zielentwurf mit
  leeren Pflichtfeldern, „Speichern" durch den Validator gesperrt, bis der Nutzer
  ergänzt.
- **Stufe 4 - E, Modellvorschlag (M-L):** derselbe E-Fall mit optionalem
  KI-Vorschlag für Distraktoren/Lücke/Passage, Vorschau im Entwurf, Qualitäts-Gate
  wie bei der Erzeugung.

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
Identitätsteil. Die SRS-Umschlüsselung auf dem Editier-Weg ist **[korr.
2026-08-15] bereits gehoben** (`carryOverReviewProgress` /
`planElementKeyRemaps`, #2519/#2566) - ebenfalls ohne Schema-Eingriff. Falls
später ein erstklassiges
„Umwandlungs-Protokoll" pro Aufgabe gewünscht wird (für Undo über Sitzungen),
wäre das eine Schema-Frage und gehörte zu `learn-content-engine` angemeldet,
nicht app-seitig erfunden.

---

## Endbericht (Zusammenfassung)

- **Matrix / geprüfte Menge [korr. 2026-08-15]:** alle 13 Typen, vier
  Antwort-Familien (A Text, B Auswahl, C Struktur, D Passage). Schlüsselerhaltend
  ohne Ergänzung tragen die Umwandlungen **innerhalb A** und **B -> A** (inkl.
  `error-correction -> free_text` und ein-blockig `cloze(select) -> free_text`).
  `RC <-> GQ` ist KEIN sauberes Paar: beide Richtungen brauchen ein Feld, das die
  Quelle nicht hat (GQ->RC das `passage`, RC->GQ die `points`) -> Ergänzung. Der
  Rest ist Neuerfindung (Medien-Assets, Paare, Passagen). Ein begründetes Weniger
  ist die Antwort.
- **Fortschritt (Fundstelle) [korr. 2026-08-15]:** SRS/Fehler hängen an
  `(exercise_id, element_key, ...)`; `exercise_id = stable_id ?? id` überlebt
  (`exercise-identity.ts`), `element_key` ist der typ-abhängige kanonische
  Antwort-Text (`element-keys.ts`). Bleibt die Schlüsselmenge gleich, geht der
  Fortschritt mit. Wandert sie, wird sie beim Speichern umgeschlüsselt -
  `CreateLesson.saveLocally` ruft `carryOverReviewProgress` (#2519/#2566), das
  `certain` automatisch überträgt und `uncertain` meldet. Der stille Verlust ist
  ausgeschlossen.
- **Ergänzung / Vorschau:** Nutzer-Eingabe oder Modellvorschlag, nie stille
  Erfindung; der bestehende Inline-Editor (Entwurf + Speichern/Abbrechen +
  Validator-Gate) ist bereits die Vorschau.
- **Ort / unmögliche Ziele / Rückgängig:** Typ-Feld im Zeilen-Editor; unmögliche
  Ziele ausgegraut + begründet (`aria-describedby`, wie #2510); kein eigener
  Undo-Stack (Abbrechen + Lektions-Historie genügt); ein bereits gespeicherter
  Roh-Antwortzustand wird bei Umwandlung verworfen.
- **Zuschnitt / kleinster Wurf [korr. 2026-08-15]:** Stufe 1 (alle
  schlüssel-erhaltenden `-> free_text`-Umwandlungen) ist ausgeliefert
  (#2596/#2609). Rest von Stufe 2: die schlüsselerhaltenden Nachzügler
  (`error-correction`, ein-blockig `cloze`) plus eine Vor-Ansage NUR für die
  `uncertain`-Fälle (`cloze` N -> 1) - kein Remap-Heben nötig, das ist da. Dann
  E-mit-Nutzereingabe (inkl. `RC <-> GQ`), dann E-mit-KI-Vorschlag. Nicht bauen:
  Medien-/Struktur-Ziele aus Text, Umwandlungs-Undo-Sonderweg, single/multiple
  als zweite Bedienung, stiller Verlust.

**Offene Fragen / Annahmen:**
- Angenommen, dass die Schlüssel-Erhalt-Prüfung rein aus Quelle+Zielabbildung
  rechenbar ist (belegt durch die deterministischen Regeln in `element-keys.ts`
  und die Stufe-1-Umsetzung `conversionPreservesElementKeys`). Bestätigt.
- ~~Ob Stufe 2 die Remap-Technik auf den Editier-Weg hebt oder nur eine Ansage
  zeigt~~ **[korr. 2026-08-15: erledigt]** — der Editier-Remap ist seit
  #2519/#2566 gehoben; die Frage ist keine offene Produktentscheidung mehr. Die
  historische Formulierung darunter bleibt als Beleg stehen, ist aber
  überholt.
  Dokument als Empfehlung, nicht als Festlegung, formuliert.
