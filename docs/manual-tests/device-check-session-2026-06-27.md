# Device-Check-Session — Checkliste

Stand: alle Features CI-grün und gemergt, aber visuell unverifiziert. Diese Session arbeitet den manuellen Berg ab. Regel dahinter: "CI grün ≠ funktioniert im Browser."

**Test-URLs:**
- Preview/Latest (develop): `https://astrapi69.github.io/adaptive-learner-content-test/`
- Production (main, nur falls schon released): `https://astrapi69.github.io/adaptive-learner/`

Das meiste liegt auf **develop** → Preview-URL. Vor dem Test sicherstellen, dass der jeweils letzte develop-Deploy durch ist (Über-Tab zeigt Branch + Hash, falls der Latest-Strang-Build schon live ist → damit prüfbar, ob die Preview aktuell ist).

---

## TEIL 1 — iPhone (iOS Safari)

### STS-0001 1.1 PWA-Installation (#1167)
- [ ] STC-0001 Safari öffnen → Preview-URL.
- [ ] STC-0002 **iOS-Installhinweis** erscheint? (Teilen-Symbol → "Zum Home-Bildschirm"-Hinweis, nur vor Installation, dezent, unten).
- [ ] STC-0003 "Zum Home-Bildschirm" ausführen → App vom Homescreen starten.
- [ ] STC-0004 **Startet standalone** (ohne Safari-Adressleiste)?
- [ ] STC-0005 Nach Installation: iOS-Hinweis erscheint NICHT mehr?

### STS-0002 1.2 Key-Export (#1166 / #1181 / #1183)
- [ ] STC-0006 KI-Schlüssel setzen (falls nicht vorhanden), Tutor-Chat kurz testen (Key gültig).
- [ ] STC-0007 **Daten-Tab:** Key-Export-Sektion sichtbar, mit gesetztem Key **aktiv**?
- [ ] STC-0008 Export auslösen → `.alk`-Download startet? (auf iOS ggf. "Datei sichern"-Dialog).
- [ ] STC-0009 **KI-Tab:** Verweis-Button sichtbar? Klick → springt zum Daten-Tab UND scrollt zur Key-Export-Sektion?
- [ ] STC-0010 Kein zweites Export-UI im KI-Tab (nur der Verweis-Button)?

### STS-0003 1.3 Multiselect-Aufgabe (#1195)
- [ ] STC-0011 Eine `multiselect`-cloze-Aufgabe öffnen (im Beeinflussungs-Set #75, falls schon live, oder Testset).
- [ ] STC-0012 **Checkboxen** (nicht Dropdown), mehrere wählbar?
- [ ] STC-0013 Touch-Targets groß genug (44px)?
- [ ] STC-0014 Auflösung: korrekt grün, falsch gewählt rot, übersehene Korrekte als "Missed" (Badge, nicht nur Farbe)?
- [ ] STC-0015 Submit/Prüfen disabled solange nichts gewählt?

### STS-0004 1.4 Deep-Link (#892)
- [ ] STC-0016 Eine Set-Deep-Link-URL **direkt** in Safari eingeben (nicht in-App navigiert): `…/content/set/<setId>`.
- [ ] STC-0017 Lädt korrekt (nicht 404)? Das prüft das GH-Pages-Fallback.
- [ ] STC-0018 Nicht heruntergeladenes/unbekanntes Set → sauberer "Set nicht gefunden"-Zustand, kein Crash?

### STS-0005 1.5 Download-Sortierung (#1211)
- [ ] STC-0019 Ein Set herunterladen.
- [ ] STC-0020 In der "Persönlich"-Liste (Lernpfad): erscheint das frisch heruntergeladene Set **oben** über den anderen unangefassten Downloads?

### STS-0006 1.6 Mobile Navigation unverändert (Regression für #891)
- [ ] STC-0021 Untere Tab-Bar normal vorhanden, 5 Tabs?
- [ ] STC-0022 KEINE Desktop-Sidebar auf dem iPhone?

---

## TEIL 2 — Desktop (Chrome + Brave)

### STS-0007 2.1 Desktop-Sidebar (#891)
- [ ] STC-0023 Browserfenster breit (≥1024px) → **vertikale Sidebar** links sichtbar?
- [ ] STC-0024 Aktiver Eintrag korrekt hervorgehoben (entspricht aktueller Route)?
- [ ] STC-0025 Navigation über Sidebar führt zu den richtigen Routen?
- [ ] STC-0026 Fenster schmaler ziehen (768-1024px) → Top-Bar statt Sidebar? Unter 768px → untere Tab-Bar?

### STS-0008 2.2 Latest-Strang (#1172)
- [ ] STC-0027 Über-Tab: **StrangBadge** zeigt Strang (Latest) + Branch + Hash?
- [ ] STC-0028 Latest mit Warn-Styling (gewarnt, instabil)?
- [ ] STC-0029 Teilen-Bereich: Latest = nur gewarnter Link, **kein QR**?
- [ ] STC-0030 (Falls Production geprüft wird: Haupt = QR + Link, Strang "Haupt".)

### STS-0009 2.3 QR-Code scannen (#1172)
- [ ] STC-0031 Auf Production/Haupt-Strang (falls live): QR-Code mit dem Handy scannen → führt auf die Production-URL?

### STS-0010 2.4 Key-Export Desktop (#1183)
- [ ] STC-0032 Wie 1.2, aber Desktop: Daten-Tab Export aktiv, `.alk`-Download, KI-Tab-Verweis-Button springt + scrollt.

### STS-0011 2.5 Multiselect Desktop (#1195)
- [ ] STC-0033 Wie 1.3: Checkboxen, Auflösung, **Fokus-Ring** bei Keyboard-Navigation (Tab durch die Optionen)?

### STS-0012 2.6 Deep-Link Desktop (#892)
- [ ] STC-0034 Wie 1.4: Set-Deep-Link-URL direkt im Browser, lädt + Nicht-gefunden-Zustand.

---

## TEIL 3 — Visual-Regression-Baselines (konsistente Maschine)

Auf der dafür vorgesehenen konsistenten Maschine (nicht im flüchtigen Container) `make capture-screenshots` und die betroffenen PNGs committen. Betrifft die UI-verändernden Merges:
- Key-Export-Flow (Daten-Tab + KI-Tab-Verweis)
- PWA iOS-Hinweis (mobile Baseline, bottom-anchored)
- Latest-Strang: Über-Tab (StrangBadge) + Teilen-Bereich
- Desktop-Sidebar (#891) — Desktop-Baseline
- Deep-Link Set-Ansicht (#892)
- multiselect-Renderer (#1195)
- Download-Sortierung "Persönlich"-Liste (#1211) — falls visuell relevant

Pro Feature prüfen, ob die Baseline-Änderung **erwartet** ist (neues UI) vs. ein versehentlicher visueller Regress. Nur erwartete Änderungen committen.

---

## TEIL 4 — Lern-Bewertung über Zeit (kein Einzeltest)

### STS-0013 4.1 SRS-Exam-Boost-Faktor (#1040)
- `EXAM_INTERVAL_FACTOR = 2.0` (definiert in `element_srs.py` + `element-errors-dexie.ts`).
- [ ] STC-0035 Über **mehrere Tage** im Prüfungsmodus lernen und bewerten: Kommen bestandene Exam-Karten angenehm seltener wieder (nicht zu aggressiv hinausgeschoben, nicht wirkungslos)?
- Falls sich der Faktor falsch anfühlt: an den zwei genannten Stellen nachjustieren (eine benannte Konstante pro Pfad).
- Das ist kein Pass/Fail-Test, sondern eine Gefühls-Bewertung über Zeit. Das frische Beeinflussungs-Set (#75) eignet sich als Material.

---

## Ergebnis festhalten
Pro Punkt: OK / Bug. Für jeden Bug ein GitHub-Issue (GITHUB-ISSUE-PFLICHT) mit dem konkreten Fehlverhalten, dann an den passenden Agenten (CCW Frontend / CC Backend / CCWc Content). Bestandene Punkte brauchen kein Issue.
