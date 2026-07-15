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
