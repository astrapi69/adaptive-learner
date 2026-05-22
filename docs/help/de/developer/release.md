# Release-Prozess

AdaptiveLearner schneidet pro abgeschlossener Hauptphase ein
Release. Der volle Prozess ist durch `make sync-versions` und
einen Release-Gate-CI-Job automatisiert; die menschlichen
Schritte sind nur Versionswahl, CHANGELOG und Tag.

## Versions-Konvention

AdaptiveLearner folgt Semantic Versioning 2.0.0:

- **Major (X.0.0)** — Breaking Changes in API oder
  Architektur. Selten in der 0.x-Phase.
- **Minor (0.X.0)** — neue Features, rückwärtskompatibel.
  Standard für jede Phasen-Abschluss.
- **Patch (0.X.Y)** — Bugfixes, rückwärtskompatibel.
  Hotfix-Ketten.

Pre-Release-Tags (`-alpha`, `-beta`, `-rc`) werden nicht
genutzt. Releases sind immer stabil.

## Der 8-Schritte-Release

### 1. Zustand erfassen

```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
git diff --stat $(git describe --tags --abbrev=0)..HEAD
```

Sichten, was seit dem letzten Tag gelandet ist. Bump-Stufe
entscheiden.

### 2. CHANGELOG-Eintrag

Top-Block-Eintrag in `docs/CHANGELOG.md` hinzufügen (aktuell
unstrukturierte Prosa; der Projektplan verfolgt
versionsweise Notizen unter "Phase history"). Nach
Hinzugefügt / Geändert / Behoben gruppieren.

### 3. Kanonische Version hand-editieren

Das einzige hand-editierte Versions-Feld im gesamten Repo:

```toml
# backend/pyproject.toml
[tool.poetry]
version = "0.X.Y"
```

### 4. Propagieren

```bash
make sync-versions
```

Aktualisiert **18 Dateien** automatisch:

- `frontend/package.json`
- `launcher/pyproject.toml`
- `launcher/adaptive_learner_launcher/__init__.py`
- `launcher/adaptive-learner-launcher.spec`
  (CFBundle-plist + CFBundleShortVersionString)
- 10× `plugins/adaptive-learner-plugin-*/pyproject.toml`
- 3× Plugin-`__init__.py`-`__version__`-Literale
- `install.sh` (aus `install.sh.template` neu generiert)
- `install.ps1` (aus `install.ps1.template` neu generiert)

### 5. Verifizieren

```bash
make sync-versions-check     # Exit-Code != 0 bei Drift
make test                    # 2634 Tests müssen passieren
cd frontend && npm run build # muss durchlaufen
```

Der Release-Gate-CI-Workflow
(`.github/workflows/release-gate.yml`) führt den gleichen
`sync-versions-check` bei jedem Tag-Push aus. Wenn lokal
zustimmt, aber CI scheitert, wurde der Drift zwischen
deinem lokalen Check und dem Push eingeführt — investigieren.

### 6. Committen + taggen

```bash
git add -A
git commit -m "chore(release): bump version to vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z — Phase-Headline + Zusammenfassung"
```

Tag-Messages sind annotiert, mehrzeilig und fassen das
Release zusammen. Sie werden zu den GitHub-Release-Notes,
wenn der nächste Schritt läuft.

### 7. Pushen

```bash
git push origin main --tags
```

Löst aus:

- `ci.yml` für den neuen Commit (Tests)
- `release-gate.yml` für den neuen Tag (Version-Pin-Drift-
  Check)
- `coverage.yml` für den neuen Commit (Coverage-HTML)
- `deploy-gh-pages.yml` für den neuen Commit (Public-Site
  publizieren)
- `launcher-{linux,macos,windows}.yml`, sobald GitHub das
  Release aus dem Tag anlegt

### 8. GitHub-Release erstellen

```bash
gh release create vX.Y.Z \
  --title "Adaptive Learner vX.Y.Z" \
  --notes-file changelog/releases/vX.Y.Z.md
```

`--notes-file` sorgt dafür, dass die GitHub-Release-Seite
den in Schritt 2 committeten Per-Release-Notes entspricht.

## Plugin-Versionen

Plugins laufen im Gleichschritt mit der kanonischen App-
Version: dieselbe Nummer in allen 10
Plugin-`pyproject.toml`-Dateien plus den drei Plugin-
`__init__.py`-`__version__`-Literalen. Eine spätere „Core
vs Third-Party-Plugin"-Entscheidung könnte das entkoppeln;
das v1.20.0-Setup ist einheitlich über die 18 propagierten
Dateien.

## Hotfix-Flow

Patch-Releases (0.X.1, 0.X.2) folgen denselben 8 Schritten.
Der "Hotfix-Historie"-Abschnitt im Release-CHANGELOG zeichnet
die Kette auf, wenn mehrere Hotfixes Rücken-an-Rücken landen.

## Diskrete Pre-Release-Dep-Sweep-Commits

Wenn der Release-Zyklus Dependencies hochzieht (Vite, React,
manuscripta etc.), jeden Bump als eigenen Commit halten.
Gründe:

- **Bisect-Granularität** — eine Regression isoliert auf
  einen Bump.
- **CHANGELOG-Lesbarkeit** — Leser sehen die echte
  Motivation pro Bump.
- **Rollback** — ein schlechter Bump lässt sich isoliert
  zurücknehmen.

Das volle Pattern ist in `.claude/rules/release-workflow.md`
dokumentiert. Die Rules-as-Docs-Disziplin hält die
menschenlesbare Doku (diese Seite) und die maschinenlesbaren
Regeln synchron.
