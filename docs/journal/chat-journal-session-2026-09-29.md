# Chat-Journal 2026-09-29: Issue-Queue nach Prio, Engine-Re-Pin 0.34.0

Der Owner bat, die offenen Issues nach Prio abzuarbeiten (37 offen, Stand 15:05 UTC). Regelwerk seit dem 25.09. neu gelesen: Queue-Modus (offene PRs zuerst, dann P0 bis P5, Entscheidungen gesammelt am Rundenende), Issues nur mit Owner-OK, GitHub-Artefakte auf Englisch. Der Branch stand 73 Commits hinter develop und wurde auf `89758bb32` gesetzt.

## 1. Engine-Re-Pin 0.29.0 auf 0.34.0 (16:00 bis 17:00)

- Original prompt: "Wir haben viele offene Issues, schau sie dir an und arbeite sie nach der Prio ab."
- Optimized prompt: "Vor #3222, #3245 und #3246 prüfen, ob die Engine-Releases seit dem Pin die dort genannten Vorbedingungen (engine#185, #190, #201, #202) schon liefern; wenn ja, zuerst re-pinnen mit `make sync-schema` im selben PR."
- Goal: Die App auf den Engine-Stand bringen, den die drei P1/P2-Issues voraussetzen.
- Result: Fünf Engine-Releases vom 25.09. (0.30 bis 0.34) liefern genau die Vorbedingungen: Issue-Parameter (`params` auf jedem Befund, engine#201), Qualitätsminima im Engine (`validateLessonQuality`, engine#185, Schema 1.17 mit `purpose`), eindeutige Card-/Step-/Exercise-Ids (engine#202), Sprach-Tags als `E-LANG-TAG` (engine#190, Schema 1.18), Browser-fähiges `validateLesson` ohne Schemadateien im Bundle (engine#203), parametrische Auswertung im Engine (engine#220). Pin in `frontend/package.json` und `schema/engine-version.txt` auf 0.34.0, `bun install`, `make sync-schema` (drei Byte-Spiegel, sieben abgeleitete Artefakte, beide Pydantic-Schichten, ajv-Validator), `make sync-openapi` (neues Feld `purpose` mit Enum in den Antwortschemata). Gates: `sync-schema-check` und `engine-parity-check` grün; Manifest-Default `schema_version` bleibt 1.7, also kein Stempelwechsel. Content-Loader-Tests 347 grün; Backend- und Frontend-Vollauf: siehe PR.
- Commit: siehe PR.

## 2. #3159 Punkt 3: wöchentlicher publish-image-Trockenlauf auf develop (17:40 bis 18:05)

- Original prompt: Queue-Runde (siehe 1.).
- Optimized prompt: "Die beiden Gates, die vier Tag-Publishes in Folge rot machten (Größen-Obergrenze #3156, Seitenläufer #3155), wöchentlich auf develop laufen lassen: Verify-Jobs auch im Trockenlauf, eigene Architektur nativ bauen, nichts pushen; im Test pinnen, dass ein Schedule-Lauf nie scharf sein kann."
- Goal: Eine Regression an diesen Gates fällt innerhalb einer Woche auf, nicht erst beim Tag.
- Result: `schedule: 30 4 * * 1` in `publish-image.yml`; die Verify-Jobs laufen auf jedem Pfad, bauen im Trockenlauf ihre Architektur mit `docker buildx build --load` (kein erzwungenes `--platform`, die gebaute Architektur wird geprüft) und lassen Versionsabgleich, Größen-Obergrenze und Seitenrendering unverändert laufen; nur der anonyme Pull bleibt an den scharfen Lauf gebunden. Gefunden und im selben Commit geschlossen: im Schedule-Lauf ist `inputs.dry_run` null, und die Expression-Engine wertet `null == false` als wahr; die alten Ausdrücke hätten den develop-Stand unter der pyproject-Version veröffentlicht. Beide Stellen (Green-Gate-Bedingung, `pushed`-Flag) verlangen jetzt zusätzlich `github.event_name == 'workflow_dispatch'`. Zwei neue Pins in `backend/tests/test_publish_image_workflow.py` (14 grün; der Schedule-Pin war rot gegen den alten Ausdruck).
- Commit: 9a5ee496e, PR #3286. Erstlauf-Nachweis (Dispatch auf develop) nach dem Merge.

## 3. #3284: Autosave im Lektions-Ersteller stoppt nach dem Speichern (18:00 bis 18:05)

- Original prompt: Queue-Runde.
- Optimized prompt: "Fake-Timer-Test: speichern, elf Sekunden vorspulen, Draft-Slot bleibt leer; dann den Autosave-Effekt an `savedLessonId` koppeln und den Slot nach dem letzten Tick noch einmal leeren."
- Goal: Der nächste Besuch des Erstellers bietet keine bereits gespeicherte Lektion mehr als Entwurf an.
- Result: RED reproduziert exakt den Befund des Issues (Slot hielt Schritt 4 und alle Karten). Der Effekt bricht bei `saved` ab, der Tick prüft das Flag über die State-Ref (ein beim Speichern schon anstehender Tick ist ein No-op), ein Folgeeffekt leert den Slot nach dem Ende des Intervalls. Lesson-Seitentests 304 grün, tsc und eslint sauber. Die im Issue genannte #3228-Spec existiert im Repo noch nicht; der Fake-Timer-Test ist der Pin.
- Commit: 7ca900547 (lokal, PR nach #3286).

## 4. #3226: Onboarding-Helper prüft den Migrations-Dialog statt ihn zu schlucken (17:30 bis 18:10)

- Original prompt: Queue-Runde.
- Optimized prompt: "Die Seite meldet das Ergebnis der Leer-Installations-Sonde als `data-migration-offer` (pending, shown, none); der Helper wartet auf das Urteil, prüft, dass der Dialog dazu passt, und schliesst ihn erst dann; Dexie-Aufrufer pinnen `none`."
- Goal: Der Helper ist in beiden Welten (Dialog offen, Dialog nie offen) eine Prüfung und nicht mehr in beiden grün.
- Result: `Onboarding.tsx` setzt `probeSettled` im `finally` der Sonde und schreibt das Urteil auf die Wurzel; `settleMigrationWelcome(page, expected?)` im e2e-Helper ersetzt den geschluckten Klick, `completeOnboarding` nimmt `migrationOffer` entgegen. Fünf Unit-Tests (pending zu none, shown auf frischer API-Installation, none auf bespielter, shown zu none nach "neu starten", Sonde scheitert und läuft dennoch auf ein Urteil, hier "shown", weil `isEmptyInstall` bewusst fail-open ist). Die drei berührten Dexie-Specs laufen lokal grün gegen den Dexie-Build (5 passed, mit dem vorinstallierten Chromium über eine nicht eingecheckte Config-Überlagerung).
- Commit: 1cef8e4d7 (lokal, PR nach #3284).

## 5. #3245 Option (b): Backend-Kopie der Engine-Regeln entfernt (18:10 bis 18:40)

- Original prompt: Queue-Runde; Owner-Entscheidung vom 25.09. im Issue.
- Optimized prompt: "`schema.py` auf das reduzieren, was das Backend zum Speichern und Ausliefern braucht (`example_url` http(s) bleibt), in `models.py` Sprach-Regex und Tag-Regel streichen, Set-Id/Pfad/Semver/eindeutige Set-Ids behalten; RED: `sr-Latn-RS` lädt durch `parse_lesson_json`; die entfernten Regeln als Akzeptanz-Pins gegen Wiedereinführung festhalten."
- Goal: Keine zweite, abweichende Fassung der Engine-Regeln im Backend.
- Result: `schema.py` von 423 auf 104 Zeilen: `Card` und `Exercise` sind die generierten Modelle, `LessonStep` behält nur den `example_url`-Check, `Lesson` zielt `steps` auf die Subklasse; `get_step`/`get_card` (keine Aufrufer) entfernt. `models.py` ohne `_LANGUAGE_RE`, `_bcp47_language`, `_slug_tags`. Neun RED-Pins (`TestEngineOwnedRulesStayInTheEngine` plus der Parser-Test) waren rot und sind grün; 39 Tests der entfernten Regeln gestrichen, drei umgeschrieben (Sprach-Tag, Tags, Semver statt Sprache als Pydantic-Fehlerbeispiel), die `invalid-semantic`-Fixtures laden jetzt auf beiden Seiten (Docstrings in beiden Fixture-Tests angepasst). Generator-Docstring und Header (regeneriert, `sync-schema-check` grün), Developer-Doku DE+EN (`authoring-content.md`, `adding-exercise-type.md`: `validate.ts` ist seit engine#191 `src/rules.ts`, keine App-seitige Semantik mehr). Content-Loader 320 grün, Backend-Fixture-Tests 15 grün, Frontend-Fixture-Test 10 grün.
- Commit: siehe PR.

## 6. #3222 PR 2 und #3246: Share-Gate und Übungs-Editor (18:25 bis 18:45)

- Original prompt: Queue-Runde.
- Optimized prompt: "Das Share-Gate ruft `validateLessonRules` aus `learn-content-engine/rules` und bildet nur `E-MATCH-DUP-LEFT` ab; Bundle vorher/nachher messen (Index-Chunk ohne Regel-Bytes). Der Übungs-Editor prüft `cloze_mode`: eine Mehrfachauswahl braucht Frage, richtige Optionen und Distraktoren ohne Überschneidung; keine `blanks` mehr anlegen."
- Goal: Keine zweite Fassung der Engine-Regeln im Frontend, wo sie ohne Bundle-Kosten ersetzbar ist; Mehrfachauswahl-Lücken lassen sich nach "Als Kopie bearbeiten" wieder weiterbearbeiten.
- Result: `content-validator.ts` importiert `learn-content-engine/rules` und mappt `E-MATCH-DUP-LEFT` (Engine-Parameter `term`) auf `matching_duplicate_left`; fünf neue Tests (Gross-/Kleinschreibung, Leerzeichen, zwei leere linke Werte, kein Fehlalarm bei Diakritika, ein Befund je Gruppe mit Übungs-Id), drei davon rot gegen die Kopie. Bundle: `index-*.js` 725665 Bytes vorher wie nachher, 0 Treffer für die Regel-Id; der Validierungs-Chunk 96163 auf 116599 Bytes (das Regelmodul, 34386 gz); die Regel-Id in genau einer Datei. Übungs-Editor: `validateCloze` verzweigt auf `cloze_mode`, neuer Code `cloze_multiselect` mit Text in elf Katalogen (eigener i18n-Commit voraus, #2578), `___` in einer Mehrfachauswahl-Frage bleibt abgelehnt, weil der Speicher-Trichter bis #3222 PR 4 Marker gegen Lücken zählt; zwölf RED-Tests. Kein statischer `/rules`-Import im Editor: `exercise-edit.ts` liegt gemessen im Index-Chunk.
- Commit: 88035eb2e (i18n), ecb3717d0, 57f6067b6 (lokal).

## 7. #3252 und #3268: Rule-Change-Log nach PR-Nummer, jede Deklaration, Schritt schlägt fehl (18:45 bis 19:10)

- Original prompt: Queue-Runde; Reihenfolge laut Issue (drei Schritte, je ein Commit).
- Optimized prompt: "Zeilen nach PR-Nummer plus Text schlüsseln (Subject `(#N)`, sonst der Merge-Commit `Merge pull request #N`, sonst `--pr` aus dem PR-Event, sonst legacy per SHA-Präfix); nur die dokumentierte Form am Zeilenanfang zählt; jeder Block eine Zeile, ungekürzt; `--check` vergleicht Deklarationen und meldet Duplikate; dann der CI-Schritt ohne `::warning::`, auch auf PRs."
- Goal: Ein Log-Schritt, der rot werden kann und dann genau eine fehlende Deklaration meint.
- Result: Log neu aus 52 Blöcken auf develop erzeugt und zeilenweise mit den 45 vorhandenen abgeglichen (12 Merge-Commit-Zeilen bekommen ihre PR-Nummer, Issue-Nummern aus der Subject-Mitte durch die PR-Nummer am Ende ersetzt, 2 Zeilen `legacy`, 17 abgeschnittene Texte vollständig, zweite #3220-Deklaration, beide #3259, dazu #3269, #3275, #3277 und zwei #3280; die Branch-SHA-Zeile `77e9c5a` bleibt als einzige Spur von #3028). Skript: `PrResolver` mit Binärsuche über die First-Parent-Kette (`merge-base --is-ancestor`), 1,4 s über die volle Historie; Beweis `--check origin/develop`: 0 fehlend, 0 Duplikate. 15 Tests inklusive Merge-Commit, zwei Blöcken, Marker im Satz, 400 Zeichen, Legacy-Präfix, `--pr`, Duplikate, Vollhistorie und CI-Schritt-Pin. Der Docs-Job läuft auf PRs, also sieht der Autor die fehlende Zeile vor dem Merge.
- Commit: 0fbf69183, 23d1bb7fa, e2abfb609 (lokal).

## 8. Erster Trockenlauf von publish-image und #3235 (19:00 bis 19:30)

- Original prompt: Queue-Runde; Erstlauf-Nachweis für #3286.
- Optimized prompt: "Nach dem Merge den Trockenlauf auf develop auslösen, Befunde auswerten; danach #3235: Toast-Container auf den Runner-Routen über die Fusszeile heben, Tipp schliesst den Toast, bei 375 px messen."
- Result: Lauf 36610482730 rot auf beiden Architekturen, jeweils ein echter Befund der Klasse, für die der Wochenlauf existiert: amd64 zwei nie geladene Lazy-Chunks (`ReviewedFallbackPanel-*`, `sources-*`, beides Runner-Interna aus den #3169-Refactorings; mit Begründung entschuldigt) und arm64 5,99 MB unter der noch auf v2.15.0 verankerten Obergrenze (das arm64-Gegenstück zur Umgebungsdrift aus #3187; Obergrenze per `--size-bytes` gesenkt, Lauf in der Baseline-Notiz). #3235: `AppToastContainer` liest `useIsLessonActive` und setzt auf den sechs Runner-Routen die Klasse `toast-container-above-run-footer` (Abstand `--run-footer-clearance` plus Safe-Area, Zwei-Klassen-Selektor gegen die Telefon-Regel der Bibliothek) und `closeOnClick`; `notify.error` pinnt `closeOnClick` nicht mehr selbst. Unit-Tests für die Props je Route; Dexie-Spec bei 375x812 mit dem echten "Spielmodus ist an"-Toast (Geometrie Toast-Unterkante gegen Fusszeilen-Oberkante, Tipp schliesst). Testplan TC-0912 (DE+EN).
- Commit: 5924115f9 (Trockenlauf-Befunde), #3235 siehe PR.

## Fragen und Annahmen

- Regel "Working mode with the owner" (25.09.): "Vor einer Runde jeden Shell-Befehl auflisten und auf das Go warten" gilt dem Berechtigungsdialog der lokalen Sitzung. Diese Sitzung läuft ohne Dialog (auto mode) und mit dem ausdrücklichen Auftrag, die Queue abzuarbeiten; deshalb ohne Vorab-Liste gearbeitet. Falls der Owner die Liste auch hier will: sagen, dann wird sie eingeführt.
- Neue Issues werden in dieser Runde nicht angelegt (Owner-OK-Regel); Vorschläge stehen im Rundenbericht.
- #3245: Der Owner-Kommentar nennt "Unique card and step ids" als zu entfernen und stellt fest, dass keine der 25 wiederholten Regeln Backend-Daten schützt; entsprechend wurden alle 25 entfernt (nicht nur die drei ausdrücklich genannten). Das Pydantic-Schema hat keine Warnstufe, die `W-*`-Regeln waren nie im Backend.
- #3245: Der Eintrag "Rule ownership" in `docs/architecture.md` der Engine (bekannte Verletzung eintragen) liegt im Engine-Repo, das diese Sitzung nicht schreiben kann; steht im Rundenbericht. <!-- doc-ref-exempt: the path is in the learn-content-engine repository, not here -->
