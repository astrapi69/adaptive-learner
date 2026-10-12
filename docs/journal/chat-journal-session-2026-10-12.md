# Chat-Journal 2026-10-12 (ccw)

## 1. Engine-Re-Pin auf learn-content-engine 0.40.0
- Original prompt: Re-pin adaptive-learner to learn-content-engine 0.40.0 (develop; the app goes first). No schema change (1.19). Confirm that the app's manifest handling accepts metadata.type_migrations, with a test.
- Optimized prompt: Pin 0.40.0 in `frontend/package.json` und `schema/engine-version.txt`, `make sync-schema` und `make sync-openapi`, die drei Check-Targets, alle Suiten; nachweisen, dass Pydantic-Modell, Content-Loader und Frontend-Manifest-Parser ein Set-Manifest mit `metadata.type_migrations` annehmen, und dass `validateManifest` der Engine die erlaubten Paare akzeptiert und ein unerlaubtes ablehnt.
- Goal: Die App steht auf 0.40.0, bevor der Hub 105 Typ-Migrationen deklariert.
- Result:
  - Pin 0.39.0 -> 0.40.0; `make sync-schema` und `make sync-openapi` ändern keine Datei (Schema 1.19, `metadata` ist offen). `sync-schema-check`, `engine-parity-check` (gegen den 0.40.0-Tarball) und `sync-openapi-check` sauber.
  - Manifest-Pfade: `ContentManifestBase.metadata` ist `dict[str, Any]`, `resolve_cached_manifest` (#3723) reicht `metadata` durch; `content-repo-validate.ts` liest nur `metadata.lessons`. `validateManifest` ruft die App nur in `repo-export.ts` für selbst erzeugte Manifeste auf.
  - Tests: `type-migrations.test.ts` (3: `parseManifest` behält den Block, `validateManifest` akzeptiert cloze -> multiple_choice und cloze -> free_text, `cloze -> matching` ergibt `E-TYPE-MIGRATION-PAIR`); Content-Loader `test_a_set_manifest_with_type_migrations_downloads_and_lists` (Download, Cache-Manifest behält den Block, Offline-Liste unverändert).
  - Suiten: Frontend 12089 bestanden, tsc und ESLint sauber; Backend 2278 bestanden, 1 übersprungen; Content-Loader 327 bestanden; `make ci` grün.
- Commit: (dieser PR).

## 2. Typ-Migration ohne Breaking-Update (#3725)
- Original prompt: Also create the issue CCW proposed: "test: a declared cloze type migration under a kept stable_id is not a breaking update (learn-content-engine#254)", label P3. Implement it in the same round if it is small.
- Optimized prompt: In `update-impact.test.ts` SRS-Zeilen aus `exerciseElementKeys` der alten Cloze-Übung bauen und `computeUpdateImpact` gegen die migrierte Übung mit gleichem `stable_id` prüfen.
- Goal: Festhalten, wann eine Migration Fortschritt behält und wann nicht.
- Result:
  - Messung Hub vorab: 733 Cloze-Übungen, 754 Lücken, 0 Lücken mit eigenem `stable_id`; die Schlüssel laufen also über den Antworttext.
  - Tests (6): gleiche Antwort -> nicht breaking (select -> MC, type -> free_text); geänderte Antwort -> breaking; eine Lücke mit eigenem `stable_id` bleibt nur dann nicht breaking, wenn die richtige MC-Option dasselbe `stable_id` trägt, bei free_text wird sie breaking. update-impact 36/36 bestanden.
- Commit: (eigener PR, Closes #3725).
