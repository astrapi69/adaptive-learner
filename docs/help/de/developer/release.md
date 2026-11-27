# Release-Prozess

Ein Release entsteht durch zwei Workflows, nicht von Hand. `release.yml` schneidet den Release-Branch, setzt die Version und lässt das volle Gate laufen, bevor irgendetwas gepusht wird. `release-finish.yml` merged nach `main`, taggt und legt das Release als Entwurf an. Die verbindliche Schritt-für-Schritt-Fassung ist `.claude/rules/release-workflow.md`; diese Seite ist der Überblick.

## Versions-Konvention

AdaptiveLearner folgt Semantic Versioning 2.0.0:

- **Major (X.0.0)** - Breaking Changes in API oder
  Architektur. Selten in der 0.x-Phase.
- **Minor (0.X.0)** - neue Features, rückwärtskompatibel.
  Standard für jede Phasen-Abschluss.
- **Patch (0.X.Y)** - Bugfixes, rückwärtskompatibel.
  Hotfix-Ketten.

Pre-Release-Tags (`-alpha`, `-beta`, `-rc`) werden nicht
genutzt. Releases sind immer stabil.

## Der Weg

1. **Auf develop, per Pull Request**: die Release-Notizen `changelog/releases/vX.Y.Z.md`, der Abschnitt "Was ist neu" der Hilfe-Seiten und die Abhängigkeits-Updates. Ohne die Notizen-Datei startet der Workflow nicht.
2. **Proben**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare` schneidet, setzt die Version und prüft auf dem Runner, und pusht nichts.
3. **Schneiden**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare -f push_branch=true`. Bei grünem Gate wird der Branch `release/X.Y.Z` gepusht; ab da ist develop gesperrt.
4. **Den Branch prüfen**: Image-Build, Sicherheits-Scan, WebKit-Gate, Bildvergleich und die drei Launcher-Builds werden auf dem Release-Branch angestoßen. Ein von einem Workflow gepushter Branch startet keinen davon von selbst.
5. **Finish**: `gh workflow run release-finish.yml --ref release/X.Y.Z -f version=X.Y.Z` merged ohne Fast-Forward nach `main`, taggt den Merge-Commit, öffnet den Pull Request, der das Release nach develop zurückführt, und legt das GitHub-Release als Entwurf an.
6. **Veröffentlichen**: `publish-image.yml` veröffentlicht und prüft das Image, die Launcher-Binaries der grünen `main`-Builds werden angehängt, und erst dann wird der Entwurf sichtbar.

### Die Version steht an einer Stelle

`backend/pyproject.toml` ist die einzige Quelle. Das Schneiden setzt sie, und `make sync-versions` schreibt jede andere Datei mit Versionsfeld (die volle Menge ist `collect_targets()` in `scripts/sync_versions.py`). Niemand ändert ein Versionsfeld von Hand. `release-gate.yml` prüft die Pins am Tag noch einmal.

### Was was auslöst

- ein Push nach `main`: `ci.yml`, `deploy-gh-pages.yml` und die Launcher-Builds
- der Tag: `release-gate.yml`
- der Release-Entwurf: nichts; Image und Binaries kommen aus dem Veröffentlichen-Schritt

`coverage.yml` läuft nicht beim Push, sondern nachts und auf Anforderung (`gh workflow run coverage.yml --ref main`).

## Plugin-Versionen

Plugins laufen im Gleichschritt mit der kanonischen App-
Version: dieselbe Nummer in jeder
Plugin-`pyproject.toml` plus den Plugin-
`__init__.py`-`__version__`-Literalen. Eine spätere „Core
vs Third-Party-Plugin"-Entscheidung könnte das entkoppeln;
das aktuelle Setup ist einheitlich über alle propagierten
Dateien.

## Hotfix-Flow

Ein Hotfix ist das eine Release von Hand: Keiner der beiden Workflows kann von `main` schneiden. Branch `hotfix/vX.Y.Z` von `main`, Fix, Version setzen und Notizen schreiben, den Branch mit `release-prepare.yml` prüfen, dann `make release-finish VERSION=X.Y.Z FINISH_BRANCH=hotfix/vX.Y.Z` und `make release-publish VERSION=X.Y.Z`.

Ein gepushter Tag wird nie gelöscht oder verschoben. Ein falsches Release korrigiert die nächste Version.

## Diskrete Pre-Release-Dep-Sweep-Commits

Wenn der Release-Zyklus Dependencies hochzieht (Vite, React,
manuscripta etc.), jeden Bump als eigenen Commit halten.
Gründe:

- **Bisect-Granularität** - eine Regression isoliert auf
  einen Bump.
- **CHANGELOG-Lesbarkeit** - Leser sehen die echte
  Motivation pro Bump.
- **Rollback** - ein schlechter Bump lässt sich isoliert
  zurücknehmen.

Das volle Pattern ist in `.claude/rules/release-workflow.md`
dokumentiert. Die Rules-as-Docs-Disziplin hält die
menschenlesbare Doku (diese Seite) und die maschinenlesbaren
Regeln synchron.
