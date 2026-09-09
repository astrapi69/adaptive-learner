# Chat-Journal 2026-09-09

Eine Session, drei Branches, drei PRs gegen develop: der Umbruch-Fehler
der Reihenfolge-Listen auf dem Telefon (#3027, PR #3037), der dabei
gefundene Spiegel-Fehler in den Gate-Tests (#3036, PR #3038) und die
driftende Plaketten-Zeile im settings-data-Motiv (#3035, PR #3040).

## 1. Reihenfolge-Listen brechen auf dem Telefon mitten im Wort (#3027)

- Original prompt: "Bonjour, machen wir weiter mit:
  https://github.com/astrapi69/adaptive-learner/issues/3027"
- Optimierter Prompt: "Behebe #3027: die Zeilen der Reihenfolge-Listen
  in Einstellungen > Lernen (Zusammenfassung nach Lektionen) und
  Einstellungen > Allgemein (Reihenfolge der Inhalte-Tabs) sollen bei
  375 px die Beschriftung über die volle Breite zeigen und die
  Pfeil-Schaltflächen darunter umbrechen; 44-px-Ziele bleiben; RED-Test
  zuerst; FeatureShots neu; Baselines per Sync."
- Ziel: keine Wortbrüche wie "Erge / bnis / teile / n" mehr, ohne die
  Touch-Ziele zu verkleinern.
- Ergebnis: Dieselbe Zeilenform lag in drei Dateien (Summary-Liste,
  Inhalte-Tabs, ContentRepoRow). Die beiden Listen teilen sich jetzt
  ein Primitive `components/settings/ReorderRow.tsx`: `ReorderRow` ist
  eine umbrechende Flex-Zeile, deren Textslot 10rem beansprucht und
  wächst; passt das Pfeilpaar nicht mehr daneben, rutscht es rechts
  darunter, die Beschriftung behält die volle Breite. `ReorderList` ist
  die `<ol>`-Hülle. Dabei fiel die zweite Ursache auf: die App lädt
  keinen Tailwind-Preflight, also trug jede `<ol>` den 40-px-Einzug des
  Browsers - bei 375 px ein Fünftel der Kartenbreite. Die Hülle setzt
  ihn zurück, die Zeilen nummerieren ohnehin selbst. Testids
  unverändert, kein Testplan-Schritt betroffen (Bugfix ohne neuen
  Nutzerpfad).
- TDD: zwei Klassen-Pins in den Control-Tests (rot auf dem alten
  Markup, auch sichtbar als die einzigen zwei Fehler eines vollen
  `make test`, der mitten in die Edits fiel), neuer `ReorderRow.test.tsx`
  (Kanten deaktiviert parametrisiert, Handler, gedimmte Zeile, Umbruch-
  Layout, Listen-Reset). Volle Frontend-Suite 961 Dateien / 10043 Tests.
- Bilder: FeatureShots `summary-sections/settings{,.mobile}.png` neu
  (Mobile: jede Beschriftung in einer Zeile, Pfeile darunter; Desktop:
  nur der Einzug weg). Baseline-Sync änderte 19 PNGs; 18 gehalten (die
  12 Theme-Ansichten und `settings-general-*` an der Inhalte-Tabs-Liste,
  `settings-learning-*` an der Zusammenfassungs-Liste, Mobile-Seite
  144 px kürzer), `settings-data-mobile.png` zurückgesetzt: dort hatte
  nur der Seed-Lerner ein Abzeichen dazubekommen (#2682-Klasse).
- Commit: 2290e6d1 (Squash von PR #3037)

## 2. Gate-Tests kopierten .claude/ samt Agenten-Worktrees nach /tmp (#3036)

- Original prompt: keiner - Fund beim Session-Start-`make test`.
- Optimierter Prompt: "Die Spiegel-Fixtures in test_corpus_ratchet,
  test_gate_fail_closed und test_check_inventory kopieren nur
  `.claude/rules`, nie das Worktree-Verzeichnis daneben; ein gemeinsamer
  Helper zählt die kopierten Dateien und ein Guard-Test deckelt sie."
- Ziel: ein `make test` darf den Rechner nicht füllen, egal wie viele
  Agenten-Worktrees herumliegen.
- Ergebnis: Das Start-`make test` brach mit ENOSPC ab und danach
  scheiterte jeder Prozess, der /tmp braucht - auch die
  Ausgabe-Erfassung des Werkzeugs selbst ("out of inodes"). Diagnose
  nur über eine Datei auf /home: `/tmp/pytest-of-<user>/` hielt rund
  eine Million Dateien, weil drei Gate-Tests `.claude/` per `copytree`
  spiegeln und Claude Code dort unter `worktrees/` elf vollständige
  Agenten-Checkouts mit je einem eigenen node_modules geparkt hatte
  (Hinterlassenschaft der #2951-Session; die Harness-Sperre überlebt
  das Agentenende). Sofort: pytest-Tmp gelöscht (1 Mio Inodes frei),
  die elf Worktrees mit `git worktree remove -f -f` entfernt. Dauerhaft:
  `backend/tests/repo_mirror.py` baut den Spiegel für alle drei
  Fixtures (Symlinks für Gelesenes, echte Kopien für die veränderten
  Flächen, von `.claude` nur `rules/`) und liefert die Anzahl kopierter
  Dateien zurück; `test_repo_mirror.py` deckelt sie auf 1000 (heute
  133), prüft, dass ein Fake-Worktree und `settings.json` nicht
  mitkommen, weist ein nicht-leeres Ziel ab und pinnt den neuen
  `.gitignore`-Eintrag `/.claude/worktrees/`. Backend-Suite 1835 grün,
  Inode-Stand danach unverändert.
- Commit: 5fccc047 (PR #3038)

## 3. settings-data driftet über die Plaketten-Zeile (#3035)

- Original prompt: "weiter mit:
  https://github.com/astrapi69/adaptive-learner/issues/3035"
- Optimierter Prompt: "Pinne für das Visual-Motiv settings-data die
  Zählung des Blocks 'Deine Sicherung enthält' so eng wie möglich,
  analog zur #3016-Abhilfe: nur die Leseoperationen auf dem Store
  userBadges, alles andere unverändert; lokal dreimal identisch, dann
  Baseline-Sync."
- Ziel: die Datei darf auf fremden PRs nicht mehr als unzurechenbare
  Änderung zurückkommen.
- Ergebnis: Der Block zählt echte Sicherungszeilen (`toArray()` je
  Store). Ob der Seed-Lerner die Plakette `first_assessment` schon
  trägt, wenn gezählt wird, ist ein Wettlauf zwischen dem
  Gamification-Schreibvorgang aus der Einstufung und der Navigation zu
  den Einstellungen; deshalb "1 Plaketten" und 35 statt 34 Datensätze
  mal da, mal nicht, 24 px Seitenhöhe. Dritte Datenquelle in diesem
  einen Motiv nach der Empfehlungsliste (#1653) und dem Offline-Cache
  (#3016). `pinUserBadgesEmpty(page)` in `e2e/visual/helpers.ts`: die
  Lesemethoden des Object Stores `userBadges` (getAll, getAllKeys,
  count, openCursor, openKeyCursor) bekommen einen Schlüsselbereich,
  den keine Zeile trifft - der Aufruf geht weiter an die echte
  IndexedDB, kein Fake-Request, kein anderer Store berührt. Beweis:
  gegen den Dexie-Build einmal `--update-snapshots`, dann zwei
  Vergleichsläufe, 3/3 grün; der Block zeigt "1 Projekte / 34
  Datensätze gesamt". Sync änderte genau `settings-data-desktop.png`
  (6083 -> 6059 px); Mobile und Tablet lagen auf develop schon im
  plakettenlosen Zustand. Kein Regeltext: der Korpus steht auf
  Headroom 0, die Klasse ist unter #1653/#3016 dokumentiert, die dritte
  Instanz steht im Docstring des Helpers.
- Commit: bc627c4e (Squash von PR #3040)

## 4. Die Tipp-Sonde sagt jetzt, welcher Tipp falsch war (#3043)

- Original prompt: "zu dem: #1569 wir haben ein button der logs erstellt
  den man bei den einstellungen ein oder ausschlaten kann. Die logs sind
  zu wenig denke ich den wir haben das mehrmals mit verschidenen daten
  die ich kopiert hatte aber trotzdem nicht behoben wurde."
- Optimierter Prompt: "Erweitere die Diagnose-Sonde (#1569) um die
  Signale, die die acht bisherigen Auswertungen jedes Mal raten
  mussten: welcher Tipp der Fehltipp war (Markierung durch den Tester),
  was der Tipp tatsächlich ausgelöst hat (click/focusin gegen das
  pointerdown-Ziel), was gemeint war (Elemente ein und zwei Zeilen über
  dem Finger), ob das fixierte Chrome dort gerendert ist, wo es
  hingehört, und wie viel Scroll-Reserve der Pre-Reveal hatte."
- Ziel: die nächste Geräte-Ablesung soll entscheidbar sein, nicht die
  neunte Vermutung aus dem Vorzeichen von ΔY.
- Ergebnis: Die acht Ablesungen (#2984, #3004, #3015 zurückgenommen in
  #3018, #3021) lieferten Geometrie, aber keinen Befund, weil dem
  Protokoll drei Dinge fehlten: die Absicht (welches Element gemeint
  war), das Ergebnis (welches Element reagiert hat) und die Markierung
  (welcher Tipp der falsche war). `ViewportDiagnostic.tsx` schreibt je
  Tipp zusätzlich `hit=` (`elementFromPoint` am Finger, weicht nur bei
  echter Hit-Test-Desynchronisation vom Event-Ziel ab), `above1=` und
  `above2=` (die Elemente eine und zwei Textzeilen über dem Finger,
  24 px), rohes `pageY=`/`screenY=`, `hdrTop=` (Oberkante `app-nav`,
  erwartet 0) und `ftrBot=` (Unterkante `lesson-footer` gegen
  `innerHeight`, erwartet 0 wenn angedockt), `room=` (verbleibende
  Reserve des App-Scrollers, die "kein Platz"-Tatsache aus #3019) und
  `focusTop=`/`focusBot=`/`focusVis=` (das vor dem Tipp fokussierte
  Feld gegen den visuellen Viewport). Drei neue Protokollarten:
  `click` (Ziel, `downTarget=`, `mismatch=`), `focus` (Ziel, Lage,
  `rootY`, `vvTop`, `kbd`, `room`) und `mark` (Knopf "Daneben!" auf der
  Sonde markiert den letzten Tipp als Fehltipp). Der Bericht bekommt
  den Abschnitt `actions (newest first)`. Nur die Dev-Sonde; aus ist
  aus, kein Produktverhalten geändert. RED zuerst: sechs neue Tests
  fielen auf der alten Sonde, danach 28/28; happy-dom übernimmt
  `pageY` nicht aus dem PointerEvent-Init, deshalb prüft der Test das
  Feld nur auf Vorhandensein. Testplan DE + EN und
  `docs/developer/testing.md` tragen das Ableseprotokoll. Baselines
  unberührt (die Sonde ist in jedem Motiv aus), belegt durch einen
  0-Diff-Sync-Lauf.
- Commit: 288a5f06 (Squash von PR #3044)

## 5. Alles Offene abarbeiten: Bestandsaufnahme (12:00)

- Original prompt: "gut dann alles was offen weiter"
- Optimierter Prompt: "Prüfe, was im Repo tatsächlich offen ist (PRs,
  Issues, Nightlies, ROADMAP, Backlog), verifiziere jede Prämisse gegen
  den Code, und arbeite die Posten in der Prioritätsreihenfolge der
  Vibe-Coding-Regel ab: offene PRs, Bugs, Infrastruktur, UI, Cleanup,
  Features."
- Ziel: kein Posten bleibt liegen, weil ein Stand in meinem Kontext
  veraltet war.
- Ergebnis: Die vier #2951-Reste (#2961, #2962, #2964, #2966) waren
  schon in #2990 gelandet, der Schirm #2951 geschlossen. Offen waren
  nur #1569 (wartet auf die Geräte-Ablesung) und #1087 (manueller
  Testplan). Die eigentliche Arbeit lag in der Nightly-Liste und in den
  Planungsdateien: der Red-runs-Rollup vom 2026-09-08 nannte zwei rote
  Läufe (Dead-Code-Report, Manual-Automation), ROADMAP und Backlog
  führten sechs geschlossene Issues und vier erledigte oder falsch
  bemessene P3-Posten als offen. Manual-Automation vom 2026-09-08 (drei
  Session-5-Mobile-Specs, `invite` nicht sichtbar) lief am 2026-09-07
  und 2026-09-09 grün: eingeordnet als Umgebungs-Flake, kein Eingriff.
- Commit: keiner (Analyse)

## 6. Dead-Code-Report seit 2026-08-30 rot: dritter Resync in vier Wochen (#3046, #3047)

- Original prompt: (aus 5.)
- Optimierter Prompt: "Reproduziere den roten Dead-Code-Ratchet lokal,
  prüfe jeden neuen knip-Fund einzeln gegen alle Konsumenten (#2486),
  entferne echte tote export-Schlüsselwörter, banke Barrel- und
  Typ-Exporte wie die bestehenden Einträge, und benenne die Klasse."
- Ziel: Wochen-Report grün, ohne einen Fund blind zu banken.
- Ergebnis: Acht neue Funde aus #2991, #3012 und #3020. Fünf sind
  Barrel-Re-Exporte oder ein öffentlicher Props-Typ, deren Konsumenten
  die Concern-Datei direkt importieren (gebankt wie die 109 Barrel- und
  237 Typ-Einträge der Baseline). Zwei trugen ein totes `export`
  (`isFullyCorrect`, `DONE_TIER_LIMIT`), jetzt modul-privat. Der
  erledigte Eintrag `REVIEW_PREF_CHANGE_EVENT` (Konsument seit #2991)
  wurde ausgebucht; Baseline-Diff exakt +5 / -1. Die Klasse (#2917,
  #2988, jetzt): der Ratchet läuft nur wöchentlich, jede PR mit neuem
  Barrel-Export macht ihn rot, und die Verifikation passiert Tage
  später ohne den Autor. #3047 schlägt dem Owner vor, `--only typescript`
  im Frontend-Job und `--only python` im Backend-Job der PR-CI laufen
  zu lassen (Entscheidung offen, Cadence-Änderung gegen #575).
- Commit: 47d5c1bd (Squash von PR #3048)

## 7. ROADMAP und Backlog: geschlossene Posten raus (#3049, #3053)

- Original prompt: (aus 5.)
- Optimierter Prompt: "Prüfe jeden in ROADMAP/Backlog als offen
  geführten Posten gegen den Issue-Stand und den Code; entferne, was
  geschlossen ist, mit Beleg; archiviere `[x]`-Zeilen über das Skript."
- Ziel: aktive Dateien enthalten nur offene Arbeit
  (Documentation-Protocol, kontinuierliche Archivierung).
- Ergebnis: Library-First-Follow-ups #697-#700 (BEHALTEN, 2026-06-17),
  DEP-TS7 #1507 (verfrüht geschlossen), BADGE-CONTENT #2273 (mit #2441
  ausgeliefert) und das `[x] #508` (v1.80.0; die nackte `#508`-Kennung
  passt nicht auf das Archivierer-Muster) raus bzw. ins Archiv
  2026-09. Drei P3-Posten mit falscher Prämisse: DEP-MYPY-2-01 längst
  über Dependabot #263 (mypy 2.x, Pin `>=1.20,<3.0`),
  DEP-ANTHROPIC-105-01 über #2653 (`^0.122.0`) erledigt;
  PERF-EAGER-GLOBS-01 gemessen (Praise 34939 B roh / 5229 B gzip,
  Plugin-Config 386 B / 248 B, die "72 KB"/"28 KB" waren du-Blockgrößen)
  und als Behalten bewertet: ein lazy Praise-Katalog gäbe das erste Lob
  einer Lektion bei Cache-Miss auf Englisch aus.
- Commit: e8b0f387 (PR #3050), f0770d59 (PR #3054)

## 8. Legacy-Alias-Ratchet: Pro-Alias-Zählung exakt gepinnt (#3051)

- Original prompt: (aus 5.)
- Optimierter Prompt: "Schließe die Gate-Lücke TOKEN-ALIAS-GATE-GAP-01
  mit einem vierten Token-Guard: Alias-Namen aus dem Legacy-Block lesen,
  Referenzen je Alias im Konsumenten-TSX zählen, exakt in beide
  Richtungen pinnen, fail closed bei fehlendem Block oder leerem Scope."
- Ziel: die Regel "semantische Token bevorzugen" hat ein Gate; die
  Alias-Nutzung (138 -> 156 Stellen seit der Backlog-Aufnahme) wächst
  nicht mehr still.
- Ergebnis: `legacy-alias-ratchet.test.ts` (10 Tests: sieben
  Helfer-Fälle für gleich/gewachsen/geschrumpft/ohne Pin/veralteter
  Pin/exakter Name/Block-Parsing plus drei Scope-Tests), eingehängt in
  `make verify-theme`. RED-Beweis mit den Backlog-Zahlen (surface +10,
  border +25, danger +32 gegen 558 gescannte Dateien), GREEN mit den
  gemessenen Pins (13 Aliase, 310 Referenzen). design-tokens.md nennt
  den vierten Guard; der Korpus blieb unter der Decke, weil der
  CLI-Gate-Satz kondensiert wurde (Headroom 7). eslint
  `detect-non-literal-regexp` erzwang `split` statt `new RegExp`.
- Commit: 51d68866 (Squash von PR #3052)

## 9. Einstellungen > Plugins: Karte "Installierte Plugins" (#3055)

- Original prompt: (aus 5.)
- Optimierter Prompt: "Baue die Frontend-Hälfte von
  PLUGINFORGE-LIFECYCLE-UI-01: eine Karte im Plugins-Tab, die aus
  `plugins.health()` die aktiven Namen und je Plugin `plugins.inspect()`
  über die Storage-Abstraktion liest; desktop-only über ein neues
  Feature-Id, in Dexie sichtbar mit Hinweis; i18n zuerst als eigener
  PR; Motiv `settings-plugins` und FeatureShot; Testplan DE/EN; Hilfe
  en/de/fr."
- Ziel: die im Mai ausgelieferte Backend-Hälfte bekommt ihre Fläche,
  nachdem die Aufschub-Bedingung ("Settings wird strukturell angefasst")
  mit #2951 eingetreten ist.
- Ergebnis: i18n zuerst (PR #3056, 14 Schlüssel, Terminologie je
  Katalog: Complementos, Extensions, Πρόσθετα, Eklentiler), dann die
  Karte: `PluginLifecycleSection.tsx` liest über `getStorage()` die
  aktiven Namen aus `plugins.health()` und je Plugin
  `plugins.inspect()` (neue Interface-Methode; API delegiert, Dexie
  lehnt ab), zeigt Name, Version, Quelle, lokalisierten
  Aktivierungszeitpunkt und Markierungen für Ladefehler,
  Discovery-Filter und Konfigurationsänderung nach der Aktivierung.
  Neues Feature-Id `PLUGIN_LIFECYCLE` im Desktop-only-Satz: in Dexie
  bleibt die Karte mit Hinweis sichtbar, ohne Aufruf. RED zuerst (Modul
  fehlte), dann 5/5; Feature-Registry- und Delegations-Pins erweitert;
  `Settings.test.tsx` mockt `api.plugins.health`, damit der Seitentest
  nicht ins Netz geht. Erstes Motiv `settings-plugins` (die
  #2486-Lücke), Sync lieferte genau die drei neuen Baselines;
  FeatureShot aus dem Dexie-Preview zeigt den Hinweis über der
  Lern-Repository-Karte. Testplan DE + EN, Hilfe en/de/fr.
- Commit: 9a2a8f8c (Squash von PR #3057)

## 10. Dead-Code-Ratchet in der PR-CI (#3047)

- Original prompt: "mach das: #3047 ... und den rest"
- Optimierter Prompt: "Lass beide Seiten des Dead-Code-Ratchets in den
  bestehenden CI-Jobs laufen (`--only python` im Backend-Job, `--only
  typescript` im Frontend-Job) unter den vorhandenen Pfadfiltern; der
  Wochenlauf bleibt als Vollumfang; Inventur, Cadence-Tabelle und die
  gekoppelten body_sha nachziehen."
- Ziel: die PR, die einen Export hinzufügt, bankt oder entfernt ihn
  selbst; keine vierte Resync-Runde.
- Ergebnis: Zwei Schritte in `ci.yml`, beide lokal exakt wie im Job
  gelaufen (0 neue Funde). `checks.yaml` führt `ci.yml` als Verdrahtung,
  die #575-Tabelle in quality-checks.md nennt den Ratchet; die sechs an
  den Abschnitt gekoppelten Gates bekamen den neuen `body_sha`
  (verify-gate-rule-links hatte die Drift gemeldet, bevor irgendetwas
  gepusht war). Korpus unter der Decke durch Kürzen des zweiten Satzes
  des Abschnitts. Die PR selbst berührt `ci.yml`, also feuerten beide
  Filter und die neuen Schritte liefen auf ihr grün.
- Commit: 4bcd752e (Squash von PR #3059)

## 11. AIV-07: Vorschläge der KI-Prüfung übernehmen (#3060)

- Original prompt: (aus 10., "und den rest")
- Optimierter Prompt: "Schreibe erst die Risiko-Abwägung in EXP-033
  (Owner-Auflage), dann i18n, dann die Umsetzung: Review-Tabelle über
  den feldbezogenen Vorschlägen des set-weiten Checks, nur eigene Sets,
  Schreiben über den Editor-Pfad mit allen Metadaten, Undo-Schnappschuss,
  Cache verwerfen; Tests je Risiko; Testplan, Hilfe, FeatureShot mit
  gemocktem Anbieter."
- Ziel: die letzte offene AIV-Stufe ohne die Gefahr, Erklärungstext in
  Kartenfelder zu schreiben oder fremde Sets zu verändern.
- Ergebnis: Erst die Risiko-Abwägung als eigener PR (#3061, EXP-033 § 8:
  acht Risiken je mit Abhilfe; verworfen wurden ein Ein-Klick "alles
  korrigieren" und ein zweiter KI-Aufruf, der Hinweise in Werte
  verwandelt), dann i18n (PR #3062, 12 Schlüssel in allen 11 Katalogen),
  dann die Umsetzung (PR #3063). `ai-fix.ts` ist reine Logik:
  `planFixes` trennt übernehmbare Kandidaten (bekannte Karte, Textfeld,
  nicht-leerer Vorschlag, vom Ist-Wert verschieden) von manuellen
  Hinweisen, `buildResaveInput` baut die Ganzsatz-Eingabe aus dem
  Katalogeintrag plus allen Lektionen, `applyFixes` liefert Eingabe und
  Undo-Schnappschuss, `undoFixes` stellt nur Felder zurück, deren
  übernommener Wert noch steht. Der Schnappschuss liegt modusunabhängig
  unter `adaptive-learner.ai-fix-undo` (localStorage, in
  `MANAGED_USER_DATA_KEYS`, fährt im Backup mit). Karten-Ids ändern sich
  nie, deshalb kein Remap für den Lernfortschritt. Der Auslöser fehlte:
  der set-weite Check war nur über die Browser-Zeilen heruntergeladener
  Sets erreichbar, also bekamen die Zeilen unter "Meine Inhalte"
  denselben Knopf. Neu sind fünf Module (ai-fix, ai-fix-undo-store,
  useAiFix, AiFixPanel, AiFixReview) plus AiReportStep, der den
  Berichtsblock aus dem Dialog nimmt, damit dieser unter dem
  Complexity-Gate bleibt; 4 FeatureShots (zwei Motive, Desktop und
  Mobil), 3 content-my-lessons-Baselines nachgezogen. Auf dem PR-Head
  gingen zwei Gates rot und wurden in einem eigenen Commit behoben
  (Befunde unten): der in Eintrag 10 frisch verdrahtete Dead-Code-
  Ratchet meldete sechs neue Typen, das Folder-Size-Gate die 16. flache
  Datei in `hooks/content`.
- Commit: ce4a3294 (Squash von PR #3063)

## Befunde neben der Arbeit

- `gh pr checks --json` gibt es in gh 2.46.0 nicht; Warte-Schleifen
  laufen darüber still ins Timeout. Check-Stand über
  `gh api repos/.../commits/<sha>/check-runs` lesen (REST).
- Ein Baseline-Sync-Push mit dem Workflow-Token löst keine PR-CI aus;
  nach einem Sync-Commit ist update-branch oder ein eigener Push nötig,
  sonst bleibt der PR mit drei Check-Runs blockiert. Heute nicht
  bissig, weil der Churn-Restore ohnehin einen Push brachte.
- Ein FeatureShot über einen KI-Dialog braucht keinen echten Anbieter:
  `page.route` auf den Anbieter-Host, die Antwort aus dem Request-Body
  abgeleitet. Zwei Fallen dabei: der Prompt reist als JSON-String (Quotes
  escaped), und sein Antwortbeispiel enthält `"card_id": "..."` VOR der
  echten Kartenliste, also den Platzhalter überspringen.
- `pkill -f <muster>` trifft die eigene Shell, wenn das Muster in der
  eigenen Kommandozeile steht (Exit 144, die &&-Kette stirbt mitten im
  Ablauf). Erst `pgrep` lesen, dann nach PID beenden.
- `make capture-screenshots` rendert ALLE FeatureShots neu und schreibt
  jede PNG; ein Commit während des Laufs scheitert an pre-commit
  ("files were modified by this hook"), und danach sind fremde PNGs
  geändert (heute 35 Dateien plus vier untracked Shots anderer
  Features). Erst abwarten, Churn per `git checkout --` zurücksetzen,
  nur die eigenen PNGs stagen.
- Ein am selben Tag verdrahtetes Gate schlägt zuerst bei der eigenen
  Folge-PR zu: der Dead-Code-Ratchet aus Eintrag 10 meldete auf #3063
  sechs neue Typen. Vier gehörten nur ihrer Datei und verloren den
  Export, zwei sind Props- und State-Typ exportierter Flächen und
  wurden gebankt; `AiCheckState` war seit AIV-06 konsumiert und wurde
  ausgebucht. Genau das ist der Zweck der neuen Cadence: die PR, die
  einen Export einführt, räumt ihn selbst auf, statt eine vierte
  Resync-Runde zu erzeugen.
- Das Folder-Size-Gate zählt flach je Verzeichnis: eine einzige neue
  Datei (`useAiFix.ts`) hob `hooks/content` von 15 auf 16 und machte
  den Job rot. Der Fix ist ein Unterordner mit Barrel nach dem Muster
  von `combine/`, kein Baseline-Eintrag - die Whitelist ist ein
  Ratchet und darf nur schrumpfen. Nebenbefund: knip meldete den
  Barrel-Re-Export NICHT als neuen Fund, anders als beim Anlegen
  anderer Barrels erwartet.
- Ein Ratchet-Lauf gehört hinter die letzte Strukturänderung. Erst den
  Ordner-Split, dann `--update-baseline`: sonst misst die Baseline
  Pfade, die es nach dem Split nicht mehr gibt.
- Die drei Reorder-Stellen waren die dritte Kopie einer Zeilenform;
  `ContentRepoRow` (Integrationen) hat mehr Aktionen pro Zeile und
  bleibt vorerst eigenständig - Kandidat für `ReorderButtons`, wenn sie
  das nächste Mal angefasst wird.

## Fragen und Annahmen

- Umbruch-Variante: die Issue-Beschreibung ließ "Schaltflächen darunter"
  oder "Schaltflächen kompakter" offen; gewählt wurde darunter, weil
  44-px-Ziele bei kompakteren Knöpfen nicht zu halten sind.
- `break-words` blieb auf dem Beschriftungs-Span als Sicherung für sehr
  schmale Viewports (320 px); bei voller Zeilenbreite bricht es nur
  noch, wenn ein einzelnes Wort länger als die Zeile ist.
- Journal-Umfang: die Commits anderer Sessions von heute früh (#3030)
  gehören nicht in dieses Journal.
- "alles was offen weiter" wurde als Arbeitsauftrag in Prioritätsfolge
  gelesen (PRs, Bugs, Infrastruktur, Cleanup, Features), nicht als
  Start eines EXP-Programms; AIV-07 und die Cadence-Frage #3047 blieben
  zunächst beim Owner und wurden nach dessen "mach das ... und den Rest"
  am Nachmittag umgesetzt (Einträge 10 und 11).
- AIV-07-Umfang: "Auto-Fix" wurde als Review-vor-Schreiben gelesen, nicht
  als Ein-Klick-Korrektur; die Begründung steht in EXP-033 § 8, die
  Alternative (zweiter KI-Aufruf für Werte) wurde verworfen.
- Der set-weite KI-Check war für eigene Sets in der UI nicht erreichbar
  (Knopf nur auf Browser-Zeilen heruntergeladener Sets); ohne Auslöser
  wäre AIV-07 tot gewesen, deshalb kam der Knopf auf die Zeilen unter
  "Meine Inhalte" in derselben PR.
- Die Aufstellung der Branches und Testdeltas bis PR #3057 wurde aus
  der Fassung vor dem Merge übernommen und nicht nachgerechnet; nur
  die Gesamtzahlen am Ende der Session sind in dieser Sitzung
  gemessen. Wo beide sich widersprechen, gilt die Messung.
- Deutung von "die Logs sind zu wenig": nicht mehr Datenpunkte derselben
  Art, sondern die fehlenden Klassen (Absicht, Ergebnis, Markierung) -
  hergeleitet aus den acht Auswertungen in #1569, die genau diese drei
  jedes Mal raten mussten.

## Zusammenfassung

- Commits: bis PR #3057 16 auf elf Branches (3 in PR #3037, 1 in PR
  #3038, 1 Restore, 1 Pin + 1 leerer CI-Anstoß in PR #3040, 2 in PR
  #3044, je 1 in den PRs #3045, #3048, #3050, #3052, #3054, #3056,
  #3057), danach 11 auf vier weiteren: 1 in PR #3061, 2 in PR #3062,
  2 in PR #3059, 6 in PR #3063 (vier eigene, zwei Baseline-Syncs des
  Bots). Auf develop stehen daraus 18 Squash-Merges dieser Session
  (`git log --first-parent`, ohne #3030 von heute früh); dieser
  Journal-PR #3064 kommt hinzu.
- Tests: bis PR #3057 +27 Vitest (ReorderRow 6, Pins 2, Sonde 6,
  Legacy-Alias-Ratchet 10, Plugin-Karte 5 minus 2 umgezogene) und +5
  pytest (test_repo_mirror), dazu netto +17 Vitest aus PR #3063 (18
  neue Fälle in sechs Dateien, einer entfernt; keine `.each`-Blöcke,
  also ein `it(` je Test). Am Ende der Session nachgemessen: Frontend
  965 Dateien / 10089 Tests grün (`bunx vitest run` auf dem gemergten
  Baum), Backend 1837 gesammelt (`pytest --collect-only`). Beide
  weichen von den zuvor notierten 10066 und 1835 ab, und die Differenz
  lässt sich mit den Commits danach nicht erklären: nach jener Notiz
  hat kein Commit Backend-Tests berührt, und von den drei PRs vor
  #3063 keiner eine Testdatei. Es gilt der gemessene Wert. Dead-Code-
  und Alias-Ratchet grün; Sync für #3044 0 Diff, für #3057 genau die
  drei neuen Motive.
- Neue Dateien: `ReorderRow.tsx` (+ Test), `repo_mirror.py` (+ Test),
  `legacy-alias-ratchet.test.ts`, `PluginLifecycleSection.tsx` (+ Test),
  `docs/roadmap-archive/2026-09.md`; `pinUserBadgesEmpty` in den
  Visual-Helpern; Protokollarten `click`/`focus`/`mark` in `vv-log.ts`;
  Motiv `settings-plugins`. Aus PR #3063 neun weitere: `ai-fix.ts`,
  `ai-fix-undo-store.ts`, `useAiFix.ts` im neuen Ordner
  `hooks/content/ai-fix/` mit Barrel, `AiFixPanel.tsx`,
  `AiFixReview.tsx`, `AiReportStep.tsx` und die beiden neuen
  Testdateien.
- Bilder: 3 FeatureShots neu, 19 Baselines nachgezogen, 1 zurückgesetzt,
  3 Baselines neu (settings-plugins); aus PR #3063 4 FeatureShots neu
  (zwei Motive je Desktop und Mobil) und die drei
  content-my-lessons-Baselines nachgezogen.
- Issues: #3027, #3035 geschlossen; #3036, #3043, #3046, #3049, #3051,
  #3053, #3055 angelegt und per PR geschlossen; #3047 (Cadence-Vorschlag)
  nach der Owner-Freigabe per PR #3059 geschlossen; #3060 (AIV-07)
  angelegt und per PR #3063 geschlossen. Offen bleibt dieser
  Journal-PR #3064.
