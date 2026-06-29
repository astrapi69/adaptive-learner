# Device-Check-Session — Checkliste

Stand: alle Features CI-grün und gemergt, aber visuell unverifiziert. Diese Session arbeitet den manuellen Berg ab. Regel dahinter: "CI grün ≠ funktioniert im Browser."

**Test-URLs:**
- Preview/Latest (develop): `https://astrapi69.github.io/adaptive-learner-content-test/`
- Production (main, nur falls schon released): `https://astrapi69.github.io/adaptive-learner/`

Das meiste liegt auf **develop** → Preview-URL. Vor dem Test sicherstellen, dass der jeweils letzte develop-Deploy durch ist (Über-Tab zeigt Branch + Hash, falls der Latest-Strang-Build schon live ist → damit prüfbar, ob die Preview aktuell ist).

---

## TEIL 1 — iPhone (iOS Safari)

### 1.1 PWA-Installation (#1167)
- Safari öffnen → Preview-URL.
- **iOS-Installhinweis** erscheint? (Teilen-Symbol → "Zum Home-Bildschirm"-Hinweis, nur vor Installation, dezent, unten).
- "Zum Home-Bildschirm" ausführen → App vom Homescreen starten.
- **Startet standalone** (ohne Safari-Adressleiste)?
- Nach Installation: iOS-Hinweis erscheint NICHT mehr?

### 1.2 Key-Export (#1166 / #1181 / #1183)
- KI-Schlüssel setzen (falls nicht vorhanden), Tutor-Chat kurz testen (Key gültig).
- **Daten-Tab:** Key-Export-Sektion sichtbar, mit gesetztem Key **aktiv**?
- Export auslösen → `.alk`-Download startet? (auf iOS ggf. "Datei sichern"-Dialog).
- **KI-Tab:** Verweis-Button sichtbar? Klick → springt zum Daten-Tab UND scrollt zur Key-Export-Sektion?
- Kein zweites Export-UI im KI-Tab (nur der Verweis-Button)?

### 1.3 Multiselect-Aufgabe (#1195)
- Eine `multiselect`-cloze-Aufgabe öffnen (im Beeinflussungs-Set #75, falls schon live, oder Testset).
- **Checkboxen** (nicht Dropdown), mehrere wählbar?
- Touch-Targets groß genug (44px)?
- Auflösung: korrekt grün, falsch gewählt rot, übersehene Korrekte als "Missed" (Badge, nicht nur Farbe)?
- Submit/Prüfen disabled solange nichts gewählt?

### 1.4 Deep-Link (#892)
- Eine Set-Deep-Link-URL **direkt** in Safari eingeben (nicht in-App navigiert): `…/content/set/<setId>`.
- Lädt korrekt (nicht 404)? Das prüft das GH-Pages-Fallback.
- Nicht heruntergeladenes/unbekanntes Set → sauberer "Set nicht gefunden"-Zustand, kein Crash?

### 1.5 Download-Sortierung (#1211)
- Ein Set herunterladen.
- In der "Persönlich"-Liste (Lernpfad): erscheint das frisch heruntergeladene Set **oben** über den anderen unangefassten Downloads?

### 1.6 Mobile Navigation unverändert (Regression für #891)
- Untere Tab-Bar normal vorhanden, 5 Tabs?
- KEINE Desktop-Sidebar auf dem iPhone?

---

## TEIL 2 — Desktop (Chrome + Brave)

### 2.1 Desktop-Sidebar (#891)
- Browserfenster breit (≥1024px) → **vertikale Sidebar** links sichtbar?
- Aktiver Eintrag korrekt hervorgehoben (entspricht aktueller Route)?
- Navigation über Sidebar führt zu den richtigen Routen?
- Fenster schmaler ziehen (768-1024px) → Top-Bar statt Sidebar? Unter 768px → untere Tab-Bar?

### 2.2 Latest-Strang (#1172)
- Über-Tab: **StrangBadge** zeigt Strang (Latest) + Branch + Hash?
- Latest mit Warn-Styling (gewarnt, instabil)?
- Teilen-Bereich: Latest = nur gewarnter Link, **kein QR**?
- (Falls Production geprüft wird: Haupt = QR + Link, Strang "Haupt".)

### 2.3 QR-Code scannen (#1172)
- Auf Production/Haupt-Strang (falls live): QR-Code mit dem Handy scannen → führt auf die Production-URL?

### 2.4 Key-Export Desktop (#1183)
- Wie 1.2, aber Desktop: Daten-Tab Export aktiv, `.alk`-Download, KI-Tab-Verweis-Button springt + scrollt.

### 2.5 Multiselect Desktop (#1195)
- Wie 1.3: Checkboxen, Auflösung, **Fokus-Ring** bei Keyboard-Navigation (Tab durch die Optionen)?

### 2.6 Deep-Link Desktop (#892)
- Wie 1.4: Set-Deep-Link-URL direkt im Browser, lädt + Nicht-gefunden-Zustand.

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

### 4.1 SRS-Exam-Boost-Faktor (#1040)
- `EXAM_INTERVAL_FACTOR = 2.0` (definiert in `element_srs.py` + `element-errors-dexie.ts`).
- Über **mehrere Tage** im Prüfungsmodus lernen und bewerten: Kommen bestandene Exam-Karten angenehm seltener wieder (nicht zu aggressiv hinausgeschoben, nicht wirkungslos)?
- Falls sich der Faktor falsch anfühlt: an den zwei genannten Stellen nachjustieren (eine benannte Konstante pro Pfad).
- Das ist kein Pass/Fail-Test, sondern eine Gefühls-Bewertung über Zeit. Das frische Beeinflussungs-Set (#75) eignet sich als Material.

---

## Ergebnis festhalten
Pro Punkt: OK / Bug. Für jeden Bug ein GitHub-Issue (GITHUB-ISSUE-PFLICHT) mit dem konkreten Fehlverhalten, dann an den passenden Agenten (CCW Frontend / CC Backend / CCWc Content). Bestandene Punkte brauchen kein Issue.
