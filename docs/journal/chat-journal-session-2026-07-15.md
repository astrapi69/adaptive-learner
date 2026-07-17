# Chat-Journal - Session 2026-07-15 (Peel 2 + develop-Rot-Fix #1665)

Fortsetzung der Vormittags-Session (siehe
[handover-2026-07-15-css-split-kickoff.md](handover-2026-07-15-css-split-kickoff.md)).
Auftrag laut Handover: #1663/#1664 mergen, dann Peel 2 (Base-Resets).

## 1. Queue abgearbeitet: #1663 + #1664 gemergt (10:11)

- Original prompt: "Naechste Session: Peel 2 (Base-Resets) nach #1663-Merge"
- Ziel: die offenen PRs aus der Queue mergen (Vibe-Coding-Prioritaet 1).
- Ergebnis: #1663 (Peel 1) und #1664 (Handover) squash-gemergt, beide
  Worktrees + lokale Branches aufgeraeumt.
- Commits: 0ddc6a83 (#1663), bdf4cb7e (#1664)

## 2. Reader-Inventar-Pruefung fand develop ROT: #1665 -> PR #1666 (10:15)

- Ziel: vor Peel 2 pruefen, welche Pins/Skripte die Base-Reset-Regeln
  lesen.
- Befund: die `--matching-pair-*`-Tokens liegen seit Peel 1 NUR noch in
  `styles/legacy/00-head.css`, aber der Hue-Pin in
  `MatchingExercise.test.tsx` las global.css direkt und assertierte 7
  Token-Treffer -> 0 Treffer -> die VOLLE Suite auf develop war seit dem
  #1663-Merge rot (Runs 29399893079/29399908571; davor gruen). Der
  #1663-PR blieb gruen, weil `vitest --changed` readFileSync-Reads nicht
  im Modulgraphen sieht (#1620-Klasse); der develop-Push (volle Suite,
  #615-Sicherheitsnetz) fing es wie designt.
- Fix (PR #1666, Closes #1665): der inline `readLegacyCssSum()`-Helper aus
  matching-pair-palette.test.ts wurde nach
  `frontend/src/styles/legacy-css-sum.ts` extrahiert (cwd-basiert, laeuft
  unter node UND happy-dom); BEIDE Token-Leser importieren ihn jetzt.
  50/50 Tests gruen, tsc + eslint clean. Gemergt 09:28 UTC; develop-CI
  auf 9e7ac217 wieder gruen.
- Lesson (im Memory): vor jedem Peel ALLE readFileSync-Konsumenten der
  verschobenen Region ueber ganz frontend/src greppen (nicht nur
  src/styles) und die volle lokale Vitest-Suite fahren.
- Commit: 9e7ac217 (#1666)

## 3. Peel 2: Base-Resets -> styles/legacy/01-base.css (PR #1670, 10:30-11:04)

- Ziel: Zeilen 3-345 (Base-Resets: `* {box-sizing}`, html/body/#root-
  Shell, img/svg/pre/code, .code-block*, a:not(), [hidden],
  :focus-visible, .sr-only/.skip-to-content, button-/input-Basis inkl.
  beider @layer-base-Bloecke) verbatim auslagern - der erste Peel, der
  REGELN verschiebt.
- Byte-Identitaets-Beweis (#1655-Pflicht-Gate): `make css-identity-ref`
  (212319 Bytes, sha256 9733c626...) -> Move -> `make css-identity-check`
  -> "byte-identisch". Zeilenneutral: Summe blieb exakt auf der
  7566er-Baseline (-344 +2 in global.css, +342 in der neuen Datei).
- Commit 1 (9f28c539): Multi-File-Support im Konflikt-Audit-Tool
  (#1655-Touchpoint, faellig beim ersten regeltragenden Peel).
  `load_css_virtual()` laedt legacy/*.css ZUERST + global.css ZULETZT
  (= Kaskadenordnung nach @import-Inlining; PREPEND ist tragend - Append
  wuerde Source-Order-Tie-Breaks in find_legacy_dependencies invertieren
  = False Negatives, per Unit-Test gepinnt). `--block`-Zeilennummern
  bleiben global.css-relativ; `fmt_loc()` druckt datei-qualifizierte
  Orte. Verdikt-Paritaet gegen das Alt-Tool bewiesen (identische
  Zusammenfassung). Dazu: `frontend/src/styles/legacy/**` in die
  visual-baseline-gate-Pfade. 4 neue Unit-Tests, 23/23 gruen.
- Commit 2 (e4822210): der Move + 6 Reader-Pins auf `readLegacyCssSum()`
  im SELBEN Commit (app-shell-viewport, single-scroll-container,
  hidden-reset, input-padding-layer, contrast #185/#271 + #194 - der
  zweite contrast-Pin fiel erst im lokalen Voll-Lauf auf). Volle lokale
  Suite: 670 Dateien / 6997 Tests gruen.
- Commit 3 (c4fa059b): das file-size-Gate meldete die Audit-CLI mit 1092
  Zeilen (> 1000). Split statt Whitelist (Vibe-Coding Regel 5):
  CssSegment/load_css_virtual/fmt_loc -> `css_parse_lib.py` (dessen
  Zeilennummern-Modell das thematisch ist), Report-Rendering -> neues
  `css_wrap_report.py` (WrapReport-Protocol duck-typt BlockReport;
  Re-Exports halten CLI-Oberflaeche + Tests stabil). 899/645/191 Zeilen.
- PR #1670: alle Checks gruen, Label `visual-baselines-unaffected`
  (Byte-Identitaets-Output = Beleg, per REST gesetzt + verifiziert),
  squash-gemergt als 3a58f25e.

## Naechste Session

- **Peel 3**: die gewrappten `@layer legacy`-Bloecke in Dateireihenfolge,
  beginnend mit Buttons (global.css:347 nach Peel 2). Noch direkt
  lesende Pins (Umstellung beim jeweils betroffenen Peel, Muster =
  `readLegacyCssSum()`): contrast `.btn`-Pin, reduced-motion,
  ios-zoom-guard, dead-selectors-removed, content-set-action,
  lesson-compact-nav, lesson-tts-motion.
- Parallel offen (unveraendert): #1567 FeatureShots, #1629 God-Classes,
  #1653 settings-data-Determinismus, #1592-Zone (loest sich im
  Split-Endspiel).

## Statistik

- 4 PRs gemergt: #1663, #1664 (Queue), #1666 (Fix), #1670 (Peel 2)
- 1 Issue gefiled + geschlossen: #1665 (develop-Rot)
- Peel-Stand: global.css 7427 -> 7085 Zeilen; styles/legacy/ = 00-head
  (139) + 01-base (342); Summe konstant 7566 (Ratchet exakt auf Baseline)
- Tests: volle Frontend-Suite 6997 gruen; Audit-Tool-Unit-Tests 19 -> 23;
  Byte-Identitaet 2x bewiesen (Fix-Session + Peel 2)

## 4. Nachtrag: #1620 strukturell geschlossen + Peel 3 (11:15-12:10)

- Original prompt: Aster bestaetigte die #1661-Einordnung und zog die
  forceRerunTriggers-Verifikation isoliert VOR Peel 3 ("eine Sache nach
  der anderen").
- Ziel: die readFileSync-Blindstelle der selektiven PR-CI strukturell
  schliessen (statt Prozess-Pflaster), danach Peel 3.
- Issue-Doku: #1661 bekam die readFileSync-Klasse als Instanz-Klasse 4
  (Abgrenzung: PR-CI sieht Flaeche nicht vs. Selektionsmechanik
  verfehlt sie); #1620 den zweiten Incident (#1665) + Optionen.
- #1620-Fix (PR #1673, Closes #1620): `forceRerunTriggers` in
  vite.config.ts (index.html, src/styles/**/*.css, src/data/**/*.json
  + Datei-Form-Varianten der Defaults). RED/GREEN gemessen: vorher
  0 Tests bei css/index.html-Aenderung, nachher voller Lauf (7006);
  Kontrolle (.ts-Aenderung) bleibt selektiv (2954). Zwei gemessene
  Gotchas: (1) picomatch ueberspringt Dot-Verzeichnisse - Worktrees
  unter .claude/ feuern lokal nicht (CI-Pfade dot-frei); (2) Vitests
  eigene Default-Muster enden auf /** und matchen die Config-Dateien
  selbst nie - Datei-Form-Varianten ergaenzt. Text-Pin
  `src/test/force-rerun-triggers.test.ts` (5 Tests). In-CI-Beweis:
  PR-CI lief trotz `vitest --changed` die volle Suite (671 Dateien).
- Peel 3 (PR #1675, Refs #1655): erster GEWRAPPTER Block - Buttons
  (Zeilen 4-53) verbatim nach `styles/legacy/02-buttons.css`,
  byte-identisch (ref 212319 B -> check identisch), Baseline
  7566 -> 7567 (+1 Manifest-Zeile). Neues Gotcha (lokal vor dem PR
  gefangen): der #211 `.btn`-Pin matchte im Summen-Text zuerst die
  Kontext-Regel `.lesson-next-step-card .btn` (ohne color) - Fix:
  Regex zeilenverankert (`/^\.btn\s*\{/m`). Volle Suite 7007 gruen.
- Commits: f907560a (#1673), 475c8076 (#1675)

## Naechste Session (aktualisiert)

- **Peel 4**: verbleibende gewrappte Bloecke in Dateireihenfolge,
  Start Landing page (global.css:5 nach Peel 3). Beim Sum-Switch
  jedes Pins auf First-Match-Annahmen pruefen (Zeilenanker-Muster).
- Parallel offen: #1567 FeatureShots, #1629 God-Classes, #1653
  settings-data-Determinismus.

## 9. Concern-Split fertiggestellt: Batches A-E, global.css = Manifest (Nachmittag)

- Original prompt: "dann weiter damit wir das fertig bekommen"
- Optimized prompt: "Fuehre die restlichen Peels des #1655-Splits als
  Batch-PRs (mehrere zusammenhaengende Bloecke pro PR) bis zum
  Manifest-Endzustand aus - jeder Batch mit Byte-Identity-Gate,
  Summen-Ratchet-Anhebung, voller lokaler Vitest-Suite und Label."
- Goal: global.css vollstaendig in per-Concern-Dateien aufloesen.
- Ergebnis: der EXP-044 Concern-Split (#1655) ist strukturell
  abgeschlossen. `frontend/src/styles/global.css` ist ein reines
  @import-Manifest (43 Zeilen, Dateien 00-42 unter styles/legacy/).
  Jeder Batch verbatim + byte-identisch bewiesen (konstant
  212319 Bytes, sha256 9733c626...), Label
  `visual-baselines-unaffected` mit dem Identity-Output als Beleg.
- Batches:
  - Batch A (0d1b6cbc): 04-onboarding..07-session; Commit 1
    schaltete die letzten 6 Direkt-Reader auf `readLegacyCssSum()`
    um - danach kein Pin-Umbau mehr in irgendeinem Peel.
  - Batch B (PR #1686, bcc99e7a): 08-qr-scanner (unlayered,
    verbatim), 09-rating, 10-settings, 11-progress. Neues Gotcha:
    der eof-pre-commit-Hook strippt Leerzeilen am Dateiende -
    Slice-Trailing-Blanks muessen konkatenationsinvariant an den
    Kopf der FOLGENDEN Datei wandern.
  - Batch C (PR #1688, a26cf863): 12-navigation..19-method-badges
    (8 Dateien, 1938 Zeilen). Gotcha: `.css-size-baseline` traegt
    genau EINE Zahl (Gate liest die ERSTE Nicht-Kommentar-Zahl) -
    Zahl ERSETZEN, nicht zweite anhaengen.
  - Batch D (PR #1689, 11a18529): 20-diff-highlight..30-editor
    (11 Dateien) inkl. `24-lesson-mode-nav.css` = die #1592-Zone
    mit iOS-Focus-Zoom-Guard, unveraendert unlayered verbatim.
  - Batch E (PR #1690): 31-gamification..42-learning-path
    (12 Dateien, inkl. 39-motion-catchall.css unlayered) -
    Manifest-Endzustand. Baseline final 7606 (Summen-Ratchet).
- Werkzeug: wiederverwendbares Batch-Move-Skript (verbatim-
  Reassembly-Assert + Blank-Shift; start = Leerzeile vor dem
  Header, end_line = erste bleibende Zeile, letzter Slice darf
  nicht auf Leerzeile enden).
- #1655 mit Abschlusskommentar CLOSED (Peel-Historie, Gates,
  entsperrte Folgearbeit #1592/#1629; Form-(a)-Normalisierung
  `@import ... layer(legacy)` bewusst deferred).
- Volle lokale Vitest-Laeufe je Batch: 672 Dateien / 7035-7066
  Tests gruen; jede PR-CI gruen (forceRerunTriggers erzwingt die
  volle Frontend-Suite bei CSS-Aenderungen).
- Commits: bcc99e7a (#1686), a26cf863 (#1688), 11a18529 (#1689),
  Batch-E-Squash (#1690)

## Naechste Session (aktualisiert)

- **#1592**: mobile-@media Co-Wrap - jetzt per-Concern in
  `24-lesson-mode-nav.css` loesbar.
- **#1629**: God-Class-Abbau per-Datei.
- Parallel offen: #1567 FeatureShots, #1653
  settings-data-Determinismus.

## 10. #1592 geloest: Co-Wrap 08+24, EXP-044-Kaskadenreparatur komplett (Nachmittag)

- Original prompt: "ja dann weiter" + Vorschlag, #1592 zuerst zu nehmen.
- Optimized prompt: "Wrappe die #1592-Zone (24-lesson-mode-nav.css) in
  @layer legacy - Audit-gestuetzt, mit Co-Wrap der Basis-Zone
  (08-qr-scanner.css), bewussten unlayered-Ausnahmen fuer die
  Schutzbloecke und Visual-Verify-Beleg."
- Goal: die seit #1571/#1588 offene Wrap-Blockade aufloesen.
- Ergebnis (PR #1695, Closes #1592): 08-qr-scanner.css (QR +
  Cycle-Steps + Session-Chat-BASIS) und 24-lesson-mode-nav.css
  (LessonMode/Landscape/Mobile-Polish) in @layer legacy. Der
  Audit-Lauf hatte fuer 24 ABHAENGIG(6) gemeldet - alle sechs
  gegen die unlayered Basis in 08; der Co-Wrap (Basis + Override
  im selben Layer, Source-Order 08 vor 24) loest sie auf: CLEAN.
- Bewusst UNLAYERED bleiben (muessen Utilities schlagen, jetzt
  mit erklaerenden Kommentaren): der iOS-Focus-Zoom-Guard #1353
  (shadcn Select rendert text-sm = 14px - layered wuerde die
  Utility gewinnen und den Zoom-Bug wieder oeffnen) und der
  Mobile-Input-Floor 44px/16px (aus dem gewrappten @media-Block
  in einen eigenen unlayered Block gezogen).
- Eine dokumentierte Aktivierung (.legacy-wrap-accepted.json):
  .lesson-header h1 landscape font-size 1.1rem verliert an
  text-sm - die Legacy-Regel stammt von VOR dem #1628-Rework und
  invertierte dessen Absicht (Titel in Landscape GROESSER als
  Portrait). margin: 0 bleibt wirksam.
- Visual-Verify: PR-Branch-Lauf und develop-Kontrolllauf failen
  auf IDENTISCHEN 11 Screenshots (content-browser/discover/
  set-detail/settings-data = Live-Daten #1653/#1692, lesson-
  matching nichtdeterministisch #1696) - der Wrap fuegt keine
  eigene Diff-Flaeche hinzu. Beleg im PR, Label
  visual-baselines-unaffected, Gate re-lief gruen. Beleg-
  Kommentar auf #1692 ergaenzt (11 statt 6 Flaechen).
- Gates: --wrapped-Audit ueberall CLEAN (Allowlist 10),
  .css-size-baseline 7606 -> 7633 (+27 Wrapper-/Doku-Zeilen),
  Vitest 672 Dateien / 7075 Tests gruen, tsc clean.
- Damit ist die Kette #1571 -> #1592 -> #1597 -> #1623 -> #1634
  abgeschlossen: jede Legacy-Flaeche ist @layer legacy oder ein
  dokumentiert-bewusster unlayered Schutzblock (Guard, Input-
  Floor, 39-motion-catchall, 01-base, 00-head-Tokens); 30-editor
  + 42-learning-path sind unabhaengige Wrap-Kandidaten fuer
  Folge-PRs.
- Commit: 361aaf8e (Squash via #1695)
