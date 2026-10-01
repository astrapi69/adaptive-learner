# Chat-Journal 2026-10-01

Engine-Runde aus der learn-content-engine-Session: learn-content-engine 0.35.0 bringt eine neue Regel, und laut Architektur-Doku der Engine (Abschnitt "Order: the application first") pinnt die Anwendung zuerst, die Content-Flotte folgt in derselben Runde.

## 1. Re-Pin learn-content-engine 0.35.0 (13:20 bis 13:45)

- Original prompt: "mach das: engine#237 umsetzen: Regel, Release, danach entfällt die Kopie im Template-Audit."
- Optimized prompt: "Nach dem Release von learn-content-engine 0.35.0 (engine#237, `E-FREETEXT-DISJOINT`) die App zuerst re-pinnen: `frontend/package.json` und `schema/engine-version.txt` auf 0.35.0, `bun install`, `make sync-schema`, die Checks `sync-schema-check`, `engine-parity-check`, `sync-openapi-check`, dann Frontend-Suite und Content-Loader-Tests; danach die Content-Flotte."
- Goal: Die App liest, was Content ab 0.35.0 prüft: ein `free_text`-Eintrag, der zugleich in `accept` und `distractors` steht, ist jetzt ein Fehler, im Lektions-Funnel über `validateLessonRules` sichtbar.
- Result: Kein Schema-Wechsel (1.18), daher ändert `make sync-schema` keine Datei; nur Pin, Lockfile und `engine-version.txt` bewegen sich. `sync-schema-check`, `engine-parity-check` und `sync-openapi-check` grün (132 Pfade, 165 Operationen unverändert). Die App übernimmt Engine-Meldungen direkt (keine Zuordnung nach Regel-ID), die neue ID braucht keinen App-Code. Frontend-Suite: 1055 Dateien, 11597 Tests grün; Content-Loader-Plugin 323 grün; `test_engine_schema_parity.py` 5 grün, 1 übersprungen. Gemessen mit 0.35.0 über die 632 Lektionen der elf Content-Repos: 0 Treffer der neuen Regel.
- Nebenbefund für die App (engine#237, Kommentar): `frontend/src/lib/exercises/grading/free-text-grading.ts` vergleicht ohne Groß/Klein, darum zählt bei den zwei Übungen, die Großschreibung lehren (`ex-free-i-capital`, `ex-free-nationality` in adaptive-learner-content), die kleingeschriebene Eingabe als richtig. Kein Teil dieses PRs.
- Commit: siehe PR.
