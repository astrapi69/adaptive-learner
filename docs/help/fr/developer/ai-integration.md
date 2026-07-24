# Intégration IA

## Le hook `ai_complete`

Tous les appels IA dans Adaptive Learner transitent par le hook
`ai_complete` (ou ses variantes asynchrone/streaming). Cela permet
de connecter n'importe quel fournisseur IA en implémentant un
seul hook.

### Variantes

| Hook | Usage |
|------|-------|
| `ai_complete(prompt, model, messages)` | Appel synchrone - retourne le texte complet |
| `ai_complete_async(prompt, model, messages)` | Variante asynchrone (v1.5.0+) |
| `ai_complete_stream(prompt, model, messages)` | Streaming SSE (v1.6.0+) - yield de morceaux de texte |

Tous les trois utilisent `firstresult` - le premier plugin enregistré
qui retourne une valeur non nulle gagne.

---

## Sélection du fournisseur

Le fournisseur actif est configuré dans **Paramètres → IA**. Le backend
sélectionne le plugin correspondant (ai-anthropic, ai-openai ou ai-gemini)
via la configuration du fournisseur.

En mode Dexie, les appels IA transitent **directement du navigateur** au
fournisseur. Les clés API sont stockées en clair dans localStorage en
mode Dexie - documenté et attendu pour un déploiement GitHub Pages
uniquement navigateur.

---

## Architecture à double invite

Chaque session d'apprentissage fait tourner **deux instances IA** :

1. **IA enseignante** - génère les explications et les exercices selon la
   méthode et l'étape. Reçoit un invite système de la matrice 42 cellules
   (6 méthodes × 7 étapes).

2. **IA évaluatrice** - évalue la réponse de l'apprenant en arrière-plan.
   Retourne `{advance: bool, confidence: float, reason: str, suggested_step: int}`.

Les deux font appel à `ai_complete_async` en parallèle. L'évaluatrice ne
reçoit jamais le contexte d'invite de l'enseignante - c'est intentionnel
pour éviter les biais.

---

## La matrice d'invites (42 cellules)

Les invites système vivent dans `backend/config/sessions/` sous
`{méthode}_{étape}.txt`. Chaque fichier est un template Jinja2 avec :

- `{{ topic }}` - le sujet d'apprentissage du projet
- `{{ goal }}` - l'objectif d'apprentissage
- `{{ language }}` - la langue de la session
- `{{ step }}` - l'étape courante du cycle (1-7)
- `{{ history_summary }}` - résumé des échanges précédents

---

## Seuil de confiance

L'évaluatrice retourne une valeur de `confidence` entre 0.0 et 1.0.
Le seuil de passage par défaut varie selon la méthode :

| Méthode | Seuil |
|---------|-------|
| Déductive | 0.70 |
| Inductive | 0.70 |
| Basée sur les erreurs | 0.75 |
| Dialogique | 0.50 |
| Contextuelle | 0.65 |
| IA adaptative | Ajusté dynamiquement |

Si `confidence < seuil`, le cycle répète ou recule d'une étape selon
le champ `suggested_step` retourné.

---

## Ajouter un nouveau fournisseur

Créez un plugin avec `@hookimpl` sur `ai_complete_stream` :

```python
from pluginforge import BasePlugin, hookimpl
from typing import AsyncIterator

class MonFournisseurPlugin(BasePlugin):
    name = "ai-monfournisseur"
    version = "1.0.0"
    target_application = "adaptive_learner"

    @hookimpl
    async def ai_complete_stream(
        self, prompt: str, model: str, messages: list
    ) -> AsyncIterator[str] | None:
        if not model.startswith("monfournisseur-"):
            return None  # Laisser passer les autres fournisseurs
        async for chunk in self._call_api(prompt, model, messages):
            yield chunk
```

Implémentez les trois variantes (`ai_complete`, `ai_complete_async`,
`ai_complete_stream`) pour une couverture complète.

---

## Appels IA directs depuis le navigateur (mode Dexie)

En mode Dexie, `DexieStorage` appelle directement les API des fournisseurs
depuis le navigateur. La résolution des clés suit le même ordre de priorité
(localStorage → variable d'environnement à l'heure du build), mais les clés
sont visibles en clair dans le stockage local.

**N'utilisez le mode Dexie en production que sur des appareils de confiance
ou en déploiement personnel.**
