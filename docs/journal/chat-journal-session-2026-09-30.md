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

## Fragen und Annahmen

- #3316: Option 3 (Verweigerung in `/api/reset`) bewusst nicht umgesetzt, weil `DangerZoneSection` den Endpunkt als Nutzerfunktion aufruft; Ports plus kein Wiederverwenden schliessen die Klasse an der Quelle.
- #3222 PR 5: Engine-Warnungen W-DOMAIN-UNKNOWN und W-CARD-BACK-SCRIPT werden nicht als `engine_warning` gedoppelt, weil die App den Set-Domain-Wert in den Metadaten beurteilt und Kartenrückseiten ohne Quellschrift bereits blockierend als `back_language_mismatch` meldet. Sollte sich eine der beiden App-Prüfungen später zugunsten der Engine-Regel auflösen, kommt die ID aus der Menge `ENGINE_WARNINGS_COVERED_BY_APP` heraus.
