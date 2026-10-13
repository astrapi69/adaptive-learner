# Chat-Journal 2026-10-13 (ccw)

## 1. Bewertungsblock des Sets in der Prüfungs-Zusammenfassung (#3736)
- Original prompt: dann weiter mit https://github.com/astrapi69/adaptive-learner/issues/3736
- Optimized prompt: #3736 umsetzen: Re-Pin auf learn-content-engine 0.41.0 (`gradeFor`), den `evaluation`-Block des Sets im Prüfungsmodus statt der eigenen Bestehensgrenze anwenden (ungerundete Prozentzahl auf Element-Basis, erster Durchgang), als Autorenwertung kennzeichnen, `title` als Überschrift, `report: detailed` öffnet die Detailansicht; Übungsmodus und Sets ohne Block unverändert. i18n-PR zuerst, Testplan DE+EN im Feature-PR.
- Goal: Ein Set mit eigener Bestehensmarke oder Notentabelle wird nach den Vorgaben der Autorin oder des Autors bewertet, nicht nach der Schwelle des Lernenden.
- Result:
  - i18n vorab (#3737): sechs Keys unter `lesson.exam` in allen 11 Katalogen. Das Visual-Baseline-Gate (#3687) schlug an; die Keys haben noch keinen Konsumenten, darum `visual-baselines-unaffected` mit Begründung im PR-Body.
  - Neu `lib/lesson/author-evaluation.ts`: `resolveAuthorEvaluation(evaluation, correct, total)` ruft `gradeFor` aus `learn-content-engine/rules` mit der ungerundeten Prozentzahl auf; `null` ohne Block, bei leerem Lauf und bei einem unmöglichen Ergebnis (Rückfall auf die eigene Schwelle statt Absturz).
  - `useLessonSetContext` liefert `setEvaluation` aus `listSets()`; beide Speichermodi tragen das Feld seit #3395 im Listing.
  - `LessonSummary`: nur im Prüfungsmodus ersetzt der Block die eigene Schwelle (Empfehlung 2 im Issue); `report: detailed` öffnet die Detailansicht, der Umschalter des Lernenden gewinnt danach. Nichts wird gespeichert (Empfehlung 3).
  - `LessonExamResult`: `pass_fail` zeigt Bestanden/Nicht bestanden mit der Autoren-Marke, `grades` die Note (mit `label_native`) und bei vorhandener Marke die Bestehenszeile, `percent` die Prozentzahl und die empfohlene Marke (kein `data-passed`, weil die Marke dort nur empfiehlt). `title` ersetzt die Überschrift, ein Hinweis nennt die Autorenwertung, `data-evaluation-source` ist `author` oder `learner`.
  - Tests (RED zuerst): `author-evaluation.test.ts` (14: pass_fail an, unter und über der Marke; 86,25 % erreicht die Zeile bei 86, 85,6 % nicht), `LessonExamResult.test.tsx` (+7), `LessonSummary.exam.test.tsx` (+5, Pilot-Szenario 7/10 bei eigener Grenze 80 %: bestanden mit Block, nicht bestanden ohne), `useLessonSetContext.test.tsx` (erweitert). Ohne die Änderung an `LessonSummary.tsx` scheitern Pilot- und Detail-Test.
  - Testplan TC-0955 (DE+EN): Pilot- und Kontroll-Lektion aus `adaptive-learner-content-test`.
  - Zwei Gates schlugen lokal an (`make ci`): Komplexität von `LessonSummary` 20 -> 24 und Dateigröße 944 -> 969 Zeilen (Grenze 950). Statt Baseline oder Whitelist: `resolveExamVerdict` und `resolveDetailedView` als reine, getestete Helfer (Komplexität jetzt 19) und die vier reinen View-Helfer unverändert nach `lib/lesson/summary-view.ts` (899 Zeilen).
- Commit: (dieser PR, Closes #3736).
