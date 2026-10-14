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
  - Suiten: siehe PR.
- Commit: (dieser PR, Closes #3750).
