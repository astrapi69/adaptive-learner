# Manueller Testplan — Adaptive Learner v1.91.0+

Stand: 20.06.2026
Tester: Aster + Beta-Tester
Geraete: Desktop (Chrome/Brave), iPhone Safari, Android Chrome

Fuer jeden Testfall: OK / BUG (mit Screenshot + Browser + Beschreibung)

---

## 1. ERSTER EINDRUCK (Neue User Perspektive)

### 1.1 Landing Page
- [ ] App im Incognito-Fenster oeffnen (kein Cache, kein State)
- [ ] Landing Page laedt ohne Fehler
- [ ] "Lernreise beginnen" Button sichtbar und klickbar
- [ ] App-Icon korrekt im Browser-Tab (Favicon)
- [ ] Kein Konsolenfehler (DevTools → Console)

### 1.2 Onboarding
- [ ] Onboarding-Flow startet nach Klick
- [ ] Sprache waehlbar (Dropdown funktioniert, nicht transparent)
- [ ] "Aus bestehendem Backup wiederherstellen" → .alb UND .json waehlbar
- [ ] Onboarding abschliessbar ohne Fehler
- [ ] Nach Onboarding: Dashboard erscheint

### 1.3 PWA Install
- [ ] iPhone Safari: "Zum Home-Bildschirm" → App-Icon korrekt
- [ ] Android Chrome: "App installieren" → Maskable Icon korrekt (nicht abgeschnitten)
- [ ] Desktop Chrome: Install-Prompt funktioniert

---

## 2. NAVIGATION (EXP-037, #850)

### 2.1 Desktop (>= 1024px)
- [ ] Max 7 Nav-Eintraege sichtbar
- [ ] Gruppiert: Lernen / Inhalte / Fortschritt
- [ ] Settings + Hilfe als Icons unten
- [ ] Session, Curriculum, Statistik, Import, Anki NICHT in der Nav
- [ ] Alle Menuepunkte klickbar, korrekte Seite oeffnet sich

### 2.2 Mobile (< 640px)
- [ ] Bottom Tab Bar mit 5 Items
- [ ] "Mehr" oeffnet Drawer mit sekundaerer Navigation
- [ ] Alle Tabs haben 44px Touch-Target
- [ ] Kein horizontaler Overflow

### 2.3 Redirects
- [ ] /statistics → /progress?tab=stats
- [ ] /curriculum → /progress?tab=paths
- [ ] /import → /discover?tab=import
- [ ] Kein 404 bei alten URLs

---

## 3. LERNEN (Kernfunktion)

### 3.1 Lektion starten
- [ ] Set auswaehlen → Lektion oeffnen
- [ ] Theorie-Schritte lesbar, korrekt formatiert
- [ ] Fortschrittsbalken aktualisiert sich pro Schritt
- [ ] "Automatisch vorlesen" funktioniert (Web Speech API)

### 3.2 Uebungstypen
- [ ] Matching: Paare zuordnen, Pruefen zeigt Fehler
- [ ] Matching: "Aufloesen" Button erscheint nach Pruefen
- [ ] Matching: Animation funktioniert (Default: slide)
- [ ] Matching: Paare GLEICHE Hoehe (nicht mehr ungleich)
- [ ] Cloze: Lueckentext ausfuellbar, Pruefung korrekt
- [ ] Free Text: Eingabe + Pruefung
- [ ] Word Tiles: Woerter anordnen
- [ ] Picture Choice: Kacheln GLEICHE Hoehe

### 3.3 Review / SRS
- [ ] Review-Badge "X faellig" sichtbar in der Nav
- [ ] Review starten → Karten kommen
- [ ] Nach jeder Antwort: Badge-Zahl dekrementiert LIVE
- [ ] Nach Review-Ende: Badge aktualisiert

### 3.4 Fortschritt
- [ ] Fortschrittsseite zeigt Sets mit korrektem Prozent
- [ ] Fortschritt pro Sprachpaar: Labels nicht abgeschnitten,
  genug Abstand zu Progress-Bars
- [ ] Statistik-Tab: Heatmap, Charts korrekt
- [ ] Curriculum-Tab: persoenliche Pfade sichtbar

---

## 4. INHALTE

### 4.1 Meine Inhalte
- [ ] Heruntergeladene Sets sichtbar mit Fortschritt
- [ ] Set-Action Buttons (Fortsetzen/Starten) LESBAR
  (nicht unsichtbar, Button-Text kontrastiert)
- [ ] Kein Hash-ID als Titel (keine UUIDs sichtbar)

### 4.2 Entdecken (/discover)
- [ ] Search-Index laedt (Sets werden angezeigt)
- [ ] Suche funktioniert (Debounced)
- [ ] Filter: Sprache, Level, Domain, Trust, KI-geprueft
- [ ] Per-Set Download mit Fortschrittsbalken
- [ ] Nach Download: Set erscheint in "Meine Inhalte"

### 4.3 Content-Qualitaet (Stichprobe)
- [ ] Deutsch-Englisch A1: 3 Lektionen durchspielen, Inhalte korrekt?
- [ ] Deutsch-Spanisch A1: 2 Lektionen, Akzente korrekt?
- [ ] KI-Einsteiger: 2 Lektionen, Fachinhalte korrekt?
- [ ] Japanisch A1: Hiragana korrekt? Romaji dabei? (Stichprobe)
- [ ] Koreanisch A1: Hangul korrekt? Romanisierung dabei?
- [ ] IT-Grundlagen: Fachbegriffe korrekt?

---

## 5. AI FEATURES

### 5.1 API-Key Management
- [ ] Settings → KI: Provider-Tabelle sichtbar
- [ ] Anthropic Key eingeben → Format akzeptiert → Speichern
- [ ] OpenAI Key eingeben → Format akzeptiert → Speichern
- [ ] Gemini Key eingeben → Format akzeptiert → Speichern
- [ ] "Testen" Button pro Provider → "Verbindung ok"
- [ ] Key-Vorschau maskiert (erste 4 + letzte 4)
- [ ] Key entfernen → ConfirmDialog (KEIN Browser-Dialog)
- [ ] Kein Passwort-Manager Popup bei Key-Eingabe
- [ ] Token-Felder (GitHub, Repo): kein Passwort-Manager

### 5.2 AI Exercise Generation (EXP-036)
- [ ] Lektion mit nur Theorie oeffnen (z.B. importierter Chat)
- [ ] "Uebungen generieren" Button sichtbar
- [ ] Klick → Spinner → Exercises werden generiert
- [ ] Generierte Exercises in Vorschau angezeigt
- [ ] Verschiedene Typen (matching, cloze, free_text)
- [ ] "Als Offline-Lektion speichern" jetzt aktiv
- [ ] Ohne API-Key: "API-Key benoetigt" Hinweis

### 5.3 AI Session
- [ ] Session starten → AI antwortet
- [ ] AI antwortet in der richtigen Sprache (nicht Griechisch!)
- [ ] AI kennt den Lektionskontext (erwaehnt das Thema)
- [ ] AI kennt den Fortschritt (keine generischen Antworten)

### 5.4 AI Content Validation
- [ ] "Qualitaet pruefen" auf einem Set → AI prueft
- [ ] Ergebnis: Trust-Badge aktualisiert
- [ ] Ohne API-Key: Feature korrekt gegated

### 5.5 Anki-Extraktion
- [ ] Anki-Export Button in "Meine Inhalte"
- [ ] Export funktioniert (Datei wird heruntergeladen)
- [ ] Bei importiertem Chat: AI-Extraktion im Dexie-Modus
  (kein "nur im API-Modus" Fehler)

---

## 6. BACKUP / DATEN

### 6.1 Backup Export (.alb)
- [ ] Settings → Daten → Backup erstellen
- [ ] .alb Datei wird heruntergeladen
- [ ] Dateiname enthaelt Datum

### 6.2 Backup Import (.alb) — AKZEPTANZTEST
- [ ] Browser-Daten KOMPLETT loeschen (IndexedDB + localStorage)
- [ ] App oeffnen → Onboarding → "Backup wiederherstellen"
- [ ] .alb Datei auswaehlen (NICHT nur .json!)
- [ ] Import erfolgreich (kein 500er Fehler)
- [ ] Pruefen: alle Sets vorhanden
- [ ] Pruefen: Fortschritt korrekt
- [ ] Pruefen: Settings wiederhergestellt
- [ ] Pruefen: Theme korrekt
- [ ] Pruefen: Voice-Settings korrekt
- [ ] Pruefen: Curriculum Builder Pfade vorhanden

### 6.3 Legacy .json Import
- [ ] Altes .json Backup importieren → funktioniert
- [ ] Kein Crash, graceful degradation

---

## 7. THEMES + DARK MODE

### 7.1 Theme-Wechsel
- [ ] Light Mode: alles lesbar, kein unsichtbarer Text
- [ ] Dark Mode: alles lesbar, App-Icon wechselt zur hellen Variante
- [ ] Ocean: alles lesbar
- [ ] Forest: alles lesbar
- [ ] High-Contrast: alles lesbar, hoher Kontrast
- [ ] Sepia: alles lesbar
- [ ] Catppuccin Mocha: alles lesbar
- [ ] Soft Pop: alles lesbar
- [ ] Amethyst Haze: alles lesbar

### 7.2 Spezifische Theme-Checks
- [ ] Buttons: Text auf allen Themes kontrastreich
- [ ] Dropdowns: opaker Hintergrund auf allen Themes
- [ ] Modals: Hintergrund sichtbar auf allen Themes
- [ ] XP-Badge: zweizeilig, Icon korrekt auf Dark + Light

---

## 8. EINSTELLUNGEN

### 8.1 Allgemein
- [ ] Sprache waehlbar (Dropdown NICHT transparent)
- [ ] Alle 11 Sprachen waehlbar
- [ ] Theme waehlbar
- [ ] Entwicklermodus Toggle

### 8.2 KI
- [ ] Provider-Tabelle (Anthropic/OpenAI/Gemini)
- [ ] Modell-Ueberschreibung funktioniert
- [ ] Standard nutzen → Default-Modell

### 8.3 Daten
- [ ] Backup Export/Import (siehe Abschnitt 6)
- [ ] Speicher-Modus angezeigt (Lokal/Server)

### 8.4 Integrationen
- [ ] GitHub-Token Feld: kein Passwort-Manager
- [ ] Content-Repo Token: kein Passwort-Manager
- [ ] Repository hinzufuegen funktioniert

### 8.5 Ueber
- [ ] Version korrekt (v1.91.0+)
- [ ] Build-Hash vorhanden
- [ ] "Auf Updates pruefen" funktioniert
- [ ] QR-Code anzeigen → QR-Code Modal oeffnet sich

---

## 9. UPDATE-MECHANISMUS

### 9.1 PWA Update (Dexie-Modus)
- [ ] Update-Banner erscheint bei neuer Version
- [ ] "Aktualisieren" → Banner verschwindet SOFORT
- [ ] Banner kommt NICHT zurueck nach Aktualisieren
- [ ] "Spaeter" / X → Banner verschwindet
- [ ] Banner kommt bei naechstem Start wieder (Spaeter)
- [ ] Banner kommt NICHT wieder fuer dismissed Version

### 9.2 Desktop Update (API-Modus, #845 Checkliste)
- [ ] Siehe Issue #845 fuer vollstaendige Checkliste

---

## 10. MATCHING-ANIMATION (#824)

- [ ] Settings → Lernen: Dropdown "Aufloesungs-Effekt"
- [ ] 4 Optionen: Gleiten / Farbe / Verbinden / Stapeln
- [ ] Matching-Exercise → Pruefen → Aufloesen Button erscheint
- [ ] Gleiten: rechte Spalte sortiert sich animiert um
- [ ] Farbe: Paare bekommen gleiche Hintergrundfarbe
- [ ] Verbinden: SVG-Linien zwischen Paaren
- [ ] Stapeln: Paare stapeln sich als Zeilen

---

## 11. SOCIAL / SHARING

- [ ] QR-Code Modal: Code scannbar
- [ ] QR-Code Download als PNG
- [ ] Social Sharing (Web Share API, falls Browser unterstuetzt)

---

## 12. RESPONSIVE + GERAETE

### 12.1 Desktop (1920x1080)
- [ ] Keine horizontale Scrollbar
- [ ] Nav gruppiert, alle Bereiche erreichbar

### 12.2 Tablet (768px)
- [ ] Layout passt sich an
- [ ] Keine abgeschnittenen Elemente

### 12.3 Mobile (375px)
- [ ] Bottom Tab Bar sichtbar
- [ ] Kein horizontaler Overflow
- [ ] Touch-Targets >= 44px
- [ ] Modals nicht abgeschnitten

### 12.4 iPhone Safari
- [ ] PWA installierbar
- [ ] Apple Touch Icon korrekt
- [ ] Safe-Area Insets respektiert

### 12.5 Android Chrome
- [ ] PWA installierbar
- [ ] Maskable Icon nicht abgeschnitten

---

## 13. OFFLINE

- [ ] App laden → Flugmodus an → App neu laden → App funktioniert
- [ ] Lektion im Flugmodus durchspielbar
- [ ] Review im Flugmodus machbar
- [ ] Fortschritt wird nach Reconnect gespeichert
- [ ] "Du bist offline" Hinweis (falls implementiert)

---

## 14. ACCESSIBILITY (Stichprobe)

- [ ] Tab-Navigation durch die App (kein Fokus-Trap)
- [ ] Screen-Reader: Buttons haben Labels
- [ ] High-Contrast Theme: alles lesbar
- [ ] prefers-reduced-motion: Matching-Animation springt
  direkt zum Ergebnis

---

## ERGEBNIS-ZUSAMMENFASSUNG

```
Datum:
Tester:
Geraet + Browser:
Version:

Getestet: ___ von ___ Testfaellen
OK:       ___
BUG:      ___
SKIP:     ___ (nicht testbar in diesem Setup)

Kritische Bugs:
1. ...
2. ...

Mittlere Bugs:
1. ...
2. ...

Kosmetische Bugs:
1. ...
2. ...

Fazit: LAUNCH-READY / NICHT LAUNCH-READY
```
