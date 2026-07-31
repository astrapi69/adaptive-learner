# Chat-Journal 2026-07-30 - Hotfix v2.8.1 (weiße Seite, Debug-Default, unsafe-eval)

Fortsetzung der Release-Session (siehe
`chat-journal-session-2026-07-30-release-v2.8.0.md`). Lane CC.

## 1. Drei auf dem Gerät gefundene Ship-Defekte

- Original prompt: "anwendung sieht weiß aus" (Konsolen-Dump), dann die
  CC-Prompts "Weiße Seite über den Launcher, und warum die Kette es
  nicht sah", "Zwei Nachträge zu v2.8.0", "Zweiter Richtlinienverstoß"
- Ziel: v2.8.0-Defekte verifikationsgetrieben fixen, Kette so erweitern,
  dass die Klasse nie wieder grün durchrutscht
- Ergebnis:
  1. **#2197 weiße Seite**: Der Backend-Static-Mount (#2058) lieferte die
     SPA mit der deny-everything-API-CSP aus. Fix: drei Antwortklassen
     (API strikt / Docs CDN / SPA same-origin, Inline-Blöcke per
     sha256-Hash aus der realen index.html - `unsafe-inline` für
     Skripte bleibt verboten). Verifizierte externe Hosts der App
     (api.github.com, raw.githubusercontent.com, img.youtube.com)
     explizit erlaubt, sonst nichts.
  2. **#2198 Debug-Default**: `debug:true` im nackten Container. Safe
     default gehört in die ANWENDUNG - Wrapper dürfen schärfen, nie
     reparieren. App-Default jetzt false, Quelltext-Pin beidseitig.
  3. **#2205 unsafe-eval**: Ajv kompilierte das Lesson-Schema zur
     Laufzeit (`new Function()`) - "Meine Lektionen" und
     Analyse-zu-Lektion brachen unter der neuen CSP. Fix: Build-Zeit-
     Kompilierung (Ajv standaloneCode, `make sync-schema` erzeugt das
     Modul mit eingebettetem Schema-Quell-Hash; Re-Pin ohne Regeneration
     fällt laut). `unsafe-eval` wird NICHT erlaubt.
  4. **#2206** (Beifang der Station): create-lesson loggte console.error
     für den leeren Anfangs-Draft; jetzt still, präzise Gründe
     (#1722) bleiben für echte Eingaben.

## 2. Die Kette lernt sehen: Fähigkeits-Station

- Jede frühere Station prüfte Stellvertreter (Health-JSON,
  Statuscodes, script-Tags). Neu: echtes Chromium öffnet die Seite des
  publizierten Images - sichtbares Element, saubere Konsole,
  debug=false, CSP-nicht-API am nackten Artefakt.
- Nach #2205 (Verstoss lebte in einem Lazy-Chunk, den die alte Prüfung
  selbst beim Routenbesuch nie ausgeführt hätte): Walk betritt 24
  Routen-Zustände (Content-Tabs, Dashboard-Tabs, alle Settings-Tabs,
  Learning-Path-Kartenansicht, Onboarding-Schnellpfad) und beweist
  Bundle-Abdeckung gegen die Asset-Liste des Images: jedes .js-Bundle
  lädt in einem Zustand, ist gezählter Mikro-Chunk (<2500 B,
  tree-shaken Icons) oder trägt eine BENANNTE Entschuldigung
  (Locale-Bundles, Param-Routen mit Datenbedarf, User-Aktions-Modale,
  #900-geflaggter Graph). Neues Bundle ohne Abdeckung = rot; leere
  Liste = rot; Konsole = rot.
- RED gegen den alten Build: EvalError auf /content?tab=my UND /import.
  GREEN am gefixten Image: 165/227 geladen, 62 excused/mikro,
  0 ungedeckt, 24 Routen, Konsole sauber.
- Stations-Container läuft mit RATE_LIMIT_ENABLED=0 (begründet: der
  Limiter hat eigene Tests; die Station misst die Seite, nicht den
  Limiter).

## 3. Tag-Bewegungen (dokumentiert)

v2.8.1 wurde zweimal neu gesetzt (zuletzt f7ef4a92 -> 92599dc2, dem
develop->main-Merge mit dem Eval-Fix). Zulässig, weil der Draft nie
publiziert war und niemand den Tag ziehen konnte; jede Bewegung ist hier
und im Endbericht festgehalten. GHCR :2.8.1 trug zwischenzeitlich ein
Eval-behaftetes Image aus der abgebrochenen Kette (Run 30556690251,
cancelled) - wird vom Neubau überschrieben; nie in einem sichtbaren
Release referenziert.

## 4. Größen-Gate-Nachtrag

Toleranz an gemessenes Rauschen verankert: +/-200000 B (~4.2x des
gemessenen 47651-B-Rebuild-Jitters) um die auf die publizierten
v2.8.0-Werte re-verankerten Ceilings; unerwartetes Schrumpfen ist
jetzt ebenfalls ein Befund (Ratchet bietet an, wendet nie automatisch
an).

## 5. Umentscheid: v2.8.2 statt v2.8.1 (Manager-Freigabe)

Nach dem fünften Setzen des v2.8.1-Tags stellte der Release-Manager
die Nummernfrage; Empfehlung und Entscheid: Nummer überspringen.

- Hauptgrund: GHCR `:2.8.1` war zwischenzeitlich mit dem Eval-defekten
  Image aus dem abgebrochenen Lauf öffentlich ziehbar. Einen einmal
  ziehbaren Image-Tag mit anderem Inhalt zu überschreiben ist dieselbe
  Vertrauens-Falle, die bei Binaries strikt vermieden wird.
- Zweitgrund: fünf Tag-Bewegungen an einem Tag; "niemand hat gepullt"
  ist Annahme, nicht Beweis. Präzedenz: v2.7.1 (gelöscht, nie
  released).
- Preis: voller Bump (Launcher embedden die Version; das Gate prüft
  Tag/Image/Health-Agreement) - pyproject 2.8.2, sync-versions (19
  Dateien), Notes v2.8.2.md mit bilingualer Skip-Begründung,
  README-Badges (die Badge-Falle diesmal VOR dem Push vom lokalen
  verify-docs-discipline gefangen).
- Rückbau v2.8.1: Draft gelöscht, Git-Tag gelöscht. GHCR `:2.8.1`
  offen - das gh-Token trägt kein delete:packages; Nacharbeit nach
  interaktivem `gh auth refresh -s read:packages,delete:packages`.
- CCW-Zuarbeit: Lint-Restfix (zwei unused eslint-disable, nicht eine -
  meine Übergabe hatte die zweite Fundstelle übersehen) + grüner
  main-Merge 6ddd4890. CCW-Sandbox kann keine Tags schreiben (Proxy
  403) und erreicht den CI-Artifact-Storage (Azure-Blob-Domains)
  nicht - daher Rückübergabe an die lokale Lane für Tag, Kette,
  Assets.
- Beifang der Branch-Aufräumung: verwaister Explorationsauftrag
  (Vorlesefunktion) als EXP-047 umnummeriert gelandet (PR #2207);
  52 lokale Alt-Branches gelöscht (Backup-Bundle neben dem Repo),
  hotfix/2.8.1 + Orphan-Branch remote entfernt.
