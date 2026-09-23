# Chat-Journal 2026-09-22 und 2026-09-23: Gerätebefunde, Issue-Queue per Workflow, Auswertungs-Brainstorm

Eine Sitzung über zwei Tage. Der Owner meldete acht Gerätebefunde vom iPhone, jede wurde gegen den Code verifiziert und als Issue abgelegt, die automatisierbaren in einem Multi-Agenten-Workflow parallel umgesetzt und in Prio-Reihenfolge gemerged. Dazu ein Judge-Panel-Brainstorm zur Auswertungs-Definition in der Engine.

## 1. Gerätebefunde triagiert (2026-09-22, 19:00 bis 21:00)

- Original prompt: Screenshots vom iPhone mit "Gemeistert 0 %, ich hatte 75 %", "Falsche Option ausgewählt aber richtig angezeigt", "Frage ist doppelt, auch alle anderen Sätze überprüfen", "Wiederholung obwohl keine Fehler, immer und immer wieder", "Ganze Wörter werden nicht umgebrochen", "Doppeltes als als", "Tastatur verdeckt Feld", "nach Weiter halbe Seite".
- Optimized prompt: Je Screenshot Seite, Set, Lektion und Schritt nennen und ob es die Lektion oder die Wiederholungssitzung war; das spart die Rückverfolgung über die i18n-Schlüssel.
- Goal: Jede Meldung gegen den Code verifizieren, Ursache benennen, Issue mit Fix-Vorschlag und RED-Testplan anlegen (GITHUB-ISSUE-PFLICHT).
- Result:
  - #3166: "Gemeistert" und "Noch offen" zählten jede berührte SRS-Zeile (auch fehlerfreie) gegen das Mastery-Flag, das erst nach drei richtigen Versuchen kippt.
  - #3167: `cloze_mode: "select"` bewertete die gewählte Option mit der Freitext-Toleranz (Levenshtein, 2 Edits ab 16 Zeichen); Probe: alle vier Optionen galten als richtig, falsche Antworten wurden als Streak gezählt.
  - #3168: doppelter Tipp-Aufruf (`ExerciseHint` mit XP plus alter `hint_show`-Link) in Cloze, Freitext, Wort-Kacheln.
  - #3169: sechs Lektionsseiten mit je eigener Hülle bei geteilten Renderern, EXP-Kandidat.
  - #3170: die SRS-Warteschlange enthielt jedes nicht gemeisterte Element, auch nie-falsche, mit Fehler-Wortlaut; "Noch 2 fällig" als Endlosrunde aus stehengebliebener Zähler-Arithmetik.
  - #3171: Feature "Alles wiederholen" (Reset eines Sets).
  - #3172: Rest-Pan nach "Weiter" bei vorher offener Tastatur, Sonden-Ablesung nötig.
  - #3173: Tastatur verdeckt das Feld auf kurzen Seiten, mit Kompaktkopf-Brainstorm (Navigation, Lernset, Titel ins Optionen-Panel).
  - #3174: Silbentrennung in Zuordnungs-Kacheln.
  - alc-programming #26: zehn Cloze-Übungen mit `prompt == sentence` oder `prompt == Titel` (276 Übungen geprüft); alc-psychology #61: "als als" (37 Doppelwörter geprüft, 36 korrektes Deutsch); learn-content-engine #169: Validator-Regel dagegen.
  - Später #3182 (11 im FeatureShot-README gelistete PNGs fehlen auf develop), #3187 (Prod-Image 5,3 MB unter der Decke seit 21.9.), #3189 (`--update-baseline` löscht die Baseline-Historie).
- Commit: keine, Issues.

## 2. Issue-Queue per Workflow (2026-09-22 abends bis 2026-09-23 morgens)

- Original prompt: "alle eine prio setzen und der prio nach abarbeiten".
- Optimized prompt: "Prio-Labels setzen (P1 #3167, P2 #3166/#3170, P3 #3168/#3174, P4 #3171/#3169), dann pro Issue eine Agentin in eigenem Worktree: RED-first, PR gegen develop, Testplan DE und EN; je PR zwei Gegenleserinnen (Korrektheit, Prozessregeln); Merges durch die Orchestratorin in Prio-Reihenfolge."
- Goal: Alle automatisierbaren Issues als geprüfte PRs, ohne die Hauptarbeitskopie anzufassen.
- Result:
  - PRs: #3175 (#3167), #3176 (#3166), #3177 und #3180 (#3171, i18n zuerst), #3178 (EXP-052 zu #3169), #3179 (#3168), #3181 (#3174), alc-programming #27, alc-psychology #62, learn-content-engine #170, später #3183 und #3185 (#3170).
  - Gegenleserinnen: vor allem das Visual-Baseline-Gate (fünf PRs BLOCKED) und der Dead-Code-Ratchet in #3180 (behoben).
  - Der Workflow-Lauf endete mit der Session, bevor die #3174-Nacharbeit fertig war. Die #3170-Agentin hatte eine zwischengeschobene Owner-Nachricht ("Doppeltes als als") als ihren Auftrag gelesen und #3170 nicht gebaut; Neustart als eigene Agentin mit "your ONLY task", der lieferte. Die abgebrochene #3174-Nacharbeit hatte Fixture, Mock-Helfer und vier FeatureShots ungesichert in einem Worktree gelassen; geprüft und als c8aaae04d gepusht.
  - Semantik-Entscheidung #3170 (von der Orchestratorin): Option A als Standard (nur Fehler in Warteschlange und Zähler), Option B als Schalter "Auch fehlerfreie Elemente wiederholen"; die Agentin ergänzte `isSettledElement` (nie-falsch zählt bei ausgeschaltetem Schalter als gefestigt) und dokumentierte Alternativen im PR-Body als Annahme für den Owner.
- Commit: siehe Merges in Abschnitt 3.

## 3. Gates und Merges (2026-09-23)

- Goal: Baseline-Gate mit Beleg statt Behauptung, Merges in Prio-Reihenfolge unter `strict: true`.
- Result:
  - Vergleichsläufe ohne Update (visual-regression.yml) für #3175, #3176, #3181, #3180: je 0 Diff, Label `visual-baselines-unaffected` mit Run-ID im PR-Kommentar. #3179 änderte die lesson-cloze-Baselines (Link weg): Löschen-dann-Resync (#3023), drei PNGs per Auge geprüft. #3185: Sync lieferte die drei settings-learning-Baselines; Cluster-Analyse (Ausrichtung um 146 px Mobile, 71 px Desktop, drei Restbänder unter 6 px) bestätigte die eingefügte Schalterzeile als einzige Änderung.
  - Merges adaptive-learner: #3178 d94bee08b, #3177 d212a7e1a, #3175 46826f0fb, #3176 38c271d08, #3179 013306845, #3181 6fd21daba, #3180 41297bc3d, #3183 ef7eca6cd, #3184 ed91df361 (Dependabot-Sammel-PR jszip, uvicorn, datamodel-code-generator plus Image-Decke für #3187), #3185 nach grüner CI.
  - Merges Content und Engine: alc-programming #27 16e7d1f3e, alc-psychology #62 0fea8b727, learn-content-engine #170 7e4e07da7; Registry-Pins adaptive-learner-content #221 ea62c435c (alc-programming e91b44f5, alc-psychology 9bc29969).
  - Geschlossen: #3166, #3167, #3168, #3170, #3171, #3174, alc-programming #26, alc-psychology #61, learn-content-engine #169.
  - Nebenbefund Docker-Smoke: das Prod-Image misst seit dem Wochenlauf vom 21.9. 128,2 statt 133,9 MB gzip ohne Eingabeänderung (Bauumfeld); Decke von Hand auf die CI-Messung gesenkt, weil `--update-baseline` die Datei auf zwei Schlüssel zurückschrieb (#3189).

## 4. Brainstorm: Auswertungs-Definition in der Engine

- Original prompt: "Es sollte auch in der Engine möglich sein, eine Definition für die Auswertung der Lektion zu geben und wie die aussehen soll. Dazu ein Brainstorm. Als Beispiel die Benotung."
- Optimized prompt: "Judge-Panel: vier Entwürfe (Autor, Lernende, Architektur, Prüfung), zwei Juroren, eine deutsche Synthese mit YAML-Beispiel, Resolver-Skizze, Abgrenzung, Scheiben und offenen Entscheidungen."
- Result: Rückgrat ist der Architektur-Entwurf (Engine trägt Metadaten und Validierung, App einen reinen Resolver über die bestehenden Aggregationen). Optionaler `evaluation`-Block im Manifest (Set) mit Lektions-Override, Felder `scheme | pass_percent | basis | grades | report | title`; Default gleich heute; nichts Neues persistiert; zuerst die doppelten Sterne-Schwellen 50/75/90 (`lesson-summary.ts`, `lesson-xp.ts`, `xp_service.py`) zusammenführen. Acht offene Entscheidungen mit Empfehlungen an den Owner übergeben (Autoren-Schwelle gewinnt mit Quellenlabel, Schema-Version bleibt 1.6, Set-Ebene zuerst, kein `unit: steps`, keine Set-Note in v1, `report` steuert nicht die Korrekturrunde, keine Presets, Anzeige vor dem Start erst mit #3173). EXP-Dokument folgt nach seiner Antwort.

## 5. Nebenbefunde

- Frontend nutzt weder MobX noch Signals noch Zustand (nur als Override für @assistant-ui); 37 window-CustomEvents als Event-Bus sind der De-facto-Global-State. Kandidat für ein Zustand-Issue.
- Weitere Session des Owners parallel: #3186 und #3188 (Zuordnungs-Korrekturansicht), unangetastet.

## 6. EXP-052: Owner-Review, ratifizierte Matrix, zwei Vorbedingungen (2026-09-23, 08:45 bis 09:40)

- Original prompt: Review von #3169 ("Es fehlen technische Entscheidungen für die Slotimplementierung und explizite Akzeptanzkriterien ... drei Fragen fürs Refinement"), danach "EXP-052, Offene Entscheidungen Punkt 1: ratifizierte Verhaltensmatrix ... Startfreigabe".
- Optimized prompt: Entscheidungen als Tabelle mit Spaltennamen, die der `RunnerPolicy`-Typ wörtlich übernimmt; Vorbedingungen mit Issue-Nummer.
- Goal: EXP-052 trägt die Entscheidungen (Slots als Props + Render-Props, Migration direkt ohne Flags, Tastatur in der Hülle) und die Matrix (`exit, prevStep, pause, optionsBar, theoryLink, enterShortcut, reanchor, clearHints, persistProgress, mode` + `headerExtra`), Scheibe 0 startet.
- Result: PR #3195 (Owner-Review) und #3198 (Matrix, Befunde 1 bis 4, Nebenfund) gemerged. Befund 4 als #3196 (Hinweis-Set wird nur in Lesson.tsx geleert; Review/Shuffle/Endless/Adaptive/Error-Replay stempeln fremde Hinweise) und Nebenfund als #3197 (`LESSON_ROUTE_PREFIXES` kennt Shuffle und Endless nicht) angelegt. #3197: PR #3199 (c995a8a20, Tabellentest über alle sechs Routen). #3196: PR #3200 (336889a07, `clearHintUsage()` am Anfang des Lade-Effekts der vier Hooks, Replay-Seite beim Mount; RED 5 Fälle, GREEN 254). Scheibe 0 läuft als Hintergrund-Agentin auf `refactor/3169-slice-0-runner-foundation`.
- Commit: c995a8a20, 336889a07.

## 7. EXP-052 Scheibe 0: Fundament der Runner-Hülle (2026-09-23, 09:10 bis 10:15)

- Original prompt: "Startfreigabe: Scheibe 0 ist nach diesem Entscheid startklar, mit zwei Vorbedingungen".
- Optimized prompt: Scheibe 0 als eigene Agentin im Worktree von origin/develop; nur `components/lesson/runner/`, nirgends verdrahtet; Spaltennamen der Matrix wörtlich; Vergleichslauf der Baselines statt Sync.
- Goal: `RunnerSource`/`RunnerPolicy`-Typen, sechs eingefrorene Policies, `RunnerFooter` (aus `LessonFooterNav`), `RunnerStatusView`, leere `LessonRunner`-Hülle, alles mit Tests, ohne sichtbare Änderung.
- Result: PR #3201 (Agentin, 6d97ca438): 12 Dateien, 80 neue Tests, Vollsuite 10667 grün, Komplexitäts- und Dead-Code-Gate sauber; `useLessonStepState.progress` optional (Default `null`) für die flüchtigen Läufe. Prüfung gegen die Matrix Zeile für Zeile bestanden (Endless `prevStep: false` strukturell, `pause: true`; ErrorReplay `prevStep: true`; nur Lesson `persistProgress` und `mode: "inherit"`). Vergleichslauf visual-regression.yml 35832381098 als Beleg für `visual-baselines-unaffected`. Bewusste Dopplung: `RunnerFooter` und `RunnerStatusView` liegen neben den Originalen (Byte-Paritätstests), Scheibe 4 entfernt die Originale. Befund für Scheibe 1 bis 3: `lesson.error_replay` trägt keine Statusbildschirm-Schlüssel, Empfehlung `lesson.*` wiederverwenden (Kommentar auf #3169).
- Commit: c1ff0fdf0.

## 8. EXP-052: i18n-Entscheid vor Scheibe 1 (2026-09-23, 10:30 bis 12:30)

- Original prompt: "EXP-052, i18n-Entscheid vor Scheibe 1 ... Dritter Weg, weder neue error_replay-Schlüssel noch lesson.*", danach die Prüfung der zwei Abweichungen: "eine geht durch, eine nicht".
- Optimized prompt: Bei jedem Vorschlag, Schlüssel zusammenzulegen, die auslösende Bedingung je Konsument aus dem Code nennen (Guard, Fehlerpfad, Parameter), nicht den Wortlaut.
- Goal: `runner.*` als einziges Zuhause der geteilten Chrome, Drift der Kopien beheben, Test gegen künftige Drift, Policy-Schlüssel für die läuferspezifischen Texte.
- Result: Issue #3203 (Drift: de drei Fassungen eines Satzes, sieben Sprachen mit Varianten, fünfte Kopie `repo.back_to_dashboard`). PR #3204 (0c116d8d9): vier `runner.*`-Schlüssel in elf Katalogen, alle Kopien auf die der englischen Quelle nächste Fassung, Drift-Test in `i18n-sync.test.ts` (RED-Beleg: mit Schlüsseln ohne Konsolidierung fielen 3 von 4). PR #3205 (506873dc0): Entscheid in EXP-052. PR #3206 (13074eb0d): `RunnerPolicy` mit `emptyBodyKey | null`, `loadFailedKey`, `notCachedBodyKey`, `missingParamsKey`; Hülle liest `runner.back_to_dashboard` und `runner.error.invalid_data` geteilt, alles andere über die Policy; Key-Echo-Test; Paritätstest substituiert genau einen Satz aus `en.json`. Erste Fassung (Lektion liest `runner.*`) vom Owner abgelehnt: die Bedingungen sind verschieden (`listSets()` ohne Set gegen `getLesson()` ohne Datei im geladenen Set; drei Parameter gegen einen). PR #3207 (ce1bd0bbd): die Regel "geteilt wird bei gleicher Bedingung, nicht bei gleichem Satz" in EXP-052.
- Commit: 0c116d8d9, 506873dc0, 13074eb0d, ce1bd0bbd.

## Fragen und Annahmen

- #3170: Option A als Standard plus Schalter für B, entschieden von der Orchestratorin; Mastery-Semantik `isSettledElement` als Annahme im PR-Body, Alternativen benannt.
- #3172 und #3173 brauchen das Gerät des Owners (Sonde), nicht automatisiert.
- Die 5,3-MB-Schrumpfung des Images ist Bauumfeld-Drift; was genau kleiner wurde, druckt das Skript nicht (nur gzip-Größe), Folgearbeit in #3187.
- FeatureShots `lesson-review/summary` für #3176 fehlen auf develop schon vor dem PR (#3182), deshalb dort nicht nachgeholt.
- #3196: Replay-Seite leert das Hinweis-Set beim Mount (Schlüssel `[setId, filename]`, wie `Lesson.tsx`), nicht pro Runde; ein "Nochmal" innerhalb derselben Replay-Sitzung behält die Hinweise dieser Sitzung. Konservative Wahl, im PR benannt.
- Scheibe 0: `RunnerFooter`/`RunnerStatusView` liegen bewusst NEBEN `LessonFooterNav`/`LessonStatusView` (Byte-Paritätstests statt Wrapper, damit kein Unter-Toleranz-Versatz im Fuß entsteht, #3023); die Dopplung endet mit Scheibe 4.
- Sprachwahl je Katalog bei der Konsolidierung (#3204): Mehrheitsvariante bzw. die dem Katalogbegriff nächste (el `σετ` 117 gegen `σύνολο` 19; es `explorador` 9 gegen `navegador` 2; pt `baix` 50 gegen `descarreg` 4; tr `Pano` aus der Navigation). Im PR-Body benannt, vom Owner nicht widersprochen.
