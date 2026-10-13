# Chat-Journal 2026-10-13 (ccw)

## 1. Bewertungsblock des Sets in der Prüfungs-Zusammenfassung (#3736)
- Original prompt: dann weiter mit https://github.com/astrapi69/adaptive-learner/issues/3736
- Optimized prompt: #3736 umsetzen: Re-Pin auf learn-content-engine 0.41.0 (`gradeFor`), den `evaluation`-Block des Sets im Prüfungsmodus statt der eigenen Bestehensgrenze anwenden (ungerundete Prozentzahl auf Element-Basis, erster Durchgang), als Autorenwertung kennzeichnen, `title` als Überschrift, `report: detailed` öffnet die Detailansicht; Übungsmodus und Sets ohne Block unverändert. i18n-PR zuerst, Testplan DE+EN im Feature-PR.
- Goal: Ein Set mit eigener Bestehensmarke oder Notentabelle wird nach den Vorgaben der Autorin oder des Autors bewertet, nicht nach der Schwelle des Lernenden.
- Result:
  - i18n vorab (#3737): sechs Keys unter `lesson.exam` in allen 11 Katalogen. Das Visual-Baseline-Gate (#3687) schlug an; die Keys haben noch keinen Konsumenten, darum `visual-baselines-unaffected` mit Begründung im PR-Body.
  - Neu `lib/lesson/summary/author-evaluation.ts`: `resolveAuthorEvaluation(evaluation, correct, total)` ruft `gradeFor` aus `learn-content-engine/rules` mit der ungerundeten Prozentzahl auf; `null` ohne Block, bei leerem Lauf und bei einem unmöglichen Ergebnis (Rückfall auf die eigene Schwelle statt Absturz).
  - `useLessonSetContext` liefert `setEvaluation` aus `listSets()`; beide Speichermodi tragen das Feld seit #3395 im Listing.
  - `LessonSummary`: nur im Prüfungsmodus ersetzt der Block die eigene Schwelle (Empfehlung 2 im Issue); `report: detailed` öffnet die Detailansicht, der Umschalter des Lernenden gewinnt danach. Nichts wird gespeichert (Empfehlung 3).
  - `LessonExamResult`: `pass_fail` zeigt Bestanden/Nicht bestanden mit der Autoren-Marke, `grades` die Note (mit `label_native`) und bei vorhandener Marke die Bestehenszeile, `percent` die Prozentzahl und die empfohlene Marke (kein `data-passed`, weil die Marke dort nur empfiehlt). `title` ersetzt die Überschrift, ein Hinweis nennt die Autorenwertung, `data-evaluation-source` ist `author` oder `learner`.
  - Tests (RED zuerst): `author-evaluation.test.ts` (14: pass_fail an, unter und über der Marke; 86,25 % erreicht die Zeile bei 86, 85,6 % nicht), `LessonExamResult.test.tsx` (+7), `LessonSummary.exam.test.tsx` (+5, Pilot-Szenario 7/10 bei eigener Grenze 80 %: bestanden mit Block, nicht bestanden ohne), `useLessonSetContext.test.tsx` (erweitert). Ohne die Änderung an `LessonSummary.tsx` scheitern Pilot- und Detail-Test.
  - Testplan TC-0955 (DE+EN): Pilot- und Kontroll-Lektion aus `adaptive-learner-content-test`.
  - Zwei Gates schlugen lokal an (`make ci`): Komplexität von `LessonSummary` 20 -> 24 und Dateigröße 944 -> 969 Zeilen (Grenze 950). Statt Baseline oder Whitelist: `resolveExamVerdict` und `resolveDetailedView` als reine, getestete Helfer (Komplexität jetzt 19) und die vier reinen View-Helfer unverändert nach `lib/lesson/summary/summary-view.ts` (899 Zeilen); beide neuen Module liegen in `lib/lesson/summary/`, weil `lib/lesson` sonst 16 Dateien hätte (Ordner-Guard, max. 15, erst im CI-Job des Komplexitäts-Gates aufgefallen).
- Commit: (dieser PR, Closes #3736).

## 2. Engine-Re-Pin auf learn-content-engine 0.42.0
- Original prompt: Re-Pin von learn-content-engine 0.41.0 auf 0.42.0. Was 0.42.0 bringt: nur die neue Autoren-Warnung W-MANIFEST-DESCRIPTION-COPY in validateManifestPair (learn-content-engine#268). Erwartung: keine Verhaltensänderung, keine messbare Bundle-Änderung.
- Optimized prompt: Pin 0.42.0 in `schema/engine-version.txt`, `frontend/package.json` und `frontend/bun.lock`; `make sync-schema` (keine Änderung), die drei Check-Targets, alle Suiten; Frontend vor und nach dem Pin bauen und Entry-Chunk, `AiValidationDialog` und die Summe aller JS-Chunks mit gzip -9 vergleichen.
- Goal: Die App steht auf 0.42.0; die Bundle-Neutralität ist gemessen.
- Result:
  - `validateManifestPair` ruft die App nirgends auf (grep über `frontend/src`).
  - Pin 0.41.0 -> 0.42.0; `make sync-schema` ändert keine Datei. `sync-schema-check`, `engine-parity-check` und `sync-openapi-check` sauber.
  - Bundle: Entry-Chunk `index-*.js` gzip 256994 -> 256994, `AiValidationDialog-*.js` gzip 39847 -> 39847, alle JS-Chunks 2567951 -> 2567951, je +0; auch roh und in der Chunk-Anzahl (241) keine Änderung. Die neue Regel liegt in `validateManifestPair`, das die App nicht importiert, darum fällt sie aus dem Bundle.
  - Suiten: Frontend tsc und ESLint sauber, Vitest 1091 Dateien / 12123 Tests bestanden; Backend 2286 bestanden, 1 übersprungen; Content-Loader 327 bestanden (Backend-venv); `make ci` und Ordner-Guard grün.
- Commit: (dieser PR).

## 3. Keine Sternskala neben der Autorenwertung (#3740)
- Original prompt: #3740 umsetzen (bug, UX, P2): Im Prüfungsmodus mit Set-Bewertung zeigt die Lektions-Zusammenfassung keine Sternskala und keinen Sterne-Lobtext mehr.
- Optimized prompt: Wenn `resolveExamVerdict` eine `authorEvaluation` liefert, `lesson-summary-stars` und die `encourage_0..3`-Nachricht weglassen; Punktebalken, XP, Konfetti und Persistenz unverändert; andere Modi und Prüfung ohne Block unverändert. Pilot-Titel "Hauptstadt-Prüfung" in TC-0955 und den Fixtures nachziehen.
- Goal: Ein Lauf hat genau eine Bewertung; sobald das Set eine erklärt, ist es die des Autors.
- Result:
  - Neu `showsStarScale(verdict)` in `lib/lesson/summary/author-evaluation.ts` (reiner Helfer); `SummaryScoreboard` bekommt `showStarScale`, die Sternzeile und die Nachricht stecken jetzt in einer eigenen `StarScale`-Komponente. Der Punktebalken bleibt.
  - Keine eigene Zuspruchzeile nach dem Urteil: das Issue nennt sie optional, die Prüfungskarte trägt das Urteil schon, und eine neue Zeile hätte einen eigenen i18n-PR gebraucht.
  - Tests (RED zuerst): Pilot im Prüfungsmodus ohne Sterne und Nachricht, Karte unverändert; `grades` und `percent` ebenso; Prüfung ohne Block und Übung mit Block mit Sternen wie bisher; Punktebalken bleibt. `showsStarScale` mit drei Fällen.
  - Grenzen lokal geprüft: Komplexität `LessonSummary` bleibt 19, `LessonSummary.tsx` 902 Zeilen, Ordner-Guard und Komplexitäts-Gate grün.
  - TC-0955 (DE+EN): Überschrift "Hauptstadt-Prüfung", keine Sterne beim Pilot, Sterne wie bisher bei der Kontrolle.
  - Suiten: ESLint sauber, Vitest 1091 Dateien / 12132 Tests bestanden; Backend 2286 bestanden, 1 übersprungen; Content-Loader 327 bestanden (Backend-venv); `make ci` grün.
- Commit: (dieser PR, Closes #3740).

## 4. Keine Prüfung aus einer Übungsrunde (#3742)
- Original prompt: #3742 umsetzen (bug, P1): Eine angefangene Runde, die in einem anderen Modus begonnen wurde, darf nicht als Prüfung fortgesetzt werden (und eine Prüfung nicht als Übung).
- Optimized prompt: Beim Öffnen einer Lektion den gespeicherten Modus der Runde mit dem aktuellen vergleichen; weichen sie ab und ist einer `exam`, zeigt der Fortsetzen-Dialog eine Erklärung und nur "Neu starten". Dazu ein Hinweis beim Prüfungsstart, ein Hinweis unter der Bestehens-Grenze, i18n vorab als eigener PR, e2e-Spec für den Ablauf.
- Goal: Eine Prüfung wertet nur Antworten unter Prüfungsbedingungen.
- Result:
  - i18n vorab (#3743): drei Keys in allen 11 Katalogen, Label `visual-baselines-unaffected` (noch kein Konsument).
  - Neu `lib/lesson/progress/resume-mode.ts`: `resumeModeConflict(progress, mode)`; Konflikt nur bei laufender oder pausierter Runde mit mindestens einer Antwort, abweichendem Modus und `exam` auf einer Seite; Zeilen ohne gespeicherten Modus gelten als Übung.
  - Befund über das Issue hinaus: der Dialog kam nur bei `paused`. Eine Runde im Zustand `in_progress` (App-Wechsel, gesperrtes Handy) lief bei einem Moduswechsel ohne jeden Dialog weiter. `useLessonFlowControl` zeigt den Dialog jetzt auch dann, und die Entscheidung wird beim Laden eingefroren: der 30-s-Autosave stempelt die Zeile sonst mit dem aktuellen Modus, und der Konflikt verschwände unter dem offenen Dialog.
  - `LessonResumeDialog`: im Konfliktfall Erklärung statt Pausen-Text, kein "Weiter", "Neu starten" mit der bestehenden Rückfrage.
  - `LessonExamNotice` (neben `LessonNoProfileNotice`, weil `chrome/` schon 15 Dateien hat) zeigt im Prüfungsmodus bis zur ersten Antwort den Hinweis; `LessonModeControl` den Satz unter der Bestehens-Grenze.
  - Grenzen: `LessonPage` bleibt bei Komplexität 20 (keine neue Verzweigung, die Komponenten entscheiden selbst), `LessonSummary` 19, Ordner-Guard und Komplexitäts-Gate grün.
  - Tests (RED zuerst): `resume-mode.test.ts` (11), `useLessonFlowControl.test.ts` (+8, auch der Autosave-Fall), `LessonResumeDialog.test.tsx` (+3), `LessonExamNotice.test.tsx` (6), `LessonModeControl.test.tsx` (1). Neue e2e-Spec `e2e/dexie/lesson-resume-mode.spec.ts`. Lokal nicht lauffähig: der Browser im Container lehnt das Proxy-Zertifikat ab (`ERR_CERT_AUTHORITY_INVALID`), auch die bestehende `lesson-pause-position.spec.ts` scheitert dort; Nachweis per Dispatch von `dexie-smoke.yml` auf dem Branch.
  - TC-0955 (DE+EN) um den Fortsetzen-Fall ergänzt.
  - Suiten: siehe PR.
- Commit: (dieser PR, Closes #3742).
