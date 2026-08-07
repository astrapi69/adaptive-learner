# Chat-Journal 2026-08-07 - Release v2.11.0 (+ CSS-Zwischenfall und drei Nebenfunde)

Architekten-Freigabe vom Vorabend; Versionsentscheidung v2.11.0 (Minor)
per Rückfrage bestätigt. Zwischen Freigabe und Schnitt lagen vier
Befunde, die alle vor dem Tag behoben wurden.

## 1. Vorlauf: vier Blocker vor dem Schnitt (09:00-10:15)

- **#2482/#2483** (`a67794c5`): make test war auf develop latent rot -
  #2475 hatte mit den toten Release-Steps auch den Gate-Aufruf-Marker
  entfernt, an dem die Green-Gate-Ausschlussableitung hing. Fix:
  explizite Racing-Marker-Klasse; Anti-Schrumpf-Pin auf die kombinierte
  Basis. PR-CI sah die Regression nie (testmon sieht Workflow-Dateien
  nicht, #1620-Klasse).
- **#2484/#2485** (`7f94cdec`): die Dead-CSS-Tranche #2477 hatte die
  KI-Settings unstyled ausgeliefert - Konsumenten der Klassen liegen im
  externen Paket @astrapi69/ai-key-vault-react, nicht in frontend/src.
  Byte-identische Wiederherstellung; die 8 echt toten Selektoren blieben
  draußen. Methodengrenze am Tor dokumentiert (**#2486/#2487**,
  `6093e0bd`); Tranchen-Stopp auf #1485 vermerkt. #2486 auf RM-Anweisung
  geschlossen, Restpunkte im Schlusskommentar benannt.
- **#2488/#2489** (`b776007f`): js-yaml-Advisory CVE-2026-59870 blockte
  jeden PR - der overrides-Block pinnte exakt 4.3.0, einen Patch unter
  dem Fix. Override auf 4.3.1.
- **#2481** (CCW-Spur, `8e919288`): Korrektur-Zählung in
  Score/Sternen/XP - vom CCW-Agenten grün gemacht, fuhr ins Release ein.

## 2. Schnitt und Gate-Kette (10:20-11:00)

`make release-prepare VERSION=2.11.0`, Bump `4b5b914a` (sync-versions:
24 Dateien, Pins verifiziert). Stationen, alle grün:

- make release-test (inkl. Ratchets, dexie-smoke, manual-automation
  77 passed / 2 skipped)
- Playwright smoke: **45 passed / 0 failed / 0 stillgelegt (Budget 0)** -
  nach einem Befund: der #2411-Landing-Spec lief zum ERSTEN Mal
  (Smoke hat keinen CI-Workflow) und war seit Geburt rot - /start/
  als Verzeichnis-Index ist eine Server-Eigenschaft der Produktion,
  die Vite-DEV nie hatte. Spec-Fix auf Datei-Pfad (**#2492**,
  `3f3aa732`), Grenze im Header dokumentiert.
- ruff clean, mypy 91 Dateien clean, pre-commit --all-files komplett grün
- PyInstaller-Build: Artefakt-Probe `adaptive_learner_launcher 2.11.0`
  (am Binary, nicht an der Sperrdatei - Launcher-Pin hatte sich bewegt)
- make docker-build-smoke: Image 2.11.0 gebaut

## 3. release-finish: der erste Rückmerge unter enforce_admins (11:05)

main-Merge konfliktete in 25 Dateien - strukturelle Folge des
Squash-Rückmerges (#2199): main und develop teilen den Release-Commit
nicht mehr, beide Seiten ändern dieselben Versionszeilen. Auflösung
mechanisch zur Release-Seite, sync-versions-check + verify_version_pins
danach grün. Merge-Commit `bfaa5c4a` (echte zwei Eltern, auf main
verifiziert), Tag v2.11.0 darauf.

**Rückmerge-PR #2493: alle 25 Kontexte gemeldet und grün** - inklusive
der 7 Pflichtkontexte; die vier Test-Kontexte entstanden wie dokumentiert
erst durch die Changed-Areas-Detection. Kein Ratchet blockte (die
release-test-Ratchets hatten vorgeräumt). Die Konstruktion aus #2182
hat ihren ersten Ernstfall bestanden. Squash `70aaa5b5`.

## 4. Publish-Kette (11:10-11:30)

Tag-Commit-CI auf main 14/14 grün, DANN Draft. publish-image-Dispatch
Run **31164258940** success (Green-Gate, anonymer Pull, arm64-Start,
Größen-Gates, Versions-Abgleich). Digest
`sha256:f3cc5700969d651a09ca200d63c24c52c1275adaca6201fc867134bfca183aa5`.
Launcher-Binaries von den grünen main-Push-Builds des Tag-Commits
(Runs 31163327582/31163327593/31163327572), Hashes verifiziert, Linux-
Binary am Artefakt: 2.11.0.

Vollständigkeits-Checkpoint schlug korrekt an: die per-arch
Image-Archive fehlten (die Install-Doku beschreibt den registry-freien
Weg als verfügbar; kein Workflow erzeugt die Archive). Lokal aus dem
verifizierten Digest erzeugt (docker save --platform, containerd-Store
braucht das explizite --platform; erster arm64-Versuch scheiterte am
Store-Konflikt). 11 Assets komplett, publiziert **09:27:45Z**:
https://github.com/astrapi69/adaptive-learner/releases/tag/v2.11.0

## 5. Anwenderdoku-Beleg (Checkliste, belegt statt abgehakt)

| Neue Fähigkeit | End-User-Hilfe | Testplan |
|---|---|---|
| stable_id-Migration + Übernahme-Angebot | KEINE Fundstelle | - |
| Matching-Rework | KEINE Fundstelle | teilweise |
| Discover (EXP-048) | KEINE Fundstelle | ja (15 Treffer) |
| Mehrfach-Löschen | KEINE Fundstelle | - |
| Antwort-Shuffle | KEINE Fundstelle | - |
| Korrektur-Zählung (#2481) | KEINE Fundstelle | ja (18 Treffer) |

Hilfe-Nachtrag ist offene Doku-Schuld (nicht Release-blockierend, per
Architekten-Regel als erklärte Absenz zulässig).

## Offene Nacharbeiten

- ROADMAP "Blocked": kein Eintrag am v2.11.0-Tag; BADGE-CONTENT-Eintrag
  wirkt stale (#2441 lieferte das Abzeichen bereits) - beim nächsten
  ROADMAP-Durchgang bereinigen.
- docs.yml (MkDocs) letzter Lauf Mai, failure - Workflow faktisch
  schlafend; App-Deploy (deploy-gh-pages) lief heute 08:49 success.
- release-finish-Rezept: der 25-Dateien-Versionskonflikt ist seit dem
  Squash-Rückmerge der ERWARTETE Normalfall - gehört als Schritt in die
  Doku (Auflösung zur Release-Seite + Versions-Checks).
- Hilfe-Nachtrag für die sechs Fähigkeiten oben.
