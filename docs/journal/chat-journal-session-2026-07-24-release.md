# Chat-Journal — Session 2026-07-24 (Release v2.6.0)

Thema: Release v2.6.0 schneiden (Makefile-/Gitflow-Prozess analog v2.5.0),
mit dem Nebenzweck, die beteiligten Workflows real zu testen: die drei
Launcher-Binary-Builds, den `push: release/**`-Trigger des WebKit-Gates
(#1843) und den kompletten Makefile-Release-Zyklus inklusive der beiden
#1903-Fixes.

## 1. Verify-First + Branch-Schnitt

- Original prompt: CC-Auftrag "Release schneiden (nächste Minor-Version)"
  mit Verify-First-Pflicht, Workflow-Realtest als Nebenzweck und
  autonomer Ausführung mit Zwischenmeldungen.
- Ziel: Stand von develop gegen v2.5.0 sichten, Versionsnummer
  bestimmen, Branch schneiden.
- Ergebnis: 81 Non-Merge-Commits seit v2.5.0, klare Minor-Themen
  (assistant-ui-Cutover #1126/#2012, Buchtext-Datei-Upload
  #1927/#1950/#1953, Diktat-Audio-Upload #1911, Set-Sichtbarkeit #1993,
  Docker-Launcher 0.14.1, CI-Gates #1969/#1981/#1980/#1995). Befund aus
  der Workflow-Historie: v2.5.0 lief komplett lokal, der
  `release/2.5.0`-Branch wurde nie gepusht — deshalb hatte das
  WebKit-Gate seinen `release/**`-Push-Trigger noch nie real gefeuert.
  Konsequenz für diesen Lauf: Release-Branch explizit pushen.
  `make release-prepare VERSION=2.6.0` schnitt `release/2.6.0`.

## 2. Bump + Changelog + Doku-Blöcke

- Ziel: Version 2.6.0 kanonisch setzen, Changelog thematisch verdichten,
  Status-Blöcke aktualisieren.
- Ergebnis: `backend/pyproject.toml` 2.5.0 -> 2.6.0, `make sync-versions`
  propagierte 19 Dateien; `verify_version_pins.sh 2.6.0` sauber.
  `changelog/releases/v2.6.0.md` aus den 81 Commits geclustert
  (assistant-ui, Buch-Ingestion, Diktat, Sichtbarkeit, Launcher,
  CI-Gates, Fix-Sweeps), ohne Em-Dashes. README + README-de (Badge +
  Status-Absatz), CLAUDE.md Current-State, ROADMAP- + Backlog-Header
  aktualisiert. `verify_docs` 0 FAIL.
- Commit: f8277951. Der `plugin-lock-paired-with-pyproject`-Hook lief
  beim reinen Versions-Bump erstmals sauber durch (Passed, kein SKIP
  nötig) — der erste #1903-Fix greift.

## 3. Branch-Push: WebKit-Gate real ausgelöst

- Ziel: Nebenzweck — den `push: release/**`-Trigger real testen.
- Ergebnis: Der Push von `release/2.6.0` feuerte fünf Workflows:
  WebKit gate, Dexie smoke, Manual-plan automation, Security Scan,
  Docker build smoke. Das WebKit-Gate lief auf allen drei
  Branch-Pushes grün — die erste echte Auslösung über den
  Release-Branch-Trigger seit #1843 (bisher nur ein
  workflow_dispatch-Nachweis).

## 4. release-test: ein echter Fund

- Ziel: `make release-test` lokal grün.
- Ergebnis Lauf 1: ROT am `sync-schema-check`-Gate —
  `schema/content-set.schema.json` out of date. Ursache: der
  Engine-Re-Pin 0.13.3 -> 0.14.0 (#1993, `visibility`-Feld) hatte den
  gespiegelten Schema-Satz nie regeneriert; das Gate läuft nur im
  Release-Zyklus, nicht pro PR. Fix: `make sync-schema`, Delta war
  exakt das additive `visibility`-Enum (visible|hidden).
  Commit: b67e6043.
- Ergebnis Lauf 2: GRÜN (EXIT=0) — Backend 1473 passed + 2 skipped,
  Plugins 1096, Vitest 7722, Frontend-Build, Theme-Matrix,
  verify-docs-discipline, sync-versions-Check, Schema-Gate,
  Plugin-Locks, Dexie-Gate, Manual-Automation (77 Specs).
  Test-Summe 10293; das Vitest-Minus gegen v2.5.0 (7745 -> 7722) ist
  die SessionChat-Entfernung aus dem assistant-ui-Cutover (#2012).
  Zahlen in README/README-de/CLAUDE.md verifiziert nachgetragen
  (Commit 3d9975b6).

## 5. Finish + Publish

- Ziel: Merge nach main, Tag, GitHub-Release, Rückmerge.
- Ergebnis: `make release-finish VERSION=2.6.0` lief in einem Durchgang:
  main-Merge, Tag v2.6.0, develop-Rückmerge (eefb1138),
  Branch-Löschung lokal + remote — der zweite #1903-Fix nahm den
  existiert-tatsächlich-Pfad ohne Fehlalarm (diesmal gab es den
  Remote-Branch wirklich, wegen des WebKit-Gate-Pushes).
  `make release-publish VERSION=2.6.0` veröffentlichte das Release:
  https://github.com/astrapi69/adaptive-learner/releases/tag/v2.6.0.
  Alle drei Launcher-Workflows feuerten auf `release: created`.

## Abweichungen gegenüber dem v2.5.0-Durchlauf

1. Release-Branch wurde gepusht (v2.5.0: lokal-only) — bewusst, für den
   WebKit-Gate-Trigger; Nebeneffekt: Dexie/Manual/Security/Docker
   liefen zusätzlich in CI gegen den Release-Stand.
2. `sync-schema-check`-Rotlauf (neu): Engine-Re-Pin ohne
   Mirror-Regenerierung. Kandidat für eine Regel: nach jedem
   Engine-Re-Pin `make sync-schema` im selben PR.
3. Beide #1903-Stolpersteine (Lock-Pairing-False-Positive,
   release-finish-Branch-Löschung) traten nicht mehr auf — Fixes
   verifiziert.

Statistik: 3 Commits auf release/2.6.0 (Bump f8277951, Schema-Fix
b67e6043, Test-Zahlen 3d9975b6), Tag v2.6.0 auf main (7fb87b72),
release-test 2 Läufe (1 rot, 1 grün), 10293 Tests grün.
