# Chat-Journal 2026-08-06 - Schließung #2182 (enforce_admins auf develop)

## 1. Ratchet-Lücke des Release-Rückmerges endgültig geschlossen (16:31)

- Original prompt: Link auf Issue #2182 (Ratchet-tripping changes reach
  develop ungated via the release/hotfix back-merge).
- Optimized prompt: "Führe die letzte offene Handlung aus #2182 aus:
  enforce_admins auf develop einschalten, verifizieren, Doku nachziehen,
  Issue schließen."
- Ziel: Den im Issue-Strang festgehaltenen Beschluss (Variante 1) zu Ende
  bringen. Prävention (#2190), Detektion (#2193), PR-Routing des Rückmerges
  (#2199) und beide Pre-Flight-Checks (Kommentar 08:14) waren bereits
  erledigt; offen war allein der Schalter.
- Ergebnis: Live-Zustand gelesen (enforce_admins=false, strict=true,
  7 ungefilterte Pflicht-Kontexte - deckungsgleich mit dem
  Pre-Flight-Befund), dann per
  `POST .../branches/develop/protection/enforce_admins` eingeschaltet und
  per erneutem GET verifiziert (enabled=true). Doku auf den geschlossenen
  Zustand gezogen: `docs/development/release-ratchet-gap.md` (Status CLOSED
  + Schließungsprotokoll mit API-Beleg), `release-workflow.md` (Satz
  "Closure requires ..." ersetzt), `lessons/ci-gates.md` (#1729- und
  #2182-Lektionen in die Vergangenheitsform, Schließungs-Set benannt).
  Regel-Korpus bleibt unter der Decke (291625 <= 291626);
  RULE-CHANGE DECLARED im Commit. Beleg-Kommentar im Issue; PR #2474
  (Closes #2182) läuft selbst als erste Live-Validierung unter dem neuen
  Regime. End-zu-End-Validierung des Rückmerge-Pfads bleibt beim nächsten
  realen Release.
- Commit: d2c12404 (PR #2474)
