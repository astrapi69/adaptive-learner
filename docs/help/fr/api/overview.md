# Vue d'ensemble de l'API

Le backend d'Adaptive Learner expose une API REST FastAPI. En
mode Serveur, le frontend lui parle ; en mode Local (Dexie), l'API
n'est pas accessible - les mêmes opérations s'exécutent dans le
navigateur.

## URL de base

- **Dev local** : `http://localhost:18001/api`
- **Docker prod** : selon le déploiement (ex.
  `https://votre-domaine.com/api`)
- **GH Pages** : non applicable (mode Dexie)

Le frontend résout l'URL de base depuis `VITE_API_BASE` au moment
du build ; la valeur par défaut est `/api`, de sorte que le proxy
du serveur de développement Vite transfère de manière transparente.

## Authentification

v1.20.0 n'a pas d'authentification par requête. Le système est
mono-utilisateur-par-navigateur : un `user_id` est stocké dans
`localStorage` et passé dans les chemins URL
(`/users/{user_id}/...`).

Les clés des fournisseurs d'IA sont résolues via une chaîne à
trois niveaux (`services.settings.resolve_api_key`) :

1. Variable d'environnement `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
2. `ai.<provider>.api_key` dans
   `~/.config/adaptive_learner/secrets.yaml`.
3. Colonne `UserSettings.api_key_<provider>` chiffrée avec Fernet
   (définie via l'interface Paramètres ; jamais renvoyée en clair
   vers le frontend).
4. `None` - l'appel IA renvoie une erreur à l'interface.

`UserSettingsOut.key_source_*` (enum
`env | secrets_yaml | settings | none`) indique quelle couche a
résolu la clé active, par fournisseur, pour le badge de source
dans les Paramètres.

Une future phase multi-utilisateurs / multi-tenants ajoutera une
authentification. Pour l'instant, les déploiements exposés à un
réseau doivent être protégés par leur propre couche d'auth
(reverse proxy avec auth HTTP basique, Tailscale, VPN, etc.).

## Format des réponses

Les réponses réussies retournent directement l'objet de données,
sans enveloppe :

```json
{
  "id": "abc-123",
  "topic": "Grammaire espagnole",
  "active": true
}
```

Les listes retournent des tableaux JSON :

```json
[
  {"id": "p1", "topic": "Espagnol"},
  {"id": "p2", "topic": "Calcul"}
]
```

Codes de statut HTTP :

| Code | Signification |
|---|---|
| 200 | OK (lecture) |
| 201 | Créé (POST) |
| 204 | Pas de contenu (DELETE) |
| 400 | Erreur de validation (Pydantic) |
| 404 | Non trouvé |
| 409 | Conflit (rare) |
| 422 | Erreur de validation Pydantic (défaut FastAPI) |
| 500 | Erreur serveur |
| 502 | Service externe inaccessible (fournisseur IA) |

## Format des erreurs

Les erreurs retournent un seul champ `detail` :

```json
{"detail": "Project abc-123 not found"}
```

Les erreurs de validation Pydantic retournent une liste structurée :

```json
{
  "detail": [
    {"loc": ["body", "daily_minutes"], "msg": "value is not a valid integer", "type": "type_error.integer"}
  ]
}
```

En mode debug (`ADAPTIVE_LEARNER_DEBUG=true`), la réponse inclut
également un champ `traceback`. Les déploiements en production
doivent laisser le debug désactivé.

La classe `ApiError` du frontend consomme les deux formes - voir
`frontend/src/api/client.ts` pour le parser exact.

## Groupes d'endpoints

| Groupe | Préfixe | Rôle |
|---|---|---|
| Santé + i18n | `/health`, `/i18n/{lang}` | Santé de l'app + chaînes d'interface |
| Utilisateurs | `/users` | CRUD utilisateurs + projets imbriqués |
| Projets | `/projects` | Lectures / mises à jour scoped par projet |
| Paramètres | `/settings/{user_id}` | UserSettings + clés API + key_source + modèles disponibles |
| Système | `/system/info` | Version, chemins, versions des dépendances |
| Sauvegarde | `/backup/export`, `/backup/import`, `/backup/stats` | Snapshot JSON + restauration |
| Export | `/export/{progress,session,curriculum}` | Rapports MD + PDF |
| Sync | `/sync/...` | Push, pull, résolution, appairage |
| Imports | `/users/{user_id}/imports` | Import + analyse d'historique de chat |
| Sujets + tags | `/subjects`, `/users/{id}/tags`, `/projects/{id}/{subjects,tags}` | Taxonomie globale + tags par utilisateur |
| Plugin Assessment | `/plugins/assessment/...` | Questions, évaluation, profil |
| Plugin Session | `/plugins/session/...` | Démarrer, message + stream, noter, terminer, changer, prononciation |
| Plugin Tracking | `/plugins/tracking/...` | Progression + commits |
| Plugin Tools | `/plugins/tools/...` | Recommandations + espacé |
| Plugin Gamification | `/plugins/gamification/...` | XP, badges, séries, réinitialisation |
| Plugin Anki | `/plugins/anki/...` | CRUD de cartes + extraction IA + marquer-exporté |
| Plugin NotebookLM | `/plugins/notebooklm/...` | Questions d'étude + guide d'étude |
| Curriculum | `/users/{user_id}/curricula`, `/curricula/{id}` | CRUD curriculum + topics + leçons |
| Découverte de plugins | `/plugins/manifests`, `/plugins/health`, `/plugins/errors` | Ce qui est enregistré |

Voir [Endpoints principaux](core-endpoints.md) et
[Endpoints des plugins](plugin-endpoints.md) pour la liste
complète des méthodes avec exemples de requête / réponse.

## OpenAPI / Swagger

FastAPI génère automatiquement une spec OpenAPI 3.1 à partir des
schémas Pydantic.

- **OpenAPI JSON brut** : `http://localhost:18001/openapi.json` -
  servi dans tous les modes, délibérément : la spec lisible par
  machine est l'interface d'intégration, p. ex. pour les
  générateurs de clients.
- **Swagger UI** : `http://localhost:18001/api/docs` (mode debug uniquement)
- **Redoc** : `http://localhost:18001/api/redoc` (mode debug uniquement)

Ce sont les références faisant autorité pour la forme exacte de
chaque endpoint. Les pages Markdown ici sont un sous-ensemble
sélectionné pour la lisibilité.

## Pagination

Les endpoints ne paginent pas. L'ensemble de données est
mono-utilisateur et de taille réduite ; la liste la plus longue
(sessions par projet) atteint des centaines, pas des milliers.
Une future phase ajoutera une pagination par curseur si la taille
des données grandit.

## Versionnement

L'API n'a pas de préfixe de version dans l'URL. Les changements
incompatibles arrivent aux frontières majeures du semver ; le
CHANGELOG documente ce qui a bougé.
