# Architecture

## Vue d'ensemble : 4 couches

```
Couche 1 : Frontend        React 19 + TypeScript 6 (strict) + Vite 8
Couche 2 : Backend         FastAPI + SQLAlchemy 2.0 + SQLite + Pydantic v2
Couche 3 : PluginForge     Framework de plugins externe (pluginforge ^0.10.0)
Couche 4 : Plugins         13 packages autonomes enregistrés via entry points
```

Chaque couche ne communique qu'avec les couches adjacentes. Le frontend
ne touche jamais SQLAlchemy ; les plugins ne touchent jamais React.

---

## Stockage dual

Adaptive Learner supporte **deux backends de stockage**, sélectionnable
dans les paramètres :

### ApiStorage (défaut)

- Frontend → appels HTTP `api.*` → backend FastAPI → SQLAlchemy → SQLite
- Toutes les fonctionnalités disponibles
- Données dans `~/.local/share/adaptive_learner/` (XDG-conforme)
- Les appels IA transitent par le backend

### DexieStorage (mode navigateur / GitHub Pages)

- Frontend → Dexie 4 → IndexedDB dans le navigateur
- Pas de backend requis
- Les appels IA transitent directement du navigateur au fournisseur
- Données uniquement dans le navigateur
- Certaines fonctionnalités désactivées (git persist dans Learning Repository)

L'interface **`IStorageService`** (22 espaces de noms) est la seule façon
dont les composants frontend accèdent aux données. `getStorage()` retourne
l'une ou l'autre implémentation selon la configuration.

**Règle :** tout nouveau code frontend doit utiliser `getStorage()` et
**jamais** appeler directement `api.*` ou `fetch()`.

---

## Chaîne à trois niveaux pour les clés API

Les clés API pour les fournisseurs IA sont résolues dans l'ordre :

1. **Variable d'environnement** (`ANTHROPIC_API_KEY`, etc.) — priorité maximale
2. **`~/.config/adaptive_learner/secrets.yaml`** — pour la gestion locale
3. **Colonne DB chiffrée Fernet** — entrée via l'interface Paramètres

La résolution se fait à chaque appel — les changements de configuration
sont immédiatement effectifs sans redémarrage.

---

## Structure des plugins

```
plugins/adaptive-learner-plugin-{nom}/
  adaptive_learner_{nom}/
    plugin.py          # {Nom}Plugin(BasePlugin), implémentations de hooks
    routes.py          # Routeur FastAPI (délègue aux fonctions de service)
    {module}.py        # Logique métier (sans code FastAPI)
  tests/
    test_{nom}.py
  pyproject.toml       # Entry point : [project.entry-points."adaptive_learner.plugins"]
```

Les 13 plugins expédiés : assessment, session, tracking, tools,
gamification, anki, notebooklm, learning-repo, content-loader,
missions, ai-anthropic, ai-openai, ai-gemini.

---

## Les 10 hooks

Définis dans `backend/app/hookspecs.py` :

| Hook | Déclencheur |
|------|-------------|
| `get_assessment_questions` | Chargement des questions d'évaluation |
| `calculate_profile` | Calcul du profil d'apprentissage |
| `create_session_prompt` | Construction de l'invite système de session |
| `ai_complete` | Appel IA synchrone |
| `ai_complete_async` | Appel IA asynchrone |
| `ai_complete_stream` | Appel IA en streaming |
| `recommend_method_switch` | Recommandation de changement de méthode |
| `on_session_complete` | Fin de session (le tracking écrit un ProgressCommit) |
| `get_progress_summary` | Agrégation du résumé de progression |
| `get_tool_recommendations` | Classement des recommandations d'outils |

---

## Flux de données

```
Mode API :   UI (React) → getStorage() (ApiStorage) → api.* → routeur FastAPI → service/plugin → SQLAlchemy → SQLite
Mode Dexie : UI (React) → getStorage() (DexieStorage) → Dexie → IndexedDB
```

---

## Gestion des erreurs

| Couche | Comportement |
|--------|-------------|
| Frontend | `ApiError` → toast convivial via clés i18n `ui.errors.*` |
| Client API | Erreur HTTP → converti en `ApiError` |
| Routeur | Transparent — ne capture rien |
| Service | Lève des sous-classes `AdaptiveLearnerError` |
| Plugin | Mêmes sous-classes que les services |
| Externe | `ExternalServiceError(service, message)` |

Les services ne lèvent **jamais** `HTTPException`. Le gestionnaire d'exceptions
global dans `main.py` mappe les sous-classes `AdaptiveLearnerError` aux
statuts HTTP.

---

## Thèmes

Six thèmes CSS auto-contenus dans `frontend/src/styles/themes/theme-*.css`,
plus un mode `auto` qui suit le système d'exploitation. Chaque thème définit
le jeu complet de tokens sémantiques — aucune dépendance entre thèmes.

Voir [Système de thèmes](themes.md) pour tous les détails.

---

## PWA et mobile

Adaptive Learner est une Progressive Web App avec :
- Service worker Workbox (NetworkFirst sur `GET /api/`)
- Icônes SVG + PNG masquable
- Fonctionne hors ligne pour les sessions et leçons déjà chargées
- Installable depuis le navigateur (Chrome, Edge, Safari)

Les pages mobiles utilisent des règles CSS `@media` sans bibliothèque
responsive. La grille principale se replie en une colonne sous 768 px.
