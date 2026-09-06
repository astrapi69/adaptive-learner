# Chat-Journal 2026-09-06

Brainstorming und Phase 1 zum Feld `explanation` (Engine-Schema 1.13),
über zwei Repositories: learn-content-engine (Autorenrichtlinie) und
adaptive-learner (Rendering). Branch in beiden Repos:
claude/explanation-field-brainstorm-wpkafg.

## 1. Brainstorming: was eine Erklärung leistet und wo sie hingehört (13:40)

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

## 2. Issues und Phase 1 (14:20)

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
    `docs/lesson-format.md` (Regel, Wort für Wort, Beispiele, typischer
    Fehler, Budget, Übungstypen, Wiederholung, Domänen), CHANGELOG
    Unreleased; `make prose-check` grün; PR learn-content-engine#148.
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

## Fragen und Annahmen

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
