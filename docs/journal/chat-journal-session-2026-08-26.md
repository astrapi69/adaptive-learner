# Chat-Journal — Session 2026-08-26

## 1. "Warum du diese verpasst hast" zeigt jetzt die Frage (#2757)
- Original prompt: "Das ist schön gemacht in der Zusammenfassung. Was noch fehlt, ist noch die Frage damit ein Zusammenhang entsteht. [...] Es ist die Sektion: warum du diese verpasst hast"
- Optimized prompt: "In der Lektions-Zusammenfassung zeigt der Bereich 'Warum du diese verpasst hast' nur Deine-Antwort/Richtig. Ergänze pro Eintrag die gestellte Frage (Aufgabentext / Lückentext-Satz / Zuordnungs-Begriff), damit der Zusammenhang sichtbar wird."
- Ziel: Jeder Fehler-Eintrag in der Zusammenfassung trägt die Frage über dem Antwort-Vergleich.
- Ergebnis:
  - Neuer purer Resolver `frontend/src/lib/review/error-question.ts` (`questionForError`): löst die Frage aus dem Lektionsinhalt auf — matching → linke Paarseite (über die Identity-Keys, niemals die rohe `element_key`, die seit engine#91 eine opake stable_id sein kann); cloze → der Satz mit `___`; ext Leseverständnis/benotetes Quiz → Prompt der Teilfrage; sonst Exercise-Prompt mit Step-Titel-Fallback. `null` bei nicht auflösbarer Übung → Eintrag bleibt wie bisher ohne Frage-Zeile.
  - `SummaryExplanations` bekommt eine optionale `lesson`-Prop und rendert die "Frage:"-Zeile (`review.question_label`, alle 11 Kataloge + `make sync-i18n`) über dem `AnswerDiff`; beide Aufrufstellen in `LessonSummary` reichen die Lektion durch.
  - Tests: 10 Resolver-Pins (`error-question.test.ts`, RED zuerst) + 3 neue Komponenten-Pins (Frage sichtbar, ohne Lektion wie bisher, nicht auflösbare Übung ohne Frage-Zeile). Testplan DE+EN um die Sektion "#2757" ergänzt (TESTPLAN-PFLICHT).
- Commit: siehe PR zu #2757 auf `claude/missed-question-section-rw005i`.

## Fragen und Annahmen
- Evidenzbasiert entschieden: Als "Frage" bei matching dient `pair.left` — der Recorder schreibt in beiden Drill-Richtungen `correct_answer = pair.right` (`deriveMatchingAttempts`), die linke Seite ist also konsistent die abgefragte Seite.
- Evidenzbasiert entschieden: Die rohe `element_key` darf nie angezeigt werden (engine#91: kann stable_id sein); Auflösung läuft über `elementIdentityKeysOf` mit `elementKeysOf`-Fallback für Alt-Zeilen.
- Konservative Annahme: Für dictation/image-description/error-correction (ext) reicht der Exercise-Prompt-Fallback; eine speziellere Ableitung lohnt erst bei realem Bedarf.
