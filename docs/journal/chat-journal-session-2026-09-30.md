# Chat-Journal 2026-09-30 (Runde 3)

Fortsetzung der Queue-Arbeit aus `chat-journal-session-2026-09-29.md`: die aus der Ferne bearbeitbaren Issues nach Priorität, mit den am Rundenende vom Owner freigegebenen Empfehlungen (#3222 PR 5 klein halten, #3216 Punkt 2 als disabled-mit-Grund, #3237 Zähler in den Fuss, #3163 pt-BR, #3173 Variante 3, #3253 kein Pflicht-Check, #3151 heute, #3254 Option 1).

## 1. #3316: der Smoke-Lauf kann das laufende Backend des Entwicklers nicht mehr zurücksetzen (06:40 bis 07:10)

- Original prompt: "Gehe alle an, die aus der Ferne gemacht werden können, mit deinen Empfehlungen."
- Optimized prompt: "`e2e/playwright.config.ts`: eigene Standard-Ports (nicht das `make dev`-Paar 18001/15174) und `reuseExistingServer: false` für beide Server; dasselbe für den Backend-Eintrag der Docs-Konfiguration; Pin in `backend/tests/test_e2e_path_isolation.py`: jede Konfiguration, die uvicorn startet, hat andere Standard-Ports als das Makefile und verwendet kein fremdes Backend wieder. Option 3 des Issues (`/api/reset` verweigert auf Produktionsverzeichnis) verworfen: der Endpunkt ist die Gefahrenzone in den Einstellungen, also eine echte Nutzerfunktion."
- Goal: Ein lokaler Smoke-Lauf bei laufendem `make dev` trifft nie die echte Datenbank unter `~/.local/share`.
- Result: RED zuerst (beide Pins rot: Port 18001 gleich Makefile, `reuseExistingServer: !process.env.CI`). Fix: Smoke-Ports 18021/15194, beide Einträge `reuseExistingServer: false` (Kosten: ein kalter uvicorn-Start lokal, etwa zehn Sekunden); Docs-Konfiguration behält 18011, ihr Backend-Eintrag ebenfalls `false`. Fünf Tests grün, beide Konfigurationen kompilieren (`--list`: 45 und 3 Tests). Die anderen sieben Konfigurationen starten kein Backend (vite preview), darum nicht betroffen.
- Commit: siehe PR.

## 2. #3222 PR 5: der Share-Gate meldet jede Engine-Regel (07:10 bis 07:50)

- Original prompt: "Gehe alle an, die aus der Ferne gemacht werden können, mit deinen Empfehlungen." (Empfehlung für PR 5: klein, nur die verbleibende lokale Prüfung ersetzen, nichts Neues.)
- Optimized prompt: "Zuerst ein i18n-PR mit `content.validation.engine_rule` und `engine_warning` in allen elf Katalogen (#2578). Dann in `content-validator.ts`: `checkDuplicateLeft` wird `checkEngineRules`, ruft `validateLessonRules` mit `APP_EXTENSION_REGISTRY` und der Quellsprache des Sets; E-MATCH-DUP-LEFT behält seine Formulierung, jeder andere Fehler wird `engine_rule` (Lektion, Regel-ID, Pfad, Meldung), jede Warnung `engine_warning`; W-DOMAIN-UNKNOWN und W-CARD-BACK-SCRIPT werden ausgelassen, weil die App dieselben Sachverhalte unter eigenen Codes meldet. Entry-Chunk vor und nach dem Build messen."
- Goal: Ein Set, das die App für sauber erklärt, fällt nicht mehr am Content-Repo-Gate durch, weil die App nur eine der Engine-Regeln kannte.
- Result: i18n-PR #3322 (elf Kataloge, Parität 51 + 35 grün) gemergt. Code: fünf neue Tests (E-MC-ONE-CORRECT als `engine_rule` mit Pfad und Meldung; doppelter linker Wert nur einmal, nicht zusätzlich als `engine_rule`; W-CARD-UNUSED als `engine_warning` ohne Blockade; W-DOMAIN-UNKNOWN gefiltert; `ext:al-ordering@1` passiert die Registry ohne E-EXT-UNSUPPORTED/E-EXT-UNDECLARED). Validierungs-Suite 204 grün, tsc und eslint sauber. Bundle: Entry-Chunk vorher 726674 Bytes, nachher 726674 Bytes (unverändert, der Validator liegt im lazy Chunk `AiValidationDialog`: 96.52 kB auf 96.94 kB, der geteilte `rules`-Chunk bleibt bei 28150 Bytes). Testplan TC-0914 (DE + EN).
- Commit: siehe PR.

## 3. #3225: Shuffle-, Endlos- und adaptiver Lauf überleben den i18n-Titelwechsel

- Original prompt: "Gehe alle an, die aus der Ferne gemacht werden können, mit deinen Empfehlungen." (Empfehlung: Refs-Muster wie #2703.)
- Optimized prompt: "In `useShuffleLesson`, `useEndlessLesson`, `useAdaptiveLesson` Titel und Beschreibung wie in `useReviewLesson` (#2703) über Refs lesen und aus dem Dependency-Array nehmen; Stability-Test je Hook nach der Vorlage `useReviewLesson.stability.test.ts`."
- Goal: Der Katalogwechsel vom englischen Fallback zur Übersetzung startet keinen laufenden Lauf neu.
- Result: RED zuerst: die vier neuen Tests in `modes.stability.test.ts` fallen auf den alten Hooks (ein Titelwechsel ruft `listSets` ein zweites Mal). Fix: `titleRef`/`descriptionRef` in Shuffle und Adaptive, Deps nur noch Daten-relevant; im Endlos-Hook wurde der Titel im Effekt nie gelesen, er fliegt aus den Deps und aus der Destrukturierung. Modes-Suite 61 grün, tsc und eslint sauber.
- Commit: siehe PR.

## 4. #3254: eine Testzahl-Zeile, die nicht aufgeht, lässt den Docs-Verifier durchfallen

- Original prompt: wie oben (Empfehlung: Option 1, Abweichung wird FAIL).
- Optimized prompt: "`scripts/verify_docs_test_counts.py`: Arithmetik-Abweichung, Badge-Abweichung und nicht parsbare Zeile als FAIL statt WARN; `--fix` behält die Reparaturrolle; Eintrag `docs-test-count-arithmetic` in checks.yaml anpassen; fünf Tests mit `REPO`-Monkeypatch auf ein Minimal-Verzeichnis."
- Goal: Eine dokumentierte Zahl, die ihren Teilen widerspricht, verschwindet nicht mehr in einem grünen Lauf.
- Result: Drei `report.warn` werden `report.fail`; die Parse-Lücke fällt geschlossen. Der bestehende RED-Test der Check-Inventur (#2077, "Check degradiert zum No-op") brauchte die zweite Hälfte des Vorfalls: kaputte Regex plus jemand, der das FAIL wieder zu WARN weicht; ein neuer Test pinnt, dass die kaputte Regex allein den Verifier selbst rot macht. 23 Tests in beiden Suiten grün, `verify_docs.py` auf dem echten Baum 0 FAIL.
- Commit: siehe PR.

## 5. #3216 Punkt 2: die Arcade-Karte bleibt mit Begründung sichtbar

- Original prompt: wie oben (Empfehlung: Ausnahme aufheben, disabled-with-reason).
- Optimized prompt: "`ArcadeCard`: bei Spielmodus an und Arcade-Schalter aus die Karte mit Titel, Hinweis `arcade.requires_arcade_switch` und Link auf `/settings?tab=learning&section=motivation` rendern (`arcade-card-disabled`); bei Spielmodus aus weiter `null`; Test 'disappears' umdrehen, Fall Spielmodus aus plus Arcade an ergänzen; TC-0211 DE+EN."
- Goal: Die Feature-State-Policy gilt auch auf dem Dashboard: niemals versteckt, deaktiviert mit Grund.
- Result: 33 Tests (ArcadeCard plus Dashboard) grün, tsc und eslint sauber. Visual-Baselines: kein Motiv setzt die Kombination Spielmodus an und Arcade aus, darum `visual-baselines-unaffected` mit dieser Begründung.
- Commit: siehe PR.

## 6. #3317: die Regeltexte beschreiben die Pre-Commit-Hooks, die es gibt

- Original prompt: wie oben.
- Optimized prompt: "quality-checks.md Checkliste Punkt 5 (pytest) streichen und auf `.pre-commit-config.yaml` verweisen; code-hygiene.md: erfundene Beispielkonfiguration (prettier-, pytest-Hook) durch die reale Hook-Liste ersetzen, Setup-Befehl und Zusammenfassung angleichen; Korpus-Deckel prüfen; RULE-CHANGE DECLARED im Commit."
- Goal: Kein Leser verlässt sich auf einen Hook, der nicht läuft.
- Result: Beide Abschnitte verweisen auf die Datei als Quelle, nennen die realen Hooks (Basics, astral ruff auf `backend/app/`, lokales eslint, fünf Repo-Guards) und sagen, wo Tests und prettier stehen. Korpus 714 Zeichen unter dem Deckel, Deckel bleibt als Spielraum. `verify-normative-changes` verlangt die Erklärung (steht im Commit); die Log-Zeile für `docs/rule-change-log.md` kommt als zweiter Commit in die PR, sobald deren Nummer feststeht.
- Commit: siehe PR.

## 7. #3319: der Container-Walker prüft die drei Schritte, die er bisher verschluckt hat

- Original prompt: wie oben.
- Optimized prompt: "`e2e/scripts/verify-container-page.mjs`: Sprachwechsel auf der Landing als lauter Klick; Migrations-Dialog nach dem #3226-Muster über `data-migration-offer` beurteilen (auf einem leeren Container muss das Urteil `none` sein, kein `migration-start-fresh`); Dashboard-Tabs als laute Klicks; Test in `test_publish_image_workflow.py`, der jede verbleibende `.catch(() => {})`-Stelle aufzählt."
- Goal: Ein verschwundener Testid oder ein Dialog im falschen Zustand ist ein Befund, kein stiller Sprung.
- Result: Vier Schritte umgestellt (der Kartenansicht-Schalter des Lernpfads rendert in jedem Zustand der persönlichen Ansicht, also ebenfalls laut); das Network-Idle-Wartelimit bleibt die einzige `.catch(() => {})`-Stelle, und der Pin-Test zählt genau sie auf. 16 Tests grün, `node --check` sauber. Echter Lauf des Walkers gegen das Image: nur im CI (publish-image dry run), hier nicht möglich.
- Commit: siehe PR.

## 8. #3173 Variante 3: Platz schaffen auf kurzen Seiten, solange die Tastatur offen ist

- Original prompt: wie oben (Empfehlung: Variante 3 zuerst, klein und messbar).
- Optimized prompt: "`useKeyboardPreReveal`: wenn der späte Retry bei offener Tastatur weiter geklemmt ist (applied < delta), dem Scroller `padding-bottom` in Höhe des Fehlbetrags geben und erneut enthüllen; Padding nie beim Fokus (#3015/#3017), sofort weg, wenn der Viewport zurückwächst oder der Fokus die Tastatur verlässt; Tests mit dem bestehenden Clamping-Stub, dessen Maximum das Padding mitzählt."
- Goal: Ein Feld am Ende einer kurzen Seite liegt nicht mehr hinter der Tastatur, ohne die sichtbare Leerfläche von #3017.
- Result: Die #3017-Kandidatin 1 umgesetzt: Headroom nur, wenn die Tastatur nachweislich offen ist (Schrumpfung gegenüber der Fokus-Höhe über der Schwelle), exakt der Fehlbetrag, Entfernung beim Zurückwachsen und beim Fokusverlust, Log-Entscheidung `prereveal-pad` für die Sonde. Vier neue Tests (219 px Fehlbetrag auf einer 961-px-Seite, kein Padding bei ausreichend Raum, Abbau beim Schliessen, Abbau beim Fokusverlust), 29 grün, tsc und eslint sauber. Gerätemessung mit der #1569-Sonde bleibt beim Owner: ohne iPhone nicht verifizierbar, darum als eigene PR mit diesem Vorbehalt.
- Commit: siehe PR.

## Fragen und Annahmen

- #3316: Option 3 (Verweigerung in `/api/reset`) bewusst nicht umgesetzt, weil `DangerZoneSection` den Endpunkt als Nutzerfunktion aufruft; Ports plus kein Wiederverwenden schliessen die Klasse an der Quelle.
- #3222 PR 5: Engine-Warnungen W-DOMAIN-UNKNOWN und W-CARD-BACK-SCRIPT werden nicht als `engine_warning` gedoppelt, weil die App den Set-Domain-Wert in den Metadaten beurteilt und Kartenrückseiten ohne Quellschrift bereits blockierend als `back_language_mismatch` meldet. Sollte sich eine der beiden App-Prüfungen später zugunsten der Engine-Regel auflösen, kommt die ID aus der Menge `ENGINE_WARNINGS_COVERED_BY_APP` heraus.
