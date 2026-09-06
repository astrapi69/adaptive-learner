# Chat-Journal 2026-09-06

Zwei Sessions an diesem Tag, je ein Branch und ein PR gegen develop:
die CI-Rot-Session (Abschnitt A, PR #2989) und die Fortsetzung der
Reorganisation Einstellungen > Lernen (Abschnitt B, PR #2990).

## A. CI-Rot-Session (Branch claude/ci-rot-34ads1)

CI-Rot-Session: drei rote Nacht-Läufe geprüft und behoben. Branch:
claude/ci-rot-34ads1, PR gegen develop. Die Lifecycle-Matrix im
Schwesterrepo docker-app-launcher (Issue docker-app-launcher#131) lief
in derselben Session und ist dort dokumentiert.

### 1. content-stats.yml rot: README CONTENT-STATS veraltet (#2987) (08:00)

- Original prompt: "CI ist rot. Checken und fixen."
- Optimierter Prompt: "Prüfe alle roten Workflow-Läufe beider Repos,
  lies die Job-Logs, reproduziere lokal und behebe jede Ursache mit
  Issue, Test und PR."
- Ziel: den nächtlichen Content-Stats-Gate wieder grün bekommen.
- Ergebnis: das Content-Repo ist auf 329 Lektionen gewachsen (vier
  Französisch-Sets je +1) und acht Set-Titel wurden vom Gedankenstrich
  auf Bindestrich umbenannt. Block mit
  `validate_bundled_content.py --write-readme` gegen einen frischen
  Checkout regeneriert, `--check-readme` danach grün. Keine App-Ursache.

### 2. dead-code.yml rot: 23 neue knip-Funde, 1 aufgelöster (#2988) (08:05)

- Ziel: den wöchentlichen Dead-Code-Ratchet wieder grün bekommen, ohne
  blind zu banken oder blind zu löschen (#2486).
- Ergebnis: alle 23 Funde einzeln gegen den Quellbaum geprüft. 20 sind
  Barrel-Re-Exports der Settings-Controls (Regel reusability.md, #1275)
  plus der öffentliche Label-Typ einer shared-Komponente, alle wie die
  bereits gebankten Geschwister in die Baseline aufgenommen. Zwei echte
  Tote gelöscht: der Default-Export von `SettingsDisclosure` (jeder
  Konsument nutzt den benannten Export) und das `export` an
  `PLAYFUL_DETAILS_OPEN_KEY` (nur dateiintern genutzt). Aufgelöster
  Eintrag `i18n/engine.ts::NAMESPACE` via `--update-baseline` gebankt.
  Lokal: `check_dead_code.py` sauber, tsc, eslint und die zwei
  betroffenen Vitest-Dateien grün.

### Zusammenfassung

- Commits: 1 (README-Regenerat, Baseline, zwei Quell-Löschungen,
  Journal), PR gegen develop.
- Tests: 19 Vitest-Tests der beiden betroffenen Dateien grün, keine
  neuen Tests (Ratchet-Resync und Docs-Regenerat, kein Verhalten).
- Offene Fragen und Annahmen: Barrel-Exports werden gebankt und nicht
  gelöscht, weil die Regel sie fordert; das Precedent ist #2917/#2920.

## B. Einstellungen > Lernen, Stufe 3/4 (Branch claude/lernen-reorganisation-fortsetzung-vu3w29)

Fortsetzung der Reorganisation Einstellungen > Lernen (Umbrella #2951):
Stufe 3/4 und die zwei Housekeeping-Issues. Remote-Session (Cloud-
Container) auf dem vorgegebenen Branch
`claude/lernen-reorganisation-fortsetzung-vu3w29`, PR gegen develop.

### 1. Bestandsaufnahme: die Agenten-Worktrees existieren hier nicht

- Original prompt: die Übergabe-Notiz vom 2026-09-05 ("Weiterführung:
  Einstellungen > Lernen Reorganisation") mit vier unfertigen
  Worktrees (#2961, #2962, #2964, #2966).
- Optimierter Prompt: "Prüfe zuerst, ob die lokalen Worktree-Stände auf
  origin liegen; wenn nicht, implementiere die vier Issues von develop
  aus neu, in der Reihenfolge #2961, #2962, #2964, #2966."
- Ziel: nicht auf Arbeitsstände bauen, die in dieser Umgebung nicht
  existieren.
- Ergebnis: kein `feat/2961-*`, `feat/2962-*`, `chore/2964-*` auf
  origin, keine Worktrees im Container; develop = d3724ac. Frontend- und
  e2e-Abhängigkeiten installiert (bun), kein Backend-venv (nicht nötig,
  alle vier Issues sind Frontend + Docs). Ausgangslage: Settings-Tests
  37/37 grün.
- Commit: kein Code.

### 2. #2961 Sektionsleiste + `?section=`-Deep-Link

- Original prompt: Issue #2961 plus Übergabe-Spec (SettingsSubNav
  props-driven, `aria-current="location"`, sticky nur md+, horizontal
  scrollbar bei 375 px, `lib/settings/learning-sections.ts`,
  `useDeferredScroll` aus dem Key-Vault-rAF-Loop gehoben, `?section=`
  validiert und bei Tab-Wechsel entfernt, Arcade-Gate-Link auf
  `section=motivation`, Scroll-Spy ausdrücklich nicht).
- Optimierter Prompt: "RED zuerst: Modell-Test, SubNav-Test,
  Deferred-Scroll-Test, Seiten-Integrationstest (Deep-Link, unbekannter
  Wert, Tab-Wechsel, Chip-Klick mit replace-state) und der Arcade-Link;
  dann die Implementierung; danach e2e-Helfer, FeatureShot, Hilfe
  en/de/fr, Testplan DE+EN."
- Ziel: die Leiste als reine Präsentationskomponente, das URL-Verhalten
  in einem Hook, der Scroll-Loop wiederverwendbar.
- Ergebnis: `learning-sections.ts` (reine Daten, Barrel-Export),
  `SettingsSubNav` (Chips, `ref` als Prop, aktiver Chip wird in der
  Zeile sichtbar gescrollt, sticky md+ mit gemessenem Header-Offset),
  `useDeferredScroll<T>` (bounded rAF-Loop, `onSettled(inView)`; die
  Key-Vault-Stelle in Settings.tsx nutzt ihn jetzt),
  `useLearningSections` (Request validiert gegen die gerenderten
  Cluster, Chip-Klick schreibt replace-state, reduced-motion => instant),
  `useLearningAnchorOffset` (misst `.app-nav` + Leiste statt eines
  69-px-Literals; die Cluster lesen `--settings-anchor-offset` in ihrer
  `scroll-margin-top`), `setActiveTab` löscht `section`, Arcade-Link.
  Tests: 4 + 6 + 5 + 6 + 1 neu (RED vorher beobachtet: 6 rot). Neue
  Testdatei `Settings.sections.test.tsx`, damit `Settings.test.tsx`
  unter der 1000-Zeilen-Grenze bleibt. e2e: `SettingsPage.ts`-Helfer
  (`gotoLearningSection`, `openLearningSection`), FeatureShot
  `learning-subnav/settings`, README-Zeile. Hilfe en/de/fr (settings.md,
  arcade.md), Testplan-Block DE+EN.
- Commit: aa7f579 (Code), 9170ee9 (e2e/Docs).

### 3. #2962 Gamification in den Motivation-Cluster

- Original prompt: Issue #2962 plus Übergabe-Spec (letzte Karte hinter
  Trenner `mt-8 border-t-2 border-border pt-8`, #1459-Literal +
  Letzte-Karte-Invariante, `pickTab("plugins")` -> `"learning"`, Hilfe
  in jeder Locale unter Lernen als `###`, Testplan, FeatureShot
  `gamification-card`).
- Optimierter Prompt: "RED: erweitere Reihenfolge- und
  Cluster-Membership-Pins um `settings-section-gamification` als letzte
  Karte und pinne den Trenner; dann PluginsPanel/LearningPanel
  umbauen."
- Ziel: die Gamification-Karte dorthin, wo Spielmodus, Feedback,
  Missionen und Erinnerungen sind; der Plugins-Tab behält das
  Lern-Repository.
- Ergebnis: Karte in einem `settings-gamification-separator`-Wrapper am
  Cluster-Ende; RED per Stash gegen die alten Panels belegt (3 rot),
  danach 38/38 grün. Hilfe: `## Gamification` -> `###` in allen acht
  Locales, der Satz "Der Tab endet mit den Erinnerungen" in jeder
  Sprache angepasst, fr mit `####`-Unterüberschriften; Testplan-Block
  DE+EN; e2e-Spec öffnet die Abzeichen-Galerie vom Lernen-Tab;
  FeatureShot + README-Zeile.
- Commit: 24f9c44.

### 4. #2964 tote Settings-Exporte

- Original prompt: Issue #2964 plus Übergabe ("jeden Kandidaten gegen
  den AKTUELLEN Baum prüfen; intern konsumiert bleibt").
- Optimierter Prompt: "Skript über alle Exporte der Pref-/Hook-Module;
  entferne nur Exporte ohne Nicht-Test-Konsumenten, die das Modul auch
  selbst nicht liest."
- Ziel: kein blindes Löschen nach einer Liste, die vor #2971/#2975/#2979
  entstand.
- Ergebnis: entfernt `useDirectionStrategy` (nur der Barrel), die Gates
  `playfulHeartsActive`/`playfulCountdownActive` (nur ihre Tests; der
  Lesson-Runner kombiniert `usePlayfulTension` mit `usePlayfulMode`)
  und `LESSON_MODE_OPTIONS` (kein Konsument, Eintrag in <!-- doc-ref-exempt: the removed dead export itself (#2964) -->
  `.dead-code-baseline.json` gebankt). Bewusst behalten: `DEFAULT_*`-
  Konstanten, `playfulComboXpActive`, `refreshApiKeyStatus` (intern
  gelesen). Nicht angefasst, weil außerhalb der Issue-Formulierung
  (Pref-Module, `read*`/`*Active`): `useTooltipProps` und
  `isViewportDiagnosticEnabled` haben ebenfalls nur Test-Konsumenten.
- Commit: b4e0edb.

### 5. #2966 Scroll-Spy + `headingLevel`

- Original prompt: Issue #2966 (IntersectionObserver-Scroll-Spy,
  `?section=`-Request gewinnt bis der deferred scroll "in view" meldet,
  happy-dom braucht einen Stub; `headingLevel`-Prop auf
  SettingsSection, h3 in Clustern).
- Optimierter Prompt: "Hook `useScrollSpy(ids, {enabled, resolve,
  topOffset})` mit Band vom Sticky-Offset bis 50 Prozent Viewport,
  erster schneidender Abschnitt in Listenreihenfolge, letzter Wert
  bleibt bei Leere; aktiver Chip = pending ?? spy ?? request.
  Heading-Level per Prop plus Kontext aus SettingsCluster, damit die
  ~20 Controls unangetastet bleiben."
- Ziel: die Leiste folgt dem Scrollen, die Überschriften-Hierarchie im
  Lernen-Tab wird ein Baum.
- Ergebnis: `useScrollSpy`, `SettingsHeadingLevelContext` (Cluster
  liefert 3, Prop gewinnt), Tests: 4 Hook-Tests mit aufzeichnendem
  IO-Stub, 2 SettingsSection-Tests, 3 Integrationstests (Spy ohne
  Request, Request gewinnt bei eingefrorenem rAF, Übergabe nach
  in-view). RED vorher beobachtet (4 rot). Testplan DE+EN und Hilfe
  en/de/fr um die Folge-Hervorhebung ergänzt.
- Commit: 43fb83b.

### 6. Feature-Screenshots decken zwei Scroll-Befunde auf

- Original prompt: Übergabe ("Feature-Screenshots, Visual-Baseline-Gate
  bei UI-PRs").
- Optimierter Prompt: "Nimm die neuen und die betroffenen Lernen-Tab-Shots
  im Container auf (Chromium vorinstalliert, Playwright-Pin verlangt eine
  andere Headless-Shell: executablePath per Session-Config überschreiben,
  nicht committen) und sieh jede Aufnahme an, bevor sie ins Repo geht."
- Ziel: die Shots als echte Prüfung nutzen, nicht als Pflichtabgabe.
- Ergebnis: Zwei Befunde. (1) Der learning-subnav-Shot landete 86 px zu
  tief: die Deferred-Scroll-Schleife gab den weichen scrollIntoView jede
  Frame erneut aus und kämpfte damit gegen den Instant-Pin des
  Shot-Helfers (live gemessen: der Deep-Link allein landet korrekt bei
  129 px). Fix: erneut ausgeben nur, wenn das Ziel seit der letzten Frame
  stillsteht (+1 Hook-Test); das Shot-Setup wartet bis der Cluster im
  Viewport ist. (2) Karten innerhalb des Lernen-Tabs hatten keinen
  Anker-Offset, ein scrollIntoView auf eine Karte landete unter der
  sticky Leiste (sichtbar am feedback-card-Shot). Fix: jede
  SettingsSection liest `--settings-anchor-offset` in ihre
  scroll-margin-top (0 außerhalb des Lernen-Panels).
- Commit: 9fe1751 (Scroll-Schleife), 8832e69 (Karten-Offset).

### 7. Verifikation, Docs, PR

- Original prompt: Übergabe ("Vollsuite, make check-testid-refs
  check-file-sizes verify-docs-discipline, push, PR, Visual-Gate-Label,
  Journal, CLAUDE.md/architecture.md prüfen").
- Optimierter Prompt: "Führe alles aus, was ohne Backend-venv läuft,
  nenne explizit, was nicht lief."
- Ziel: ein PR, den der Owner mit dem bekannten Ablauf mergen kann.
- Ergebnis: siehe Abschnitt "Prüfläufe" und den PR-Text.
- Commit: siehe Docs-Commit.

### Prüfläufe

- `bunx tsc --noEmit`: sauber. ESLint auf allen geänderten Dateien mit
  `--max-warnings=0`: sauber.
- Vitest voll (`cd frontend && bun run test`): 948 Dateien, 9896 Tests,
  alle grün (264 s).
- `make check-file-sizes`: 0 Fehler (62 Warnungen, Bestand).
- `scripts/testid_reference_gate.py --base origin/develop`: nicht
  anwendbar (kein testid entfernt oder umbenannt).
- `scripts/verify_docs.py`: 0 FAIL, 1 WARN (help-coverage-Heuristik,
  Bestand). `verify-mkdocs-nav` und `verify-docs-hygiene` brauchen die
  docs-/backend-venvs und liefen hier nicht.
- `scripts/verify_normative_changes.py --base origin/develop`: keine
  normativen Änderungen. Rule-Corpus-Ceiling bewusst um 463 Zeichen
  angehoben (architecture.md: Absatz zur Lernen-Tab-Navigation).
- Feature-Screenshots: Dexie-Build + Playwright-Capture im Container mit
  dem vorinstallierten Chromium (executablePath-Override in einer nicht
  committeten Session-Config); neu: learning-subnav, gamification-card;
  erneuert: learning-clusters, feedback-card, playful-details (2),
  mascot-variants. Jede Aufnahme angesehen (siehe Eintrag 6).
- Nicht gelaufen: `make test` (Backend + Plugins, kein venv; die
  Änderung berührt kein Python), `make test-dexie-smoke`.

### Fragen und Annahmen

- Ein Branch, ein PR: die Session-Vorgabe pinnt den Branch
  `claude/lernen-reorganisation-fortsetzung-vu3w29` und verbietet Pushes
  auf andere Branches. Die vier Issues liegen daher als getrennte
  Commits auf einem PR (Closes #2961, #2962, #2964, #2966), obwohl die
  Übergabe vier PRs vorsah. Die Reihenfolge-Abhängigkeit (#2962 und
  #2966 nach #2961) ist damit ohnehin erfüllt. Ein Split in vier PRs ist
  eine Owner-Entscheidung (Branches abzweigen, cherry-pick).
- Journal und Docs liegen im selben PR statt in einem eigenen Docs-PR,
  aus demselben Grund.
- Sticky-Offset: kein 69-px-Literal, sondern Messung von `.app-nav` und
  Leiste (Kopfzeilenhöhe variiert je Viewport/Locale); Fallback 4rem
  in der Cluster-Klasse.
- Innerhalb der Spielmodus-Karte tragen die drei Detail-Blöcke weiter
  `<h3>`; mit dem Kartentitel als `<h3>` ist das eine flache Stufe. Ein
  `<h4>` dort wäre ein eigener, kleiner Folge-Schritt (nicht im Issue).
- Ordner-Watcher: `hooks/settings` ist bei 15 flachen Dateien gedeckelt;
  die zwei Scroll-Hooks liegen deshalb in `hooks/ui` (neben
  `useScrollDirection`), nicht bei den Settings-Hooks.
- Visual-Baseline-Sync: zwei Labels in einem API-Aufruf setzen feuert
  zwei `labeled`-Events; der Lauf für `refresh-visual-baselines` wurde von
  der Concurrency-Gruppe gecancelt, der für `ui` übersprungen. Das Label
  darum immer allein und nach dem letzten Push setzen.
- Visual-Baselines (Sync-Lauf 34036362746, Commit b7434ac): genau die
  drei `settings-learning-*`-Motive geändert, jedes einzeln angesehen
  (Leiste über den Clustern, aktiver Chip "Grundlagen" per Scroll-Spy,
  am Handy die seitlich scrollende Zeile); kein fremdes Churn, nichts
  zurückgesetzt.
- Konservativ angenommen: `?section=` schreibt der Scroll-Spy nie in die
  Adresse (nur Chip-Klick und Deep-Link), damit Scrollen keinen
  replace-state-Sturm erzeugt.

## C. Erklärung nach der Antwort (Branch claude/explanation-field-brainstorm-wpkafg)

Brainstorming und Phase 1 zum Feld `explanation` (Engine-Schema 1.13),
über zwei Repositories: learn-content-engine (Autorenrichtlinie) und
adaptive-learner (Rendering). Branch in beiden Repos:
claude/explanation-field-brainstorm-wpkafg.

### 1. Brainstorming: was eine Erklärung leistet und wo sie hingehört (13:40)

- Original prompt: "Wir haben ja ein Feld explanation ... bei Sprachen,
  dass man die Syntax erklärt also Wort für Wort und warum das so ist
  und dann ein paar Beispielsätze ... machen wir erst mal ein
  Brainstorming ... Erklär mir, wo am besten das zu implementieren ist."
- Optimierter Prompt: "Analysiere den Ist-Zustand von
  `Exercise.explanation` in Engine und App, sammle Best Practices für
  Post-Answer-Erklärungen (Regel, Wort-für-Wort-Glosse, Beispiele),
  bewerte Format-Optionen (Markdown vs. Struktur) und ordne jede
  Aufgabe Engine, App oder Content zu; Ergebnis als Markdown-Dokument."
- Ziel: fundierte Entscheidungsgrundlage vor der Implementierung.
- Ergebnis: Befund "Engine hat den Vertrag (Markdown, 2000 Zeichen,
  nach der Antwort), die App trägt das Feld im Typ und rendert es
  nirgends". Empfehlung: Markdown mit dokumentierter Konvention jetzt,
  strukturierte Glosse erst nach Content-Audit; Vertrag und
  Autorenrichtlinie in der Engine, Rendering, Setting, KI-Generierung
  und Editor in der App; Aufhängepunkt die Exercise-Shell, nicht die
  Renderer. Dokument als Artifact plus Markdown-Datei geliefert.
- Commit: keiner (Analyse).

### 2. Issues und Phase 1 (14:20)

- Original prompt: "ja dann weiter".
- Optimierter Prompt: "Übernimm die Empfehlungen aus Abschnitt 7,
  lege die drei Issues an und setze Phase 1 um: Rendering in der App
  mit Tests, Testplan und Screenshot-Eintrag; Autorenrichtlinie in
  der Engine."
- Ziel: das Feld sichtbar machen, ohne Engine-Schema-Änderung.
- Ergebnis:
  - Issues: adaptive-learner #2991 (Rendering), #2992 (KI-Generierung
    und Editor, Phase 2), learn-content-engine #147 (Autorenrichtlinie).
  - Engine: Abschnitt "Writing a good explanation" in
    `docs/lesson-format.md` (Regel, Wort für Wort, Beispiele, typischer <!-- doc-ref-exempt: Pfad im Engine-Repo learn-content-engine -->
    Fehler, Budget, Übungstypen, Wiederholung, Domänen), CHANGELOG
    Unreleased; `make prose-check` grün; PR learn-content-engine#148. <!-- doc-ref-exempt: Make-Target im Engine-Repo -->
  - App: `ExerciseExplanation` (feedback/), EINMAL in der
    `ExerciseDispatcher`-Shell gemountet (alle Renderer inklusive
    Extensions, alle Flächen); aufgeklappt nach falscher Antwort,
    eingeklappt hinter "Warum?" nach richtiger und beim Revisit;
    Gate über das bestehende Setting `explanations_enabled` (Label in
    11 Katalogen umformuliert, gleicher Schlüssel, keine Migration)
    und `immediateFeedback` (Prüfungsmodus versteckt). Drei neue
    i18n-Schlüssel `lesson.explanation.*` in 11 Katalogen.
  - Tests: 8 Vitest (Komponente) plus 4 Vitest (Dispatcher-Wiring),
    Fixture `explanation-post-answer.lesson.json` plus Dexie-Spec
    `exercise-explanation.spec.ts` (im Container gegen den echten
    Dexie-Build gelaufen: 3 passed), Testplan DE+EN, FeatureShot-Eintrag
    `exercise-explanation/falsche-antwort` (PNG-Aufnahme steht aus, wie
    üblich auf der konsistenten Maschine), Hilfe settings.md DE+EN.
  - Gates lokal: tsc, eslint, Vitest voll (945 Dateien, 9872 Tests),
    `test_i18n_parity.py` (51), `verify-i18n-scripts`, `verify-docs`
    (0 FAIL, 1 WARN). `verify-mkdocs-nav` konnte nicht laufen (docs-venv
    ohne PyYAML im Container); `_meta.yaml` und `mkdocs.yml` sind
    unberührt.
- Commit: siehe PR-Zweig (#2991: i18n, Feature).

### 3. Phase 2: Erklärungen generieren und bearbeiten (15:20)

- Original prompt: "ist grün und gemerged, mach weiter".
- Optimierter Prompt: "Setze Issue #2992 um: Opt-in-Erklärungen im
  KI-Übungsgenerator (Prompt, Parser, Mapping, Kontrollkästchen im
  Buchtext-Schritt) und ein Markdown-Feld mit Zähler und Vorlage im
  Inline-Editor, mit Tests, i18n in 11 Katalogen und Testplan DE+EN."
- Ziel: die App erzeugt das Feld, das Phase 1 sichtbar macht.
- Ergebnis:
  - Prompt (`exercise-generation-prompt.ts`): Option `explanations`;
    nur dann ein EXPLANATIONS-Block, der die Konvention der Engine
    (Regel, Wort für Wort, weitere Beispiele, typischer Fehler) und ein
    weiches Budget von 1200 Zeichen nennt. Er nennt nur die angebotenen
    Typen, die etwas zu erklären haben (Lückentext, Wortkacheln,
    Freitext, Multiple Choice, Fehlerkorrektur), nie Zuordnung oder
    Bildauswahl, und respektiert die Typ-Auswahl (#2510). Das
    Beispiel-JSON trägt dann eine ausgearbeitete Erklärung.
  - Pipeline: `generateExercises` reicht die Option durch und hebt den
    Antwort-Deckel von 2000 auf 3200 Tokens, sonst schneidet das Modell
    das JSON mitten in einer Karte ab. `generateBookLessonContent`
    (Einzel- und Batch-Pfad) reicht sie ebenfalls durch.
  - Parser: `explanation` wird auf jeder Karte (Kern und Text-Extension)
    getrimmt übernommen und bei 2000 Zeichen abgeschnitten; alles, was
    kein String ist, fällt still weg, die Karte bleibt. `cardsToExercises`
    kopiert das Feld auf die Übung.
  - Editor: `fields/ExplanationField` (Markdown-Textarea, Zähler
    "n / 2000 Zeichen", "Vorlage einfügen" nur solange leer, die Vorlage
    kommt lokalisiert aus dem Katalog), gemountet in `ExerciseEditor` UND
    `ExtensionExerciseEditor`. `normalizeExerciseEdit` /
    `normalizeExtensionExercise` trimmen und ENTFERNEN den Schlüssel bei
    leerem Feld (kein `explanation: ""` im JSON); beide Validatoren
    liefern den Code `explanation` bei mehr als 2000 Zeichen.
  - Buchtext-Schritt: Kontrollkästchen "Erklärungen generieren" unter
    der Typ-Auswahl, standardmäßig aus und bewusst NICHT gemerkt (es
    kostet KI-Ausgabe, jeder Lauf fragt neu).
  - i18n: `create_lesson.book.explanations_label/_hint`,
    `create_lesson.exercises.edit.explanation_*` (fünf Schlüssel plus
    `err_explanation`) und `create_lesson.extensions.edit.err_explanation`
    in 11 Katalogen; die Vorlage ist ein Double-Quoted-String mit `\n`
    (kein Block-Skalar, die Kataloge nutzen keine).
  - Tests: Prompt (6), Pipeline (1), Buch-Pipeline (1), Parser (7, davon
    ein `it.each` über vier Drop-Fälle), Mapping (1), Normalizer Kern (6)
    und Extension (2), `ExplanationField` (4), `ExerciseEditor` (5),
    `ExtensionExerciseEditor` (1), `BookTextStep` (3). Testplan DE+EN
    (Assistent und Editor), zwei FeatureShot-Einträge
    (`create-lesson/erklaerungen-opt-in`, `exercise-explanation/editor-feld`,
    PNG-Aufnahme wie üblich auf der konsistenten Maschine).
- Commit: siehe PR-Zweig (#2992: i18n, Feature).

### Fragen und Annahmen (Phase 2)

- Opt-in nicht gemerkt: die Typ-Auswahl (#2510) wird gemerkt, das
  Erklärungs-Kontrollkästchen bewusst nicht. Begründung: ein gemerkter
  Haken würde bei jedem späteren Lauf still Tokens kosten. Wer das
  Gegenteil will, kann es über `saveAssistantTypes`-Muster nachrüsten.
- Kürzen statt verwerfen: eine Erklärung über 2000 Zeichen wird im
  Parser abgeschnitten, nicht die Karte verworfen. Ein hartes Ende mitten
  in einer Liste ist hässlich, aber besser als eine verlorene Übung; das
  Prompt-Budget von 1200 hält den Fall selten.
- Sprache der Erklärung: der Prompt sagt "in der Sprache der Theorie".
  Die Engine-Konvention verlangt die Sprache des Lernenden
  (`source_language`); im Buchtext-Pfad ist das die Sprache des
  eingefügten Textes, also dasselbe. Für eine Sprachlektion, deren Text
  in der Zielsprache steht, wäre das falsch, dieser Pfad existiert im
  Assistenten aber nicht (er erzeugt Wissenslektionen aus Text).
- Kein Erklärungsfeld im reinen Karten-Generator (`generateExercises`
  aus `lib/exercises`, deterministisch): der hat kein Modell, das eine
  Regel formulieren könnte. Dort bleibt der Weg der Inline-Editor.

### Fragen und Annahmen

- Setting: EIN Schalter für autorisierte Erklärungen und die
  generischen Fehlererklärungen (#599), umformuliert zu "Erklärungen
  anzeigen". Gleicher Schlüssel, keine Migration; die Alternative (zwei
  Schalter) bleibt offen, falls Aster die Kanäle getrennt haben will.
- Auto-Advance nach richtiger Antwort bleibt unverändert; eine
  eingeklappte Erklärung ist dort nur erreichbar, wenn Auto-Advance aus
  ist. Ob eine vorhandene Erklärung den Sprung unterdrücken soll, ist
  eine offene Produktentscheidung (im Issue #2991 dokumentiert).
- Unkontrollierte Flächen (Review, Adaptive): "Nochmal versuchen"
  setzt den Renderer zurück, nicht die Shell; die Erklärung bleibt bis
  zur nächsten Prüfung sichtbar. Ein `onReset` im Renderer-Vertrag
  würde alle Renderer berühren und ist bewusst nicht Teil von Phase 1.
- Die bestehenden Dexie-Specs mit Repo-Connect-Flow (z. B.
  `multiple-choice-device-check.spec.ts`) schlagen im Container am
  gesperrten GitHub-Pages-Kanal fehl (Proxy 403, Sektion bleibt
  `aria-busy`); der neue Spec mockt darum den offiziellen Index leer
  (Muster aus `combine-lessons.spec.ts`) und ist hermetisch. Kein
  Befund gegen die App.
- TTS für den Erklärungstext ist aufgeschoben: der Dispatcher hat
  keinen `ReadAloudController`.
- Content-Audit (haben die Content-Repos schon `explanation`-Felder?)
  konnte nicht laufen: die Content-Repos sind nicht in der Session.
