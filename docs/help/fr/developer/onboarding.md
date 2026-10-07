# Intégration : votre première correction de bogue

Un parcours pratique, étape par étape, pour un nouveau contributeur.
Contrairement aux pages [Architecture](architecture.md) et
[Installation](setup.md) (qui expliquent *ce qu'est* le système), cette
page vous guide pour *réaliser* votre première correction de bogue de bout
en bout, d'un clone tout neuf à une pull request fusionnée.

## 1. Mettre en place l'environnement de développement

Prérequis : **Python 3.12** (la contrainte du backend est `~3.12`),
**Node 24+** (requis par Vite 8), **Poetry**, **Bun**
et **GNU Make**.

```bash
# Clone
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner

# Install everything: Poetry backend + plugin path-deps + Bun frontend
make install

# Establish a green baseline before you change anything
make test

# Run the app (backend on :18001, frontend on :15174)
make dev
```

Le serveur de développement du frontend tourne sur
**http://localhost:15174**, le backend sur **http://localhost:18001**. Les
deux ports peuvent être modifiés via
`ADAPTIVE_LEARNER_FRONTEND_PORT` / `ADAPTIVE_LEARNER_PORT`. Appuyez une
fois sur Ctrl-C pour arrêter les deux.

Si `make install` échoue, le coupable habituel est Poetry qui choisit le
mauvais Python : lancez `poetry env use python3.12` dans `backend/` et
réinstallez. Pour la chaîne de configuration complète (secrets, clés IA,
la variable obligatoire `ADAPTIVE_LEARNER_SECRET_KEY`), voir
[Installation](setup.md).

## 2. Trouver un bogue

Les issues sont la file de travail. Chaque correction nécessite d'abord une
issue (`GITHUB-ISSUE-PFLICHT`).

```bash
# Open bug issues
gh issue list --label bug --state open
```

Ou sur GitHub :
<https://github.com/astrapi69/adaptive-learner/issues?q=is%3Aissue+is%3Aopen+label%3Abug>

Choisissez quelque chose de petit pour commencer : cherchez
`good first issue` ou un `bug` peu coûteux. S'il n'existe pas d'issue pour
le bogue que vous avez trouvé, **créez-en une avant de toucher au code**,
et ouvrez une issue *séparée* pour tout nouveau bogue découvert en chemin.

## 3. Comprendre l'issue

- Lisez la description et reproduisez le bogue localement.
- Notez dans quel mode de stockage il se produit. Adaptive Learner propose
  un **double stockage** (API/SQLite *et* Dexie/IndexedDB) ; un bogue peut
  vivre dans un mode, dans l'autre, ou dans les deux. Voir
  [Couche de stockage](storage-layer.md).
- Si vous ne parvenez pas à le reproduire, posez la question dans l'issue
  plutôt que de deviner.

## 4. Créer une branche

Adaptive Learner utilise **gitflow** : `develop` est la branche active ;
`main` ne contient que les publications. Créez votre branche *depuis*
`develop` et ouvrez votre PR *contre* `develop`.

```bash
git checkout develop
git pull origin develop
git checkout -b fix/short-description
```

Nommage des branches :

| Préfixe | Pour |
|---|---|
| `fix/...` | corrections de bogues |
| `feature/...` | nouvelles fonctionnalités |
| `refactor/...` | refactorisations |
| `docs/...` | documentation |
| `chore/...` | outillage / maintenance |

## 5. Corriger le bogue

Conseils pour trouver le code :

```bash
# Search by an error string / symbol (use ripgrep)
rg "the error message" frontend/src backend/app
```

- Erreurs frontend : ouvrez la console des DevTools du navigateur.
- `cd frontend && bunx vitest --watch <file>` donne un retour de test en
  direct pendant que vous éditez (lancez toujours vitest depuis
  `frontend/`, pas depuis la racine du dépôt).
- **Style : uniquement des classes utilitaires Tailwind**, pas de styles
  de couleur en ligne et pas de nouvelles règles dans `global.css`. Les
  couleurs passent par les jetons de design (variables CSS) ; voir
  [Système de thèmes](themes.md).
- **Les deux modes de stockage doivent continuer à fonctionner.** Une
  fonctionnalité livrée en mode API sans chemin Dexie (ou sans message
  clair « non disponible en mode navigateur ») bloque la publication.

## 6. Écrire un test de régression

Chaque correction nécessite au moins un test qui échoue avant la
modification et passe après.

```bash
# Frontend (Vitest) - run from frontend/
cd frontend && bunx vitest run src/path/to/file.test.ts

# Backend (pytest)
cd backend && poetry run pytest tests/path/ -v

# A single plugin
make test-plugin-gamification
```

Pour les changements qui touchent à la sauvegarde, il existe une porte
supplémentaire : un véritable aller-retour Export → Import dans `make dev`
avec des données réelles (le `BACKUP-AKZEPTANZTEST`). Les tests unitaires
seuls ne justifient jamais la fusion d'un changement de sauvegarde.

## 7. Lancer la porte complète en local

```bash
make test            # backend + plugins + frontend Vitest
make check-types     # mypy + tsc --noEmit
make test-dexie-smoke  # GH-Pages-shape build, every route, no backend
cd frontend && bun run build
```

Tout doit être vert avant d'ouvrir une PR.

## 8. Commiter et pousser

[Conventional Commits](https://www.conventionalcommits.org/). Référencez
l'issue avec un mot-clé de fermeture pour que la fusion la ferme
automatiquement.

```bash
git add -A
git commit -m "fix(area): short description

Longer description of what the problem was and how it was fixed.

Closes #123"

git push -u origin fix/short-description
```

Gardez des commits **atomiques** : chaque commit laisse l'arborescence au
vert (`make test` passe). Regroupez une modification du code source et la
modification de test associée dans le même commit lorsque les séparer
créerait un état intermédiaire rouge.

## 9. Ouvrir une pull request

```bash
gh pr create --base develop \
  --title "fix(area): short description" \
  --body "Closes #123

## What changed
- ...

## Tests
- ..."
```

Ciblez toujours **`develop`**, jamais `main` (`main` est la branche des
publications). Pour une sous-issue d'une issue parapluie ou d'un epic,
citez la *sous-issue* avec `Closes #<sub-issue>`, plus `Refs #<umbrella>`
pour la traçabilité.

## 10. Attendre la CI

La CI exécute les portes de correction sur chaque PR :

- Tests frontend (Vitest) + tests backend / plugins (pytest)
- TypeScript (`tsc --noEmit`) + mypy + ruff + ESLint
- Hooks pre-commit
- Porte de complexité (cliquet à référence : les nouvelles fonctions
  doivent rester sous le seuil de complexité cyclomatique)
- Gardes de taille de dossier + de fichier (prévention des fichiers et
  dossiers fourre-tout)
- Parité i18n (chaque catalogue sous `backend/config/i18n/` doit
  définir chaque clé)
- Garde des jetons de design (pas de couleurs codées en dur ni
  d'utilitaires à palette fixe)
- Vérificateur de dérive des docs

Les vérifications plus lourdes (E2E en mode Dexie, couverture, tests de
mutation, analyse de sécurité, dérive des statistiques de contenu)
s'exécutent la nuit et à la publication, pas sur chaque PR. Une PR verte
n'est donc pas la preuve que `develop` est vert.

Quand une porte vous bloque, en particulier un **cliquet** (complexité,
taille de fichier, taille de dossier, ...), lisez
[Portes, cliquets et protection de branche](gates-and-ratchets.md)
avant de supposer qu'elle se trompe. Cette page explique ce qu'est chaque
porte, que faire quand un cliquet vous bloque et comment lancer les portes
en local avec `make ci` avant de pousser.

## 11. Revue et fusion

Attendez la revue (ou fusionnez vous-même si vous avez les droits de
mainteneur). Les PR sont **fusionnées en squash** dans `develop`, donc les
commits de votre branche se réduisent à un seul commit propre sur le tronc.

---

## Règles du projet (version courte)

| Règle | Signification |
|---|---|
| `GITHUB-ISSUE-PFLICHT` | chaque correction/fonctionnalité nécessite d'abord une issue |
| Tailwind uniquement | pas d'ajouts dans `global.css`, pas de styles de couleur en ligne |
| Jetons de design | couleurs via variables CSS, jamais de littéraux hexadécimaux |
| Parité du mode Dexie | tout fonctionne en mode Dexie *et* en mode API |
| Bibliothèque d'abord | API native > framework > bibliothèque > code maison |
| Conventional Commits | `fix()`, `feat()`, `refactor()`, `docs()`, ... |
| i18n | toutes les chaînes d'interface dans chaque catalogue `backend/config/i18n/` |
| Cibles tactiles de 44px | éléments interactifs adaptés au mobile |
| Un seul sujet par PR | chaque PR porte un seul changement cohérent |
| Protection de branche | `develop` exige une branche à jour + des vérifications vertes (s'applique aussi aux administrateurs) |

Ensemble complet des règles : [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).

## Commandes courantes

```bash
make dev               # start backend + frontend
make test              # all tests (backend + plugins + Vitest)
make test-dexie-smoke  # Dexie-mode release gate (no backend)
make check-types       # mypy + tsc --noEmit
make check-complexity-gate   # complexity ratchet
make check-folder-size       # god-folder guard
make sync-i18n         # regenerate frontend i18n from backend YAML
make sync-versions     # propagate the canonical version
cd frontend && bun run build   # build the frontend
```

`make help` liste toutes les cibles ; le
[Makefile](https://github.com/astrapi69/adaptive-learner/blob/develop/Makefile)
est la source de vérité pour les commandes de build.

## L'architecture en un écran

```
frontend/src/
  api/          FastAPI client (the only place fetch() lives)
  components/   UI components, grouped by concern (dashboard/, lesson/, ...)
  features/     feature-strategy gating (useFeatureAvailable)
  hooks/        React hooks
  lib/          business logic, grouped by domain (lesson/, srs/, ai/, ...)
  pages/        route components (+ content/, dashboard/, lesson/ subdirs)
  shared/       app-independent reusable components
  storage/      dual storage: getStorage() -> IStorageService
  styles/       design tokens + per-theme CSS

backend/app/
  routers/      thin FastAPI endpoints (delegate to services)
  services/     business logic (no FastAPI imports)
  repositories/ data layer (Session-free contracts)
  models/       SQLAlchemy models (single-file domain model)
  hookspecs.py  the 10 plugin hooks

plugins/        PluginForge plugins (one package each; the
                catalogue lives in CLAUDE.md)
```

Détails : [Architecture](architecture.md).

## Où trouver... ?

| Quoi | Où |
|---|---|
| Règles du projet | [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules) |
| Architecture | [Architecture](architecture.md) |
| Portes, cliquets, protection de branche | [Portes, cliquets et protection de branche](gates-and-ratchets.md) |
| Couche de stockage | [Couche de stockage](storage-layer.md) |
| Système de plugins | [Guide des plugins](plugin-guide.md) |
| Intégration IA | [Intégration IA](ai-integration.md) |
| Tests | [Tests](testing.md) |
| Processus de publication | [Processus de publication](release.md) |
| Format du contenu des leçons | [Rédiger du contenu de leçon](authoring-content.md) |
| i18n | [i18n](i18n.md) |
| Déploiement | [Déploiement](deployment.md) |
| Feuille de route | [`docs/ROADMAP.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/ROADMAP.md) |
