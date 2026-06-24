# Manueller Testplan — Adaptive Learner v1.95.0+

Stand: 22.06.2026 (Session 4)
Tester: Aster + Beta-Tester

Struktur:
- TEIL A: Was DU manuell testen musst (nach Prioritaet)
- TEIL B: Was automatisiert ist (Referenz, nachtraeglich pruefbar)

Fuer jeden manuellen Testfall: OK / BUG (Screenshot + Browser + Beschreibung)

---

# TEIL A: MANUELLE TESTS (Aster)

Sortiert nach Prioritaet. Launch-Blocker zuerst.

---

## PRIO 1: BACKUP-AKZEPTANZTEST (Launch-Gate!)

**Neuer Testfall unter PRIO 1 Backup-Akzeptanztest:**
- [ ] GitHub Pages: Backup erstellen
- [ ] Lokal installieren (Launcher)
- [ ] .alb von GH Pages importieren → alles uebernommen

Dieser Test ist seit Session 2 als Launch-Gate definiert.
Noch nie durchgefuehrt. JETZT machen.

- [ ] Daten erzeugen: mindestens 2 Sets herunterladen, 3 Lektionen starten, Theme wechseln
- [ ] Export: Settings → Daten → Backup erstellen → .alb Datei herunterladen
- [ ] Dateigrösse pruefen (sollte >1MB sein wenn Sets geladen)
- [ ] Browser-Daten KOMPLETT loeschen:
      DevTools → Application → Storage → "Clear site data"
      UND: IndexedDB "adaptive-learner" loeschen
      UND: localStorage.clear()
- [ ] App oeffnen → Onboarding → "Backup wiederherstellen"
- [ ] .alb Datei auswaehlen → Import startet
- [ ] KEIN HTTP 413 Fehler (nginx 50MB Limit gefixt)
- [ ] Sets vorhanden (Meine Inhalte → alle zuvor geladenen Sets)
- [ ] Fortschritt erhalten (gestartete Lektionen, Scores)
- [ ] Settings korrekt (Theme, Sprache, Voice-Einstellungen)
- [ ] Lern-Modi Einstellungen erhalten
- [ ] XP + Level korrekt
- [ ] Legacy .json Import: altes Backup-Format → funktioniert
- [ ] API-Keys NICHT im Backup (Sicherheits-Check)

---

## PRIO 2: LAUNCHER (Desktop)

### Grundfunktion (Ubuntu)
- [ ] `python3 -m adaptive_learner_launcher --debug` → EIN Fenster oeffnet
- [ ] Fenster verschwindet NIE von selbst
- [ ] Docker-Check als erster Schritt (Hinweis wenn Docker nicht laeuft)
- [ ] Live-Fortschritt bei Install im Log-Bereich (Zeile fuer Zeile)
- [ ] "Image bauen..." sichtbar (nicht stiller Hintergrund)
- [ ] Am Ende: "App ist bereit." in gruen

### Port
- [ ] Port-Feld sichtbar (Default 8501)
- [ ] Port editierbar wenn gestoppt/nicht installiert
- [ ] Port read-only wenn laeuft
- [ ] Port WECHSELN: 8501 → 9000 → App erreichbar auf 9000
- [ ] Port-Indikator: gruen wenn laeuft (nicht rot)

### Zustaende
- [ ] Nicht installiert: [Installieren] sichtbar
- [ ] Laeuft: [Im Browser oeffnen] [Stoppen] [Deinstallieren]
- [ ] Gestoppt: [Starten] [Deinstallieren]
- [ ] Alle Buttons komplett sichtbar (620px breit, kein Abschneiden)

### Deinstallieren
- [ ] Verbose Output: jeden Container/Image einzeln mit ✓/✗
- [ ] Image-Groessen angezeigt
- [ ] Summary: "X Artefakte entfernt, Y MB freigegeben"
- [ ] Zustand wechselt zu "Nicht installiert"

### Cleanup beim Start
- [ ] Findet verwaiste Artefakte (falls vorhanden)
- [ ] User kann auswaehlen (Lerndaten default AUS)
- [ ] Verbose Fortschritt

### Windows
- [ ] .exe startet (aus GitHub Release)
- [ ] Persistentes Fenster (KEINE Dialog-Kette!)
- [ ] Alle Funktionen wie auf Linux

---

## PRIO 3: CONTENT-QUALITAET (Native-Speaker Stichprobe)

Erfordert Domaenenwissen. Nicht automatisierbar.

- [ ] Deutsch-Englisch A1/B1: Uebersetzungen korrekt?
- [ ] KI-Einsteiger (DE): Fachbegriffe korrekt? Erklaerungen verstaendlich?
- [ ] Ansible QE: Kommandos korrekt? Syntax stimmt?
- [ ] Japanisch A1: Hiragana/Katakana korrekt? Romanisierung stimmt?
- [ ] Koreanisch A1: Hangul korrekt? Romanisierung stimmt?
- [ ] Chinesisch A1: Pinyin korrekt? Zeichen stimmt?
- [ ] Italienisch A1: Stichprobe Grammatik/Vokabeln
- [ ] Portugiesisch-BR A1: Stichprobe

---

## PRIO 4: LERNEN - MANUELLE UX-PRUEFUNG

### Uebungstypen (visuell pruefen)
- [ ] Matching: Paare GLEICHE Hoehe (kein visueller Versatz)
- [ ] Matching: "Aufloesen" Animation sieht gut aus (4 Effekte testen)
- [ ] Word Tiles: Korrektur LESBAR (Leerzeichen, kein "DasGehirnvergisst...")
- [ ] Free Text: Korrektur LESBAR (Token-Diff verstaendlich)
- [ ] Picture Choice: Kacheln GLEICHE Hoehe

### Lern-Modi (jeden einmal durchspielen)
- [ ] Modus-Toggle NICHT disabled auf neuen Lektionen
- [ ] Pruefungsmodus: keine Hilfen, Ergebnis am Ende, 1.5x XP
- [ ] Zeitmodus: Countdown-Balken sichtbar, Farb-Uebergang
- [ ] Fehler-Modus: nur Fehlerkarten (nach min. 1 Fehler)
- [ ] Rueckwaerts: Matching-Spalten getauscht
- [ ] Zufall: Karten aus verschiedenen Lektionen gemischt
- [ ] Endlos: kein Session-Ende, Statistik laeuft

### Social Sharing (visuell + nativ)
- [ ] Share-Button nach Lektion sichtbar
- [ ] Mobile: native Share-Sheet (WhatsApp/Telegram)
- [ ] Desktop: kopiert in Zwischenablage + Toast
- [ ] PNG Share-Card: sieht gut aus (1200x630, Theme-Tokens)

---

## PRIO 5: AI FEATURES (braucht echten API-Key)

- [ ] Provider-Tabelle: Key eingeben → "Testen" → "Verbindung ok"
- [ ] "Uebungen generieren" bei theory-only: AI liefert Ergebnis
- [ ] Qualitaet der generierten Exercises: sinnvoll? Typenvielfalt?
- [ ] "Sitzung fortsetzen" nach Chat-Import: AI kennt den Kontext
- [ ] AI Content Validation: Report sinnvoll? Provider+Modell angezeigt?
- [ ] Kein Button ohne Key fuehrt zu Error-Toast (disabled + Tooltip)

---

## PRIO 6: THEMES (subjektive Aesthetik)

Fuer JEDES Theme einmal durchklicken:
- [ ] Light: lesbar, Kontraste
- [ ] Dark: lesbar, App-Icon helle Variante
- [ ] Ocean, Forest, Sepia, High-Contrast
- [ ] Catppuccin Mocha, Soft Pop, Amethyst Haze
- [ ] Buttons kontrastreich auf ALLEN Themes?
- [ ] Dropdowns: opaker Hintergrund (nicht transparent)?
- [ ] Share-Card: Theme-Tokens korrekt?

---

## PRIO 7: GERAETE-SPEZIFISCH (nicht scriptbar)

### iPhone Safari
- [ ] "Zum Home-Bildschirm" → App-Icon korrekt
- [ ] PWA startet im Dexie-Modus
- [ ] Safe-Area Insets respektiert
- [ ] Bottom Tab Bar nicht von Home-Indicator ueberlagert

### Android Chrome
- [ ] "App installieren" → Maskable Icon nicht abgeschnitten
- [ ] PWA funktioniert, Dexie-Modus

### Desktop PWA
- [ ] Install-Prompt → App startet standalone
- [ ] Dexie-Modus (NICHT API-Modus, keine 404)

---

## PRIO 8: SERVER-MODUS (via Launcher)

- [ ] Set herunterladen → in "Meine Inhalte" sichtbar (kein Cache-Problem)
- [ ] Backup-Import: kein HTTP 413
- [ ] Lektion durchspielen: keine workbox Fehler in der Konsole
- [ ] Port wechseln → App erreichbar auf neuem Port

---

# TEIL B: AUTOMATISIERTE TESTS (Referenz)

Diese Tests laufen in CI oder via `make test`.
Hier nur zur Dokumentation was abgedeckt ist.

---

## Automatisiert: Unit + Component Tests (Vitest, 5477+)

Abdeckung:
- Alle Exercise-Typen (Matching, Cloze, Free Text, Word Tiles, Picture Choice)
- Answer Toggle (Meine Antwort / Aufloesung) fuer alle Typen
- Lern-Modi Configs (MODE_CONFIGS Korrektheit)
- SRS-Algorithmus
- Backup Export/Import Serialisierung
- Content-Loader (Download, Parse, Cache)
- GitHub Repo Export (manifest.yaml, search-index.json Round-Trip)
- Share-Text Builder + Share-Card Generator
- Feature-Strategy (useFeatureAvailable Hook)
- i18n Parity (alle 11 Sprachen, kein fehlender Key)
- No-Hardcoded-Colors Guard
- Complexity Gate
- File-Size / Dir-Size Gates
- Docs-Discipline Gate

Ausfuehren: `make test` oder `cd frontend && npm test`

---

## Automatisiert: Backend + Plugin Tests (pytest, 1200+)

Abdeckung:
- FastAPI Endpoints (alle CRUD Operationen)
- Content-Loader Plugin (Download, Cache, list_sets)
- Gamification Plugin (XP, Level, Badges)
- AI Plugins (Anthropic, OpenAI, Gemini) mit Mocks
- Assessment Plugin (Profil, Fortschritt)
- Session Plugin
- Tracking Plugin
- Backup Export/Import API
- Alembic Migrations (Schema-Konsistenz)
- Plugin-Lock Parity

Ausfuehren: `make test` (Backend-Teil)

---

## Automatisiert: Dexie-Smoke E2E (Playwright TS, 91)

Abdeckung:
- Vollstaendiger Lesson-Playthrough (alle Exercise-Typen)
- Content Hub Tabs (Entdecken, Meine Inhalte, Import)
- Dashboard Tabs
- Navigation (Desktop + Mobile)
- Settings
- Backup Round-Trip (programmatisch)
- Alle Routes erreichbar (kein 404)

Ausfuehren: `make dexie-smoke` oder `npx playwright test`

---

## Automatisiert: Manual-Automation E2E (Playwright TS, 18)

Abdeckung:
- Matching Resolution Flow
- Content Hub Navigation
- Keyboard Shortcuts
- Session Flows (Mobile + Desktop)
- Critical Surfaces

Ausfuehren: `make test-manual-automation`

---

## Automatisiert: Launcher Tests (pytest, 430+)

Abdeckung:
- actions.py: Docker-Check, Status, Install, Start, Stop, Uninstall
- Port-Validierung, Free-Port-Finder
- Config Load/Save Round-Trip
- Install-Manifest CRUD
- Cleanup (find_stale, cleanup_stale)
- Health-Check Logik
- CLI-GUI Paritaet
- i18n Key Parity (DE/EN)
- Frozen-Binary Erkennung
- Cross-Platform Port-Check (Windows SO_EXCLUSIVEADDRUSE)

Ausfuehren: `cd launcher && poetry run pytest` oder `make launcher-test`

---

## Automatisiert: Accessibility (axe-core, in Dexie-Smoke)

Abdeckung:
- Dashboard: keine kritischen Violations
- Settings: keine kritischen Violations
- Content: keine kritischen Violations

Erweiterung geplant: alle 15 Sektionen

---

## Automatisiert: Visual Regression (Feature-Screenshots)

Abdeckung:
- Dashboard Tabs (Desktop + Mobile)
- Content Hub Tabs
- Matching Animation
- Lesson Modes
- Answer Toggle
- GitHub Export Dialog

Ausfuehren: `make capture-screenshots` / `make verify-screenshots`

---

## Automatisiert: CI Gates (bei jedem PR)

- tsc --noEmit (TypeScript Compiler)
- eslint --max-warnings 0
- ruff check + ruff format (Backend)
- mypy --strict (Backend)
- i18n Parity
- No-Hardcoded-Colors
- Complexity Gate (.complexity-baseline)
- File-Size Gate (.filesize-baseline)
- Dir-Size Gate (.dirsize-baseline)
- Docs-Discipline
- Version-Lockstep (19 Dateien)
- Plugin-Lock Parity

---

# ERGEBNIS

```
Datum:
Tester:
Geraet + Browser:
Version:

MANUELLE TESTS:
  Getestet: ___ / ___
  OK:       ___
  BUG:      ___
  SKIP:     ___

  Kritische Bugs (Launch-Blocker):
  1.

  Mittlere Bugs:
  1.

  Kosmetische Bugs:
  1.

AUTOMATISIERTE TESTS:
  Vitest:       ___/5477 gruen
  Backend:      ___/1200 gruen
  Dexie-Smoke:  ___/91 gruen
  Launcher:     ___/430 gruen
  CI Gates:     alle gruen? [ ]

Fazit: LAUNCH-READY / NICHT LAUNCH-READY
```
