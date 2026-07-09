# EXP-044: CSS-Vereinheitlichung — ein System, sauber

**Kategorie:** Querschnitt
**Phase:** laufend
**Priorität:** Sehr hoch
**Abhängig von:** EXP-016 (Visual-Regression-Netz), #1467 (global.css-Analyse)
**Umbrella-Issue:** #1485
**Stand:** 2026-07-09 (nach v2.1.0)

## 1. Problem

Drei Styling-Generationen koexistieren mit **umgekehrter** Priorität zur
Zielarchitektur:

| Kaskaden-Priorität | System | Soll-Rolle | Ist-Rolle |
| --- | --- | --- | --- |
| 1 (stärkste) | Inline-Styles (307 `style={`-Vorkommen, Messung 2026-07-09) | keine | teils Theme-Brecher, teils *notwendige* Krücken |
| 2 | Unlayered `global.css` (7591 Zeilen) | Altbestand, soll schrumpfen | de facto das Design-System |
| 3 (schwächste) | Tailwind-Utilities (layered) | das erklärte Zielbild | verliert gegen jede unlayered Regel derselben Property |

Die Phase-A-Entscheidung von v1.55.0 ("unlayered global.css wins, existing
pages stay pixel-identical") war als Sicherheitsnetz für die additive
Tailwind-Einführung richtig. Sie macht aber die "migrate when touched"-
Strategie strukturell tückisch: **Utilities auf Elementen mit globalen
Klassen sind stille No-ops.** Belegte Folgen (alle 2026-07 verifiziert):

- `border-2 rounded-app p-4` auf `.settings-section` wirkt nicht — die
  DangerZone-Overrides mussten deshalb inline bleiben (#1476/#1479).
- `input { padding }` musste einzeln nach `@layer base` verschoben werden,
  damit `pl-9` überhaupt greift (#1458) — dieselbe Fallenklasse, einzeln
  entdeckt und einzeln gefixt.
- Klassennamen ohne existierende CSS-Regel (`.settings-subsection`,
  `.api-key-required-*`) rendern kommentarlos keine Karte (#1465).
- Ad-hoc-Utility-Nachbauten driften sichtbar vom Design ab (#1482).
- Fehlender Struktur-Wrapper fällt keinem Gate auf (#1484).
- Kein Instrument sieht: besiegte Utilities, tote Klassennamen,
  Inline-Styles (Gate-Lücke 2, Inventur läuft als eigener Auftrag).

## 2. Zielzustand ("Definition von sauber")

Am Ende existiert **ein** System mit klaren Zuständigkeiten:

1. **Tokens** (unverändert): kanonische CSS-Variablen in
   `styles/themes/theme-*.css` (themebar) + `global.css :root`
   (theme-agnostisch); Tailwind liest sie über die `@theme inline`-Bridge.
2. **Utilities/shadcn** stylen JEDE Komponente; komponentenspezifische
   CSS-Klassen in `global.css` existieren nicht mehr.
3. `global.css` enthält nur noch: Tokens/Reset/Fokus-Baseline
   ("Foundation") und Third-Party-Overrides (ProseMirror, xyflow,
   QR-Overlay, highlight.js) — Dinge, die fremdes DOM stylen müssen.
4. **Inline-Styles** nur für echte Laufzeitwerte (Kategorie i:
   Theme-Previews, gemessene Pixel, Prozentbreiten aus State), gedeckelt
   durch den Inline-Style-Ratchet.
5. **Gates halten den Zustand:** Größen-Ratchet (#1467), Inline-Ratchet,
   Dead-Classname-Detektor, Token-Guards, 12-Theme-Kontrast- und
   Visual-Suiten.

Messbare Endkriterien: `global.css` < 1500 Zeilen (nur Foundation +
Third-Party), 0 komponentenspezifische Selektoren, `style={`-Zähler auf
dem Kategorie-i-Sockel, alle Ratchets monoton fallend.

## 3. Der strukturelle Unlock: EIN neues Layer (korrigierte Option A)

CSS-Fakten, an denen jede Variante gemessen wird: Unlayered schlägt jede
Layer-Regel; unter Layern gewinnt die **später deklarierte** Schicht.

```css
/* tailwind.css — neue Deklaration (Tranche 0) */
@layer theme, base, legacy, components, utilities;
```

- **Nur der Komponenten-Schuldenblock** wird in `@layer legacy { ... }`
  gewrappt. Da `legacy` VOR `utilities` deklariert ist, gewinnen
  Utilities ab dann immer → "migrate when touched" wird gefahrlos, die
  Inline-Krücken können fallen.
- **Foundation + Third-Party-Overrides bleiben unlayered.** Sie müssen
  weiter über Utilities gewinnen, und unlayered tut das bereits — null
  Risiko, null Arbeit. (Damit entfällt die im Review vorgeschlagene
  Mehrfach-Layer-Struktur; deren Deklarationszeile hätte
  `legacy-components` als LETZTES = stärkstes Layer deklariert und die
  Kaskade in die falsche Richtung geflippt.)
- Granularität kommt über die **Tranchen innerhalb** des einen Layers,
  nicht über zusätzliche Layer.

Verworfene Alternativen: (B) Inversion akzeptieren = Tailwind-Zielbild
aufgeben; (A3) `!important`-Utilities = neue Eskalationsstufe statt
Reparatur; (A2 mehrschichtig) = mehr Risiko ohne Zusatznutzen, s. o.

## 4. Tranchenplan

Jede Tranche = eigener Branch/PR, eigenes Gate. Reihenfolge fest.

| Tranche | Inhalt | Risiko | Gate |
| --- | --- | --- | --- |
| **0** | `@layer`-Deklarationszeile um `legacy` ergänzen; noch NICHTS wrappen. Kommentarblöcke in `tailwind.css` (Phase-A-Prosa "unlayered wins") aktualisieren. | minimal | `make verify-screenshots` + Vitest unverändert grün (leeres Layer ändert nichts) |
| **1** | Tote Regeln löschen (die im #1467-Audit identifizierten Selektoren, vor dem Löschen einzeln gegen `git grep` verifiziert); `.css-size-baseline` runter. | klein | Volle Vitest + Visual-Suiten |
| **2** | Block-für-Block-Wrap des Komponenten-Schuldenblocks in `@layer legacy { ... }` — **hier flippt die Kaskade.** Pro Teilblock (Seitenbereich, s. Abschnittskommentare in global.css: Landing/Onboarding/Assessment/Dashboard/Session/Settings/Navigation/Curriculum/...) ein Commit, jeweils Visual-Diff-Review. Foundation (bis ca. Zeile 483) und Third-Party-Blöcke (u. a. QR-Viewfinder ab Z. 1444, ProseMirror-/Editor-Blöcke, xyflow) werden ausdrücklich NICHT gewrappt. | **hoch** | Pro Teilblock: `make verify-screenshots` (Theme-Suite + critical-surfaces + FeatureShots inkl. #1481) + dexie-smoke; Abbruchkriterien s. u. |
| **3** | Krücken-Rückbau: die dokumentierten Inline-Overrides (DangerZone-Konstante aus #1479, `maxWidth`-Modal-Override, `font-family`-Input) auf Utilities umstellen — jetzt möglich, weil Utilities gewinnen. | klein | Vitest + Visual |
| **4+** | Option C, eine Komponente pro PR: geteilte Komponente bauen (Start: `<SettingsSection>` — Karte + Titel + testid-Prop), Konsumenten umziehen, zugehörige `legacy`-Regeln LÖSCHEN, Ratchet runter. Reihenfolge nach Schmerz: settings-section → modal-card/modal-overlay → btn-Familie → dashboard-card → Rest nach Inventar. | mittel, verteilt | Pro PR: Vitest + Visual + Ratchet |

Parallel, unabhängig von den Tranchen:

- **Inline-Style-Inventar + Ratchet** (läuft als eigener CC-Auftrag,
  Gate-Lücke 2).
- **Dead-Classname-Detektor** (eigener Auftrag): jeder in TSX verwendete
  Klassenname, der weder eine Tailwind-Utility noch in einer CSS-Datei
  definiert ist, wird gemeldet (Ratchet mit Startbaseline).

## 5. Risiko-/Netz-Matrix

| Fläche | Visual-Baseline | Risiko bei Tranche 2 |
| --- | --- | --- |
| Dashboard, Content-Hub, Progress, Lesson-Runner, Lesson-Modi, Matching, Answer-Toggle, QR-Share, Summary-Sections | FeatureShots (#1023) | abgedeckt |
| 12-Theme-Flächen, kritische Surfaces | theme-regression + critical-surfaces | abgedeckt |
| Settings (alle Tabs) | FeatureShots + Settings-Vitest-Pins (#1451/#1459/#1484) | abgedeckt |
| ErrorReportDialog, Sync-Notice | #1481 (PNGs: `make capture-screenshots` ausstehend) | abgedeckt, sobald PNGs committet |
| Echte Sync-Zustände (desktop-unpaired, QR-Panel, Scanner), Launcher | **keine** (Dexie-Pipeline erreicht sie nicht, #1480) | Restrisiko: manueller Check im API-Modus vor + nach Tranche-2-Teilblock "Sync" |
| Onboarding-Wizard, Assessment | teilweise (dexie-smoke funktional, kein Pixel-Netz) | Restrisiko: gezielter Device-Check |

**Voraussetzung vor Tranche 2:** #1481 gemerged UND die PNGs vom
Maintainer-Rechner erzeugt/committet; offene Settings-PRs (#1483, #1487)
gemerged, damit die Baselines den Zielzustand zeigen.

## 6. Abbruchkriterien und Rollback

- **Abbruch eines Tranche-2-Teilblocks:** unerwartete Visual-Diffs in
  mehr als 3 % der Baselines ODER ein einziger Diff, der einen echten
  Bug zeigt (dann: Bug fixen, nicht Baseline aktualisieren —
  bestehende Regel). Teilblock zurücknehmen, in kleinere Blöcke
  schneiden, erneut.
- **Rollback:** jede Tranche ist ein eigener PR mit rein mechanischem
  Diff (`@layer legacy {` + Einrückung + `}`), `git revert` genügt;
  keine Datenmigration, kein API-Bezug. Produktions-Exposition erst mit
  dem nächsten Release — zwischen Merge und Release-Cut bleibt das
  Preview-Deployment als Beobachtungsfenster.
- **Niemals** `--update-snapshots`, um einen Diff zu übertünchen
  (bestehende Regel aus quality-checks.md).

## 7. Bekannte Stolpersteine (beim Ausführen prüfen)

1. `scripts/check-css-size.sh`-Ratchet: das Wrappen fügt Zeilen hinzu →
   Baseline-Erhöhung MIT Begründung im selben PR (einzige legitime
   Ausnahme vom Nur-Schrumpfen).
2. Struktur-Tests, die global.css-TEXT parsen (`no-hardcoded-colors`,
   `input-padding-layer`, `themes`/`contrast` auf Theme-Dateien):
   vor Tranche 2 prüfen, ob ihre Regexe `@layer legacy {`-Wrapper
   tolerieren.
3. CSS-Nesting: Regeln innerhalb `@layer` verhalten sich identisch,
   aber `:root`-Custom-Properties gehören NICHT ins Legacy-Layer
   (Foundation bleibt draußen — sonst könnten Token-Reads kippen).
4. `@import`-Reihenfolge in `main.tsx`/`index.css`: die
   `@layer`-Deklaration muss VOR dem ersten gelayerten Inhalt geladen
   werden (heute via `tailwind.css` Zeile 23 — Ladepfad verifizieren).
5. Spezifität INNERHALB des Legacy-Layers bleibt unverändert — interne
   global.css-Konflikte (z. B. `h2 + p` vs. `:not(:first-child)`,
   lessons-learned) ändern sich nicht.

## 8. Erfolgsmessung

| Metrik | Start (2026-07-09) | Ziel |
| --- | --- | --- |
| `global.css` Zeilen | 7591 | < 1500 (Foundation + Third-Party) |
| Komponentenspezifische Selektoren in global.css | (Inventar Tranche 2) | 0 |
| `style={`-Vorkommen | 307 | Kategorie-i-Sockel (Inventar läuft) |
| Tote Klassennamen | (Baseline Detektor) | 0 |
| Utility-No-op-Fallenklasse | strukturell möglich | strukturell unmöglich (ab Tranche 2) |

## 9. Historie / Querverweise

- v1.55.0 Phase A: Tailwind additiv, preflight aus, unlayered gewinnt
  (bewusst).
- #1458, #1465, #1467, #1476, #1479, #1482, #1484: die Einzelsymptome,
  die zu dieser Exploration führten.
- Entscheidung Option A (korrigiert) + C: Aster, 2026-07-09, nach
  Analyse-Session + externem Review (Qwen; dessen A2-Mehrfach-Layer und
  Layer-Reihenfolge hier korrigiert).
