# Chat-Journal 2026-10-14 (ccw)

## 1. Eine Prüfung ist eine Sitzung (#3750)
- Original prompt: Ich hab alle Fragen richtig gehabt und trotzdem ist die Auswertung komplett falsch. ... Ja, ich hatte vorher Weiter gewählt. ... Okay, Empfehlung A und ich anlegen gleich fixen und wenn das gefixt ist einfach weitermachen nach Prio.
- Optimized prompt: Kontroll-Set im Prüfungsmodus zeigt 8/10 trotz richtiger Antworten. Erst nachstellen, dann Ursache benennen; Entscheidung A umsetzen: eine angefangene Prüfung, im Prüfungsmodus wieder geöffnet, wird nicht fortgesetzt, nur "Neu starten".
- Goal: Ein Prüfungsergebnis gehört zu genau einer Sitzung.
- Result:
  - Nachgestellt (Dexie-Build von develop, Playwright, GitHub-Anfragen über curl beantwortet, weil der Browser im Container das Proxy-Zertifikat ablehnt; TLS-Prüfung bleibt an): Kontroll-Lektion im Prüfungsmodus, alle richtig, ergibt 10/10, nach "Prüfung wiederholen" erneut 10/10. Keine Fehlwertung.
  - Ursache der 8/10: Aster hatte "Weiter" gewählt. Die Prüfung lief mit den gespeicherten Antworten einer früheren Sitzung weiter (zwei falsche); die Prüfung geht nur vorwärts, die alten Fragen kamen nicht wieder. #3744 blockiert nur einen Moduswechsel.
  - Nebenbefund bestätigt und als #3747 angelegt: ein Neustart setzt `time_spent_seconds` nicht zurück (9 s -> 20 s über einen Neustart), daher 35 bzw. 134 Minuten.
  - i18n vorab (#3751): ein Key in allen 11 Katalogen.
  - `resumeBlock(progress, mode, atSummary)` in `lib/lesson/progress/resume-mode.ts` liefert den Grund: `mode_conflict` (#3744) oder `exam_single_sitting` (neu). Eine Prüfung, die schon auf der Zusammenfassung steht, wird nicht blockiert, damit das Ergebnis beim Wiederöffnen sichtbar bleibt.
  - `useLessonFlowControl` gibt `resumeBlocked` statt `modeConflict` zurück (beim Laden eingefroren wie bisher); `LessonResumeDialog` zeigt per `blockReason` die passende Zeile (`lesson-resume-blocked`, `data-reason`). Die e2e-Spec zieht die umbenannte testid mit.
  - Tests (RED zuerst): `resume-mode.test.ts` (+9), `useLessonFlowControl.test.ts` (+3, zwei #3744-Fälle an die neue Regel angepasst: Prüfung -> Prüfung setzt jetzt nicht mehr fort), `LessonResumeDialog.test.tsx` (+1), e2e-Fall Prüfung -> Prüfung.
  - TC-0955 (DE+EN) um den Fall ergänzt.
  - Suiten: Frontend tsc und ESLint sauber, Vitest 1094 Dateien / 12176 Tests bestanden; Backend 2286 bestanden, 1 übersprungen; Content-Loader 327 bestanden (Backend-venv); `make ci`, Ordner-Guard und Komplexitäts-Gate grün. Dexie-Smoke-Dispatch (Lauf 38611602863) grün inklusive des neuen Falls.
- Commit: (dieser PR, Closes #3750).

## 2. Tipp auf "Oslo" als "Stockholm" gespeichert (#3752)
- Original prompt: (Screenshot "Fehler wiederholen", Norwegen, Stockholm als Antwort) Das ist falsch. ... Ja okay (Oslo angetippt, Stockholm gespeichert).
- Optimized prompt: Fehler-Wiederholung der Kontroll-Lektion mit genau diesen zwei Fehlern nachstellen, Desktop und Touch, gespeicherte Antworten prüfen.
- Goal: Klären, ob ein Tipp auf dem iPhone eine andere Antwort speichert.
- Result: In Chromium (Klick und Touch bei 390 x 844) speichert jeder Tipp die getippte Option, die Fehler-Wiederholung stellt beide Fragen frisch. WebKit fehlt im Container. Issue #3752 angelegt (P2 bis zur Reproduktion): Oslo und Stockholm tauschen zwischen den beiden Schritten die Position; nächster Schritt ist eine WebKit-Spec mit Touch.
- Commit: keiner (nur Issue).

## 3. Modus bleibt nach Neustart wählbar (#3746)
- Original prompt: wenn ich den Pilot Test ... starten will und Optionen wähle sind die ausgegraut ... wenn ich das neu neu starte, geht nur üben. (Weiter nach Prio.)
- Optimized prompt: Die Modus-Sperre an "Runde hat eine Antwort" statt an `status === "in_progress"` binden; Lebenszyklus-Logik (Auto-Pause, Autosave) bleibt beim Status.
- Goal: Nach "Neu starten" oder "Prüfung wiederholen" kann man wieder Prüfung wählen.
- Result:
  - Ursache: `markRestarted` setzt `in_progress` ohne Antworten, und die Positions-Schreibvorgänge (#3075) legen beim Lesen der Theorie ebenfalls eine `in_progress`-Zeile an; die Sperre hing an diesem Status.
  - `runHasAnswer` jetzt in `lib/lesson/progress/resume-mode.ts`, geteilt von Modus-Sperre und `LessonExamNotice` (vorher lokale Kopie). `useLessonFlowControl` gibt `modeLocked` zurück; `LessonPage` reicht es durch, ohne neue Verzweigung.
  - Tests (RED zuerst): `resume-mode.test.ts` (+7), `useLessonFlowControl.test.ts` (+4); e2e-Fall #3742 prüft nach dem Neustart und nach einem Theorieschritt, dass der Modus wählbar bleibt.
  - TC-0955 (DE+EN) ergänzt.
  - Suiten: ESLint sauber, Vitest 1094 Dateien / 12187 Tests bestanden; Backend 2286 bestanden, 1 übersprungen; Content-Loader 327 bestanden; `make ci`, Ordner-Guard und Komplexitäts-Gate grün. Dexie-Smoke-Dispatch (Lauf 38616824612) grün.
- Commit: (dieser PR, Closes #3746).

## 4. Tipp-Fehler in WebKit nicht nachstellbar (#3752)
- Original prompt: (weiter nach Prio)
- Optimized prompt: Die Kontroll-Lektion unter Playwrights WebKit mit iPhone-Profil und Touch spielen, im Examen und in der Fehler-Wiederholung, und die gespeicherten Antworten prüfen; reproduziert es nicht, Gerätedaten anfordern.
- Goal: Den iPhone-Befund auf der Engine prüfen, von der er kommt.
- Result:
  - Neuer Spec `e2e/webkit/select-cloze-tap.spec.ts` mit der echten Kontroll-Lektion als Fixture (`e2e/fixtures/evaluation-pilot-control.lesson.json`) über ein gemocktes Repo, jede Option per `locator.tap()`.
  - Zwei rote Läufe waren Spec-Fehler: unter WebKit holte der Service Worker das gemockte Repo an `page.route` vorbei. Service Worker im Spec gesperrt; die Ursache stand erst nach einem temporären `github`-Reporter lesbar in den Annotations (danach zurückgenommen).
  - WebKit-Lauf 38624500932 grün: Examen 10 von 10, Fehler-Wiederholung wertet Stockholm und Oslo richtig. Nicht reproduziert; Playwrights WebKit ist kein iOS Safari. Gerätedaten im Issue angefragt, bleibt P2.
- Commit: 30dea91bb (#3755).

## 5. Paritätstest der Set-Projektion (#3711)
- Original prompt: (weiter nach Prio)
- Optimized prompt: Eine Falldatei, die TS-Engine (`asContentSetEntry`) und Python (`SetEntryResponse.from_entry`) beide durchlaufen, mit strikter Gleichheit; Abweichungen in der Datei deklarieren statt verstecken.
- Goal: Die beiden handgeschriebenen Projektionen können nicht mehr unbemerkt auseinanderlaufen.
- Result:
  - `tests/fixtures/set-entry-parity/cases.json` (15 Fälle, von Hand aus dem Manifest-Vertrag), Vitest- und pytest-Seite vergleichen die ganze Ausgabe.
  - Deklariert, nicht angeglichen: ohne `target_language` sowie `visibility`/`review_status` außerhalb der Werte lehnt der API-Loader ab, die Engine setzt `""`/`visible`/`authored`; `evaluation` kommt im API-Modus mit Schema-Defaults. Ob angeglichen wird, ist eine Owner-Entscheidung.
  - Gegenprobe: eine zusätzliche Erwartung und eine entfernte Deklaration machen die Tests rot.
- Commit: 670b60a21 (#3756).

## 6. iOS-Installationshinweis nicht über der Lektion (#3749)
- Original prompt: (weiter nach Prio)
- Optimized prompt: Den Hinweis auf allen Lern-Routen ausblenden, nicht als geschlossen speichern; RED zuerst, WebKit-Spec als Wächter.
- Goal: "Weiter" ist in der ersten Lektion eines neuen iPhone-Nutzers sofort tippbar.
- Result: `IosInstallHint` nutzt `useIsLessonActive` und rendert auf Lektion, Fehler-Wiederholung, Review, Adaptiv, Shuffle und Endless nichts. Sieben neue Unit-Fälle (vorher rot); der WebKit-Spec aus #3755 prüft jetzt: Hinweis auf der Inhaltsseite sichtbar, in der Lektion fehlt er, kein Schließen gespeichert. WebKit-Lauf 38627203698 grün; Vitest 1095 Dateien / 12210 Tests.
- Commit: b81a388bf (#3757).

## 7. Dexie-Smoke auf den PRs, die ihn betreffen (#3748)
- Original prompt: (weiter nach Prio)
- Optimized prompt: Den PR-Trigger aus gemessener Coverage ableiten, einen immer meldenden Gate-Job als Required Check bauen, Fang- und Durchlass-Nachweis führen.
- Goal: Lesson-Flow-Änderungen kommen nicht mehr ohne Dexie-Lauf auf develop.
- Result:
  - Messung: V8-Block-Coverage über die Dexie-Specs (177 Tests lokal, GitHub per curl), über Source Maps auf `frontend/src` abgebildet: 1002 von 1342 Modulen (75 %) ausgeführt, der Rest dünn verstreut. Trigger daher `frontend/` ohne Unit-Tests plus `schema/` und die Spec-Eingaben (`scripts/dexie_smoke_affected.py`, fail closed).
  - `dexie-smoke.yml`: Scope-Job, Smoke-Job, Gate-Job "Dexie smoke (required)"; in CI benennt der `github`-Reporter die rote Spec als Annotation.
  - Fangnachweis: Abschalten von `resumeModeConflict` blieb zuerst grün, weil die Ein-Sitzungs-Regel (#3750) den Dialog mit anderem Grund blockierte und die Spec den Grund nicht prüfte. Nach der Assertion auf `data-reason="mode_conflict"` rot auf genau diesem Test (Lauf 38634411560), nach dem Revert grün (38636604490).
  - Nebenbefund: das Rule-Change-Log schlüsselt einen Commit nach der letzten `(#N)` im Betreff; endet der Branch-Commit auf `(#Issue)`, sieht der Push-Check nach dem Squash die PR-Nummer. Hier per Squash-Titel ohne PR-Nummer umgangen, Issue als Vorschlag beim Owner.
  - Required Check auf develop setzen: Owner.
- Commit: c8613cb90 (#3758).
