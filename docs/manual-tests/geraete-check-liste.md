# Geräte-Check-Liste v2 (nach last-reports.md, alle PRs bis #1379 + content-test#13)

## GTS-0001 Einmalig: Cache-Bust (exakte Schritte aus dem CCW-Bericht)

- [x] GTC-0001 Test-PWA vom Home-Bildschirm löschen
- [x] GTC-0002 Safari: Einstellungen > Safari > Erweitert > Website-Daten > astrapi69.github.io löschen
- [x] GTC-0003 Safari komplett schliessen (App-Switcher), https://astrapi69.github.io/adaptive-learner-content-test/ neu laden, ggf. neu zum Home-Bildschirm
- [x] GTC-0004 Einstellungen > Über > Version: Build-Commit = aktueller develop-Stand (sonst läuft noch der alte Cache)
- [x] GTC-0005 Baselines: `make capture-screenshots` auf der Baseline-Maschine (Korrektur-Runden-Position, Settings, Tab-Leiste)

## GTS-0002 MC final (das Ende der Saga)

- [x] GTC-0006 Führerschein-Set laden: multiselect-Aufgabe (mehrere Kacheln tippen, erneuter Tap wählt ab, "Antworten prüfen", Pro-Option-Feedback)
- [x] GTC-0007 Single-MC: eine Antwort, direkt tappbare Buttons
- [ ] GTC-0008 ERLEDIGT laut deiner Meldung ("MC funktioniert jetzt"), nur abhaken falls multiselect noch ungetestet war

## GTS-0003 Lektions-Zusammenfassung (#1373 + #1377)

- [x] GTC-0009 Fehler machen, wiederholen, richtig beantworten: "X von Y korrigiert", kein erneuter Vorschlag, bei null offen "Alle Fehler korrigiert!"
- [ ] GTC-0010 Korrektur-Runde erscheint als LETZTES Element unter der Nächstes-Area; Toggle in Settings > Learning aus: Runde weg, Fehler via Replay-Karte erreichbar
- [x] GTC-0011 "Set ansehen" nach Set-Abschluss führt zur Detailansicht des richtigen Sets (#1371)

## GTS-0004 Update-Funktion (#1375)

- [x] GTC-0012 Über: EIN Klick ergibt Prüf-Zustand + eindeutige Meldung; wartendes Update erscheint ohne Klick; Anwenden räumt Banner UND Über-Anzeige

## GTS-0005 Einstellungen (#1379, #1331)

- [x] GTC-0013 Tab-Reihenfolge ändern (z. B. Meine Inhalte auf 1): Leiste umgeordnet, Position 1 initial aktiv, App-Neustart behält die Wahl
- [x] GTC-0014 Auto-Advance-Toggle (Default AUS): einschalten, richtige Antwort springt automatisch weiter

## GTS-0006 iOS-Fixes am Gerät (in v1.99.0 enthalten)

- [ ] GTC-0015 Tipp-Eingabe fokussieren: kein Zoom-Springen, Pinch-Zoom weiterhin möglich (#1354)
- [x] GTC-0016 Dashboard mit langen Titeln: Weitermachen-Karte ohne Overflow (#1329)
- [x] GTC-0017 Inline-Beispiele: Theorie + Aufgabe mit Text- und Code-Beispiel ansehen, sobald Content examples nutzt (#1327)

## GTS-0007 Navigation (#1391, Feature-Rueckbau DesktopSidebar)

- [x] GTC-0018 Desktop-Browser: KEIN Burger, Top-Nav vollständig (Dashboard bis Hilfe), Settings-Sektionsnav unverändert
- [x] GTC-0019 Fenster schmal ziehen (768px): Burger erscheint, Top-Nav-Links weg, Drawer bedienbar (Escape, Outside-Click)
- [x] GTC-0020 iPhone: Drawer + Bottom-Tab-Leiste wie bisher; aktive Lektion: Kompakt-Modus behält Burger auch bei Desktop-Breite
- [x] GTC-0021 ZEITKRITISCH: Visual-Baselines auf der Baseline-Maschine regenerieren (make capture-screenshots + Visual-Suite), sonst difft die nächste Nightly flaechig (alle Desktop-Surfaces zeigten die alte Sidebar)

## GTS-0008 Ältere, unbestaetigte Checks (#1318/#1320/#1322, falls noch nie geprüft)

- [x] GTC-0022 QR im Latest-Strang (Einstellungen > Über > Share): Button zeigt QR; Add-Repo per QR-BILD-Upload dekodiert am Gerät
- [x] GTC-0023 Kategorie-Badge je importiertem Repo (offiziell / validiert / privat / unverifiziert) korrekt
- [x] GTC-0024 "KI fragen" an Theorie-Block und Aufgabe mit echtem Schlüssel: Antwort kommt, ohne Schlüssel dezenter Hinweis

## GTS-0009 NOCH OFFEN (kein Fix existiert, nur testen wenn relevant)

- [x] GTC-0025 Landscape im Aufgaben-Modus: Button abgeschnitten/nicht tappbar. UNTRACKED laut Status-Bericht, Prompt liegt bereit (ccw-prompt-landscape-button-unerreichbar.md)

Funde bitte gebuendelt melden (Abschnitt + was du siehst).
