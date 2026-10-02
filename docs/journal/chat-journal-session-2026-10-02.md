# Chat-Journal 2026-10-02

Session der ccw-Lane, begonnen am 2026-10-01: Queue-Abarbeitung mit Owner-Pausen, danach der Release v2.16.0.

## 1. Rote CI auf #3531 (Unicode-Set-IDs, #3391)

- Original prompt: "https://github.com/astrapi69/adaptive-learner/pull/3531 red"
- Optimized prompt: "Den roten Check auf #3531 aus dem Job-Log bestimmen, lokal reproduzieren, minimal fixen, auf aktuellem develop grün machen und mergen."
- Goal: #3531 grün und gemergt.
- Result: Der Dead-Code-Gate hielt den umbenannten Pydantic-Validator `_safe_segment_id` für neu tot (vulture sieht Decorator-Aufrufe nicht, alle Validatoren stehen deshalb in der Baseline). Baseline-Eintrag umbenannt, gemergt; #3391 geschlossen. Nebenbefund: 13 veraltete Python- und 2 TypeScript-Baseline-Einträge, schon auf develop veraltet, nur Warnungen.
- Commit: b466e731 (in #3531).

## 2. #3389: Create-Gate soll die Engine-Minima nutzen (geparkt)

- Original prompt: (Queue)
- Optimized prompt: "Vor dem Umbau messen, was `validateLessonQuality` auf einem normal erzeugten Assistenten-Entwurf sagt."
- Goal: Create- und Share-Gate sagen dasselbe.
- Result: Der Generator erzeugt `free_text` mit einer akzeptierten Antwort, die Engine verlangt zwei. 1:1 übernommen würde das lokale Speichern fast jeder neuen Lektion mit Freitext blockieren. Die Engine selbst nennt die Minima eine Schwelle fürs Veröffentlichen. Drei Optionen am Issue, Empfehlung Option 2 (lokal nur Gültigkeit, Minima gaten nur "Speichern und teilen"). i18n vorab gemergt (#3533), Code-PR wartet auf die Owner-Entscheidung.
- Commit: #3533.

## 3. #3387: Übungseditor folgt den Engine-Regeln

- Original prompt: (Queue)
- Optimized prompt: "Erst Prognose ans Issue, dann alt gegen neu über die Flotte messen, dann umstellen, ohne die Regeln in den Entry-Chunk zu ziehen."
- Goal: Save im Editor und Next im Wizard prüfen, was das Speichern prüft.
- Result: Prognose vor der Messung am Issue; Messung über 529 Lektionen (4401 Kern-Übungen): 0 neue Ablehnungen, 2 frühere Fehlablehnungen (`from_cards`-Zuordnungen in alc-psychology). `checkExerciseDraft` in `lib/content/lesson/edit/` (Shape-Layer plus `validateLessonRules` auf einer Wrapper-Lektion mit den echten Karten-IDs, Zuordnung nach Regel-ID). Entry-Chunk 1502 Bytes kleiner. i18n vorab (#3534), Code #3535. Nebenbefund: Beim Bearbeiten-Speichern geht `purpose` verloren (Issue braucht Owner-OK).
- Commit: #3534, #3535.

## 4. #3393: API-Modus parst Lektionen wie Dexie

- Original prompt: (Queue, "verify first")
- Optimized prompt: "Erst mit echter Backend-Ausgabe reproduzieren, dann eine Grenze für beide Modi, in beiden Modi getestet."
- Goal: `from_cards` aufgelöst und Set-Kontext geerbt auch im API-Modus.
- Result: Bestätigt (Backend liefert `pairs: None`; 102 von 529 Lektionen ohne eigenes `target_language`). `parseServedLesson` in `lib/content/engine`; der Set-Kontext kommt aus der letzten Set-Liste (60 s wiederverwendet, weil `GET .../sets` jedes Quell-Manifest von GitHub holt), offline Fallback auf den eigenen Kontext. Der Update-Peek parst ebenso. Fixture-Fehler beim ersten Entwurf (Set-Liste als Array statt `ContentSetsList`) von tsc gefunden.
- Commit: #3536.

## 5. #3377: Fehler im Tutor-Chat sichtbar

- Original prompt: "3377 meinte ich"
- Optimized prompt: "SSE-Fehler als ApiError mit Aufzeichnung, Inline-Fehler mit Retry plus Toast über den Fehlerobjekt-Pfad, Hinweis statt Begrüßung bei Verlaufsfehler; RED pro Pfad."
- Goal: Kein stilles leeres Bubble, kein scheinbar gelöschter Verlauf.
- Result: `streamSse` mit `onResponse`/`toHttpError`/`toNetworkError`; `buildApiError`, `recordApiCall`, `networkApiError` mit `apiCall` geteilt (Reihenfolge Aufzeichnen-dann-Werfen erhalten); Abbruch bleibt unverändert. i18n vorab (#3537), Code #3538, TC-0927.
- Commit: #3537, #3538.

## 6. Release v2.16.0

- Original prompt: "Ich sage: ok 2.16.0", danach "dann weiter".
- Optimized prompt: "Release-Branch schneiden, Version und Changelog (Release-Datei, 8 Hilfe-Sprachen, README-Status), `make release-test`, jeden roten Gate nach Ursache klären, dann main mergen und taggen, Back-Merge per PR."
- Goal: v2.16.0 auf main, getaggt, develop zurückgeführt.
- Result:
  - Changelog: zitierte UI-Texte gegen die Kataloge geprüft, vier Fehlzitate korrigiert (en, es, tr).
  - Dexie-Smoke seit dem Nightly vom 2026-09-30 rot (11 Fälle in CI). 10 waren veraltete Fixtures gegen die strengere Repo-Validierung (#3243) und das Recording-Schlüsselformat (#3458); die Flotte hat keinen der Verstöße. Einer war ein echter Layout-Fehler: der Footer-Paarzähler (#3237) schob Prüfen bei 320 px aus dem Bild.
  - Testplan-Automatisierung: die Nav-Spec erwartete bei 900 px noch die obere Leiste; diesen Fehler hatte ich mit #3527 selbst eingeführt.
  - Back-Merge #3541: Image-Obergrenze um 3,3 MB überschritten (angesammeltes develop-Wachstum, bewusst angehoben); Docs-Verifier auf main rot, weil der Push-Check nur develop holte und der alte main-Kopf nie in develop lag (verlorenes v2.15.0-Back-Merge). Workflow holt jetzt beide Enden.
  - main zweimal gemergt (`0355f84b`, dann `a896887e`), Tag lokal auf `a896887e`; der Tag-Push ist aus der Session nicht möglich, der Owner pusht ihn. Back-Merge #3541 als echter Merge-Commit, nicht gesquasht.
  - Launcher-Builds für den Tag-Commit per workflow_dispatch angestoßen (der Pfadfilter hatte sie für den zweiten main-Merge übersprungen).
- Commit: e9d380f9, ed387461, 5657dbd2, e59eba63, 68389d39, bfab5695, f92d3610; main a896887e; #3541.

## Lektionen dieser Runde

- Eine nur nächtlich laufende Suite (Dexie-Smoke, Testplan-Automatisierung) sah zwei Tage lang rot aus, ohne dass ein PR es zeigte. Beim Ändern eines Breakpoints oder einer Validierung die E2E-Specs mit grepen, auch wenn der PR-Lauf grün ist.
- Ein Back-Merge wird nie gesquasht: der verlorene v2.15.0-Merge ließ heute einen Push-Check auf main scheitern.
- Release-Notes zitieren UI-Texte nur aus den Katalogen.

## Zusammenfassung

PRs gemergt: #3531, #3533, #3534, #3535, #3536, #3537, #3538, #3541. Issues geschlossen: #3391, #3387, #3393, #3377. Offen für den Owner: #3389 (Entscheidung), Issue für den `purpose`-Verlust beim Bearbeiten (OK nötig), Tag-Push und Veröffentlichung von v2.16.0, die arm64-Obergrenze im Publish-Lauf.
