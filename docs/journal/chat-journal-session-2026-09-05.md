# Chat-Journal 2026-09-05

Einstellungen > Lernen: Reorganisation (Umbrella #2951), Stufe 1 bis 3,
plus drei kleine Fixes davor. Lokale Session mit Agenten-Worktrees pro
Sub-Issue, PRs gegen develop. Dieses Journal wurde am 2026-09-06 aus der
Übergabe-Notiz der Session rekonstruiert: die Original-Prompts sind
sinngemäß wiedergegeben, Uhrzeiten sind nicht überliefert.

## 1. Test-Count-Erhebung nutzt das Backend-venv (#2946/#2948)

- Original prompt (sinngemäß): "Die Plugin-Testzahlen in
  current-coverage.md stimmen nicht, der Verifier zählt falsch."
- Optimierter Prompt: "Lass die Plugin-Test-Collection in
  scripts/verify_docs.py über das gemeinsame Backend-venv laufen (die
  Plugins haben kein eigenes), und aktualisiere die Zählung."
- Ziel: die 5-Prozent-Drift-Prüfung der Testzahlen wieder belastbar
  machen.
- Ergebnis: Collection über das Backend-venv; die Zahlen in
  docs/audits/current-coverage.md folgen dem echten Lauf.
- Commit: a12f43e (#2948), Zahlen-Refresh 7f2be75 (PR #2947).

## 2. help-coverage: /review/:setId auf seine Hilfeseite gemappt (#2944/#2949)

- Original prompt (sinngemäß): "verify-docs meldet /review/:setId ohne
  Hilfeseite, die Seite existiert aber."
- Optimierter Prompt: "Ergänze das Routen-zu-Hilfe-Mapping in
  scripts/verify_docs.py um /review/:setId, damit die Heuristik die
  vorhandene Seite findet."
- Ziel: keine falsche WARN-Zeile mehr im Docs-Gate.
- Ergebnis: Mapping ergänzt; die verbleibenden WARN-Routen sind echte
  Lücken oder brauchen keine Seite.
- Commit: 88db3b8 (PR #2949).

## 3. bun audit: Retry nur bei Registry-Transportfehlern (#2933/#2950)

- Original prompt (sinngemäß): "Der Frontend-CI-Job fällt sporadisch
  auf bun audit, die Registry antwortet nicht."
- Optimierter Prompt: "Wiederhole bun audit in ci.yml nur bei
  Transportfehlern (Verbindung, 5xx), nie bei echten Audit-Befunden."
- Ziel: den Flake schließen, ohne Sicherheitsbefunde zu verschlucken.
- Ergebnis: Retry-Schleife mit Fehlerklassen-Unterscheidung im
  Workflow.
- Commit: 562319a (PR #2950).

## 4. Brainstorming-Workflow: Einstellungen > Lernen (#2951)

- Original prompt (sinngemäß): "Der Lernen-Tab ist eine flache Säule
  mit 18 Karten und 54 Eingaben, ein Drittel davon in der
  Spielmodus-Karte. Wie ordnen wir das?"
- Optimierter Prompt: "Führe ein Audit mit vier unabhängigen Lesern,
  lass vier Entwürfe erstellen und drei Juroren bewerten; entscheide
  danach die Struktur und lege Sub-Issues an."
- Ziel: eine tragfähige, vom Owner entschiedene Zielstruktur statt einer
  Ad-hoc-Umsortierung.
- Ergebnis: Befunde (17 tote Spielmodus-Unterschalter bei Aus, zwei
  Housekeeping-Karten im falschen Tab, SRS-Karte ohne Eingabe, versteckter
  Lautstärkeregler, fehlendes settings-learning-Motiv, Hilfe beschreibt
  Controls im falschen Tab). Entscheidung (Owner): ein Lernen-Tab, fünf
  Cluster in der #1459-Reihenfolge (Grundlagen / In der Lektion /
  Vorlesen und Diktieren / Nach der Lektion / Motivation und Routine),
  Housekeeping auf Daten, SRS in die Wiederholungs-Karte, Spielmodus als
  Zusammenfassungskarte mit gemerktem Details-Fold, Sektionsleiste mit
  `?tab=learning&section=<id>`, Gamification zuletzt in den
  Motivation-Cluster. Abgelehnt: Tab-Split Lernen/Motivation und die
  reine Umsortierung. Ergebnis der Jury: P2, einstimmig. Umbrella #2951
  mit 15 Sub-Issues (#2952 bis #2966).
- Commit: kein Code.

## 5. Stufe 1: i18n, Visual-Motiv, Refactor, Daten-Tab, Cluster, Feedback-Karte

- Original prompt (sinngemäß): "Stufe 1 komplett, i18n zuerst."
- Optimierter Prompt: "Arbeite #2952 bis #2957 in dieser Reihenfolge ab:
  Katalogschlüssel (11 Kataloge), settings-learning-Baselines,
  InteractionControl aus LearningPanel extrahieren, Aufräum-Karten auf
  den Daten-Tab, fünf SettingsCluster mit SRS in Wiederholung,
  Lautstärkeregler immer sichtbar plus Spielmodus-Hinweis; TDD, Testplan
  DE+EN, FeatureShots."
- Ziel: die Grundstruktur ohne neue Abhängigkeit und ohne
  testid-Umbenennung.
- Ergebnis: #2952 (PR #2967), #2953 (PR #2968), #2954 (PR #2971),
  #2955 (PR #2974), #2956 (PR #2979), #2957 (PR #2973), alle auf
  develop.
- Commit: 87ebbcc, d42b50a, 0d2dc0e, adfe187, fb385e6, 3936b6d.

## 6. Stufe 2: Spielmodus-Zusammenfassungskarte mit Details-Fold (#2958/#2959)

- Original prompt (sinngemäß): "Spielmodus: Zusammenfassung oben,
  Details eingeklappt, bei Aus deaktiviert mit Hinweis."
- Optimierter Prompt: "Schlüssel zuerst (#2958), dann die Karte:
  Hauptschalter, Sounds, Statuszeile 'N von 7 Extras an', gemerkter
  Fold (disclosurePref), alle Unter-Controls bei Aus disabled mit
  Hinweis (#335 sichtbar-aber-deaktiviert)."
- Ziel: die 605-Zeilen-Karte auf eine lesbare Zusammenfassung
  reduzieren, ohne Funktion zu verstecken.
- Ergebnis: #2958 (PR #2969), #2959 (PR #2975).
- Commit: 224d314, 5dab495.

## 7. Stufe 3 (Teil), Housekeeping: aria-Label, Tab-Inventare, Hilfe-Locales, pr-policy

- Original prompt (sinngemäß): "Die kleinen Sachen nebenbei."
- Optimierter Prompt: "Lege den aria-Schlüssel der Sektionsleiste in
  allen Katalogen an (#2960), vervollständige die e2e-Tab-Inventare um
  integrations + diagnostics (#2963), ergänze die Lernen-Sektion in den
  el/es/ja/pt/tr-Hilfeseiten (#2965), und korrigiere pr-policy.md um die
  Richtung der i18n-Schlüssel-Gates (#2977)."
- Ziel: die Vorbedingungen für Stufe 3/4 auf develop haben.
- Ergebnis: #2960 (PR #2970), #2963 (PR #2976), #2965 (PR #2980),
  #2977 (PR #2978).
- Commit: 74bb91f, f430c26, cf71ad3, 75a2c5e.

## 8. Befunde des Tages

- `gh pr checks N --json` gibt es in gh 2.46.0 nicht (unknown flag);
  Check-Status per `gh api repos/.../commits/<sha>/check-runs`.
- Der Push des visual-baseline-sync-Workflows löst keine CI aus (Token);
  ohne `gh api -X PUT .../pulls/N/update-branch` oder einen weiteren
  Commit bleibt der PR mit drei Check-Runs blockiert.
- `gh pr edit` und `gh issue edit` scheitern still; Labels und
  Issue-Bodies per `gh api` setzen.
- Guard #2864 (`full-tree-key-coverage.test.ts`) verlangt jeden im Code
  benutzten i18n-Schlüssel in allen 11 Katalogen; darum i18n-PRs vor den
  Feature-PRs (pr-policy-Korrektur #2977/#2978).
- Bekannter Flake: `lesson-types-source.guard.test.ts` timeoutet bei
  parallelen Vitest-Läufen (#2972); isoliert grün.

## Zusammenfassung

- 14 PRs gemerged (#2947, #2948, #2949, #2950, #2967 bis #2980), alle
  auf develop; Umbrella #2951 mit 11 von 15 Sub-Issues abgehakt.
- Offen am Tagesende: #2961 (Sektionsleiste), #2962 (Gamification),
  #2964 (tote Exporte), #2966 (Scroll-Spy); Arbeitsstände lagen in
  lokalen Agenten-Worktrees und wurden nicht gepusht (siehe
  2026-09-06).
