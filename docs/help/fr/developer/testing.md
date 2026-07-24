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
make test-plugins                # toutes les suites des 13 plugins
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
cd e2e && npx playwright test              # Suite complète (nécessite make dev)
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

Les rapports de couverture sont uploadés comme artefacts GitHub Actions
(rétention 14 jours) :

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

---

## Hooks pré-commit

```bash
cd backend && poetry run pre-commit install
```

Les hooks incluent : ruff lint/format, vérifications YAML/JSON,
`roadmap-archive-reminder` (non bloquant), et
`plugin-lock-paired-with-pyproject` (bloquant lors d'un push de
pyproject.toml sans poetry.lock correspondant).

---

## CI

La CI se divise en deux étages : les gates de correction s'exécutent
sur chaque PR (ils doivent passer pour merger) ; les suites coûteuses
ou en avertissement seulement tournent en équipe de nuit et à la
release.

`.github/workflows/ci.yml` s'exécute au push sur `develop` / `main`
et sur chaque PR (Python 3.12) :

1. Tests backend (pytest)
2. Tests des plugins (`make test-plugins`, les 13 via le venv backend)
3. Frontend : `tsc --noEmit`, ESLint (`--max-warnings 0`),
   vérification des dépendances circulaires, Stylelint, Vitest,
   `vite build`, `npm audit`
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
- `cohesion-check.yml` - la vérification de taille de fichier (gate
  contre `.filesize-whitelist`) plus deux gates de noms de classe :
  les noms de classe CSS morts (`check-dead-classnames.py` contre
  `.dead-classnames-baseline`) et le **gate des className sans
  style** (`--unstyled`, un cliquet contre
  `.unstyled-classnames-baseline`) - un `className` dont tous les
  tokens sont morts bloque la PR. La vérification de taille de
  dossier compagne s'exécute localement via `make check-folder-size`.
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

**Équipe de nuit / release (pas sur les PR) :**

- `dexie-smoke.yml` - le gate E2E du mode Dexie (quotidien + sur
  `release/**` + à la demande ; localement
  `make test-dexie-smoke`)
- `coverage.yml` - rapport de couverture (quotidien + à la
  demande)
- `security-scan.yml` - pip-audit / npm audit / bandit
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

`.github/workflows/release-gate.yml` s'exécute au push d'un tag :
il vérifie que les pins de version sont synchronisés dans tous les
fichiers porteurs de version (aucune dérive), que les lockfiles des
plugins correspondent et que les artefacts régénérés sont à jour.
