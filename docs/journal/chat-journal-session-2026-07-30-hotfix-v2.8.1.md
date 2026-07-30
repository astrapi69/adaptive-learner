# Chat-Journal 2026-07-30 - Hotfix v2.8.1 (weisse Seite, Debug-Default, unsafe-eval)

Fortsetzung der Release-Session (siehe
`chat-journal-session-2026-07-30-release-v2.8.0.md`). Lane CC.

## 1. Drei auf dem Geraet gefundene Ship-Defekte

- Original prompt: "anwendung sieht weiss aus" (Konsolen-Dump), dann die
  CC-Prompts "Weisse Seite ueber den Launcher, und warum die Kette es
  nicht sah", "Zwei Nachtraege zu v2.8.0", "Zweiter Richtlinienverstoss"
- Ziel: v2.8.0-Defekte verifikationsgetrieben fixen, Kette so erweitern,
  dass die Klasse nie wieder gruen durchrutscht
- Ergebnis:
  1. **#2197 weisse Seite**: Der Backend-Static-Mount (#2058) lieferte die
     SPA mit der deny-everything-API-CSP aus. Fix: drei Antwortklassen
     (API strikt / Docs CDN / SPA same-origin, Inline-Bloecke per
     sha256-Hash aus der realen index.html - `unsafe-inline` fuer
     Skripte bleibt verboten). Verifizierte externe Hosts der App
     (api.github.com, raw.githubusercontent.com, img.youtube.com)
     explizit erlaubt, sonst nichts.
  2. **#2198 Debug-Default**: `debug:true` im nackten Container. Safe
     default gehoert in die ANWENDUNG - Wrapper duerfen schaerfen, nie
     reparieren. App-Default jetzt false, Quelltext-Pin beidseitig.
  3. **#2205 unsafe-eval**: Ajv kompilierte das Lesson-Schema zur
     Laufzeit (`new Function()`) - "Meine Lektionen" und
     Analyse-zu-Lektion brachen unter der neuen CSP. Fix: Build-Zeit-
     Kompilierung (Ajv standaloneCode, `make sync-schema` erzeugt das
     Modul mit eingebettetem Schema-Quell-Hash; Re-Pin ohne Regeneration
     faellt laut). `unsafe-eval` wird NICHT erlaubt.
  4. **#2206** (Beifang der Station): create-lesson loggte console.error
     fuer den leeren Anfangs-Draft; jetzt still, praezise Gruende
     (#1722) bleiben fuer echte Eingaben.

## 2. Die Kette lernt sehen: Faehigkeits-Station

- Jede fruehere Station pruefte Stellvertreter (Health-JSON,
  Statuscodes, script-Tags). Neu: echtes Chromium oeffnet die Seite des
  publizierten Images - sichtbares Element, saubere Konsole,
  debug=false, CSP-nicht-API am nackten Artefakt.
- Nach #2205 (Verstoss lebte in einem Lazy-Chunk, den die alte Pruefung
  selbst beim Routenbesuch nie ausgefuehrt haette): Walk betritt 24
  Routen-Zustaende (Content-Tabs, Dashboard-Tabs, alle Settings-Tabs,
  Learning-Path-Kartenansicht, Onboarding-Schnellpfad) und beweist
  Bundle-Abdeckung gegen die Asset-Liste des Images: jedes .js-Bundle
  laedt in einem Zustand, ist gezaehlter Mikro-Chunk (<2500 B,
  tree-shaken Icons) oder traegt eine BENANNTE Entschuldigung
  (Locale-Bundles, Param-Routen mit Datenbedarf, User-Aktions-Modale,
  #900-geflaggter Graph). Neues Bundle ohne Abdeckung = rot; leere
  Liste = rot; Konsole = rot.
- RED gegen den alten Build: EvalError auf /content?tab=my UND /import.
  GREEN am gefixten Image: 165/227 geladen, 62 excused/mikro,
  0 ungedeckt, 24 Routen, Konsole sauber.
- Stations-Container laeuft mit RATE_LIMIT_ENABLED=0 (begruendet: der
  Limiter hat eigene Tests; die Station misst die Seite, nicht den
  Limiter).

## 3. Tag-Bewegungen (dokumentiert)

v2.8.1 wurde zweimal neu gesetzt (zuletzt f7ef4a92 -> 92599dc2, dem
develop->main-Merge mit dem Eval-Fix). Zulaessig, weil der Draft nie
publiziert war und niemand den Tag ziehen konnte; jede Bewegung ist hier
und im Endbericht festgehalten. GHCR :2.8.1 trug zwischenzeitlich ein
Eval-behaftetes Image aus der abgebrochenen Kette (Run 30556690251,
cancelled) - wird vom Neubau ueberschrieben; nie in einem sichtbaren
Release referenziert.

## 4. Groessen-Gate-Nachtrag

Toleranz an gemessenes Rauschen verankert: +/-200000 B (~4.2x des
gemessenen 47651-B-Rebuild-Jitters) um die auf die publizierten
v2.8.0-Werte re-verankerten Ceilings; unerwartetes Schrumpfen ist
jetzt ebenfalls ein Befund (Ratchet bietet an, wendet nie automatisch
an).
