# Chat Journal - Session 2026-08-17

## 1. Import-Overwrite trägt SRS-/Fehlerhistorie mit (#2592)

- Ursprünglicher Prompt: "machen wir weiter mit: .../issues/2592"
- Optimierter Prompt: "Implementiere #2592 (Import-Overwrite verwaist SRS-/Fehlerhistorie
  still). Nutze die volle Variante aus der Fixrichtung (beide Remap-Dimensionen wie der
  Repo-Update-Pfad), nicht die minimale — das Szenario im Issue nennt ausdrücklich auch
  eine umbenannte Übungs-Id. Verifiziere vor der Implementierung die
  `ElementError.lesson_id`-Konvention gegen den echten Schreiber."
- Ziel: `ImportLessonModal.overwrite()` darf beim Überschreiben eines kollidierenden Sets
  keine Fortschrittszeilen mehr still verwaisen.
- Ergebnis: neues `lib/content/lesson/import-remap.ts` (peek vor dem Save, Plan über beide
  Dimensionen, Anwendung nach dem Save), verdrahtet in `overwrite()`. Der reine Planer
  wurde aus `plan-set-update.ts` als `planRemapsForVersions` extrahiert, damit alle drei
  Eintrittspunkte (Repo-Update, lokaler Edit-Save, Import-Overwrite) EINEN Planer teilen
  statt die Reihenfolge (exercise_id zuerst, dann element_key) je Aufrufer neu abzuleiten.

### Warum die vollständige Variante

Das Issue bot eine minimale (nur `element_key`) und eine vollständige Variante (inkl.
`exercise_id`-Remap, #2569) an. Das im Issue beschriebene Szenario nennt beide Ursachen
("ein Antworttext korrigiert **oder eine Übungs-Id umbenannt**"). Die minimale Variante
hätte genau die zweite Hälfte offen gelassen — also die "sibling facet fixed in isolation
is the seed of recurrence #3"-Falle aus `lessons/content-storage.md`, in einem Issue, das
sich selbst als vierte Wiederholung derselben Klasse führt.

## 2. Nebenbefund: #2566 war ausgeliefert und wirkungslos (#2657)

Beim Verifizieren der `lesson_id`-Konvention für den Import-Pfad (Pflichtschritt, weil der
Filter auf dieser Konvention steht) fiel auf, dass der Geschwisterpfad sie falsch hat:

- `edit-remap.ts` filterte auf `lessons/{id}.json`.
- Der einzige Schreiber (`lib/srs/element-attempt.ts:55`) bekommt seinen Wert aus
  `listLessons()`, und das STREIFT das `lessons/`-Präfix ab (`content-loader-read.ts`);
  `getLesson()` setzt es selbst wieder davor.
- Folge: `identities.length === 0`, Rückgabe `{applied: 0, uncertain: 0}`, `remapKeys` nie
  gerufen. Der #2519/#2566-Fix war ein stiller No-op — auch im "meldet statt schweigt"-Fall.

Empirisch belegt, bevor das Issue geschrieben wurde (GITHUB-ISSUE-PFLICHT "verify the
premise before filing"): `edit-remap.test.ts` mit der ECHTEN Zeilenform durchgereicht,
sonst unverändert → 3 von 6 Tests fallen um.

Grund, warum es grün war: der Test definierte EINE Konstante `FILE_PATH` und benutzte sie
für die Fixture-Zeile UND die Erwartung. Fixture und Modul waren sich einig und beide
falsch — die Klasse aus `content-storage.md` "Hand-built fixtures encode the author's
assumption", diesmal in der Variante "die Fixture leitet den geprüften Wert aus dem
geprüften Modul ab". Als Lektion dort ergänzt (Ratchet-Ceiling bewusst um 826 Zeichen
gehoben, siehe Commit).

Mitgefixt in diesem PR statt separat, weil die Konvention die gemeinsame Wurzel ist: einen
Pfad zu reparieren und den inerten Zwilling stehen zu lassen wäre genau die Wiederholung,
die #2592 selbst anprangert.

## 3. Falschannahme im eigenen Verlauf korrigiert

Zwischenzeitlich als "Modus-Diskrepanz" notiert, dass API-Mode `include_mastered` nicht
sendet. Nachgeprüft: beide Modi haben `includeMastered` DEFAULT true (Backend-Query-Default
`True`; `listElementErrorsDexie` filtert nur bei explizitem `false`), der API-Client sendet
den Parameter also nur zum Abwählen. Kein Defekt — meine Assertion prüfte das Wire-Format
statt des Verhaltens. Assertion auf "fragt nie ab, mastered auszuschließen" korrigiert und
der eigene, falsche Kommentar in `edit-remap.ts` richtiggestellt.

## 4. Tests

- `import-remap.test.ts` (10): Orchestrierung — beide Dimensionen, uncertain wird gemeldet,
  No-op ohne Zeilen, Reihenfolge exercise → element, nicht lesbare Lektion → uncertain.
- `import-remap.modes.test.ts` (4, #2053): je ein Pin pro Storage-Modus gegen die ECHTEN
  Implementierungen über `getStorage()`. Dexie-Hälfte ist end-to-end über fake-indexeddb
  (echtes User-Set gespeichert, echter Attempt aufgezeichnet, Zeile danach zurückgelesen:
  `element_key` wirklich verschoben, `error_count` mitgewandert). API-Hälfte über
  `global.fetch` mit Prüfung des tatsächlichen POST-Bodies.
- `ImportLessonModal.carry-over.test.tsx` (6): der echte Kollisionsdialog; Peek VOR und
  Remap NACH dem Save als Reihenfolge-Assertion; Fixture-Key aus `elementIdentityKeysOf`
  abgeleitet statt getippt (siehe #2657).
- Gegenprobe bei allen neuen Pins: Fix entfernt → Tests rot (4/6 bzw. 5/9). Ein Gate, das
  ohne den Fix grün bliebe, prüft nichts.

### Green baseline
- `make test` vor der Arbeit: 8684 Vitest-Tests grün, exit 0.
- `bunx tsc --noEmit`, eslint auf allen geänderten Dateien: grün.

## Offene Fragen und Annahmen

- **Angenommen (aus Repo-Evidenz):** `ElementError.lesson_id` ist der nackte Dateiname.
  Quelle: der einzige Schreiber `element-attempt.ts:55` + alle drei Aufrufstellen
  (`Lesson.tsx` via Route-Param aus `listLessons()`, `useEndlessLesson.ts:162`,
  `useShuffleLesson.ts:127`) + `listLessonsDexie`'s `slice("lessons/".length)` +
  `getLessonDexie`'s Wieder-Voranstellen. Kein Schreiber im Baum erzeugt die Präfix-Form.
- **Nicht geändert:** die `retiredCards`-/Archiv-Logik des Repo-Pfads (#2188) hat auf dem
  Import-Pfad kein Gegenstück — eine importierte Datei deklariert keine Retirements. Bewusst
  ausgelassen, nicht vergessen.
- **Manuell offen:** der Fortschritts-Round-Trip aus dem Testplan (#2592-Fälle) ist
  Handarbeit im laufenden `make dev`; in dieser Session nicht ausgeführt.
