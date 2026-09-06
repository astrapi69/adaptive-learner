# Chat-Journal 2026-09-06

CI-Rot-Session: drei rote Nacht-Läufe geprüft und behoben. Branch:
claude/ci-rot-34ads1, PR gegen develop. Die Lifecycle-Matrix im
Schwesterrepo docker-app-launcher (Issue docker-app-launcher#131) lief
in derselben Session und ist dort dokumentiert.

## 1. content-stats.yml rot: README CONTENT-STATS veraltet (#2987) (08:00)

- Original prompt: "CI ist rot. Checken und fixen."
- Optimierter Prompt: "Prüfe alle roten Workflow-Läufe beider Repos,
  lies die Job-Logs, reproduziere lokal und behebe jede Ursache mit
  Issue, Test und PR."
- Ziel: den nächtlichen Content-Stats-Gate wieder grün bekommen.
- Ergebnis: das Content-Repo ist auf 329 Lektionen gewachsen (vier
  Französisch-Sets je +1) und acht Set-Titel wurden vom Gedankenstrich
  auf Bindestrich umbenannt. Block mit
  `validate_bundled_content.py --write-readme` gegen einen frischen
  Checkout regeneriert, `--check-readme` danach grün. Keine App-Ursache.

## 2. dead-code.yml rot: 23 neue knip-Funde, 1 aufgelöster (#2988) (08:05)

- Ziel: den wöchentlichen Dead-Code-Ratchet wieder grün bekommen, ohne
  blind zu banken oder blind zu löschen (#2486).
- Ergebnis: alle 23 Funde einzeln gegen den Quellbaum geprüft. 20 sind
  Barrel-Re-Exports der Settings-Controls (Regel reusability.md, #1275)
  plus der öffentliche Label-Typ einer shared-Komponente, alle wie die
  bereits gebankten Geschwister in die Baseline aufgenommen. Zwei echte
  Tote gelöscht: der Default-Export von `SettingsDisclosure` (jeder
  Konsument nutzt den benannten Export) und das `export` an
  `PLAYFUL_DETAILS_OPEN_KEY` (nur dateiintern genutzt). Aufgelöster
  Eintrag `i18n/engine.ts::NAMESPACE` via `--update-baseline` gebankt.
  Lokal: `check_dead_code.py` sauber, tsc, eslint und die zwei
  betroffenen Vitest-Dateien grün.

## Zusammenfassung

- Commits: 1 (README-Regenerat, Baseline, zwei Quell-Löschungen,
  Journal), PR gegen develop.
- Tests: 19 Vitest-Tests der beiden betroffenen Dateien grün, keine
  neuen Tests (Ratchet-Resync und Docs-Regenerat, kein Verhalten).
- Offene Fragen und Annahmen: Barrel-Exports werden gebankt und nicht
  gelöscht, weil die Regel sie fordert; das Precedent ist #2917/#2920.
