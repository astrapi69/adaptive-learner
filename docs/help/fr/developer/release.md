# Processus de publication

Adaptive Learner publie une nouvelle version à chaque complétion
de sous-phase majeure. Le processus est automatisé par
`make sync-versions` et un job CI de porte de sortie ; les étapes
humaines se limitent au choix de version, au CHANGELOG et au tag.

## Convention de versionnement

Adaptive Learner suit le Versionnement Sémantique 2.0.0 :

- **Majeur (X.0.0)** — changements incompatibles dans l'API ou
  l'architecture. Réservé aux grandes évolutions futures.
- **Mineur (X.Y.0)** — nouvelles fonctionnalités, rétrocompatibles.
  Valeur par défaut pour chaque complétion de phase.
- **Correctif (X.Y.Z)** — corrections de bogues, rétrocompatibles.
  Chaînes de correctifs.

Les tags de pré-publication (`-alpha`, `-beta`, `-rc`) ne sont
pas utilisés. Les publications sont toujours stables.

## Les 8 étapes d'une publication

### 1. Capturer l'état

```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
git diff --stat $(git describe --tags --abbrev=0)..HEAD
```

Passer en revue ce qui a été intégré depuis le dernier tag.
Décider du niveau de bump.

### 2. Rédiger les notes de publication

Ajouter un fichier `changelog/releases/vX.Y.Z.md` en s'inspirant
de la publication la plus récente (Added / Fixed / Tests /
Backlog items closed / Commits / Upgrade notes). Le CI de porte
de sortie vérifie que ce fichier existe pour le tag poussé.

### 3. Modifier manuellement la version canonique

Le seul champ de version à éditer manuellement dans tout le dépôt :

```toml
# backend/pyproject.toml
[tool.poetry]
version = "X.Y.Z"
```

### 4. Propager

```bash
make sync-versions
```

Met à jour **18 fichiers** automatiquement :

- `frontend/package.json`
- `launcher/pyproject.toml`
- `launcher/adaptive_learner_launcher/__init__.py`
- `launcher/adaptive-learner-launcher.spec` (plist CFBundle +
  CFBundleShortVersionString)
- 10× `plugins/adaptive-learner-plugin-*/pyproject.toml`
- 3× littéraux `__version__` dans les `__init__.py` des plugins
- `install.sh` (régénéré depuis `install.sh.template`)
- `install.ps1` (régénéré depuis `install.ps1.template`)

### 5. Vérifier

```bash
make sync-versions-check     # sort avec un code non nul en cas de dérive
make test                    # les tests doivent passer
cd frontend && npm run build # doit réussir
```

Le workflow CI de porte de sortie (`.github/workflows/release-gate.yml`)
exécute le même `sync-versions-check` à chaque push de tag.

### 6. Commit + tag

```bash
git add -A
git commit -m "chore(release): bump version to vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z — titre de phase + résumé"
```

Les messages de tag sont annotés, multi-lignes et résument la
publication. Ils deviennent les notes de la release GitHub à
l'étape suivante.

### 7. Pousser

```bash
git push origin main --tags
```

Déclenche :

- `ci.yml` sur le nouveau commit (tests)
- `release-gate.yml` sur le nouveau tag (vérification de dérive
  des pins de version)
- `coverage.yml` sur le nouveau commit (HTML de couverture)
- `deploy-gh-pages.yml` sur le nouveau commit (publication du
  site public)
- `launcher-{linux,macos,windows}.yml` quand GitHub crée la
  Release à partir du tag

### 8. Créer la release GitHub

```bash
gh release create vX.Y.Z \
  --title "Adaptive Learner vX.Y.Z" \
  --notes-file changelog/releases/vX.Y.Z.md
```

`--notes-file` garantit que la page de la release GitHub
correspond aux notes de publication commitées à l'étape 2.

## Versions des plugins

Les plugins suivent en parallèle la version canonique de
l'application. Le même numéro dans tous les 10 fichiers
`pyproject.toml` des plugins. Une future décision
« core vs plugin tiers » pourrait les dissocier, mais la
configuration actuelle est uniforme sur les 18 fichiers propagés.

## Flux de correctif

Les publications de niveau correctif (0.X.1, 0.X.2) suivent les
mêmes 8 étapes. La section « Historique des correctifs » du
CHANGELOG de la publication documente la chaîne quand plusieurs
correctifs s'enchaînent.

## Commits discrets de mise à jour des dépendances

Lors de la mise à jour des dépendances dans le cycle de
publication (Vite, React, etc.), garder chaque mise à jour dans
son propre commit. Raisons :

- **Granularité de bisect** — une régression s'isole en un seul
  bump.
- **Lisibilité du CHANGELOG** — les lecteurs voient la motivation
  réelle de chaque bump.
- **Rollback** — un mauvais bump peut être annulé indépendamment.

Le pattern complet est documenté dans
`.claude/rules/release-workflow.md`. La discipline
règles-comme-docs maintient les docs lisibles par les humains
(cette page) et les règles lisibles par la machine synchronisées.
