# Chat-Journal Session 2026-08-05: Issue-Queue-Abarbeitung

## 1. Session-Start: Baseline + Freeze-Check (13:45)

- Original prompt: "Arbeiten wir alle issues eins nach dem anderen ab"
- Optimized prompt: "Arbeite die offenen GitHub-Issues in Prioritätsreihenfolge ab
  (Security/Data-loss zuerst, kleinster Scope als Tiebreaker); prüfe zuerst
  Release-Freeze-Status und Test-Baseline."
- Goal: Issue-Queue leeren, ein PR je Issue.
- Result: Freeze v2.9.0 als beendet verifiziert (#2278 geschlossen - Tags
  v2.9.0 und v2.10.0 stehen, kein release/*-Branch). make test zweimal rot
  durch reinen lokalen Env-Drift, kein Repo-Bug: poetry install fehlte
  (manuscript-tools), bun install fehlte (Engine 0.14.0 statt 0.17.0
  installiert). Nach den Installs grün.

## 2. #2282 Security: Exposure-Warnung an allen Install-Flächen (14:20)

- Goal: Teil 3 des im Issue dokumentierten Maintainer-Plans (Teile 1/2/4
  lieferte v2.10.0: Loopback-Default in Compose + Engine, Release-Notes).
- Result: PR #2380 (gemergt). README §3 auf die Loopback-Realität
  umgeschrieben; launcher.md-Troubleshooting in allen 8 Locales (widersprach
  der eigenen "Wer die App erreichen kann"-Sektion mit der Vor-2.10.0-
  Behauptung "auf allen Schnittstellen veröffentlicht"); docker-desktop.md
  (8 Locales) + changing-the-port.md (de/en) + developer/deployment.md
  (8 Locales, ADAPTIVE_LEARNER_BIND_ADDRESS als Konfigpunkt) mit kurzer
  Warnung; Installer-TEMPLATES (nicht die generierten Dateien - Falle aus
  dem Issue-Kommentar), Regeneration via make sync-versions.
- Commit: 4457276e (PR #2380)

## 3. #2285 Stale Regel-Behauptung im BACKUP-Abschnitt (14:40)

- Result: PR #2381 (gemergt). quality-checks.md-Coverage-Absatz auf den
  gemessenen Stand: backup-restore.spec.ts lebt (037f9265, #2247), Budget 0;
  manueller Round-Trip deckt den geräte-spezifischen Rest. Korpusneutral
  gekürzt, RULE-CHANGE DECLARED.
- Nachspiel siehe Punkt 9.

## 4. #2279 + #2280 OpenAPI-Paar (15:00)

- Result: PR #2382 (gemergt): Intent-Kommentar an der FastAPI(...)-
  Konstruktion + Pin-Test test_spec_public_while_viewers_debug_gated
  (/openapi.json 200 bei DEBUG=false, /api/docs + /api/redoc 404).
  PR #2383 (gemergt): 17 Dateien über 8 Locales - /api/openapi.json (404)
  auf /openapi.json korrigiert, "Im Dev-Modus"-Framing an die
  #2279-Entscheidung angepasst (Spec immer, Viewer nur Debug).
- Commits: 3a2af3eb (PR #2382), 1be3cb5c (PR #2383)

## 5. #2347 Deployment-Doku beschreibt den Ein-Container-Stack (15:20)

- Result: PR #2386 (gemergt). en/de-Stackblock gegen docker-compose.prod.yml
  neu geschrieben (ein Service app, kein nginx, Default 8501,
  Loopback-Bind); dieselbe Klasse in el/es/ja/pt/tr mitgefixt (ältere
  Kurzform "nginx sidecar" + Port 7880, Launcher-Absätze mit "lokales
  FastAPI auf 7880"); Zähl-Einleitung "Drei Dinge" auf vier korrigiert
  (Folge des in #2380 ergänzten vierten Punkts).
- Follow-up: #2387 für die verbleibende Kurz-Locale-Staleness
  (Modus-Tabelle, v1.20.0-Literal, Tarball-Flow).
- Commit: 303258e7 (PR #2386)

## 6. #2284 Device-only-Limits als benannte Grenzen (15:45)

- Result: PR #2388 (gemergt). docs/developer/testing.md "Device-only
  limits": vier benannte Grenzen (Storage-Eviction/Standalone, iOS
  ~15s-Utterance-Cutoff #1928, echte Sprachsynthese-Engines, iOS-Zoom
  #1569/#1610), Eintrag 1 in der post-#2247-engen Form. Heimat laut
  Maintainer-Entscheidung im Issue: Contributor-Referenz, englisch, kein
  Korpus-Budget. Zusatz: Querverweis-Kommentare setup.ts <->
  import-language-pipeline.spec.ts - der Real-Browser-Gegenbeweis des
  globalen Focus-Patches ist nicht mehr unverlinkt.
- Commit: 38ddbd4d (PR #2388)

## 7. #2281 OpenAPI-Snapshot-Gate (16:10)

- Result: PR #2389 (gemergt). schema/openapi.json committet (127 Pfade /
  158 Operationen / 150 Schemas - exakt die Issue-Baseline);
  scripts/sync_openapi.py mit --check: fällt geschlossen (Snapshot fehlt /
  unlesbar / App bootet nicht), 13/13-Plugin-Assertion VOR dem Vergleich
  (app.yaml.example-Drift-Klasse), info.version-Sentinel gegen
  Release-Churn, Erzeugung über app.openapi() im Lifespan (unabhängig von
  der #2279-DEBUG-Entscheidung). Fünf-Punkte-Gate-Vertrag als
  Subprozess-Tests; make sync-openapi(-check), in make ci aggregiert;
  expliziter ci.yml-Step (testmon-immun, #1620-Klasse);
  checks.yaml-Eintrag. Einziger Schreiber des Pfads (#2265).
- Commit: 7881c2f9 (PR #2389)

## 8. #2367 Lesson-Order-Overlay am Download-Pfad (16:40)

- Result: PR #2393 (gemergt). Zweite Hälfte von #2173: Dexie-Download
  seedet storeImportLessonOrder aus der Manifest-Reihenfolge (Origin
  'import' wiederverwendet - Re-Download darf Quell-Reihenfolge
  auffrischen, Nutzer-Reihenfolge gewinnt); API-Modus: die
  Backend-Listung selbst folgt metadata.lessons (Leftovers sortiert
  hinten, ohne Feld unverändert sortiert). Beide Modi mit je eigenen
  Tests, RED zuerst (#2053-Regel). Testplan A6c in DE + EN
  (TESTPLAN-PFLICHT), gespiegelt an A6b.
- Commit: 420ed3fb (PR #2393)

## 9. #2395 Ratchet-Test latent rot durch #2381 (17:30)

- Problem: Der 5-Zeichen-Netto-Shrink aus #2381 ließ den Korpus unter das
  ungebankte Ceiling fallen; test_no_opportunity_line_when_there_is_no_headroom
  (kopiert den realen Baum, erwartet ihn exakt AUF der Linie) war damit auf
  jedem vollen Backend-Lauf von develop rot - unsichtbar auf dem #2381-PR
  (testmon mappt Regeldatei-Änderungen nicht auf den Test), sichtbar auf dem
  ersten fremden Backend-Job (#2389).
- Result: Issue #2395 + PR #2396 (gemergt): Baseline 289579 -> 289574 über
  den --update-baseline-Pfad des Skripts gebankt.
- Lehre: Eine Korpus-Änderung und ihre Baseline gehören in DENSELBEN PR -
  die Kehrseite der Entscheidung, dass Budgets nicht automatisch nachziehen.
- Commit: d319465e (PR #2396)

## 10. #2286 Norm-vs-State: Zustand raus aus dem Regelkorpus (17:50)

- Result: PR #2397 (gemergt). Die vier verifiziert stalen
  Zustandsbehauptungen werden Zeiger: "currently 28 entities" (gemessen 30,
  CLAUDE.md sagte längst 30 - der Korpus widersprach sich selbst) ->
  Klassenliste; "8 Sprachen ... vollständig übersetzt" (gemessen 11
  Kataloge) -> Katalogverzeichnis (2x, darunter die NORM in
  implementation-workflow.md, deren Befolgung drei Kataloge unübersetzt
  ließ); "~284k Zeichen" -> entfällt (der Wert lebt maschinell gepflegt in
  .corpus-baseline.json). Der Norm-Absatz selbst wurde in den bestehenden
  Single-Source-Block eingeschmolzen statt ihn zu duplizieren. Netto-Shrink;
  Baseline 289574 -> 289556 im selben Commit gebankt (Punkt-9-Lehre sofort
  angewandt).
- Commit: 5b86bb84 (PR #2397)

## 11. Ohne Code geschlossen (verifiziert, nicht angenommen)

- #2278: Release-Freeze vorbei (Tags v2.9.0 + v2.10.0, kein
  release/*-Branch).
- #2104: Docs sind bereits "Option 2" - kein pipx erwähnt (grep leer),
  Gatekeeper/SmartScreen-Vorbehalt samt Checksum-Empfehlung vorhanden;
  Option 1 (PyPI-Publish) bleibt als RM-Entscheidung im Issue dokumentiert.

## 12. Nicht angefasst, mit Grund

- #2311: WIP einer anderen Session im Stash (Lane-Ownership).
- #2043: beide bisherigen Diagnose-Prämissen im Issue widerlegt - braucht
  eine eigene Untersuchungssession, kein Schnellfix.
- #2128/#2125/#2130/#2273/#2335: blockiert auf learn-content-engine
  (stable_id / review-status).
- #2222: braucht Token mit delete:packages (Nutzer-Aktion).
- #1569/#1728: Geräte-Verifikation nötig; #1507: Upstream blockiert;
  #1485: eigenes Großprojekt; #1087: manueller Testplan-Durchlauf;
  #2376/#2306/#2301/#2189/#2187/#2182: Untersuchungs- bzw.
  RM-Entscheidungscharakter.

## Statistik

- 10 PRs gemergt: #2380, #2381, #2382, #2383, #2386, #2388, #2389, #2393,
  #2396, #2397 (davon #2383, #2389, #2393, #2397 durch den Maintainer
  gemergt).
- 10 Issues per Merge geschlossen: #2282, #2285, #2279, #2280, #2347,
  #2284, #2281, #2367, #2395, #2286. Zwei ohne Code geschlossen: #2278,
  #2104. Zwei neue Issues: #2387 (Follow-up), #2395 (selbst verursacht,
  selbst behoben).
- Neue Tests: 5 (OpenAPI-Gate-Vertrag) + 2 (Backend Manifest-Ordnung) +
  2 (Dexie Overlay-Seed) + 1 (OpenAPI-Pin) = 10; Testplan-Abschnitt A6c
  (DE + EN); ein neues CI-Gate (OpenAPI-Snapshot).
- Env-Reparaturen ohne Repo-Änderung: poetry install (manuscript-tools),
  bun install (Engine 0.17.0), Docs-venvs in Worktrees.

## Fragen und Annahmen

- Evidenzbasiert entschieden: Origin 'import' am Download-Seam
  wiederverwendet statt eines neuen 'download'-Origins (gleiche
  Vorrang-Semantik, kein zweiter Mechanismus - im Issue offen gelassen,
  im PR begründet).
- Evidenzbasiert entschieden: API-Modus-Hälfte von #2367 über die
  Backend-Listung statt eines Client-Seeds (die Download-Response trägt
  keine Lesson-Liste; die Listung ist die Naht, an der die Ordnung im
  API-Modus entsteht).
- Scope-Erweiterung dokumentiert: #2347 auf el/es/ja/pt/tr ausgedehnt
  (gleiche Defektklasse), Rest-Staleness als #2387 abgetrennt statt
  still mitzunehmen.
- Keine STOP-Blocker; keine geparkten Fragen in Artefakten.

---

# Nachtrag (Nachmittag): EXP-049-Umsetzung, Landeseite, zwei Live-Funde

## 13. EXP-049 zusammengeführt + Entscheidungen (14:30)
- Original prompt: Zwei unabhängig erarbeitete Auffindbarkeits-Explorationen zusammenführen, Architekten-Entscheidungen eintragen.
- Result: App-Fassung EXP-049 ist Träger (PR #2407); Engine-Fassung verweist (engine PR #126). Entscheidungen eingetragen: Lektionsseiten nur Theoriestufen; ungeprüfte Sets draussen (hängt an #2299); Zahlen ohne Gate raus, mit Gate rein. Erster Wurf als vier Vorgänge #2403-#2406. Nebenkorrektur: "Doku ist DE/EN" war falsch (acht Sprachverzeichnisse).
- Commits: 418394e2 (#2407), f4b264e (engine #126)

## 14. Landeseite (15:30)
- Result: Statische Seite /start/ (DE) + /start/en/ (EN) im Pages-Artefakt neben der App (PR #2411, Issue #2409). Kern wörtlich: "Eine App, die sich dir anpasst, nicht umgekehrt. Du kannst dein Lernmaterial selbst erstellen, mit KI." Keine Zahlen; Ortsentscheidung begründet (Wurzeltausch bräche PWA/Lesezeichen/SW); noscript-Verweis an der Wurzel; Sitemap +2 echte Seiten; Smoke-Spec; Testplan PRIO 9 DE+EN; 4 Katalog-Screenshots.
- Commit: b26d9cb0 (#2411)

## 15. Vorschau-noindex (16:00)
- Result: PR #2413 (Issue #2404): VITE_ROBOTS_POLICY=noindex im Preview-Workflow + Vite-Plugin (src/deploy/robots-policy.ts) schreibt JEDES ausgelieferte HTML auf noindex um + robots.txt Disallow-all; Produktion byte-identisch. 7 TDD-Tests; am Artefakt in beide Richtungen bewiesen. Zwei gefangene Fallen: Rollup-this in Hooks (fail-open vermieden), globale Regex-lastIndex. Nebenfund: repo-weites build/-gitignore verschluckte src/build/ still - Modul nach src/deploy/, am Commit-Stat gefangen.
- Commits: c58c953d + a86194bc + 851a7237 (#2413)

## 16. Live-Fund 1: Draft-Check tot im gebauten Stand (16:20)
- Original prompt: Maintainer-Konsole der Vorschau: "(0 , T.default) is not a function" beim Bearbeiten einer Aufgabe; Paket-Hypothese prüfen, nicht übernehmen.
- Result: Hypothese verifiziert-und-verworfen (tree-kit-Dist ist sauberes ESM). Wahre Ursache: Validator-Generator hoistete Ajvs require('ucs2length').default zu nacktem Default-Import - Vite-Dev-Interop liefert die Funktion, Node-ESM/Rolldown das exports-Objekt (#1620/#2027-Klasse). Nativ reproduziert; Generator interop-fest (Namespace-Import + Funktionsauswahl, laut scheiternd); Test lädt Generat durch echtes node; Artefakt-Probe 0 Fehler. Auslöser: Engine-0.17-Re-Pin zog ajv 8.20. #2385 hatte nur die Meldung verschönert.
- Commit: 10232507 (Issue #2415, PR #2416)

## 17. EXP-049 Erste-Wurf-Serie (17:00-18:30)
- #2417 (Live-Fund 2, Maintainer-Konsole): Materials Sprachwechsler lädt je Alternate <lang>/sitemap.xml - 404. MkDocs-Hook scripts/mkdocs_split_sitemap.py splittet die Wurzel-Sitemap je Sprache (fail-closed, 6 Pins, realer Build: 7x60). Commit 1f3ff5c1 (PR #2418).
- #2403: Vier Set-Zahlen im ausgelieferten Text (Meta/JSON-LD/og/twitter/Hilfe) entfernt, Prinzip statt Zahl; Vitest-Pin als Gate. Ehrlichkeits-Korrektur im PR: docs-Gate war beim Commit rot durch Worktree-venv, nicht Inhalt. Commit 03abdc89 (PR #2419).
- #2405: robots.txt nennt jetzt auch die Doku-Sitemap (480 Adressen); tote /content-Zeile raus; Pin: Sitemap-locs == reale Seiten. Commit 591f25b5 (PR #2420).
- #2406: Verifikation zuerst - hreflang existierte (Sitemap absolut = wirksamer Kanal, Head relativ = unwirksam); Rest war x-default: Hook ergänzt es je Eintrag seitenspezifisch, idempotent (480/60 im realen Build). Commit e486fc36 (PR #2421).

## 18. #2398: Ratchet-Test misst Verhalten statt Repo-Zustand (19:00)
- Result: Der No-Headroom-Pin kopierte den realen Baum und war nur direkt nach einem Banking-Commit grün - jeder legitime ungebankte Shrink (#2091 erlaubt ihn) machte develop für alle Branches rot (heute zweimal; #2395/#2396 bankten das Symptom). Fixture wird jetzt erst auf die Linie normalisiert, dann greift die Verhaltens-Assertion. Beweis beide Richtungen. Damit ist die Vormittags-Reibung strukturell weg, Banken bleibt bewusste Handlung.
- Commit: 372886a9 (PR #2422)

## Nachtrag-Statistik
- 10 weitere PRs gemergt: #2407, #2411, #2413, #2416, #2418, #2419, #2420, #2421, #2422, engine#126; Journal-PR #2402 vormittags.
- 8 weitere Issues geschlossen: #2400-Folge #2403/#2404/#2405/#2406, #2409, #2415, #2417, #2398. Neue Issues: #2409, #2415, #2417 (alle noch am selben Tag geschlossen).
- Bug-Queue am Tagesende: 3 (Untersuchung #2043, Engine-blockiert #2128, Gerätetipp #1569 - vvdiag-Probe wartet auf iPhone-Werte).
