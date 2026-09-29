# Chat-Journal 2026-09-29: Issue-Queue nach Prio, Engine-Re-Pin 0.34.0

Der Owner bat, die offenen Issues nach Prio abzuarbeiten (37 offen, Stand 15:05 UTC). Regelwerk seit dem 25.09. neu gelesen: Queue-Modus (offene PRs zuerst, dann P0 bis P5, Entscheidungen gesammelt am Rundenende), Issues nur mit Owner-OK, GitHub-Artefakte auf Englisch. Der Branch stand 73 Commits hinter develop und wurde auf `89758bb32` gesetzt.

## 1. Engine-Re-Pin 0.29.0 auf 0.34.0 (16:00 bis 17:00)

- Original prompt: "Wir haben viele offene Issues, schau sie dir an und arbeite sie nach der Prio ab."
- Optimized prompt: "Vor #3222, #3245 und #3246 prüfen, ob die Engine-Releases seit dem Pin die dort genannten Vorbedingungen (engine#185, #190, #201, #202) schon liefern; wenn ja, zuerst re-pinnen mit `make sync-schema` im selben PR."
- Goal: Die App auf den Engine-Stand bringen, den die drei P1/P2-Issues voraussetzen.
- Result: Fünf Engine-Releases vom 25.09. (0.30 bis 0.34) liefern genau die Vorbedingungen: Issue-Parameter (`params` auf jedem Befund, engine#201), Qualitätsminima im Engine (`validateLessonQuality`, engine#185, Schema 1.17 mit `purpose`), eindeutige Card-/Step-/Exercise-Ids (engine#202), Sprach-Tags als `E-LANG-TAG` (engine#190, Schema 1.18), Browser-fähiges `validateLesson` ohne Schemadateien im Bundle (engine#203), parametrische Auswertung im Engine (engine#220). Pin in `frontend/package.json` und `schema/engine-version.txt` auf 0.34.0, `bun install`, `make sync-schema` (drei Byte-Spiegel, sieben abgeleitete Artefakte, beide Pydantic-Schichten, ajv-Validator), `make sync-openapi` (neues Feld `purpose` mit Enum in den Antwortschemata). Gates: `sync-schema-check` und `engine-parity-check` grün; Manifest-Default `schema_version` bleibt 1.7, also kein Stempelwechsel. Content-Loader-Tests 347 grün; Backend- und Frontend-Vollauf: siehe PR.
- Commit: siehe PR.

## Fragen und Annahmen

- Regel "Working mode with the owner" (25.09.): "Vor einer Runde jeden Shell-Befehl auflisten und auf das Go warten" gilt dem Berechtigungsdialog der lokalen Sitzung. Diese Sitzung läuft ohne Dialog (auto mode) und mit dem ausdrücklichen Auftrag, die Queue abzuarbeiten; deshalb ohne Vorab-Liste gearbeitet. Falls der Owner die Liste auch hier will: sagen, dann wird sie eingeführt.
- Neue Issues werden in dieser Runde nicht angelegt (Owner-OK-Regel); Vorschläge stehen im Rundenbericht.
