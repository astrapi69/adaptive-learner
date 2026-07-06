# Geraete-Check-Liste v2 (nach last-reports.md, alle PRs bis #1379 + content-test#13)

## Einmalig: Cache-Bust (exakte Schritte aus dem CCW-Bericht)
- [ ] Test-PWA vom Home-Bildschirm loeschen
- [ ] Safari: Einstellungen > Safari > Erweitert > Website-Daten > astrapi69.github.io loeschen
- [ ] Safari komplett schliessen (App-Switcher), https://astrapi69.github.io/adaptive-learner-content-test/ neu laden, ggf. neu zum Home-Bildschirm
- [ ] Einstellungen > Ueber > Version: Build-Commit = aktueller develop-Stand (sonst laeuft noch der alte Cache)
- [ ] Baselines: `make capture-screenshots` auf der Baseline-Maschine (Korrektur-Runden-Position, Settings, Tab-Leiste)

## MC final (das Ende der Saga)
- [ ] Fuehrerschein-Set laden: multiselect-Aufgabe (mehrere Kacheln tippen, erneuter Tap waehlt ab, "Antworten pruefen", Pro-Option-Feedback)
- [ ] Single-MC: eine Antwort, direkt tappbare Buttons
- [ ] ERLEDIGT laut deiner Meldung ("MC funktioniert jetzt"), nur abhaken falls multiselect noch ungetestet war

## Lektions-Zusammenfassung (#1373 + #1377)
- [ ] Fehler machen, wiederholen, richtig beantworten: "X von Y korrigiert", kein erneuter Vorschlag, bei null offen "Alle Fehler korrigiert!"
- [ ] Korrektur-Runde erscheint als LETZTES Element unter der Naechstes-Area; Toggle in Settings > Learning aus: Runde weg, Fehler via Replay-Karte erreichbar
- [ ] "Set ansehen" nach Set-Abschluss fuehrt zur Detailansicht des richtigen Sets (#1371)

## Update-Funktion (#1375)
- [ ] Ueber: EIN Klick ergibt Pruef-Zustand + eindeutige Meldung; wartendes Update erscheint ohne Klick; Anwenden raeumt Banner UND Ueber-Anzeige

## Einstellungen (#1379, #1331)
- [ ] Tab-Reihenfolge aendern (z. B. Meine Inhalte auf 1): Leiste umgeordnet, Position 1 initial aktiv, App-Neustart behaelt die Wahl
- [ ] Auto-Advance-Toggle (Default AUS): einschalten, richtige Antwort springt automatisch weiter

## iOS-Fixes am Geraet (in v1.99.0 enthalten)
- [ ] Tipp-Eingabe fokussieren: kein Zoom-Springen, Pinch-Zoom weiterhin moeglich (#1354)
- [ ] Dashboard mit langen Titeln: Weitermachen-Karte ohne Overflow (#1329)
- [ ] Inline-Beispiele: Theorie + Aufgabe mit Text- und Code-Beispiel ansehen, sobald Content examples nutzt (#1327)

## Navigation (#1391, Feature-Rueckbau DesktopSidebar)
- [ ] Desktop-Browser: KEIN Burger, Top-Nav vollstaendig (Dashboard bis Hilfe), Settings-Sektionsnav unveraendert
- [ ] Fenster schmal ziehen (768px): Burger erscheint, Top-Nav-Links weg, Drawer bedienbar (Escape, Outside-Click)
- [ ] iPhone: Drawer + Bottom-Tab-Leiste wie bisher; aktive Lektion: Kompakt-Modus behaelt Burger auch bei Desktop-Breite
- [ ] ZEITKRITISCH: Visual-Baselines auf der Baseline-Maschine regenerieren (make capture-screenshots + Visual-Suite), sonst difft die naechste Nightly flaechig (alle Desktop-Surfaces zeigten die alte Sidebar)

## Aeltere, unbestaetigte Checks (#1318/#1320/#1322, falls noch nie geprueft)
- [ ] QR im Latest-Strang (Einstellungen > Ueber > Share): Button zeigt QR; Add-Repo per QR-BILD-Upload dekodiert am Geraet
- [ ] Kategorie-Badge je importiertem Repo (offiziell / validiert / privat / unverifiziert) korrekt
- [ ] "KI fragen" an Theorie-Block und Aufgabe mit echtem Schluessel: Antwort kommt, ohne Schluessel dezenter Hinweis

## NOCH OFFEN (kein Fix existiert, nur testen wenn relevant)
- [ ] Landscape im Aufgaben-Modus: Button abgeschnitten/nicht tappbar. UNTRACKED laut Status-Bericht, Prompt liegt bereit (ccw-prompt-landscape-button-unerreichbar.md)

Funde bitte gebuendelt melden (Abschnitt + was du siehst).
