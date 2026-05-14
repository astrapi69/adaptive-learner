# Release Workflow

Permanenter Workflow fuer Adaptive Learner Releases. Claude Code liest
diese Datei automatisch wenn ein Release ansteht.

Prompt-Trigger: "release new version", "new release", "neues Release"

---

## Grundregeln

- Keine manuellen Schritte ueberspringen: Die Checkliste am Ende ist Pflicht.
- Jedes Release ist eine logische Grenze: Nicht mitten in einem Feature releasen.
- Tests muessen gruen sein: Rote Tests blockieren das Release, keine Ausnahmen.
- CHANGELOG ist fuer Menschen: Nicht rohe Commit-Messages einfuegen, sinnvoll zusammenfassen.
- Version-Bump folgt SemVer, auch in der 0.x-Phase.

---

## Step 1: Aktuellen Stand erfassen

```bash
git tag --sort=-creatordate | head -5
LAST_TAG=$(git describe --tags --abbrev=0)
git log ${LAST_TAG}..HEAD --oneline --no-merges
git diff ${LAST_TAG}..HEAD --stat | tail -1
grep -H "version" backend/pyproject.toml frontend/package.json 2>/dev/null | head -5
```

Zusammenfassung zeigen und auf Bestaetigung warten.

---

## Step 2: Version-Bump per SemVer

| Commit-Typ | Bump |
|------------|------|
| `BREAKING CHANGE` oder `!` nach dem Typ | Major |
| `feat:` | Minor |
| `fix:`, `perf:`, `refactor:` | Patch |
| Nur `docs:`, `chore:`, `test:` | Patch |

Neue Version vorschlagen mit Begruendung. Auf OK warten.

---

## Step 3: CHANGELOG.md generieren

Sauberen CHANGELOG-Eintrag aus den Commits bauen. Gruppiert:

- **Breaking Changes** (nur wenn noetig)
- **Added** (feat:)
- **Changed** (refactor:, perf:)
- **Fixed** (fix:)

---

## Step 4: Version bumpen

### Backend

```bash
# backend/pyproject.toml: version aendern
cd backend && poetry lock
```

### Frontend

```bash
# frontend/package.json: version aendern
cd frontend && npm install
```

Beide muessen die gleiche Version tragen.

### Tag und Push

```bash
git add -A
git commit -m "chore(release): bump version to v<new-version>"
git tag v<new-version>
git push origin main --tags
```

---

## Step 5: Tests

ALLE Befehle sind PFLICHT.

```bash
# Backend + Plugins
make test

# Frontend (wenn Vitest eingerichtet)
cd frontend && npx tsc --noEmit && npm run test

# Linting
cd backend && poetry run ruff check app/
```

ALLES muss gruen sein. Bei einem roten Test:
1. Release abbrechen.
2. Problem analysieren und fixen.
3. Release von Step 1 neu starten.

---

## Step 6: Build verifizieren

```bash
cd backend && poetry build
cd frontend && npm run build
docker compose build   # wenn Docker aktiv
```

---

## Step 7: Git Tag und Push

```bash
git tag -a v0.X.0 -m "Release v0.X.0"
git push origin main
git push origin v0.X.0
```

---

## Step 8: GitHub Release erstellen

```bash
gh release create v0.X.0 \
  --title "Adaptive Learner v0.X.0" \
  --notes-file changelog/releases/v0.X.0.md
```

---

## Step 9: Post-Release Dokumentation

- ROADMAP.md: Erledigte Items auf [x] setzen.
- CLAUDE.md: Aktualisieren bei neuen Endpoints oder Architektur-Aenderungen.
- lessons-learned.md: Wenn waehrend des Release etwas Bemerkenswertes passiert ist.

Commit: `docs: post-release documentation v0.X.0`

---

## Dependency-Check vor Release

```bash
cd backend && poetry show --outdated
cd frontend && npm outdated
```

Routine-Bumps (Patch + Minor) als Teil des Release. Major-Bumps in eigener Session.

---

## Checkliste

- [ ] Commits seit letztem Tag reviewed
- [ ] Version per SemVer bestimmt und bestaetigt
- [ ] CHANGELOG.md mit neuem Eintrag
- [ ] Version in pyproject.toml und package.json aktualisiert
- [ ] pluginforge-Pin auf aktueller PyPI-Version
- [ ] `make test` gruen
- [ ] `ruff check` sauber
- [ ] Backend `poetry build` erfolgreich
- [ ] Frontend `npm run build` erfolgreich
- [ ] Docker Build erfolgreich (wenn aktiv)
- [ ] Git Tag erstellt und gepusht
- [ ] GitHub Release publiziert
- [ ] ROADMAP Items markiert
- [ ] CLAUDE.md aktualisiert (wenn noetig)
- [ ] Post-Release Commit gepusht

---

## Troubleshooting

### Tests schlagen fehl

Release abbrechen, Test fixen, von Step 1 neu starten. Keine Workarounds wie "Test deaktivieren".

### Build kaputt wegen Dependencies

`poetry lock --no-update` und `npm install`, dann rebuild. Bei hartem Fehler: Release abbrechen.

### Falscher Version-Tag

```bash
git tag -d v0.X.0
git push origin :refs/tags/v0.X.0
```

Nur wenn noch kein GitHub Release publiziert wurde.

---

## Hinweis fuer Claude Code

Dieser Workflow ist ein Leitfaden. Wenn der Nutzer explizit eine Abweichung will, akzeptieren und dokumentieren WARUM.

Aber: Checklisten-Punkte die Safety betreffen (Tests gruen, Build erfolgreich, korrekte Version) duerfen NIEMALS uebersprungen werden. Lieber Release verschieben als kaputte Software ausliefern.
