# Tests

## Vue d'ensemble de la pyramide

```
Tests E2E (Playwright)           Peu nombreux, flux critiques
Tests d'intégration (pytest)     Endpoints API avec état DB réel
Tests unitaires (pytest/Vitest)  Logique métier en isolation
```

Les compteurs de tests augmentent à chaque release ;
`docs/audits/current-coverage.md` est la source canonique, toujours à
jour, pour les compteurs de tests et la couverture.

---

## Backend (pytest)

```bash
make test-backend                # pytest backend uniquement
make test-plugins                # les suites de tous les plugins
make test-plugin-gamification    # plugin spécifique
make test-plugin-content-loader  # plugin spécifique
```

Les tests backend utilisent une base SQLite en mémoire. L'isolation des
tests est garantie par deux mécanismes :

1. `ADAPTIVE_LEARNER_TEST=1` + `ADAPTIVE_LEARNER_DATA_DIR` temporaire définis
   AVANT toute importation `app.*`
2. Un fichier marqueur `.adaptive-learner-production` dans les répertoires
   de données de production - si un test en voit un, l'exécution entière
   est abandonnée (code retour 2)

---

## Frontend (Vitest)

```bash
make test-frontend               # Vitest (happy-dom)
cd frontend && bunx vitest        # Mode watch
cd frontend && bunx vitest run src/path/to/file.test.tsx  # Ciblé
```

**Important :** lancez toujours Vitest depuis le répertoire `frontend/`,
jamais depuis la racine du dépôt. Vitest ne trouve pas sa configuration
depuis la racine et échoue sur tous les tests DOM avec
`ReferenceError: document is not defined`.

---

## Tests E2E (Playwright)

```bash
cd e2e && npx playwright test              # Suite complète (démarre ses propres serveurs)
cd e2e && npx playwright test smoke/       # Tests smoke uniquement
make test-dexie-smoke                      # Gate du mode Dexie (OBLIGATOIRE pour les releases)
```

**17 fichiers de spec smoke** couvrent tous les flux critiques : onboarding,
sessions, curriculum, paramètres, navigation, import.

**23 specs du gate Dexie** (inclus dans `make release-test`) : parcourent
chaque route accessible depuis la navigation dans un build statique
`VITE_STORAGE_MODE=dexie` sans backend. Tout toast d'erreur ou plantage
de page fait échouer le gate.

Les sélecteurs E2E utilisent **uniquement** des attributs `data-testid` -
jamais de sélecteurs CSS ou de texte fragiles.

---

## Patterns de mock

### Mocks d'API (Vitest)

```typescript
vi.mock('../storage', () => ({
  getStorage: vi.fn(() => ({
    projects: { list: vi.fn(async () => []) }
  }))
}))
```

### Mocks d'API synchrones - attention

React 18 en mode développement monte les composants deux fois. Utilisez
`mockImplementation` (persiste) plutôt que `mockImplementationOnce`
(consommé dès la première invocation). Pour la réinitialisation entre
tests, utilisez `mockClear()` (pas `mockReset()` - cela supprime
l'implémentation).

### Hooks i18n

Le mock i18n retourne une nouvelle fonction `t` à chaque rendu.
N'incluez pas `t` dans les tableaux de dépendances `useEffect` si
la requête ne dépend pas réellement de `t`.

---

## Couverture

```bash
make test-coverage    # Optionnel, lourd - la CI l'exécute automatiquement
```

Le workflow `coverage.yml` tourne chaque nuit (et à la demande) ; ses
rapports sont uploadés comme artefacts GitHub Actions (rétention
14 jours) :

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

Chaque plugin a son propre artefact `<dossier-du-plugin>-coverage`,
par exemple
`gh run download --name adaptive-learner-plugin-session-coverage` ;
un nouveau plugin est couvert sans modifier le workflow.

---

## Hooks pré-commit

```bash
cd backend && poetry run pre-commit install
```

Les hooks sont listés dans `.pre-commit-config.yaml`, par exemple
ruff check (correction automatique) et ruff format, des
vérifications d'espaces, de YAML, de JSON et de conflits de merge,
ESLint du frontend, les vérifications de la documentation (cliquet
des substituts de trémas, références de la documentation) et
`plugin-lock-paired-with-pyproject` (bloquant) : il exécute
`poetry check --lock` pour chaque plugin dont le `pyproject.toml` ou
le `poetry.lock` est concerné et échoue quand les dépendances ont
changé depuis l'écriture du lock ; il tourne aussi dans le job
pre-commit de la CI sur tous les fichiers. Dans ce job, le hook
`eslint` est ignoré (le job des tests frontend exécute ESLint avec
les dépendances installées). Prettier n'est pas un hook :
`bun run format:check` tourne dans le job des tests frontend, sans
bloquer jusqu'au reformatage unique de #3270.

---

## CI

La CI se divise en deux étages : les gates de correction s'exécutent
sur chaque PR (ils doivent passer pour merger) ; les suites coûteuses
ou en avertissement seulement tournent en équipe de nuit et à la
release.

`.github/workflows/ci.yml` s'exécute au push sur `develop` / `main`
et sur chaque PR (Python 3.12) :

1. Tests backend (pytest)
2. Tests des plugins (`make test-plugins`, tous via le venv backend)
3. Frontend : `tsc --noEmit`, ESLint (`--max-warnings 0`),
   vérification des dépendances circulaires, Stylelint, Vitest,
   `vite build`, `bun audit --audit-level=high` (bloque sur les
   résultats élevés et critiques). Un avis sans version corrigée qui
   n'atteint qu'une dépendance de développement est exempté par ID
   dans `frontend/audit-ignore.txt` : un ID par ligne, avec au-dessus
   un commentaire donnant la raison et quand l'entrée disparaît.
   `make check-security` lit la même liste ; `security-scan.yml` reste
   non filtré.
4. Hooks pre-commit sur tous les fichiers
5. Backend ruff + mypy + pip-audit
6. Vérificateur de dérive des docs (`verify_docs.py` + synchronisation
   de la nav mkdocs)

**Test Impact Analysis (#615) :** sur une PR, seuls les tests
impactés s'exécutent - `vitest run --changed origin/<base>` et
`pytest --testmon`. Les push sur `develop` / `main`, les exécutions
nocturnes et les exécutions de release lancent toujours la suite
COMPLÈTE. Le repli vers la suite complète est automatique (référence
de base non résoluble, ou cache testmon manquant).

D'autres gates PR vivent dans leurs propres workflows :

- `complexity-check.yml` - le gate à cliquet de complexité
  (`make check-complexity-gate`, radon pour Python + complexité
  ESLint pour TS). C'est un cliquet sur baseline : il n'échoue que
  sur des dépassements NOUVEAUX ou régressés par rapport à
  `.complexity-baseline`, il bloque donc la nouvelle complexité sans
  forcer un nettoyage de la dette préexistante. Le rapport de
  complexité complet, en avertissement seulement, tourne chaque nuit.
  Le même job exécute la vérification de taille de dossier
  (`scripts/check-folder-size.sh` contre `.dirsize-baseline`) ;
  localement `make check-folder-size` ou dans `make ci`.
- `cohesion-check.yml` - la vérification de taille de fichier (gate
  contre `.filesize-whitelist`) plus deux gates de noms de classe :
  les noms de classe CSS morts (`check-dead-classnames.py` contre
  `.dead-classnames-baseline`) et le **gate des className sans
  style** (`--unstyled`, un cliquet contre
  `.unstyled-classnames-baseline`) - un `className` dont tous les
  tokens sont morts bloque la PR.
- `visual-baseline-gate.yml` - une PR qui modifie des chemins
  visuellement critiques (composants de leçon, renderers
  d'exercices, fichiers de thème/CSS) doit apporter dans la même PR
  les captures de référence (baselines) concernées ; label
  d'échappement `visual-baselines-unaffected` pour les changements
  démontrablement inertes.
- `testid-reference-gate.yml` - si une PR supprime ou renomme un
  `data-testid` qu'une spec E2E référence statiquement (sur une
  surface fortement visible pour l'utilisateur) sans toucher la
  spec, le gate échoue (`make check-testid-refs`) ; label
  d'échappement `testid-refs-unaffected`.
- `docker-build-smoke.yml` - smoke build-only des images Compose de
  production (le chemin launcher / install.sh), filtré par chemins
  sur les PR, en plus sur `release/**`, chaque semaine et à la
  demande ; localement `make docker-build-smoke`.
- `dexie-smoke.yml` - le gate E2E du mode Dexie : sur chaque pull
  request qu'il concerne (`scripts/dexie_smoke_affected.py` décide ; le
  job `Dexie smoke (required)` rend toujours compte), plus chaque jour,
  sur `release/**` et à la demande ; localement
  `make test-dexie-smoke`.
- `backup-e2e.yml` - tourne sur les PR qui touchent un chemin de
  sauvegarde (par exemple `frontend/src/storage/backup/`, les stores
  Dexie ou les services de sauvegarde du backend ; la liste est dans
  le workflow) et exécute chaque `e2e/dexie/backup-*.spec.ts`, dont
  l'aller-retour sur toutes les tables de sauvegarde.

**Équipe de nuit / release (pas sur les PR) :**

- `coverage.yml` - rapport de couverture (quotidien + à la
  demande)
- `security-scan.yml` - pip-audit / bun audit / bandit
  (hebdomadaire + sur `release/**` + à la demande ; en
  avertissement seulement)
- `content-stats.yml` - dérive des statistiques de contenu contre
  un checkout de contenu frais (quotidien + à la demande)
- `mutation-frontend.yml` - mutation testing Stryker (nocturne
  derrière la variable de dépôt `ENABLE_NIGHTLY_MUTATION` + à la
  demande ; chaque exécution mute une tranche des fichiers pour
  que l'exécution tienne dans la limite de temps du job) ; le
  mutation testing backend utilise mutmut
- `webkit-gate.yml` - le gate de layout sur le vrai moteur WebKit
  (classes de bugs iOS/Safari que les gates Chromium ne peuvent
  structurellement pas voir), quotidien derrière la variable de
  dépôt `ENABLE_NIGHTLY_WEBKIT`, toujours sur `release/**` et à
  la demande
- `visual-regression.yml` - la matrice de baselines visuelles
  (quotidienne + à la demande ; `update_baselines=true` re-rend
  les baselines en CI et les téléverse comme artefact)
- `visual-baseline-sync.yml` - workflow de service : rend les
  baselines en CI et les pousse comme commit sur la branche de la
  PR (label `refresh-visual-baselines`, ou à la demande avec un
  numéro de PR) - la revue des images avant le merge reste
  obligatoire
- `smoke-nightly.yml` - exécution nocturne du smoke des viewports
  mobiles ; les constats vont dans une seule issue de suivi
- `unused-catalog-keys.yml` - rapport nocturne des clés de catalogue
  sans consommateur plus anciennes que la fenêtre de préparation
  (`AGE_DAYS` dans `frontend/src/i18n/unused-catalog-keys.ts`), dans
  une seule issue de suivi ; chaque clé y est une candidate, vérifiée
  une par une avant suppression

`.github/workflows/release-gate.yml` s'exécute au push d'un tag :
il vérifie que les pins de version sont synchronisés dans tous les
fichiers porteurs de version (aucune dérive), que les lockfiles des
plugins correspondent et que les artefacts régénérés sont à jour.
