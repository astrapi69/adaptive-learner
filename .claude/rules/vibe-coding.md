# Vibe Coding Rules

Vollstaendige Policy: docs/policies/VIBE-CODING-POLICY.md

## Kurzregeln fuer jeden Task

1. PROMPT-PRAEZISION: Referenziere existierende Patterns (guardedFetch,
   IStorageService, Repository Pattern, PluginForge Hooks) statt neu
   zu erfinden. Nenne Datei, Funktion, erwartetes Verhalten.

2. SCHICHTARCHITEKTUR: Keine Business-Logik in Komponenten. Keine
   DB-Queries in Routern. Keine direkten fetch-Calls. Dependency
   Direction: Router -> Service -> Repository -> Models.

3. TESTS: Jede Verhaltensaenderung braucht Tests. Backup-Aenderungen
   brauchen zusaetzlich den manuellen Round-Trip (BACKUP-AKZEPTANZTEST).
   Nutzersichtbare Funktionalitaet aktualisiert den manuellen Testplan
   (TESTPLAN-PFLICHT in ai-workflow.md: DE + EN im selben PR, sonst
   referenzierter Follow-up-Kommentar auf #1087; "nicht gefordert" ist
   keine gueltige Begruendung). PR-CI: selektive Tests
   (vitest --changed, pytest --testmon).
   Nightly + Release: volle Suite.

4. DEPENDENCIES: Keine neuen Dependencies ohne manuelle Pruefung auf
   Wartungsstatus und Sicherheit. Bestehende Dependencies bevorzugen.

5. REFACTORING: God-Files splitten, nicht whitelisten. Whitelist nur
   fuer Single-Concern Dateien (Models, Schemas, statische Daten).

6. GIT: Issue ZUERST (GITHUB-ISSUE-PFLICHT). Closes #XX in jedem
   Commit. Docstrings statt Inline-Kommentare. Ein Concern pro PR.
   Jede gepushte Code-Aenderung oeffnet einen PR (PR-PFLICHT in
   ai-workflow.md) - immer, nicht nur auf Anfrage. "Kein PR, nicht
   angefordert" ist keine gueltige Abschluss-Meldung. Ausnahmen:
   Release-Sperre (unten) und reine Analyse-/Status-Auftraege ohne
   Code-Aenderung.

## Prioritaet (fest, nicht verhandelbar)

1. Offene PRs mergen
2. P0/P1 Bugs
3. Infrastruktur (CI, Security, Guards)
4. UI-Fixes
5. Cleanup/Refactoring
6. Features
7. Release

Fundament vor Features. Erst messen, dann absichern.

## Release-Sperre

Wenn ein Release-Branch geschnitten ist (release/X.XX.0 existiert),
gilt bis der Release getaggt und gepublisht ist:

- Keine neuen PRs gegen develop oeffnen
- Keine Merges nach develop
- Kein neuer Code, nur Release-Workflow
  (release-test, release-finish, release-publish, Journal)
- Ausnahme: ein P0-Hotfix der den Release selbst blockiert

Erst taggen, dann weiterarbeiten.
