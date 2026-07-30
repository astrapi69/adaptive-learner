# EXP-046: Bearbeiten fremder Inhalte und Autorenzuschreibung

**Kategorie:** Querschnitt (Content-Lifecycle + Zuschreibung) · **Phase:**
Analyse (keine Umsetzung in diesem Dokument) · **Priorität:** P2/P3 (kein
Datenverlust-Blocker; die akute Datenverlust-Facette gehört #2128) ·
**Abhängig von:** EXP-023 (Multi-Content-Repository), EXP-025 (AUTH-06,
Fork-Policy), EXP-026 / #97 (`variation_of`-Ansicht), EXP-045 / #2130 / #2128
(Content-ID-Stabilität, Fortschritts-Orphaning) · **Issue:** #2189
(Sammel-Issue)

> Explorationsdokument. Kein Code, keine Schema-Änderung, nur Ist-Aufnahme,
> Optionen und Abstimmungsbedarf. Die Frage ist klein formuliert und hat weite
> Folgen: Es soll eine Autorenangabe für Sets und Lektionen geben, und der
> Autor soll die Lektionen bearbeiten können. In einer App ohne Konten und
> ohne Server kann Bearbeitung nicht an eine Person gebunden werden, wer die
> Daten auf dem Gerät hat, kann sie ändern, und das ist beim Anspruch freier
> Inhalte richtig so. Die tragfähige Frage lautet deshalb: Was passiert, wenn
> jemand fremde Inhalte bearbeitet?

---

## 0. Kernbefund vorweg

Der zentrale, überraschende Befund der Ist-Aufnahme: **Die App bearbeitet
fremde Inhalte heute schon nicht in-place, sondern zweigt sie ab.** Ein
heruntergeladenes Set (Quelle ungleich `user-generated`) ist in der UI
read-only, es gibt keinen Bearbeiten-Knopf. Wer es bearbeiten will, erzeugt
zwangsläufig zuerst eine user-generierte Kopie (Fork), und nur diese eigene
Kopie wird in-place überschrieben. Die im Prompt befürchtete Kollision
(Aktualisierung überschreibt die Arbeit des Nutzers, oder wird stillschweigend
zurückgehalten) **kann den Bearbeitungen eines Nutzers gar nicht passieren**,
weil es keinen In-place-Pfad auf fremde Inhalte gibt und der Fork vom Sync nie
berührt wird.

Damit verschiebt sich die eigentliche Arbeit von "Abzweigen oder Ändern
entscheiden" (die Entscheidung ist architektonisch bereits gefallen) hin zu
drei offenen Lücken: die **Abstammung** wird beim Fork nicht festgehalten, es
gibt **keine Set-Autorenangabe**, und die **Weitergabe-Warnung für
mitgereiste Fremd-Credits** fehlt. Die grösste Schadensklasse (Verlust von
Lernfortschritt bei einer Aktualisierung) betrifft nicht die Bearbeitung,
sondern das nicht-abgezweigte Original, und ist bereits als #2128 / EXP-045
erfasst, an diese Spur wird verwiesen, nicht dupliziert.

---

## Teil 1: Ist-Aufnahme (mit Fundstellen)

### 1.1 Was passiert heute beim Bearbeiten eines importierten Sets?

**Heruntergeladene Sets sind read-only. Es gibt keinen Bearbeitungspfad auf
sie.** Die Set-Liste wird exakt an der Quelle geteilt:

- `frontend/src/pages/content/Content.tsx:205-206`:
  ```ts
  const userSets = sets.filter((s) => s.source === USER_GENERATED_SOURCE);
  const downloadedSets = sets.filter((s) => s.source !== USER_GENERATED_SOURCE);
  ```
- Nur `userSets` bekommen einen `onEdit`-Handler (`Content.tsx:377`
  `onEdit: handleEditUserSet`). Der Konfigblock für `downloadedSets`
  (`Content.tsx:359-372`) trägt `onOpen`, `onAiCheck`, `onSetStatus`,
  `onDelete`, aber **kein `onEdit`**. Der Bearbeiten-Knopf lebt nur in
  `frontend/src/components/content/lessons/UserSetActions.tsx:41-61`, erreichbar
  nur aus den "Meine Lektionen"-Zeilen.

**Der einzige Weg, fremde Inhalte zu bearbeiten, ist der Fork.** Ein
heruntergeladenes Set wird über `ImportLessonModal`
(`frontend/src/components/content/lessons/ImportLessonModal.tsx:80-119`) als
user-generierte Kopie gespeichert (`saveUserSet` mit `origin: "imported"`, bei
ID-Kollision `nextCopySetId` auf eine neue ID). Zusätzlich gibt es im
Lesson-Creator eine explizite "Als Kopie speichern"-Aktion
(`frontend/src/pages/lesson/CreateLesson.tsx:587-633`, #1740): neue `set_id`
via `nextCopySetId`, `origin: "imported"`, Original bleibt unberührt, die
Buchreferenz wird mitgenommen (#1989). **Keiner dieser beiden Fork-Pfade setzt
`variation_of`**, die Abstammung wird also nicht festgehalten (siehe 1.2 und
Teil 3).

**User-generierte Sets (inklusive der "imported"-Kopien) werden in-place
überschrieben.** Der Save-Pfad `saveUserSetDexie`
(`frontend/src/storage/content/content-loader-user-sets.ts:21,31-36,66`) nutzt
eine feste `USER_SET_VERSION = "1.0.0"` und macht ein `_purgeSetRows` vor dem
`put`, ein bewusstes Überschreiben ("re-saving an edited lesson overwrites in
place rather than accumulating versions"). Backend-Spiegel:
`plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/service.py:557-625`
`save_user_set` (`_remove_set_dir` dann `store_set`).

**Zusammengefasst:** In-place-Mutation trifft ausschliesslich die eigene Kopie
des Nutzers. Fremde Inhalte werden nie in-place verändert, die Architektur
erzwingt den Fork über die Quellgrenze `source === USER_GENERATED_SOURCE`.

### 1.2 Welche Herkunftsangaben führt die App bereits?

Es gibt kein einzelnes "Provenance"-Objekt, sondern mehrere Marker:

| Marker | Fundstelle | Zweck / Anzeige |
|---|---|---|
| `source` (Repo-Slug `owner/name`) | `frontend/src/storage/types/content/content.ts:44`; DB `backend/app/models/__init__.py:1351` | Primärer Herkunftsmarker. `isOfficialSource()` (`frontend/src/lib/content/repos/source-identity.ts:22-24`, `OFFICIAL_SOURCE`, `BUNDLED_PREFIX`). Angezeigt via `ContentSetOriginBadges`/`RepoCategoryBadge` (offiziell/privat/validiert/unverifiziert), `ContentSetRow.tsx:82-107` |
| `USER_GENERATED_SOURCE = "user-generated"` | `content.ts:373`; Backend `metadata={"author":"user","origin":origin}` `service.py:600` | "Selbst erstellt". Trennt "Meine Lektionen" von heruntergeladenen Sets |
| `UserLessonOrigin = "analysis" \| "adaptive" \| "imported"` | `content.ts:377` (im Feld `domain`) | Wie eine eigene Kopie entstand. Steuert das Edit-Routing (`useContentSetActions.ts:413-422`) |
| `source_language` / `target_language` | `schema/content-set.schema.json:196-216`; `content.ts:57-62` | Sprach-Herkunft, zur Importzeit gesetzt, downstream vererbt (`content-storage.md:64-82`) |
| `Lesson.contributed_by` / `contributed_at` | `schema/lesson.schema.json:1007-1034` | Opt-in Autoren-Credit beim Teilen. Angezeigt als dezente Credit-Zeile im Viewer + in der PR |
| `Lesson.variation_of` / `variation_note` | `schema/lesson.schema.json:1144-1170` (Phase 64B) | Einfacher Abstammungs-Link: hält die ID der Original-**Lektion** (maxLength 120), plus eine kurze Notiz |
| `ContentSetBook.author` | `schema/content-set.schema.json:45-57` | Autor des **referenzierten Buchs**, nicht des Sets |
| `cached_version` / `downloaded_at` / `version` | `content.ts:65-77` | Download-/Cache-Provenienz. "heruntergeladen" wird aus `cached_version !== null` abgeleitet, es gibt kein Boolean-Flag |

**Lücke:** Es gibt **keine Set-Autorenangabe** und **keinen
Set-Abstammungs-Link**. Der einzige echte Content-Zuschreibungsmarker heute ist
das lektions-ebene `contributed_by`/`contributed_at`, und `variation_of` als
einfacher Ein-Schritt-Link, ebenfalls nur auf Lektionsebene.

### 1.3 Was passiert, wenn ein bearbeitetes importiertes Set später eine Aktualisierung erhält?

Real durchgespielt, nicht abgeleitet:

**Fall A, die eigene bearbeitete Kopie (der Fork).** Der Fork lebt unter
`source: "user-generated"`. Der Update-/Sync-Weg fasst diese Kopie **nie** an:
`syncUserRepo` (`frontend/src/lib/content/repos/content-repos.ts:336-411`) und
der stille 24h-Auto-Sync (`useContentRepoAutoSync.ts`) laufen über verbundene
**Repos**, nicht über den `user-generated`-Namensraum. Ergebnis: **Der Fork
ist dauerhaft entkoppelt, eine Aktualisierung berührt ihn nicht und kollidiert
nie mit den Bearbeitungen des Nutzers.** Das ist genau das
"Abzweigen"-Ergebnis aus dem Prompt, und es ist bereits strukturell wahr.

**Fall B, das nicht-abgezweigte Original.** Hier greift der reale Schaden, und
er betrifft nicht Bearbeitungen, sondern **Lernfortschritt**. Beim Anwenden
eines Updates überschreibt `downloadSetDexie`
(`frontend/src/storage/content/content-loader-download.ts:142-219`) die
gecachten Inhalte und prunt alte Versionen, nur der Lifecycle-Status
(active/deferred/completed) wird übernommen. Fortschritts- und SRS-Zeilen
liegen in getrennten Tabellen und werden nie migriert, sie verwaisen, wenn der
Autor Identitäts-Strings geändert hat. Das ist #2128.

Es gibt einen **Aktualisierungsschutz**, aber er ist ein Identitäts-/
Fortschritts-Wächter, **kein** Wächter für lokale Änderungen:

- `frontend/src/lib/content/update/update-impact.ts:137-168`,
  `computeUpdateImpact()` vergleicht die vom Lerner gehaltenen Identitäten
  gegen die der eingehenden Version, `breaking = lostLessons.length > 0 ||
  lostCards.length > 0`. Ein reines Superset (neue Lektionen/Übungen) ist nie
  breaking.
- Orchestrierung `assess-set-update.ts`, Peek ohne Anwenden
  `storage/content/peek-set.ts`.
- Manueller "Update"-Knopf: breaking wird hinter einem quantifizierten Dialog
  gehalten ("Update may reset some review progress", `Content.tsx:441-465`).
- Stiller 24h-Auto-Sync: breaking wird **still übersprungen**
  (`content-repos.ts:365-382`), das Set bleibt auf `update_available`.

Der Schutz ist **partiell**: positionsbasierte `exercise_id`-Verschiebungen,
`element_key`-Tippfehlerkorrekturen (der Antworttext IST der Schlüssel) und
Lektions-Umbenennungen verwaisen weiterhin still, festgehalten in
`frontend/src/lib/content/browse/set-update-orphaning.test.ts`.

**Fazit Teil 1:** Die Schadensklasse mit dem grössten Potenzial ist nicht
"meine Bearbeitungen werden überschrieben" (kann nicht passieren), sondern
"mein Fortschritt am Original verwaist bei einer Aktualisierung", und das ist
die laufende Spur #2128 / #2130 / EXP-045. EXP-046 bestätigt sie und verweist
dorthin, statt sie zu duplizieren.

---

## Teil 2: Abzweigen oder Ändern

### 2.1 Die Entscheidung ist architektonisch bereits gefallen

Es gibt **keinen In-place-Änderungspfad auf fremde Inhalte**, gegen den man
sich entscheiden könnte, er existiert schlicht nicht (Teil 1.1). Die App
zweigt heute ab. Damit ist die Frage "Abzweigen oder Ändern" faktisch schon
zugunsten von **Abzweigen** beantwortet, und das ist die richtige Antwort.

**Empfehlung: Abzweigen (Fork) beibehalten und formalisieren.** Begründung:

1. Es ist bereits das einzige Verhalten, jede In-place-Alternative wäre ein
   Rückschritt.
2. Es umgeht die Aktualisierungs-Kollision vollständig: Der Fork ist vom Sync
   entkoppelt (Teil 1.3, Fall A).
3. Es deckt sich mit EXP-025 Entscheidung **E6 / AUTH-06** (Fork-statt-Mutation)
   und mit EXP-026 / #97 (`variation_of`-Ansicht, Badge "Eigene Bearbeitung").
4. Es entspricht dem Anspruch freier Inhalte: Der Nutzer besitzt seine Kopie,
   das Upstream-Repo besitzt seine, keine Seite überschreibt die andere.

Die Kosten des Abzweigens aus dem Prompt (Speicher, zwei Sets mit ähnlichem
Namen, Verwechslungsgefahr) bleiben real, sind aber klein und adressierbar: Der
Namenszusatz "(copy)" (`create_lesson.save.copy_suffix`) und ein Badge "Eigene
Bearbeitung" (EXP-026 UGC-03) trennen Original und Fork sichtbar.

### 2.2 Was der Aktualisierungsschutz dazu beiträgt

Der bestehende Aktualisierungsschutz (#2128, Teil 1.3) schützt **Fortschritt
am Original** vor stillem Orphaning. Er schützt den Fork **nicht** und muss es
auch nicht, der Fork wird nie synchronisiert. Der Schutz ist also orthogonal
zur Fork-Entscheidung, verstärkt sie aber: Am Original behält man
fortschritts-geschützte Updates, am Fork behält man seine Bearbeitungen
unberührt. Saubere Trennung.

### 2.3 Folgen für den Lernfortschritt

Der Lernfortschritt hängt an String-IDs ohne Fremdschlüssel (empirisch
bestätigt):

- `LessonProgress`: `(user_id, source, set_id, lesson_filename)`
  (`backend/app/models/__init__.py:1332-1340`; Dexie
  `frontend/src/storage/lessons/lesson-progress-dexie.ts:28-35`).
- `ElementError` / SRS: `(user_id, set_id, lesson_id, exercise_id, element_key,
  direction)` (`models:1528-1541`; Dexie `element-errors-dexie.ts:42-54`),
  **ohne `source`**.
- Set-Status: `source::set_id` (`set-status-store.ts:56-58`). Favoriten:
  `setId::filename` (`favorites.ts:67-69`).

Ein Fork prägt eine **neue `set_id`** (`nextCopySetId`) unter `source =
user-generated`. Damit gilt: **Der Fortschritt folgt nicht, wird nicht
dupliziert, bleibt am Original, der Fork startet mit weisser Weste.**

**Entscheidung für den Fortschritt beim Abzweigen: Er bleibt beim Ursprung,
er wandert nicht mit.** Begründung: Der Fork ist eine divergierende Kopie,
Fortschritt mitzunehmen würde Wiederholungshistorie fälschlich gegen
veränderten Inhalt gutschreiben, exakt die Orphaning-Gefahr, die #2128
dokumentiert. Wer seinen Original-Fortschritt will, lernt weiter am Original.
Ein Best-effort-Remap über eine ID-Änderung hinweg ist die einzige
prinzipielle Art, Fortschritt mitzunehmen, und die gehört zur Identitäts-Spur
(EXP-045 Option C), nicht hierher.

**Falle, dokumentiert zur Vermeidung:** Weil `ElementError` **ohne `source`**
keyt, würde ein Fork, der dieselbe `set_id` behält und nur die `source`
ändert, die SRS-Zeilen kollidieren/mitwandern lassen, während
`LessonProgress` verwaist. Der heutige Fork-Pfad vergibt eine neue `set_id`,
also beisst diese Kante nicht, ein künftiger Fork darf `set_id` aber nie
wiederverwenden.

---

## Teil 3: Autorenangabe und Zuschreibung

Zweck ist Zuschreibung, nicht Berechtigung.

### 3.1 Anzeige der Autorenangabe

Autor anzeigen, wo er existiert und sinnvoll ist:

- **Lektions-Viewer:** die bestehende dezente Credit-Zeile aus `contributed_by`
  ("by {author}", i18n `content.lesson.by_author` bzw. `contributed_by:
  Contributed by {name}`).
- **Set-/Repo-Header eines heruntergeladenen Sets:** der Repo-Autor aus dem
  Manifest ("About this source"-Panel, `manifest_generated.py:187`).
- **Fork ("Eigene Bearbeitung"):** Badge plus eine "basiert auf"-Zeile (siehe
  3.2).

Kein Autor-Feld erzwingen, wo keiner da ist, die Angabe ist optional und
selbst deklariert.

### 3.2 Ableitungskette

Wird ein fremdes Set/eine Lektion bearbeitet und weitergegeben, darf der
ursprüngliche Name nicht unverändert stehen bleiben. Entwurf:

- **Lektionsebene:** `variation_of` hält bereits die Original-Lektions-ID
  (ein Schritt). Der Fork-Pfad muss dieses Feld künftig setzen (heute tut er
  es nicht, Teil 1.1). Der ursprüngliche `contributed_by` wird als
  "basiert auf {Original}"-Credit erhalten, der eigene Credit des Bearbeiters
  separat gesetzt.
- **Kette ohne unbegrenztes Wachstum:** Die Kette wird **beschränkt**, nicht
  vollständig. Modell: {ursprünglicher Autor, aktueller Bearbeiter}, mit
  Kollaps der Zwischenschritte zu "und andere". Anzeige: **eine** kompakte
  Zeile, "Bearbeitet von X, basiert auf Y" (bzw. "Bearbeitet von X, basiert auf
  Y und andere"), keine vollständige Stammbaum-Ansicht. So bleibt die
  Oberfläche unbelastet und die Datenmenge konstant.
- **Setebene:** Es gibt heute keinen Set-Abstammungs-Link. Empfehlung: für den
  MVP genügt die Aggregation der lektions-ebenen `variation_of`, ein
  set-ebenes `derived_from` (Eltern-Set-ID plus Original-Autor-String) ist die
  saubere Ergänzung und wird als Schema-Bedarf angemeldet (Teil 5).

### 3.3 Der Name ist unbelegbar

Nirgends so darstellen, als wäre er geprüft: **kein Haken, kein
"verifizierter Autor", kein Badge, das Echtheit suggeriert.** Reiner
Text-Credit. Eine echte "verifizierter Autor/Verlag"-Stufe ist bewusst
zurückgestellt (EXP-025 AUTH-09, braucht ein geteiltes Backend). Ein kurzer
i18n-Hinweis, dass Credits selbst angegeben sind, gehört an die Anzeige.

### 3.4 Personenbezug: der Hinweis an der Stelle des Teilens

Die Angabe reist beim Teilen mit. Der Nutzer muss das wissen, bevor sie
sichtbar wird, und er muss sie weglassen können. Dieser Hinweis existiert
heute schon für den **eigenen** Namen:

- `frontend/src/components/content/share/ShareWizardStep1.tsx:264-305`:
  optionales Namensfeld, Toggle "Show name in lesson" (für neue Nutzer
  standardmässig aus, `showName` wird aus `readContributorName() !== ""`
  initialisiert), und der Datenschutzhinweis
  `content.credit.privacy`: "Your name will be shown in the lesson and the pull
  request." Der Credit wandert nur mit, wenn ein Name eingetragen UND der
  Toggle an ist (`useShareWizard.ts:405`, `contributed_by` nur dann gesetzt).

Damit sind drei der vier Anforderungen bereits erfüllt: Opt-in, an der Stelle
des Teilens (nicht in einer Datenschutzseite), weglassbar.

**Lücke:** Der bestehende Hinweis deckt nur den **eigenen** Namen. Er deckt
**nicht** den **mitgereisten Fremd-Credit** ab, wenn ein Fork weitergegeben
wird (der `contributed_by` des Originals oder die "basiert auf"-Kette aus 3.2).
Der Entwurf muss den Share-Hinweis erweitern:

- **Anzeigen**, dass vorhandene Credits im Inhalt mitreisen.
- **Entfernen** per Ein-Klick ermöglichen ("Credits entfernen").

**Vorgeschlagene Formulierung** (DE + EN, echte Umlaute, kein Em-Dash, finale
Übersetzung in alle 8 Sprachen im Umsetzungs-PR):

- Eigener Name (bestehend, unverändert): "Dein Name wird in der Lektion und in
  der Pull Request angezeigt." / "Your name will be shown in the lesson and the
  pull request."
- Mitgereister Fremd-Credit (neu): "Dieser Inhalt nennt {Autor} als Urheber.
  Der Name reist beim Teilen mit, du kannst ihn entfernen." / "This content
  credits {author}. Their name travels when you share, you can remove it."

Der Hinweis gehört an dieselbe Stelle wie der bestehende (ShareWizard
Schritt 1), direkt neben dem Namensfeld.

---

## Teil 4: Was ausdrücklich nicht gebaut wird

- **Keine Bearbeitungssperre auf Grundlage der Autorenangabe.** Sie wäre nicht
  durchsetzbar (die Daten liegen lokal), trivial zu umgehen und widerspräche
  dem Anspruch freier Inhalte. Das wird als bewusste Entscheidung dokumentiert,
  damit es nicht später als Lücke gemeldet wird. (Zusatzbefund: die App bietet
  für fremde Inhalte ohnehin keinen In-place-Edit, eine Sperre hätte also gar
  kein Angriffsziel.)
- **Warnungen beim Bearbeiten fremder Inhalte sind zulässig und sinnvoll,
  Verbote nicht.** Ein Hinweis "Du bearbeitest eine Kopie fremder Arbeit"
  (bzw. beim Fork-Start) ist erwünscht, ein Blockieren nicht.

---

## Teil 5: Angemeldeter Schema-Bedarf

Das Schema ist ein Spiegel von `learn-content-engine` (Pin `0.14.0`,
`frontend/package.json:78`, `schema/engine-version.txt`). Ein direktes
Editieren von `schema/*.json` in diesem Repo ist verboten
(ci-gates.md #1993, `engine-parity-check` byte-gated). Der korrekte Weg ist:
Bedarf **stromaufwärts** in `learn-content-engine` anmelden und entscheiden,
dort als neue Engine-Version releasen, hier den Pin bumpen und `make
sync-schema` im selben PR ausführen.

**Angemeldeter Bedarf (nicht app-seitig improvisieren):**

1. **Set-ebenes `contributed_by` / `contributed_at`** (selbst deklariert,
   opt-in), analog zum bestehenden lektions-ebenen Feld. Heute kodiert ein
   Set-ZIP-Export den Autor fest als `author: "user"`
   (`frontend/src/lib/content/lesson/lesson-export.ts:77`), es gibt kein echtes
   Set-Autoren-Feld.
2. **Set-ebenes `variation_of` / `derived_from`** (Eltern-Set-ID plus optionaler
   Original-Autor-String), das lektions-ebene `variation_of` auf Setebene
   spiegelnd. Beschränkt (ein Elternteil plus Original-Autor-String), keine
   unbegrenzte Kette.

**Abstimmung:** Diese beiden Bedarfe zusammen mit der `stable_id`-Anmeldung aus
#2130 / EXP-045 an die Engine geben, damit die Schema-Änderungen gebündelt
entschieden werden. Ausdrücklich: die Felder **nicht** nur in den Spiegel
dieses Repos legen, der Paritäts-Gate würde brechen und es würde driften.

---

## Teil 6: Priorisierter Umsetzungsvorschlag

Klein zuerst, an bestehende AUTH-/EXP-Aufgaben angelehnt. Nichts davon ist ein
MVP-Blocker.

| Prio | Schritt | Umfang | Bezug |
|---|---|---|---|
| 1 | **Non-Goals dokumentieren:** keine Edit-Sperre, Fork-statt-Mutation ist das gewollte Modell. Diese Exploration + ein Entscheidungseintrag. Verhindert Falschmeldungen. | XS (Doku) | Teil 4 |
| 2 | **Auffindbarkeit:** klare "Als Kopie bearbeiten"-Aktion auf heruntergeladenen Sets (heute nur über Import/Save-as-copy erreichbar), beide Speichermodi. | S (Frontend) | AUTH-06, Teil 1.1 |
| 3 | **Abstammung beim Fork festhalten:** `variation_of` (Feld existiert) beim Fork auf die Original-Lektions-ID setzen, Original-`contributed_by` als "basiert auf"-Credit mitführen, Badge "Eigene Bearbeitung" (EXP-026 UGC-03). Frontend-only. | S/M (Frontend) | EXP-026 #97, Teil 3.2 |
| 4 | **Share-Hinweis erweitern:** mitgereisten Fremd-Credit anzeigen + "Credits entfernen"-Ein-Klick (ShareWizard Schritt 1 erweitern). i18n in 8 Sprachen. | S (Frontend + i18n) | Teil 3.4 |
| 5 | **Schema-Bedarf anmelden:** Set-ebenes `contributed_by` + `derived_from` stromaufwärts bei `learn-content-engine`, gebündelt mit #2130. Danach Pin-Bump + `make sync-schema`. | M (cross-repo) | Teil 5 |
| 6 | **Zurückgestellt:** verifizierter Autor (AUTH-09, braucht Backend), Fortschritts-Remap über Fork/ID-Wechsel (EXP-045 Option C / Identitäts-Spur). | - | AUTH-09, EXP-045 |

---

## Teil 7: Fragen und Annahmen

**Evidenzbasiert beantwortet:**

- "Wird beim Bearbeiten in-place geändert oder abgezweigt?" Abgezweigt, fremde
  Inhalte haben keinen In-place-Pfad (Content.tsx:205-206, UserSetActions.tsx,
  saveUserSetDexie).
- "Was passiert bei einer Aktualisierung eines bearbeiteten Sets?" Der Fork
  wird nie synchronisiert, das Original orphant Fortschritt (content-repos.ts,
  content-loader-download.ts, #2128).
- "Wandert der Fortschritt beim Fork mit?" Nein, String-ID-Keys ohne FK, neue
  set_id, frische Weste (models, lesson-progress-dexie, element-errors-dexie).
- "Existiert der Personenbezug-Hinweis?" Ja für den eigenen Namen
  (ShareWizardStep1.tsx:264-305), nicht für mitgereiste Fremd-Credits.

**Annahmen (konservativ, im Umsetzungs-PR zu verifizieren):**

- Die genaue i18n-Formulierung der zwei Hinweiszeilen ist ein Vorschlag, die
  finale Fassung entscheidet der Autor beim Umsetzen (alle 8 Sprachen).
- Die Beschränkung der Ableitungskette auf {Original, aktuell} + "und andere"
  ist ein Design-Vorschlag, kein zwingender Wert, revidierbar, falls die
  Umsetzung Gegenargumente liefert.

**STOP-blockierend:** keine. Die Exploration ist vollständig aus
Repo-Evidenz ableitbar.

---

## Bewertung

Die scheinbar kleine Frage ("Autorenangabe plus Bearbeiten") löst sich in drei
saubere Teile auf. Die schwierige Hälfte (Abzweigen vs. Ändern, Kollision mit
Updates) ist architektonisch bereits gelöst: Die App zweigt ab, der Fork ist
vom Sync entkoppelt, die Kollision kann nicht passieren. Der reale Schaden
(Fortschritts-Orphaning) sitzt am Original und gehört der laufenden Spur #2128
/ #2130 / EXP-045, hier wird nur bestätigt und verwiesen. Der eigene Beitrag
von EXP-046 ist dreiteilig und klein: Abstammung beim Fork festhalten
(`variation_of` existiert), den Share-Hinweis um mitgereiste Fremd-Credits
erweitern (Infrastruktur existiert), und den Set-ebenen Autoren-/Abstammungs-
Bedarf beim Engine-Schema anmelden statt app-seitig zu improvisieren. Der
grösste Wert liegt nicht im Code, sondern in der klaren Grenze: Zuschreibung
ja, Berechtigung nein, und keine unbelegbare Echtheit vortäuschen.
