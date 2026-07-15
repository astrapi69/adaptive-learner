# Handover - 2026-07-15 (Gates scharf, Concern-Split gestartet, Peel 1 offen)

## TL;DR

Der Vormittag hat drei strukturelle Loecher geschlossen und das
Concern-Split-Vorhaben (#1655) gestartet: (1) das Visual-Baseline-Gate ist
jetzt **Required-Check** auf develop (nach den Stale-Baseline-Races 4+5:
#1644/#1649 wurden am roten Advisory-Gate vorbei gemerged); (2) die
CI-Pfad-Filter sind **symmetrisch** (#1658/#1659: frontend-tests skippt auf
reinen Backend-PRs, beide Zweige live bewiesen); (3) der **Byte-Identitaets-
Gate** fuer den Split steht (#1657, Determinismus + Fail-Pfad + @import-
Transparenz alle GEMESSEN). **Peel 1 laeuft als PR #1663** (head-Kommentar +
:root-Tokens -> styles/legacy/00-head.css, byte-identisch bewiesen,
Ratchet auf Summen-Semantik) - Review + Merge ausstehend.

## Was heute landete

| Was | PR/Issue | Stand |
|---|---|---|
| Baseline-Refresh #3 (#1644 Pause-Footer + #1649 Stern + settings-data-Drift) | #1654 (Closes #1638) | MERGED |
| Determinismus-Issue: settings-data haengt an live recommended-repos.json | #1653 | OPEN (Fetch im Visual-Spec pinnen) |
| Required-Check auf develop (Branch-Protection NEU angelegt) | - | LIVE: contexts=[Visual-critical changes carry baselines], strict=false, **enforce_admins=false** (Release-Back-Merge ist ein Direct-Push - true wuerde `make release-finish` brechen; Admin-Bypass = explizite Bestaetigung) |
| Identity-Gate (make css-identity-ref/-check) | #1657 (Refs #1655) | MERGED |
| CI-Symmetrie: frontend-tests skippt auf Backend-PRs | #1659 (Closes #1658) | MERGED; Demo #1660 closed unmerged |
| Concern-Split-Vorhaben (Design + Cross-Tool-Pflichten) | #1655 | OPEN (das Umbrella des Splits) |
| **Peel 1**: Zeilen 1-140 -> styles/legacy/00-head.css | **#1663** (Refs #1655) | **OPEN - Review ausstehend** |

## Peel-1-PR (#1663) im Detail

- Commit 1: css-size-Ratchet zaehlt die **SUMME** global.css + styles/legacy/*.css
  (#1655-Pflicht: Verschieben darf den Zufluss-Stopp nicht umgehen). Zahlneutral.
- Commit 2: der Peel (verbatim + end-of-file-Newline), `@import "./legacy/00-head.css";`
  als neue Kopfzeile, Baseline 7565 -> 7566 (+1 Manifest-Zeile netto, begruendet),
  matching-pair-palette-Pin liest jetzt die Summe.
- Beweis im PR-Body: ref (212319 Bytes) -> peel -> check byte-identisch;
  nach dem Hook-Newline-Fix re-verifiziert.
- Label `visual-baselines-unaffected` gesetzt (byte-identisch = der Beleg),
  Gate pass. 16/16 Style-Testdateien (992 Tests), tsc clean.

## Die naechsten Peels (top-down, Reihenfolge ist PFLICHT)

CSS-`@import` muss vor allen Regeln stehen -> es wird strikt von OBEN
geschaelt (global.css = wachsendes Import-Manifest + schrumpfender Rest).
Naechster Chunk: die Base-Resets (`* {box-sizing}`, html/body/#root, ...)
bis zum ersten `@layer legacy`-Block (~Zeile 485 alt); danach die 37
gewrappten Bloecke in Dateireihenfolge. Jeder Peel-PR:
`make css-identity-ref` (Vor-Stand) -> Move -> `make css-identity-check`
-> Beweis in den PR-Body; Label `visual-baselines-unaffected`;
Ratchet-Kommentar.

**Reader-Inventar** (Pins/Tools, die global.css direkt lesen und beim
jeweiligen Peel auf Summen-Lesen umgestellt werden muessen, Muster =
matching-pair-palette.test.ts): layer-order, reduced-motion,
app-shell-viewport, single-scroll-container, lesson-tts-motion (+ die
Komponenten-Tests mit global.css-Read: ImageCropDialog, LessonStepNav,
MatchingExercise, QRScanner*), e2e/dexie/lesson-header-autohide.spec.ts,
scripts: check-legacy-wrap-conflicts.py + check-dead-classnames.py +
css_parse_lib.py + verify_theme.py (Multi-File-Support faellig beim
ersten Peel, der REGELN verschiebt - nicht bei Tokens/Kommentaren).

## Offene Tracks (unveraendert prioritaet-parallel)

- **#1567** FeatureShots (18 stale + 2 Flapper) - unabhaengig.
- **#1629** God-Classes .form-hint/.tile - Option-C-Einstieg.
- **#1653** settings-data-Determinismus (recommended-repos pinnen).
- **#1592-Zone** (mobile-@media-Web): loest sich im Split-Endspiel.

## Gotchas dieser Session (alle auch im Memory)

1. `$?` nach `cmd | tail` liefert den tail-Exit (PIPESTATUS nutzen);
   Commit-Ausgaben IMMER vollstaendig lesen - der end-of-file-Hook hat
   heute einen Peel-Commit still abgebrochen (00-head.css ohne
   Schluss-Newline), der Push enthielt dann nur Commit 1.
2. `gh pr edit --body/--add-label` scheitert STILL gegen dieses Repo
   (projectCards-GraphQL-Deprecation) -> REST (`gh api`) + Verify-after-
   Mutation.
3. Selbstreferenz-Catch-22 bei CI-Gate-Demos: der Demo-Branch traegt die
   geaenderte ci.yml, die selbst in den Filtern steht -> Skip-Zweig via
   demo-only-Filter-Tweak isolieren (nie mergen).
4. Fresh Worktrees brauchen `bun install`, sonst schlaegt der
   ESLint-Pre-Commit-Hook fehl (und zwar still, s. Punkt 1).
5. Baseline-Regen ist ein Race gegen parallele Merges (5 Vorfaelle):
   seit heute strukturell zu (Required-Check + in-PR-Baseline-Pflicht).
