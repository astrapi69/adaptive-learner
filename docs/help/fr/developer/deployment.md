# Déploiement

Adaptive Learner supporte quatre modes de déploiement.

---

## Mode 1 : Développement local

```bash
make dev
```

- Backend FastAPI sur le port 18001
- Frontend Vite sur le port 15174 (avec HMR)
- SQLite dans `~/.local/share/adaptive_learner/`

---

## Mode 2 : GitHub Pages (mode Dexie)

Le déploiement GitHub Pages est un build frontend statique sans backend.

```bash
cd frontend && VITE_STORAGE_MODE=dexie bun run build
```

Le build résultant (`frontend/dist/`) peut être déployé sur n'importe
quel hébergement de fichiers statiques.

**Limites :** pas de sessions IA backend, pas de synchronisation local,
les données persistent uniquement dans le navigateur.

Le build officiel GitHub Pages est à
`https://astrapi69.github.io/adaptive-learner/`.

### Contenu bundlé

La commande `copy-bundled-content.mjs` (exécutée automatiquement en prébuild)
copie les leçons de contenu du dépôt de contenu dans le bundle statique,
permettant un accès hors ligne aux leçons sans téléchargement.

---

## Mode 3 : Docker Compose (production)

```bash
make prod         # Démarre avec docker-compose.prod.yml
make prod-down    # Arrête
```

Configuration via les variables d'environnement dans `.env` :

```bash
ADAPTIVE_LEARNER_SECRET_KEY=...
ADAPTIVE_LEARNER_DATA_DIR=/app/data
ADAPTIVE_LEARNER_CORS_ORIGINS=https://votre-domaine.com
```

L'image Docker utilise un utilisateur non-root (`adaptive_learner`).
Le volume de données est monté sur `/app/data`.

---

## Mode 4 : Launcher de bureau (PyInstaller)

Un launcher cross-plateforme empaquette le backend Python en un binaire
autonome via PyInstaller.

```bash
cd launcher
poetry run pyinstaller adaptive-learner-launcher.spec --clean
```

L'exécutable résultant démarre le backend et ouvre le frontend dans le
navigateur système par défaut.

**Plateformes :** macOS (Intel + Apple Silicon), Windows x64, Linux x64.

---

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `ADAPTIVE_LEARNER_SECRET_KEY` | aucun (requis) | Clé de chiffrement Fernet |
| `ADAPTIVE_LEARNER_DATA_DIR` | `~/.local/share/adaptive_learner/` | Répertoire des données |
| `ADAPTIVE_LEARNER_CONFIG_DIR` | `~/.config/adaptive_learner/` | Répertoire de config |
| `ADAPTIVE_LEARNER_DEBUG` | `false` | Active les endpoints de debug et les traces |
| `ADAPTIVE_LEARNER_BIND_ADDRESS` | `127.0.0.1` | Adresse de liaison du port publié ; l'application n'a aucune authentification - ne lie `0.0.0.0` que délibérément, dans un réseau de confiance ou derrière ta propre couche d'auth (reverse proxy avec basic auth, VPN) |
| `ADAPTIVE_LEARNER_CORS_ORIGINS` | `http://localhost:15174` | Origines CORS autorisées |
| `ANTHROPIC_API_KEY` | aucun | Clé API Anthropic |
| `OPENAI_API_KEY` | aucun | Clé API OpenAI |
| `GEMINI_API_KEY` | aucun | Clé API Gemini |

---

## CI/CD

Les workflows GitHub Actions dans `.github/workflows/` :

| Workflow | Déclencheur | Ce qu'il fait |
|----------|-------------|---------------|
| `ci.yml` | Push / PR | Tests backend + plugins + frontend |
| `coverage.yml` | Push sur main | Génère les rapports de couverture |
| `release-gate.yml` | Push de tag | Vérifie la synchronisation des versions, lance la suite complète |
| `docs.yml` | Push sur main | Build et déploie le site MkDocs |

---

## En-têtes de sécurité (backend)

Le middleware CSP du backend (Phase 61) applique :

- `default-src 'none'` pour les routes API pure
- Politique adaptée aux CDN pour les chemins Swagger/OpenAPI
- Headers HSTS, X-Frame-Options, X-Content-Type-Options
