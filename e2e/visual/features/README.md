# Feature-Screenshots

Automatisiert generierte Screenshots aller UI-Features. Default-Theme (dark),
Deutsch. Sie dienen doppelt: Pixel-Diff-Regression UND Doku-Galerie.
Ergaenzend zur themen-/flaechen-orientierten Theme-Regression unter `../`
(`theme-regression.spec.ts`, `critical-surfaces.spec.ts`) — diese hier ist
nach **Feature** organisiert.

## Layout

```
e2e/visual/features/
  <feature-name>/
    <shot>.png            Desktop, 1280×720
    <shot>.mobile.png     Mobile,  375×812
    <shot>.landscape.png  iPhone-Landscape, 812×375 (opt-in, #1410)
```

- **Ordner + Dateien sind kebab-case.** Ein Ordner pro Feature, ein PNG pro
  erfassbarem Zustand.
- **Default-Theme: `dark`**, Sprache Deutsch, realistische Testdaten (keine
  "Test-1" Titel). Theme wird client-seitig ueber den echten
  `adaptive-learner.theme` localStorage-Key gesetzt (siehe `../helpers.ts`).
- **Viewports:** Desktop `1280×720` (`<shot>.png`) + Mobile `375×812`
  (`<shot>.mobile.png`). Eine desktop-verankerte Flaeche (z.B. ein Dialog) wird
  via `desktopOnly: true` in der `FEATURES`-Map nur als Desktop erfasst.
  Flaechen mit einer unteren Aktions-Leiste (Aufgaben-Modus) erhalten via
  `landscape: true` zusaetzlich eine iPhone-Landscape-Baseline `812×375`
  (`<shot>.landscape.png`, #1410).

## Source of truth

`../../scripts/capture-feature-screenshots.ts` — die `FEATURES`-Map paart jeden
Screenshot-`path` (`<feature>/<shot>`) mit einem `setup(page)`, das den
**Dexie-Preview-Build** (kein Backend, die GH-Pages-Form) in den zu erfassenden
Zustand bringt. Ein `setup`, das seinen Zustand nicht deterministisch erreicht,
gibt `false` zurueck und der Shot wird uebersprungen statt eine sinnlose
Baseline zu committen.

## Katalog

| Feature | Desktop | Mobile | Stand |
|---------|---------|--------|-------|
| Lernen-Tab - Gamification-Karte als letzte Karte im Bereich "Motivation und Routine", hinter einer Trennlinie (#2962) | `gamification-card/settings.png` | `gamification-card/settings.mobile.png` | #2962 |
| Lernen-Tab - Bereichsleiste über den fünf Bereichen, Deep-Link `?tab=learning&section=review`, Chip "Nach der Lektion" aktiv (#2961) | `learning-subnav/settings.png` | `learning-subnav/settings.mobile.png` | #2961 |
| Lernen-Tab - fünf Bereiche "Grundlagen / In der Lektion / Vorlesen und Diktieren / Nach der Lektion / Motivation und Routine", Verteilte Wiederholung in der Wiederholungs-Karte (#2956) | `learning-clusters/settings.png` | `learning-clusters/settings.mobile.png` | #2956 |
| Daten-Tab - Aufräum-Karten "Pausierte Lektionen aufbewahren" + "Maximale Lektionsgröße" (#2955) | `data-housekeeping/settings.png` | `data-housekeeping/settings.mobile.png` | #2955 |
| KI-Anbieter — Perplexity in der Übersicht, "Nur Desktop" (#2512) | `ai-providers/configured-with-perplexity.png` | `ai-providers/configured-with-perplexity.mobile.png` | #2514 |
| KI-Schlüssel-Tresor — Export + Cross-App-Import (#2512) | `ai-providers/key-vault-import.png` | `ai-providers/key-vault-import.mobile.png` | #2514 |
| Landeseite (statisch, DE) | `landing-page/de.png` | `landing-page/de.mobile.png` | #2409 |
| Landeseite (statisch, EN) | `landing-page/en.png` | `landing-page/en.mobile.png` | #2409 |
| Dashboard Tabs — Übersicht | `dashboard-tabs/uebersicht.png` | `dashboard-tabs/uebersicht.mobile.png` | v2.1.0 |
| Dashboard Tabs — Aktivität | `dashboard-tabs/aktivitaet.png` | `dashboard-tabs/aktivitaet.mobile.png` | v2.1.0 |
| Dashboard Tabs — Missionen | `dashboard-tabs/missionen.png` | `dashboard-tabs/missionen.mobile.png` | v2.1.0 |
| Dashboard — KI-Einladung ohne Schlüssel (#1417) | `dashboard-tabs/ki-einladung.png` | `dashboard-tabs/ki-einladung.mobile.png` | v2.1.0 |
| Content Hub — Entdecken | `content-hub/entdecken.png` | `content-hub/entdecken.mobile.png` | v2.1.0 |
| Content Hub — Meine Inhalte | `content-hub/meine-inhalte.png` | `content-hub/meine-inhalte.mobile.png` | v1.99.0 |
| Content Hub — Meine Inhalte, Status-Filter offen (#1386) | `content-hub/meine-inhalte-filter-open.png` | `content-hub/meine-inhalte-filter-open.mobile.png` | v1.99.0 |
| Content Hub — Meine Inhalte, Liste mit Langtitel (#1392) | `content-hub/meine-inhalte-liste-langtitel.png` | `content-hub/meine-inhalte-liste-langtitel.mobile.png` | v1.99.0 |
| Content Hub — Import | `content-hub/import.png` | `content-hub/import.mobile.png` | v1.94.1 |
| Progress Hub — Übersicht | `progress-hub/uebersicht.png` | `progress-hub/uebersicht.mobile.png` | v1.94.1 |
| Progress Hub — Statistik | `progress-hub/statistik.png` | `progress-hub/statistik.mobile.png` | v1.94.1 |
| Progress Hub — Meine Pfade | `progress-hub/meine-pfade.png` | `progress-hub/meine-pfade.mobile.png` | v1.94.1 |
| Matching — Paarung (+ Landscape `matching-pairing.landscape.png`, #1410) | `matching-animation/matching-pairing.png` | `matching-animation/matching-pairing.mobile.png` | v2.1.0 |
| Matching — Auflösung | `matching-animation/matching-resolved.png` | `matching-animation/matching-resolved.mobile.png` | v2.1.0 |
| Lektions-Modi — Übung | `lesson-modes/practice.png` | `lesson-modes/practice.mobile.png` | v2.1.0 |
| Lektions-Modi — Prüfung | `lesson-modes/exam.png` | `lesson-modes/exam.mobile.png` | v2.1.0 |
| Lektions-Modi — Zeit | `lesson-modes/timed.png` | `lesson-modes/timed.mobile.png` | v2.1.0 |
| Antwort-Umschalter — Meine Antwort | `answer-toggle/meine-antwort.png` | `answer-toggle/meine-antwort.mobile.png` | v2.1.0 |
| Antwort-Umschalter — Auflösung | `answer-toggle/aufloesung.png` | `answer-toggle/aufloesung.mobile.png` | v2.1.0 |
| GitHub-Export — Dialog | `github-export/share-dialog.png` | — (Desktop-Dialog) | v1.94.1 |
| QR-Code — App teilen | `qr-code/share-app.png` | — (Desktop-Dialog) | v1.94.1 |
| Zusammenfassungs-Sektionen — Settings-Unterbereich (#1411) | `summary-sections/settings.png` | `summary-sections/settings.mobile.png` | v2.1.0 |
| Mascot-Farbvarianten — Settings-Unterbereich, Level-/Badge-/XP-Freischaltung (#2861) | `mascot-variants/settings.png` | `mascot-variants/settings.mobile.png` | v2.13.0 |
| Feedback-Karte - Lautstärkeregler immer sichtbar, Spielmodus-Hinweis bei der Intensität (#2957) | `feedback-card/settings.png` | `feedback-card/settings.mobile.png` | v2.14.0+ |
| Spielmodus - Zusammenfassungskarte + "Details zum Spielmodus" aufgeklappt, Spielmodus an (#2959) | `playful-details/settings.png` | `playful-details/settings.mobile.png` | v2.14.0+ |
| Spielmodus - Details aufgeklappt, Spielmodus aus: Optionen ausgegraut + Hinweis (#2959) | `playful-details/settings-off.png` | `playful-details/settings-off.mobile.png` | v2.14.0+ |
| Fehlerbericht — Dialog (#1480) | `error-report/dialog.png` | `error-report/dialog.mobile.png` | v2.1.0 |
| Fehlerbericht — Aktionsverlauf geöffnet (#1480) | `error-report/verlauf.png` | `error-report/verlauf.mobile.png` | v2.1.0 |
| Fehlerbericht — Vollvorschau (#1480) | `error-report/vollvorschau.png` | `error-report/vollvorschau.mobile.png` | v2.1.0 |
| Sync — Desktop-only-Hinweis, Dexie-Modus (#335/#1480) | `sync/desktop-only-hinweis.png` | `sync/desktop-only-hinweis.mobile.png` | v2.1.0 |
| Create-Lesson — Buchtext-Datei-Upload mit Kapitel-Picker (#1927) | `create-lesson/buch-upload-picker.png` | `create-lesson/buch-upload-picker.mobile.png` | v2.5.0+ |
| Viewport-Diagnose — Tap-Offset-Sonde, eingeklappt (#1569/#2779) | `viewport-diagnostic/eingeklappt.png` | `viewport-diagnostic/eingeklappt.mobile.png` | v2.13.0+ |
| Viewport-Diagnose — Details-Block geöffnet (#1569/#2779) | `viewport-diagnostic/details.png` | `viewport-diagnostic/details.mobile.png` | v2.13.0+ |
| Viewport-Diagnose — Settings-Sektion mit Schalter + Protokoll (#2782) | `viewport-diagnostic/settings-sektion.png` | `viewport-diagnostic/settings-sektion.mobile.png` | v2.13.0+ |
| Untere Tab-Leiste — opt-in Menüposition unten (#2786) | — (Leiste ist md:hidden) | `bottom-tab-bar/leiste.mobile.png` | v2.13.0+ |
| Lektions-Navigation — "Lektion N von M" mit Vor/Zurück (#2793) | `lesson-navigation/position-zeile.png` | `lesson-navigation/position-zeile.mobile.png` | v2.13.0+ |
| Erklärung nach der Antwort - Kasten „Erklärung" aufgeklappt nach falscher Antwort, gerendertes Markdown (#2991) | `exercise-explanation/falsche-antwort.png` | `exercise-explanation/falsche-antwort.mobile.png` | v2.15.0+ |
| Erklärungen generieren - Opt-in-Kontrollkästchen unter der Aufgabentyp-Auswahl im Buchtext-Schritt (#2992) | `create-lesson/erklaerungen-opt-in.png` | `create-lesson/erklaerungen-opt-in.mobile.png` | v2.15.0+ |
| Erklärung im Inline-Editor - Markdown-Feld mit Zähler und "Vorlage einfügen" (#2992) | `exercise-explanation/editor-feld.png` | `exercise-explanation/editor-feld.mobile.png` | v2.15.0+ |

> Die PNGs werden on-demand erzeugt (`make capture-screenshots`) und auf einer
> konsistenten Maschine geprueft — bis dahin tragen die Ordner eine `.gitkeep`.
> Beim Hinzufuegen eines Features hier eine Zeile ergaenzen.

## Screenshots aktualisieren

```bash
make capture-screenshots
```

Erzeugt/aktualisiert die PNGs (`--update-snapshots`). Danach **jedes** geaenderte
PNG pruefen, dann `git add e2e/visual/features/` und committen. Generierung +
Review laufen auf einer konsistenten Maschine — Font-Anti-Aliasing
unterscheidet sich pro Maschine, daher NICHT im fluechtigen CI/Web-Container.

## Screenshots pruefen (Visual Regression)

```bash
make verify-screenshots
```

**Niemals** `--update-snapshots` benutzen, um einen Diff zu uebertuenchen, der
einen echten Bug zeigt — den Bug fixen; nur nach einer beabsichtigten visuellen
Aenderung neu erzeugen.

## Manuell erfasste Features (nicht via Playwright erreichbar)

Manche Features sind fuer Playwright **nicht** erreichbar und werden von Hand in
den passenden Ordner aufgenommen:

- **`launcher/`** — der Desktop-Launcher ist eine native PyInstaller/Docker-GUI
  (`launcher/`), keine Web-Route. Seine Zustaende (Docker-nicht-aktiv-Dialog,
  Schritt-Checkliste, Port-Feld) mit dem OS-Screenshot-Tool aufnehmen und hier
  ablegen — kebab-case, gleiche Namenskonvention.
