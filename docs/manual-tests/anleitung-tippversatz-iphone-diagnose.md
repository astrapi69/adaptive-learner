# Anleitung: Tippversatz auf dem iPhone diagnostizieren (#1569)

Diese Anleitung beschreibt, wie du den **Tippversatz** (ein Tipp landet 1-2 Zeilen
unter dem sichtbaren Ziel) auf dem iPhone selbst misst und die eingebauten
**Fix-Kandidaten** durchprobierst. Der Fehler tritt nur auf einem echten Gerät
mit echter Bildschirmtastatur auf und lässt sich nicht in der CI nachstellen,
darum ist diese manuelle Messung der einzige Weg zum richtigen Fix.

Du brauchst nur das iPhone (Safari). Ein Mac ist optional (nur für die Konsole,
siehe unten) - die Werte stehen alle direkt im Overlay auf dem Bildschirm.

## Schritt 0: Die RICHTIGE Seite öffnen

Die Sonde und die Schalter liegen auf dem **Entwicklungs-Preview**, nicht auf der
öffentlichen Seite (die kommt von `main` und wird nur bei einem Release
aktualisiert).

- **Richtig:** `https://astrapi69.github.io/adaptive-learner-content-test/`
- **Falsch:** `https://astrapi69.github.io/adaptive-learner/` (dort tut `?vvdiag=1`
  noch nichts)

### Wichtig: den frischen Build erzwingen (PWA-Cache)

Die App ist eine PWA mit Service-Worker-Cache. Wenn `?vvdiag=1` oben nichts
anzeigt, serviert das iPhone noch die alte gecachte Version. Dann:

1. Alle Tabs der Seite in Safari schließen.
2. Safari-Seite neu öffnen und **einmal ohne Parameter** laden lassen, bis der
   In-App-Update-Hinweis erscheint (falls vorhanden) - annehmen.
3. Danach mit `?vvdiag=1` (siehe unten) neu laden.

Kontrolle: Oben muss eine dünne Leiste mit `winY=… vvTop=… scale=…` erscheinen.
Erst dann ist der neue Build aktiv.

## Schritt 1: Die Messsonde einschalten

Öffne am iPhone:

```
https://astrapi69.github.io/adaptive-learner-content-test/?vvdiag=1
```

Oben erscheint eine Leiste mit zwei Zeilen. Bedeutung:

| Feld | Bedeutung |
|------|-----------|
| `winY` | aktueller Fenster-Scroll (`window.scrollY`) |
| `vvTop` | Versatz des sichtbaren Viewports (`visualViewport.offsetTop`) |
| `scale` | Zoomstufe (1 = kein Pinch-Zoom) |
| `kbd` | wie stark die Tastatur den sichtbaren Bereich verkleinert (px) |
| `fix` | welcher Fix-Kandidat gerade aktiv ist (`off` = keiner) |
| `tap …` | beim letzten Tipp: das getroffene Element und **`ΔY`** |

**`ΔY` ist die Kennzahl.** Es ist der Abstand zwischen deiner Fingerspitze und
der Oberkante des tatsächlich getroffenen Elements. `ΔY ≈ 0` heißt: der Tipp
landet richtig. Ein positives `ΔY` (z. B. 30-90) heißt: das getroffene Element
liegt so viele Pixel UNTER deinem Finger - das ist der Bug.

## Schritt 2: Den Versatz sichtbar machen

Tippe auf eine Stelle, die erfahrungsgemäß danebengeht:

- **Einstellungen:** eine Liste scrollen, eine Checkbox/einen Schalter tippen.
- **Lektion:** ein Textfeld fokussieren (Tastatur geht auf), Tastatur schließen,
  dann ein Element tippen; oder eine Multiple-Choice-Kachel.

Lies nach jedem Tipp die `tap …`-Zeile ab, besonders `ΔY`. Notiere dir 3-4 der
daneben-Tipps (welche Seite, welches Element, `ΔY`, und ob `winY` oder `vvTop`
gerade der von 0 verschiedene Wert ist).

## Schritt 3: Die Fix-Kandidaten durchprobieren

Jetzt hängst du zusätzlich `&vvfix=<name>` an die URL und wiederholst Schritt 2.
Probiere alle vier nacheinander und beobachte, bei welchem `ΔY` auf ~0 fällt und
die Tipps wieder richtig landen:

```
https://astrapi69.github.io/adaptive-learner-content-test/?vvdiag=1&vvfix=novhd
https://astrapi69.github.io/adaptive-learner-content-test/?vvdiag=1&vvfix=vpheight
https://astrapi69.github.io/adaptive-learner-content-test/?vvdiag=1&vvfix=nolock
https://astrapi69.github.io/adaptive-learner-content-test/?vvdiag=1&vvfix=hardreset
```

Oben in der Leiste bestätigt `fix=novhd` (bzw. der jeweilige Name), dass der
Schalter aktiv ist. Was jeder Kandidat versucht:

| `vvfix` | Ansatz |
|---------|--------|
| `novhd` | Shell-Höhe `100dvh` → `100vh` (dvh folgt der Tastatur nicht, die Layout-Ebene schon) |
| `vpheight` | Shell an `visualViewport.height` binden, solange die Tastatur offen ist |
| `nolock` | `overflow:hidden` von `body` entfernen, natürliches Dokument-Scrollen |
| `hardreset` | Scroll bei jeder Viewport-Änderung hart auf 0 zurücksetzen |

## Schritt 4: Ergebnis zurückmelden

Melde bitte:

1. **Welcher `vvfix` den Versatz beseitigt** (`ΔY ≈ 0`, Tipps landen richtig).
   Falls mehrere helfen, welcher am saubersten (ohne Nebenwirkung wie „Bild
   springt/vergrößert sich beim Tastatur-Öffnen").
2. Optional die notierten Roh-Werte aus Schritt 2 (`ΔY` und `winY` vs. `vvTop`) -
   damit lässt sich die Ursache zusätzlich absichern.

Aus dem Gewinner baue ich den dauerhaften Fix (ohne Parameter, für alle Nutzer)
und schließe #1569 ab.

## Optional: kopierbare Konsole (Mac + Safari)

Das Overlay ist auf dem iPhone direkt lesbar - ein Screenshot reicht. Wer eine
kopierbare Historie will, nutzt den Safari-Web-Inspector:

1. Am iPhone: Einstellungen → Safari → Erweitert → **Web-Inspector** aktivieren.
2. iPhone per Kabel an den Mac, Safari am Mac öffnen.
3. Mac-Safari → Menü **Entwickeln** → dein iPhone → die geöffnete Seite wählen.
4. In der Konsole erscheint pro Tipp eine Zeile `[vvdiag] {…}` mit allen Werten
   zum Kopieren.

(Auf Android geht dasselbe einfacher über `chrome://inspect` am Desktop-Chrome.)

## Abschalten

- Sonde aus: `?vvdiag=0`
- Fix-Experiment aus: `?vvfix=off`

Beide Schalter sind reine Diagnose-Werkzeuge, standardmäßig aus, und für normale
Nutzer unsichtbar.
