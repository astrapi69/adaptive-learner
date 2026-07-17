# Tests

## Vue d'ensemble de la pyramide

```
Tests E2E (Playwright)           Peu nombreux, flux critiques
Tests d'intégration (pytest)     Endpoints API avec état DB réel
Tests unitaires (pytest/Vitest)  Logique métier en isolation
```

**Baseline v1.45.0 :** backend 1047 + plugins 1031 + Vitest 2624 = **4702 tests** au total.

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
   de données de production — si un test en voit un, l'exécution entière
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

Les sélecteurs E2E utilisent **uniquement** des attributs `data-testid` —
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

### Mocks d'API synchrones — attention

React 18 en mode développement monte les composants deux fois. Utilisez
`mockImplementation` (persiste) plutôt que `mockImplementationOnce`
(consommé dès la première invocation). Pour la réinitialisation entre
tests, utilisez `mockClear()` (pas `mockReset()` — cela supprime
l'implémentation).

### Hooks i18n

Le mock i18n retourne une nouvelle fonction `t` à chaque rendu.
N'incluez pas `t` dans les tableaux de dépendances `useEffect` si
la requête ne dépend pas réellement de `t`.

---

## Couverture

```bash
make test-coverage    # Optionnel, lourd — la CI l'exécute automatiquement
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
