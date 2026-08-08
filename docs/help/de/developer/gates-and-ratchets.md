# Tore, Ratchets und Zweigschutz

Dieses Projekt ist ungewöhnlich streng - und trotzdem steht fast
nichts davon dort, wo ein Mensch es liest. Dutzende CI-Tore, eine
Familie von Ratchets mit eingefrorenen Grundlinien, Vorgangs- und
Pull-Request-Pflicht, ein Test-Vertrag für Tore und ein Zweigschutz,
der auch für Administratoren gilt: das alles lebt in den
agentenseitigen Regeldateien unter
[`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).
Diese Seite ist die menschliche Landkarte: was jeder Mechanismus ist,
warum es ihn gibt und - der Teil, der wirklich zählt, wenn du
blockiert bist - was zu tun ist.

Nichts hier wiederholt eine Norm. Wo eine Regel die verbindliche
Formulierung trägt, verweist diese Seite darauf und erklärt sie. Die
Regeln sind die Quelle der Wahrheit; eine zweite Fassung würde driften,
und genau das ist in diesem Bestand mehrfach belegt.

## Zwei Takte: PR-Tore und die Nachtschicht

Ein grüner Pull Request bedeutet **nicht**, dass `develop` grün ist.
Die PR-CI fährt nur die Korrektheits-Tore - jene, deren Fehlschlag
einen Merge blockieren muss. Alles Informative, nur Warnende oder von
äußerem Zustand Getriebene läuft in der Nachtschicht (ein nächtlicher
Zeitplan plus `workflow_dispatch`).

| Läuft bei jedem PR | Läuft nächtlich + beim Release |
|---|---|
| Backend-/Plugin-/Frontend-Tests, ruff + mypy, pre-commit, Docs-Drift-Prüfer | Sicherheits-Scan (pip-audit / bun audit / bandit) |
| Komplexitäts-Ratchet, Ordner- und Dateigrößen-Wachen | Deckungsbericht (Bericht, kein Tor) |
| Visual-Baseline-Tor, Testid-Referenz-Tor | Dexie-Modus-E2E, Visuelle Regression, Mutationstests |
| docker-build-smoke (pfadgefiltert) | Content-Stats-Drift, WebKit-Tor |

Die Folge: eine Änderung an einer Fläche, die nur die Nachtschicht
prüft, kann einen sauberen PR mergen und den nächsten nächtlichen Lauf
rot färben. Das ist eine bekannte, wiederkehrende Risikoklasse, kein
Einzelfall. Die maßgebliche Tabelle und die Begründung stehen in
[`quality-checks.md` -> "CI cadence: PR gates vs the night shift"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

## Was ein Tor ist - und was nicht

Ein Tor ist eine Prüfung, die **geschlossen fällt** (fail closed). Der
Test-Vertrag des Projekts (fünf Tests je Tor) steht in
[`quality-checks.md` -> "Gate test contract"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).
Die zwei Regeln, die du als Beitragender spürst:

- **Ein Tor, das nicht prüfen kann, meldet niemals grün.** "Ich konnte
  nicht laufen" ist nicht "es gibt nichts zu finden". Fehlt die
  Grundlage eines Tors (fehlende Grundlinie, abgestürzter Helfer,
  ungebautes Frontend), fällt es, es besteht nicht.
- **Ein Tor berichtet, was es gemessen hat.** "0 Befunde" und "0 Dateien
  angesehen" sind nicht dasselbe Ergebnis, und das Tor ist so gebaut,
  dass du sie unterscheiden kannst.

Wenn ein Tor dich also blockiert, lies erst, was es gemessen zu haben
behauptet, bevor du es für falsch hältst. Die meisten "falschen"
Tor-Fehlschläge sind das Tor, das eine echte, unerwartete Drift
korrekt meldet.

## Ratchets und Grundlinien

Ein **Ratchet** vergleicht eine aktuelle Messung mit einer eingefrorenen
Grundlinie, die im Baum liegt. Die Messung darf sich frei verbessern;
sie darf nicht stillschweigend zurückfallen. Beide Hälften - die Zahl
und die Grundlinie - sind eingecheckt, also driften beide.

Die Ratchet-Familie und wo jede Grundlinie liegt:

| Ratchet | Grundlinien-Datei | Lokales Ziel |
|---|---|---|
| Zyklomatische Komplexität | `.complexity-baseline` | `make check-complexity-gate` |
| Dateigröße (Zeilen) | `.filesize-baseline` | `make check-file-sizes` |
| Ordnergröße (flache Dateien/Ordner) | `.dirsize-baseline` | `make check-folder-size` |
| `global.css`-Größe | `.css-size-baseline` | `make check-css-size` |
| Theme-Tokens / Kontrast | `.theme-baseline.json` | `make verify-theme` |
| Regelkorpus-Größe | `.claude/rules/.corpus-baseline.json` | `make verify-rule-corpus-size` |
| Docs-Umlaut-Ersatzformen | `docs/.docs-hygiene-baseline.json` | `make verify-docs-hygiene` |
| Kaputte Doc-Referenzen | `docs/.doc-refs-baseline.json` | `make verify-doc-refs` |
| Größe des veröffentlichten Images | (in `verify-image-size`) | `make verify-image-size` |

### Wenn ein Ratchet dich blockiert

1. **Erst `develop` einmergen, dann neu messen.** Ein Ratchet vergleicht
   den aktuellen Baum mit einer Grundlinie; ein Zweig hinter seiner
   Basis trägt eine *alte* Grundlinie gegen *neuen* zusammengeführten
   Inhalt, also ist die Zahl, die du lokal liest, nicht die Zahl, die CI
   liest. Bring deinen Zweig auf Stand, bevor du irgendetwas anfasst.
   Warum das beißt, steht in
   [`lessons/ci-gates.md` -> "A ratchet baseline is itself a
   measurement"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md).

2. **Ist der Anstieg berechtigt, hebe die Grundlinie bewusst an - und
   sag warum.** Jeder Ratchet hat ein eigenes Anhebe-/Aktualisierungs-Ziel,
   damit die neue Obergrenze in deinem Diff landet, prüfbar, mit einer
   Begründung in der Commit-Nachricht:

   ```bash
   make check-complexity-gate-update      # .complexity-baseline neu erzeugen
   make check-folder-size-update          # zu whitelistende Fälle zeigen
   make verify-theme-baseline-update      # .theme-baseline.json neu aufnehmen
   make verify-rule-corpus-size-raise     # Korpus-Obergrenze anheben
   make verify-image-size-raise           # Image-Obergrenze anheben
   ```

3. **Erwarte nicht, dass ein Ratchet sich selbst senkt.** Manche Ratchets
   verbuchen eine echte Reduktion automatisch (ein Fehlerzähler, der
   null sein soll); ein *Budget*-Ratchet behält eine Reduktion als
   Reserve und bewegt sich nur durch eine bewusste Handlung; ein Ratchet
   auf einem *driftenden Orakel* (Komplexität, das gebaute Tailwind-CSS)
   senkt sich nie automatisch, weil ein Fall Werkzeug-Drift statt echtem
   Gewinn sein könnte. Die dreifache Unterscheidung erklärt der
   Test-Vertrag, Punkt 5. Ist ein Ratchet gefallen, weil eine Zahl
   *geschrumpft* ist, ist auch das ein Befund, kein Freibrief.

Senke niemals eine Obergrenze, um ein lokales Rot grün zu machen. Die
Zahl bedeutet überall dasselbe, per Konstruktion; sie stillschweigend
zu verschieben ist genau der Fehler, den der Ratchet verhindern soll.

## Fahre die Tore lokal, bevor du pushst

Ein Tor, das erst nach dem Push beißt, kostet eine Runde. Fahre die
bau-freien Tore in CI-Reihenfolge mit einem Befehl:

```bash
make ci        # jedes bau-freie Tor, in CI-Reihenfolge (BASE=<ref> für Diff-Tore)
make ci-full   # das Obige plus Tore, die ein gebautes Frontend brauchen
```

`make ci` fährt der Reihe nach: Docs-Drift, Docs-Hygiene,
Doc-Referenzen, Tor<->Regel-Kopplung, Check-Inventar, Lessons-Inventar,
normative Änderungen, Regelkorpus-Größe, Komplexitäts-Ratchet,
Testid-Referenzen, Docker-Kontext, Dateigrößen und den
OpenAPI-Schnappschuss. Zwei Tore brauchen ein installiertes + gebautes
Frontend (sie bauen das Tailwind-Klassen-Orakel), also liegen sie in
`make ci-full`, nicht in `make ci`. Die Testsuiten sind separat:
`make test`.

## Tore sind an Regeln gekoppelt, und Änderungen werden deklariert

Zwei Manifeste halten die Durchsetzung ehrlich, und du kannst beide
auslösen, indem du eine Regeldatei oder einen Workflow änderst:

- [`.claude/rules/gates.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/gates.yaml)
  koppelt jedes regel-durchsetzende Tor an den Regelabschnitt, den es
  durchsetzt. `make verify-gate-rule-links` fällt in beide Richtungen:
  ein Tor ohne Regel oder eine Regel, die einen nicht mehr existierenden
  Workflow zitiert. Jedes gekoppelte Tor trägt zudem einen `body_sha`
  des Regelabschnitts, sodass das Aushöhlen eines Regeltexts bei
  behaltener Überschrift auffliegt.
- [`.claude/rules/checks.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/checks.yaml)
  inventarisiert jede Prüfung. `make verify-check-inventory` beweist,
  dass eine als `active` deklarierte Prüfung wirklich verdrahtet ist
  und nicht zu einem No-op verkommen ist. Eine Prüfung abzuschalten ist
  nur erlaubt, indem man `status: disabled` mit einer Begründung
  deklariert - das Diff zeigt es. Stilles Abschalten wird unmöglich.

Fügt dein PR verbindliche Formulierungen in einer Regeldatei hinzu oder
entfernt sie, oder ändert er den Status eines Tors, verlangt
`make verify-normative-changes` eine **Deklaration**: das Label
`rule-change-declared` oder eine Zeile
`RULE-CHANGE DECLARED: <was und warum>` im PR-Text oder in einer
Commit-Nachricht. Die Deklaration ist absichtlich passierbar, niemals
aus Versehen, und sie konvergiert per Maschine in
[`docs/rule-change-log.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/rule-change-log.md).
Die vollständige Begründung: die Serie #2075 / #2077 / #2079 / #2081 /
#2087 in
[`quality-checks.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

Der Regelkorpus hat aus einem konkreten Grund eine Obergrenze: jede
Datei `.claude/rules/**/*.md` wird in jeden Prompt jeder Agenten-Sitzung
injiziert, also ist ein neuer Regelabschnitt ein Tausch, keine
Hinzufügung - erst etwas verdichten oder entfernen, oder im Commit
sagen, was der Korpus für den Platz bekommen hat.

## Der Zweigschutz gilt auch für Administratoren

`develop` verlangt einen aktuellen Zweig und grüne Pflicht-Prüfungen
vor einem Merge. Seit dem 2026-08-06 ist `enforce_admins` für `develop`
**an**, sodass die Pflicht-Prüfungen auch Repository-Administratoren
binden - sie abzuschalten ist eine bewusste, sichtbare Handlung,
niemals Teil eines gewöhnlichen Merges. Das gibt es, weil Release- und
Hotfix-Rückmerges einst ungetort `develop` erreichten und ihn für
jeden Zweig rot ließen, bis ein Mensch es bemerkte; die Geschichte
steht in
[`lessons/ci-gates.md` -> "Release/hotfix back-merges land
ratchet-tripping changes on develop ungated"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md)
und
[`docs/development/release-ratchet-gap.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/development/release-ratchet-gap.md).

Praktische Folge: niemand mergt um ein rotes Tor herum. Ist dein PR
hinter `develop`, bring ihn auf Stand, damit CI gegen den kombinierten
Zustand neu läuft, bevor er mergen kann.

## Die Pflichten: Vorgang, PR, Testplan, ein Concern

Vier stehende Pflichten liegen über den Toren. Es sind Normen, keine
CI-Prüfungen, und sie sind verbindlich, unabhängig davon, ob eine
Aufgabe sie verlangt hat:

- **Vorgang zuerst** (`GITHUB-ISSUE-PFLICHT`): jeder Fehler oder jede
  Änderung braucht *vor* der Behebung einen GitHub-Vorgang, und
  Commit/PR zitieren ihn mit einem schließenden Schlüsselwort
  (`Closes #NN`).
- **Immer ein PR** (`PR-PFLICHT`): jede gepushte Code-Änderung öffnet
  einen Pull Request gegen `develop`, ob verlangt oder nicht. Ein
  gepushter Zweig ohne PR ist unfertige Arbeit.
- **Testplan bei sichtbarer Änderung** (`TESTPLAN-PFLICHT`): eine
  Änderung an nutzersichtbarem Verhalten aktualisiert den manuellen
  Testplan (Deutsch und Englisch) im selben PR. Reine Refaktorierungen,
  Infrastruktur und Doku sind ausgenommen.
- **Ein Concern pro PR**: jeder PR trägt genau eine zusammenhängende
  Änderung.

Die verbindliche Formulierung lebt in
[`.claude/rules/ai-workflow/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules/ai-workflow)
(`github-issue-policy.md`, `pr-policy.md`, `testplan-policy.md`) und in
[`vibe-coding.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/vibe-coding.md).

## Wo das hingehört

Diese Seite ist der "Warum das Tor da ist"-Begleiter zur
[Onboarding-Anleitung](onboarding.md), die der schrittweise Weg vom Klon
bis zum gemergten PR ist. Für den Test-Ablauf selbst
(Rot-Grün-Refaktorieren und ein durchgerechnetes Beispiel) siehe
[Testen](testing.md). Für die Release-Tore siehe
[Release-Prozess](release.md).
