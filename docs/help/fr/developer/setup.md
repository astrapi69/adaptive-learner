# Guide de configuration

## Prérequis

| Composant | Version minimale | Notes |
|-----------|-----------------|-------|
| Python | 3.11+ | Poetry recommandé pour la gestion des dépendances |
| Node.js | 24.0.0+ | LTS actif recommandé |
| Bun | 1.3+ | gestionnaire de paquets du frontend (#1492) |
| Git | n'importe laquelle | Requis pour les fonctionnalités Learning Repository |

---

## Cloner et installer

```bash
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner

# Installer Python + Node + toutes les dépendances des plugins
make install
```

`make install` exécute :
1. `pip install poetry` (si absent)
2. `cd backend && poetry install`
3. `bun install` dans `frontend/`
4. `poetry install` dans chaque répertoire `plugins/`

---

## Configuration

### Clé secrète (obligatoire)

```bash
export ADAPTIVE_LEARNER_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
```

L'application refuse de démarrer sans cette variable d'environnement.

### Clés API (optionnelles)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...
```

Ou utilisez `~/.config/adaptive_learner/secrets.yaml` :

```yaml
anthropic_api_key: sk-ant-...
openai_api_key: sk-...
gemini_api_key: ...
```

### Fichier de configuration de l'application

`backend/config/app.yaml` contrôle les plugins activés, les paramètres
de base de données et les options de déploiement. Lors du premier démarrage
sans ce fichier, il est créé à partir de `app.yaml.example`.

---

## Lancer l'application

```bash
# Backend (port 18001) + frontend (port 15174) en parallèle
make dev

# Ou séparément
make dev-bg    # démarre les deux en arrière-plan
make dev-down  # arrête les processus en arrière-plan
```

L'application est disponible à `http://localhost:15174`.

---

## Tests

```bash
make test              # backend + plugins + Vitest (sans couverture)
make test-backend      # pytest backend uniquement
make test-plugins      # toutes les suites de tests des plugins
make test-frontend     # Vitest uniquement
make test-coverage     # avec rapport de couverture (optionnel)
make test-dexie-smoke  # gate de version mode Dexie (requis avant une release)
```

Tests E2E (nécessitent une application en cours d'exécution) :

```bash
cd e2e && npx playwright test
```

---

## Linting

```bash
# Backend Python
cd backend && poetry run ruff check app/ --fix
cd backend && poetry run ruff format app/

# Frontend TypeScript
cd frontend && bunx eslint src/ --fix
cd frontend && bunx prettier --write src/

# Vérification de types
cd frontend && bunx tsc --noEmit
cd backend && poetry run mypy app/
```

---

## Hooks pré-commit

```bash
cd backend && poetry run pre-commit install
```

Les hooks s'exécutent automatiquement avant chaque commit : ruff, prettier,
ESLint, et vérifications YAML/JSON.

---

## Build de production

```bash
make prod         # Lance Docker Compose avec une build de production
make prod-down    # Arrête les conteneurs de production

# Build frontend statique (pour GitHub Pages / mode Dexie)
cd frontend && VITE_STORAGE_MODE=dexie bun run build
```
