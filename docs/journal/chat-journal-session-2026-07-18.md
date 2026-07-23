# Chat-Journal - Session 2026-07-18

Zwei zusammenhängende Arbeitsstränge: vormittags der Abschluss des
God-File-Burn-downs (#1450), nachmittags eine vom Maintainer-Test
getriebene Bugfix-Kette rund um die Ghost-Content-Wiederkehr-Klasse.

## 1. God-File-Burn-down abgeschlossen (#1450) (Vormittag)

- Original prompt: "weiter" / "ist gemerged, weiter" (Queue-Abarbeitung)
- Goal: die letzten Items des Refactor-Audits #1450 umsetzen
- Result: Session.tsx 724->207 (fünf State-Cluster-Hooks unter
  hooks/session/, #1804/PR #1805), backup.ts 884->26-Zeilen-Hub + fünf
  Concern-Module mit direkten Tests für JEDES Modul (#1806/PR #1807),
  Gate-Härtung (#1801/PR #1802: complexity-baseline LEER, File-Size-
  ERROR 1000->950). Maintainer-Vorgabe eingehalten: direkte Tests für
  jedes extrahierte Modul im SELBEN PR. Abschlussbericht mit allen 11
  Items als Kommentar in #1450, Umbrella geschlossen.
- Commits: PR #1802, #1805, #1807 (squash-merged)

## 2. BACKUP-AKZEPTANZTEST + Umlaut-Slug-Bug (#1808 / PR #1809)

- Original prompt: Screenshot + Console-Dump "7 validation errors for
  Lesson ... tag 'währung' must be slug-safe"
- Goal: Lektion "Die Währung des Geistes" (eigenes Content-Repo) laden
- Result: App-vs-Engine-Strictness-Drift diagnostiziert - das kanonische
  Engine-Schema erlaubt Card.id/Card.tags als plain strings, die App
  erzwang ASCII-Slugs in ZWEI imperativen Schichten (Python schema.py
  `_SLUG_RE`, TS analysis-to-lesson.ts `SLUG_RE`), die das Byte-Paritäts-
  Gate nicht sehen kann. Fix: Lesson-INTERNE Identifier akzeptieren
  Unicode-Kleinbuchstaben (`_is_unicode_slug()` / `\p{Ll}\p{Nd}`-Regex);
  Set-Level-Identifier bleiben ASCII (URLs, Cache-Keys). TDD: RED
  bestätigt, 10 pytest + 2 vitest.
- Commit: PR #1809 (41529da3)

## 3. i18n-Katalog ohne Retry -> gemischte Sprachen (#1810 / PR #1811)

- Original prompt: Screenshot "gemischte locales" + "sowas darf nicht
  passieren"
- Goal: UI auf Deutsch, aber fast alles rendert Englisch
- Result: `useI18n.ts` hatte für den Katalog-Fetch EINEN Versuch mit
  silent catch - ein transienter Fehlschlag (Backend-Neustart) ließ die
  ganze Session auf den Inline-Fallback-Strings ("Fortschritt"/
  "Einstellungen" deutsch, Rest englisch). Fix: Capped-Backoff-Retry
  (1s/2s/4s/8s/16s, bei Unmount/Sprachwechsel abgebrochen), jeder
  Fehlschlag + Give-up per console.warn geloggt. 4 neue vitest mit
  frischem Modul-State pro Test.
- Commit: PR #1811 (ce48105a)

## 4. .alk-Import im Server-Modus (#1812 / PR #1813)

- Original prompt: "das ist falsch ich will im servermodus meine
  ki-schlüssel trotzdem importieren können"
- Goal: verschlüsselte Schlüsseldatei auch im API-Modus importieren
- Result: KeyVaultSection gatete BEIDE Hälften auf Dexie. Nur Export ist
  echt server-seitig (Klartext verlässt das Backend nie); Import nutzt
  denselben `setApiKey`-Pfad wie manuelle Eingabe. Fix: Import-Formular
  rendert im API-Modus, Export-Hinweis bleibt; toter i18n-Key
  `api_disabled` durch `api_export_disabled` ersetzt (11 Kataloge).
- Commit: PR #1813 (c5cf6c50)

## 5. Snap-XDG-Falle: DB pro Snap-Revision gestrandet (#1814 / PR #1815)

- Original prompt: "manches funktioniert trotzdem nicht" + Profil-404 +
  "wieso wird das nicht von unseren tests abgefangen?"
- Goal: Dashboard-404s nach den Neustarts erklären
- Result: Der VSCode-Snap-Terminal schreibt `XDG_DATA_HOME` auf
  `~/snap/code/<revision>/` um - die DB lag PRO SNAP-REVISION getrennt
  (251 mit Juni-Daten gestrandet, 252 live), der kanonische Pfad
  existierte nie; jeder Snap-Refresh bootete eine leere DB. Warum kein
  Test das fing: das Stabilitäts-Verhalten war nie spezifiziert. Fix:
  `_strip_snap_sandbox()` in paths.py (Snap-Präfix wird verworfen,
  Warning geloggt; explizite ADAPTIVE_LEARNER_*_DIR-Overrides gewinnen
  wörtlich), 7 TDD-Tests. Operative Recovery: Live-Daten von snap/252
  nach `~/.local/share/adaptive_learner/` kopiert (nichts gelöscht,
  beide Snap-Verzeichnisse bleiben als Sicherung).
- Commit: PR #1815 (9a8f97d2)

## 6. Availability-Oracle ignoriert cached_version (#1816 / PR #1818)

- Original prompt: "aber warum wird das herangezogen wenn 404?" /
  "das ist alles nicht uxui freundlich" / "der user benutzt das und
  sagt drecksapp"
- Goal: tote Weitermachen-Karten + 404-Rauschen für nicht geladene Sets
- Result: Das #1445-Oracle nahm an "listSets = ladbar" - stimmt nur im
  Dexie-Modus; der API-Index listet registrierte Repos auch OHNE
  Download (`cached_version: null`). Die Oracle-Tests waren grün gegen
  ihre eigene falsche Spezifikation (handgebaute Fixtures). Fix:
  `cached_version: null` zählt nicht als ladbar; `USER_GENERATED_SOURCE`
  aus dem Always-Available-Shortcut entfernt (Exact-Hit deckt echte
  Sets, Geister werden versteckt, Zeilen nie gelöscht). Tests pinnen
  jetzt die ECHTE ContentSetEntry-Shape.
- Commit: PR #1818 (ba22ac66)

## 7. Lessons-Learned: die Wiederkehr-Klasse gepinnt (PR #1820)

- Original prompt: "das war schon mal ein thema und ist nicht nach
  meinen vorgaben vorgegangen deswegen tritt das wieder auf"
- Goal: dritte Wiederkehr der Ghost-Content-Klasse dauerhaft verhindern
- Result: Neue Regel in lessons-learned.md - Cross-Layer-Annahmen gegen
  ECHTE Datenshapes pinnen (nie handgebaute Minimal-Fixtures), jede
  Dual-Storage-Invariante explizit pro Modus prüfen, Content-Lifecycle-
  Operationen müssen ALLE Residue-Flächen aufzählen (DB-Zeilen,
  FS/IndexedDB-Cache, SW-Cache, localStorage), eine Wiederkehr öffnet
  die KLASSE (Kette verlinken, Original-Tests erweitern).
- Commit: PR #1820 (1a566b7d)

## 8. Repo-Entfernung: Löschabfrage nur im Dexie-Modus (#1821 / PR #1822)

- Original prompt: "Wenn ich ein repository entferne soll abgefragt
  werden was gelöscht wird, hatten wir mal ist aber wieder weg"
- Goal: #1445-Part-B-Dialog (Zählung + Opt-in-Löschung) im Server-Modus
- Result: Doppelt gegated (handleRemove Early-Return + ApiStorage-Throw)
  -> im API-Modus Dialog ohne Zahlen, Opt-in löschte still nichts. Fix:
  neuer Endpoint `POST /users/{id}/learning-data/delete` (atomar,
  user-scoped, Repository-Pattern EXP-024: `delete_by_ids` /
  `delete_by_set_ids`), ApiStorage ruft ihn statt zu werfen, beide
  Dexie-Gates entfernt (OrphanedDataSection ebenfalls). TDD: 5 pytest
  (inkl. Fremd-User-Boundary) + Delegation + Section-Test.
- Commit: PR #1822 (e0b51245)

## 9. Set-Löschung räumt nicht auf (#1819 / PR #1825)

- Original prompt: "Es wird nicht richtig gecleaned wenn man was löscht"
- Goal: Löschen eines Sets hinterlässt Fortschritt/SRS-Zeilen UND der
  Workbox-SW-Cache serviert gelöschte Lektionen weiter
- Result: `planSetDataDeletion` (Karten nur, wenn keine ANDERE Quelle
  die Set-Id noch liefert), neues `sw-lesson-cache`-Modul
  (`purgeSetFromLessonCache`, fällt offen), Delete-Dialoge (einzeln +
  bulk) mit geteilter `DeleteProgressOption`-Checkbox (echte Zahlen,
  Default aus), SW-Purge bei JEDER Löschung inkl. eigener Lektionen,
  Löschung über das modus-agnostische `learningData.deleteLearningData`.
  Delete-Komponenten nach `browser/delete/` gruppiert (Folder-Gate).
  i18n 2 Keys x 11 Kataloge. 16 neue Tests.
- Commit: PR #1825 (9ed85fd4)

## Probleme + Entscheidungen

- **Merge-first-Round-trip**: Der BACKUP-AKZEPTANZTEST lief auf
  Maintainer-Anweisung NACH dem Merge auf develop; Nachweis als
  Kommentar an PR #1807.
- **Backend-Neustart-Kaskade**: Der uvicorn-Reloader übernahm den
  #1815-Fix live und legte eine frische leere DB am kanonischen Pfad
  an, während die Recovery-Kopie lief - Reihenfolge ab jetzt: erst
  Prozesse hart stoppen, dann Daten bewegen, dann starten.
- **i18n-Anchor-Fehlgriff**: Die neuen Keys landeten zuerst unter
  `imports.delete_confirm` (erster Regex-Treffer) statt
  `content.set_status` - vor dem Commit erkannt und in allen 11
  Katalogen verschoben. Anchor-Patches immer gegen den vollqualifizierten
  Pfad prüfen.
- **#1817 (Checkbox-Größen)** parallel von CCW umgesetzt.

## Statistik

- 8 gemergte PRs: #1802, #1805, #1807, #1809, #1811, #1813, #1815,
  #1818, #1820, #1822, #1825 (11 inkl. Vormittag)
- Geschlossene Issues: #1450 (Umbrella + Abschlussbericht), #1776,
  #1780, #1782, #1799, #1801, #1804, #1806, #1808, #1810, #1812,
  #1814, #1816, #1819, #1821
- Testsuiten am Sessionende: Backend 1429, Vitest 7433 - alle grün;
  jede Änderung TDD mit bestätigtem RED
- Kern-Erkenntnis (als Regel gepinnt): Module, die die Ausgabe einer
  anderen Schicht konsumieren, müssen deren ECHTE Shape in den Tests
  pinnen; Dual-Storage-Invarianten pro Modus prüfen; Lifecycle-
  Operationen über alle Residue-Flächen denken.

## Fragen und Annahmen

- Annahme: Die Juni-Daten in `~/snap/code/251/` bleiben als Sicherung
  liegen (nicht gelöscht, nicht migriert) - bei Bedarf manuell
  wiederherstellbar.
- Annahme: `DeleteLessonModal` (eigene Lektionen) bekommt KEINE
  Opt-in-Checkbox - eigene Sets verschwinden nach Löschung aus
  listSets, das Oracle versteckt ihren Fortschritt; SW-Purge läuft
  trotzdem. Bei Bedarf als Follow-up nachziehbar.

## Release v2.4.0 (über die GH-Release-Workflows)

- Ausgangspunkt: Statusbericht seit v2.3.0 (44 Commits, 8 Features)
  -> Empfehlung Minor v2.4.0 -> Freigabe zum Schneiden.
- `release/2.4.0` von develop geschnitten: Version-Bump 2.3.0 -> 2.4.0
  (`make sync-versions`, 19 Dateien), `changelog/releases/v2.4.0.md`,
  Version-Pins verifiziert. Getrieben über `release-prepare.yml` (Gate)
  + `release-finish.yml` (Merge/Tag/Publish), nicht lokal.
- Der erste ECHTE `release-prepare`-Gate-Lauf hat sechs vorbestehende
  Blocker aufgedeckt (keiner aus dem Version-Bump; alle #1661-Klasse -
  nightly/release-only-Gates, die in der PR-CI nicht laufen):
  1. `oven-sh/setup-bun@v2` scheitert am fehlenden `unzip` im
     Playwright-Noble-Image -> `unzip` zur apt-Zeile ergänzt (#1829;
     `dexie-smoke.yml` dokumentierte die Klasse bereits).
  2. Docs-Versions-Badges/Header noch v2.3.0 -> `verify_docs.py --fix`.
  3. Schema-Mirror-Drift: #1774 pinnte die Engine auf 0.13.0/Schema 1.8,
     liess aber App-`CURRENT_SCHEMA_VERSION` auf 1.7 -> Bump 1.7 -> 1.8
     + `make sync-schema` regeneriert (#1830, vervollständigt #1774;
     Major-Match = rückwärtskompatibel, 326/326 content-loader-Tests
     grün).
  4. `verify-plugin-locks`: proaktiv geprüft, sauber.
  5. `test-dexie-smoke` seit 07-15 rot: der #1765 AI-Tab-Import-Sprung
     scrollt nicht zum `key-vault-import`-Block, weil der Single-rAF-
     Scroll VOR dem async `KeyVaultSection`-Layout feuert und
     `pendingScroll` unbedingt geleert wird -> bounded Retry-bis-im-
     Viewport statt Single-rAF (#1831; tsc + Settings-vitest 58/58 grün).
  6. Advisory `test-e2e-smoke` (API-Mode) 21/42 rot = dokumentierter
     #1254-Cold-Start-Flake -> per `skip_e2e=true` übersprungen (wie
     `release.yml` es standardmässig tut; das mandatorische
     `make release-test` inkl. dexie-smoke war grün).
- `release-finish` erfolgreich: Tag `v2.4.0` (`eecca632`) auf main,
  Back-Merge nach develop (zieht #1829-#1831 nach, macht die Nightly
  wieder grün), GitHub-Release publiziert, Launcher-Binaries angehängt.
- Lesson (Ergänzung zur #1661-/„wired != working"-Klasse): der erste
  echte Lauf eines lange „verdrahteten, nie ausgeführten" Gate-Workflows
  (`release-prepare.yml`, Header: „NOT used for v1.97.0 ... effective
  from the next release") deckt latente Infra- UND nightly-only-
  Produktregressionen gemeinsam auf.
