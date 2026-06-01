# Couche de stockage

## L'interface `IStorageService`

Tous les composants React accèdent aux données via `getStorage()`, qui
retourne une implémentation de `IStorageService`. L'interface comprend
22 espaces de noms :

| Espace de noms | Responsabilité |
|----------------|---------------|
| `users` | Profils utilisateurs |
| `projects` | Projets d'apprentissage |
| `profiles` | Profils d'apprentissage |
| `sessions` | Sessions d'apprentissage |
| `messages` | Messages de session |
| `ratings` | Évaluations de session |
| `notes` | Notes de session |
| `commits` | ProgressCommits |
| `curriculum` | Sujets et leçons de curriculum |
| `xp` | Points d'expérience et niveaux |
| `badges` | Badges et jalons |
| `streak` | Données de série quotidienne |
| `anki` | Flashcards Anki |
| `notebooklm` | Questions de rappel actif |
| `imports` | Conversations importées |
| `contentLoader` | Ensembles de contenu et leçons |
| `lessonProgress` | Progression dans les leçons de contenu |
| `elementErrors` | Suivi des erreurs au niveau des éléments SRS |
| `learningRepo` | Export du Learning Repository |
| `pluginSettings` | Configuration des plugins |
| `missions` | Missions quotidiennes |
| `getAsset` | Assets binaires des ensembles de contenu |

---

## ApiStorage

`ApiStorage` traduit chaque méthode de `IStorageService` en un appel
HTTP `fetch()` vers le backend FastAPI correspondant.

Résolution des clés API : la clé du fournisseur actif est lue depuis
la réponse API — jamais stockée dans le frontend.

---

## DexieStorage

`DexieStorage` implémente la même interface directement via Dexie 4
(IndexedDB). Aucune requête réseau n'est effectuée pour les données.

**Schéma actuel :** v23 (version Dexie). Les montées de version
sont gérées par les migrations Dexie dans `DexieStorage.ts`.

Les appels IA en mode Dexie utilisent `fetch()` directement depuis
le navigateur vers l'API du fournisseur.

**Clés API en mode Dexie :** stockées en clair dans `localStorage`
sous `adaptive-learner.{provider}_api_key`. Documenté et attendu
pour un déploiement GitHub Pages uniquement navigateur.

---

## Ajouter un troisième backend

Pour implémenter un troisième backend de stockage (par ex. une base
de données distante) :

1. Créez une classe qui implémente `IStorageService`
2. Implémentez les 22 espaces de noms
3. Enregistrez-la dans la résolution de `getStorage()`
4. Ajoutez une option dans les Paramètres pour la sélectionner

Les types TypeScript stricts (`IStorageService`, les sous-interfaces par
espace de noms) guident l'implémentation.

---

## Résolution du mode

`getStorage()` lit `localStorage.getItem('adaptive-learner.storage-mode')`.
Si la valeur est `'dexie'`, il retourne `DexieStorage`. Sinon, il retourne
`ApiStorage`.

Le changement de mode nécessite un rechargement de page (effectué automatiquement
depuis les Paramètres).

La variable d'environnement de build `VITE_STORAGE_MODE=dexie` définit
le mode par défaut pour le build GitHub Pages — les utilisateurs ne peuvent
pas revenir au mode API sans backend.
