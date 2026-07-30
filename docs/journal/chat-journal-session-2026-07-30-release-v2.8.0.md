# Chat-Journal Session 2026-07-30 (Teil 2) - Release v2.8.0

Fortsetzung der CC-Spur nach dem Launcher-image-mode-Journal. Ergebnis:
v2.8.0 ist das erste Release der Linie, das Nutzer erreicht - Image,
Binaries und Archive, mit vollstaendig gruener Publish-Kette.

## 1. Release-Anlauf v2.7.0: Tag ohne Artefakte

- `make release-test` fand die stalen README-Badges (Gate arbeitete);
  Smoke-Gate-Forensik ergab: die `--project=smoke`-Suite lief bei v2.6.1
  NIE (Journal listet nur dexie-smoke + manual-automation) - der Haken
  war ein Generalisierungs-Fehlgriff, kein kaputtes Gate.
- Smoke-Suite wiederbelebt (#2170): fuenf Stale-Klassen (Migrations-
  dialog nach RR8, Settings-Tabs, doppelter Continue, stale Settings-API,
  Landing vs. Identity-Recovery via echtem /api/reset) -> 37 passed /
  6 deklarierte Skips unter Budget-Gate (backend/tests/
  test_smoke_skip_budget.py, alle Stilllegungs-Schreibweisen, RED-bewiesen).
  Der a11y-Audit fand sofort einen echten Kontrastbruch: unlayered
  Anker-Farbregel schlug jede Klassen-Ankerfarbe in gelayerten Tranchen
  (#2175, via CDP bewiesen, Fix: Regel in die frueheste Layer).
- v2.7.0 getaggt + publiziert - und alle vier Publisher verweigerten:
  `could not read the check status: gh: Not Found (HTTP 404)`. Wurzel
  #2178: `gh api` loest den nackten commits/<sha>-Pfad NIE gegen das
  Repo auf; das #2145-Gate konnte unter release-Events nie lesen.
  Fail-closed korrekt; v2.7.0 blieb leerer Tag (dokumentiert, Seite
  verweist auf v2.8.0).

## 2. v2.7.1: vier Iterationen, dann Reversion

Gate-Fix (GITHUB_REPOSITORY-Default + 4 Regressionstests) + Pin 0.24.0
-> 0.25.0 -> 0.25.1 (Pruefpunkte am Frozen-Binary: Marker armiert ohne
Schutz-Notiz, CLI ohne Sperre) + Badges + eingefaltete develop-PRs
(#2171 Recovery, #2176 Reorder). Der Release-Manager stoppte vor dem
Sichtbarwerden: Patch-Nummer fuer Feature-Inhalt = falsch etikettiert
(dieselbe Minor-Regel wie bei 2.7.0), und die formale Trennung
Recovery/Installationsweg war substanzlos, weil v2.7.0 nie auslieferte.
**Reversion auf v2.8.0** (Entscheidung A, zustandsgetriebene
Begruendung in Notes + Commit), REC-JKZ mit dokumentierter Aufloesung
archiviert - der uebergangene Round-Trip ist jetzt Geraete-Pflichtpunkt
A1b mit vordefinierter Konsequenz (Patch, kein Rollback).

## 3. v2.8.0: fuenf Tag-Iterationen bis zum sauberen Flow

Iterationen durch bewegliches develop (CCW-Merges) + zwei Gate-Funde
(Lessons-Inventar-Baseline aus #2186 - die zwei neuen Sektionen
beschreiben exakt die Falle, die sie ausloesten; Trigger-Pin) + der
Publish-Flow-Umbau: Draft feuert `created` NICHT (beobachtet, 20s /
0 Laeufe), `published` wuerde die Kette beim Sichtbarschalten erneut
bauen (nicht bitgleich, ~48k Drift) -> **Option 1**: kein release-
Trigger mehr, Kette on demand, Gate Pflicht im scharfen Dispatch,
Scanner selbstidentifizierend (Gate-Aufruf statt Trigger-Text, der
zweimal am Tag brach). Option 2 (idempotente Kette) als #2187 beim
Release-Manager-Wunsch. Step 8 traegt Sequenz + Fussangel +
Vollstaendigkeits-Pruefpunkt (deklariert, geloggt).

## 4. Die Kette, Station fuer Station (Run 30548288561)

- Vorbedingung: `release precondition: 10 check(s) considered` - gruen.
- Push: `ghcr.io/astrapi69/adaptive-learner:2.8.0`, Digest
  `sha256:102e488a...`; Paket oeffentlich (anonymer Manifest-GET 200).
- Anonymer Pull nativ je Arch; arm64 real gestartet, `/api/health` ->
  `2.8.0`; Dreiklang Tag/Image/Health je Arch bestanden.
- Groessen-Gates: amd64 125.668.464 (66.106 ueber Ceiling, innerhalb
  der benannten 2-MB-Jitter-Toleranz), arm64 124.288.511 (Headroom
  428.175).
- Assets: 3 Binaries + 3 sha256 (Artefakte der gruenen main-Builds,
  NICHT neu gebaut), 2 Archive + 2 sha256 (RepoTags-validiert - ein
  Digest-Save traegt kein Tag und wuerde den Launcher-Archivpfad
  brechen; per Re-Tag geloest). Pruefpunkt 10/10, dann sichtbar -
  und beim Sichtbarschalten feuerte nichts.

## 5. Nebenbefunde

- Fremder Port-Squatter (openhands-automation auf 18001) liess
  Playwright den falschen "Backend"-Server wiederverwenden (404 = ready)
  - in #2170 als reuseExistingServer-Haertung vermerkt.
- `debug:true` im nackten Container (`/api/health`) - Launcher/Compose
  setzen false; App-Default pruefenswert (kein Issue-Traeger heute, im
  Endbericht genannt).
- Tracker-Konsistenz (eigener Auftrag): css-size-Baseline landete
  huckepack in #2174 waehrend PR #2181 closed-not-merged blieb; #2110
  geschlossen; Rest sauber. Node20-Sweep: #2169 via PR #2195.

## Statistik

Tags: v2.7.0 (leer, dokumentiert), v2.7.1 (geloescht, nie released),
v2.8.0 (live, 10 Assets). PRs heute: #2164, #2166, #2167, #2168, #2194,
#2195 + Hotfix-/Release-Merges. Issues: #2163, #2165, #2178 zu; #2169
via PR; #2170, #2175, #2177, #2182, #2187 offen mit Traegern. Kette:
Run 30548288561 komplett gruen.
