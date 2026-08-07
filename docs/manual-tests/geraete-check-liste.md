# Geräte-Check-Liste v2 (nach last-reports.md, alle PRs bis #1379 + content-test#13)

## Einmalig: Cache-Bust (exakte Schritte aus dem CCW-Bericht)

- [x] Test-PWA vom Home-Bildschirm löschen
- [x] Safari: Einstellungen > Safari > Erweitert > Website-Daten > astrapi69.github.io löschen
- [x] Safari komplett schliessen (App-Switcher), https://astrapi69.github.io/adaptive-learner-content-test/ neu laden, ggf. neu zum Home-Bildschirm
- [x] Einstellungen > Über > Version: Build-Commit = aktueller develop-Stand (sonst läuft noch der alte Cache)
- [x] Baselines: `make capture-screenshots` auf der Baseline-Maschine (Korrektur-Runden-Position, Settings, Tab-Leiste)

## MC final (das Ende der Saga)

- [x] Führerschein-Set laden: multiselect-Aufgabe (mehrere Kacheln tippen, erneuter Tap wählt ab, "Antworten prüfen", Pro-Option-Feedback)
- [x] Single-MC: eine Antwort, direkt tappbare Buttons
- [ ] ERLEDIGT laut deiner Meldung ("MC funktioniert jetzt"), nur abhaken falls multiselect noch ungetestet war

## Lektions-Zusammenfassung (#1373 + #1377)

- [x] Fehler machen, wiederholen, richtig beantworten: "X von Y korrigiert", kein erneuter Vorschlag, bei null offen "Alle Fehler korrigiert!"
- [ ] Korrektur-Runde erscheint als LETZTES Element unter der Nächstes-Area; Toggle in Settings > Learning aus: Runde weg, Fehler via Replay-Karte erreichbar
- [x] "Set ansehen" nach Set-Abschluss führt zur Detailansicht des richtigen Sets (#1371)

## Update-Funktion (#1375)

- [x] Über: EIN Klick ergibt Prüf-Zustand + eindeutige Meldung; wartendes Update erscheint ohne Klick; Anwenden räumt Banner UND Über-Anzeige

## Einstellungen (#1379, #1331)

- [x] Tab-Reihenfolge ändern (z. B. Meine Inhalte auf 1): Leiste umgeordnet, Position 1 initial aktiv, App-Neustart behält die Wahl
- [x] Auto-Advance-Toggle (Default AUS): einschalten, richtige Antwort springt automatisch weiter

## iOS-Fixes am Gerät (in v1.99.0 enthalten)

- [ ] Tipp-Eingabe fokussieren: kein Zoom-Springen, Pinch-Zoom weiterhin möglich (#1354)
- [x] Dashboard mit langen Titeln: Weitermachen-Karte ohne Overflow (#1329)
- [x] Inline-Beispiele: Theorie + Aufgabe mit Text- und Code-Beispiel ansehen, sobald Content examples nutzt (#1327)

## Navigation (#1391, Feature-Rueckbau DesktopSidebar)

- [x] Desktop-Browser: KEIN Burger, Top-Nav vollständig (Dashboard bis Hilfe), Settings-Sektionsnav unverändert
- [x] Fenster schmal ziehen (768px): Burger erscheint, Top-Nav-Links weg, Drawer bedienbar (Escape, Outside-Click)
- [x] iPhone: Drawer + Bottom-Tab-Leiste wie bisher; aktive Lektion: Kompakt-Modus behält Burger auch bei Desktop-Breite
- [x] ZEITKRITISCH: Visual-Baselines auf der Baseline-Maschine regenerieren (make capture-screenshots + Visual-Suite), sonst difft die nächste Nightly flaechig (alle Desktop-Surfaces zeigten die alte Sidebar)

## Ältere, unbestaetigte Checks (#1318/#1320/#1322, falls noch nie geprüft)

- [x] QR im Latest-Strang (Einstellungen > Über > Share): Button zeigt QR; Add-Repo per QR-BILD-Upload dekodiert am Gerät
- [x] Kategorie-Badge je importiertem Repo (offiziell / validiert / privat / unverifiziert) korrekt
- [x] "KI fragen" an Theorie-Block und Aufgabe mit echtem Schlüssel: Antwort kommt, ohne Schlüssel dezenter Hinweis

## NOCH OFFEN (kein Fix existiert, nur testen wenn relevant)

- [x] Landscape im Aufgaben-Modus: Button abgeschnitten/nicht tappbar. UNTRACKED laut Status-Bericht, Prompt liegt bereit (ccw-prompt-landscape-button-unerreichbar.md)

Funde bitte gebuendelt melden (Abschnitt + was du siehst).
