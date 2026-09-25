# Manueller Testplan

Diese Checkliste wird vor jedem größeren Release manuell
durchgearbeitet. Sie ergänzt die automatisierten Tests
(`make test`, `make test-dexie-smoke`, Playwright) um die Dinge,
die nur ein Mensch im echten Browser zuverlässig beurteilt:
Layout, Lesbarkeit, Touch-Bedienung, Theme-Kontraste und das
Gesamtgefühl des Lernflusses.

> **Dexie-Smoke-Cadence (#552):** Der Dexie-Mode-E2E-Smoke
> (`make test-dexie-smoke`) läuft **täglich** (Scheduled Run, 04:00 UTC),
> **vor jedem Release** (Gate in `make release-test`) und auf
> `release/*`-Branches — **nicht auf jedem PR**. Er ist teuer (~6 Min) und im
> PR-Kontext selten relevant; der Regressions-Schutz bleibt über den täglichen
> Lauf + das Release-Gate erhalten (gleiche Logik wie die Mutationstests). Bei
> Bedarf jederzeit manuell via `workflow_dispatch` oder lokal mit
> `make test-dexie-smoke` auslösbar.

> **CI-Nachtschicht (#575):** PRs laufen **nur Korrektheits-Gates** (Backend-/
> Plugin-/Frontend-Tests, ruff + mypy, Pre-commit, Docs-Drift, der
> Complexity-Baseline-Gate). Alles Nicht-Merge-Kritische läuft auf der
> **Nachtschicht** (Schedule + `workflow_dispatch`): **Security-Scan**
> (pip-audit / npm audit / bandit — wöchentlich + `push: release/**`),
> **Coverage** (täglich), **Content-Stats** (täglich; prüft die README gegen
> ein frisches Content-Repo-Checkout) und der **Complexity-Report**
> (voller Warn-View, täglich). Faustregel: Schlägt ein Job nicht
> merge-kritisch fehl, gehört er in die Nachtschicht, nicht auf den
> `pull_request`-Trigger.

> **Automatisierung (#616):** Der Großteil dieses Plans ist als
> Playwright-Suite unter `e2e/manual-automation/` automatisiert (Page-Object-
> Pattern, gegen den GitHub-Pages-Shape-Dexie-Build, deterministisch über einen
> gemockten Content-Fixture). Sie deckt Session 1 (Onboarding), 2 (Lernflow),
> 3 (Content/Repos), 4 (Settings/Backup inkl. Backup-Round-Trip), 5 (Mobile),
> 7 (a11y/axe) und 8 (Tastenkürzel) ab. Lauf: `make test-manual-automation`
> (täglich + `workflow_dispatch` + `release/**`, aggregiert in
> `make release-test`). **Manuell bleibt** (nicht zuverlässig automatisierbar):
> iOS-Safari-Zoom, das „Gesamtgefühl" des Lernflusses, die visuelle
> Theme-Bewertung, die Farbenblind-Prüfung, der strikte Tab-Fokus-Trap im
> Dialog (Headless-Fokus-Timing) und exploratives Testen.

## So wird getestet

- Jeder Testfall hat eine Checkbox. Arbeite eine Session nach der
  anderen ab und hake erledigte Fälle ab.
- Notiere jeden Fehler nach dem Schema unter
  [Ergebnis-Format](#ergebnis-format) — am besten direkt während
  des Tests, nicht erst danach.
- **Vor dem Release müssen mindestens Session 1-4 vollständig
  grün sein.** Session 5 (Mobile) ist für jedes Release dringend
  empfohlen; Session 6-7 sind optional, aber regelmäßig
  einzuplanen.
- Teste die öffentliche GitHub-Pages-Version
  (`https://astrapi69.github.io/adaptive-learner/`) im
  Dexie-/Browser-Modus, sofern nicht anders angegeben.

> **Warum manuell, trotz CI?** Auf Pull Requests läuft die CI mit
> Test Impact Analysis — nur die von der Änderung betroffenen Tests
> (Frontend `vitest --changed`, Backend `pytest --testmon`, #615). Die
> **volle** automatisierte Suite läuft nachts (04:00 UTC) und vor jedem
> Release (`make release-test`, inkl. Dexie-Smoke). Dieser manuelle
> Testplan ist das menschliche Sicherheitsnetz für Dinge, die kein
> automatischer Lauf abdeckt (Layout, Haptik, echte Geräte). Vor dem
> Release gilt: volle Suite grün **und** Session 1-4 grün.

---

## Session 1: Onboarding (frischer User)

**Voraussetzung:** Inkognito-/Privat-Fenster ODER leere Datenbank.

- [ ] RTC-0001 App öffnen (GitHub-Pages-URL)
- [ ] RTC-0002 Onboarding-Screen wird angezeigt
- [ ] RTC-0003 "Aus Backup wiederherstellen"-Button sichtbar (leere DB)
- [ ] RTC-0004 Name + Thema eingeben (nur 2 Pflichtfelder)
- [ ] RTC-0005 "Projekt anlegen" funktioniert
- [ ] RTC-0006 Optional: "Profil einrichten"-Wizard öffnen
- [ ] RTC-0007 Wizard: jeder Schritt hat einen sinnvollen Default
- [ ] RTC-0008 Wizard: "Zurück"-Button funktioniert
- [ ] RTC-0009 Wizard: Fortschrittsanzeige korrekt (Schritt X von 5)
- [ ] RTC-0010 Wizard: Abbrechen möglich, Fortschritt gespeichert
- [ ] RTC-0011 Nach dem Onboarding: Dashboard wird angezeigt
- [ ] RTC-0012 "Aus Backup wiederherstellen"-Button NICHT mehr sichtbar
      (es liegen jetzt Daten vor)

---

## Session 2: Lernflow

**Voraussetzung:** Mindestens 1 Projekt angelegt.

- [ ] RTC-0013 Content Browser: Lektionen sichtbar
- [ ] RTC-0014 Lektion starten: Theorie-Schritt wird angezeigt
- [ ] RTC-0015 Theorie: Markdown korrekt gerendert (fett, Listen usw.)
- [ ] RTC-0016 Theorie: "Beispiel ansehen"-Link (falls vorhanden) öffnet
      einen neuen Tab
- [ ] RTC-0017 Theorie: "Vorlesen" ändert NICHT das Layout
- [ ] RTC-0018 Übung Matching: Paare farbig verbunden (gleiche Farbe pro
      Paar)
- [ ] RTC-0019 Übung Matching: Nummern-/Buchstaben-Badge für Farbenblinde
- [ ] RTC-0020 Übung Matching: bei Wissens-Lektionen "Begriff/Definition"
      statt Sprachnamen
- [ ] RTC-0021 Übung Matching: Paar lässt sich auch von der rechten (B-)
      Spalte aus starten, nicht nur A -> B (bidirektional)
- [ ] RTC-0022 Übung Matching: bei doppelten Paaren wird nach Wert gewertet,
      nicht nach Position (kein falsch-negatives Ergebnis)
- [ ] RTC-0023 Übung FreeText: Eingabe + Prüfen funktioniert
- [ ] RTC-0024 Übung Cloze: Lücke ausfüllen + Prüfen
- [ ] RTC-0025 Übung WordTiles: Kacheln ziehen/tippen + Prüfen
- [ ] RTC-0026 Übung PictureChoice: Option wählen + Prüfen
- [ ] RTC-0027 Kacheln: einheitliche Höhe (kein Springen bei 1-zeilig vs.
      2-zeilig)
- [ ] RTC-0028 Enter-Shortcut: Enter = Prüfen (nach Antwort)
- [ ] RTC-0029 Enter-Shortcut: Enter = Weiter (nach Ergebnis)
- [ ] RTC-0030 Enter-Shortcut: funktioniert auch in der Korrektur-Runde
- [ ] RTC-0031 "Theorie nochmal lesen"-Link in Übungs-Schritten
- [ ] RTC-0032 Zurück-Button sichtbar (nicht unsichtbar im Dark Mode)
- [ ] RTC-0033 Zurücknavigieren: vorherige Antworten bleiben (read-only)
- [ ] RTC-0034 Lektion abschließen: Ergebnis-Screen
- [ ] RTC-0035 Ergebnis: "Ergebnis kopieren"-Button (Markdown in der
      Zwischenablage)
- [ ] RTC-0036 Ergebnis: "Als Datei speichern"-Button (.md-Download)
- [ ] RTC-0037 Korrektur-Runde: Enter-Shortcut funktioniert
- [ ] RTC-0038 XP-Sichtbarkeit: persistentes XP-/Level-Badge im Header sichtbar
      (aktualisiert sich nach XP-relevanten Aktionen ohne Reload)
- [ ] RTC-0039 XP-Sichtbarkeit: Ergebnis-Screen zeigt eine "+N XP"-Belohnung

---

## Session 3: Content + Repositories

- [ ] RTC-0040 Content Browser: Suchfeld mit Lupe rechts
- [ ] RTC-0041 Content Browser: Quell-Badges (Offiziell, Eigenes Repo)
- [ ] RTC-0042 Content Browser: Buchempfehlungen pro Domäne sichtbar
- [ ] RTC-0043 Content Browser: "Auf Amazon ansehen"-Link funktioniert
- [ ] RTC-0044 Subject-Filter: zeigt nur eigene Subjects
- [ ] RTC-0045 Subject-Filter: sortiert nach Nutzung (meistgenutzt oben)
- [ ] RTC-0046 Subject-Filter: ausgeblendet bei <= 1 Subject
- [ ] RTC-0047 Eigenes Repo verbinden (Einstellungen > Daten)
- [ ] RTC-0048 Repo validieren: Schema-Check + Ergebnis angezeigt
- [ ] RTC-0049 Repo synchronisieren: Lektionen erscheinen
- [ ] RTC-0050 Repo entfernen: Lektionen verschwinden
- [ ] RTC-0051 Mehrere Repos: Reihenfolge ändern
- [ ] RTC-0052 Empfohlene Repos: sichtbar + hinzufügbar
- [ ] RTC-0053 Buch-Begleiter: bei einem Repo mit `book`-Block erscheint oben
      eine dezente Karte (Cover / Autor / Edition) mit "Zum Buch"-Link
      (neuer Tab, kein In-App-Kauf)
- [ ] RTC-0054 User-Lektionen: eigene Lektionen werden in den passenden
      Baum-Knoten eingefaltet, mit Badge ("Eigene Lektion" /
      "Eigene Bearbeitung")
- [ ] RTC-0055 User-Lektionen: Zähler zeigt "(+N eigene)" am Level-/Domänen-Knoten;
      eingefaltete Lektionen sind auch über die Suche auffindbar

---

## Session 4: Einstellungen + Backup

- [ ] RTC-0056 Einstellungen > Lernen: Sprache-Panel ist ganz oben
- [ ] RTC-0057 Einstellungen > Lernen: Assessment fortsetzen/erneut machen
- [ ] RTC-0058 Einstellungen > Daten: Backup erstellen
- [ ] RTC-0059 Einstellungen > Daten: Backup importieren (sofort, selbe DB)
- [ ] RTC-0060 Einstellungen > Daten: Backup importieren (frische DB,
      andere User-ID)
- [ ] RTC-0061 Einstellungen > Daten: Import-Zusammenfassung pro Tabelle
      (scrollbar)
- [ ] RTC-0062 Einstellungen > Daten: Fehler-Toasts bleiben stehen (nicht
      automatisch weg)
- [ ] RTC-0063 Einstellungen > Daten: Lektionstitel korrekt nach Import
      (kein "analysis-UUID")
- [ ] RTC-0064 Einstellungen > Daten: Fortschritt korrekt nach Import
- [ ] RTC-0065 Einstellungen > Daten: Content-Sets restauriert (Lektionen
      öffenbar)
- [ ] RTC-0066 Einstellungen > Daten: Backup-Buttons sind shadcn
      (Wiederherstellen, Löschen usw.)
- [ ] RTC-0067 Einstellungen > Daten: Lern-Repository "Einstellungen
      speichern"-Button korrekt
- [ ] RTC-0068 Einstellungen > Daten: Sync-Sektion NICHT sichtbar
      (Dexie-Modus / GitHub Pages)
- [ ] RTC-0069 Einstellungen > Integrationen: API-Key-Inputs in einem
      Form-Element (keine Chrome-Warnung)
- [ ] RTC-0070 Einstellungen > Über: Version + Build + Build-Datum
      angezeigt (nicht "unknown")
- [ ] RTC-0071 Einstellungen > Über: "KI-Assistenz: Claude (Anthropic)"
      Credit
- [ ] RTC-0072 Einstellungen > Über: Link zur Dokumentation funktioniert
- [ ] RTC-0073 Themes: alle 6 empfohlenen Themes durchschalten
- [ ] RTC-0074 Themes: alle 6 klassischen Themes durchschalten
- [ ] RTC-0075 Themes: kein unlesbarer Text in irgendeinem Theme
- [ ] RTC-0076 Themes: Buttons sichtbar in allen Themes (Dark + Light)

---

## Session 5: Mobile (iPhone Safari)

Alle Tests aus Session 1-4 noch einmal, plus:

- [ ] RTC-0077 44px-Touch-Targets auf allen Buttons
- [ ] RTC-0078 Kein iOS-Zoom beim Input-Fokus (Schriftgröße >= 16px)
- [ ] RTC-0079 Layout: kein horizontaler Overflow / Scroll
- [ ] RTC-0080 Navigation: Hamburger-Menü funktioniert
- [ ] RTC-0081 Lektion: Kacheln tippbar (nicht nur klickbar)
- [ ] RTC-0082 Onboarding: Wizard auf Mobile nutzbar
- [ ] RTC-0083 Content Browser: scrollbar, keine abgeschnittenen Inhalte
- [ ] RTC-0084 Backup: Import funktioniert auf Mobile

---

## Session 6: Cross-Browser (optional)

- [ ] RTC-0085 Firefox Desktop: Basistests aller Sessions 1-4
- [ ] RTC-0086 Chrome Android: Basis-Lernflow
- [ ] RTC-0087 Edge: Basis-Lernflow

---

## Session 7: Barrierefreiheit (optional)

- [ ] RTC-0088 Keyboard-Navigation: Tab durch alle Buttons
- [ ] RTC-0089 Screenreader: Aria-Labels auf Buttons vorhanden
- [ ] RTC-0090 Kontrast: WCAG AA in allen Themes (Text lesbar)
- [ ] RTC-0091 Farbenblind: Matching-Paare durch Nummern/Buchstaben
      erkennbar

---

## Session 8: Tastenkürzel (optional)

Das globale Tastenkürzel-System (#585). Alle Kürzel sind in der
Hilfe-Übersicht dokumentiert (Taste `?`).

**Global**

- [ ] RTC-0092 `?` öffnet die Tastenkürzel-Übersicht; erneut `?` oder `Esc`
      schließt sie wieder.
- [ ] RTC-0093 `Ctrl`/`⌘` + `,` öffnet die Einstellungen.
- [ ] RTC-0094 `Ctrl`/`⌘` + `K` fokussiert die Inhaltssuche (im Content-Browser).
- [ ] RTC-0095 In einem Textfeld feuern die Kürzel NICHT (Tippen von `?`
      oder `d` schreibt das Zeichen, statt zu navigieren).

**Navigation**

- [ ] RTC-0096 `Alt` + `D` → Dashboard, `Alt` + `S` → Einstellungen,
      `Alt` + `C` → Inhalte, `Alt` + `P` → Statistik.

**In einer Lektion**

- [ ] RTC-0097 `Enter` prüft die Antwort und springt dann weiter.
- [ ] RTC-0098 Bei einer Bild-/Auswahlübung wählen die Tasten `1`–`4` (bis
      `9`) die jeweilige Option; nach dem Prüfen reagieren sie nicht
      mehr.
- [ ] RTC-0099 In einer Zuordnungsübung macht `Ctrl`/`⌘` + `Z` die zuletzt
      gebildete Zuordnung rückgängig.

---

## Ergebnis-Format

Sammle pro Session die gefundenen Fehler als Liste. Pro Fehler:

- **Was:** kurze Beschreibung
- **Wo:** Route / Seite / View
- **Erwartet vs. Tatsächlich:** was sollte passieren, was passiert
- **Screenshot:** wenn möglich
- **Umgebung:** Browser / Gerät / OS

Vorlage zum Kopieren:

```markdown
### Bug: <kurzer Titel>

- Was: <Beschreibung>
- Wo: <Route / View>
- Erwartet: <Soll>
- Tatsächlich: <Ist>
- Umgebung: <Browser / Gerät / OS>
- Screenshot: <Link oder Dateiname>
```

---

## Visual-Regression Baseline aktualisieren (#244 / #705)

Die Visual-Regression-Suite (`e2e/visual/`) vergleicht Screenshots
kritischer Oberflächen gegen committete Baseline-PNGs. Wenn ein UI-PR
das Layout **absichtlich** ändert, müssen die Baselines neu erzeugt und
**geprüft** werden. Sie werden **in CI** gerendert, nicht auf einer
Entwicklermaschine — Font-Antialiasing unterscheidet sich pro Maschine
(#1532).

**Empfohlen — Auto-Sync (#1662):** das Label `refresh-visual-baselines`
an den PR hängen (oder `gh workflow run visual-baseline-sync.yml -f
pr_number=<N>`). Der Workflow `visual-baseline-sync` rendert die
Baselines in CI und pusht sie als Commit
`chore(visual): refresh baselines` auf den PR-Branch — ohne
Artifact-Download.

1. Label `refresh-visual-baselines` setzen (bzw. den Workflow
   dispatchen).
2. Jedes geänderte PNG im PR prüfen — bestätigen, dass der Diff die
   beabsichtigte Änderung ist, **kein** Regressionsfehler (Auto-Sync ist
   nie ein blindes Akzeptieren).
3. Erst nach der Bildprüfung mergen.

**Niemals** `--update-snapshots` benutzen, um einen Diff zu
übertünchen, der einen echten Bug zeigt — den Bug fixen, dann neu
baselinen. Einmalige Einrichtung (Label, optionaler
`VISUAL_BASELINE_TOKEN`-PAT) und der manuelle Fallback:
`docs/developer/testing.md` und `e2e/visual/README.md`.

---

## Verwandte Dokumente

- [Testen (Entwickler-Dokumentation)](../help/de/developer/testing.md)
  — automatisierte Teststrategie
- [Erste Schritte](../help/de/user-guide/getting-started.md)
- [Was ist neu (Changelog)](../help/de/changelog.md)
