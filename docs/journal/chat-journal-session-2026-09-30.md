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
- Result: Beide Abschnitte verweisen auf die Datei als Quelle, nennen die realen Hooks (Basics, astral ruff auf `backend/app/`, lokales eslint, fünf Repo-Guards) und sagen, wo Tests und prettier stehen. Korpus nach dem Rebase über #3327 2326 Zeichen unter dem Deckel, Deckel bleibt als Spielraum; der Konflikt mit cc's #3327 (dieselben Abschnitte) wurde so gelöst: Hook-Liste und Setup-Text von hier, Prettier-Angaben von #3327. `verify-normative-changes` verlangt die Erklärung (steht im Commit); die Log-Zeile für `docs/rule-change-log.md` kam als zweiter Commit in PR #3333, geschlüsselt über die PR-Nummer.
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

## 9. #3163: der pt-Katalog spricht brasilianisches Portugiesisch

- Original prompt: wie oben (Empfehlung: pt-BR als Variante).
- Optimized prompt: "Erst messen: im Katalog stehen 131 você-Imperative gegen 47 tu-Imperative, 145 seu/sua gegen 36 teu/tua, 48 salvar gegen 23 guardar, 29 compartilhar gegen 54 partilhar; die Hilfeseiten (51 Dateien, rund 48.000 Wörter) sind überwiegend europäisch (utilizador in 24, ficheiro in 25, ecrã in 15 Dateien). Dann den Katalog auf BR angleichen: Wortliste (Definições, ficheiro, ecrã, separador, descarregar, partilhar, guardar, ligação, ronda, bónus, Ups, contactar) plus tu-Formen (teu/tua, Imperative am Satzanfang, Tens/chegaste/continuares), nur auf den 188 markierten Zeilen, Diff Zeile für Zeile gelesen."
- Goal: Eine Variante für die Oberfläche, und zwar die, die der Katalog schon zu drei Vierteln spricht.
- Result: 155 Zeilen geändert, Parität in beiden Richtungen grün. Bewusst nicht angefasst: `aprendizagem` (in BR gebräuchlich, 40-plus Stellen) und die Hilfeseiten. Für die Hilfeseiten ist ein Wort-Tausch keine Übersetzung (tu-Konjugationen, Gerundium, Wortstellung ziehen sich durch die Prosa), das ist eine eigene Übersetzungsrunde, siehe Owner-Entscheidungen.
- Commit: siehe PR.

## 10. #3237: der Paarzähler steht auch im Sticky-Footer neben Prüfen

- Original prompt: wie oben (Empfehlung: Zähler in den Footer spiegeln, Geste und Feedback-Fragen unangetastet).
- Optimized prompt: "Ein Footer-Status-Kanal (`footer-status.tsx`: Provider, `useFooterStatus(text)`, `FooterStatusLine`); die Matching-Übung publiziert `{matched} / {total}` solange nicht geprüft; `RunnerFooter` und `LessonFooterNav` rendern die Zeile direkt links von Check; Provider in beiden Hüllen (`LessonRunner`, `Lesson.tsx`); ohne Provider ist der Hook ein No-op. Tests: Kanal, beide Footer, Matching publiziert. Testplan TC-0131 ergänzt plus neuer Fall."
- Goal: Auf dem Telefon sieht der Lernende beim Zuordnen, wie viele Paare noch fehlen, ohne nach oben zu scrollen.
- Result: Spiegel statt Umzug: der obere Zähler bleibt die Live-Region (`aria-live`), die Footer-Zeile ist `aria-hidden`, damit Screenreader nicht doppelt hören. Die Byte-Identität der beiden Footer für die Lektions-Policy (RunnerFooter-Test) bleibt, weil beide dieselbe Zeile mit derselben Testid rendern. 595 plus 69 Tests grün, tsc und eslint sauber. Visual: die `lesson-matching`-Motive (12 Themes plus Desktop/Mobile) zeigen den Footer mit Zähler, also Löschen-dann-Resync über das Label, sobald die PR offen ist.
- Commit: siehe PR.

## Zusammenfassung Runde 3 (2026-09-30, 06:40 bis 09:00)

- Auftrag: alle aus der Ferne machbaren offenen Issues mit den freigegebenen Empfehlungen abarbeiten, plus einen Prompt für das Engine-Repository.
- Gemergt, je ein Thema pro PR: #3320 (#3316), #3322 und #3323 (#3222 PR 5, dazu der brace-expansion-Override 5.0.12 für zwei neue Advisories), #3329 (#3225), #3330 (#3254), #3331 (#3216 Punkt 2), #3333 (#3317), #3334 (#3319), #3335 (#3151 ast-serialize), #3336 (#3173 Variante 3), #3337 (#3163 Katalog); #3338 (#3237) mit Baseline-Resync als letzte PR der Runde. Auf Bitte des Owners ausserdem cc's #3327 und #3326 abonniert und begleitet.
- Geschlossene Issues: #3316, #3222 (Umbrella, alle fünf Slices), #3225, #3254, #3216, #3317, #3319; #3271 durch cc's #3326.
- Doppelarbeit: #3271 war parallel bei cc (#3326, 07:15) und hier (lokal, 07:30). cc war zuerst, mein Commit wurde ohne Rest aus der Queue genommen. Lehre: vor einer Runde die offenen PRs und Branches der anderen Lane prüfen (core.md, "ein Befund gehört der Lane, die ihn zuerst festhält", auf Issues angewandt).
- Bewegliches develop: der Owner und cc mergten während der Runde (#3324, #3325, #3328, #3327, #3326). #3323 und #3330 mussten je zweimal per Update-Branch nachgezogen werden, bevor die Pflichtprüfungen als aktuell galten; jeder fremde Merge kostet eine CI-Runde der offenen PR.
- Nicht erledigt, mit Grund: #3163 Hilfeseiten (Übersetzungsrunde, kein Wort-Tausch; 51 Dateien, rund 48.000 Wörter), #3149/#3148 (Live-Aufrufe), #3169 (P4, gross), #3150 (Upstream), #3270 (Timing des Owners, cc hat die Vorbereitung in #3327 gemacht), #3253 (Entscheidung: kein Required-Check), Gerätemessungen (#3172, #3173-Verifikation mit der #1569-Sonde, #3182/#3318/#3227 Renders).
- Prompt für learn-content-engine: geschrieben und im Rundenbericht eingefügt (Rule-ownership-Absatz für docs/architecture.md nach #3245, Bildunterschrift s6-book-text nach #3142).
- Werkzeug-Lektion: parallele Shell-Aufrufe teilen das Arbeitsverzeichnis, ein `cd` in einem Aufruf verschiebt die anderen; seither nur absolute Pfade in parallelen Aufrufen.

## Fragen und Annahmen

- #3316: Option 3 (Verweigerung in `/api/reset`) bewusst nicht umgesetzt, weil `DangerZoneSection` den Endpunkt als Nutzerfunktion aufruft; Ports plus kein Wiederverwenden schliessen die Klasse an der Quelle.
- #3222 PR 5: Engine-Warnungen W-DOMAIN-UNKNOWN und W-CARD-BACK-SCRIPT werden nicht als `engine_warning` gedoppelt, weil die App den Set-Domain-Wert in den Metadaten beurteilt und Kartenrückseiten ohne Quellschrift bereits blockierend als `back_language_mismatch` meldet. Sollte sich eine der beiden App-Prüfungen später zugunsten der Engine-Regel auflösen, kommt die ID aus der Menge `ENGINE_WARNINGS_COVERED_BY_APP` heraus.
- #3237: Spiegel statt Umzug des Zählers, weil der obere Zähler die Live-Region ist und zehn Tests seine Testid pinnen; die Footer-Zeile ist `aria-hidden`.
- #3173: Variante 3 ohne Gerät umgesetzt, in der Form, die #3017 als Kandidatin 1 zuliess (Padding nur bei nachweislich offener Tastatur, nie beim Fokus). Der Vorbehalt steht in PR #3336; bei sichtbarer Lücke ist der Commit zu reverten.
- #3163: nur der Katalog, nicht die Hilfeseiten; Entscheidung dazu im Rundenbericht.
