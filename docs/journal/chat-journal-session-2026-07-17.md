# Chat-Journal — Session 2026-07-17

Kontext: v2.3.0 wurde gestern getaggt und gepublisht (Abschluss durch
die CCW-Session, siehe Journal 2026-07-16 + post-release-Commit
bf10c532). Heute: das #1743-Buchtext-Feature und #1740/#1741
(Bearbeiten + Kombinieren) sind auf develop gemerged (#1745, #1752),
dazu die folgenden Sessions.

## 1. Umlaut-/Schrift-Degradation der #1743-Strings (#1753 -> PR #1754)

- Original prompt: CC-Prompt "Umlaut-Ersatzschreibung in
  Buchtext-Feature-Strings (#1743) korrigieren" (Screenshot: "Fuege
  ... Uebungen" auf der Template-Karte).
- Befund: NICHT eine Zeile - die kompletten 27 neuen #1743-Strings
  waren in 7 von 11 Katalogen ASCII-degradiert: de
  Ersatzschreibung, es/fr/pt/tr ohne Diakritika, el + hi in
  LATEINISCHER TRANSLITERATION statt griechischer Schrift /
  Devanagari (funktionaler Totalausfall, nicht kosmetisch). ja/ko/
  id/en korrekt.
- Root cause: kein Injector-Skript - Commit e6006288 (#1745) tippte
  die Strings direkt ASCII-degradiert (dokumentierte
  Autoren-Drift-Klasse), einmalig im Ursprung, systematisch im
  Umfang.
- Fix an der YAML-Quelle (129 Ersetzungen), make sync-i18n, i18n-
  Vitest-Suiten grün, kein E2E pinnt die alte Formulierung.
- Commit: a111a192 (PR #1754, merged).

## 2. Vorlagen-Karten "reagieren nicht" (#1756 -> PR #1757)

- Original prompt: CC-Prompt "Vorlagen-Karten reagieren nicht" -
  vermutete Regression aus der Merge-Serie #1740/#1741/#1743/#1751.
- Prämissen-Check (Browser-Repro gegen den develop-Dexie-Build):
  alle vier Karten HITTABLE, vocabulary befüllt Schritt 2 ("10
  Karten"), Buchkarte öffnet den Book-Step - Handler seit #811
  unverändert, #1752 fasste ihn nie an. Die gemeldete Regression
  existiert nicht; kein falsches Bug-Issue gefiled (Regel 4).
- Echte Ursache: UX-Kontrast - die vier Karten befüllen still
  (sichtbar erst in Schritt 2), die #1743-Buchkarte springt sofort.
- Fix: selectedTemplate-State + aria-pressed + Token-Akzent-Ring,
  exklusiv. RED-first-Test; Geräteverifikation (alle 5 Karten +
  voller Wizard-Durchlauf bis "Lokal speichern", null pageerrors).
  Nebenbefund (Draft-Autosave console.error bei leerem Entwurf) im
  Issue notiert, nicht angefasst.
- Commit: 37d0ec8f (PR #1757, merged). Label
  visual-baselines-unaffected (keine Baseline deckt den Wizard ab,
  Default-Rendering unverändert).

## 3. Worktree-Sweep

- Sechs verwaiste .claude/worktrees/* aus früheren Sessions gegen
  origin verifiziert: 5 per git cherry patch-äquivalent in develop;
  der Grenzfall ci-frontend-gate meldete cherry "+", aber der
  Datei-Endzustand (git diff origin/develop <branch> -- ci.yml) war
  LEER - gleiche Arbeit via #1659 gelandet. Alle 6 entfernt, keine
  einzigartige Arbeit verloren.

## 4. i18n-Schrift-Sanity-Lint (#1755) + Altlast (#1758) -> PR #1759

- Follow-up aus #1753: scripts/verify_i18n_scripts.py (stdlib,
  reuse export_i18n_review-Helpers). Stage 1: de-Ersatzschreibung
  (kuratierte Wortliste; "musst" bewusst nicht gelistet). Stage 2:
  el/hi-Schrift-Mismatch (>80% Latein nach Placeholder/Token-Strip).
  Verdrahtet: make verify-i18n-scripts + pre-commit-Hook
  i18n-script-sanity (läuft im CI-pre-commit-Job). Harte Gate, kein
  Ratchet. es/fr/pt/tr-Akzentqualität bewusst out of scope (#1296
  LLM-Pass bleibt dafür zuständig).
- Der ERSTE Lauf fand echte Altlasten (#1758): der v1.86.0
  content.ai_check-Block in de ersatzgeschrieben (17 Werte inkl.
  storage_mode_*) und in hi latein-transliteriert (24 Werte).
  Reihenfolge im PR: Fix-Commit zuerst, Gate-Commit danach - jeder
  Commit einzeln grün (der Gate-Test pinnt saubere Kataloge).
  False-Positives (Theme-Namen, RESET, App-Name, "musst") gingen in
  Allowlists/Wortlisten-Korrektur, nicht in schwächere Schwellen.
- Commits: f8770e37 + 5990fba7 (PR #1759, merged als 6c410b37).

## 5. Doku-Sync (dieser PR)

- Original prompt: "Alle dokus sollten upgedated werden auf den
  neuesten Stand" + "auch die mkdocs".
- Gap-Audit + Behebung:
  - MkDocs-Hilfe: #1745 und #1752 lieferten NULL docs/help-Änderung
    - Buch-Modus in content-creation/overview.md (de+en) ergänzt;
    Bearbeiten-Verhalten aktualisiert + neuer Kombinieren-Abschnitt
    in user-guide/my-lessons.md (de+en). Keine neuen Seiten, daher
    kein _meta.yaml-Delta.
  - .claude/rules/lessons-learned.md: der Umlaut-Tooling-Abschnitt
    verwies auf vier GELÖSCHTE Skripte - ersetzt durch den
    #1755-Lint; Regression-Pattern-Absatz um #1753/#1758 ergänzt.
  - CLAUDE.md: sync-versions 18 -> 19 Dateien, verify-i18n-scripts
    im Kommando-Block, Hook-Liste (+ validate-bundled-content +
    i18n-script-sanity), Test-Baseline aktualisiert und heute
    verifiziert: backend 1415 + plugins 1080 + Vitest 7213 = 9708.
  - Dieses Journal.

## Statistik

- 4 Issues gefiled (#1753, #1756, #1758 + Follow-up #1755 gestern),
  alle CLOSED; 3 PRs gemerged (#1754, #1757, #1759) + dieser
  Doku-PR.
- Neue Tests: 1 Vitest (Template-Selected-State) + 10 pytest
  (verify_i18n_scripts) + Katalog-Sauberkeits-Pin.
- Neue Gates: make verify-i18n-scripts + pre-commit
  i18n-script-sanity.
- Testzahlen (verifiziert 2026-07-17): backend 1415, plugins 1080,
  Vitest 7213.

## Questions and assumptions

- Annahme: die MkDocs-Site deployt die Hilfe-Änderungen wie üblich
  mit dem nächsten main-Push (Release); kein außerplanmäßiger
  Deploy nötig.
- Annahme: CLAUDE.md-Current-state bleibt der v2.3.0-Release-Snapshot;
  die seit dem Tag gemergten Features (#1743, #1740/#1741) wandern
  beim nächsten Release hinein (etabliertes Muster).
