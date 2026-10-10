# Chat-Journal 2026-10-10 (ccw)

## 1. Engine-Re-Pin auf learn-content-engine 0.39.0
- Original prompt: Re-pin adaptive-learner to learn-content-engine 0.39.0 (covers 0.38.0 and 0.39.0, no schema change), check every app use of resolveSetEntry / validateManifestPair and of rule ids, sync, check, run the suites, journal, PR.
- Optimized prompt: Pin 0.39.0 in `frontend/package.json` und `schema/engine-version.txt`, `make sync-schema` und `make sync-openapi`, die drei Check-Targets, Frontend-, Backend- und Content-Loader-Suiten; jede Stelle, an der die App Engine-Regel-IDs als Schlüssel nutzt, über `currentRuleId` führen.
- Goal: Die App steht auf 0.39.0, bevor die Content-Flotte nachzieht.
- Result:
  - Pin 0.37.0 -> 0.39.0; `make sync-schema` und `make sync-openapi` schreiben alles neu, keine Datei ändert sich (Schema 1.19 unverändert). `sync-schema-check`, `engine-parity-check` (gegen den 0.39.0-Tarball) und `sync-openapi-check` sauber.
  - `resolveSetEntry`, `validateManifestPair`, `inheritFromRootEntry`: kein Aufruf in der App. Die Python-Portierung von `resolveSetEntry` im Content-Loader (#3723) folgt bereits 0.38.0. Die App enthält keine Manifeste, die `E-MANIFEST-ENTRY-MISMATCH` treffen könnte.
  - Regel-IDs als Schlüssel: vier Tabellen (`QUALITY_CODE_BY_RULE`, `ENGINE_WARNINGS_COVERED_BY_APP` in `content-validator.ts`, `CODE_BY_RULE` in `exercise-draft-check.ts`, `ROW_BY_RULE` in `draft-share-check.ts`) und der Vergleich mit `W-CARD-BACK-SCRIPT`. Neu `lib/content/validation/rule-keys.ts`: `keyedByCurrentRuleId` und `currentRuleIdSet` heben jeden Schlüssel über `currentRuleId` auf die aktuelle ID. Die Engine meldet immer die aktuelle ID; ohne das würde eine Tabelle nach einer Umbenennung still nicht mehr treffen. Heute umbenannt ist nur `W-MANIFEST-ENTRY-MISMATCH`, das die App nicht nutzt.
  - `W-HINT-LENGTH` für es/fr/it/pt/el läuft über den generischen `engine_warning`-Pfad, keine App-Änderung.
  - Tests: `rule-keys.test.ts` (3, RED zuerst). Frontend 12081 bestanden, tsc und ESLint sauber; Backend 2278 bestanden, 1 übersprungen; Content-Loader 326 bestanden; `make ci` grün.
- Commit: (dieser PR).
