# Chat-Journal — Session 2026-08-29

## 1. Sticky-Knopf für die Mess-Leiste (#2799)
- Original prompt: "Wir haben jetzt in der Diagnose also Einstellungen allgemein Diagnose, ein Check Button Messleiste anzeigen. Noch mal einen Check Button hinzufügen bei dem wenn der aktiviert ist. So ein Sticky Button hat unten links oder vielleicht können wir das auch konfigurierbar machen oben links unten rechts und so weiter. Wenn der Button dann gedrückt wird, macht er genau das gleiche wie Messleiste anzeigen und wenn er dann wieder angeklickt wird, dann wird die Messleiste wieder unsichtbar."
- Optimized prompt: "Ergänze in Einstellungen > Allgemein > Diagnose einen Opt-in-Schalter, der einen schwebenden Sticky-Button einblendet (Standard unten links, Ecke konfigurierbar). Der Button togglet die Mess-Leiste über dasselbe Flag wie der Schalter 'Mess-Leiste anzeigen'."
- Ziel: Die Mess-Leiste (#2785) unterwegs mit einem Tipp ein-/ausblenden, ohne die Einstellungen zu öffnen.
- Ergebnis:
  - Hook-Erweiterung in `hooks/settings/useViewportDiagnostic.ts` (drittes Pref-Paar, Muster #2785): `adaptive-learner.vv_diag_fab` (Default aus) + `vv_diag_fab_pos` (`bottom-left` Default, 4 Ecken), ein Change-Event, ungültige Position fällt auf `bottom-left` zurück.
  - Neue Komponente `components/dev/VvPanelToggleFab.tsx`: rendert nur bei Sonde AN + Fab-Pref AN (doppeltes Opt-in, #1569-Haltung); Klick ruft `setVvPanelVisible(!visible)` — dieselbe Single Source wie der Settings-Schalter, `aria-pressed` spiegelt den Leisten-Zustand; bei aktiver unterer Tab-Leiste (#2790) rücken die unteren Ecken über die Leiste (`bottom-20 md:bottom-4`). Mount in `App.tsx` neben `ViewportDiagnostic`.
  - Protokoll-Hygiene: der pointerdown-Ignore des Overlays umfasst jetzt auch den Fab-testid, damit das Umschalten keine Tap-Einträge erzeugt (Test gepinnt).
  - Settings-UI: Toggle + (bei AN, Conditional-Fields-Muster) Radio-Gruppe mit 4 Ecken in der Diagnose-Sektion.
  - i18n: 8 neue `settings.vvdiag_fab_*`-Schlüssel in allen 11 Katalogen, `make sync-i18n`; Testplan DE+EN (TESTPLAN-PFLICHT).
  - TDD: Hook-, Komponenten- und Overlay-Tests zuerst RED, dann GREEN; neuer E2E `e2e/dexie/vv-fab.spec.ts` (FAB erscheint, togglet die Leiste, bleibt ohne Pref/Sonde verborgen) — 3/3 grün gegen den dexie-Build in echtem Chromium, Screenshots beider Zustände erzeugt.
- Commit: siehe PR (Closes #2799).

## 2. Nebenbefund: committete Merge-Konflikt-Marker im EN-Testplan (#2800)
- Ziel/Anlass: Beim Einfügen des #2799-Blocks fielen `<<<<<<< HEAD`/`=======`/`>>>>>>> origin/develop` in `docs/manual-tests/testplan-adaptive-learner-en.md` auf develop auf — die #2786- und #2793-Sektionen standen als unaufgelöster Konflikt im committeten Stand.
- Ergebnis: Issue #2800; Fix als eigener Commit im selben PR (Marker raus, BEIDE Sektionen behalten, Reihenfolge wie im DE-Plan). DE-Plan war nicht betroffen.

## 3. Fehlerkorrektur: Auflösung in der Token-Zeile (#2803)
- Original prompt: "bei welchen anderen aufgaben macht es sinn ein auflösen-Button hinzuzufügen?" -> "ok richtig: Fehlerkorrektur (ext:al-error-correction) — empfohlen. go"
- Optimized prompt: "Analysiere alle Übungstypen auf fehlende Auflösungs-Ansichten und ergänze beim stärksten Kandidaten (Fehlerkorrektur) den 'Meine Antwort'/'Auflösung'-Umschalter, dessen Lösungsansicht die Korrektur IM Satz zeigt."
- Ziel: Der Lernende sieht, WO im Satz der Fehler lag - nicht nur das Zielwort in einer Textzeile.
- Ergebnis:
  - Konsistenz-Audit über alle 13 Renderer: Toggle existiert bei Matching/Kategorisieren/Freitext/Cloze/Word-Tiles; Auswahl-Typen (MC, Bild, Multi-Select, Leseverstehen) lösen inline auf - einziger starker Kandidat: Fehlerkorrektur (Kriterium: Lösung und eigene Antwort konkurrieren um dieselbe Fläche).
  - Wiederverwendung des generischen `ExerciseAnswerToggle` (#1005, generische `lesson.exercise.toggle.*`-Labels - keine neuen Toggle-Keys). Neue presentationale `ErrorCorrectionResolution`: Token-Chips in Autoren-Reihenfolge, an `error_index` das falsche Token rot durchgestrichen mit X, daneben `accept[0]` grün mit Häkchen; `aria-live` sagt den korrigierten Satz an (`al_error_correction.resolve_announce`, 11 Kataloge).
  - Die bisherige Lösungszeile bleibt in der "Meine Antwort"-Ansicht; ihr testid zog auf `error-correction-solution-line` um, weil der Toggle-Button `error-correction-solution` belegt (nur Vitest referenzierte das alte id, kein E2E-Spec).
  - Complexity-Gate riss bei der Hauptfunktion (cc 22 > 20) -> interaktive Ansicht als `ErrorCorrectionMyAnswer` extrahiert (etabliertes Muster der Datei), Gate grün ohne Baseline-Eintrag.
  - TDD (RED->GREEN, 16 Tests inkl. eigener `ErrorCorrectionResolution.test.tsx`); E2E: extension-wizard-Spec beantwortet die Fehlerkorrektur jetzt absichtlich falsch und öffnet die Auflösung (korrekter Pfad bleibt Vitest-gedeckt); Screenshots beider Ansichten aus echtem Chromium; Testplan DE+EN.
  - Umgebungsnotiz: nach dem #2802-i18next-Refactor brauchte der frische Stand ein `bun install` (neue Dependencies i18next/react-i18next); Katalog-Pipeline (`make sync-i18n`) unverändert.
- Commit: siehe PR (Closes #2803).

## Fragen und Annahmen
- Konservative Annahme (im Issue #2799 dokumentiert): Der Fab rendert nur bei aktiver Sonde — ohne Sonde gibt es keine Leiste zum Umschalten, und normale Nutzer sehen nie einen schwebenden Diagnose-Knopf.
- Evidenzbasiert entschieden: Positions-Auswahl als Radio-Gruppe (Muster der Menüposition #2786 direkt darüber), Persistenz als localStorage-Pref mit Event (Muster #2782/#2785) — Diagnose-Prefs sind bewusst browser-lokal, kein `IStorageService`-Fall.
