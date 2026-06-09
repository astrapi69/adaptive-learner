# Manueller Testplan

Diese Checkliste wird vor jedem größeren Release manuell
durchgearbeitet. Sie ergänzt die automatisierten Tests
(`make test`, `make test-dexie-smoke`, Playwright) um die Dinge,
die nur ein Mensch im echten Browser zuverlässig beurteilt:
Layout, Lesbarkeit, Touch-Bedienung, Theme-Kontraste und das
Gesamtgefühl des Lernflusses.

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
