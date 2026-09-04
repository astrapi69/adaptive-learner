# Vorlage: Bugfix

Behebe: {Symptom in einem Satz, mit Repro-Schritten oder Screenshot-Verweis}

Betroffene Fläche (falls bekannt): {Route/Komponente/Service}

## Pflicht-Kette (nicht streichen)

1. **Issue zuerst** (GITHUB-ISSUE-PFLICHT): `gh issue list --search "..." --state all`
   — existierendes Issue nutzen/reopenen, sonst `gh issue create` mit Label
   `bug` und actionabler Beschreibung. Prämisse vorher gegen den Code
   verifizieren: beschreibt das Issue den IST-Zustand noch? Abweichung als
   Prämissen-Korrektur melden statt ein falsches Issue zu bauen.
2. **Red zuerst** (tdd.md): fehlschlagender Reproduktions-Test VOR dem Fix;
   er bleibt als Regressions-Pin. Bei Storage-Bezug: Beweis in BEIDEN Modi
   (Dexie + API, lessons/content-storage.md #2053).
3. Fix minimal (Green), dann Refactor (Boy Scout).
4. `make test` grün; bei Frontend zusätzlich `cd frontend && bunx tsc --noEmit`.
5. Commit `fix(scope): ... (fixes #NN)`; eigener Worktree, nie der
   Haupt-Checkout.
6. **PR gegen develop** (PR-PFLICHT) im selben Zug wie der Push.
7. TESTPLAN-PFLICHT prüfen: neuer User-Pfad -> DE+EN-Testplan im selben PR;
   reiner Fix ohne neuen Pfad ist exempt (bestehenden falschen Schritt aber
   korrigieren).
8. Nach Merge: Issue CLOSED? Inhalt auf develop? (lessons/core.md #2410).

## Kontext-Anker

- Fehlerbild einordnen: erst gegen FRISCHEN Deploy bestätigen
  (lessons/core.md "User-reported UI bugs").
- Stale-vs-flaky-Diagnose vor jedem Retry-Pflaster (lessons/core.md).
