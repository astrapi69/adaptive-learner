# Chat-Journal 2026-09-06

Fortsetzung der Reorganisation Einstellungen > Lernen (Umbrella #2951):
Stufe 3/4 und die zwei Housekeeping-Issues. Remote-Session (Cloud-
Container) auf dem vorgegebenen Branch
`claude/lernen-reorganisation-fortsetzung-vu3w29`, PR gegen develop.

## 1. Bestandsaufnahme: die Agenten-Worktrees existieren hier nicht

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

## 2. #2961 Sektionsleiste + `?section=`-Deep-Link

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

## 3. #2962 Gamification in den Motivation-Cluster

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

## 4. #2964 tote Settings-Exporte

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
  und `LESSON_MODE_OPTIONS` (kein Konsument, Eintrag in
  `.dead-code-baseline.json` gebankt). Bewusst behalten: `DEFAULT_*`-
  Konstanten, `playfulComboXpActive`, `refreshApiKeyStatus` (intern
  gelesen). Nicht angefasst, weil außerhalb der Issue-Formulierung
  (Pref-Module, `read*`/`*Active`): `useTooltipProps` und
  `isViewportDiagnosticEnabled` haben ebenfalls nur Test-Konsumenten.
- Commit: b4e0edb.

## 5. #2966 Scroll-Spy + `headingLevel`

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

## 6. Feature-Screenshots decken zwei Scroll-Befunde auf

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

## 7. Verifikation, Docs, PR

- Original prompt: Übergabe ("Vollsuite, make check-testid-refs
  check-file-sizes verify-docs-discipline, push, PR, Visual-Gate-Label,
  Journal, CLAUDE.md/architecture.md prüfen").
- Optimierter Prompt: "Führe alles aus, was ohne Backend-venv läuft,
  nenne explizit, was nicht lief."
- Ziel: ein PR, den der Owner mit dem bekannten Ablauf mergen kann.
- Ergebnis: siehe Abschnitt "Prüfläufe" und den PR-Text.
- Commit: siehe Docs-Commit.

## Prüfläufe

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

## Fragen und Annahmen

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
- Konservativ angenommen: `?section=` schreibt der Scroll-Spy nie in die
  Adresse (nur Chip-Klick und Deep-Link), damit Scrollen keinen
  replace-state-Sturm erzeugt.
