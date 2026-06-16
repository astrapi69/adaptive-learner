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

---

## Session 1: Onboarding (frischer User)

**Voraussetzung:** Inkognito-/Privat-Fenster ODER leere Datenbank.

- [ ] App öffnen (GitHub-Pages-URL)
- [ ] Onboarding-Screen wird angezeigt
- [ ] "Aus Backup wiederherstellen"-Button sichtbar (leere DB)
- [ ] Name + Thema eingeben (nur 2 Pflichtfelder)
- [ ] "Projekt anlegen" funktioniert
- [ ] Optional: "Profil einrichten"-Wizard öffnen
- [ ] Wizard: jeder Schritt hat einen sinnvollen Default
- [ ] Wizard: "Zurück"-Button funktioniert
- [ ] Wizard: Fortschrittsanzeige korrekt (Schritt X von 5)
- [ ] Wizard: Abbrechen möglich, Fortschritt gespeichert
- [ ] Nach dem Onboarding: Dashboard wird angezeigt
- [ ] "Aus Backup wiederherstellen"-Button NICHT mehr sichtbar
      (es liegen jetzt Daten vor)

---

## Session 2: Lernflow

**Voraussetzung:** Mindestens 1 Projekt angelegt.

- [ ] Content Browser: Lektionen sichtbar
- [ ] Lektion starten: Theorie-Schritt wird angezeigt
- [ ] Theorie: Markdown korrekt gerendert (fett, Listen usw.)
- [ ] Theorie: "Beispiel ansehen"-Link (falls vorhanden) öffnet
      einen neuen Tab
- [ ] Theorie: "Vorlesen" ändert NICHT das Layout
- [ ] Übung Matching: Paare farbig verbunden (gleiche Farbe pro
      Paar)
- [ ] Übung Matching: Nummern-/Buchstaben-Badge für Farbenblinde
- [ ] Übung Matching: bei Wissens-Lektionen "Begriff/Definition"
      statt Sprachnamen
- [ ] Übung Matching: Paar lässt sich auch von der rechten (B-)
      Spalte aus starten, nicht nur A -> B (bidirektional)
- [ ] Übung Matching: bei doppelten Paaren wird nach Wert gewertet,
      nicht nach Position (kein falsch-negatives Ergebnis)
- [ ] Übung FreeText: Eingabe + Prüfen funktioniert
- [ ] Übung Cloze: Lücke ausfüllen + Prüfen
- [ ] Übung WordTiles: Kacheln ziehen/tippen + Prüfen
- [ ] Übung PictureChoice: Option wählen + Prüfen
- [ ] Kacheln: einheitliche Höhe (kein Springen bei 1-zeilig vs.
      2-zeilig)
- [ ] Enter-Shortcut: Enter = Prüfen (nach Antwort)
- [ ] Enter-Shortcut: Enter = Weiter (nach Ergebnis)
- [ ] Enter-Shortcut: funktioniert auch in der Korrektur-Runde
- [ ] "Theorie nochmal lesen"-Link in Übungs-Schritten
- [ ] Zurück-Button sichtbar (nicht unsichtbar im Dark Mode)
- [ ] Zurücknavigieren: vorherige Antworten bleiben (read-only)
- [ ] Lektion abschließen: Ergebnis-Screen
- [ ] Ergebnis: "Ergebnis kopieren"-Button (Markdown in der
      Zwischenablage)
- [ ] Ergebnis: "Als Datei speichern"-Button (.md-Download)
- [ ] Korrektur-Runde: Enter-Shortcut funktioniert
- [ ] XP-Sichtbarkeit: persistentes XP-/Level-Badge im Header sichtbar
      (aktualisiert sich nach XP-relevanten Aktionen ohne Reload)
- [ ] XP-Sichtbarkeit: Ergebnis-Screen zeigt eine "+N XP"-Belohnung

---

## Session 3: Content + Repositories

- [ ] Content Browser: Suchfeld mit Lupe rechts
- [ ] Content Browser: Quell-Badges (Offiziell, Eigenes Repo)
- [ ] Content Browser: Buchempfehlungen pro Domäne sichtbar
- [ ] Content Browser: "Auf Amazon ansehen"-Link funktioniert
- [ ] Subject-Filter: zeigt nur eigene Subjects
- [ ] Subject-Filter: sortiert nach Nutzung (meistgenutzt oben)
- [ ] Subject-Filter: ausgeblendet bei <= 1 Subject
- [ ] Eigenes Repo verbinden (Einstellungen > Daten)
- [ ] Repo validieren: Schema-Check + Ergebnis angezeigt
- [ ] Repo synchronisieren: Lektionen erscheinen
- [ ] Repo entfernen: Lektionen verschwinden
- [ ] Mehrere Repos: Reihenfolge ändern
- [ ] Empfohlene Repos: sichtbar + hinzufügbar
- [ ] Buch-Begleiter: bei einem Repo mit `book`-Block erscheint oben
      eine dezente Karte (Cover / Autor / Edition) mit "Zum Buch"-Link
      (neuer Tab, kein In-App-Kauf)
- [ ] User-Lektionen: eigene Lektionen werden in den passenden
      Baum-Knoten eingefaltet, mit Badge ("Eigene Lektion" /
      "Eigene Bearbeitung")
- [ ] User-Lektionen: Zähler zeigt "(+N eigene)" am Level-/Domänen-Knoten;
      eingefaltete Lektionen sind auch über die Suche auffindbar

---

## Session 4: Einstellungen + Backup

- [ ] Einstellungen > Lernen: Sprache-Panel ist ganz oben
- [ ] Einstellungen > Lernen: Assessment fortsetzen/erneut machen
- [ ] Einstellungen > Daten: Backup erstellen
- [ ] Einstellungen > Daten: Backup importieren (sofort, selbe DB)
- [ ] Einstellungen > Daten: Backup importieren (frische DB,
      andere User-ID)
- [ ] Einstellungen > Daten: Import-Zusammenfassung pro Tabelle
      (scrollbar)
- [ ] Einstellungen > Daten: Fehler-Toasts bleiben stehen (nicht
      automatisch weg)
- [ ] Einstellungen > Daten: Lektionstitel korrekt nach Import
      (kein "analysis-UUID")
- [ ] Einstellungen > Daten: Fortschritt korrekt nach Import
- [ ] Einstellungen > Daten: Content-Sets restauriert (Lektionen
      öffenbar)
- [ ] Einstellungen > Daten: Backup-Buttons sind shadcn
      (Wiederherstellen, Löschen usw.)
- [ ] Einstellungen > Daten: Lern-Repository "Einstellungen
      speichern"-Button korrekt
- [ ] Einstellungen > Daten: Sync-Sektion NICHT sichtbar
      (Dexie-Modus / GitHub Pages)
- [ ] Einstellungen > Integrationen: API-Key-Inputs in einem
      Form-Element (keine Chrome-Warnung)
- [ ] Einstellungen > Über: Version + Build + Build-Datum
      angezeigt (nicht "unknown")
- [ ] Einstellungen > Über: "KI-Assistenz: Claude (Anthropic)"
      Credit
- [ ] Einstellungen > Über: Link zur Dokumentation funktioniert
- [ ] Themes: alle 6 empfohlenen Themes durchschalten
- [ ] Themes: alle 6 klassischen Themes durchschalten
- [ ] Themes: kein unlesbarer Text in irgendeinem Theme
- [ ] Themes: Buttons sichtbar in allen Themes (Dark + Light)

---

## Session 5: Mobile (iPhone Safari)

Alle Tests aus Session 1-4 noch einmal, plus:

- [ ] 44px-Touch-Targets auf allen Buttons
- [ ] Kein iOS-Zoom beim Input-Fokus (Schriftgröße >= 16px)
- [ ] Layout: kein horizontaler Overflow / Scroll
- [ ] Navigation: Hamburger-Menü funktioniert
- [ ] Lektion: Kacheln tippbar (nicht nur klickbar)
- [ ] Onboarding: Wizard auf Mobile nutzbar
- [ ] Content Browser: scrollbar, keine abgeschnittenen Inhalte
- [ ] Backup: Import funktioniert auf Mobile

---

## Session 6: Cross-Browser (optional)

- [ ] Firefox Desktop: Basistests aller Sessions 1-4
- [ ] Chrome Android: Basis-Lernflow
- [ ] Edge: Basis-Lernflow

---

## Session 7: Barrierefreiheit (optional)

- [ ] Keyboard-Navigation: Tab durch alle Buttons
- [ ] Screenreader: Aria-Labels auf Buttons vorhanden
- [ ] Kontrast: WCAG AA in allen Themes (Text lesbar)
- [ ] Farbenblind: Matching-Paare durch Nummern/Buchstaben
      erkennbar

---

## Session 8: Tastenkürzel (optional)

Das globale Tastenkürzel-System (#585). Alle Kürzel sind in der
Hilfe-Übersicht dokumentiert (Taste `?`).

**Global**

- [ ] `?` öffnet die Tastenkürzel-Übersicht; erneut `?` oder `Esc`
      schließt sie wieder.
- [ ] `Ctrl`/`⌘` + `,` öffnet die Einstellungen.
- [ ] `Ctrl`/`⌘` + `K` fokussiert die Inhaltssuche (im Content-Browser).
- [ ] In einem Textfeld feuern die Kürzel NICHT (Tippen von `?`
      oder `d` schreibt das Zeichen, statt zu navigieren).

**Navigation**

- [ ] `Alt` + `D` → Dashboard, `Alt` + `S` → Einstellungen,
      `Alt` + `C` → Inhalte, `Alt` + `P` → Statistik.

**In einer Lektion**

- [ ] `Enter` prüft die Antwort und springt dann weiter.
- [ ] Bei einer Bild-/Auswahlübung wählen die Tasten `1`–`4` (bis
      `9`) die jeweilige Option; nach dem Prüfen reagieren sie nicht
      mehr.
- [ ] In einer Zuordnungsübung macht `Ctrl`/`⌘` + `Z` die zuletzt
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

## Verwandte Dokumente

- [Testen (Entwickler-Dokumentation)](help/de/developer/testing.md)
  — automatisierte Teststrategie
- [Erste Schritte](help/de/user-guide/getting-started.md)
- [Was ist neu (Changelog)](help/de/changelog.md)
